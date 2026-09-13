const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createExecutionContextResolver, inspectProjectContext } = require('../electron/services/executionContext.cjs');

async function fixture(t) {
    const temporaryRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'miku-execution-context-'));
    t.after(() => fs.promises.rm(temporaryRoot, { recursive: true, force: true }));
    const generic = path.join(temporaryRoot, 'generic');
    const external = path.join(temporaryRoot, 'external-project');
    const core = path.join(temporaryRoot, 'core');
    for (const folder of [generic, external, core, path.join(external, 'src')]) await fs.promises.mkdir(folder, { recursive: true });
    const roots = { '@WORKSPACE': generic, '@CORE': core };
    const projects = { pker: { id: 'pker', name: 'PkerAPP', path: external } };
    const resolver = createExecutionContextResolver({ getRoots: () => roots, getProject: id => projects[id] });
    return { temporaryRoot, generic, external, core, roots, projects, resolver };
}

test('project cwd defaults and workspace aliases resolve identically without mutating global roots', async t => {
    const { resolver, external, generic, roots } = await fixture(t);
    for (const cwd of [undefined, '', '@WORKSPACE', '@workspace', '@SANDBOX', '@sandbox/']) {
        const result = await resolver({ projectId: 'pker', sessionId: 'session-project', cwd });
        assert.equal(result.cwd, external);
        assert.equal(result.workspacePath, external);
        assert.equal(result.projectId, 'pker');
        assert.equal(result.projectName, 'PkerAPP');
        assert.equal(result.workspaceSource, 'project');
    }
    assert.equal(roots['@WORKSPACE'], generic);
    assert.equal((await resolver({ sessionId: 'standalone' })).cwd, generic);
    assert.equal((await resolver({ cwd: '@WORKSPACE' })).workspaceSource, 'default');
});

test('nested aliases and relative cwd use project scope; explicit other roots remain available', async t => {
    const { resolver, external, generic, core, roots } = await fixture(t);
    roots['@LIBRARY'] = core;
    for (const cwd of ['src', './src', '@workspace/src', '@WORKSPACE\\src', '@sandbox/src']) {
        assert.equal((await resolver({ projectId: 'pker', cwd })).cwd, path.join(external, 'src'));
    }
    assert.equal((await resolver({ projectId: 'pker', cwd: '@core' })).cwd, core);
    assert.equal((await resolver({ projectId: 'pker', cwd: '@extra' })).cwd, core);
    assert.equal((await resolver({ projectId: 'pker', cwd: generic })).cwd, generic);
    assert.equal((await resolver({ projectId: 'pker', cwd: external })).cwd, external);
});

test('unknown project fails closed even when an explicit global cwd is provided', async t => {
    const { resolver, generic } = await fixture(t);
    for (const cwd of [undefined, '@WORKSPACE', generic]) {
        await assert.rejects(resolver({ projectId: 'deleted', sessionId: 'owned-session', cwd }), error => {
            assert.equal(error.code, 'PROJECT_NOT_FOUND');
            assert.equal(error.context.projectId, 'deleted');
            assert.equal(error.context.sessionId, 'owned-session');
            return true;
        });
    }
});

test('concurrent project and standalone calls keep their own cwd and identity', async t => {
    const { roots, projects, external, generic } = await fixture(t);
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const resolver = createExecutionContextResolver({ getRoots: () => roots, getProject: async id => { await gate; return projects[id]; } });
    const projectRun = resolver({ projectId: 'pker', sessionId: 'A', cwd: '@WORKSPACE' });
    const standalone = await resolver({ sessionId: 'B', cwd: '@WORKSPACE' });
    release();
    const project = await projectRun;
    assert.equal(project.cwd, external);
    assert.equal(project.sessionId, 'A');
    assert.equal(standalone.cwd, generic);
    assert.equal(standalone.sessionId, 'B');
    assert.equal(standalone.projectId, null);
});

test('invalid cwd and traversal fail with actionable context', async t => {
    const { resolver, external, temporaryRoot } = await fixture(t);
    await fs.promises.writeFile(path.join(external, 'file.txt'), 'text');
    const scenarios = [
        ['@WORKSPACE/../generic', 'CWD_OUTSIDE_ROOT'],
        ['../generic', 'CWD_OUTSIDE_ROOT'],
        [temporaryRoot, 'CWD_OUTSIDE_ROOT'],
        ['@MISSING', 'INVALID_PATH_PREFIX'],
        ['missing', 'CWD_NOT_FOUND'],
        ['file.txt', 'CWD_NOT_DIRECTORY'],
        [123, 'INVALID_CWD']
    ];
    for (const [cwd, code] of scenarios) {
        await assert.rejects(resolver({ projectId: 'pker', cwd }), error => error.code === code && error.context.workspacePath === external);
    }
});

