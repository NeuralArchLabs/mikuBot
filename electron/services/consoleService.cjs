const { spawn: nativeSpawn, execFile: nativeExecFile } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const path = require('node:path');

const MAX_WAIT_MS = 30000;
const MAX_TIMEOUT_MS = 600000;

function integer(value, fallback, min, max, name) {
    if (value === undefined || value === null) return fallback;
    if (!Number.isInteger(value) || value < min || value > max) {
        throw new Error(`${name} must be an integer between ${min} and ${max}`);
    }
    return value;
}

function scope(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') throw new Error('sessionId must be a string');
    return value;
}

/** Resolve the canonical wait option while keeping older camelCase names. */
function resolveWait(input, names, fallback) {
    const supplied = names
        .filter(name => input[name] !== undefined && input[name] !== null)
        .map(name => ({ name, value: input[name] }));
    const distinct = [...new Set(supplied.map(item => item.value))];
    if (distinct.length > 1) {
        throw new Error(`Provide only one wait option (${names.join(', ')}); they must not disagree`);
    }
    return supplied.length > 0 ? supplied[0].value : fallback;
}

/** Owns processes, output buffers and completion delivery for one application. */
function createConsoleService({
    resolveContext,
    onComplete,
    spawn = nativeSpawn,
    execFile = nativeExecFile,
    killProcess = process.kill.bind(process),
    platform = process.platform,
    maxOutputChars = 512 * 1024,
    maxCompleted = 100,
    completedTtlMs = 60 * 60 * 1000,
    maxRunning = 32,
    now = Date.now,
} = {}) {
    if (typeof resolveContext !== 'function') throw new Error('resolveContext is required');
    if (onComplete !== undefined && typeof onComplete !== 'function') throw new Error('onComplete must be a function');
    integer(maxOutputChars, null, 1, 16 * 1024 * 1024, 'maxOutputChars');
    integer(maxCompleted, null, 1, 10000, 'maxCompleted');
    integer(completedTtlMs, null, 1, 7 * 24 * 60 * 60 * 1000, 'completedTtlMs');
    integer(maxRunning, null, 1, 1000, 'maxRunning');
    const entries = new Map();
    const reserved = new Set();
    let disposed = false;

    function prune() {
        const completed = [...entries.values()].filter(entry => entry.endTime !== null)
            .sort((a, b) => a.endTime - b.endTime);
        let remaining = completed.length;
        for (const entry of completed) {
            if (remaining > maxCompleted || now() - entry.endTime >= completedTtlMs) {
                entries.delete(entry.id);
                remaining--;
            }
        }
    }

    function append(buffer, data) {
        const value = String(data);
        buffer.total += value.length;
        buffer.text = (buffer.text + value).slice(-maxOutputChars);
        buffer.start = buffer.total - buffer.text.length;
    }

    function readOutput(buffer, cursor, limit, name) {
        const useTail = cursor === undefined || cursor === null;
        const requested = integer(cursor, Math.max(buffer.start, buffer.total - limit), 0, Number.MAX_SAFE_INTEGER, name);
        if (requested > buffer.total) throw new Error(`${name} is beyond the current output`);
        const fromCursor = Math.max(requested, buffer.start);
        const text = buffer.text.slice(fromCursor - buffer.start, fromCursor - buffer.start + limit);
        const nextCursor = fromCursor + text.length;
        return {
            text,
            fromCursor,
            nextCursor,
            totalChars: buffer.total,
            bufferStart: buffer.start,
            droppedChars: useTail ? buffer.start : Math.max(0, buffer.start - requested),
            omittedChars: useTail ? fromCursor : Math.max(0, buffer.start - requested),
            truncated: requested < buffer.start || (useTail && fromCursor > 0),
            hasMore: nextCursor < buffer.total,
        };
    }

    function snapshot(entry, input = {}) {
        const limit = integer(input.maxOutputChars, Math.min(65536, maxOutputChars), 1, maxOutputChars, 'maxOutputChars');
        const stdout = readOutput(entry.stdout, input.stdoutCursor, limit, 'stdoutCursor');
        const stderr = readOutput(entry.stderr, input.stderrCursor, limit, 'stderrCursor');
        const { text: stdoutText, ...stdoutMetadata } = stdout;
        const { text: stderrText, ...stderrMetadata } = stderr;
        return {
            ok: true,
            commandId: entry.id,
            id: entry.id,
            command: entry.command,
            shell: entry.shell,
            status: entry.status,
            success: entry.endTime === null ? null : entry.status === 'completed',
            exitCode: entry.exitCode,
            code: entry.exitCode,
            signal: entry.signal,
            error: entry.error,
            spawnError: entry.spawnError,
            cwd: entry.context.cwd,
            workspacePath: entry.context.workspacePath,
            projectId: entry.context.projectId ?? null,
            projectName: entry.context.projectName ?? null,
            sessionId: entry.context.sessionId ?? null,
            workspaceSource: entry.context.workspaceSource ?? entry.context.contextSource ?? entry.context.source ?? null,
            contextSource: entry.context.workspaceSource ?? entry.context.contextSource ?? entry.context.source ?? null,
            stdout: stdoutText,
            stderr: stderrText,
            stdoutCursor: stdout.nextCursor,
            stderrCursor: stderr.nextCursor,
            output: { stdout: stdoutMetadata, stderr: stderrMetadata, maxRetainedCharsPerStream: maxOutputChars },
            truncated: stdout.truncated || stderr.truncated,
            startTime: entry.startTime,
            endTime: entry.endTime,
            durationMs: Math.max(0, (entry.endTime ?? now()) - entry.startTime),
            timeout_ms: entry.timeoutMs,
            terminationRequested: entry.stopReason,
            eventId: entry.endTime === null ? null : entry.completionEventId,
        };
    }

    function emitCompletion(entry) {
        if (!onComplete || entry.endTime === null || !entry.returnedRunning || entry.completionEmitted) return;
        entry.completionEmitted = true;
        try { onComplete(snapshot(entry)); } catch { /* UI delivery must not affect process cleanup. */ }
    }

    // Listing is discovery, not delivery of a completion result. Logs stay in
    // status/wait, and list does not acknowledge pending notifications.
    function summary(entry) {
        const { stdout, stderr, stdoutCursor, stderrCursor, output, truncated, ...result } = snapshot(entry, { maxOutputChars: 1 });
        return {
            ...result,
            output: {
                stdout: { totalChars: entry.stdout.total, retainedChars: entry.stdout.text.length, bufferStart: entry.stdout.start },
                stderr: { totalChars: entry.stderr.total, retainedChars: entry.stderr.text.length, bufferStart: entry.stderr.start },
            },
        };
    }

    function finish(entry, code, signal) {
        if (entry.endTime !== null) return;
        clearTimeout(entry.timeoutTimer);
        entry.exitCode = !entry.spawnError && Number.isInteger(code) ? code : null;
        entry.signal = signal || null;
        entry.endTime = now();
        entry.status = entry.stopReason || (entry.spawnError ? 'spawn_error' : code === 0 ? 'completed' : 'failed');
        if (!entry.error && entry.status === 'failed') {
            entry.error = signal ? `Process ended with signal ${signal}` : code === null ? 'Process ended without an exit code' : `Process exited with code ${code}`;
        }
        entry.process = null;
        // Completion delivery is deliberately separate from the polling queue.
        // The renderer can update an already-rendered tool block immediately,
        // even when no new agent iteration is running to drain the queue.
        emitCompletion(entry);
        entry.resolveFinished();
        prune();
    }

    // Wait for close, not exit: pipes may still contain output after the child exits.
    function waitForClose(entry, waitMs) {
        if (entry.endTime !== null || waitMs === 0) return Promise.resolve();
        return new Promise(resolve => {
            const timer = setTimeout(resolve, waitMs);
            entry.finished.then(() => { clearTimeout(timer); resolve(); });
        });
    }

    function stop(entry, reason) {
        if (entry.endTime !== null || entry.stopReason) return;
        const child = entry.process;
        if (!child) return;
        entry.stopReason = reason;
        entry.error = reason === 'timed_out' ? `Process timed out after ${entry.timeoutMs} ms` : 'Process cancelled';
        const fallbackKill = signal => {
            if (entry.hasExited) return;
            try { child.kill(signal); } catch (error) { entry.error += `; ${error.message}`; }
        };
        if (platform === 'win32' && Number.isInteger(child.pid) && child.pid > 0) {
            // Once exit was observed the PID can be reused. Never target it again.
            if (entry.hasExited) {
                entry.error += '; process exited before remaining output pipes closed';
                child.stdout?.destroy?.();
                child.stderr?.destroy?.();
                return;
            }
            try {
                execFile('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 10000 }, error => {
                    if (error && entry.endTime === null) fallbackKill('SIGKILL');
                });
            } catch { fallbackKill('SIGKILL'); }
        } else if (platform !== 'win32' && Number.isInteger(child.pid) && child.pid > 0) {
            // Terminate the whole group in one operation (same forceful contract
            // as Windows /F). A delayed escalation can lose descendants when
            // the parent closes first, and can target a reused process group.
            try { killProcess(-child.pid, 'SIGKILL'); } catch { fallbackKill('SIGKILL'); }
        } else {
            fallbackKill('SIGTERM');
        }
    }

    async function run(input = {}) {
        let commandId;
        let ownsReservation = false;
        try {
            if (disposed) throw new Error('Console service is disposed');
            if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Console input must be an object');
            if (typeof input.command !== 'string' || !input.command.trim() || input.command.includes('\0')) throw new Error('command must be a non-empty string without null bytes');
            commandId = input.commandId ?? `cmd_${randomUUID()}`;
            if (typeof commandId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(commandId)) throw new Error('commandId must contain 1-128 letters, numbers, underscores or hyphens');
            prune();
            if (entries.has(commandId) || reserved.has(commandId)) throw new Error(`commandId already exists: ${commandId}`);
            if ([...entries.values()].filter(entry => entry.endTime === null).length + reserved.size >= maxRunning) throw new Error(`At most ${maxRunning} console tasks can run concurrently`);
            const shell = input.shell ?? true;
            if (typeof shell !== 'boolean') throw new Error('shell must be a boolean');
            const args = input.args ?? (shell ? '' : []);
            if (shell && typeof args !== 'string') {
                throw new Error('Invalid console arguments: use `args` (string) with `shell:true`, or use `argv` (array) with `shell:false`.');
            }
            if (!shell && !(Array.isArray(args) && args.every(arg => typeof arg === 'string' && !arg.includes('\0'))) && args !== '') {
                throw new Error('Invalid console arguments: use `argv` (array) with `shell:false`; shell argument text belongs in `args` with `shell:true`.');
            }
            if (typeof args === 'string' && args.includes('\0')) throw new Error('args must not contain null bytes');
            const sessionId = scope(input.sessionId);
            const timeoutMs = integer(input.timeout_ms, 30000, 1, MAX_TIMEOUT_MS, 'timeout_ms');
            const waitMs = integer(
                resolveWait(input, ['wait_ms', 'waitMs', 'WaitMsBeforeAsync'], 1000),
                1000,
                0,
                MAX_WAIT_MS,
                'wait_ms'
            );
            reserved.add(commandId);
            ownsReservation = true;
            const context = { ...await resolveContext({ ...input, sessionId }) };
            if (disposed) throw new Error('Console service is disposed');
            if (!context || typeof context.cwd !== 'string' || !path.isAbsolute(context.cwd)) throw new Error('Console context must resolve an absolute cwd');
            context.sessionId = scope(context.sessionId ?? sessionId);
            const entry = {
                id: commandId,
                completionEventId: `${commandId}:finished:${randomUUID()}`,
                command: shell ? `${input.command}${args ? ` ${args}` : ''}` : [input.command, ...args].map(value => JSON.stringify(value)).join(' '),
                context,
                shell,
                stdout: { text: '', start: 0, total: 0 },
                stderr: { text: '', start: 0, total: 0 },
                status: 'running', exitCode: null, signal: null, error: null, spawnError: null,
                startTime: now(), endTime: null, timeoutMs,
                stopReason: null, returnedRunning: false, observed: false, notified: false,
                process: null, hasSpawned: false, hasExited: false, completionEmitted: false,
            };
            entry.finished = new Promise(resolve => { entry.resolveFinished = resolve; });
            entries.set(commandId, entry);
            reserved.delete(commandId);
            try {
                const child = spawn(shell ? entry.command : input.command, shell ? [] : (args || []), {
                    cwd: context.cwd,
                    shell: shell ? (platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : true) : false,
                    windowsHide: true,
                    detached: platform !== 'win32',
                    stdio: ['ignore', 'pipe', 'pipe'],
                    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
                });
                entry.process = child;
                child.stdout?.setEncoding?.('utf8');
                child.stderr?.setEncoding?.('utf8');
                child.stdout?.on('data', data => append(entry.stdout, data));
                child.stderr?.on('data', data => append(entry.stderr, data));
                child.once('spawn', () => { entry.hasSpawned = true; });
                child.once('exit', () => { entry.hasExited = true; });
                child.once('close', (code, signal) => finish(entry, code, signal));
                child.on('error', error => {
                    if (entry.endTime !== null) return;
                    entry.error = error.message;
                    if (!entry.hasSpawned) entry.spawnError = { message: error.message, code: error.code ?? null, syscall: error.syscall ?? null };
                });
                entry.timeoutTimer = setTimeout(() => stop(entry, 'timed_out'), timeoutMs);
            } catch (error) {
                entry.error = error.message;
                entry.spawnError = { message: error.message, code: error.code ?? null, syscall: error.syscall ?? null };
                finish(entry, null, null);
            }
            await waitForClose(entry, waitMs);
            const result = snapshot(entry);
            if (result.status === 'running') entry.returnedRunning = true;
            else entry.observed = true;
            // Covers the narrow race where the child closes between the
            // snapshot above and marking the initial response as background.
            emitCompletion(entry);
            return result;
        } catch (error) {
            return { ...error.context, ok: false, error: error.message, errorCode: error.code ?? error.errorCode ?? null };
        } finally {
            if (ownsReservation) reserved.delete(commandId);
        }
    }

    async function manage(input = {}) {
        try {
            if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Task input must be an object');
            prune();
            const sessionId = scope(input.sessionId);
            // Supplying a wait window without an explicit action is naturally
            // interpreted as a wait request. Existing callers that omit both
            // continue to receive the immediate status snapshot.
            const action = input.action ?? ((input.wait_ms !== undefined || input.waitMs !== undefined) ? 'wait' : 'status');
            if (!['status', 'wait', 'list', 'terminate'].includes(action)) throw new Error('action must be status, wait, list or terminate');
            if (action === 'list') {
                return { ok: true, tasks: [...entries.values()].filter(entry => entry.context.sessionId === sessionId).map(summary) };
            }
            const entry = entries.get(input.commandId ?? input.id);
            if (!entry || entry.context.sessionId !== sessionId) throw new Error('Console task not found in this session');
            // Validate cursors before doing a destructive action or waiting.
            snapshot(entry, input);
            if (action === 'wait' || action === 'terminate') {
                const waitMs = integer(
                    resolveWait(input, ['wait_ms', 'waitMs'], 1000),
                    1000,
                    0,
                    MAX_WAIT_MS,
                    'wait_ms'
                );
                if (action === 'terminate') stop(entry, 'cancelled');
                await waitForClose(entry, waitMs);
            }
            const result = snapshot(entry, input);
            if (entry.endTime !== null) entry.observed = true;
            return result;
        } catch (error) {
            return { ok: false, error: error.message };
        }
    }

    function pollNotifications(input = {}) {
        prune();
        let sessionId;
        try { sessionId = scope(input?.sessionId); } catch { return []; }
        const notifications = [];
        for (const entry of entries.values()) {
            if (entry.context.sessionId === sessionId && entry.endTime !== null && entry.returnedRunning && !entry.observed && !entry.notified) {
                notifications.push(snapshot(entry));
                entry.notified = true;
            }
        }
        return notifications;
    }

    async function dispose() {
        disposed = true;
        const running = [...entries.values()].filter(entry => entry.endTime === null);
        for (const entry of running) stop(entry, 'cancelled');
        await Promise.all(running.map(entry => waitForClose(entry, 2000)));
    }

    return { run, manage, pollNotifications, dispose };
}

module.exports = { createConsoleService };
