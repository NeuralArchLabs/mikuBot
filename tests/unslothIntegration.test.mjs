import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import * as unsloth from '../electron/services/unsloth.cjs';

const providerUrl = new URL('../src/services/core/ModelProviders.ts', import.meta.url);
const providerModule = ts.transpileModule(await readFile(providerUrl, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText.replace(/from (['"])(\.[^'"]+)\1/g,
    (_match, _quote, path) => `from '${new URL(/\.[cm]?[jt]s$/.test(path) ? path : `${path}.ts`, providerUrl).href}'`);
const { ProviderFactory } = await import(`data:text/javascript;base64,${Buffer.from(providerModule).toString('base64')}`);
const mainSource = await readFile(new URL('../electron/main.cjs', import.meta.url), 'utf8');
const mainAst = ts.createSourceFile('main.cjs', mainSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

// Exercise the real IPC handlers without starting the app's unrelated engines.
function mainHandlers(configuredUrl, apiKey, listeners = new Set()) {
    const handlers = new Map();
    const sender = { mainFrame: {}, isDestroyed: () => false, send: (_channel, event) => listeners.forEach(fn => fn(event)) };
    const event = { sender, senderFrame: sender.mainFrame };
    let keyReads = 0;
    const context = {
        ...unsloth, ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
        mainWin: { webContents: sender, isDestroyed: () => false },
        requireMainUi(candidate) {
            if (candidate.sender !== sender || candidate.senderFrame !== sender.mainFrame) throw new Error('Untrusted sender');
        },
        getConfiguredUnslothUrl: () => configuredUrl,
        getApiKeys: () => { keyReads++; return { unsloth: apiKey }; },
        activeStreams: new Map(), fetch, AbortController, TextDecoder, setTimeout, clearTimeout,
        console: { log() {}, error() {} }
    };
    for (const channel of ['unsloth:models', 'api-stream']) {
        const statement = mainAst.statements.find(node => ts.isExpressionStatement(node)
            && ts.isCallExpression(node.expression)
            && node.expression.expression.getText(mainAst) === 'ipcMain.handle'
            && node.expression.arguments[0]?.text === channel);
        assert.ok(statement, `Missing ${channel} handler`);
        vm.runInNewContext(statement.getText(mainAst), context);
    }
    return { handlers, event, sender, keyReads: () => keyReads };
}

async function serverFixture(t) {
    const requests = [];
    const server = createServer(async (request, response) => {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const bodyText = Buffer.concat(chunks).toString();
        const body = bodyText ? JSON.parse(bodyText) : null;
        requests.push({ url: request.url, authorization: request.headers.authorization, body });
        if (request.url.startsWith('/rejected/')) {
            response.writeHead(401).end('invalid token');
        } else if (request.url.startsWith('/redirect/')) {
            response.writeHead(307, { Location: '/never-follow-with-key' }).end();
        } else if (request.url === '/v1/models') {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ data: [
                { id: 'fixture-model', quant: 'Q4_K_M', context_length: 32768, capabilities: ['tools', 'vision'] },
                { id: 'fixture-model:Q4_K_M', quant: 'Q4_K_M', context_length: 32768, capabilities: ['tools', 'vision'] }
            ] }));
        } else if (request.url === '/api/chat/settings') {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ settings: {
                gpuMemoryMode: 'auto', speculativeType: 'auto', autoCompactEnabled: true,
                contextPolicy: 'inherit', compactionHeadroomRatio: 0.25,
            } }));
        } else if (request.url === '/api/inference/status') {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
                context_length: 8192, native_context_length: 32768, max_context_length: 32768,
                requested_context_length: 0, gpu_memory_mode: 'auto', gpu_layers: -1,
                gpu_ids: [0], requested_gpu_ids: [0], n_parallel: 4,
            }));
        } else if (request.url === '/v1/chat/completions' && body?.model?.startsWith('fixture-sse-error')) {
            response.setHeader('Content-Type', 'text/event-stream');
            const prefix = body.model.endsWith('no-space') ? 'data:' : 'data: ';
            const ending = body.model.endsWith('unterminated') ? '' : '\n\ndata: [DONE]\n\n';
            response.end(prefix + '{"error":{"code":"context_length_exceeded","message":"El contexto no cabe en la ventana efectiva."}}' + ending);
        } else if (request.url === '/v1/chat/completions' && body?.model === 'fixture-sse-null-error') {
            response.setHeader('Content-Type', 'text/event-stream');
            response.end('data:{"error":null,"choices":[{"delta":{"content":"Sin error"},"finish_reason":"stop"}]}');
        } else if (request.url === '/v1/chat/completions') {
            response.setHeader('Content-Type', 'text/event-stream');
            const events = [
                { choices: [{ delta: { reasoning_content: 'Plan' } }] },
                { choices: [{ delta: { content: 'Revisando', tool_calls: [{ index: 0, id: 'call-fixture', function: { name: 'web_search', arguments: '{"query":' } }] } }] },
                { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"prueba"}' } }] }, finish_reason: 'tool_calls' }] },
                { choices: [], usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 } }
            ].map(value => `data: ${JSON.stringify(value)}\n\n`).join('') + 'data: [DONE]\n\n';
            response.write(events.slice(0, 17));
            response.end(events.slice(17));
        } else response.writeHead(404).end();
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    return { url: `http://127.0.0.1:${server.address().port}`, requests };
}

