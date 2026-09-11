import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

import { streamViaCodex } from '../src/utils/helpers/codexStream.ts';
import { inferReasoningEfforts, resolveOllamaThink } from '../src/services/core/reasoning.ts';

// Existing providers use TS parameter properties. Compile the real factory in
// memory and resolve its transport imports without writing generated test files.
const providerUrl = new URL('../src/services/core/ModelProviders.ts', import.meta.url);
const providerSource = await readFile(providerUrl, 'utf8');
const providerModule = ts.transpileModule(providerSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText.replace(/from (['"])(\.\.\/\.\.\/utils\/helpers\/(?:streamProxy|codexStream))\1/g,
    (_match, _quote, path) => `from '${new URL(`${path}.ts`, providerUrl).href}'`);
const { CodexProvider, ProviderFactory } = await import(`data:text/javascript;base64,${Buffer.from(providerModule).toString('base64')}`);

function setup(t, overrides = {}) {
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const listeners = new Set();
    const requests = [];
    const aborts = [];
    const chunks = [];
    const statuses = [];
    const controller = new AbortController();
    const bridge = {
        onCodexStreamEvent(callback) {
            listeners.add(callback);
            return () => listeners.delete(callback);
        },
        codexStream(request) {
            return new Promise((resolve, reject) => requests.push({ ...request, resolve, reject }));
        },
        codexAbortStream(streamId) { aborts.push(streamId); },
        ...overrides
    };
    Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: { electron: bridge } });
    t.after(() => {
        if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
        else delete globalThis.window;
    });
    const options = {
        config: { provider: 'codex', model: 'codex-test-model', apiKeys: { gemini: 'must-not-leave-renderer' } },
        onStatus: status => statuses.push(status),
        onChunk: chunk => chunks.push(chunk),
        abortSignal: controller.signal,
        useTools: true,
        tools: [{ type: 'function', function: { name: 'read_file', parameters: { type: 'object' } } }],
        isElectronProxy: true
    };
    return {
        bridge, listeners, requests, aborts, chunks, statuses, controller, options,
        emit: event => [...listeners].forEach(listener => listener(event)),
        assertClean() {
            assert.equal(listeners.size, 0);
            assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
        }
    };
}

test('Codex factory uses native tools and never retries auth, quota or tool failures through a fallback', t => {
    const { options } = setup(t);
    const provider = ProviderFactory.create('codex', options);
    assert.ok(provider instanceof CodexProvider);
    assert.equal(provider.supportsNativeTools(), true);
    for (const message of ['401 authentication required', '429 usage limit reached', 'HTTP 400', 'HTTP 422', 'invalid_argument', 'too many tools']) {
        assert.equal(provider.shouldFallback(new Error(message)), false);
    }
});

test('Codex reasoning options expose only the levels returned by its catalog', () => {
    const catalog = inferReasoningEfforts('codex', 'gpt-5.6-luna', {
        supportedReasoningEfforts: [
            { reasoningEffort: 'low', description: 'Low' },
            { reasoningEffort: 'medium', description: 'Medium' },
            { reasoningEffort: 'high', description: 'High' },
            { reasoningEffort: 'xhigh', description: 'Very high' }
        ]
    });
    assert.deepEqual(catalog.map(option => option.effort), ['low', 'medium', 'high', 'xhigh']);
    assert.deepEqual(inferReasoningEfforts('codex', 'gpt-5.6-luna'), []);
    assert.deepEqual(inferReasoningEfforts('codex', 'gpt-5.5'), []);
});

test('Codex consumes the snake_case catalog used by the app-server cache, including Max and Ultra', () => {
    const catalog = inferReasoningEfforts('codex', 'gpt-6-astra', {
        supported_reasoning_levels: [
            { effort: 'low' },
            { effort: 'medium' },
            { effort: 'high' },
            { effort: 'xhigh' },
            { effort: 'max' },
            { effort: 'ultra' }
        ]
    });
    assert.deepEqual(catalog.map(option => option.effort), ['low', 'medium', 'high', 'xhigh', 'max', 'ultra']);
});

test('provider-specific reasoning levels stay tied to each native contract', () => {
    assert.deepEqual(
        inferReasoningEfforts('unsloth', 'local-model', {
            supportedReasoningEfforts: ['low', 'high', 'max']
        }).map(option => option.effort),
        ['low', 'high', 'max']
    );
    assert.deepEqual(
        inferReasoningEfforts('ollama', 'qwen3').map(option => option.effort),
        ['none']
    );
    assert.deepEqual(
        inferReasoningEfforts('ollama', 'gpt-oss').map(option => option.effort),
        ['low', 'medium', 'high']
    );
    assert.deepEqual(
        inferReasoningEfforts('zai', 'glm-4.7').map(option => option.effort),
        ['none']
    );
    assert.deepEqual(
        inferReasoningEfforts('gemini', 'gemini-3-pro-preview').map(option => option.effort),
        ['low', 'high']
    );
    assert.deepEqual(
        inferReasoningEfforts('gemini', 'gemini-3.1-flash-lite-image').map(option => option.effort),
        ['minimal', 'high']
    );
    assert.deepEqual(
        inferReasoningEfforts('gemini', 'gemini-2.5-pro').map(option => option.effort),
        ['low', 'medium', 'high']
    );
    assert.equal(resolveOllamaThink('qwen3', 'max'), true);
    assert.equal(resolveOllamaThink('qwen3', 'none'), false);
});

test('streams only matching events and preserves transcript, images, native tool calls and usage', async t => {
    const mock = setup(t);
    mock.options.config.reasoningEffort = 'max';
    const messages = [{ role: 'user', content: 'Inspect this', attachments: [{ type: 'image/png', data: 'data:image/png;base64,AA==' }] }];
    const provider = ProviderFactory.create('codex', mock.options);
    const promise = provider.streamRequest(messages);
    const request = mock.requests[0];
    assert.equal(mock.listeners.size, 1);
    assert.equal(request.messages, messages);
    assert.equal(request.tools, mock.options.tools);
    assert.equal(request.model, 'codex-test-model');
    assert.equal(request.useTools, true);
    assert.equal(request.effort, 'max');
    assert.equal(request.summary, 'auto');
    assert.equal(request.apiKeys, undefined);
    mock.emit(null);
    mock.emit({ streamId: 'unrelated', type: 'content', delta: 'ignored' });
    mock.emit({ streamId: request.streamId, type: 'content', delta: 7 });
    mock.emit({ streamId: request.streamId, type: 'content', delta: 'Answer ' });
    mock.emit({ streamId: request.streamId, type: 'summary', delta: '**Summary one**' });
    mock.emit({ streamId: request.streamId, type: 'summary', delta: '**Summary two**' });
    mock.emit({ streamId: request.streamId, type: 'content', delta: 'text' });
    const result = {
        content: 'Answer text',
        toolCalls: [{ id: 'native-call', type: 'function', function: { name: 'read_file', arguments: '{"path":"file.txt"}' } }],
        usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        finishReason: 'tool_calls'
    };
    request.resolve(result);
    assert.deepEqual(await promise, { ...result, reasoningSummary: '**Summary one** **Summary two**' });
    assert.deepEqual(mock.chunks, ['Answer ', 'text']);
    assert.deepEqual(mock.statuses.at(-1), {
        phase: 'streaming', streamedText: 'Answer text', streamedReasoningSummary: '**Summary one** **Summary two**'
    });
    mock.assertClean();
    mock.controller.abort();
    assert.deepEqual(mock.aborts, []);
});

test('listener is registered before IPC starts and public summary-first order is preserved', async t => {
    const mock = setup(t);
    mock.bridge.codexStream = request => {
        mock.emit({ streamId: request.streamId, type: 'summary', delta: 'Summary' });
        mock.emit({ streamId: request.streamId, type: 'content', delta: 'Answer' });
        return Promise.resolve({ content: 'Answer', toolCalls: [] });
    };
    const result = await streamViaCodex([], mock.options);
    assert.equal(result.reasoningSummary, 'Summary');
    assert.deepEqual(mock.chunks, ['Answer']);
    mock.assertClean();
});

test('separates adjacent bold phrases inside a Codex summary', async t => {
    const mock = setup(t);
    mock.bridge.codexStream = request => {
        mock.emit({
            streamId: request.streamId,
            type: 'summary',
            delta: '**Preparing Spanish invitation for idea sharing****Drafting structured Spanish idea prompt**'
        });
        return Promise.resolve({ content: 'Answer', toolCalls: [] });
    };

    const result = await streamViaCodex([], mock.options);
    assert.equal(
        result.reasoningSummary,
        '**Preparing Spanish invitation for idea sharing** **Drafting structured Spanish idea prompt**'
    );
    assert.equal(
        mock.statuses.at(-1).streamedReasoningSummary,
        '**Preparing Spanish invitation for idea sharing** **Drafting structured Spanish idea prompt**'
    );
    mock.assertClean();
});

test('pre-aborted requests never subscribe or start work', async t => {
    const mock = setup(t);
    mock.controller.abort();
    await assert.rejects(streamViaCodex([], mock.options), { name: 'AbortError' });
    assert.equal(mock.requests.length, 0);
    assert.deepEqual(mock.aborts, []);
    mock.assertClean();
});

test('aborting pending IPC rejects promptly, cancels its stream and ignores late completion', async t => {
    const mock = setup(t);
    const promise = streamViaCodex([], mock.options);
    const request = mock.requests[0];
    mock.controller.abort();
    await assert.rejects(promise, { name: 'AbortError' });
    assert.deepEqual(mock.aborts, [request.streamId]);
    mock.assertClean();
    mock.emit({ streamId: request.streamId, type: 'content', delta: 'late' });
    request.resolve({ content: 'late', toolCalls: [] });
    await Promise.resolve();
    assert.deepEqual(mock.chunks, []);
});

test('concurrent calls on one provider keep separate IDs, text and completion', async t => {
    const mock = setup(t);
    const provider = new CodexProvider(mock.options);
    const first = provider.streamRequest([{ role: 'user', content: 'first' }]);
    const second = provider.streamRequest([{ role: 'user', content: 'second' }]);
    const [one, two] = mock.requests;
    assert.notEqual(one.streamId, two.streamId);
    mock.emit({ streamId: one.streamId, type: 'content', delta: 'One' });
    mock.emit({ streamId: two.streamId, type: 'summary', delta: 'Second summary' });
    mock.emit({ streamId: two.streamId, type: 'content', delta: 'Two' });
    two.resolve({ content: 'Two', toolCalls: [] });
    assert.equal((await second).reasoningSummary, 'Second summary');
    assert.equal(mock.listeners.size, 1);
    one.resolve({ content: 'One', toolCalls: [] });
    assert.deepEqual(await first, { content: 'One', toolCalls: [], reasoningSummary: '' });
    mock.assertClean();
});

test('a failed concurrent stream does not unsubscribe another request', async t => {
    const mock = setup(t);
    const first = streamViaCodex([], mock.options);
    const second = streamViaCodex([], mock.options);
    const [one, two] = mock.requests;
    const authError = new Error('Inicia sesión en ChatGPT');
    one.reject(authError);
    await assert.rejects(first, error => error === authError);
    assert.equal(mock.listeners.size, 1);
    mock.emit({ streamId: two.streamId, type: 'content', delta: 'Continues' });
    two.resolve({ content: 'Continues', toolCalls: [] });
    assert.equal((await second).content, 'Continues');
    mock.assertClean();
});

test('final-only text reaches chunk/status callbacks and tool-disabled requests remain disabled', async t => {
    const mock = setup(t);
    const promise = streamViaCodex([], { ...mock.options, useTools: false });
    assert.equal(mock.requests[0].useTools, false);
    mock.requests[0].resolve({ content: 'Final', reasoning: 'private raw chain', toolCalls: [] });
    assert.equal((await promise).content, 'Final');
    assert.deepEqual(mock.chunks, ['Final']);
    assert.equal(mock.statuses.at(-1).streamedReasoningSummary, undefined);
    mock.assertClean();
});

test('synchronous IPC errors clean up listeners and keep the original error', async t => {
    const failure = new Error('Cannot start app server');
    const mock = setup(t, { codexStream() { throw failure; } });
    await assert.rejects(streamViaCodex([], mock.options), error => error === failure);
    mock.assertClean();
});

test('callback errors cancel backend work and clean up listeners', async t => {
    const mock = setup(t);
    const failure = new Error('Consumer failed');
    const promise = streamViaCodex([], { ...mock.options, onChunk() { throw failure; } });
    const request = mock.requests[0];
    mock.emit({ streamId: request.streamId, type: 'content', delta: 'Text' });
    await assert.rejects(promise, error => error === failure);
    assert.deepEqual(mock.aborts, [request.streamId]);
    mock.assertClean();
    request.reject(new Error('Canceled after callback failed'));
    await Promise.resolve();
});

test('an invalid backend response fails explicitly rather than returning a blank answer', async t => {
    const mock = setup(t);
    const promise = streamViaCodex([], mock.options);
    mock.requests[0].resolve({ ok: false, error: 'quota' });
    await assert.rejects(promise, /respuesta inválida/);
    mock.assertClean();
});

test('an unavailable desktop bridge fails without HTTP or API fallback', async t => {
    const mock = setup(t);
    delete window.electron;
    await assert.rejects(streamViaCodex([], mock.options), /aplicación de escritorio/);
    assert.equal(mock.requests.length, 0);
    mock.assertClean();
});
