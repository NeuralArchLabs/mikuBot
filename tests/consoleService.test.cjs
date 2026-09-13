const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createConsoleService } = require('../electron/services/consoleService.cjs');

function serviceFor(t, options = {}) {
    const service = createConsoleService({
        resolveContext: async input => ({ cwd: process.cwd(), workspacePath: process.cwd(), projectId: input.projectId ?? null, sessionId: input.sessionId }),
        ...options,
    });
    t.after(() => service.dispose());
    return service;
}

function nodeCommand(code, options = {}) {
    return { command: process.execPath, args: ['-e', code], shell: false, WaitMsBeforeAsync: 3000, ...options };
}

function fakeChild() {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => { queueMicrotask(() => child.emit('close', null, 'SIGTERM')); return true; };
    return child;
}

test('nonzero exit codes are failed and stderr alone does not indicate failure', async t => {
    const service = serviceFor(t);
    const failed = await service.run(nodeCommand('process.stdout.write("build output"); process.exitCode = 23;'));
    assert.equal(failed.ok, true);
    assert.equal(failed.status, 'failed');
    assert.equal(failed.success, false);
    assert.equal(failed.exitCode, 23);
    assert.equal(failed.code, 23);
    assert.equal(failed.stdout, 'build output');
    assert.equal(failed.spawnError, null);
    const warning = await service.run(nodeCommand('process.stderr.write("warning only");'));
    assert.equal(warning.status, 'completed');
    assert.equal(warning.success, true);
    assert.equal(warning.exitCode, 0);
    assert.equal(warning.error, null);
    assert.equal(warning.stderr, 'warning only');
    assert.deepEqual(service.pollNotifications(), [], 'synchronous completions do not notify again');
});

test('direct execution preserves argument boundaries, quotes and shell metacharacters', async t => {
    const service = serviceFor(t);
    const args = ['two words', '"quoted"', 'a&b|c', '$value', ''];
    const result = await service.run({ command: process.execPath, args: ['-e', 'process.stdout.write(JSON.stringify(process.argv.slice(1)))', ...args], shell: false, WaitMsBeforeAsync: 3000 });
    assert.equal(result.success, true);
    assert.deepEqual(JSON.parse(result.stdout), args);
    const mixedShellArgs = await service.run({ command: 'echo', args: ['lost', 'boundaries'] });
    assert.equal(mixedShellArgs.ok, false);
    assert.match(mixedShellArgs.error, /use `args`.*shell:true.*`argv`.*shell:false/i);
    const stringDirectArgs = await service.run({ command: 'echo', args: 'not an array', shell: false });
    assert.equal(stringDirectArgs.ok, false);
    assert.match(stringDirectArgs.error, /use `argv`.*shell:false/i);
});

test('spawn errors have no invented process exit code', async t => {
    const service = serviceFor(t);
    const result = await service.run({ command: '__miku_missing_executable_8517__', args: [], shell: false, WaitMsBeforeAsync: 3000 });
    assert.equal(result.ok, true);
    assert.equal(result.status, 'spawn_error');
    assert.equal(result.success, false);
    assert.equal(result.exitCode, null);
    assert.equal(result.code, null);
    assert.equal(result.spawnError.code, 'ENOENT');
    assert.deepEqual(service.pollNotifications(), []);
});

test('error and close events finalize once and include all output drained before close', async t => {
    const child = fakeChild();
    const service = serviceFor(t, { spawn: () => child });
    const running = await service.run(nodeCommand('', { WaitMsBeforeAsync: 0 }));
    child.emit('error', Object.assign(new Error('spawn failed'), { code: 'EACCES' }));
    child.stderr.emit('data', 'last diagnostics');
    assert.equal((await service.manage({ commandId: running.commandId })).status, 'running');
    child.emit('close', -1);
    child.emit('close', 0);
    child.emit('error', new Error('late error'));
    const [notification] = service.pollNotifications();
    assert.equal(notification.status, 'spawn_error');
    assert.equal(notification.exitCode, null);
    assert.equal(notification.stderr, 'last diagnostics');
    assert.equal(notification.error, 'spawn failed');
    assert.deepEqual(service.pollNotifications(), []);
});