test('normalizes Desktop endpoint forms and preserves quantization and model metadata', async () => {
    for (const suffix of ['', '/', '/v1', '/v1/', '/v1/chat/completions', '/v1/models']) {
        assert.equal(unsloth.normalizeUnslothBase(`http://localhost:8888${suffix}`), 'http://127.0.0.1:8888/v1');
    }
    assert.equal(unsloth.normalizeUnslothBase('https://example.invalid/local/v1/chat/completions'), 'https://example.invalid/local/v1');
    for (const url of ['file:///etc/passwd', 'https://user:secret@example.invalid', 'http://localhost:8888?key=secret']) {
        assert.throws(() => unsloth.normalizeUnslothBase(url));
    }
    const list = unsloth.parseUnslothModels({ models: ['one', { name: 'two', quant: 'Q8_0', native_context_length: 8192 }, { id: 'two:Q8_0', quant: 'Q8_0', context_length: 8192 }, { id: 'image', modalities: ['text', 'image'], supported_reasoning_efforts: ['low', 'high'] }] });
    assert.deepEqual(list.map(item => item.id), ['one', 'two:Q8_0', 'image']);
    assert.equal(list[1].contextLength, 8192);
    assert.ok(list[2].capabilities.includes('vision'));
    assert.deepEqual(list[2].supportedReasoningEfforts, ['low', 'high']);
    assert.throws(() => unsloth.parseUnslothModels({ data: {} }), /inválido/);
    assert.deepEqual(unsloth.normalizeUnslothChatSettings({}), {
        gpuMemoryMode: 'auto', speculativeType: 'auto',
    });
    const settingsCalls = [];
    const settingsFetch = async url => {
        settingsCalls.push(url);
        const payload = url.endsWith('/api/chat/settings')
            ? { settings: { gpuMemoryMode: 'manual', speculativeType: 'ngram', autoCompactEnabled: false } }
            : { context_length: 8192, native_context_length: 262144, requested_context_length: 0, gpu_ids: [0], n_parallel: 4 };
        return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
    };
    assert.deepEqual(await unsloth.fetchUnslothChatSettings({ configuredUrl: 'http://127.0.0.1:8888/v1', apiKey: 'fixture-vault-key', fetchImpl: settingsFetch }), {
        gpuMemoryMode: 'manual', speculativeType: 'ngram',
    });
    assert.deepEqual(await unsloth.fetchUnslothRuntimeStatus({ configuredUrl: 'http://127.0.0.1:8888/v1', apiKey: 'fixture-vault-key', fetchImpl: settingsFetch }), {
        contextLength: 8192, nativeContextLength: 262144, requestedContextLength: 0, gpuIds: [0], parallelSlots: 4,
    });
    assert.deepEqual(settingsCalls, [
        'http://127.0.0.1:8888/api/chat/settings',
        'http://127.0.0.1:8888/api/inference/status',
    ]);
    assert.deepEqual(
        unsloth.resolveUnslothLoadSpec('unsloth/gemma-4-31B-it-UD-IQ2_XXS', [
            { id: 'unsloth/gemma-4-31B-it-GGUF' },
        ]),
        { model_path: 'unsloth/gemma-4-31B-it-GGUF', gguf_variant: 'UD-IQ2_XXS', is_lora: false },
    );
    assert.deepEqual(
        unsloth.resolveUnslothLoadSpec('unsloth/gemma-4-31B-it-UD-IQ2_XXS', [
            { id: 'E:\\Ollama\\unsloth-gguf\\gemma-4-31B-it-UD-IQ2_XXS.gguf', display_name: 'gemma-4-31B-it-UD-IQ2_XXS', source: 'custom' },
        ]),
        { model_path: 'E:\\Ollama\\unsloth-gguf\\gemma-4-31B-it-UD-IQ2_XXS.gguf', is_lora: false },
    );
    const catalogRequests = [];
    const legacySpec = await unsloth.fetchUnslothLoadSpec({
        configuredUrl: 'http://127.0.0.1:8888/v1',
        requestedModel: 'unsloth/gemma-4-31B-it-UD-IQ2_XXS',
        apiKey: 'fixture-vault-key',
        fetchImpl: async url => {
            catalogRequests.push(url);
            if (url.endsWith('/v1/models')) return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: 'unsloth/gemma-4-31B-it-UD-IQ2_XXS', quant: 'UD-IQ2_XXS' }] }) };
            if (url.endsWith('/api/models/list')) return { ok: true, status: 200, text: async () => JSON.stringify({ models: [{ id: 'unsloth/gemma-4-31B-it-GGUF', quant: 'UD-IQ2_XXS' }] }) };
            return { ok: false, status: 404, text: async () => '' };
        },
    });
    assert.deepEqual(legacySpec, { model_path: 'unsloth/gemma-4-31B-it-GGUF', gguf_variant: 'UD-IQ2_XXS', is_lora: false });
    assert.deepEqual(catalogRequests, [
        'http://127.0.0.1:8888/v1/models',
        'http://127.0.0.1:8888/api/models/local',
        'http://127.0.0.1:8888/api/models/cached-gguf',
        'http://127.0.0.1:8888/api/models/list',
    ]);

    const inventoryRequests = [];
    const cachedSpec = await unsloth.fetchUnslothLoadSpec({
        configuredUrl: 'http://127.0.0.1:8888/v1',
        requestedModel: 'unsloth/gemma-4-31B-it-UD-IQ2_XXS',
        apiKey: 'fixture-vault-key',
        fetchImpl: async url => {
            inventoryRequests.push(url);
            if (url.endsWith('/v1/models')) return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: 'unsloth/gemma-4-31B-it-UD-IQ2_XXS', quant: 'UD-IQ2_XXS' }] }) };
            if (url.endsWith('/api/models/local')) return { ok: true, status: 200, text: async () => JSON.stringify({ models: [{ id: 'irrelevant/model', source: 'hf_cache', display_name: 'other', path: 'C:\\cache\\other' }] }) };
            if (url.endsWith('/api/models/cached-gguf')) return { ok: true, status: 200, text: async () => JSON.stringify({ cached: [{ repo_id: 'unsloth/gemma-4-31B-it-GGUF' }] }) };
            return { ok: false, status: 404, text: async () => '' };
        },
    });
    assert.deepEqual(cachedSpec, { model_path: 'unsloth/gemma-4-31B-it-GGUF', gguf_variant: 'UD-IQ2_XXS', is_lora: false });
    assert.deepEqual(inventoryRequests, [
        'http://127.0.0.1:8888/v1/models',
        'http://127.0.0.1:8888/api/models/local',
        'http://127.0.0.1:8888/api/models/cached-gguf',
    ]);

    const localSpec = await unsloth.fetchUnslothLoadSpec({
        configuredUrl: 'http://127.0.0.1:8888/v1',
        requestedModel: 'unsloth/gemma-4-31B-it-UD-IQ2_XXS',
        apiKey: 'fixture-vault-key',
        fetchImpl: async url => {
            if (url.endsWith('/v1/models')) return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ id: 'unsloth/gemma-4-31B-it-UD-IQ2_XXS', quant: 'UD-IQ2_XXS' }] }) };
            if (url.endsWith('/api/models/local')) return { ok: true, status: 200, text: async () => JSON.stringify({ models: [
                { id: 'E:\\Ollama\\unsloth-gguf\\gemma-4-31B-it-UD-IQ2_XXS.gguf', display_name: 'gemma-4-31B-it-UD-IQ2_XXS', path: 'E:\\Ollama\\unsloth-gguf\\gemma-4-31B-it-UD-IQ2_XXS.gguf', source: 'custom', model_format: 'gguf', partial: false },
                { id: 'unsloth/gemma-4-31B-it-GGUF', model_id: 'unsloth/gemma-4-31B-it-GGUF', display_name: 'gemma-4-31B-it-GGUF', path: 'E:\\partial-cache', source: 'hf_cache', partial: true },
            ] }) };
            return { ok: false, status: 404, text: async () => '' };
        },
    });
    assert.deepEqual(localSpec, { model_path: 'E:\\Ollama\\unsloth-gguf\\gemma-4-31B-it-UD-IQ2_XXS.gguf', is_lora: false });
    const overrideUrl = new URL(unsloth.unslothLoadOverrideEndpoint('http://127.0.0.1:8888/v1', localSpec, 'unsloth/gemma-4-31B-it-UD-IQ2_XXS'));
    assert.equal(overrideUrl.searchParams.get('model_id'), 'E:\\Ollama\\unsloth-gguf\\gemma-4-31B-it-UD-IQ2_XXS.gguf');
    assert.equal(overrideUrl.searchParams.get('alias_id'), 'unsloth/gemma-4-31B-it-GGUF');
    assert.deepEqual(
        unsloth.resolveUnslothLoadSpec('unsloth/gemma-4-31B-it-GGUF:UD-IQ2_XXS', [
            { id: 'E:\\Ollama\\unsloth-gguf\\gemma-4-31B-it-UD-IQ2_XXS.gguf', display_name: 'gemma-4-31B-it-UD-IQ2_XXS', source: 'custom' },
        ]),
        { model_path: 'E:\\Ollama\\unsloth-gguf\\gemma-4-31B-it-UD-IQ2_XXS.gguf', is_lora: false },
    );
});

