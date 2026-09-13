import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourceUrl = new URL('../src/services/core/scheduler.ts', import.meta.url);
const compiled = ts.transpileModule(await readFile(sourceUrl, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText.replace(/from (['"])\.\/schedulerRuntime\1/g,
    `from '${new URL('../src/services/core/schedulerRuntime.ts', import.meta.url).href}'`);
let imports = 0;
const NOW = Date.parse('2026-09-13T12:00:00.000Z');
const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
function once(overrides = {}) {
    return {
        id: 'overdue', name: 'Pending after sleep', prompt: 'Run scheduled work', mode: 'agent',
        channel: 'both', scheduleType: 'once', schedule: new Date(NOW - 60_000).toISOString(),
        enabled: true, createdAt: NOW - 120_000, lastRunAt: null, nextRunAt: NOW - 60_000,
        totalExecutions: 0, executionsToday: 0, lastExecutionDay: '2026-09-13',
        maxExecutionsPerDay: 0, ...overrides
    };
}

async function setup(t, options = {}) {
    t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: NOW });
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'error', () => {});
    const tasks = options.tasks ?? [once()];
    const storage = new Map([
        ['mikucentral_scheduler', JSON.stringify(tasks)], ['mikucentral_scheduler_logs', '[]']
    ]);
    const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const priorStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const saves = { tasks: [], logs: [] };
    const bridge = {
        loadSchedulerTasks: options.loadTasks ?? (async () => ({ ok: true, data: JSON.stringify(tasks) })),
        loadSchedulerLogs: async () => ({ ok: true, data: '[]' }),
        saveSchedulerTasks: async data => { saves.tasks.push(JSON.parse(data)); },
        saveSchedulerLogs: async data => { saves.logs.push(JSON.parse(data)); }
    };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {
        electron: bridge, location: { origin: 'http://localhost:3001' },
        addEventListener() {}, removeEventListener() {}
    } });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
        getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value)
    } });
    t.after(() => {
        if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow);
        else delete globalThis.window;
        if (priorStorage) Object.defineProperty(globalThis, 'localStorage', priorStorage);
        else delete globalThis.localStorage;
    });
    const { NeuralScheduler, SchedulerDeferredError } = await import(
        `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}#fixture-${++imports}`
    );
    const listeners = new Set();
    const runtime = { ready: options.ready ?? true };
    const checks = [];
    const scheduler = new NeuralScheduler({
        isReady: async () => {
            checks.push(Date.now());
            return options.readiness ? options.readiness() : runtime.ready;
        },
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
    });
    t.after(() => scheduler.destroy());
    const calls = [];
    const telegram = [];
    const ui = [];
    const init = () => scheduler.init(async (...args) => {
        calls.push(args);
        return options.executor ? options.executor(...args) : 'Completed result';
    }, value => telegram.push(value), (...args) => {
        ui.push(args);
        options.onUiMessage?.(...args);
    }, () => {}, () => {});
    return {
        scheduler, runtime, checks, calls, telegram, ui, saves, listeners, init, SchedulerDeferredError,
        wake: () => { for (const listener of listeners) listener(); }
    };
}

test('init preserves an overdue one-shot occurrence and executes it once when ready', async t => {
    const fixture = await setup(t, { tasks: [once({ nextRunAt: null })], ready: false });
    await fixture.init();
    await flush();
    const task = fixture.scheduler.getTasks()[0];
    assert.equal(task.nextRunAt, NOW - 60_000);
    assert.equal(task.enabled, true);
    assert.equal(fixture.calls.length, 0);
    fixture.runtime.ready = true;
    fixture.wake();
    fixture.wake();
    await flush();
    assert.deepEqual(fixture.calls, [['Run scheduled work', 'agent', true]]);
    assert.equal(fixture.scheduler.getTasks()[0].totalExecutions, 1);
    assert.equal(fixture.scheduler.getTasks()[0].enabled, false);
    assert.equal(fixture.scheduler.getTasks()[0].nextRunAt, null);
    assert.equal(fixture.scheduler.getLogs()[0].status, 'success');
    assert.deepEqual(fixture.telegram, ['Completed result']);
    fixture.wake();
    t.mock.timers.tick(30_000);
    await flush();
    assert.equal(fixture.calls.length, 1);
});

