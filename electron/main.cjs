const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Global Error Handler for Production Debugging
process.on('uncaughtException', (error) => {
    console.error('CRITICAL MAIN PROCESS ERROR:', error);
    // Only show dialog if app is ready to avoid startup crashes interacting weirdly
    if (app.isReady()) {
        dialog.showErrorBox('Critical Error', `A fatal error occurred:\n${error.message}`);
    }
});

// ── Paths ────────────────────────────────────────────────────────────
// Use app.getAppPath() which is more reliable than process.cwd() in Electron
const rootPath = app.isPackaged
    ? path.dirname(app.getPath('exe'))
    : process.cwd();

const resourcesPath = app.isPackaged
    ? process.resourcesPath
    : process.cwd();

const CONFIG_FILE = path.join(rootPath, 'config.json');
const SESSIONS_DIR = path.join(rootPath, 'sessions');

console.log('Main Process: Root path (persistence):', rootPath);
console.log('Main Process: Resources path (engine):', resourcesPath);

// Ensure sessions directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
    try {
        fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    } catch (e) {
        console.error('Failed to create sessions directory:', e);
    }
}

// ── Security: Read API keys from disk (main process only) ────────────
function getApiKeys() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            return parsed.config?.apiKeys || {};
        }
    } catch (e) {
        console.error('[Main Process] Failed to read API keys from config.json:', e.message);
    }
    return {};
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

// ── IPC Handlers ─────────────────────────────────────────────────────