test('forwards long inference histories intact without importing Desktop chat policies', async t => {
    const fixture = await serverFixture(t);
    const main = mainHandlers(`${fixture.url}/v1`, 'fixture-vault-key');
    const body = {
        model: 'fixture-model', stream: true,
        messages: [
            { role: 'system', content: 'reglas' },
            { role: 'user', content: 'historial completo '.repeat(5000) },
            { role: 'assistant', tool_calls: [{ id: 'prior', type: 'function', function: { name: 'web_search', arguments: '{}' } }] },
            { role: 'tool', tool_call_id: 'prior', content: 'resultado completo '.repeat(1000) },
        ],
        tools: [{ type: 'function', function: { name: 'web_search', parameters: { type: 'object' } } }],
    };
    const original = structuredClone(body);
    const result = await main.handlers.get('api-stream')(main.event, {
        provider: 'unsloth', model: 'fixture-model', body, streamId: 'intact-history',
    });
    assert.equal(result.ok, true);
    assert.deepEqual(fixture.requests.map(entry => entry.url), ['/v1/chat/completions']);
    assert.deepEqual(fixture.requests[0].body, original);
    assert.deepEqual(body, original);
});

test('model IPC uses the saved endpoint and vault key; rejects frames and endpoint substitution before sending', async t => {
    const fixture = await serverFixture(t);
    const main = mainHandlers(`${fixture.url}/v1`, 'fixture-vault-key');
    const models = main.handlers.get('unsloth:models');
    await assert.rejects(models({ ...main.event, senderFrame: {} }, {}));
    await assert.rejects(models({ sender: {}, senderFrame: {} }, {}));
    assert.equal(main.keyReads(), 0);
    await assert.rejects(models(main.event, { url: 'http://127.0.0.1:1/v1' }), /Guarda/);
    assert.equal(fixture.requests.length, 0);
    const list = await models(main.event, { url: `${fixture.url}/v1/chat/completions` });
    assert.equal(list.length, 1);
    assert.equal(list[0].id, 'fixture-model:Q4_K_M');
    assert.equal(list[0].contextLength, 32768);
    assert.equal(fixture.requests[0].authorization, 'Bearer fixture-vault-key');
    assert.equal(JSON.stringify(list).includes('fixture-vault-key'), false);
});

