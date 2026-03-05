const { app, BrowserWindow, ipcMain, dialog, Menu, shell, Tray, nativeImage } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

const https = require('https');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const readline = require('readline');


// Configure ffmpeg
if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath.replace('app.asar', 'app.asar.unpacked'));
}

// Global state for window and system tray
let mainWin = null;
let tray = null;
let isQuitting = false;
let searxngProcess = null;

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
    } catch (e) {
        console.error('Error saving workspace pointer:', e);
    }
}

// Global path state
let currentWorkspacePath = getStoredWorkspacePath() || (app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd());

const getEffectivePaths = () => {
    return {
        config: path.join(currentWorkspacePath, 'config.json'),
        sessions: path.join(currentWorkspacePath, 'sessions'),
        tasks: path.join(currentWorkspacePath, 'scheduler-tasks.json'),
        logs: path.join(currentWorkspacePath, 'scheduler-logs.json')
    };
};

const resourcesPath = app.isPackaged ? process.resourcesPath : process.cwd();

console.log('Main Process: Active Workspace Path:', currentWorkspacePath);

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
            return parsed.config?.apiKeys || {};
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
            return parsed.config?.telegramBotToken || null;
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
        } else if (provider === 'ollama') {
            url = `${ollamaUrl || 'http://localhost:11434'}/api/chat`;
            headers = { 'Content-Type': 'application/json' };
        } else {
            return { ok: false, error: `Unknown provider: ${provider}` };
        }

        console.log(`[Main Process] API Stream (${provider}/${model}) -> ${url.split('?')[0]}`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120000); // 2 min timeout for streaming

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

// ── SearXNG Engine Management ──────────────────────────────────────
function startSearXNG() {
    if (searxngProcess) return { ok: true, status: 'already_running' };

    const searxngDir = path.join(resourcesPath, 'engine', 'searxng');
    const granianExe = path.join(searxngDir, 'local', 'py3', 'Scripts', 'granian.exe');

    if (!fs.existsSync(granianExe)) {
        console.warn('[SearXNG] Granian not found, search engine might not be available.');
        return { ok: false, error: 'Engine not installed' };
    }

    console.log('[Main Process] Starting SearXNG Engine...');

    searxngProcess = spawn(granianExe, ['searx.webapp:app'], {
        cwd: searxngDir,
        env: {
            ...process.env,
            SEARXNG_DEBUG: "0",
            GRANIAN_INTERFACE: "wsgi",
            GRANIAN_HOST: "127.0.0.1",
            GRANIAN_PORT: "8888",
            GRANIAN_WEBSOCKETS: "false",
            GRANIAN_BLOCKING_THREADS: "4"
        }
    });

    searxngProcess.stdout.on('data', (data) => {
        // console.log(`[SearXNG]: ${data}`);
    });

    searxngProcess.stderr.on('data', (data) => {
        // console.error(`[SearXNG Error]: ${data}`);
    });

    searxngProcess.on('close', (code) => {
        console.log(`[SearXNG] Process exited with code ${code}`);
        searxngProcess = null;
    });

    return { ok: true };
}

function installSearXNG() {
    return new Promise((resolve) => {
        const searxngDir = path.join(resourcesPath, 'engine', 'searxng');
        const managePs1 = path.join(searxngDir, 'manage.ps1');

        if (!fs.existsSync(managePs1)) {
            resolve({ ok: false, error: 'manage.ps1 not found in engine/searxng' });
            return;
        }

        console.log('[Main Process] Running SearXNG Setup (pyenv.install)...');

        const setupProcess = spawn('powershell.exe', [
            '-ExecutionPolicy', 'Bypass',
            '-File', managePs1,
            'pyenv.install'
        ], {
            cwd: searxngDir
        });

        setupProcess.stdout.on('data', (data) => {
            console.log(`[SearXNG Setup]: ${data}`);
        });

        setupProcess.stderr.on('data', (data) => {
            console.error(`[SearXNG Setup Error]: ${data}`);
        });

        setupProcess.on('close', (code) => {
            if (code === 0) {
                console.log('[SearXNG Setup] Installation completed successfully.');
                const startRes = startSearXNG();
                resolve({ ok: true, startResult: startRes });
            } else {
                console.error(`[SearXNG Setup] Installation failed with code ${code}`);
                resolve({ ok: false, error: `Setup failed (code ${code})` });
            }
        });
    });
}