test('background timeout remains active after the initial running response', async t => {
    const service = serviceFor(t);
    const started = await service.run(nodeCommand('process.stdout.write("started"); setInterval(() => {}, 1000);', { timeout_ms: 500, WaitMsBeforeAsync: 0, sessionId: 'timeout-session' }));
    assert.equal(started.status, 'running');
    assert.equal(started.success, null);
    const ended = await service.manage({ action: 'wait', commandId: started.commandId, sessionId: 'timeout-session', waitMs: 5000 });
    assert.equal(ended.status, 'timed_out');
    assert.equal(ended.success, false);
    assert.equal(ended.terminationRequested, 'timed_out');
    assert.equal(ended.stdout, 'started');
    assert.ok(ended.durationMs >= 450);
    assert.ok(ended.endTime >= ended.startTime);
    assert.equal((await service.manage({ action: 'terminate', commandId: started.commandId, sessionId: 'timeout-session' })).status, 'timed_out');
});

test('wait_ms pauses the tool response and rejects conflicting aliases', async t => {
    const service = serviceFor(t);
    const started = await service.run(nodeCommand('setTimeout(() => process.stdout.write("ready"), 40);', {
        wait_ms: 0,
        WaitMsBeforeAsync: 0,
        sessionId: 'wait-alias-session'
    }));
    assert.equal(started.status, 'running');
    const waitStartedAt = Date.now();
    const ended = await service.manage({ action: 'wait', commandId: started.commandId, sessionId: 'wait-alias-session', wait_ms: 2000 });
    const waitElapsed = Date.now() - waitStartedAt;
    assert.equal(ended.status, 'completed');
    assert.equal(ended.stdout, 'ready');
    assert.ok(waitElapsed < 1500, `completion should wake the wait early (elapsed ${waitElapsed} ms)`);
    const inferred = await service.run(nodeCommand('setTimeout(() => process.stdout.write("inferred"), 40);', {
        wait_ms: 0,
        WaitMsBeforeAsync: 0,
        sessionId: 'wait-alias-session'
    }));
    const inferredDone = await service.manage({ commandId: inferred.commandId, sessionId: 'wait-alias-session', wait_ms: 2000 });
    assert.equal(inferredDone.status, 'completed');
    assert.equal(inferredDone.stdout, 'inferred');
    const conflict = await service.run(nodeCommand('', { wait_ms: 1, waitMs: 2 }));
    assert.equal(conflict.ok, false);
    assert.match(conflict.error, /only one wait option/i);
});

test('background completion callback emits one terminal snapshot without replacing polling delivery', async t => {
    const events = [];
    const service = serviceFor(t, { onComplete: event => events.push(event) });
    const started = await service.run(nodeCommand('setTimeout(() => process.stdout.write("done"), 50);', {
        WaitMsBeforeAsync: 0,
        sessionId: 'event-session'
    }));
    assert.equal(started.status, 'running');
    const ended = await service.manage({ action: 'wait', commandId: started.commandId, sessionId: 'event-session', waitMs: 2000 });
    assert.equal(ended.status, 'completed');
    assert.equal(events.length, 1);
    assert.equal(events[0].eventId, ended.eventId);
    assert.equal(events[0].stdout, 'done');
    // Explicit status observation still suppresses the durable polling queue.
    assert.deepEqual(service.pollNotifications({ sessionId: 'event-session' }), []);
});

test('termination kills the process tree and preserves a cancellation outcome', async t => {
    const service = serviceFor(t);
    const code = 'const child = require("node:child_process").spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {stdio:"ignore", windowsHide:true}); child.once("exit", () => process.exit(0)); process.on("SIGTERM", () => {}); process.stdout.write(String(child.pid)); setInterval(() => {}, 1000);';
    const started = await service.run(nodeCommand(code, { WaitMsBeforeAsync: 0, timeout_ms: 10000 }));
    let status = started;
    for (let attempt = 0; attempt < 30 && !status.stdout; attempt++) {
        status = await service.manage({ action: 'wait', commandId: started.commandId, waitMs: 100 });
    }
    const descendantPid = Number(status.stdout);
    assert.ok(descendantPid > 0, 'child process PID was reported');
    t.after(() => { try { process.kill(descendantPid, 'SIGKILL'); } catch {} });
    const ended = await service.manage({ action: 'terminate', commandId: started.commandId, waitMs: 5000 });
    assert.equal(ended.status, 'cancelled');
    assert.equal(ended.success, false);
    try {
        process.kill(descendantPid, 0);
        // A killed orphan may remain a zombie until the container's init reaps
        // it; a zombie is terminated and cannot perform any more work.
        assert.equal(process.platform, 'linux');
        assert.match(require('node:fs').readFileSync(`/proc/${descendantPid}/stat`, 'utf8'), /\) Z /);
    } catch (error) {
        if (error.code !== 'ESRCH' && error.code !== 'ENOENT') throw error;
    }
});

