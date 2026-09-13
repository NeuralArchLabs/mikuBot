const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const { registerConsoleIpc } = require('../electron/services/consoleIpc.cjs');

test('main process registers console IPC against the actual main window variable', async () => {
    const mainSource = await fs.readFile(path.join(__dirname, '..', 'electron', 'main.cjs'), 'utf8');
    assert.match(mainSource, /registerConsoleIpc\(\{[\s\S]*?getMainWindow:\s*\(\)\s*=>\s*mainWin/);
    assert.doesNotMatch(mainSource, /registerConsoleIpc\(\{[\s\S]*?getMainWindow:\s*\(\)\s*=>\s*mainWindow/);
});

test('IPC routes project and standalone execution, inspection, legacy status and session isolation', async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'miku-console-ipc-'));
    const workspace = path.join(root, 'workspace');
    const project = path.join(root, 'PkerAPP');
    await fs.mkdir(workspace);
    await fs.mkdir(project);
    await fs.writeFile(path.join(project, 'package.json'), JSON.stringify({ name: 'pker-test', scripts: { build: 'example only' } }));
    const handlers = new Map();
    const app = new EventEmitter();
    const events = [];
    const sender = { mainFrame: {}, send: (channel, payload) => events.push({ channel, payload }) };
    const event = { sender, senderFrame: sender.mainFrame };
    let configuredWorkspace = workspace;
    const service = registerConsoleIpc({ app, ipcMain: { handle: (name, action) => handlers.set(name, action) },
        getMainWindow: () => ({ webContents: sender }), getRoots: () => ({ '@WORKSPACE': configuredWorkspace }),
        getProject: id => id === 'pker' ? { id, path: project, name: 'PkerAPP' } : null });
    t.after(async () => { await service.dispose(); await fs.rm(root, { recursive: true, force: true }); });
    const call = (name, input) => handlers.get(name)(event, input);
    const base = { command: process.execPath, args: ['-e', 'process.stdout.write(process.cwd())'], shell: false, cwd: '@WORKSPACE', WaitMsBeforeAsync: 5000 };
    const [projectResult, standalone] = await Promise.all([
        call('run-console', { ...base, projectId: 'pker', sessionId: 'pker-session' }),
        call('run-console', { ...base, sessionId: 'standalone-session' })
    ]);
    assert.equal(projectResult.success, true);
    assert.equal(projectResult.cwd, '@WORKSPACE');
    assert.equal(projectResult.workspacePath, '@WORKSPACE');
    assert.equal(projectResult.stdout, project);
    assert.equal(standalone.cwd, '@WORKSPACE');
    assert.equal(standalone.stdout, workspace);
    const inspection = await call('project-status', { projectId: 'pker', sessionId: 'pker-session' });
    assert.equal(inspection.cwd, projectResult.cwd);
    assert.equal(inspection.workspacePath, '@WORKSPACE');
    assert.equal(inspection.packageJson.path, '@WORKSPACE/package.json');
    assert.equal(inspection.packageJson.name, 'pker-test');
    const status = await call('run-console-status', { commandId: projectResult.commandId, sessionId: 'pker-session' });
    assert.equal(status.exitCode, 0);
    assert.equal(status.eventId, projectResult.eventId);
    assert.equal((await call('manage-task', { action: 'status', commandId: projectResult.commandId, sessionId: 'standalone-session' })).ok, false);
    assert.deepEqual(await call('poll-console-notifications', { sessionId: 'pker-session' }), []);
    const missing = await call('run-console', { ...base, projectId: 'removed-project' });
    assert.equal(missing.ok, false);
    assert.match(missing.error, /not registered/);
    const denied = await handlers.get('run-console')({ ...event, senderFrame: {} }, base);
    assert.equal(denied.ok, false);
    const changedWorkspace = path.join(root, 'new-workspace');
    await fs.mkdir(changedWorkspace);
    configuredWorkspace = changedWorkspace;
    const changed = await call('run-console', { ...base, expectedWorkspacePath: changedWorkspace, sessionId: 'new-session' });
    assert.equal(changed.cwd, '@WORKSPACE');
    const stale = await call('run-console', { ...base, expectedWorkspacePath: workspace, sessionId: 'old-session' });
    assert.equal(stale.ok, false);
    assert.equal(stale.errorCode, 'WORKSPACE_CONTEXT_CHANGED');
    // Existing task identity and cwd do not follow later configuration changes.
    const original = await call('run-console-status', { commandId: standalone.commandId, sessionId: 'standalone-session' });
    assert.equal(original.cwd, '@WORKSPACE');

    const background = await call('run-console', {
        command: process.execPath,
        args: ['-e', 'setTimeout(() => process.stdout.write("event"), 30)'],
        shell: false,
        WaitMsBeforeAsync: 0,
        projectId: 'pker',
        sessionId: 'pker-session'
    });
    assert.equal(background.status, 'running');
    const backgroundDone = await call('manage-task', { action: 'wait', commandId: background.commandId, sessionId: 'pker-session', waitMs: 2000 });
    assert.equal(backgroundDone.status, 'completed');
    const completionEvent = events.find(event => event.channel === 'console-process-complete' && event.payload.commandId === background.commandId);
    assert.ok(completionEvent, 'background completion is also sent to the renderer');
    assert.equal(completionEvent.payload.cwd, '@WORKSPACE');
    assert.equal(completionEvent.payload.stdout, 'event');
});