function stopSearXNG() {
    if (searxngProcess) {
        console.log('[Main Process] Stopping SearXNG Engine...');
        searxngProcess.kill('SIGINT'); // Try graceful kill
        searxngProcess = null;
    }
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
        fs.writeFileSync(configPath, JSON.stringify(settings, null, 4), 'utf8');

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
        const configPath = getEffectivePaths().config;
        console.log('Loading settings from:', configPath);
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            const settings = JSON.parse(data);
            return { ok: true, settings };
        }
        return { ok: true, settings: null };
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
                const filePath = path.join(sessionsDir, f);
                const content = fs.readFileSync(filePath, 'utf8');
                const session = JSON.parse(content);
                return {
                    id: session.id,
                    title: session.title,
                    lastModified: fs.statSync(filePath).mtimeMs,
                    messageCount: session.messages.length
                };
            })
            .sort((a, b) => b.lastModified - a.lastModified);
        return { ok: true, sessions };
    } catch (error) {
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
        fs.writeFileSync(filePath, JSON.stringify(session, null, 4), 'utf8');
        return { ok: true };
    } catch (error) {
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
const VOSK_MODELS_ROOT = path.join(currentWorkspacePath, 'engine', 'models', 'vosk');
const VOSK_BUNDLED_ROOT = path.join(resourcesPath, 'engine', 'models', 'vosk');

console.log('[Voice] Models Workspace Path:', VOSK_MODELS_ROOT);
console.log('[Voice] Models Bundled Path:', VOSK_BUNDLED_ROOT);

ipcMain.handle('voice:list-models', async () => {
    try {
        const models = new Set();

        // 1. Check workspace
        if (fs.existsSync(VOSK_MODELS_ROOT)) {
            fs.readdirSync(VOSK_MODELS_ROOT)
                .filter(f => fs.statSync(path.join(VOSK_MODELS_ROOT, f)).isDirectory())
                .forEach(m => models.add(m));
        } else {
            fs.mkdirSync(VOSK_MODELS_ROOT, { recursive: true });
        }

        // 2. Check bundled resources
        if (fs.existsSync(VOSK_BUNDLED_ROOT)) {
            fs.readdirSync(VOSK_BUNDLED_ROOT)
                .filter(f => fs.statSync(path.join(VOSK_BUNDLED_ROOT, f)).isDirectory())
                .forEach(m => models.add(m));
        }

        return { ok: true, models: Array.from(models) };
    } catch (error) {
        console.error('[Voice] list-models error:', error);
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('voice:download-model', async (event, { lang }) => {
    const sender = event.sender;
    const modelUrls = {
        'es': 'https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip',
        'en': 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip'
    };

    const url = modelUrls[lang];
    if (!url) return { ok: false, error: `Language ${lang} not supported for auto-download.` };

    try {
        const https = require('https');
        const unzipper = require('unzipper'); // Needs to be installed or use a different method

        const tempZip = path.join(VOSK_MODELS_ROOT, `model_${lang}.zip`);
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
                        .pipe(unzipper.Extract({ path: VOSK_MODELS_ROOT }))
                        .on('close', () => {
                            fs.unlinkSync(tempZip);
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
        const modelPath = path.join(VOSK_MODELS_ROOT, modelName);
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

    const pythonExe = path.join(resourcesPath, 'engine', 'python', 'python.exe');
    const engineScript = path.join(resourcesPath, 'engine', 'voice_engine.py');

    if (!fs.existsSync(pythonExe)) return { ok: false, error: 'Bundled Python not found.' };
    if (!fs.existsSync(engineScript)) return { ok: false, error: 'Voice engine script missing.' };

    try {
        let fullPath = path.join(VOSK_MODELS_ROOT, modelName);
        if (!fs.existsSync(fullPath)) fullPath = path.join(VOSK_BUNDLED_ROOT, modelName);
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

    const pythonExe = path.join(resourcesPath, 'engine', 'python', 'python.exe');
    const engineScript = path.join(resourcesPath, 'engine', 'voice_engine.py');

    if (!fs.existsSync(pythonExe)) return { ok: false, error: 'Bundled Python not found.' };
    if (!fs.existsSync(engineScript)) return { ok: false, error: 'Voice engine script missing.' };

    let modelPath = path.join(VOSK_MODELS_ROOT, voskModelName);
    if (!fs.existsSync(modelPath)) modelPath = path.join(VOSK_BUNDLED_ROOT, voskModelName);
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
                    }
                } catch (e) {
                    console.warn('[Telegram Voice] JSON Parse error on line:', line);
                }
            });

            // Usamos rl.on('close') en lugar de pyProc.on('close') para asegurar el vaciado del pipe
            rl.on('close', () => {
                if (fs.existsSync(oggPath)) fs.unlinkSync(oggPath);

                // Si el motor terminó y nos quedó un parcial sin consolidar, lo añadimos
                if (lastPartial) transcriptionParts.push(lastPartial);

                const finalResult = transcriptionParts.join(" ").trim();
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
        if (!folderPath || !fs.existsSync(folderPath)) {
            return { ok: false, error: 'Path does not exist' };
        }
        await shell.openPath(folderPath);
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

        // Copy core/base to commands (only if not already there or if clean install)
        const coreBasePath = path.join(resourcesPath, 'core', 'base');
        const commandsPath = path.join(targetPath, 'commands');

        if (fs.existsSync(coreBasePath)) {
            fs.cpSync(coreBasePath, commandsPath, { recursive: true, overwrite: cleanInstall });
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
        const { exec } = require('child_process');
        // Usar PowerShell nativo para comprimir
        const cmd = `powershell -Command "Compress-Archive -Path '${currentWorkspacePath}\\*' -DestinationPath '${filePath}' -Force"`;

        exec(cmd, (error, stdout, stderr) => {
            if (error) resolve({ ok: false, error: error.message });
            else resolve({ ok: true, path: filePath });
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

    return new Promise((resolve) => {
        const { exec } = require('child_process');
        // Limpiar destino (excepto el archivo zip si estuviera dentro, aunque no debería)
        // Expandir archivo a la carpeta workspace actual
        const cmd = `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${currentWorkspacePath}' -Force"`;

        exec(cmd, (error, stdout, stderr) => {
            if (error) resolve({ ok: false, error: error.message });
            else resolve({ ok: true });
        });
    });
});

ipcMain.handle('run-console', async (event, { command, args, cwd }) => {
    const { exec } = require('child_process');
    return new Promise((resolve) => {
        const fullCommand = args ? `${command} ${args}` : command;
        console.log(`[Main Process] Shell: ${fullCommand} in ${cwd || 'root'}`);

        exec(fullCommand, { cwd: cwd || undefined, timeout: 60000 }, (error, stdout, stderr) => {
            resolve({
                code: error ? error.code : 0,
                stdout: stdout,
                stderr: stderr,
                error: error ? error.message : null
            });
        });
    });
});

ipcMain.handle('run-search', async (event, { query }) => {
    const { execFile } = require('child_process');
    const pythonExe = path.join(resourcesPath, 'engine', 'python', 'python.exe');
    const searchScript = path.join(resourcesPath, 'engine', 'search.py');

    return new Promise((resolve) => {
        console.log(`[Main Process] Internal Search: "${query}"`);
        execFile(pythonExe, [searchScript, query], (error, stdout, stderr) => {
            if (error) {
                console.error('[Main Process] Search Error:', error);
                return resolve({ ok: false, error: error.message });
            }
            try {
                const match = stdout.match(/\{[\s\S]*\}/);
                if (!match) {
                    console.error('[Main Process] No JSON found in search output:', stdout);
                    return resolve({ ok: false, error: 'Internal search engine returned invalid data' });
                }
                const data = JSON.parse(match[0]);
                resolve({ ok: true, data });
            } catch (e) {
                console.error('[Main Process] Search JSON Parse Error:', e, stdout);
                resolve({ ok: false, error: 'Failed to process search results' });
            }
        });
    });
});

ipcMain.handle('run-extract', async (event, { url }) => {
    const { execFile } = require('child_process');
    const pythonExe = path.join(resourcesPath, 'engine', 'python', 'python.exe');
    const extractScript = path.join(resourcesPath, 'engine', 'extract.py');

    return new Promise((resolve) => {
        console.log(`[Main Process] Internal Extraction: "${url}"`);
        execFile(pythonExe, [extractScript, url], (error, stdout, stderr) => {
            if (error) {
                console.error('[Main Process] Extraction Error:', error);
                return resolve({ ok: false, error: error.message });
            }
            try {
                const match = stdout.match(/\{[\s\S]*\}/);
                if (!match) {
                    console.error('[Main Process] No JSON found in extraction output:', stdout);
                    return resolve({ ok: false, error: 'Internal extraction engine returned invalid data' });
                }
                const data = JSON.parse(match[0]);
                resolve({ ok: true, data });
            } catch (e) {
                console.error('[Main Process] Extraction JSON Parse Error:', e, stdout);
                resolve({ ok: false, error: 'Failed to process extraction results' });
            }
        });
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
            const pythonExe = path.join(resourcesPath, 'engine', 'python', 'python.exe');

            return new Promise((resolve) => {
                execFile(pythonExe, [entryFile, JSON.stringify(args)], (error, stdout, stderr) => {
                    if (error) {
                        console.error(`[Main Process] Skill execution error (${skillName}):`, error);
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
            const { exec } = require('child_process');
            // Using the node version from electron or system? 
            // In Electron, we can use process.execPath for the electron binary, 
            // but for a script we normally want just 'node'.
            return new Promise((resolve) => {
                const cmd = `node "${entryFile}" '${JSON.stringify(args)}'`;
                exec(cmd, (error, stdout, stderr) => {
                    if (error) return resolve({ ok: false, error: error.message, stderr });
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
        const normalizedPath = path.normalize(folderPath);
        if (!fs.existsSync(normalizedPath)) return { ok: false, error: 'Folder not found' };

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

        walk(normalizedPath, normalizedPath, 0);
        return { ok: true, files };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('fs-write-file', async (event, { folderPath, filename, content }) => {
    try {
        const fullPath = path.join(folderPath, filename);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fullPath, content, 'utf8');
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('fs-delete-file', async (event, { folderPath, filename }) => {
    try {
        const fullPath = path.join(folderPath, filename);
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
                            message: 'MikuCentral v1.4.0',
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

ipcMain.handle('searxng:install', async () => {
    return installSearXNG();
});

ipcMain.handle('searxng:status', async () => {
    const searxngDir = path.join(resourcesPath, 'engine', 'searxng');
    const granianExe = path.join(searxngDir, 'local', 'py3', 'Scripts', 'granian.exe');
    return {
        installed: fs.existsSync(granianExe),
        running: !!searxngProcess
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
            const { nativeImage } = require('electron');
            const iconPath = app.isPackaged
                ? path.join(__dirname, '../dist/mikuBotICON.png')
                : path.join(__dirname, '../public/mikuBotICON.png');
            // Resize the image to prevent cropped/corrupted rendering on the taskbar/titlebar
            return nativeImage.createFromPath(iconPath).resize({ width: 32, height: 32 });
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

app.whenReady().then(() => {
    createWindow();
    startSearXNG();
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
    stopSearXNG();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
