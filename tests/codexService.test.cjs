const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createCodexService, prepareConversation } = require('../electron/services/codex.cjs');

class FakeStream extends EventEmitter {
  constructor(onWrite) { super(); this.onWrite = onWrite; this.destroyed = false; }
  write(value) { this.onWrite(String(value)); return true; }
}

function fakeServer({ account = null, models = [], onRequest } = {}) {
  const requests = [];
  const child = new EventEmitter();
  child.killed = false;
  child.kill = () => { child.killed = true; child.emit('close', 0); };
  let stdin;
  const send = message => queueMicrotask(() => child.stdout.emit('data', `${JSON.stringify(message)}\n`));
  stdin = new FakeStream(raw => {
    for (const line of raw.trim().split('\n').filter(Boolean)) {
      const message = JSON.parse(line);
      requests.push(message);
      if (message.method === 'initialize') send({ id: message.id, result: { userAgent: 'fake' } });
      if (message.method === 'account/read') send({ id: message.id, result: { account } });
      if (message.method === 'account/rateLimits/read') send({ id: message.id, result: { rateLimitsByLimitId: {} } });
      if (message.method === 'model/list') send({ id: message.id, result: { data: models, nextCursor: null } });
      if (message.method === 'account/login/start') send({ id: message.id, result: { type: 'chatgpt', loginId: 'login-1', authUrl: 'https://chatgpt.com/auth?state=x' } });
      if (message.method === 'account/login/cancel') send({ id: message.id, result: {} });
      if (message.method === 'account/logout') send({ id: message.id, result: {} });
      onRequest?.(message, send);
    }
  });
  child.stdin = stdin;
  child.stdout = new FakeStream(() => {});
  child.stderr = new FakeStream(() => {});
  return { child, requests };
}

function serviceFor(fake, extra = {}) {
  return createCodexService({
    homePath: 'C:\\miku\\codex-test', workPath: 'C:\\miku\\codex-work',
    openExternal: extra.openExternal || (async () => {}),
    resolveExecutable: () => 'C:\\miku\\codex.exe',
    spawnProcess: (_exe, args, options) => { fake.args = args; fake.options = options; return fake.child; },
    requestTimeoutMs: 500, interruptTimeoutMs: 100, streamTimeoutMs: 500,
    env: { ...process.env, OPENAI_API_KEY: 'must-not-forward', CODEX_HOME: 'must-not-forward' }
  });
}

test('app-server startup isolates credentials and reads account/model catalog', async () => {
  const fake = fakeServer({ account: { type: 'chatgpt', email: 'user@example.com', planType: 'plus' }, models: [{ model: 'gpt-6-astra', displayName: 'GPT-6 Astra', hidden: false }] });
  const service = serviceFor(fake);
  const status = await service.getStatus();
  assert.equal(status.available, true);
  assert.equal(status.account.email, 'user@example.com');
  assert.deepEqual((await service.getModels()).map(model => model.model), ['gpt-6-astra']);
  assert.equal(fake.options.shell, false);
  assert.equal(fake.options.windowsHide, true);
  assert.equal(fake.options.env.OPENAI_API_KEY, undefined);
  assert.equal(fake.options.env.CODEX_HOME.endsWith('codex-test'), true);
  assert.equal(fake.requests.some(request => request.method === 'initialized'), true);
  service.dispose();
});

test('dynamic Miku tools stay available through Codex code-mode host routing', async () => {
  const tool = {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    }
  };
  const fake = fakeServer({
    account: { type: 'chatgpt', email: 'user@example.com' },
    onRequest(message, send) {
      if (message.method === 'thread/start') {
        send({ id: message.id, result: { thread: { id: 'thread-tools' } } });
      } else if (message.method === 'turn/start') {
        send({ id: message.id, result: { turn: { id: 'turn-tools' } } });
        send({ method: 'turn/started', params: { threadId: 'thread-tools', turn: { id: 'turn-tools' } } });
        send({ id: 900, method: 'item/tool/call', params: {
          threadId: 'thread-tools', turnId: 'turn-tools', callId: 'call-tools',
          namespace: null, tool: 'web_search', arguments: { query: 'Codex tools' }
        } });
      } else if (message.method === 'turn/interrupt') {
        send({ id: message.id, result: {} });
        send({ method: 'turn/completed', params: { threadId: 'thread-tools', turn: { id: 'turn-tools', status: 'interrupted', items: [] } } });
      } else if (message.method === 'thread/unsubscribe') {
        send({ id: message.id, result: {} });
      }
    }
  });
  const service = serviceFor(fake);
  const result = await service.stream({
    model: 'gpt-6-astra',
    messages: [{ role: 'user', content: 'Search the web.' }],
    tools: [tool],
    useTools: true,
    effort: 'high',
    summary: 'auto'
  });
  const threadStart = fake.requests.find(request => request.method === 'thread/start');
  const turnStart = fake.requests.find(request => request.method === 'turn/start');
  assert.equal(fake.args.includes('features.code_mode_host=true'), true);
  assert.deepEqual(threadStart.params.dynamicTools, [{
    name: 'web_search', description: 'Search the web.', inputSchema: tool.function.parameters
  }]);
  assert.equal(threadStart.params.config['features.code_mode_host'], true);
  assert.equal(turnStart.params.effort, 'high');
  assert.equal(turnStart.params.summary, 'auto');
  assert.deepEqual(result.toolCalls, [{
    id: 'call-tools', type: 'function', function: { name: 'web_search', arguments: '{"query":"Codex tools"}' }
  }]);
  service.dispose();
});