test('POSIX termination kills the group immediately so parent close cannot cancel escalation', async t => {
    const child = fakeChild();
    child.pid = 12345;
    const signals = [];
    const service = serviceFor(t, {
        platform: 'linux', spawn: () => child,
        killProcess: (pid, signal) => { signals.push({ pid, signal }); child.emit('close', null, signal); },
    });
    const running = await service.run(nodeCommand('', { WaitMsBeforeAsync: 0 }));
    const ended = await service.manage({ action: 'terminate', commandId: running.commandId });
    assert.deepEqual(signals, [{ pid: -12345, signal: 'SIGKILL' }]);
    assert.equal(ended.status, 'cancelled');
    assert.equal(ended.signal, 'SIGKILL');
    assert.equal(ended.exitCode, null);
});

test('Windows never invokes taskkill for a process PID after its exit event', async t => {
    const child = fakeChild();
    child.pid = 12345;
    child.stdout.destroy = () => queueMicrotask(() => child.emit('close', 0));
    const service = serviceFor(t, { platform: 'win32', spawn: () => child, execFile: () => assert.fail('Exited PID must not be targeted') });
    const running = await service.run(nodeCommand('', { WaitMsBeforeAsync: 0 }));
    child.emit('exit', 0);
    const ended = await service.manage({ action: 'terminate', commandId: running.commandId });
    assert.equal(ended.status, 'cancelled');
    assert.equal(ended.exitCode, 0);
});

test('completion notifications are scoped, consumed once, and suppressed by terminal status reads', async t => {
    const childA = fakeChild();
    const childB = fakeChild();
    const children = [childA, childB];
    const service = serviceFor(t, { spawn: () => children.shift() });
    const first = await service.run(nodeCommand('', { WaitMsBeforeAsync: 0, sessionId: 'a' }));
    const second = await service.run(nodeCommand('', { WaitMsBeforeAsync: 0, sessionId: 'b' }));
    childA.emit('close', 0);
    childB.emit('close', 23);
    assert.deepEqual(service.pollNotifications(), []);
    const notifications = service.pollNotifications({ sessionId: 'a' });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].commandId, first.commandId);
    assert.ok(notifications[0].eventId.startsWith(`${first.commandId}:finished:`));
    assert.equal(notifications[0].success, true);
    assert.deepEqual(service.pollNotifications({ sessionId: 'a' }), []);
    const observed = await service.manage({ commandId: second.commandId, sessionId: 'b' });
    assert.equal(observed.exitCode, 23);
    assert.deepEqual(service.pollNotifications({ sessionId: 'b' }), []);
    assert.deepEqual(Object.keys(notifications[0]).sort(), Object.keys(observed).sort());
});

test('list includes compact metadata and does not acknowledge completion notifications', async t => {
    const child = fakeChild();
    const service = serviceFor(t, { spawn: () => child });
    const running = await service.run(nodeCommand('', { WaitMsBeforeAsync: 0 }));
    child.stdout.emit('data', 'x'.repeat(100000));
    child.stderr.emit('data', 'y'.repeat(100000));
    child.emit('close', 0);
    const listed = await service.manage({ action: 'list' });
    assert.equal(listed.tasks.length, 1);
    assert.equal(listed.tasks[0].stdout, undefined);
    assert.equal(listed.tasks[0].stderr, undefined);
    assert.equal(listed.tasks[0].output.stdout.totalChars, 100000);
    assert.ok(JSON.stringify(listed).length < 3000);
    const [notification] = service.pollNotifications();
    assert.equal(notification.commandId, running.commandId);
    assert.equal(notification.eventId, listed.tasks[0].eventId);
});