test('preserves Desktop context pins and Auto when global and per-model settings reach the load request', async () => {
    const loadSpec = { model_path: 'fixture.gguf', is_lora: false };
    for (const entry of [
        { globalMode: 'auto', resolved: { gpu_memory_mode: 'manual', custom_context_length: 32768 }, expectedMode: 'manual', context: 32768 },
        { globalMode: 'manual', resolved: { custom_context_length: 16384 }, expectedMode: 'manual', context: 16384 },
        { globalMode: 'manual', resolved: { gpu_memory_mode: 'auto', custom_context_length: 24576 }, expectedMode: 'auto', context: 24576 },
        { globalMode: 'manual', resolved: {}, expectedMode: 'manual', context: 0 },
        { globalMode: 'auto', resolved: { max_seq_length: 0 }, expectedMode: 'auto', context: 0 },
        { globalMode: 'auto', resolved: { gpu_memory_mode: null, speculative_type: null }, expectedMode: 'auto', context: undefined },
    ]) {
        const settings = await unsloth.fetchUnslothLoadSettings({
            configuredUrl: 'http://127.0.0.1:8888/v1', loadSpec, requestedModel: 'fixture',
            defaultSettings: unsloth.unslothChatSettingsLoadSettings({ gpuMemoryMode: entry.globalMode, speculativeType: 'ngram' }),
            fetchImpl: async () => ({ ok: true, text: async () => JSON.stringify({ resolved: entry.resolved }) }),
        });
        const payload = unsloth.unslothLoadPayload({ ...loadSpec, ...settings });
        assert.equal(payload.max_seq_length, entry.context, JSON.stringify(entry));
        assert.equal(payload.gpu_memory_mode, entry.expectedMode);
        assert.equal(payload.speculative_type, 'ngram');
    }
    assert.deepEqual(unsloth.unslothLoadSettings({ llama_extra_args: [] }).llama_extra_args, []);
    assert.equal(unsloth.unslothLoadSettings({ llama_extra_args: ['--threads', 8] }).llama_extra_args, undefined);
});