test('a relative junction or symlink cannot escape the workspace', async t => {
    const { resolver, external, generic } = await fixture(t);
    await fs.promises.symlink(generic, path.join(external, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(resolver({ projectId: 'pker', cwd: '@WORKSPACE/escape' }), { code: 'CWD_OUTSIDE_ROOT' });
});

test('missing project folders and unconfigured standalone workspace do not use process cwd', async t => {
    const { roots, projects, temporaryRoot } = await fixture(t);
    projects.gone = { id: 'gone', name: 'Gone', path: path.join(temporaryRoot, 'removed') };
    const resolver = createExecutionContextResolver({ getRoots: () => roots, getProject: id => projects[id] });
    await assert.rejects(resolver({ projectId: 'gone' }), { code: 'CWD_NOT_FOUND' });
    delete roots['@WORKSPACE'];
    await assert.rejects(resolver({}), { code: 'WORKSPACE_NOT_CONFIGURED' });
});

test('expected workspace validates the captured file context and never overrides registered roots', async t => {
    const { resolver, generic, external } = await fixture(t);
    assert.equal((await resolver({ projectId: 'pker', expectedWorkspacePath: `${external}${path.sep}` })).cwd, external);
    assert.equal((await resolver({ expectedWorkspacePath: generic })).cwd, generic);
    if (process.platform === 'win32') assert.equal((await resolver({ projectId: 'pker', expectedWorkspacePath: external.toUpperCase() })).cwd, external);
    for (const expectedWorkspacePath of [generic, 'relative', '', 123, null]) {
        await assert.rejects(resolver({ projectId: 'pker', expectedWorkspacePath, cwd: '@CORE' }), error => {
            assert.equal(error.code, 'WORKSPACE_CONTEXT_CHANGED');
            assert.equal(error.context.workspacePath, external);
            assert.equal(error.context.expectedWorkspacePath, expectedWorkspacePath);
            return true;
        });
    }
    await assert.rejects(resolver({ expectedWorkspacePath: external }), { code: 'WORKSPACE_CONTEXT_CHANGED' });
});

test('project_status inspects manifest and evidence without asserting installed dependencies', async t => {
    const { resolver, external } = await fixture(t);
    await fs.promises.writeFile(path.join(external, 'package.json'), JSON.stringify({ name: 'pker-app', scripts: { build: 'vite build', invalid: 1 }, dependencies: { react: '1' }, devDependencies: { vite: '2', typescript: '3' } }));
    await fs.promises.writeFile(path.join(external, 'pnpm-lock.yaml'), 'lockfileVersion: 9');
    await fs.promises.mkdir(path.join(external, 'node_modules'));
    const result = await inspectProjectContext({ projectId: 'pker' }, resolver);
    assert.equal(result.ok, true);
    assert.equal(result.cwd, external);
    assert.equal(result.packageJson.valid, true);
    assert.equal(result.packageJson.name, 'pker-app');
    assert.deepEqual(result.packageJson.scripts, { build: 'vite build' });
    assert.equal(result.packageJson.dependencies, 1);
    assert.equal(result.packageJson.devDependencies, 2);
    assert.equal(result.dependencyState.nodeModules.matchesExpectedKind, true);
    assert.deepEqual(result.dependencyState.lockfiles.map(lock => lock.name), ['pnpm-lock.yaml']);
    assert.equal(result.dependencyState.verified, false);
});

test('project_status supports non-Node projects, malformed manifests, bounded entries and missing projects', async t => {
    const { resolver, external } = await fixture(t);
    let result = await inspectProjectContext({ projectId: 'pker' }, resolver);
    assert.equal(result.ok, true);
    assert.equal(result.packageJson.exists, false);
    assert.equal(result.packageJson.valid, false);
    assert.equal(result.packageJson.error, undefined);
    await fs.promises.writeFile(path.join(external, 'package.json'), '{broken');
    await Promise.all(Array.from({ length: 55 }, (_, index) => fs.promises.writeFile(path.join(external, `entry-${index}`), '')));
    result = await inspectProjectContext({ projectId: 'pker' }, resolver);
    assert.equal(result.ok, true);
    assert.equal(result.packageJson.exists, true);
    assert.equal(result.packageJson.valid, false);
    assert.ok(result.packageJson.error);
    assert.equal(result.entries.length, 50);
    assert.equal(result.entriesTruncated, true);
    const unknown = await inspectProjectContext({ projectId: 'missing' }, resolver);
    assert.equal(unknown.ok, false);
    assert.equal(unknown.errorCode, 'PROJECT_NOT_FOUND');
    assert.equal(unknown.projectId, 'missing');
});
