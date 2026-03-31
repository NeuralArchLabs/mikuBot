const { app, BrowserWindow, ipcMain, dialog, Menu, shell, Tray, nativeImage, safeStorage } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

const https = require('https');
const agentActions = require('./agentActions.cjs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const readline = require('readline');
const SafePathResolver = require('./SafePathResolver.cjs');


// Configure ffmpeg
if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath.replace('app.asar', 'app.asar.unpacked'));
}

// Requirements:
// 1: justext
// 2: vosk
// 3: ...

// Global state for window and system tray
let mainWin = null;
let tray = null;
let isQuitting = false;
let searxenaProcess = null;

// Global Error Handler for Production Debugging
process.on('uncaughtException', (error) => {
    console.error('CRITICAL MAIN PROCESS ERROR:', error);
    // Only show dialog if app is ready to avoid startup crashes interacting weirdly
    if (app.isReady()) {
        dialog.showErrorBox('Critical Error', `A fatal error occurred:\n${error.message}`);
    }
});

// ── Paths & Persistence Manager ──────────────────────────────────────
const POINTER_FILE = path.join(app.getPath('userData'), 'workspace_pointer.json');

function getStoredWorkspacePath() {
    try {
        if (fs.existsSync(POINTER_FILE)) {
            const data = JSON.parse(fs.readFileSync(POINTER_FILE, 'utf8'));
            if (data.workspacePath && fs.existsSync(data.workspacePath)) {
                return data.workspacePath;
            }
        }
    } catch (e) {
        console.error('Error reading workspace pointer:', e);
    }
    return null;
}

function saveWorkspacePath(folderPath) {
    try {
        fs.writeFileSync(POINTER_FILE, JSON.stringify({ workspacePath: folderPath }), 'utf8');
        currentWorkspacePath = folderPath;
        
        // Ensure subsystems are updated to new path
        ensureWorkspaceStructure(currentWorkspacePath);
        reinitSafePathResolver(currentWorkspacePath);
        
        console.log('[Main Process] Workspace path updated and sandbox re-initialized:', currentWorkspacePath);
    } catch (e) {
        console.error('Error saving workspace pointer:', e);
    }
}

/**
 * Safe Atomic Write Helper
 * Prevents 0-byte or corrupted files on crash/IO error.
 */
function safeWriteJSON(filePath, data) {
    const tempPath = `${filePath}.tmp`;
    try {
        const json = JSON.stringify(data, null, 4);
        if (!json || (json === '{}' && Object.keys(data).length > 0)) {
            throw new Error(`Data validation failed for ${filePath}. Possible memory corruption.`);
        }
        
        const fd = fs.openSync(tempPath, 'w');
        fs.writeSync(fd, json, 0, 'utf8');
        fs.fsyncSync(fd);
        fs.closeSync(fd);
        
        // NO UNLINK FIRST, RENAME HANDLES IT ATOMICALLY IF SAME DRIVE
        // Verify written file exists and is not empty
        const stats = fs.statSync(tempPath);
        if (stats.size === 0) {
            throw new Error(`Written temp file ${tempPath} is empty. Aborting swap.`);
        }

        // Atomic swap
        fs.renameSync(tempPath, filePath);
        return { ok: true };
    } catch (error) {
        console.error(`[Main Process] Failed atomic write to ${filePath}:`, error.message);
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        return { ok: false, error: error.message };
    }
}

function encryptValue(val) {
    if (!val || typeof val !== 'string' || val.startsWith('enc:') || !safeStorage.isEncryptionAvailable()) return val;
    try {
        const buffer = safeStorage.encryptString(val);
        return `enc:${buffer.toString('base64')}`;
    } catch (e) {
        console.warn(`[Vault] Encryption failed:`, e.message);
        return val;
    }
}

function decryptValue(val) {
    if (!val || typeof val !== 'string' || !val.startsWith('enc:') || !safeStorage.isEncryptionAvailable()) return val;
    try {
        const base64 = val.substring(4);
        const buffer = Buffer.from(base64, 'base64');
        return safeStorage.decryptString(buffer);
    } catch (e) {
        console.warn(`[Vault] Decryption failed:`, e.message);
        return val;
    }
}

function encryptApiKeys(apiKeys) {
    if (!apiKeys) return apiKeys;
    const encrypted = { ...apiKeys };
    for (const key of Object.keys(encrypted)) {
        encrypted[key] = encryptValue(encrypted[key]);
    }
    return encrypted;
}

function decryptApiKeys(apiKeys) {
    if (!apiKeys) return apiKeys;
    const decrypted = { ...apiKeys };
    for (const key of Object.keys(decrypted)) {
        decrypted[key] = decryptValue(decrypted[key]);
    }
    return decrypted;
}


// Global path state
// Robust Fallback: In production, prioritize User Data directory over App Path to avoid common environment conflicts
let currentWorkspacePath = getStoredWorkspacePath() || (app.isPackaged ? path.join(app.getPath('userData'), 'default-workspace') : process.cwd());

const getEffectivePaths = () => {
    return {
        config: path.join(currentWorkspacePath, 'config.json'),
        sessions: path.join(currentWorkspacePath, 'sessions'),
        tasks: path.join(currentWorkspacePath, 'scheduler-tasks.json'),
        logs: path.join(currentWorkspacePath, 'scheduler-logs.json')
    };
};

const resourcesPath = app.isPackaged ? process.resourcesPath : process.cwd();

// ── Native Engine Configuration (searXena) ───────────────────────────
const SEARXENA_DIR = app.isPackaged 
    ? path.join(process.resourcesPath, 'engine', 'searXena')
    : path.join(process.cwd(), 'engine', 'searXena');
const ENGINE_PYTHON = path.join(SEARXENA_DIR, 'local', 'py3', 'Scripts', 'python.exe');

console.log('Main Process: Active Workspace Path:', currentWorkspacePath);

// ── SafePathResolver Initialization ──────────────────────────────────
function reinitSafePathResolver(workspacePath) {
    if (!workspacePath) return;
    
    const normalizedPath = path.normalize(workspacePath);
    
    SafePathResolver.init({
        '@CORE': path.join(normalizedPath, 'core'),
        '@LIBRARY': path.join(normalizedPath, 'library'),
        '@TOOLS': path.join(normalizedPath, 'commands'),
        '@WORKSPACE': path.join(normalizedPath, 'workspace'),
        '@ROOT': normalizedPath
    });
    
    console.log('[Main Process] SafePathResolver re-initialized with ROOT:', normalizedPath);
}

// Initial Call
reinitSafePathResolver(currentWorkspacePath);

// Ensure essential workspace folders exist if path is set
function ensureWorkspaceStructure(targetPath) {
    const paths = getEffectivePaths();
    if (!fs.existsSync(paths.sessions)) fs.mkdirSync(paths.sessions, { recursive: true });
}

if (getStoredWorkspacePath()) {
    ensureWorkspaceStructure(currentWorkspacePath);
}

function getApiKeys() {
    try {
        const configPath = getEffectivePaths().config;
        if (fs.existsSync(configPath)) {
            const raw = fs.readFileSync(configPath, 'utf8');
            const parsed = JSON.parse(raw);
            const keys = parsed.config?.apiKeys || {};
            return decryptApiKeys(keys);
        }
    } catch (e) {
        console.error('[Main Process] Failed to read API keys:', e.message);
    }
    return {};
}

function getTelegramToken() {
    try {
        const configPath = getEffectivePaths().config;
        if (fs.existsSync(configPath)) {
            const raw = fs.readFileSync(configPath, 'utf8');
            const parsed = JSON.parse(raw);
            return decryptValue(parsed.config?.telegramBotToken) || null;
        }
    } catch (e) {
        console.error('[Main Process] Failed to read config:', e.message);
    }
    return null;
}

function getVoskModelPath() {
    try {
        const configPath = getEffectivePaths().config;
        if (fs.existsSync(configPath)) {
            const raw = fs.readFileSync(configPath, 'utf8');
            const parsed = JSON.parse(raw);
            return parsed.config?.voskModelPath || null;
        }
    } catch (e) {
        console.error('[Main Process] Failed to read config for Vosk:', e.message);
    }
    return null;
}