test('retries after asking Desktop to load an installed but unloaded model', async t => {
    const requests = [];
    let chatAttempts = 0;
    const server = createServer(async (request, response) => {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const body = Buffer.concat(chunks).toString();
        requests.push({ url: request.url, authorization: request.headers.authorization, body: body ? JSON.parse(body) : null });
        if (request.url === '/v1/chat/completions' && ++chatAttempts === 1) {
            response.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: { code: 'model_not_found', message: 'model is not loaded' } }));
            return;
        }
        if (request.url === '/api/chat/settings') {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ settings: {
                gpuMemoryMode: 'auto', speculativeType: 'ngram', autoCompactEnabled: true,
                contextPolicy: 'rolling', compactionHeadroomRatio: 0.33,
            } }));
            return;
        }
        if (request.url === '/v1/models') {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ data: [{ id: 'fixture-model', quant: 'Q4_K_M' }] }));
            return;
        }
        if (request.url === '/api/models/list') {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ models: [{ id: 'fixture-model' }] }));
            return;
        }
        if (request.url.startsWith('/api/settings/openai-auto-switch/overrides?')) {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ resolved: {
                gpu_memory_mode: 'manual', gpu_layers: 12, gpu_ids: [0],
                tensor_parallel: true, kv_cache_dtype: 'q4_0', llama_extra_args: ['--threads', '8'],
            } }));
            return;
        }
        if (request.url === '/api/inference/load') {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ status: 'success', display_name: 'fixture-model' }));
            return;
        }
        if (request.url === '/api/inference/status') {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ context_length: 8192, native_context_length: 262144, requested_context_length: 0 }));
            return;
        }
        if (request.url === '/v1/chat/completions') {
            response.setHeader('Content-Type', 'text/event-stream');
            response.end(`data: ${JSON.stringify({ choices: [{ delta: { content: 'cargado' }, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`);
            return;
        }
        response.writeHead(404).end();
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));

    const listeners = new Set();
    const main = mainHandlers(`http://127.0.0.1:${server.address().port}/v1`, 'fixture-vault-key', listeners);
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { electron: {
        onApiStreamChunk(callback) { listeners.add(callback); return () => listeners.delete(callback); },
        apiStream: request => main.handlers.get('api-stream')(main.event, request),
        abortApiStream() {}
    } } });
    t.after(() => { if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else delete globalThis.window; });
    const provider = ProviderFactory.create('unsloth', {
        config: { provider: 'unsloth', model: 'fixture-model:Q4_K_M', apiKeys: { unsloth: 'renderer-key' } },
        onStatus() {}, abortSignal: new AbortController().signal, useTools: false, tools: [], isElectronProxy: false
    });
    const result = await provider.streamRequest([{ role: 'user', content: 'carga el modelo' }]);
    assert.equal(result.content, 'cargado');
    assert.deepEqual(requests.map(request => request.url), [
        '/v1/chat/completions', '/v1/models', '/api/models/local', '/api/models/cached-gguf', '/api/models/list', '/api/chat/settings',
        '/api/settings/openai-auto-switch/overrides?model_id=fixture-model&alias_id=fixture-model&gguf_variant=Q4_K_M',
        '/api/inference/load', '/api/inference/status', '/v1/chat/completions',
    ]);
    assert.equal(requests[7].body.model_path, 'fixture-model');
    assert.equal(requests[7].body.gguf_variant, 'Q4_K_M');
    assert.equal(requests[7].body.is_lora, false);
    assert.equal(requests[7].body.gpu_memory_mode, 'manual');
    assert.equal(requests[7].body.gpu_layers, 12);
    assert.deepEqual(requests[7].body.gpu_ids, [0]);
    assert.equal(requests[7].body.tensor_parallel, true);
    assert.equal(requests[7].body.cache_type_kv, 'q4_0');
    assert.deepEqual(requests[7].body.llama_extra_args, ['--threads', '8']);
    assert.equal(requests[7].body.speculative_type, 'ngram');
    assert.equal(requests[7].authorization, 'Bearer fixture-vault-key');
    assert.equal(JSON.stringify(requests[7].body).includes('renderer-key'), false);
    assert.equal(requests[0].body.context_overflow, undefined);
    assert.equal(requests[0].body.context_policy, undefined);
    assert.equal(requests[0].body.compaction_headroom_ratio, undefined);
    assert.equal(requests[9].body.model, 'default');
    assert.deepEqual(requests[9].body, { ...requests[0].body, model: 'default' });
    assert.equal(listeners.size, 0);
});

