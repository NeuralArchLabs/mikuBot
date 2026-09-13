import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePathAndSource, resolveDirectoryPathAndSource } from '../src/services/core/agent/utils.ts';

const projectConfig = { folderPaths: { workSpace: 'E:/apps/PkerAPP', core: 'E:/miku/core', extra: 'E:/miku/library', tools: 'E:/miku/commands', root: 'E:/miku' } };

test('file and directory aliases select the same project root with either slash style', () => {
    for (const resolve of [resolvePathAndSource, resolveDirectoryPathAndSource]) {
        for (const requested of ['@WORKSPACE/src/file.ts', '@workspace\\src\\file.ts', '@SANDBOX\\src/file.ts']) {
            assert.deepEqual(resolve(requested, undefined, projectConfig), { target: 'workSpace', cleanFilename: 'src/file.ts' });
        }
        assert.deepEqual(resolve('@WORKSPACE', undefined, projectConfig), { target: 'workSpace', cleanFilename: '' });
        assert.deepEqual(resolve('@CORE\\RULES.md', 'workspace', projectConfig), { target: 'core', cleanFilename: 'RULES.md' });
        assert.deepEqual(resolve('@EXTRA\\notes', undefined, projectConfig), { target: 'extra', cleanFilename: 'notes' });
    }
});

test('list/search directory selectors resolve absolute project routes and explicit alternate roots', () => {
    assert.deepEqual(resolveDirectoryPathAndSource('E:\\apps\\PkerAPP', undefined, projectConfig), { target: 'workSpace', cleanFilename: '' });
    assert.deepEqual(resolveDirectoryPathAndSource('e:\\apps\\pkerapp\\src', undefined, projectConfig), { target: 'workSpace', cleanFilename: 'src' });
    assert.deepEqual(resolveDirectoryPathAndSource('E:/miku/library/docs', undefined, projectConfig), { target: 'extra', cleanFilename: 'docs' });
    assert.deepEqual(resolveDirectoryPathAndSource('@TOOLS/skills', undefined, projectConfig), { target: 'tools', cleanFilename: 'skills' });
});

test('standalone workspace selection does not inherit the previously resolved project', () => {
    const genericConfig = { folderPaths: { ...projectConfig.folderPaths, workSpace: 'E:/miku/workspace' } };
    for (const config of [projectConfig, genericConfig, projectConfig]) {
        const file = resolvePathAndSource('@WORKSPACE\\package.json', undefined, config);
        assert.equal(`${config.folderPaths[file.target]}/${file.cleanFilename}`, `${config.folderPaths.workSpace}/package.json`);
    }
});

test('directory selector compatibility keeps naked shortcuts and explicit sources', () => {
    assert.deepEqual(resolveDirectoryPathAndSource('workspace/src', undefined, projectConfig), { target: 'workSpace', cleanFilename: 'src' });
    assert.deepEqual(resolveDirectoryPathAndSource('core\\rules', undefined, projectConfig), { target: 'core', cleanFilename: 'rules' });
    assert.deepEqual(resolveDirectoryPathAndSource('core\\rules', 'workspace', projectConfig), { target: 'workSpace', cleanFilename: 'core/rules' });
    assert.deepEqual(resolveDirectoryPathAndSource('src', undefined, projectConfig), { target: 'workSpace', cleanFilename: 'src' });
});