test('output cursors are incremental and report gaps when old output is evicted', async t => {
    const child = fakeChild();
    const service = serviceFor(t, { spawn: () => child, maxOutputChars: 10 });
    const running = await service.run(nodeCommand('', { WaitMsBeforeAsync: 0 }));
    child.stdout.emit('data', 'abcdef');
    child.stderr.emit('data', 'warn');
    const tail = await service.manage({ commandId: running.commandId, maxOutputChars: 3 });
    assert.equal(tail.stdout, 'def');
    assert.equal(tail.stdoutCursor, 6);
    assert.equal(tail.output.stdout.omittedChars, 3);
    assert.equal(tail.truncated, true);
    const first = await service.manage({ commandId: running.commandId, stdoutCursor: 0, stderrCursor: 0, maxOutputChars: 3 });
    assert.equal(first.stdout, 'abc');
    assert.equal(first.stdoutCursor, 3);
    assert.equal(first.output.stdout.hasMore, true);
    const next = await service.manage({ commandId: running.commandId, stdoutCursor: first.stdoutCursor, stderrCursor: first.stderrCursor });
    assert.equal(next.stdout, 'def');
    assert.equal(next.stderr, 'n');
    child.stdout.emit('data', 'ghijklmnopqrst');
    const gap = await service.manage({ commandId: running.commandId, stdoutCursor: next.stdoutCursor });
    assert.equal(gap.stdout, 'klmnopqrst');
    assert.equal(gap.stdoutCursor, 20);
    assert.equal(gap.output.stdout.bufferStart, 10);
    assert.equal(gap.output.stdout.droppedChars, 4);
    assert.equal(gap.truncated, true);
    assert.equal((await service.manage({ commandId: running.commandId, stdoutCursor: 21 })).ok, false);
    child.emit('close', 0);
});

test('session isolation applies to lookup, wait, list and termination', async t => {
    const child = fakeChild();
    const service = serviceFor(t, { spawn: () => child });
    const run = await service.run(nodeCommand('', { WaitMsBeforeAsync: 0, sessionId: 'owner', projectId: 'project-a' }));
    for (const action of ['status', 'wait', 'terminate']) {
        assert.equal((await service.manage({ action, commandId: run.commandId, sessionId: 'other' })).ok, false);
    }
    assert.deepEqual((await service.manage({ action: 'list', sessionId: 'other' })).tasks, []);
    const owned = await service.manage({ action: 'list', sessionId: 'owner' });
    assert.equal(owned.tasks.length, 1);
    assert.equal(owned.tasks[0].projectId, 'project-a');
    const stopped = await service.manage({ action: 'terminate', commandId: run.commandId, sessionId: 'owner' });
    assert.equal(stopped.status, 'cancelled');
    assert.equal(stopped.success, false);
    child.emit('close', 0);
    assert.equal((await service.manage({ commandId: run.commandId, sessionId: 'owner' })).status, 'cancelled');
});

test('duplicate ids are reserved before asynchronous context resolution and rejected before spawning', async t => {
    let release;
    let spawnCount = 0;
    const child = fakeChild();
    const service = serviceFor(t, {
        resolveContext: () => new Promise(resolve => { release = () => resolve({ cwd: process.cwd() }); }),
        spawn: () => { spawnCount++; return child; },
    });
    const pending = service.run(nodeCommand('', { commandId: 'same-id', WaitMsBeforeAsync: 0 }));
    const duplicate = await service.run(nodeCommand('', { commandId: 'same-id', WaitMsBeforeAsync: 0 }));
    assert.equal(duplicate.ok, false);
    assert.match(duplicate.error, /already exists/);
    assert.equal((await service.run(nodeCommand('', { commandId: 'same-id', WaitMsBeforeAsync: 0 }))).ok, false);
    assert.equal(spawnCount, 0);
    release();
    assert.equal((await pending).status, 'running');
    assert.equal(spawnCount, 1);
    assert.equal((await service.run(nodeCommand('', { commandId: 'same-id' }))).ok, false);
    child.emit('close', 0);
});

test('context failures never spawn and the resolved working directory is echoed', async t => {
    let spawnCount = 0;
    const service = serviceFor(t, {
        resolveContext: async input => {
            if (input.projectId === 'missing') throw Object.assign(new Error('Project missing'), { code: 'PROJECT_NOT_FOUND', context: { projectId: 'missing', sessionId: input.sessionId, cwd: '/missing-project' } });
            return Object.freeze({ cwd: process.cwd(), workspacePath: process.cwd(), projectId: 'active-project', projectName: 'Active project', sessionId: input.sessionId, workspaceSource: 'project' });
        },
        spawn: () => { spawnCount++; const child = fakeChild(); queueMicrotask(() => child.emit('close', 0)); return child; },
    });
    const missing = await service.run(nodeCommand('', { projectId: 'missing' }));
    assert.equal(missing.ok, false);
    assert.equal(missing.errorCode, 'PROJECT_NOT_FOUND');
    assert.equal(missing.projectId, 'missing');
    assert.equal(missing.cwd, '/missing-project');
    assert.equal(spawnCount, 0);
    const valid = await service.run(nodeCommand(''));
    assert.equal(valid.cwd, process.cwd());
    assert.equal(valid.workspacePath, process.cwd());
    assert.equal(valid.projectId, 'active-project');
    assert.equal(valid.projectName, 'Active project');
    assert.equal(valid.workspaceSource, 'project');
    assert.equal(valid.contextSource, 'project');
});

