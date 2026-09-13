const { createConsoleService } = require('./consoleService.cjs');
const { createExecutionContextResolver, inspectProjectContext } = require('./executionContext.cjs');
const path = require('node:path');

function isWithin(root, candidate) {
    if (!root || !candidate) return false;
    const relative = path.relative(path.resolve(root), path.resolve(candidate));
    return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

function aliasPath(value, workspacePath, roots) {
    if (typeof value !== 'string' || !path.isAbsolute(value)) return value;
    const absolute = path.resolve(value);
    if (workspacePath && isWithin(workspacePath, absolute)) {
        const relative = path.relative(path.resolve(workspacePath), absolute).replace(/\\/g, '/');
        return relative ? `@WORKSPACE/${relative}` : '@WORKSPACE';
    }
    for (const [prefix, root] of Object.entries(roots || {})) {
        if (!prefix.startsWith('@') || typeof root !== 'string' || !path.isAbsolute(root) || !isWithin(root, absolute)) continue;
        const relative = path.relative(path.resolve(root), absolute).replace(/\\/g, '/');
        return relative ? `${prefix}/${relative}` : prefix;
    }
    return '@HOST_PATH';
}

function redactPathText(value, workspacePath, roots) {
    if (typeof value !== 'string') return value;
    const candidates = [];
    if (workspacePath && path.isAbsolute(workspacePath)) candidates.push([workspacePath, '@WORKSPACE']);
    for (const [prefix, root] of Object.entries(roots || {})) {
        if (prefix.startsWith('@') && typeof root === 'string' && path.isAbsolute(root)) candidates.push([root, prefix]);
    }
    return candidates
        .sort((left, right) => right[0].length - left[0].length)
        .reduce((text, [physical, alias]) => {
            const escaped = physical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const slashEscaped = physical.replace(/\\/g, '/').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return text
                .replace(new RegExp(escaped, 'gi'), alias)
                .replace(new RegExp(slashEscaped, 'gi'), alias);
        }, value);
}

function publicizeConsoleResult(result, roots = {}) {
    if (!result || typeof result !== 'object') return result;
    const workspacePath = result.workspacePath;
    const publicResult = { ...result };
    if (publicResult.cwd) publicResult.cwd = aliasPath(publicResult.cwd, workspacePath, roots);
    if (publicResult.workspacePath) publicResult.workspacePath = '@WORKSPACE';
    if (publicResult.error) publicResult.error = redactPathText(publicResult.error, workspacePath, roots);
    if (publicResult.spawnError?.message) {
        publicResult.spawnError = { ...publicResult.spawnError, message: redactPathText(publicResult.spawnError.message, workspacePath, roots) };
    }
    if (publicResult.context && typeof publicResult.context === 'object') {
        publicResult.context = publicizeConsoleResult(publicResult.context, roots);
    }
    return publicResult;
}

function publicizeProjectStatus(result, roots = {}) {
    const publicResult = publicizeConsoleResult(result, roots);
    if (!publicResult || typeof publicResult !== 'object') return publicResult;
    const workspacePath = result?.workspacePath;
    if (publicResult.packageJson?.path) {
        publicResult.packageJson = { ...publicResult.packageJson, path: aliasPath(publicResult.packageJson.path, workspacePath, roots) };
    }
    if (publicResult.dependencyState) {
        const dependencyState = { ...publicResult.dependencyState };
        if (dependencyState.nodeModules?.path) {
            dependencyState.nodeModules = { ...dependencyState.nodeModules, path: aliasPath(dependencyState.nodeModules.path, workspacePath, roots) };
        }
        if (Array.isArray(dependencyState.lockfiles)) {
            dependencyState.lockfiles = dependencyState.lockfiles.map(lock => ({
                ...lock,
                ...(lock.path ? { path: aliasPath(lock.path, workspacePath, roots) } : {})
            }));
        }
        publicResult.dependencyState = dependencyState;
    }
    return publicResult;
}

function registerConsoleIpc({ app, ipcMain, getMainWindow, getRoots, getProject }) {
    const resolveContext = createExecutionContextResolver({ getRoots, getProject });
    const roots = () => (typeof getRoots === 'function' ? getRoots() || {} : {});
    const service = createConsoleService({
        resolveContext,
        onComplete: result => {
            const sender = getMainWindow()?.webContents;
            if (!sender || typeof sender.send !== 'function' || sender.isDestroyed?.()) return;
            // This event is a live UI signal. The polling endpoint remains the
            // durable agent-facing delivery path and is intentionally untouched.
            sender.send('console-process-complete', publicizeConsoleResult(result, roots()));
        }
    });
    const handle = (channel, action) => ipcMain.handle(channel, (event, input = {}) => {
        if (event.sender !== getMainWindow()?.webContents || event.senderFrame !== event.sender.mainFrame) {
            return { ok: false, error: 'Console tools are only available from the main Miku window.' };
        }
        return action(input);
    });
    const formatConsolePromise = promise => Promise.resolve(promise).then(result => publicizeConsoleResult(result, roots()));
    handle('run-console', input => formatConsolePromise(service.run(input)));
    handle('manage-task', input => formatConsolePromise(service.manage(input)));
    handle('run-console-status', input => formatConsolePromise(service.manage({ ...input, action: 'status' })));
    handle('run-console-terminate', input => formatConsolePromise(service.manage({ ...input, action: 'terminate' })));
    handle('poll-console-notifications', input => service.pollNotifications(input).map(result => publicizeConsoleResult(result, roots())));
    handle('project-status', input => formatConsolePromise(inspectProjectContext(input, resolveContext).then(result => publicizeProjectStatus(result, roots()))));
    app.on('before-quit', () => { void service.dispose(); });
    return service;
}

module.exports = { registerConsoleIpc, aliasPath, publicizeConsoleResult, publicizeProjectStatus };