// Fetch Proxy (Improved for Localhost/Ollama)
ipcMain.handle('fetch-proxy', async (event, { url, options }) => {
    try {
        console.log(`[Main Process] Proxying request to: ${url}`);

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
                    console.log(`[Main Process] Localhost failed, trying fallback: ${fallbackUrl}`);
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
        console.log('Saving settings to:', CONFIG_FILE);
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(settings, null, 4), 'utf8');
        return { ok: true };
    } catch (error) {
        console.error('Failed to save settings:', error);
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('load-settings', async () => {
    try {
        console.log('Loading settings from:', CONFIG_FILE);
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            const settings = JSON.parse(data);
            console.log('Settings loaded successfully');
            return { ok: true, settings };
        }
        console.log('No config file found, using defaults');
        return { ok: true, settings: null };
    } catch (error) {
        console.error('Failed to load settings:', error);
        return { ok: false, error: error.message };
    }
});

// Sessions Handlers
ipcMain.handle('get-sessions', async () => {
    try {
        const files = fs.readdirSync(SESSIONS_DIR);
        const sessions = files
            .filter(f => f.endsWith('.json'))
            .map(f => {
                const content = fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf8');
                const session = JSON.parse(content);
                return {
                    id: session.id,
                    title: session.title,
                    lastModified: fs.statSync(path.join(SESSIONS_DIR, f)).mtimeMs,
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
        const filePath = path.join(SESSIONS_DIR, `${id}.json`);
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
        const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(session, null, 4), 'utf8');
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('delete-session', async (event, id) => {
    try {
        const filePath = path.join(SESSIONS_DIR, `${id}.json`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

// ── Neural Scheduler Persistence ─────────────────────────────────────
const SCHEDULER_TASKS_FILE = path.join(rootPath, 'scheduler-tasks.json');
const SCHEDULER_LOGS_FILE = path.join(rootPath, 'scheduler-logs.json');

ipcMain.handle('save-scheduler-tasks', async (event, data) => {
    try {
        fs.writeFileSync(SCHEDULER_TASKS_FILE, data, 'utf8');
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('load-scheduler-tasks', async () => {
    try {
        if (fs.existsSync(SCHEDULER_TASKS_FILE)) {
            const data = fs.readFileSync(SCHEDULER_TASKS_FILE, 'utf8');
            return { ok: true, data };
        }
        return { ok: true, data: '[]' };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('save-scheduler-logs', async (event, data) => {
    try {
        fs.writeFileSync(SCHEDULER_LOGS_FILE, data, 'utf8');
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error.message };
    }
});

ipcMain.handle('load-scheduler-logs', async () => {
    try {
        if (fs.existsSync(SCHEDULER_LOGS_FILE)) {
            const data = fs.readFileSync(SCHEDULER_LOGS_FILE, 'utf8');
            return { ok: true, data };
        }
        return { ok: true, data: '[]' };
    } catch (error) {
        return { ok: false, error: error.message };
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

ipcMain.handle('setup-onboarding', async (event, { targetPath }) => {
    try {
        const folders = ['core', 'commands', 'workspace', 'library'];
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
        }

        for (const f of folders) {
            const fp = path.join(targetPath, f);
            if (!fs.existsSync(fp)) {
                fs.mkdirSync(fp, { recursive: true });
            }
        }

        // Copy core/base to commands
        const coreBasePath = path.join(resourcesPath, 'core', 'base');
        const commandsPath = path.join(targetPath, 'commands');

        if (fs.existsSync(coreBasePath)) {
            fs.cpSync(coreBasePath, commandsPath, { recursive: true });
        }

        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    }
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

ipcMain.handle('fs-read-folder', async (event, folderPath) => {
    console.log(`[Main] Request to read folder: "${folderPath}"`);

    if (!folderPath || typeof folderPath !== 'string') {
        console.error('[Main] Invalid folder path provided');
        return { ok: false, error: 'Invalid folder path' };
    }

    try {
        // Normalize path for Windows
        const normalizedPath = path.normalize(folderPath);

        if (!fs.existsSync(normalizedPath)) {
            console.error(`[Main] Folder does not exist: ${normalizedPath}`);
            return { ok: false, error: 'Folder not found' };
        }

        const files = {};

        // Recursive directory walker
        const walk = (dir, rootDir) => {
            let list;
            try {
                list = fs.readdirSync(dir);
            } catch (e) {
                console.warn(`[Main] Skipping dir due to error: ${dir}`, e.message);
                return;
            }

            for (const item of list) {
                const fullPath = path.join(dir, item);

                try {
                    const stat = fs.statSync(fullPath);

                    if (stat.isDirectory()) {
                        if (['node_modules', '.git', 'dist', 'build', '.next', '.vs', '.idea'].includes(item)) continue;
                        walk(fullPath, rootDir);
                    } else if (stat.isFile()) {
                        if (/\.(md|txt|json|js|jsx|ts|tsx|html|css|py|java|c|cpp|h|hpp|rs|go|rb|php)$/i.test(item)) {
                            // Calculate relative path from the root folder (e.g. "sub/file.md")
                            // We use forward slashes for consistency in the frontend
                            const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

                            try {
                                const content = fs.readFileSync(fullPath, 'utf8');
                                files[relPath] = content;
                            } catch (readErr) {
                                console.warn(`[Main] Failed to read file content: ${relPath}`, readErr.message);
                            }
                        }
                    }
                } catch (statErr) {
                    // Ignore stat errors (e.g. permission denied)
                }
            }
        };

        walk(normalizedPath, normalizedPath);

        const count = Object.keys(files).length;
        console.log(`[Main] Successfully read ${count} files from ${normalizedPath}`);

        return { ok: true, files, count };
    } catch (error) {
        console.error(`[Main] Fatal error reading folder:`, error);
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

// ── Window Management ────────────────────────────────────────────────
function createWindow() {
    const win = new BrowserWindow({
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
        win.loadURL('http://localhost:3001');
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    setupAppMenu(win);

    win.once('ready-to-show', () => {
        win.show();
        // Fix: Force focus on both the window and webContents to prevent
        // the "click on external app first" bug. Without this, show:false
        // windows may render but not receive keyboard/mouse input until
        // the user manually blurs and refocuses the window.
        win.focus();
        win.webContents.focus();
    });

    win.webContents.on('crashed', (e) => {
        console.error('Renderer Process Crashed:', e);
        dialog.showErrorBox('Renderer Crash', 'The application renderer process has crashed.');
    });

    win.webContents.on('did-fail-load', (e, code, desc) => {
        console.error('Failed to load:', desc);
    });
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
