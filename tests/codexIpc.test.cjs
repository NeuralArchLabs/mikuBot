const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { registerCodexIpc } = require('../electron/services/codexIpc.cjs');

function fixture() {
    const handlers = new Map();
    const ipcMain = new EventEmitter();
    ipcMain.handle = (name, callback) => handlers.set(name, callback);
    const app = new EventEmitter();
    app.getPath = () => '/test/miku';
    const sender = new EventEmitter();
    sender.id = 7;
    sender.mainFrame = {};
    sender.isDestroyed = () => false;
    const events = [];
    sender.send = (channel, data) => events.push({ channel, data });
    const event = { sender, senderFrame: sender.mainFrame };
    const service = { getStatus: async () => ({ available: true }), dispose() { this.disposed = true; } };
    let creations = 0;
    registerCodexIpc({ app, ipcMain, shell: {}, getMainWindow: () => ({ webContents: sender }), serviceFactory: () => { creations++; return service; } });
    return { handlers, ipcMain, app, sender, event, service, events, creations: () => creations };
}

test('only the top frame of the main window can access the account', async () => {
    const f = fixture();
    const status = f.handlers.get('codex:status');
    assert.throws(() => status({ ...f.event, senderFrame: {} }), /main Miku window/);
    assert.throws(() => status({ sender: { mainFrame: {} }, senderFrame: {} }), /main Miku window/);
    assert.equal(f.creations(), 0);
    assert.deepEqual(await status(f.event), { available: true });
    assert.equal(f.creations(), 1);
});

test('stream events are correlated and abort belongs to the originating renderer', async () => {
    const f = fixture();
    let signal;
    f.service.stream = async (_request, onEvent, abortSignal) => {
        signal = abortSignal;
        onEvent({ type: 'content', delta: 'Hola', streamId: 'untrusted' });
        await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
        return { content: 'Hola', toolCalls: [] };
    };
    const promise = f.handlers.get('codex:stream')(f.event, { streamId: 'stream-1' });
    assert.deepEqual(f.events[0], { channel: 'codex:stream-event', data: { type: 'content', delta: 'Hola', streamId: 'stream-1' } });
    await assert.rejects(f.handlers.get('codex:stream')(f.event, { streamId: 'stream-1' }), /already running/);
    f.ipcMain.emit('codex:stream-abort', { ...f.event, senderFrame: {} }, 'stream-1');
    assert.equal(signal.aborted, false);
    f.ipcMain.emit('codex:stream-abort', f.event, 'stream-1');
    assert.equal(signal.aborted, true);
    await promise;
});

test('renderer navigation cancels generation and quitting disposes the service', async () => {
    const f = fixture();
    let signal;
    f.service.stream = async (_request, _onEvent, abortSignal) => {
        signal = abortSignal;
        await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
        return { content: '', toolCalls: [] };
    };
    const promise = f.handlers.get('codex:stream')(f.event, { streamId: 'stream-2' });
    f.sender.emit('did-start-navigation', {}, 'http://localhost', false, true);
    assert.equal(signal.aborted, true);
    await promise;
    f.app.emit('before-quit');
    assert.equal(f.service.disposed, true);
});
