const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

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

// Fetch Proxy (Existing)
ipcMain.handle('fetch-proxy', async (event, { url, options }) => {
    try {
        console.log(`[Main Process] Proxying request to: ${url}`);
        const headers = options?.headers || {};
        if (!headers['User-Agent']) {
            headers['User-Agent'] = 'MikuCentral/1.0 (Electron)';
        }
        const fetchOptions = { ...options, headers };
        const response = await fetch(url, fetchOptions);
        let data;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = { text: await response.text() };
        }
        if (!response.ok) {
            return { ok: false, status: response.status, data, error: `HTTP ${response.status}` };
        }
        return { ok: true, status: response.status, data };
    } catch (error) {
        console.error(`[Main Process] Proxy Error for ${url}:`, error);
        return { ok: false, status: 500, error: error.message };
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

// ── Window Management ────────────────────────────────────────────────
function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        backgroundColor: '#0f172a',
        show: false,
    });

    const isDev = !app.isPackaged;
    if (isDev) {
        win.loadURL('http://localhost:3000');
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    win.once('ready-to-show', () => {
        win.show();
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
