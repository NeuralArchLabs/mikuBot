import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const appAst = ts.createSourceFile('App.tsx', appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let processMessage;
function findProcessMessage(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'processMessage') {
        processMessage = node.initializer?.arguments?.[0];
    }
    ts.forEachChild(node, findProcessMessage);
}
findProcessMessage(appAst);
assert.ok(processMessage && ts.isArrowFunction(processMessage) && ts.isBlock(processMessage.body));

// Run the actual inference/fallback, catch, finally and return from App. Prompt
// preparation and React rendering are outside this regression's scope, so the
// harness supplies their resulting state and replaces the inference transport.
// Keeping the real finally is essential: its former return swallowed failures.
const lifecycleIndex = processMessage.body.statements.findIndex(node => ts.isTryStatement(node) && node.finallyBlock);
assert.ok(lifecycleIndex >= 0, 'processMessage must have an execution lifecycle');
const lifecycle = processMessage.body.statements[lifecycleIndex];
const inferenceIndex = lifecycle.tryBlock.statements.findIndex(node => ts.isTryStatement(node)
    && node.tryBlock.statements.some(statement => ts.isExpressionStatement(statement)
        && ts.isAwaitExpression(statement.expression)
        && ts.isCallExpression(statement.expression.expression)
        && statement.expression.expression.expression.getText(appAst) === 'runInference'));
assert.ok(inferenceIndex >= 0, 'processMessage must await inference within its lifecycle');
const executableLifecycle = ts.factory.updateTryStatement(lifecycle,
    ts.factory.createBlock(lifecycle.tryBlock.statements.slice(inferenceIndex), true),
    lifecycle.catchClause, lifecycle.finallyBlock);
const printer = ts.createPrinter();
const actualStatements = [executableLifecycle, ...processMessage.body.statements.slice(lifecycleIndex + 1)]
    .map(node => printer.printNode(ts.EmitHint.Unspecified, node, appAst)).join('\n');

