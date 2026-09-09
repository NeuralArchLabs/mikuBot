const path = require('node:path');
const { createCodexService } = require('./codex.cjs');

/** Keep account operations and stream ownership confined to the app's main UI. */
function registerCodexIpc({ app, ipcMain, shell, getMainWindow, serviceFactory = createCodexService }) {
    let service;
    const streams = new Map();
    const watched = new WeakSet();
    const getService = () => service ||= serviceFactory({
        homePath: path.join(app.getPath('userData'), 'codex'),
        workPath: path.join(app.getPath('userData'), 'codex-work'),
        openExternal: url => shell.openExternal(url)
    });
    const assertSender = event => {
        const mainWindow = getMainWindow();
        if (!mainWindow || event.sender !== mainWindow.webContents ||
            event.senderFrame !== event.sender.mainFrame) {
            throw new Error('Codex is only available from the main Miku window.');
        }
        if (!watched.has(event.sender)) {
            watched.add(event.sender);
            const cancel = () => {
                for (const [key, entry] of streams) {
                    if (entry.sender === event.sender) {
                        entry.controller.abort();
                        streams.delete(key);
                    }
                }
            };
            event.sender.on('destroyed', cancel);
            event.sender.on('render-process-gone', cancel);
            event.sender.on('did-start-navigation', (_event, _url, isInPlace, isMainFrame) => {
                if (isMainFrame && !isInPlace) cancel();
            });
        }
    };
    const handle = (channel, action) => ipcMain.handle(channel, (event, ...args) => {
        assertSender(event);
        return action(...args);
    });
    handle('codex:status', () => getService().getStatus());
    handle('codex:login', () => getService().login());
    handle('codex:login-cancel', () => getService().cancelLogin());
    handle('codex:logout', () => getService().logout());
    handle('codex:models', () => getService().getModels());
    ipcMain.handle('codex:stream', async (event, request) => {
        assertSender(event);
        const streamId = request?.streamId;
        if (typeof streamId !== 'string' || !/^[\w-]{1,128}$/.test(streamId)) {
            throw new Error('Invalid Codex stream ID.');
        }
        const key = `${event.sender.id}:${streamId}`;
        if (streams.has(key)) throw new Error('Codex stream is already running.');
        const controller = new AbortController();
        const entry = { sender: event.sender, controller };
        streams.set(key, entry);
        try {
            return await getService().stream(request, data => {
                if (!event.sender.isDestroyed() && !controller.signal.aborted) {
                    event.sender.send('codex:stream-event', { ...data, streamId });
                }
            }, controller.signal);
        } finally {
            if (streams.get(key) === entry) streams.delete(key);
        }
    });
    ipcMain.on('codex:stream-abort', (event, streamId) => {
        try { assertSender(event); } catch { return; }
        streams.get(`${event.sender.id}:${streamId}`)?.controller.abort();
    });
    app.on('before-quit', () => {
        for (const { controller } of streams.values()) controller.abort();
        streams.clear();
        service?.dispose();
    });
}

module.exports = { registerCodexIpc };