// ── API Streaming Proxy ──────────────────────────────────────────────
// All LLM API calls go through here. The renderer sends the request
// body WITHOUT any API keys — keys are injected by the main process
// from config.json. Streaming chunks are forwarded via webContents.send.
ipcMain.handle('api-stream', async (event, { provider, model, body, ollamaUrl, streamId }) => {
    const sender = event.sender;
    const keys = getApiKeys();

    try {
        let url, headers;

        if (provider === 'gemini') {
            const geminiKey = keys.gemini;
            if (!geminiKey) return { ok: false, error: 'Gemini API key not configured.' };
            url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${geminiKey}`;
            headers = { 'Content-Type': 'application/json' };
        } else if (provider === 'groq') {
            const groqKey = keys.groq;
            if (!groqKey) return { ok: false, error: 'Groq API key not configured.' };
            url = 'https://api.groq.com/openai/v1/chat/completions';
            headers = {
                'Authorization': `Bearer ${groqKey}`,
                'Content-Type': 'application/json',
            };
        } else if (provider === 'zai') {
            const zaiKey = keys.zai;
            if (!zaiKey) return { ok: false, error: 'Z.AI API key not configured.' };
            url = 'https://api.z.ai/api/coding/paas/v4/chat/completions';
            headers = {
                'Authorization': `Bearer ${zaiKey}`,
                'Content-Type': 'application/json',
            };
        } else if (provider === 'ollama') {
            url = `${ollamaUrl || 'http://localhost:11434'}/api/chat`;
            headers = { 'Content-Type': 'application/json' };
        } else {
            return { ok: false, error: `Unknown provider: ${provider}` };
        }

        console.log(`[Main Process] Starting SSE Stream (${provider}/${model}) -> ${url.split('?')[0]}`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 300000); // 5 min timeout for deep thinking

        // Standard SSE headers to prevent buffering
        headers['Accept'] = 'text/event-stream';
        headers['Cache-Control'] = 'no-cache';
        headers['Connection'] = 'keep-alive';

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            if (!response.ok) {
                let errData = '';
                try { errData = await response.text(); } catch { }
                return { ok: false, error: `HTTP ${response.status}: ${errData}` };
            }

            // Stream chunks to renderer
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                // Send to renderer (check if sender is not destroyed)
                if (!sender.isDestroyed()) {
                    sender.send('api-stream-chunk', { streamId, chunk });
                } else {
                    reader.cancel();
                    break;
                }
            }

            // Signal completion
            if (!sender.isDestroyed()) {
                sender.send('api-stream-chunk', { streamId, chunk: null, done: true });
            }
            return { ok: true };
        } finally {
            clearTimeout(timeout);
        }
    } catch (error) {
        const isTimeout = error.name === 'AbortError';
        console.error(`[Main Process] API Stream Error (${provider}):`, isTimeout ? 'Timed out' : error.message);
        // Signal error to renderer
        if (!sender.isDestroyed()) {
            sender.send('api-stream-chunk', { streamId, chunk: null, done: true, error: error.message });
        }
        return {
            ok: false,
            error: isTimeout ? 'Stream timed out (120s).' : error.message,
        };
    }
});

// ── searXena Engine Management ──────────────────────────────────────
async function startSearXena() {
    if (searxenaProcess) return { ok: true, status: 'already_running' };

    // Proactive check to avoid port conflicts if engine is already running (e.g. from previous crash)
    const isBusy = await checkPort8000();
    if (isBusy) {
        console.log('[Main Process] searXena detected as already active on port 8000. Linking with existing instance.');
        return { ok: true, status: 'already_running' };
    }

    const pythonExe = ENGINE_PYTHON;
    const appScript = path.join(SEARXENA_DIR, 'core', 'app.py');

    if (!fs.existsSync(pythonExe)) {
        console.warn('[searXena] Python environment not found in searXena directory.');
        return { ok: false, error: 'Engine environment not found' };
    }

    console.log('[Main Process] Starting searXena Engine (Native Core)...');

    searxenaProcess = spawn(pythonExe, [appScript], {
        cwd: SEARXENA_DIR,
        shell: true,
        windowsHide: true,
        env: {
            ...process.env,
            PORT: "8000",
            DEBUG: "0"
        }
    });

    searxenaProcess.stdout.on('data', (data) => {
        console.log(`[searXena] ${data}`);
    });

    searxenaProcess.stderr.on('data', (data) => {
        const line = data.toString();
        if (line.includes('INFO:')) {
            console.log(`[searXena Engine] ${line.trim()}`);
        } else {
            console.error(`[searXena Error] ${line.trim()}`);
        }
    });

    searxenaProcess.on('close', (code) => {
        console.log(`[searXena] Process exited with code ${code}`);
        searxenaProcess = null;
    });

    return { ok: true };
}

let isSearxenaShuttingDown = false;

function stopSearXena() {
    if (isSearxenaShuttingDown) return Promise.resolve();
    
    return new Promise((resolve) => {
        console.log('[Main Process] Requesting searXena shutdown...');
        const { exec } = require('child_process');

        if (searxenaProcess) {
            console.log(`[Main Process] Stopping searXena process tree (PID ${searxenaProcess.pid})...`);
            exec(`taskkill /pid ${searxenaProcess.pid} /f /t`, (err) => {
                if (err) console.warn('[Main Process] taskkill error (likely already dead):', err.message);
                searxenaProcess = null;
                isSearxenaShuttingDown = true;
                setTimeout(resolve, 500);
            });
        } else {
            console.log('[Main Process] Process handle missing. Attempting to clear port 8000 safely...');
            // Refined PS command: Filter out PIDs < 10 (System/Idle) and get Unique PIDs
            const cmd = 'powershell -Command "Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -gt 10 } | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { taskkill /f /pid $_ }"';
            exec(cmd, (err) => {
                if (err) console.log('[Main Process] No user process found on port 8000.');
                isSearxenaShuttingDown = true;
                setTimeout(resolve, 800);
            });
        }
    });
}

/**
 * Synchronous version of shutdown for app exit events.
 */
function stopSearXenaSync() {
    if (isSearxenaShuttingDown) return;
    const { execSync } = require('child_process');
    try {
        if (searxenaProcess) {
            console.log(`[Main Process] Sync-killing searXena tree (PID ${searxenaProcess.pid})...`);
            execSync(`taskkill /pid ${searxenaProcess.pid} /f /t`);
            searxenaProcess = null;
        } else {
            const cmd = 'powershell -Command "Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -gt 10 } | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { taskkill /f /pid $_ }"';
            execSync(cmd);
        }
        isSearxenaShuttingDown = true;
    } catch (e) {
        // Silently fail if process is already gone
    }
}

async function checkPort8000() {
    return new Promise((resolve) => {
        const http = require('http');
        const options = {
            hostname: '127.0.0.1',
            port: 8000,
            path: '/api/v1/tools_schema',
            method: 'GET',
            timeout: 500
        };

        const req = http.request(options, (res) => {
            resolve(res.statusCode === 200);
        });

        req.on('error', () => {
            resolve(false);
        });

        req.end();
    });
}

// ── IPC Handlers ─────────────────────────────────────────────────────

// Fetch Proxy (Improved for Localhost/Ollama)
ipcMain.handle('fetch-proxy', async (event, { url, options }) => {
    try {
        // console.log(`[Main Process] Proxying request to: ${url}`);

        // Anti-IPv6 lag: if localhost, we might want to ensure we hit 127.0.0.1
        let targetUrl = url;
        if (url.includes('localhost')) {
            // Keep original log but prep for potential retry
        }

        const headers = options?.headers || {};
        if (!headers['User-Agent']) {
            headers['User-Agent'] = 'MikuCentral/1.0 (Electron)';
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // Shorter 15s timeout for detection

        try {
            const fetchOptions = {
                ...options,
                headers,
                signal: controller.signal
            };

            let response;
            try {
                response = await fetch(targetUrl, fetchOptions);
            } catch (e) {
                // If localhost failed, try 127.0.0.1 immediately
                if (url.includes('localhost')) {
                    const fallbackUrl = url.replace('localhost', '127.0.0.1');
                    // console.log(`[Main Process] Localhost failed, trying fallback: ${fallbackUrl}`);
                    response = await fetch(fallbackUrl, fetchOptions);
                } else {
                    throw e;
                }
            }

            let data;
            const contentType = response.headers.get('content-type') || '';

            if (contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            if (!response.ok) {
                return { ok: false, status: response.status, data, error: `HTTP ${response.status}` };
            }
            return { ok: true, status: response.status, data };
        } finally {
            clearTimeout(timeout);
        }
    } catch (error) {
        const isTimeout = error.name === 'AbortError';
        console.error(`[Main Process] Proxy Error for ${url}:`, isTimeout ? 'Request Timed Out' : error.message);
        return {
            ok: false,
            status: isTimeout ? 408 : 500,
            error: isTimeout ? 'Connection Timed Out (15s). Is the server running?' : error.message
        };
    }
});

// Settings Handlers
ipcMain.handle('save-settings', async (event, settings) => {
    try {
        const configPath = getEffectivePaths().config;
        console.log('Saving settings to:', configPath);

        // Vault Protection: Encrypt sensitive keys before disk persistence
        const protectedSettings = JSON.parse(JSON.stringify(settings));
        if (protectedSettings.config?.apiKeys) {
            protectedSettings.config.apiKeys = encryptApiKeys(protectedSettings.config.apiKeys);
        }
        if (protectedSettings.config?.telegramBotToken) {
            protectedSettings.config.telegramBotToken = encryptValue(protectedSettings.config.telegramBotToken);
        }
        if (protectedSettings.config?.telegramChatId) {
            protectedSettings.config.telegramChatId = encryptValue(protectedSettings.config.telegramChatId);
        }

        const result = safeWriteJSON(configPath, protectedSettings);
        if (!result.ok) throw new Error(result.error);

        // React to system settings immediately

        if (settings.config) {
            if (settings.config.autoLaunch !== undefined) {
                updateAutoLaunch(settings.config.autoLaunch);
            }
            if (settings.config.minimizeToTray) {
                createTray();
            } else {
                destroyTray();
            }
        }

        return { ok: true };
    } catch (error) {
        console.error('Failed to save settings:', error);
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('load-settings', async () => {
    try {
        const paths = getEffectivePaths();
        const configPath = paths.config;
        console.log('Loading settings from:', configPath);
        
        let settings = { config: {} };
        
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            settings = JSON.parse(data);
            
            // Vault Decryption: Ensure frontend receives clean keys
            if (settings.config?.apiKeys) {
                settings.config.apiKeys = decryptApiKeys(settings.config.apiKeys);
            }
            if (settings.config?.telegramBotToken) {
                settings.config.telegramBotToken = decryptValue(settings.config.telegramBotToken);
            }
            if (settings.config?.telegramChatId) {
                settings.config.telegramChatId = decryptValue(settings.config.telegramChatId);
            }
        } else {
            console.log('[Main Process] No config.json found at target path. Providing defaults.');
        }

        // AUTO-INJECT ROOT PATHS: Ensure frontend and backend are always in sync
        // This fixes ENOENT issues when @ROOT is not explicitly defined in config.json
        if (!settings.config) settings.config = {};
        if (!settings.config.folderPaths) settings.config.folderPaths = {};
        if (!settings.config.folderNames) settings.config.folderNames = {};

        settings.config.folderPaths.root = currentWorkspacePath;
        settings.config.folderNames.root = path.basename(currentWorkspacePath) || 'MikuCentral';

        return { ok: true, settings };
    } catch (error) {
        console.error('Failed to load settings:', error);
        return { ok: false, error: error.message };
    }
});

// Sessions Handlers
ipcMain.handle('get-sessions', async () => {
    try {
        const sessionsDir = getEffectivePaths().sessions;
        if (!fs.existsSync(sessionsDir)) return { ok: true, sessions: [] };

        const files = fs.readdirSync(sessionsDir);
        const sessions = files
            .filter(f => f.endsWith('.json'))
            .map(f => {
                try {
                    const filePath = path.join(sessionsDir, f);
                    const content = fs.readFileSync(filePath, 'utf8');
                    const session = JSON.parse(content);
                    return {
                        id: session.id,
                        title: session.title,
                        lastModified: fs.statSync(filePath).mtimeMs,
                        messageCount: session.messages?.length || 0
                    };
                } catch (e) {
                    // Proactive cleanup: If file is 0 bytes or unreadable, remove it to prevent UI clutter
                    console.warn(`[Main Process] Clearing corrupted session: ${f}`, e.message);
                    try { fs.unlinkSync(path.join(sessionsDir, f)); } catch { }
                    return null;
                }
            })
            .filter(s => s !== null)
            .sort((a, b) => b.lastModified - a.lastModified);
            
        return { ok: true, sessions };
    } catch (error) {
        console.error('[Main Process] get-sessions fatal error:', error);
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('load-session', async (event, id) => {
    try {
        const filePath = path.join(getEffectivePaths().sessions, `${id}.json`);
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return { ok: true, session: JSON.parse(data) };
        }
        return { ok: false, error: 'Session not found' };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('save-session', async (event, session) => {
    try {
        const sessionsDir = getEffectivePaths().sessions;
        if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });
        const filePath = path.join(sessionsDir, `${session.id}.json`);
        return safeWriteJSON(filePath, session);
    } catch (error) {
        console.error(`[Main Process] Error in save-session:`, error.message);
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('delete-session', async (event, id) => {
    try {
        const filePath = path.join(getEffectivePaths().sessions, `${id}.json`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

// ── Neural Scheduler Persistence ─────────────────────────────────────
ipcMain.handle('save-scheduler-tasks', async (event, data) => {
    try {
        fs.writeFileSync(getEffectivePaths().tasks, data, 'utf8');
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('load-scheduler-tasks', async () => {
    try {
        const taskPath = getEffectivePaths().tasks;
        if (fs.existsSync(taskPath)) {
            const data = fs.readFileSync(taskPath, 'utf8');
            return { ok: true, data };
        }
        return { ok: true, data: '[]' };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('save-scheduler-logs', async (event, data) => {
    try {
        fs.writeFileSync(getEffectivePaths().logs, data, 'utf8');
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('load-scheduler-logs', async () => {
    try {
        const logPath = getEffectivePaths().logs;
        if (fs.existsSync(logPath)) {
            const data = fs.readFileSync(logPath, 'utf8');
            return { ok: true, data };
        }
        return { ok: true, data: '[]' };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

// ── Voice & Vosk Model Management ────────────────────────────────────
// Models are stored in the application's installation directory (resourcesPath)
// to avoid duplicating heavy assets (LLM/Vosk models) across different user workspaces.
const getVoskModelsRoot = () => path.join(resourcesPath, 'engine', 'models', 'vosk');
// Bundled root is the same as models root in this architecture
const getVoskBundledRoot = () => getVoskModelsRoot();

/**
 * Parallel Dependency Bootstrap (Silent)
 * Installs libraries like Vosk in the background to ensure they are ready 
 * without delaying the main search engine setup.
 */
async function bootstrapHeavyDependencies() {
    if (!fs.existsSync(ENGINE_PYTHON)) {
        console.warn('[Bootstrap] Python engine not ready yet. Skipping parallel install.');
        return;
    }

    console.log('[Bootstrap] Checking critical heavy dependencies (Vosk)...');
    const checkVoskCmd = `"${ENGINE_PYTHON}" -c "import vosk"`;
    
    exec(checkVoskCmd, (err) => {
        if (err) {
            console.log('[Bootstrap] Vosk missing. Starting parallel installation...');
            const installVoskCmd = `"${ENGINE_PYTHON}" -m pip install vosk --quiet`;
            exec(installVoskCmd, (vErr) => {
                if (vErr) console.error('[Bootstrap] Failed to install Vosk automatically:', vErr.message);
                else console.log('[Bootstrap] Vosk successfully installed in parallel.');
            });
        } else {
            console.log('[Bootstrap] Vosk is already available.');
        }
    });
}

ipcMain.handle('voice:status', async () => {
    try {
        const { exec } = require('child_process');
        return new Promise((resolve) => {
            // Check if vosk can be imported in the current engine python
            const checkCmd = `"${ENGINE_PYTHON}" -c "import vosk; print('OK')"`;
            const start = performance.now();
            exec(checkCmd, (err, stdout) => {
                const latencyMs = Math.round(performance.now() - start);
                if (err) {
                    resolve({ ok: true, online: false, error: 'Vosk module not installed', latencyMs });
                } else {
                    resolve({ ok: true, online: stdout.includes('OK'), latencyMs });
                }
            });
        });
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('voice:list-models', async () => {
    try {
        const models = new Set();
        const workspaceRoot = getVoskModelsRoot();

        // Check the installation folder for models
        if (fs.existsSync(workspaceRoot)) {
            fs.readdirSync(workspaceRoot)
                .filter(f => {
                    const fullPath = path.join(workspaceRoot, f);
                    try { return fs.statSync(fullPath).isDirectory(); } catch(e) { return false; }
                })
                .forEach(m => models.add(m));
        } else {
            // Ensure folder exists (might need admin rights if in Program Files)
            try { fs.mkdirSync(workspaceRoot, { recursive: true }); } catch(e) { console.warn('[Voice] Could not create models dir:', e.message); }
        }

        return { ok: true, models: Array.from(models) };
    } catch (error) {
        console.error('[Voice] list-models error:', error);
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('voice:download-model', async (event, { lang }) => {
    try {
        const workspaceRoot = getVoskModelsRoot();
        const url = modelUrls[lang];
        if (!url) return { ok: false, error: `Language ${lang} not supported for auto-download.` };

        const https = require('https');
        const unzipper = require('unzipper');

        const tempZip = path.join(workspaceRoot, `model_${lang}.zip`);
        const file = fs.createWriteStream(tempZip);

        return new Promise((resolve) => {
            https.get(url, (response) => {
                const totalBytes = parseInt(response.headers['content-length'], 10);
                let downloadedBytes = 0;

                response.on('data', (chunk) => {
                    downloadedBytes += chunk.length;
                    const progress = Math.round((downloadedBytes / totalBytes) * 100);
                    sender.send('voice:download-progress', { lang, progress });
                });

                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    // Extract
                    fs.createReadStream(tempZip)
                        .pipe(unzipper.Extract({ path: workspaceRoot }))
                        .on('close', () => {
                            if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip);
                            resolve({ ok: true, lang });
                        })
                        .on('error', (err) => resolve({ ok: false, error: err.message }));
                });
            }).on('error', (err) => {
                fs.unlinkSync(tempZip);
                resolve({ ok: false, error: err.message });
            });
        });
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('voice:delete-model', async (event, { modelName }) => {
    try {
        const modelPath = path.join(getVoskModelsRoot(), modelName);
        if (fs.existsSync(modelPath)) {
            fs.rmSync(modelPath, { recursive: true, force: true });
        }
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

// ── Voice Recognition Engine ──────────────────────────────────────────
let voicePythonProcess = null;

ipcMain.handle('voice:start-recognition', async (event, { modelName }) => {
    const sender = event.sender;

    const pythonExe = ENGINE_PYTHON;
    const engineScript = path.join(resourcesPath, 'engine', 'voice_engine.py');

    if (!fs.existsSync(pythonExe)) return { ok: false, error: 'Engine environment not found (searXena).' };
    if (!fs.existsSync(engineScript)) return { ok: false, error: 'Voice engine script missing.' };

    try {
        let fullPath = path.join(getVoskModelsRoot(), modelName);
        if (!fs.existsSync(fullPath)) fullPath = path.join(getVoskBundledRoot(), modelName);
        if (!fs.existsSync(fullPath)) return { ok: false, error: `Model not found: ${modelName}` };

        // Clean up previous if any
        if (voicePythonProcess) {
            voicePythonProcess.kill();
            voicePythonProcess = null;
        }

        console.log('[Voice] Starting Python Engine with model:', fullPath);
        const { spawn } = require('child_process');
        voicePythonProcess = spawn(pythonExe, [engineScript, fullPath]);

        const rl = readline.createInterface({ input: voicePythonProcess.stdout });
        rl.on('line', (line) => {
            if (!line.trim()) return;
            try {
                const msg = JSON.parse(line);
                if (msg.status === 'ready') {
                    console.log('[Voice] Python Engine Ready. Waiting for renderer audio.');
                    sender.send('voice:engine-ready');
                } else if (msg.text) {
                    sender.send('voice:recognition-result', { text: msg.text, final: msg.final });
                } else if (msg.error) {
                    sender.send('voice:recognition-error', { error: msg.error });
                }
            } catch (e) {
                console.error('[Voice] JSON Parse Error:', e, 'Line:', line);
            }
        });


        voicePythonProcess.stderr.on('data', (data) => {
            console.error('[Voice Engine Error]:', data.toString());
        });

        voicePythonProcess.on('close', (code) => {
            console.log('[Voice] Python Engine closed with code:', code);
            voicePythonProcess = null;
        });

        return { ok: true };
    } catch (error) {
        console.error('[Voice] Start Error:', error);
        return { ok: false, error: error.message };
    }
});

ipcMain.on('voice:audio-chunk', (event, arrayBuffer) => {
    if (voicePythonProcess && voicePythonProcess.stdin.writable) {
        // Convertimos ArrayBuffer a Buffer de Node.js para que el proceso Python lo acepte
        voicePythonProcess.stdin.write(Buffer.from(arrayBuffer));
    }
});

ipcMain.handle('voice:stop-recognition', async () => {
    try {
        if (voicePythonProcess) {
            voicePythonProcess.kill();
            voicePythonProcess = null;
        }
        return { ok: true };
    } catch (error) {
        console.error('[Voice] Stop Error:', error);
        return { ok: false, error: error.message };
    }
});

// ── Telegram Voice Processing ────────────────────────────────────────
ipcMain.handle('telegram:process-voice', async (event, fileId) => {
    const token = getTelegramToken();
    if (!token) return { ok: false, error: 'Telegram Bot Token not configured.' };

    const voskModelName = getVoskModelPath();
    if (!voskModelName) return { ok: false, error: 'Vosk Model not configured.' };

    const pythonExe = ENGINE_PYTHON;
    const engineScript = path.join(resourcesPath, 'engine', 'voice_engine.py');

    if (!fs.existsSync(pythonExe)) return { ok: false, error: 'Engine environment not found (searXena).' };
    if (!fs.existsSync(engineScript)) return { ok: false, error: 'Voice engine script missing.' };

    let modelPath = path.join(getVoskModelsRoot(), voskModelName);
    if (!fs.existsSync(modelPath)) modelPath = path.join(getVoskBundledRoot(), voskModelName);
    if (!fs.existsSync(modelPath)) return { ok: false, error: `Model not found: ${voskModelName}` };

    const tempDir = path.join(app.getPath('temp'), 'miku_voice_temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const oggPath = path.join(tempDir, `${fileId}.ogg`);

    try {
        const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
        const fileData = await fileRes.json();
        if (!fileData.ok) throw new Error(fileData.description || 'Failed to get file path');

        const downloadRes = await fetch(`https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`);
        if (!downloadRes.ok) throw new Error('Failed to download voice file');

        const arrayBuffer = await downloadRes.arrayBuffer();
        fs.writeFileSync(oggPath, Buffer.from(arrayBuffer));

        return new Promise((resolve) => {
            const pyProc = spawn(pythonExe, [engineScript, modelPath]);
            let transcriptionParts = [];
            let lastPartial = "";
            let isEngineReady = false;
            let engineError = null;

            const rl = readline.createInterface({ input: pyProc.stdout });

            rl.on('line', (line) => {
                if (!line.trim()) return;
                try {
                    const msg = JSON.parse(line);
                    if (msg.status === 'ready') {
                        isEngineReady = true;
                        ffmpeg(oggPath)
                            .inputOptions(['-analyzeduration 1M', '-probesize 1M'])
                            .toFormat('s16le')
                            .audioFrequency(16000)
                            .audioChannels(1)
                            .on('error', (err) => {
                                console.error('[Telegram Voice] FFmpeg Error:', err);
                                engineError = `FFmpeg Error: ${err.message}`;
                                pyProc.kill();
                            })
                            .on('end', () => {
                                // Pequeña espera para asegurar que el "silencio de cierre" se procese
                                setTimeout(() => {
                                    if (pyProc.stdin.writable) pyProc.stdin.end();
                                }, 300);
                            })
                            .pipe(pyProc.stdin);
                    } else if (msg.text) {
                        if (msg.final) {
                            transcriptionParts.push(msg.text);
                            lastPartial = ""; // Limpiar parcial si se consolidó
                        } else {
                            lastPartial = msg.text; // Guardar último parcial por si acaso
                        }
                    } else if (msg.error) {
                        console.error('[Telegram Voice] Error from Python engine:', msg.error);
                        engineError = msg.error;
                        pyProc.kill();
                    }
                } catch (e) {
                    console.warn('[Telegram Voice] JSON Parse error on line:', line);
                }
            });

            // Usamos rl.on('close') en lugar de pyProc.on('close') para asegurar el vaciado del pipe
            rl.on('close', () => {
                if (fs.existsSync(oggPath)) fs.unlinkSync(oggPath);

                if (engineError) {
                    return resolve({ ok: false, error: engineError });
                }

                // Si el motor terminó y nos quedó un parcial sin consolidar, lo añadimos
                if (lastPartial) transcriptionParts.push(lastPartial);

                const finalResult = transcriptionParts.join(" ").trim();
                
                if (!finalResult) {
                    return resolve({ ok: false, error: 'No se detectaron palabras en el audio o el mensaje es demasiado corto.' });
                }

                console.log(`[Telegram Voice] Transcription completed. Words: ${transcriptionParts.length}`);
                resolve({ ok: true, text: finalResult });
            });

            pyProc.on('error', (err) => {
                if (fs.existsSync(oggPath)) fs.unlinkSync(oggPath);
                resolve({ ok: false, error: 'Engine process error: ' + err.message });
            });

            setTimeout(() => {
                if (!isEngineReady) {
                    pyProc.kill();
                    if (fs.existsSync(oggPath)) fs.unlinkSync(oggPath);
                    resolve({ ok: false, error: 'Voice engine timed out during start.' });
                }
            }, 15000);
        });

    } catch (e) {
        console.error('[Telegram Voice] Critical:', e);
        if (fs.existsSync(oggPath)) fs.unlinkSync(oggPath);
        return { ok: false, error: e.message };
    }
});






// File System Native Handlers
ipcMain.handle('fs-select-folder', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled) return { ok: false };
    const folderPath = result.filePaths[0];
    return { ok: true, path: folderPath, name: path.basename(folderPath) };
});

ipcMain.handle('fs-open-folder', async (event, folderPath) => {
    try {
        if (!folderPath) return { ok: false, error: 'Path is required' };
        
        // Resolve path through sandbox rules
        const resolvedPath = SafePathResolver.resolvePath(folderPath);
        if (!fs.existsSync(resolvedPath)) {
            return { ok: false, error: 'Path does not exist' };
        }
        await shell.openPath(resolvedPath);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    }
});

ipcMain.handle('get-default-path', () => {
    return { ok: true, path: path.join(app.getPath('home'), 'mikuCentral') };
});

ipcMain.handle('fs-check-existing', async (event, targetPath) => {
    try {
        if (!fs.existsSync(targetPath)) return { exists: false };
        const keyFiles = ['config.json', 'sessions', 'core', 'commands'];
        const found = keyFiles.filter(f => fs.existsSync(path.join(targetPath, f)));
        return { exists: found.length > 0, found };
    } catch (e) {
        return { ok: false, error: e.message };
    }
});

ipcMain.handle('setup-onboarding', async (event, { targetPath, cleanInstall }) => {
    try {
        if (cleanInstall && fs.existsSync(targetPath)) {
            // Backup before wipe? For now just wipe essential folders if user said clean
            const foldersToWipe = ['core', 'commands', 'workspace', 'library', 'sessions'];
            for (const f of foldersToWipe) {
                const fp = path.join(targetPath, f);
                if (fs.existsSync(fp)) fs.rmSync(fp, { recursive: true, force: true });
            }
            const filesToWipe = ['config.json', 'scheduler-tasks.json', 'scheduler-logs.json'];
            for (const f of filesToWipe) {
                const fp = path.join(targetPath, f);
                if (fs.existsSync(fp)) fs.unlinkSync(fp);
            }
        }

        const folders = ['core', 'commands', 'workspace', 'library', 'sessions'];
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
        }

        for (const f of folders) {
            const fp = path.join(targetPath, f);
            if (!fs.existsSync(fp)) {
                fs.mkdirSync(fp, { recursive: true });
            }
        }

        // Save selection as the permanent workspace
        saveWorkspacePath(targetPath);

        // Populate @TOOLS (commands) from app internal resources
        // coreBasePath: Internal engine templates, modes, and skills
        const coreBasePath = path.join(resourcesPath, 'core', 'base');
        
        // targetFolders: Folders in the user's workspace to be populated
        // Note: @CORE is intentionally left empty (reserved for Soul/User state)
        // Note: @TOOLS (commands) receives the static engine files
        const workspaceCommandsPath = path.join(targetPath, 'commands');

        if (fs.existsSync(coreBasePath)) {
            console.log('[Setup] Seeding static engine files to @TOOLS from:', coreBasePath);
            
            // Seed @TOOLS in workspace (Common skills, blueprints, MODES.md, etc.)
            fs.cpSync(coreBasePath, workspaceCommandsPath, { recursive: true, overwrite: cleanInstall });
            
            console.log('[Setup] Static engine files (@TOOLS) seeded successfully.');
        } else {
            console.warn('[Setup] Internal core/base not found. Seeding skipped.');
        }

        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    }
});

// ── Backup System ──────────────────────────────────────────────────
ipcMain.handle('export-backup', async () => {
    const { filePath } = await dialog.showSaveDialog({
        title: 'Exportar Copia de Seguridad',
        defaultPath: path.join(app.getPath('downloads'), `MikuCentral_Backup_${new Date().toISOString().split('T')[0]}.zip`),
        filters: [{ name: 'Zip Archive', extensions: ['zip'] }]
    });

    if (!filePath) return { canceled: true };

    return new Promise((resolve) => {
        const { execFile } = require('child_process');
        // Usar PowerShell nativo para comprimir via execFile para evitar inyecciones en el path
        const psArgs = [
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-Command', `Compress-Archive -Path '${currentWorkspacePath}/*' -DestinationPath '${filePath}' -Force`
        ];

        execFile('powershell.exe', psArgs, (error, stdout, stderr) => {
            if (error) {
                console.error('[Main Process] Backup Failed:', stderr || error.message);
                resolve({ ok: false, error: stderr || error.message });
            } else {
                resolve({ ok: true, path: filePath });
            }
        });
    });
});

ipcMain.handle('import-backup', async () => {
    const { filePaths } = await dialog.showOpenDialog({
        title: 'Importar Copia de Seguridad',
        filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
        properties: ['openFile']
    });

    if (!filePaths || filePaths.length === 0) return { canceled: true };

    const zipPath = filePaths[0];

    // VALIDACIÓN: Verificar que el archivo existe y es legible antes de procesar
    try {
        const stats = await fs.promises.stat(zipPath);
        if (!stats.isFile()) {
            return { ok: false, error: 'El archivo seleccionado no es válido.' };
        }
    } catch (e) {
        return { ok: false, error: `Error al acceder al archivo: ${e.message}` };
    }

    return new Promise((resolve) => {
        const { execFile } = require('child_process');
        const psArgs = [
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-Command', `Expand-Archive -Path '${zipPath}' -DestinationPath '${currentWorkspacePath}' -Force`
        ];

        execFile('powershell.exe', psArgs, (error, stdout, stderr) => {
            if (error) {
                console.error('[Main Process] Import Failed:', stderr || error.message);
                resolve({ ok: false, error: stderr || error.message });
            } else {
                resolve({ ok: true });
            }
        });
    });
});

ipcMain.handle('run-console', async (event, input) => {
    const { command, args, cwd, timeout_ms: topTimeout } = input;
    const { spawn } = require('child_process');
    const blockedOperators = /[>|&;]/; // Bloquear >, >>, |, &, ;
    
    return new Promise((resolve) => {
        // Bloqueo de operadores vía regex
        const commandStr = command || '';
        const argsStr = typeof args === 'string' ? args : (Array.isArray(args) ? args.join(' ') : JSON.stringify(args || ''));
        
        if (blockedOperators.test(commandStr) || blockedOperators.test(argsStr)) {
            return resolve({
                code: 1,
                stdout: '',
                stderr: 'SecurityError: Comando bloqueado por uso de operadores prohibidos (> | & ;).',
                error: 'Forbidden operator detected'
            });
        }

        console.log(`[Main Process] Shell: ${commandStr} ${argsStr} (Secure Spawn) in ${cwd || 'root'}`);

        // Extraer timeout_ms (del objeto principal o de args)
        const requestedTimeout = topTimeout || (args && args.timeout_ms) || 15000;
        const timeout_ms = Math.min(requestedTimeout, 120000);
        
        // Determinar argumentos para spawn
        let spawnArgs = [];
        if (typeof args === 'string') {
            spawnArgs = args.split(/\s+/).filter(a => a.length > 0);
        } else if (Array.isArray(args)) {
            spawnArgs = args;
        }

        // Usar spawn para mayor control
        // Determinamos el Shell por plataforma para mayor seguridad
        const shellCmd = process.platform === 'win32' ? 'powershell.exe' : '/bin/sh';
        
        // Si usamos shell: true, pasamos el comando como un solo string
        // Si usamos shell: false, pasamos el ejecutable y argumentos por separado
        // Para máxima seguridad contra inyecciones, idealmente shell: false
        
        const proc = spawn(command, spawnArgs, { 
            cwd: cwd ? SafePathResolver.resolvePath(cwd) : SafePathResolver.roots['@WORKSPACE'],
            shell: true, // Requerido para muchos comandos del usuario, mitigado por regex
            windowsHide: true,
            timeout: timeout_ms 
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => stdout += data.toString());
        proc.stderr.on('data', (data) => stderr += data.toString());

        const timer = setTimeout(() => {
            try { proc.kill(); } catch(e) {}
            resolve({
                code: 1,
                stdout,
                stderr: `${stderr}\nERROR: Proceso finalizado por timeout (${timeout_ms}ms).`,
                error: 'Process Timed Out'
            });
        }, timeout_ms);

        proc.on('close', (code) => {
            clearTimeout(timer);
            resolve({
                code: code ?? 0,
                stdout: stdout,
                stderr: stderr,
                error: null
            });
        });

        proc.on('error', (err) => {
            clearTimeout(timer);
            resolve({
                code: 1,
                stdout: stdout,
                stderr: stderr,
                error: err.message
            });
        });
    });
});

ipcMain.handle('run-search', async (event, { query }) => {
    return new Promise((resolve) => {
        console.log(`[Main Process] Native Search (API): "${query}"`);
        const http = require('http');
        const data = JSON.stringify({ query: query, limit: 10 });
        
        const options = {
            hostname: '127.0.0.1',
            port: 8000,
            path: '/api/v1/search',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            },
            timeout: 10000
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const parsed = JSON.parse(body);
                        resolve({ ok: true, data: parsed });
                    } catch (e) {
                        resolve({ ok: false, error: 'Failed to parse search results' });
                    }
                } else {
                    resolve({ ok: false, error: `Search engine returned status ${res.statusCode}` });
                }
            });
        });

        req.on('error', (e) => {
            console.error('[Main Process] Search API Error:', e);
            resolve({ ok: false, error: 'El motor searXena no responde en el puerto 8000. Asegúrate de iniciarlo.' });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ ok: false, error: 'Timeout waiting for search engine' });
        });

        req.write(data);
        req.end();
    });
});

ipcMain.handle('run-extract', async (event, { url }) => {
    return new Promise((resolve) => {
        console.log(`[Main Process] Native Extract (API): "${url}"`);
        const http = require('http');
        const data = JSON.stringify({ url: url });
        
        const options = {
            hostname: '127.0.0.1',
            port: 8000,
            path: '/api/v1/extract',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            },
            timeout: 15000
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const parsed = JSON.parse(body);
                        resolve({ ok: true, data: parsed });
                    } catch (e) {
                        resolve({ ok: false, error: 'Failed to parse extraction results' });
                    }
                } else {
                    resolve({ ok: false, error: `Extraction engine returned status ${res.statusCode}` });
                }
            });
        });

        req.on('error', (e) => {
            console.error('[Main Process] Extraction API Error:', e);
            resolve({ ok: false, error: 'El motor de extracción no responde. Asegúrate de que searXena esté al día.' });
        });

        req.write(data);
        req.end();
    });
});

ipcMain.handle('list-skills', async (event, { toolsPath }) => {
    try {
        if (!toolsPath) return { ok: false, error: 'Tools path not provided' };
        const skillsPath = path.join(toolsPath, 'skills');
        console.log(`[Main Process] Listing skills from: ${skillsPath}`);

        if (!fs.existsSync(skillsPath)) {
            return { ok: true, skills: [] };
        }

        const skills = [];
        const folders = fs.readdirSync(skillsPath);

        for (const folder of folders) {
            const skillDir = path.join(skillsPath, folder);
            if (fs.statSync(skillDir).isDirectory()) {
                const manifestPath = path.join(skillDir, 'manifest.json');
                if (fs.existsSync(manifestPath)) {
                    try {
                        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                        manifest.__folderName = folder; // Attach internal folder name
                        skills.push(manifest);
                    } catch (e) {
                        console.warn(`[Main Process] Failed to parse manifest for skill ${folder}:`, e.message);
                    }
                }
            }
        }

        return { ok: true, skills };
    } catch (error) {
        console.error('[Main Process] list-skills error:', error);
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('list-blueprints', async (event, { toolsPath, corePath }) => {
    try {
        let blueprintsRoot = '';

        // 1. Check toolsPath (User-selected commands folder)
        if (toolsPath) {
            const testPath = path.join(toolsPath, 'blueprints');
            if (fs.existsSync(testPath)) blueprintsRoot = testPath;
        }

        // 2. Check corePath (User-selected core folder)
        if (!blueprintsRoot && corePath) {
            const testPath = path.join(corePath, 'blueprints');
            if (fs.existsSync(testPath)) blueprintsRoot = testPath;
        }

        // 3. Check App Resources (Packaged external folder)
        if (!blueprintsRoot) {
            const externalPath = path.join(resourcesPath, 'core', 'base', 'blueprints');
            if (fs.existsSync(externalPath)) blueprintsRoot = externalPath;
        }

        // 4. Check Internal App Data (Inside ASAR if files were included)
        if (!blueprintsRoot) {
            const internalPath = path.join(app.getAppPath(), 'core', 'base', 'blueprints');
            if (fs.existsSync(internalPath)) blueprintsRoot = internalPath;
        }

        // 5. Check Root Path (Next to Exe)
        if (!blueprintsRoot) {
            const rootStatic = path.join(rootPath, 'core', 'base', 'blueprints');
            if (fs.existsSync(rootStatic)) blueprintsRoot = rootStatic;
        }

        console.log(`[Main Process] Blueprint discovery root: ${blueprintsRoot || 'FAILED'}`);

        if (!blueprintsRoot || !fs.existsSync(blueprintsRoot)) {
            return { ok: true, blueprints: [] };
        }

        const blueprints = [];
        const categories = fs.readdirSync(blueprintsRoot);

        for (const cat of categories) {
            const catDir = path.join(blueprintsRoot, cat);
            if (fs.statSync(catDir).isDirectory()) {
                const files = fs.readdirSync(catDir).filter(f => f.endsWith('.json'));
                for (const file of files) {
                    try {
                        const content = JSON.parse(fs.readFileSync(path.join(catDir, file), 'utf8'));
                        if (!content.category) content.category = cat;
                        blueprints.push(content);
                    } catch (e) {
                        console.warn(`[Main Process] Failed to parse blueprint ${file}:`, e.message);
                    }
                }
            }
        }

        return { ok: true, blueprints };
    } catch (error) {
        console.error('[Main Process] list-blueprints error:', error);
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('execute-skill', async (event, { toolsPath, skillName, args }) => {
    try {
        if (!toolsPath || !skillName) return { ok: false, error: 'Missing parameters' };

        const skillsPath = path.join(toolsPath, 'skills');
        let skillPath = path.join(skillsPath, skillName);
        let manifestPath = path.join(skillPath, 'manifest.json');

        // Robust Resolution: If folder doesn't match name, search manifests
        if (!fs.existsSync(manifestPath)) {
            const folders = fs.readdirSync(skillsPath);
            let found = false;
            for (const folder of folders) {
                const testPath = path.join(skillsPath, folder, 'manifest.json');
                if (fs.existsSync(testPath)) {
                    const m = JSON.parse(fs.readFileSync(testPath, 'utf8'));
                    if (m.name === skillName) {
                        skillPath = path.join(skillsPath, folder);
                        manifestPath = testPath;
                        found = true;
                        break;
                    }
                }
            }
            if (!found) {
                return { ok: false, error: `Skill "${skillName}" not found or manifest missing.` };
            }
        }

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const entryFile = path.join(skillPath, manifest.entry);

        if (!fs.existsSync(entryFile)) {
            return { ok: false, error: `Entry file "${manifest.entry}" not found for skill "${skillName}".` };
        }

        console.log(`[Main Process] Executing skill: ${skillName} (${manifest.runtime})`);

        if (manifest.runtime === 'python') {
            const { execFile } = require('child_process');
            const pythonExe = ENGINE_PYTHON;

            // Security: Use execFile to avoid shell injection
            return new Promise((resolve) => {
                execFile(pythonExe, [entryFile, JSON.stringify(args)], (error, stdout, stderr) => {
                    if (error) {
                        console.error(`[Main Process] Skill execution error (${skillName}):`, error.message);
                        return resolve({ ok: false, error: error.message, stderr });
                    }
                    try {
                        const match = stdout.match(/\{[\s\S]*\}/);
                        const data = match ? JSON.parse(match[0]) : stdout.trim();
                        resolve({ ok: true, data });
                    } catch (e) {
                        resolve({ ok: true, data: stdout.trim() });
                    }
                });
            });
        } else if (manifest.runtime === 'node') {
            const { execFile } = require('child_process');
            
            return new Promise((resolve) => {
                // Determine if we should use electron or just node
                const nodeBinary = process.platform === 'win32' ? 'node.exe' : 'node';
                
                // Using execFile for zero shell overhead & security
                execFile(nodeBinary, [entryFile, JSON.stringify(args)], (error, stdout, stderr) => {
                    if (error) {
                        console.error(`[Main Process] Skill execution error (${skillName}):`, error.message);
                        return resolve({ ok: false, error: error.message, stderr });
                    }
                    try {
                        const match = stdout.match(/\{[\s\S]*\}/);
                        const data = match ? JSON.parse(match[0]) : stdout.trim();
                        resolve({ ok: true, data });
                    } catch (e) {
                        resolve({ ok: true, data: stdout.trim() });
                    }
                });
            });
        }

        return { ok: false, error: `Unsupported runtime: ${manifest.runtime}` };
    } catch (error) {
        console.error('[Main Process] execute-skill error:', error);
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('fs-read-folder', async (event, folderPathOrObj) => {
    let folderPath = '';
    let recursive = true;

    if (typeof folderPathOrObj === 'object' && folderPathOrObj !== null) {
        folderPath = folderPathOrObj.folderPath;
        recursive = folderPathOrObj.recursive !== false;
    } else {
        folderPath = folderPathOrObj;
    }

    if (!folderPath || typeof folderPath !== 'string') {
        return { ok: false, error: 'Invalid folder path' };
    }

    try {
        const resolvedPath = SafePathResolver.resolvePath(folderPath);
        if (!fs.existsSync(resolvedPath)) return { ok: false, error: 'Folder not found' };

        let fileCount = 0;
        const files = {};
        const MAX_FILES = 5000;
        const MAX_DEPTH = 15;

        const walk = (dir, rootDir, depth = 0) => {
            if (depth > MAX_DEPTH || fileCount >= MAX_FILES) return;

            let list;
            try {
                list = fs.readdirSync(dir);
            } catch (e) {
                return;
            }

            for (const item of list) {
                if (fileCount >= MAX_FILES) break;
                const fullPath = path.join(dir, item);
                try {
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        if (recursive) {
                            if (['node_modules', '.git', 'dist', 'build', '.next', '.vs', '.idea'].includes(item)) continue;
                            walk(fullPath, rootDir, depth + 1);
                        }
                    } else if (stat.isFile()) {
                        if (/\.(md|txt|json|js|jsx|ts|tsx|html|css|py|java|c|cpp|h|hpp|rs|go|rb|php)$/i.test(item)) {
                            const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
                            try {
                                const content = fs.readFileSync(fullPath, 'utf8');
                                if (content.length < 1000000) {
                                    files[relPath] = content;
                                    fileCount++;
                                }
                            } catch (readErr) { }
                        }
                    }
                } catch (statErr) { }
            }
        };

        walk(resolvedPath, resolvedPath, 0);
        return { ok: true, files };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('fs-write-file', async (event, { folderPath, filename, content }) => {
    try {
        if (!folderPath || !filename) throw new Error('Path and filename are required');
        
        // Security: Ensure path is within sandbox
        const resolvedDir = SafePathResolver.resolvePath(folderPath);
        const fullPath = path.join(resolvedDir, filename);
        
        // Secondary Leak Check: path.join could still bypass if filename is "../foo"
        const normalizedRoot = path.normalize(resolvedDir);
        if (!fullPath.toLowerCase().startsWith(normalizedRoot.toLowerCase())) {
            throw new Error(`SecurityError: Access denied. Filename attempt to escape root.`);
        }

        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Use atomic write from our helper
        const result = safeWriteJSON(fullPath, content); 
        // Wait, safeWriteJSON expects an object. For raw content, we'll use fs.writeFileSync
        // but with a temp file for safety.
        
        const tempPath = `${fullPath}.tmp`;
        fs.writeFileSync(tempPath, content, 'utf8');
        fs.renameSync(tempPath, fullPath);
        
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('fs-delete-file', async (event, { folderPath, filename }) => {
    try {
        if (!folderPath || !filename) throw new Error('Path and filename are required');
        
        const resolvedDir = SafePathResolver.resolvePath(folderPath);
        const fullPath = path.join(resolvedDir, filename);
        
        // Leak check
        const normalizedRoot = path.normalize(resolvedDir);
        if (!fullPath.toLowerCase().startsWith(normalizedRoot.toLowerCase())) {
            throw new Error(`SecurityError: Access denied. Filename attempt to escape root.`);
        }

        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

function setupAppMenu(win) {
    const isMac = process.platform === 'darwin';

    const template = [
        ...(isMac ? [{
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        }] : []),
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Session',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => { win.webContents.send('menu-action', 'new-session'); }
                },
                { type: 'separator' },
                {
                    label: 'Export Configuration',
                    click: () => { win.webContents.send('menu-action', 'export-config'); }
                },
                {
                    label: 'Load Configuration',
                    click: () => { win.webContents.send('menu-action', 'load-config'); }
                },
                { type: 'separator' },
                {
                    label: 'Open Sessions Folder',
                    click: () => { shell.openPath(SESSIONS_DIR); }
                },
                isMac ? { role: 'close' } : { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Neural Engine',
            submenu: [
                {
                    label: 'Sync Models',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => { win.webContents.send('menu-action', 'sync-models'); }
                },
                { type: 'separator' },
                {
                    label: 'Reset Global Config',
                    click: () => { win.webContents.send('menu-action', 'reset-config'); }
                }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Documentation',
                    click: async () => { await shell.openExternal('https://github.com/martinezpalomera92/mikuCentralv1.0#readme'); }
                },
                {
                    label: 'About MikuCentral',
                    click: () => {
                        dialog.showMessageBox(win, {
                            type: 'info',
                            title: 'MikuCentral',
                            message: 'MikuCentral v2.1.0',
                            detail: 'Neural AI Interface for Multi-Model Management.\nCreated with love for high-performance AI workflows.'
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// ── System Behavior Handlers ─────────────────────────────────────────

function updateAutoLaunch(enabled) {
    try {
        console.log(`[Main Process] Auto-launch: ${enabled ? 'ENABLED' : 'DISABLED'}`);
        app.setLoginItemSettings({
            openAtLogin: enabled,
            path: app.getPath('exe'),
        });
        return { ok: true };
    } catch (e) {
        console.error('Failed to update login settings:', e);
        return { ok: false, error: e.message };
    }
}

function createTray() {
    if (tray) return;

    const iconPath = app.isPackaged
        ? path.join(__dirname, '../dist/mikuBotICON.png')
        : path.join(__dirname, '../public/mikuBotICON.png');

    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
        { label: 'MikuCentral', enabled: false },
        { type: 'separator' },
        {
            label: 'Mostrar Interfaz',
            click: () => {
                if (mainWin) {
                    mainWin.show();
                    mainWin.focus();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Salir Completamente',
            click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('MikuCentral');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        if (mainWin) {
            mainWin.show();
            mainWin.focus();
        }
    });
}

function destroyTray() {
    if (tray) {
        tray.destroy();
        tray = null;
    }
}

ipcMain.handle('set-auto-launch', async (event, enabled) => {
    return updateAutoLaunch(enabled);
});

ipcMain.handle('searxena:install-env', async () => {
    return installSearXenaEnv();
});

async function installSearXenaEnv() {
    const { exec } = require('child_process');
    const requirementsFile = path.join(SEARXENA_DIR, 'requirements.txt');
    const venvDir = path.join(SEARXENA_DIR, 'local', 'py3');

    if (!fs.existsSync(requirementsFile)) {
        return { ok: false, error: 'No se encontró el archivo requirements.txt' };
    }

    return new Promise((resolve) => {
        console.log('[Main Process] Initializing searXena Environment Setup (replicating win_setup.ps1)...');
        
        // Step 1: Create VENV if missing
        const createVenvCmd = fs.existsSync(ENGINE_PYTHON) 
            ? 'echo Venv already exists' 
            : `python -m venv "${venvDir}"`;

        exec(createVenvCmd, (err) => {
            if (err) {
                console.error('[searXena Venv Error] Failed to create venv. Make sure Python is in PATH.', err.message);
                return resolve({ ok: false, error: 'No se pudo crear el entorno virtual. Asegúrate de tener Python instalado en el sistema.' });
            }

            console.log('[Main Process] Virtual Env Ready. Upgrading core tools...');
            
            // Step 2: Upgrade core tools (like win_setup.ps1 does)
            const upgradeCmd = `"${ENGINE_PYTHON}" -m pip install -U pip wheel setuptools`;
            exec(upgradeCmd, (err) => {
                if (err) console.warn('[Main Process] Non-critical error upgrading pip tools.');

                console.log('[Main Process] Installing dependencies from requirements.txt...');
                
                // Step 3: Install requirements
                const installCmd = `"${ENGINE_PYTHON}" -m pip install -r "${requirementsFile}"`;
                exec(installCmd, (err, stdout, stderr) => {
                    if (err) {
                        console.error('[searXena Install Error]', stderr);
                        resolve({ ok: false, error: stderr || err.message });
                    } else {
                        console.log('[searXena Install Success] Dependencies ready. Installing Vosk...');
                        // Manually install vosk into this shared environment
                        const voskCmd = `"${ENGINE_PYTHON}" -m pip install vosk`;
                        exec(voskCmd, (vErr) => {
                            if (vErr) console.warn('[Main Process] Non-critical error installing vosk automatically:', vErr.message);
                            resolve({ ok: true, output: stdout });
                        });
                    }
                });
            });
        });
    });
}

ipcMain.handle('searxena:update-env', async () => {
    return installSearXenaEnv(); // Reuse the same logic
});

ipcMain.handle('searxena:start', async () => {
    // Check if env exists before starting
    if (!fs.existsSync(ENGINE_PYTHON)) {
        console.log('[Main Process] Engine environment missing. Triggering auto-install...');
        const setup = await installSearXenaEnv();
        if (!setup.ok) return setup;
    }
    return startSearXena();
});

ipcMain.handle('searxena:stop', async () => {
    await stopSearXena();
    return { ok: true };
});

// ── Advanced Agent Tools (Ported) ──────────────────────────────────
ipcMain.handle('agent:read-file', async (event, { path: relPath }) => {
    try {
        const fullPath = SafePathResolver.resolvePath(relPath);
        const content = await fs.promises.readFile(fullPath, 'utf-8');
        return { ok: true, content };
    } catch (e) {
        return { ok: false, error: e.message };
    }
});

ipcMain.handle('agent:get-file-outline', async (event, { path: relPath }) => {
    try {
        const fullPath = SafePathResolver.resolvePath(relPath);
        const outline = await agentActions.handleGetFileOutline(fullPath);
        return { ok: true, outline };
    } catch (e) {
        return { ok: false, error: e.message };
    }
});

ipcMain.handle('agent:batch-operation', async (event, data) => {
    try {
        const rootPath = data.rootPath || '@WORKSPACE';
        const root = SafePathResolver.resolvePath(rootPath);
        const result = await agentActions.handleBatchOperation(root, data);
        return { ok: true, result };
    } catch (e) {
        return { ok: false, error: e.message };
    }
});

ipcMain.handle('agent:list-files', async (event, data) => {
    try {
        const rootPath = data.rootPath || '@WORKSPACE';
        const root = SafePathResolver.resolvePath(rootPath);
        const results = await agentActions.handleListFiles(root, data);
        return { ok: true, results };
    } catch (e) {
        return { ok: false, error: e.message };
    }
});

ipcMain.handle('agent:search-files', async (event, data) => {
    try {
        const rootPath = data.rootPath || '@WORKSPACE';
        const root = SafePathResolver.resolvePath(rootPath);
        const results = await agentActions.handleSearchFilesNative(root, data);
        return { ok: true, results };
    } catch (e) {
        return { ok: false, error: e.message };
    }
});

ipcMain.handle('agent:patch-file', async (event, data) => {
    try {
        const root = SafePathResolver.roots['@ROOT'] || SafePathResolver.roots['@WORKSPACE'];
        const result = await agentActions.handlePatchFile(root, data);
        return { ok: true, result };
    } catch (e) {
        return { ok: false, error: e.message };
    }
});

ipcMain.handle('agent:undo-patch', async (event, { path: relPath }) => {
    try {
        const root = SafePathResolver.roots['@ROOT'] || SafePathResolver.roots['@WORKSPACE'];
        const result = await agentActions.handleUndoPatch(root, relPath);
        return { ok: true, result };
    } catch (e) {
        return { ok: false, error: e.message };
    }
});

ipcMain.handle('agent:system-metrics', async () => {
    try {
        const metrics = await agentActions.handleSystemMetrics();
        return { ok: true, metrics };
    } catch (e) {
        return { ok: false, error: e.message };
    }
});

// Redundant tool removed

// ... rest of the file

ipcMain.handle('searxena:status', async () => {
    let isRunning = !!searxenaProcess;
    if (!isRunning) {
        isRunning = await checkPort8000();
    }
    const engineSourceExists = fs.existsSync(path.join(SEARXENA_DIR, 'core', 'app.py'));
    return {
        installed: engineSourceExists,
        envReady: fs.existsSync(ENGINE_PYTHON),
        running: isRunning
    };
});

// Note: Settings are also checked during 'save-settings'
// ...

// ── Window Management ────────────────────────────────────────────────
function createWindow() {
    mainWin = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 768,
        minHeight: 650,
        icon: (() => {
            const iconPath = app.isPackaged
                ? path.join(__dirname, '../dist/mikuBotICON.png')
                : path.join(__dirname, '../public/mikuBotICON.png');
            return nativeImage.createFromPath(iconPath);
        })(),
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false,
        },
        backgroundColor: '#0f172a',
        show: false,
        focusable: true,
    });

    const isDev = !app.isPackaged;
    if (isDev) {
        mainWin.loadURL('http://localhost:3001');
    } else {
        mainWin.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    setupAppMenu(mainWin);

    mainWin.on('closed', () => {
        mainWin = null;
    });
    // Start background dependency bootstrap
    setTimeout(() => {
        bootstrapHeavyDependencies();
    }, 5000); // 5s delay to let main app breathe

    mainWin.once('ready-to-show', () => {
        mainWin.show();
        // Fix: Force focus on both the window and webContents to prevent
        // the "click on external app first" bug. 
        mainWin.focus();
        mainWin.webContents.focus();

        // Check current settings for Tray requirement on startup
        try {
            const configPath = getEffectivePaths().config;
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (config.config?.minimizeToTray) {
                    createTray();
                }
            }
        } catch (e) {
            console.error('Error checking tray settings on startup:', e);
        }
    });

    mainWin.on('close', (event) => {
        if (isQuitting) {
            mainWin = null;
        } else {
            // Check if minimize to tray is enabled
            try {
                const configPath = getEffectivePaths().config;
                if (fs.existsSync(configPath)) {
                    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    if (config.config?.minimizeToTray) {
                        event.preventDefault();
                        mainWin.hide();
                    }
                }
            } catch (e) {
                console.error('Error during window close check:', e);
            }
        }
    });

    mainWin.webContents.on('crashed', (e) => {
        console.error('Renderer Process Crashed:', e);
        dialog.showErrorBox('Renderer Crash', 'The application renderer process has crashed.');
    });

    mainWin.webContents.on('did-fail-load', (e, code, desc) => {
        console.error('Failed to load:', desc);
    });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    console.log('[Main Process] Duplicate instance detected. Quitting to protect GPU/DB cache.');
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWin) {
            if (mainWin.isMinimized()) mainWin.restore();
            mainWin.show();
            mainWin.focus();
        }
    });

    app.whenReady().then(async () => {
        // Proactive engine detection
        const isRunning = await checkPort8000();
        if (isRunning) {
            console.log('[Main Process] searXena detected as ALREADY RUNNING on port 8000.');
        } else {
            console.log('[Main Process] searXena engine is currently STOPPED.');
        }
        
        createWindow();
        startSearXena();
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            } else if (mainWin) {
                mainWin.show();
            }
        });
    });

    app.on('before-quit', () => {
        isQuitting = true;
        stopSearXenaSync(); // Use sync version to ensure it happens before exit
    });

    app.on('will-quit', () => {
        stopSearXenaSync(); // Fallback double-check
    });

    // Windows/Process level emergency cleanup
    process.on('exit', () => {
        stopSearXenaSync();
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });
}