const moduleSource = `
const executeLifecycle = async (harness) => {
    const isScheduled = harness.scheduled;
    const ctx = { isScheduled, isRemote: false };
    const ctxSessionId = 'session-test';
    const modelMsgId = 'answer-test';
    const sessions = [{ id: ctxSessionId, title: 'Test session' }];
    const stateRef = { current: { sessionId: ctxSessionId } };
    const currentState = { config: { provider: 'master', model: 'master-model' } };
    const effectiveProvider = 'primary';
    const effectiveModel = 'primary-model';
    const effectiveConfig = { provider: effectiveProvider, model: effectiveModel };
    const hasMasterFallback = harness.fallback;
    const useAgentEngine = false;
    let finalAssistantText = '';
    let finalHistory = [];
    let localMessages = [...harness.messages];
    const useAgentStore = { getState: () => ({ messages: harness.messages }) };
    const setMessagesStore = update => { harness.messages = update(harness.messages); };
    const setIsLoadingStore = value => { harness.loading = value; };
    const setExecutingSessionId = value => { harness.executingSessionId = value; };
    const updateMessageStreaming = (id, value) => { harness.streaming = value; };
    const updateMessageContent = () => {};
    const persistence = { saveSession: session => { harness.saved.push(structuredClone(session)); } };
    const t = value => value;
    const console = { warn() {} };
    const setTimeout = () => 0; // Naming is detached UI work, not inference completion.
    const runInference = async (config, fallback = false) => {
        harness.requests.push({ config, fallback });
        finalAssistantText = await harness.infer(config, fallback);
    };
    ${actualStatements}
};`;
const compiled = ts.transpileModule(moduleSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText;
const executeLifecycle = new Function(`${compiled}\nreturn executeLifecycle;`)();

function setup({ scheduled = true, fallback = false, infer } = {}) {
    return {
        scheduled, fallback, infer: infer || (async () => 'Completed answer'),
        requests: [], saved: [], loading: true, streaming: true, executingSessionId: 'session-test',
        messages: [{ id: 'answer-test', role: 'assistant', text: '', isStreaming: true }]
    };
}

function assertReleased(harness) {
    assert.equal(harness.loading, false);
    assert.equal(harness.streaming, false);
    assert.equal(harness.executingSessionId, null);
    assert.equal(harness.saved.at(-1).messages.find(message => message.id === 'answer-test').isStreaming, false);
}

test('scheduled inference failures reject after final persistence and execution cleanup', async () => {
    const failure = new Error('Provider unavailable after resume');
    const harness = setup({ infer: async () => { throw failure; } });
    await assert.rejects(executeLifecycle(harness), error => error === failure);
    assertReleased(harness);
    assert.match(harness.messages[0].text, /Provider unavailable after resume/);
    assert.match(harness.saved.at(-1).messages[0].text, /Provider unavailable after resume/);
});

test('ordinary chat errors remain displayed and do not reject the UI callback', async () => {
    const harness = setup({ scheduled: false, infer: async () => { throw new Error('Chat failure'); } });
    assert.equal(await executeLifecycle(harness), '');
    assertReleased(harness);
    assert.match(harness.messages[0].text, /Chat failure/);
});

test('scheduled and ordinary chat success return the answer after cleanup', async () => {
    for (const scheduled of [true, false]) {
        const harness = setup({ scheduled });
        assert.equal(await executeLifecycle(harness), 'Completed answer');
        assertReleased(harness);
        assert.equal(harness.saved.at(-1).messages[0].text, 'Completed answer');
    }
});

test('scheduled cancellation rejects without attempting the configured master fallback', async () => {
    const cancellation = new DOMException('Backend interrupted', 'AbortError');
    const harness = setup({ fallback: true, infer: async () => { throw cancellation; } });
    await assert.rejects(executeLifecycle(harness), error => error === cancellation);
    assert.equal(harness.requests.length, 1);
    assertReleased(harness);
});

test('ordinary chat cancellation resolves quietly and still skips fallback', async () => {
    const harness = setup({ scheduled: false, fallback: true, infer: async () => {
        throw new DOMException('Cancelled', 'AbortError');
    } });
    assert.equal(await executeLifecycle(harness), undefined);
    assert.equal(harness.requests.length, 1);
    assert.equal(harness.messages[0].text, '');
    assertReleased(harness);
});

test('a non-cancellation provider failure can still recover through the configured fallback', async () => {
    const harness = setup({ fallback: true, infer: async (_config, fallback) => {
        if (!fallback) throw new Error('Primary unavailable');
        return 'Master answer';
    } });
    assert.equal(await executeLifecycle(harness), 'Master answer');
    assert.deepEqual(harness.requests.map(request => request.fallback), [false, true]);
    assertReleased(harness);
});

test('agent, chat and vision load ProviderFactory statically before scheduled execution', async () => {
    for (const path of ['core/agent.ts', 'integrations/api.ts', 'core/VisionService.ts']) {
        const source = await readFile(new URL(`../src/services/${path}`, import.meta.url), 'utf8');
        const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
        const providerImport = ast.statements.find(node => ts.isImportDeclaration(node)
            && ts.isStringLiteral(node.moduleSpecifier) && /\/ModelProviders$/.test(node.moduleSpecifier.text));
        assert.ok(providerImport, `${path} must import the provider module during startup`);
        assert.equal(providerImport.importClause?.isTypeOnly, false, `${path} requires a runtime import`);
        const bindings = providerImport.importClause.namedBindings;
        assert.ok(bindings && ts.isNamedImports(bindings)
            && bindings.elements.some(binding => binding.name.text === 'ProviderFactory' && !binding.isTypeOnly),
        `${path} must load the ProviderFactory value statically`);
        function checkDynamicImports(node) {
            if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
                assert.ok(!node.arguments.some(argument => /ModelProviders/.test(argument.getText(ast))),
                    `${path} must not fetch ModelProviders on a later turn`);
            }
            ts.forEachChild(node, checkDynamicImports);
        }
        checkDynamicImports(ast);
    }
});