test('completed task retention is bounded by count and time without removing running tasks', async t => {
    let currentTime = 100;
    const child = fakeChild();
    const service = serviceFor(t, { maxCompleted: 1, completedTtlMs: 1000, now: () => currentTime, spawn: () => child });
    const first = await service.run(nodeCommand('', { commandId: 'old', WaitMsBeforeAsync: 0 }));
    child.emit('close', 0);
    currentTime++;
    const second = await service.run(nodeCommand('', { commandId: 'new', WaitMsBeforeAsync: 0 }));
    child.emit('close', 0);
    assert.equal((await service.manage({ commandId: first.commandId })).ok, false);
    assert.equal((await service.manage({ commandId: second.commandId })).ok, true);
    const running = await service.run(nodeCommand('', { commandId: 'running', WaitMsBeforeAsync: 0 }));
    currentTime += 1000;
    assert.equal((await service.manage({ commandId: second.commandId })).ok, false);
    assert.equal((await service.manage({ commandId: running.commandId })).status, 'running');
    child.emit('close', 0);
});

test('reusing an evicted commandId creates a different terminal event identity', async t => {
    let currentTime = 100;
    const child = fakeChild();
    const service = serviceFor(t, { completedTtlMs: 1, now: () => currentTime, spawn: () => child });
    await service.run(nodeCommand('', { commandId: 'reused', WaitMsBeforeAsync: 0 }));
    child.emit('close', 0);
    const [first] = service.pollNotifications();
    currentTime++;
    await service.run(nodeCommand('', { commandId: 'reused', WaitMsBeforeAsync: 0 }));
    child.emit('close', 0);
    const [second] = service.pollNotifications();
    assert.equal(first.commandId, second.commandId);
    assert.notEqual(first.eventId, second.eventId);
    assert.equal((await service.manage({ commandId: 'reused' })).eventId, second.eventId);
});

test('running snapshots show duration and validation rejects invalid limits without spawning', async t => {
    let currentTime = 100;
    let spawnCount = 0;
    const child = fakeChild();
    const service = serviceFor(t, { now: () => currentTime, spawn: () => { spawnCount++; return child; } });
    for (const input of [{ timeout_ms: -1 }, { timeout_ms: 600001 }, { WaitMsBeforeAsync: 30001 }, { commandId: '../bad' }, { shell: 'powershell' }]) {
        assert.equal((await service.run(nodeCommand('', input))).ok, false);
    }
    assert.equal(spawnCount, 0);
    const running = await service.run(nodeCommand('', { WaitMsBeforeAsync: 0 }));
    currentTime += 25;
    assert.equal((await service.manage({ commandId: running.commandId })).durationMs, 25);
    assert.equal((await service.manage({ action: 'wait', commandId: running.commandId, waitMs: 30001 })).ok, false);
    child.emit('close', 0);
});

test('Windows shell receives the command unchanged and uses normal cmd semantics', async t => {
    let invocation;
    const service = serviceFor(t, {
        platform: 'win32',
        spawn: (command, args, options) => {
            invocation = { command, args, options };
            const child = fakeChild();
            queueMicrotask(() => child.emit('close', 17));
            return child;
        },
    });
    const result = await service.run({ command: 'powershell.exe', args: '-NoProfile -Command "Write-Error warning; exit 17"' });
    assert.equal(invocation.command, 'powershell.exe -NoProfile -Command "Write-Error warning; exit 17"');
    assert.equal(invocation.options.windowsHide, true);
    assert.equal(invocation.options.shell, process.env.ComSpec || 'cmd.exe');
    assert.equal(invocation.options.timeout, undefined);
    assert.equal(result.exitCode, 17);
});

test('PowerShell explicit exit semantics remain those of the caller', { skip: process.platform !== 'win32' }, async t => {
    const service = serviceFor(t);
    const runPowerShell = code => service.run({ command: 'powershell.exe', shell: false, args: ['-NoProfile', '-NonInteractive', '-Command', code], WaitMsBeforeAsync: 5000 });
    const explicitExit = await runPowerShell('Write-Error "non-terminating"; exit 17');
    assert.equal(explicitExit.exitCode, 17);
    assert.equal(explicitExit.status, 'failed');
    assert.match(explicitExit.stderr, /non-terminating/);
    const stopped = await runPowerShell('$ErrorActionPreference="Stop"; Write-Error "terminating"; exit 17');
    assert.equal(stopped.exitCode, 1);
    assert.equal(stopped.status, 'failed');
});