test('unavailable runtime retains the occurrence and counters without logs or notifications', async t => {
    const original = once({ executionsToday: 4, lastExecutionDay: '2026-09-12', totalExecutions: 7 });
    const fixture = await setup(t, { tasks: [original], ready: false });
    await fixture.init();
    await flush();
    fixture.wake();
    t.mock.timers.tick(90_000);
    await flush();
    assert.deepEqual(fixture.scheduler.getTasks(), [original]);
    assert.deepEqual(fixture.scheduler.getLogs(), []);
    assert.deepEqual(fixture.saves, { tasks: [], logs: [] });
    assert.deepEqual(fixture.calls, []);
    assert.deepEqual(fixture.telegram, []);
    assert.deepEqual(fixture.ui, []);
    fixture.runtime.ready = true;
    fixture.wake();
    await flush();
    assert.equal(fixture.calls.length, 1);
    assert.equal(fixture.scheduler.getTasks()[0].executionsToday, 1);
});

test('repeated wake and manual requests share the in-flight execution lock', async t => {
    const result = deferred();
    const fixture = await setup(t, { executor: () => result.promise });
    await fixture.init();
    await flush();
    const manualOne = fixture.scheduler.runTaskNow('overdue');
    const manualTwo = fixture.scheduler.runTaskNow('overdue');
    fixture.wake();
    fixture.wake();
    t.mock.timers.tick(60_000);
    await flush();
    assert.equal(fixture.calls.length, 1);
    result.resolve('Only one execution');
    await Promise.all([manualOne, manualTwo]);
    await flush();
    assert.equal(fixture.calls.length, 1);
    assert.equal(fixture.scheduler.getLogs().length, 1);
    assert.equal(fixture.scheduler.getTasks()[0].totalExecutions, 1);
});

test('a manual run can reuse a deferred occurrence after its automatic schedule was disabled', async t => {
    const fixture = await setup(t, { ready: false });
    await fixture.init();
    await flush();
    fixture.scheduler.updateTask('overdue', { enabled: false });
    const manual = fixture.scheduler.runTaskNow('overdue');
    await flush();
    assert.equal(fixture.calls.length, 0);
    fixture.runtime.ready = true;
    fixture.wake();
    await manual;
    assert.equal(fixture.calls.length, 1);
    fixture.wake();
    await flush();
    assert.equal(fixture.calls.length, 1);
});

test('user activity that starts during asynchronous readiness defers dispatch', async t => {
    const readiness = deferred();
    let waiting = true;
    const fixture = await setup(t, { readiness: () => waiting ? readiness.promise : true });
    await fixture.init();
    await flush();
    fixture.scheduler.setUserActive(true);
    readiness.resolve(true);
    await flush();
    assert.equal(fixture.calls.length, 0);
    assert.equal(fixture.scheduler.getTasks()[0].enabled, true);
    waiting = false;
    fixture.scheduler.setUserActive(false);
    await flush();
    assert.equal(fixture.calls.length, 1);
});

test('executor rejection is recorded as an error without a success notification', async t => {
    const fixture = await setup(t, { executor: async () => { throw new Error('Provider connection lost'); } });
    await fixture.init();
    await flush();
    const logs = fixture.scheduler.getLogs();
    assert.equal(logs.length, 1);
    assert.equal(logs[0].status, 'error');
    assert.equal(logs[0].error, 'Provider connection lost');
    assert.equal(logs[0].response, undefined);
    assert.equal(fixture.scheduler.getTasks()[0].totalExecutions, 1);
    assert.deepEqual(fixture.telegram, []);
    assert.equal(fixture.ui.length, 1);
    assert.match(fixture.ui[0][1], /Neural Error.*Provider connection lost/);
});