test('surfaces the public reasoning summary when only the completed item arrives', async () => {
  const fake = fakeServer({
    account: { type: 'chatgpt', email: 'user@example.com' },
    onRequest(message, send) {
      if (message.method === 'thread/start') {
        send({ id: message.id, result: { thread: { id: 'thread-reasoning' } } });
      } else if (message.method === 'turn/start') {
        send({ id: message.id, result: { turn: { id: 'turn-reasoning' } } });
        send({ method: 'turn/started', params: { threadId: 'thread-reasoning', turn: { id: 'turn-reasoning' } } });
        send({ method: 'item/reasoning/textDelta', params: {
          threadId: 'thread-reasoning', turnId: 'turn-reasoning', itemId: 'reasoning-1', delta: 'private raw chain'
        } });
        send({ method: 'item/completed', params: {
          threadId: 'thread-reasoning', turnId: 'turn-reasoning', item: {
            id: 'reasoning-1', type: 'reasoning', summary: ['Plan', 'Check'], content: ['private raw chain']
          }
        }});
        send({ method: 'item/completed', params: {
          threadId: 'thread-reasoning', turnId: 'turn-reasoning', item: { id: 'answer-1', type: 'agentMessage', text: 'Done' }
        }});
        send({ method: 'turn/completed', params: {
          threadId: 'thread-reasoning', turn: { id: 'turn-reasoning', status: 'completed', items: [] }
        }});
      } else if (message.method === 'thread/unsubscribe') {
        send({ id: message.id, result: {} });
      }
    }
  });
  const service = serviceFor(fake);
  const events = [];
  const result = await service.stream({
    model: 'gpt-6-astra', messages: [{ role: 'user', content: 'Explain.' }], useTools: false
  }, event => events.push(event));
  assert.equal(result.content, 'Done');
  assert.equal(result.reasoningSummary, 'Plan\n\nCheck');
  assert.deepEqual(events.filter(event => event.type === 'summary').map(event => event.delta), ['Plan\n\nCheck']);
  service.dispose();
});

test('ChatGPT login validates and opens the official browser URL', async () => {
  const fake = fakeServer();
  const opened = [];
  const service = serviceFor(fake, { openExternal: async url => opened.push(url) });
  const login = await service.login();
  assert.deepEqual(login, { loginId: 'login-1', authUrl: 'https://chatgpt.com/auth?state=x' });
  assert.deepEqual(opened, ['https://chatgpt.com/auth?state=x']);
  service.dispose();
});

test('conversation preparation keeps system instructions separate and labels images', () => {
  const result = prepareConversation([
    { role: 'system', content: 'Use concise answers.' },
    { role: 'user', content: [{ type: 'text', text: 'What is this?' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AA==' } }] },
    { role: 'assistant', content: 'A picture.', reasoning_summary: 'Reviewed the image first.' }
  ]);
  assert.equal(result.developerInstructions, 'Use concise answers.');
  assert.match(result.input[0].text, /Attached image 1/);
  assert.deepEqual(result.input[1], { type: 'image', url: 'data:image/png;base64,AA==' });
  assert.match(result.input[0].text, /"reasoning_summary":"Reviewed the image first\."/);
});

test('conversation preparation forwards VisionService attachments as safe data URLs', () => {
  const result = prepareConversation([{ role: 'user', content: 'Describe this.', attachments: [{ type: 'image/jpeg', data: 'base64,BB==' }] }]);
  assert.equal(result.input.length, 2);
  assert.deepEqual(result.input[1], { type: 'image', url: 'data:image/jpeg;base64,BB==' });
  assert.match(result.input[0].text, /Attached image 1/);
});
