const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const SafePathResolver = require('../electron/SafePathResolver.cjs');
const { handleListFiles } = require('../electron/agentActions.cjs');

test('native list_files walks nested directories and keeps relative paths unambiguous', async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'miku-list-files-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    await fs.mkdir(path.join(root, 'src', 'context'), { recursive: true });
    await fs.mkdir(path.join(root, 'node_modules', 'ignored'), { recursive: true });
    await fs.writeFile(path.join(root, 'src', 'PokerContext.jsx'), 'export default {};');
    await fs.writeFile(path.join(root, 'src', 'context', 'nested.ts'), 'export {};');
    await fs.writeFile(path.join(root, 'node_modules', 'ignored', 'package.js'), 'ignored');
    SafePathResolver.init({ '@WORKSPACE': root });

    const recursive = await handleListFiles(root, { recursive: true });
    assert.deepEqual(recursive.filter(entry => entry.path.includes('node_modules')), []);
    assert.ok(recursive.some(entry => entry.path === 'src/context'));
    assert.ok(recursive.some(entry => entry.path === 'src/context/nested.ts'));

    const shallow = await handleListFiles(root, { recursive: false });
    assert.ok(shallow.some(entry => entry.path === 'src'));
    assert.equal(shallow.some(entry => entry.path === 'src/context/nested.ts'), false);

    const subdirectory = await handleListFiles(root, { directory: 'src', recursive: true });
    assert.ok(subdirectory.some(entry => entry.path === 'src/context/nested.ts'));
});
