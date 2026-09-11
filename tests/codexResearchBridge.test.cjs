const test = require('node:test');
const assert = require('node:assert/strict');
const { createCodexResearchBridge } = require('../electron/services/codexResearchBridge.cjs');
const { createUnslothResearchBridge } = require('../electron/services/unslothResearchBridge.cjs');
const { prepareDeepResearchExecution } = require('../electron/services/SkillSecretBridge.cjs');

test('Codex Deep Research bridge authenticates locally and converts native tool calls', async () => {
  const requests = [];
  const service = {
    stream: async (request, _onEvent, signal) => {
      requests.push(request);
      assert.equal(signal.aborted, false);
      return {
        content: '',
        toolCalls: [{ id: 'call-1', type: 'function', function: { name: 'submit_plan', arguments: '{"ok":true}' } }],
        usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
      };
    },
  };
  const bridge = createCodexResearchBridge({ service });
  const connection = await bridge.start();
  const tool = {
    type: 'function',
    function: {
      name: 'submit_plan',
      description: 'Submit a plan.',
      parameters: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
    },
  };

  const unauthorized = await fetch(connection.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer wrong' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Plan' }], tools: [tool] }),
  });
  assert.equal(unauthorized.status, 401);

  const response = await fetch(connection.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${connection.token}` },
    body: JSON.stringify({
      model: 'gpt-test',
      messages: [{ role: 'system', content: 'Use the tool.' }, { role: 'user', content: 'Plan' }],
      tools: [tool],
    }),
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.choices[0].message.tool_calls, [{
    id: 'call-1', type: 'function', function: { name: 'submit_plan', arguments: '{"ok":true}' },
  }]);
  assert.equal(payload.choices[0].finish_reason, 'tool_calls');
  assert.deepEqual(requests[0].tools, [tool]);
  await bridge.close();
});

test('Deep Research prepares Codex bridge credentials without forwarding API keys', () => {
  const prepared = prepareDeepResearchExecution({
    reviewedBuiltin: true,
    args: {
      _runtime: { provider: 'codex', model: 'gpt-test' },
      _config: { provider: 'codex', model: 'gpt-test', apiKeys: { codex: 'should-not-forward' } },
    },
    apiKeys: { codex: 'should-not-forward' },
    codexBridge: {
      url: 'http://127.0.0.1:43123/v1/chat/completions',
      token: 'a'.repeat(64),
    },
  });

  assert.equal(prepared.env.MIKU_LLM_PROVIDER, 'codex');
  assert.equal(prepared.env.MIKU_LLM_MODEL, 'gpt-test');
  assert.equal(prepared.env.MIKU_CODEX_BRIDGE_URL, 'http://127.0.0.1:43123/v1/chat/completions');
  assert.equal(prepared.env.MIKU_CODEX_BRIDGE_TOKEN, 'a'.repeat(64));
  assert.deepEqual(prepared.args._config.apiKeys, {});
  assert.equal(prepared.args._runtime, undefined);
});

test('Unsloth Deep Research bridge keeps its API key in Electron and adapts OpenAI tool calls', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        choices: [{ message: {
          content: '',
          tool_calls: [{ id: 'unsloth-call', type: 'function', function: { name: 'submit_plan', arguments: '{"ok":true}' } }],
        } }],
        usage: { prompt_tokens: 4, completion_tokens: 3, total_tokens: 7 },
      }),
    };
  };
  const bridge = createUnslothResearchBridge({
    configuredUrl: 'http://127.0.0.1:8888/v1',
    apiKey: 'unsloth-vault-key',
    fetchImpl,
  });
  const connection = await bridge.start();
  const response = await fetch(connection.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${connection.token}` },
    body: JSON.stringify({
      model: 'local-model',
      messages: [{ role: 'user', content: 'Plan' }],
      tools: [{ type: 'function', function: {
        name: 'submit_plan', description: 'Submit.', parameters: { type: 'object' },
      } }],
    }),
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.choices[0].message.tool_calls[0].function.name, 'submit_plan');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'http://127.0.0.1:8888/v1/chat/completions');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer unsloth-vault-key');
  await bridge.close();
});