test('SchedulerDeferredError preserves the task for a later wake without a failure log', async t => {
    let fixture;
    let defer = true;
    fixture = await setup(t, { executor: async () => {
        if (defer) throw new fixture.SchedulerDeferredError('Renderer is recovering');
        return 'Recovered';
    } });
    await fixture.init();
    await flush();
    assert.deepEqual(fixture.scheduler.getTasks(), [once()]);
    assert.deepEqual(fixture.scheduler.getLogs(), []);
    assert.deepEqual(fixture.saves, { tasks: [], logs: [] });
    assert.deepEqual(fixture.telegram, []);
    assert.deepEqual(fixture.ui, []);
    defer = false;
    fixture.wake();
    await flush();
    assert.equal(fixture.calls.length, 2);
    assert.equal(fixture.scheduler.getTasks()[0].totalExecutions, 1);
    assert.equal(fixture.scheduler.getLogs().length, 1);
    assert.deepEqual(fixture.telegram, ['Recovered']);
});

test('a failing UI success notification does not replay an already completed task', async t => {
    const fixture = await setup(t, { onUiMessage: () => { throw new Error('View unavailable'); } });
    await fixture.init();
    await flush();
    assert.equal(fixture.calls.length, 1);
    assert.equal(fixture.scheduler.getTasks()[0].totalExecutions, 1);
    assert.equal(fixture.scheduler.getTasks()[0].enabled, false);
    assert.equal(fixture.scheduler.getLogs().length, 1);
    fixture.wake();
    fixture.wake();
    t.mock.timers.tick(60_000);
    await flush();
    assert.equal(fixture.calls.length, 1);
    assert.deepEqual(fixture.telegram, ['Completed result']);
});

test('a failing UI error notification records the original error without replaying the task', async t => {
    const fixture = await setup(t, {
        executor: async () => { throw new Error('Original execution failure'); },
        onUiMessage: () => { throw new Error('Error view unavailable'); }
    });
    await fixture.init();
    await flush();
    assert.equal(fixture.calls.length, 1);
    assert.equal(fixture.scheduler.getTasks()[0].totalExecutions, 1);
    assert.equal(fixture.scheduler.getTasks()[0].enabled, false);
    assert.equal(fixture.scheduler.getLogs().length, 1);
    assert.equal(fixture.scheduler.getLogs()[0].status, 'error');
    assert.equal(fixture.scheduler.getLogs()[0].error, 'Original execution failure');
    fixture.wake();
    t.mock.timers.tick(60_000);
    await flush();
    assert.equal(fixture.calls.length, 1);
    assert.deepEqual(fixture.telegram, []);
});

test('destroy during storage initialization does not subscribe or start pending work', async t => {
    const load = deferred();
    const fixture = await setup(t, { loadTasks: () => load.promise });
    const initializing = fixture.init();
    fixture.scheduler.destroy();
    load.resolve({ ok: true, data: JSON.stringify([once()]) });
    await initializing;
    await flush();
    t.mock.timers.tick(90_000);
    await flush();
    assert.equal(fixture.listeners.size, 0);
    assert.deepEqual(fixture.checks, []);
    assert.deepEqual(fixture.calls, []);
    assert.deepEqual(fixture.scheduler.getLogs(), []);
});

test('destroy after initialization removes recovery listeners and stops ticks', async t => {
    const fixture = await setup(t, { ready: false });
    await fixture.init();
    await flush();
    assert.equal(fixture.listeners.size, 1);
    const checksBefore = fixture.checks.length;
    fixture.scheduler.destroy();
    fixture.runtime.ready = true;
    fixture.wake();
    t.mock.timers.tick(90_000);
    await flush();
    assert.equal(fixture.listeners.size, 0);
    assert.equal(fixture.checks.length, checksBefore);
    assert.equal(fixture.calls.length, 0);
});
