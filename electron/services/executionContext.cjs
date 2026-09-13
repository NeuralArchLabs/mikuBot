const fs = require('node:fs');
const path = require('node:path');

function contextError(message, code, context = {}) {
    const error = new Error(message);
    error.code = code;
    error.context = context;
    return error;
}

function isWithin(root, candidate) {
    const relative = path.relative(root, candidate);
    return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

function normalizedRoots(input) {
    return Object.fromEntries(Object.entries(input || {})
        .filter(([, value]) => typeof value === 'string' && value.trim() && path.isAbsolute(value))
        .map(([key, value]) => [key.toUpperCase(), path.resolve(value)]));
}

function resolvePathDetails(requestedPath, { roots, workspacePath }) {
    if (requestedPath !== undefined && requestedPath !== null && typeof requestedPath !== 'string') {
        throw contextError('Working directory must be a string.', 'INVALID_CWD');
    }
    const requested = (requestedPath || '').trim();
    const configuredRoots = normalizedRoots(roots);
    const scopeRoots = { ...configuredRoots, '@EXTRA': configuredRoots['@LIBRARY'], '@WORKSPACE': workspacePath, '@SANDBOX': workspacePath };
    let root = workspacePath;
    let relative = requested;
    if (requested.startsWith('@')) {
        const match = requested.match(/^(@[^\\/]+)(?:[\\/](.*))?$/s);
        root = scopeRoots[match?.[1].toUpperCase()];
        if (!root) throw contextError(`Unknown or unauthorized path prefix: ${match?.[1] || requested}`, 'INVALID_PATH_PREFIX');
        relative = match[2] || '';
    } else if (path.isAbsolute(requested)) {
        const cwd = path.resolve(requested);
        const allowedRoots = [...new Set([...Object.values(configuredRoots), workspacePath])]
            .filter(candidate => isWithin(candidate, cwd));
        if (!allowedRoots.length) throw contextError(`Working directory is outside all authorized roots: ${cwd}`, 'CWD_OUTSIDE_ROOT', { cwd });
        return { cwd, allowedRoots };
    }
    // Both slash styles occur in model-generated aliases on every platform.
    const cwd = path.resolve(root, relative.replace(/[\\/]/g, path.sep));
    if (!isWithin(root, cwd)) {
        throw contextError(`Working directory escapes its authorized root: ${cwd}`, 'CWD_OUTSIDE_ROOT', { cwd });
    }
    return { cwd, allowedRoots: [root] };
}

/** Resolve only the requested path; never rewrite shell command text. */
function resolveScopedPath(requestedPath, context) {
    return resolvePathDetails(requestedPath, context).cwd;
}

/**
 * Snapshot project ownership for this invocation. Global roots remain intact:
 * they also locate the project registry and serve standalone conversations.
 */
function createExecutionContextResolver({ getRoots, getProject }) {
    if (typeof getRoots !== 'function' || typeof getProject !== 'function') {
        throw new TypeError('getRoots and getProject are required.');
    }
    return async (input = {}) => {
        const roots = normalizedRoots(await getRoots());
        const projectId = typeof input.projectId === 'string' ? input.projectId.trim() || null : null;
        const sessionId = typeof input.sessionId === 'string' ? input.sessionId.trim() || null : null;
        let context = { projectId, sessionId, workspaceSource: projectId ? 'project' : 'default' };
        try {
            if (input.projectId != null && typeof input.projectId !== 'string') {
                throw contextError('Project id must be a string.', 'INVALID_PROJECT_ID');
            }
            const project = projectId ? await getProject(projectId) : null;
            if (projectId && !project) {
                throw contextError(`Project is not registered: ${projectId}. Select an available project or a standalone session.`, 'PROJECT_NOT_FOUND');
            }
            const selectedRoot = project ? project.path : roots['@WORKSPACE'];
            if (typeof selectedRoot !== 'string' || !selectedRoot.trim() || !path.isAbsolute(selectedRoot)) {
                throw contextError(projectId ? 'The registered project has no valid absolute path.' : 'The default workspace is not configured.', 'WORKSPACE_NOT_CONFIGURED');
            }
            const workspacePath = path.resolve(selectedRoot);
            context = { ...context, workspacePath, projectName: project ? project.name || null : null };
            if (input.expectedWorkspacePath !== undefined) {
                const expected = input.expectedWorkspacePath;
                if (typeof expected !== 'string' || !path.isAbsolute(expected) || path.relative(workspacePath, path.resolve(expected)) !== '') {
                    throw contextError('The workspace changed since this turn started. Refresh the session context before executing commands.', 'WORKSPACE_CONTEXT_CHANGED', { expectedWorkspacePath: expected });
                }
            }
            const { cwd, allowedRoots } = resolvePathDetails(input.cwd, { roots, workspacePath });
            context = { ...context, cwd };
            const stat = await fs.promises.stat(cwd);
            if (!stat.isDirectory()) throw contextError(`Working directory is not a directory: ${cwd}`, 'CWD_NOT_DIRECTORY');
            // A relative path must remain within its scope even through a junction
            // or symlink; absolute paths may use any explicitly authorized root.
            const realCwd = await fs.promises.realpath(cwd);
            const realRoots = await Promise.all(allowedRoots.map(async root => {
                try { return await fs.promises.realpath(root); } catch { return null; }
            }));
            if (!realRoots.some(root => root && isWithin(root, realCwd))) {
                throw contextError(`Working directory resolves outside its authorized root: ${cwd}`, 'CWD_OUTSIDE_ROOT');
            }
            return context;
        } catch (error) {
            error.context = { ...context, ...(error.context || {}) };
            if (error.code === 'ENOENT') {
                error.message = `Working directory does not exist: ${context.cwd || context.workspacePath || input.cwd || ''}`;
                error.code = 'CWD_NOT_FOUND';
            }
            throw error;
        }
    };
}

async function fileEvidence(filePath, expectedKind) {
    try {
        const stat = await fs.promises.stat(filePath);
        const kind = stat.isDirectory() ? 'directory' : stat.isFile() ? 'file' : 'other';
        return { path: filePath, exists: true, kind, matchesExpectedKind: kind === expectedKind };
    } catch (error) {
        return { path: filePath, exists: false, ...(error.code === 'ENOENT' ? {} : { error: error.message }) };
    }
}

/** Read-only preflight evidence for the same effective directory as run_console. */
async function inspectProjectContext(input, resolver) {
    let context;
    try {
        context = await resolver(input);
        const entries = [];
        let entriesTruncated = false;
        const directory = await fs.promises.opendir(context.cwd);
        for await (const item of directory) {
            if (entries.length === 50) { entriesTruncated = true; break; }
            entries.push({ name: item.name, type: item.isDirectory() ? 'directory' : item.isFile() ? 'file' : item.isSymbolicLink() ? 'symlink' : 'other' });
        }
        entries.sort((left, right) => left.name.localeCompare(right.name));
        const packagePath = path.join(context.cwd, 'package.json');
        const packageJson = { path: packagePath, exists: false, valid: false, name: null, scripts: {}, dependencies: 0, devDependencies: 0 };
        try {
            const stat = await fs.promises.stat(packagePath);
            packageJson.exists = true;
            if (!stat.isFile()) throw new Error('package.json is not a regular file.');
            if (stat.size > 1024 * 1024) throw new Error('package.json exceeds the 1 MiB inspection limit.');
            const manifest = JSON.parse(await fs.promises.readFile(packagePath, 'utf8'));
            if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('package.json must contain an object.');
            packageJson.valid = true;
            packageJson.name = typeof manifest.name === 'string' ? manifest.name : null;
            if (manifest.scripts && typeof manifest.scripts === 'object' && !Array.isArray(manifest.scripts)) {
                packageJson.scripts = Object.fromEntries(Object.entries(manifest.scripts).filter(([, value]) => typeof value === 'string'));
            }
            for (const key of ['dependencies', 'devDependencies']) {
                if (manifest[key] && typeof manifest[key] === 'object' && !Array.isArray(manifest[key])) packageJson[key] = Object.keys(manifest[key]).length;
            }
        } catch (error) {
            if (error.code !== 'ENOENT') packageJson.error = error.message;
        }
        const nodeModules = await fileEvidence(path.join(context.cwd, 'node_modules'), 'directory');
        const lockNames = ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'];
        const locks = await Promise.all(lockNames.map(async name => ({ name, ...await fileEvidence(path.join(context.cwd, name), 'file') })));
        return {
            ok: true, ...context, exists: true, entries, entriesTruncated, packageJson,
            dependencyState: {
                nodeModules,
                lockfiles: locks.filter(lock => lock.exists || lock.error),
                verified: false,
                note: 'Filesystem evidence only. Dependency installation, versions, and build success have not been verified.'
            }
        };
    } catch (error) {
        return { ok: false, ...(context || error.context || {}), error: error.message, errorCode: error.code || 'PROJECT_INSPECTION_FAILED' };
    }
}

module.exports = { createExecutionContextResolver, resolveScopedPath, inspectProjectContext };
