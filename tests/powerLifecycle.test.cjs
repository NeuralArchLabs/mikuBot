const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { registerPowerLifecycle } = require('../electron/services/powerLifecycle.cjs');

const CHANNEL = 'scheduler-power-state';

function createWindow() {
    const messages = [];
    const window = {
        destroyed: false,
        isDestroyed() { return this.destroyed; },
        webContents: {
            destroyed: false,
            mainFrame: {},
            isDestroyed() { return this.destroyed; },
            send(channel, payload) { messages.push({ channel, payload }); }
        }
    };
    return { window, messages };
}

function setup(t) {
    const powerMonitor = new EventEmitter();
    const handlers = new Map();
    const removals = [];
    const initial = createWindow();
    const context = { window: initial.window, time: 1000 };
    const lifecycle = registerPowerLifecycle({
        powerMonitor,
        ipcMain: {
            handle(channel, callback) { handlers.set(channel, callback); },
            removeHandler(channel) { removals.push(channel); handlers.delete(channel); }
        },
        getMainWindow: () => context.window,
        now: () => context.time
    });
    t.after(() => lifecycle.dispose());
    const read = (sender = context.window.webContents, frame = sender.mainFrame) =>
        handlers.get(CHANNEL)({ sender, senderFrame: frame });
    return { ...initial, context, powerMonitor, handlers, removals, lifecycle, read };
}

test('native suspend and resume update queryable state and publish snapshots in order', t => {
    const fixture = setup(t);
    const { read, context, powerMonitor, messages } = fixture;
    const initial = read();
    assert.deepEqual(initial, { suspended: false, revision: 0, resumedAt: null });
    assert.deepEqual(messages, []);

    powerMonitor.emit('suspend');
    assert.deepEqual(read(), { suspended: true, revision: 1, resumedAt: null });
    context.time = 65000;
    powerMonitor.emit('resume');
    assert.deepEqual(read(), { suspended: false, revision: 2, resumedAt: 65000 });
    powerMonitor.emit('suspend');
    assert.deepEqual(read(), { suspended: true, revision: 3, resumedAt: 65000 });
    assert.deepEqual(messages, [
        { channel: CHANNEL, payload: { suspended: true, revision: 1, resumedAt: null } },
        { channel: CHANNEL, payload: { suspended: false, revision: 2, resumedAt: 65000 } },
        { channel: CHANNEL, payload: { suspended: true, revision: 3, resumedAt: 65000 } }
    ]);
    assert.deepEqual(initial, { suspended: false, revision: 0, resumedAt: null });
    const mutable = read();
    mutable.revision = -1;
    messages[2].payload.suspended = false;
    assert.deepEqual(read(), { suspended: true, revision: 3, resumedAt: 65000 });
});

test('repeated native events retain every revision and the latest resume timestamp', t => {
    const { context, powerMonitor, read } = setup(t);
    powerMonitor.emit('suspend');
    powerMonitor.emit('suspend');
    powerMonitor.emit('resume');
    context.time = 2000;
    powerMonitor.emit('resume');
    assert.deepEqual(read(), { suspended: false, revision: 4, resumedAt: 2000 });
});

test('publication follows the current main window and snapshots recover events with no receiver', t => {
    const { context, powerMonitor, messages, window, read } = setup(t);
    context.window = null;
    powerMonitor.emit('suspend');
    powerMonitor.emit('resume');
    const replacement = createWindow();
    context.window = replacement.window;
    assert.deepEqual(read(), { suspended: false, revision: 2, resumedAt: 1000 });
    powerMonitor.emit('suspend');
    assert.deepEqual(messages, []);
    assert.deepEqual(replacement.messages, [
        { channel: CHANNEL, payload: { suspended: true, revision: 3, resumedAt: 1000 } }
    ]);
    assert.throws(() => read(window.webContents), /only available from the main Miku window/);
});

test('destroyed windows and webContents are skipped while native state is retained', t => {
    const { window, powerMonitor, messages, read } = setup(t);
    window.destroyed = true;
    assert.doesNotThrow(() => powerMonitor.emit('suspend'));
    assert.throws(() => read(), /only available from the main Miku window/);
    window.destroyed = false;
    window.webContents.destroyed = true;
    assert.doesNotThrow(() => powerMonitor.emit('resume'));
    assert.throws(() => read(), /only available from the main Miku window/);
    assert.deepEqual(messages, []);
    window.webContents.destroyed = false;
    assert.deepEqual(read(), { suspended: false, revision: 2, resumedAt: 1000 });
});

test('a renderer lost during send does not interrupt native handling or lose the snapshot', t => {
    const { window, powerMonitor, read } = setup(t);
    window.webContents.send = () => { throw new Error('Object has been destroyed'); };
    assert.doesNotThrow(() => powerMonitor.emit('suspend'));
    assert.doesNotThrow(() => powerMonitor.emit('resume'));
    assert.deepEqual(read(), { suspended: false, revision: 2, resumedAt: 1000 });
});

test('IPC rejects foreign senders, child frames, and absent frames', t => {
    const { window, handlers, read } = setup(t);
    const foreign = createWindow().window.webContents;
    assert.throws(() => read(foreign), /only available from the main Miku window/);
    assert.throws(() => read(window.webContents, {}), /only available from the main Miku window/);
    assert.throws(() => read(window.webContents, null), /only available from the main Miku window/);
    assert.throws(() => handlers.get(CHANNEL)({ sender: window.webContents }), /only available from the main Miku window/);
    assert.throws(() => handlers.get(CHANNEL)({}), /only available from the main Miku window/);
    assert.throws(() => handlers.get(CHANNEL)(null), /only available from the main Miku window/);
    assert.equal(read().revision, 0);
});

test('dispose removes only owned listeners and the IPC handler, exactly once', t => {
    const { powerMonitor, lifecycle, handlers, removals, messages } = setup(t);
    const unrelatedSuspend = () => {};
    const unrelatedResume = () => {};
    powerMonitor.on('suspend', unrelatedSuspend);
    powerMonitor.on('resume', unrelatedResume);
    lifecycle.dispose();
    lifecycle.dispose();
    assert.deepEqual(powerMonitor.listeners('suspend'), [unrelatedSuspend]);
    assert.deepEqual(powerMonitor.listeners('resume'), [unrelatedResume]);
    assert.equal(handlers.has(CHANNEL), false);
    assert.deepEqual(removals, [CHANNEL]);
    powerMonitor.emit('suspend');
    powerMonitor.emit('resume');
    assert.deepEqual(messages, []);
});