for (const key of ['', 'fixture-vault-key']) {
    test(`real provider → IPC → HTTP streams tools, images and usage (${key ? 'authenticated' : 'keyless'})`, async t => {
        const fixture = await serverFixture(t);
        const listeners = new Set();
        const main = mainHandlers(`${fixture.url}/v1`, key, listeners);
        const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
        Object.defineProperty(globalThis, 'window', { configurable: true, value: { electron: {
            onApiStreamChunk(callback) { listeners.add(callback); return () => listeners.delete(callback); },
            apiStream: request => main.handlers.get('api-stream')(main.event, { ...request, overrideUrl: 'https://ignored.invalid', apiKey: 'ignored-renderer-key' }),
            abortApiStream() {}
        } } });
        t.after(() => { if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else delete globalThis.window; });
        const tools = [{ type: 'function', function: { name: 'web_search', parameters: { type: 'object', properties: { query: { type: 'string' } } } } }];
        const options = {
            config: { provider: 'unsloth', model: 'fixture-model:Q4_K_M', apiKeys: { unsloth: 'renderer-key-must-not-leave' }, maxOutputTokens: 128000 },
            onStatus() {}, abortSignal: new AbortController().signal, useTools: true, tools, isElectronProxy: false
        };
        const provider = ProviderFactory.create('unsloth', options);
        assert.equal(provider.supportsNativeTools(), true);
        const messages = [
            { role: 'user', content: 'Describe y busca', attachments: [{ type: 'image/png', data: 'data:image/png;base64,AA==' }] },
            { role: 'assistant', content: '', tool_calls: [{ id: 'previous', function: { name: 'web_search', arguments: { query: 'anterior' } } }] },
            { role: 'tool', tool_call_id: 'previous', content: 'resultado anterior' }
        ];
        const originalMessages = structuredClone(messages);
        const result = await provider.streamRequest(messages);
        const request = fixture.requests.find(entry => entry.url === '/v1/chat/completions');
        assert.ok(request);
        assert.equal(request.url, '/v1/chat/completions');
        assert.equal(request.authorization, key ? `Bearer ${key}` : undefined);
        assert.equal(request.body.model, 'fixture-model:Q4_K_M');
        assert.deepEqual(request.body.tools, tools);
        assert.deepEqual(request.body.stream_options, { include_usage: true });
        assert.equal(request.body.max_tokens, undefined);
        assert.equal(request.body.think, undefined);
        assert.equal(request.body.context_overflow, undefined);
        assert.equal(request.body.context_policy, undefined);
        assert.equal(request.body.compaction_headroom_ratio, undefined);
        assert.equal(fixture.requests.some(entry => entry.url === '/api/chat/settings'), false);
        assert.equal(request.body.messages[0].content[1].image_url.url, 'data:image/png;base64,AA==');
        assert.equal(request.body.messages[1].tool_calls[0].function.arguments, '{"query":"anterior"}');
        assert.equal(request.body.messages[2].tool_call_id, 'previous');
        assert.equal(JSON.stringify(request.body).includes('renderer-key-must-not-leave'), false);
        assert.equal(result.content, 'Revisando');
        assert.equal(result.toolCalls[0].function.name, 'web_search');
        assert.deepEqual(JSON.parse(result.toolCalls[0].function.arguments), { query: 'prueba' });
        assert.equal(result.reasoning, 'Plan');
        assert.equal(result.finishReason, 'tool_calls');
        assert.equal(result.usage.totalTokens, 20);
        assert.equal(listeners.size, 0);
        assert.deepEqual(messages, originalMessages);

        await ProviderFactory.create('unsloth', { ...options, useTools: false }).streamRequest([{ role: 'user', content: 'Hola' }]);
        const chatRequests = fixture.requests.filter(entry => entry.url === '/v1/chat/completions');
        assert.equal(chatRequests[1].body.tools, undefined);
        assert.equal(chatRequests[1].body.context_overflow, undefined);
    });
}

