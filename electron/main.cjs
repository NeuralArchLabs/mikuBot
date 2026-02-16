const { app, BrowserWindow, ipcMain, dialog } = require('electron');
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

const CONFIG_FILE = path.join(rootPath, 'config.json');
const SESSIONS_DIR = path.join(rootPath, 'sessions');

console.log('Main Process: Root path is:', rootPath);
console.log('Main Process: Config file:', CONFIG_FILE);

// Ensure sessions directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
    try {
        fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    } catch (e) {
        console.error('Failed to create sessions directory:', e);
    }
}

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

// File System Native Handlers
ipcMain.handle('fs-select-folder', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled) return { ok: false };
    const folderPath = result.filePaths[0];
    return { ok: true, path: folderPath, name: path.basename(folderPath) };
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
    const pythonExe = path.join(rootPath, 'engine', 'python', 'python.exe');
    const searchScript = path.join(rootPath, 'engine', 'search.py');

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
    const pythonExe = path.join(rootPath, 'engine', 'python', 'python.exe');
    const extractScript = path.join(rootPath, 'engine', 'extract.py');

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

// ── Window Management ────────────────────────────────────────────────
function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
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
        win.loadURL('http://localhost:3000');
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }

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
