import test from 'node:test';
import assert from 'node:assert/strict';
import { createSchedulerRuntime, isScheduledNetworkReady } from '../src/services/core/schedulerRuntime.ts';

test('offline scheduling waits for remote providers while preserving local and mode-specific execution', () => {
    const config = { provider: 'codex', model: 'remote', agentProvider: 'ollama', agentModel: 'local' };
    assert.equal(isScheduledNetworkReady(config, 'chat', false), false);
    assert.equal(isScheduledNetworkReady(config, 'agent', false), true);
    assert.equal(isScheduledNetworkReady({ ...config, agentModel: '' }, 'agent', false), false);
    assert.equal(isScheduledNetworkReady({ provider: 'unsloth' }, 'chat', false), true);
    assert.equal(isScheduledNetworkReady(config, 'chat', true), true);
});

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}
function response(type = 'text/javascript', ok = true) {
    return { ok, headers: new Headers({ 'content-type': type }) };
}
function setup(t, options = {}) {
    const nativeListeners = new Set();
    const events = new EventTarget();
    const requests = [];
    let wakes = 0;
    const context = { power: { suspended: false, revision: 0, resumedAt: null } };
    const runtime = createSchedulerRuntime({
        bridge: {
            getSchedulerPowerState: options.getPower ?? (async () => ({ ...context.power })),
            onSchedulerPowerState(listener) { nativeListeners.add(listener); return () => nativeListeners.delete(listener); }
        },
        events,
        dev: options.dev ?? false,
        origin: 'http://localhost:3001',
        fetch: async (...args) => {
            requests.push(args);
            return options.fetch ? options.fetch(...args) : response();
        }
    });
    const unsubscribe = runtime.subscribe(() => { wakes++; });
    t.after(unsubscribe);
    return {
        runtime, context, events, requests, nativeListeners, unsubscribe,
        get wakes() { return wakes; },
        emit(state) { context.power = state; for (const listener of nativeListeners) listener(state); }
    };
}

test('a stale IPC snapshot cannot override a newer suspension event', async t => {
    const query = deferred();
    const fixture = setup(t, { getPower: () => query.promise });
    const checking = fixture.runtime.isReady();
    fixture.emit({ suspended: true, revision: 3, resumedAt: 1000 });
    query.resolve({ suspended: false, revision: 2, resumedAt: 1000 });
    assert.equal(await checking, false);
    assert.equal(fixture.requests.length, 0);
});

test('a stale suspended snapshot cannot override a newer resume event', async t => {
    const query = deferred();
    const fixture = setup(t, { getPower: () => query.promise });
    const checking = fixture.runtime.isReady();
    fixture.emit({ suspended: false, revision: 4, resumedAt: 9000 });
    query.resolve({ suspended: true, revision: 3, resumedAt: 1000 });
    assert.equal(await checking, true);
});

test('suspension while the dev server is being probed invalidates readiness', async t => {
    const probe = deferred();
    const fixture = setup(t, { dev: true, fetch: () => probe.promise });
    const checking = fixture.runtime.isReady();
    await Promise.resolve();
    assert.equal(fixture.requests.length, 1);
    fixture.emit({ suspended: true, revision: 1, resumedAt: null });
    probe.resolve(response());
    assert.equal(await checking, false);
});

test('a suspend/resume cycle during the same probe requires a fresh readiness check', async t => {
    const probe = deferred();
    let first = true;
    const fixture = setup(t, { dev: true, fetch: () => {
        if (first) { first = false; return probe.promise; }
        return response();
    } });
    const checking = fixture.runtime.isReady();
    await Promise.resolve();
    fixture.emit({ suspended: true, revision: 1, resumedAt: null });
    fixture.emit({ suspended: false, revision: 2, resumedAt: 12000 });
    probe.resolve(response());
    assert.equal(await checking, false);
    assert.equal(await fixture.runtime.isReady(), true);
});

test('dev readiness rejects failed requests, HTTP failures, and HTML fallback documents', async t => {
    for (const fetch of [
        async () => { throw new TypeError('Failed to fetch'); },
        async () => response('text/javascript', false),
        async () => response('text/html; charset=utf-8')
    ]) {
        const fixture = setup(t, { dev: true, fetch });
        assert.equal(await fixture.runtime.isReady(), false);
        const [[url, options]] = fixture.requests;
        assert.equal(url.href, 'http://localhost:3001/src/services/core/ModelProviders.ts');
        assert.equal(options.method, 'HEAD');
        assert.equal(options.cache, 'no-store');
        assert.ok(options.signal instanceof AbortSignal);
    }
});

test('dev probe timeout aborts the request and defers dispatch', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const fixture = setup(t, { dev: true, fetch: (_url, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }) });
    const checking = fixture.runtime.isReady();
    await Promise.resolve();
    assert.equal(fixture.requests.length, 1);
    t.mock.timers.tick(3000);
    assert.equal(await checking, false);
    assert.equal(fixture.requests[0][1].signal.aborted, true);
});

test('resume wakes the scheduler and successful dev readiness can recover after failure', async t => {
    let available = false;
    const fixture = setup(t, { dev: true, fetch: async () => {
        if (!available) throw new TypeError('Server offline');
        return response('application/javascript; charset=utf-8');
    } });
    assert.equal(await fixture.runtime.isReady(), false);
    fixture.emit({ suspended: true, revision: 1, resumedAt: null });
    assert.equal(await fixture.runtime.isReady(), false);
    assert.equal(fixture.requests.length, 1);
    available = true;
    fixture.emit({ suspended: false, revision: 2, resumedAt: 15000 });
    assert.equal(await fixture.runtime.isReady(), true);
    assert.equal(fixture.wakes, 2);
    fixture.events.dispatchEvent(new Event('online'));
    assert.equal(fixture.wakes, 3);
});

test('production readiness does not request the development server', async t => {
    const fixture = setup(t, { fetch: async () => { throw new Error('Must not fetch'); } });
    assert.equal(await fixture.runtime.isReady(), true);
    assert.deepEqual(fixture.requests, []);
});

test('unavailable native IPC defers rather than assuming readiness', async t => {
    const fixture = setup(t, { getPower: async () => { throw new Error('IPC unavailable'); } });
    assert.equal(await fixture.runtime.isReady(), false);
});

test('unsubscribe removes native and browser recovery listeners', t => {
    const fixture = setup(t);
    assert.equal(fixture.nativeListeners.size, 1);
    fixture.unsubscribe();
    fixture.unsubscribe();
    assert.equal(fixture.nativeListeners.size, 0);
    fixture.emit({ suspended: false, revision: 2, resumedAt: 1000 });
    fixture.events.dispatchEvent(new Event('online'));
    assert.equal(fixture.wakes, 0);
});