for (const model of ['fixture-sse-error', 'fixture-sse-error-no-space', 'fixture-sse-error-unterminated', 'fixture-sse-null-error']) {
test(`handles a successful HTTP stream with SSE edge case: ${model}`, async t => {
    const fixture = await serverFixture(t);
    const listeners = new Set();
    const main = mainHandlers(`${fixture.url}/v1`, 'fixture-vault-key', listeners);
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { electron: {
        onApiStreamChunk(callback) { listeners.add(callback); return () => listeners.delete(callback); },
        apiStream: request => main.handlers.get('api-stream')(main.event, request),
        abortApiStream() {}
    } } });
    t.after(() => { if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else delete globalThis.window; });
    const provider = ProviderFactory.create('unsloth', {
        config: { provider: 'unsloth', model, apiKeys: { unsloth: 'renderer-key' } },
        onStatus() {}, abortSignal: new AbortController().signal, useTools: false, tools: [], isElectronProxy: false,
    });
    assert.equal(provider.shouldFallback(new Error('Unsloth HTTP 400: request (9642 tokens) exceeds the available context size (8192 tokens)')), false);
    assert.equal(provider.shouldFallback(new Error('Unsloth HTTP 400: context_length_exceeded')), false);
    assert.equal(provider.shouldFallback(new Error('Unsloth HTTP 400: tools are not supported')), true);
    if (model === 'fixture-sse-null-error') {
        const result = await provider.streamRequest([{ role: 'user', content: 'hola' }]);
        assert.equal(result.content, 'Sin error');
        assert.equal(result.finishReason, 'stop');
    } else {
        await assert.rejects(provider.streamRequest([{ role: 'user', content: 'provoca el error' }]), /El contexto no cabe en la ventana efectiva/);
    }
    assert.equal(listeners.size, 0);
});
}

test('keyless discovery omits Authorization, 401 is actionable, redirects never receive a key', async t => {
    const fixture = await serverFixture(t);
    await unsloth.fetchUnslothModels({ configuredUrl: fixture.url, apiKey: '' });
    assert.equal(fixture.requests[0].authorization, undefined);
    assert.equal(unsloth.unslothHeaders('••••••••').Authorization, undefined);
    await assert.rejects(unsloth.fetchUnslothModels({ configuredUrl: `${fixture.url}/rejected/v1`, apiKey: '' }), /Keyless API Access/);
    await assert.rejects(unsloth.fetchUnslothModels({ configuredUrl: `${fixture.url}/rejected/v1`, apiKey: 'bad' }), /rechazó/);
    await assert.rejects(unsloth.fetchUnslothModels({ configuredUrl: `${fixture.url}/redirect/v1`, apiKey: 'fixture-key' }), /No se pudo conectar/);
    const main = mainHandlers(`${fixture.url}/redirect/v1`, 'fixture-key');
    const result = await main.handlers.get('api-stream')(main.event, { provider: 'unsloth', model: 'fixture', body: {}, streamId: 'redirect' });
    assert.equal(result.ok, false);
    assert.equal(fixture.requests.some(request => request.url === '/never-follow-with-key'), false);
});
