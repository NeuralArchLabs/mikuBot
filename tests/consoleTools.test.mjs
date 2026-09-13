import test from 'node:test';
import assert from 'node:assert/strict';
import { executeConsoleTool, consoleToolResult, hasConsoleCompletion, consoleCompletionKey } from '../src/services/core/agent/consoleTools.ts';
import { CONSOLE_TOOLS } from '../src/constants/consoleTools.ts';
import { resolvePathAndSource } from '../src/services/core/agent/utils.ts';

const config = { executionContext: { projectId: 'pker', sessionId: 'session-pker' }, folderPaths: { workSpace: 'E:/apps/PkerAPP' } };

test('console forwards session ownership independently of model cwd and forged scope', async () => {
    let input;
    await executeConsoleTool('run_console', { command: 'npm', args: 'run build', cwd: '@WORKSPACE', projectId: 'other', sessionId: 'other', WaitMsBeforeAsync: 0 }, config, 'session-pker', {
        runConsole: async data => { input = data; return { ok: true, status: 'running', success: null }; }
    });
    assert.equal(input.projectId, 'pker');
    assert.equal(input.sessionId, 'session-pker');
    assert.equal(input.cwd, '@WORKSPACE');
    assert.equal(input.WaitMsBeforeAsync, 0);
    const file = resolvePathAndSource('@WORKSPACE/package.json', undefined, config);
    assert.equal(`${config.folderPaths[file.target]}/${file.cleanFilename}`, 'E:/apps/PkerAPP/package.json');
});

test('wait_ms keeps run_console response open and legacy aliases stay compatible', async () => {
    let input;
    await executeConsoleTool('run_console', { command: 'node', wait_ms: 2400 }, config, 'session-pker', {
        runConsole: async data => { input = data; return { ok: true, status: 'running', success: null }; }
    });
    assert.equal(input.wait_ms, 2400);
    assert.equal(input.WaitMsBeforeAsync, 2400);

    const conflict = await executeConsoleTool('run_console', { command: 'node', wait_ms: 1000, waitMs: 2000 }, config, 'session-pker', {
        runConsole: async () => { throw new Error('must not execute conflicting options'); }
    });
    assert.equal(conflict.success, false);
    assert.match(conflict.error, /only one wait option/i);
});

test('direct arguments preserve spaces, quotes and metacharacters', async () => {
    const argv = ['file with spaces', '$HOME', 'x&y', '"quoted"'];
    let input;
    await executeConsoleTool('run_console', { command: 'C:/Program Files/node/node.exe', shell: false, argv }, config, 'session-pker', {
        runConsole: async data => { input = data; return { ok: true }; }
    });
    assert.equal(input.command, 'C:/Program Files/node/node.exe');
    assert.deepEqual(input.args, argv);
    const invalid = await executeConsoleTool('run_console', { command: 'node', argv }, config, 'session-pker', { runConsole() { assert.fail('must not execute'); } });
    assert.equal(invalid.success, false);
});

test('standalone sessions send no project identity and let backend use configured workspace', async () => {
    let input;
    await executeConsoleTool('run_console', { command: 'pwd' }, { folderPaths: { workSpace: 'E:/generic' } }, 'standalone', {
        runConsole: async data => { input = data; return { ok: true }; }
    });
    assert.equal(input.projectId, null);
    assert.equal(input.sessionId, 'standalone');
    assert.equal(input.cwd, undefined);
});

test('failed process is a successful query with its exit code and complete diagnostics intact', () => {
    const data = { ok: true, success: false, status: 'failed', exitCode: 23, cwd: 'E:/apps/PkerAPP', stdout: 'out', stderr: 'err', durationMs: 12, commandId: 'cmd-23' };
    assert.deepEqual(consoleToolResult(data), { success: true, data });
    assert.equal(consoleToolResult({ ok: false, error: 'Unknown command' }).success, false);
});

test('legacy status alias always queries status with the originating session and cursors', async () => {
    let input;
    await executeConsoleTool('get_console_status', { action: 'terminate', commandId: 'cmd-1', stdoutCursor: 10 }, config, 'session-pker', {
        manageTask: async data => { input = data; return { ok: true }; }
    });
    assert.equal(input.action, 'status');
    assert.equal(input.stdoutCursor, 10);
    assert.equal(input.sessionId, 'session-pker');
});

test('manage_task forwards wait_ms as a bounded response wait', async () => {
    let input;
    await executeConsoleTool('manage_task', { commandId: 'cmd-1', wait_ms: 3500 }, config, 'session-pker', {
        manageTask: async data => { input = data; return { ok: true, status: 'running' }; }
    });
    assert.equal(input.action, 'wait');
    assert.equal(input.wait_ms, 3500);
});

test('completion correlation uses commandId and terminal state, not model tool_call_id', () => {
    const note = { commandId: 'cmd-1', eventId: 'cmd-1:finished' };
    const message = data => ({ role: 'tool', tool_call_id: 'model-generated-call', content: JSON.stringify({ success: true, data }) });
    assert.equal(hasConsoleCompletion([message({ commandId: 'cmd-1', status: 'running' })], note), false);
    assert.equal(hasConsoleCompletion([message({ commandId: 'cmd-1', status: 'failed', exitCode: 23 })], note), true);
    assert.equal(hasConsoleCompletion([{ role: 'user', consoleEventId: note.eventId }], note), true);
    assert.equal(hasConsoleCompletion([message({ commandId: 'cmd-1', eventId: 'older-run:finished', status: 'completed' })], note), false);
});

test('completion identity prefers eventId and falls back to commandId', () => {
    assert.equal(consoleCompletionKey({ commandId: 'cmd-1', eventId: 'cmd-1:finished:1' }), 'event:cmd-1:finished:1');
    assert.equal(consoleCompletionKey({ commandId: 'cmd-1' }), 'command:cmd-1');
    assert.equal(consoleCompletionKey({}), null);
});

test('tool definitions expose management, compatibility monitoring and project preflight', () => {
    assert.deepEqual(CONSOLE_TOOLS.map(tool => tool.function.name), ['run_console', 'manage_task', 'get_console_status', 'project_status']);
    assert.equal(CONSOLE_TOOLS[0].function.parameters.properties.argv.items.type, 'string');
});