test('Unsloth Deep Research bridge loads an unloaded model and retries with the active default', async () => {
  const requests = [];
  let chatAttempts = 0;
  const jsonResponse = (status, payload) => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  });
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    requests.push({ path: parsed.pathname, method: options.method || 'GET', body: options.body && JSON.parse(options.body) });
    if (parsed.pathname === '/v1/chat/completions') {
      chatAttempts += 1;
      if (chatAttempts === 1) return jsonResponse(503, { error: { message: 'model not loaded' } });
      return jsonResponse(200, { choices: [{ message: { content: '', tool_calls: [{
        id: 'loaded-call', type: 'function', function: { name: 'submit_plan', arguments: '{"ok":true}' },
      }] } }] });
    }
    if (parsed.pathname === '/v1/models') return jsonResponse(200, { data: [{ id: 'local-model' }] });
    if (parsed.pathname.startsWith('/api/models/')) return jsonResponse(200, { data: [] });
    if (parsed.pathname === '/api/chat/settings') return jsonResponse(200, { settings: {} });
    if (parsed.pathname === '/api/settings/openai-auto-switch/overrides') return jsonResponse(200, {});
    if (parsed.pathname === '/api/inference/load') return jsonResponse(200, { ok: true });
    if (parsed.pathname === '/api/inference/status') return jsonResponse(200, {});
    return jsonResponse(404, { error: 'missing fixture route' });
  };
  const bridge = createUnslothResearchBridge({
    configuredUrl: 'http://127.0.0.1:8888/v1',
    apiKey: '',
    fetchImpl,
  });
  const connection = await bridge.start();
  const response = await fetch(connection.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${connection.token}` },
    body: JSON.stringify({
      model: 'local-model',
      messages: [{ role: 'user', content: 'Plan' }],
      tools: [{ type: 'function', function: {
        name: 'submit_plan', description: 'Submit.', parameters: { type: 'object' },
      } }],
    }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).choices[0].message.tool_calls[0].id, 'loaded-call');
  assert.equal(chatAttempts, 2);
  assert.deepEqual(requests.map(request => `${request.method} ${request.path}`), [
    'POST /v1/chat/completions', 'GET /v1/models', 'GET /api/models/local',
    'GET /api/models/cached-gguf', 'GET /api/models/list', 'GET /api/chat/settings',
    'GET /api/settings/openai-auto-switch/overrides', 'POST /api/inference/load',
    'GET /api/inference/status', 'POST /v1/chat/completions',
  ]);
  assert.equal(requests[7].body.model_path, 'local-model');
  assert.equal(requests[9].body.model, 'default');
  await bridge.close();
});

test('Deep Research prepares an Unsloth bridge without forwarding its API key to Python', () => {
  const prepared = prepareDeepResearchExecution({
    reviewedBuiltin: true,
    args: { _runtime: { provider: 'unsloth', model: 'local-model' } },
    apiKeys: { unsloth: 'unsloth-vault-key' },
    unslothBridge: {
      url: 'http://127.0.0.1:43124/v1/chat/completions',
      token: 'b'.repeat(64),
    },
  });

  assert.equal(prepared.env.MIKU_LLM_PROVIDER, 'unsloth');
  assert.equal(prepared.env.MIKU_LLM_MODEL, 'local-model');
  assert.equal(prepared.env.MIKU_UNSLOTH_BRIDGE_URL, 'http://127.0.0.1:43124/v1/chat/completions');
  assert.equal(prepared.env.MIKU_UNSLOTH_BRIDGE_TOKEN, 'b'.repeat(64));
  assert.equal(prepared.env.MIKU_LLM_CREDENTIAL, undefined);
  assert.deepEqual(prepared.args._config.apiKeys, {});
});

test('Deep Research rejects Codex when its local bridge is unavailable', () => {
  assert.throws(() => prepareDeepResearchExecution({
    reviewedBuiltin: true,
    args: { _runtime: { provider: 'codex', model: 'gpt-test' } },
  }), error => error.code === 'LLM_BRIDGE_UNAVAILABLE');
});
