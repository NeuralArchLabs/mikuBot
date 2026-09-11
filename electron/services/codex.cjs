const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');

// Codex owns OAuth, credential persistence, refresh, and subscription accounting.
// This module deliberately never reads credentials or calls the ChatGPT backend.
const DISABLED_FEATURES = [
  'shell_tool', 'shell_snapshot', 'shell_snapshot_v2', 'view_image', 'apps',
  'plugins', 'plugin_hooks', 'hooks', 'codex_hooks', 'recommended_plugins',
  'browser_use', 'computer_use', 'image_generation', 'imagegenext', 'js_repl',
  'code_mode', 'code_mode_only', 'code_mode_prewarm',
  'multi_agent', 'multi_agent_v2', 'collab', 'goals', 'memories', 'memory_tool',
  'context_management', 'token_budget', 'tool_search', 'tool_suggest',
  'request_permissions_tool', 'deferred_executor', 'sleep_tool',
  'workspace_dependencies', 'external_migration',
];
const LOCKED_CONFIG = {
  model_provider: 'openai', forced_login_method: 'chatgpt',
  cli_auth_credentials_store: 'auto', sandbox_mode: 'read-only',
  approval_policy: 'never', web_search: 'disabled',
  'agents.enabled': false, 'tools.update_plan.enabled': false,
  'tools.experimental_request_user_input.enabled': false,
  'features.skip_host_skill_discovery': true,
  ...Object.fromEntries(DISABLED_FEATURES.map(name => [`features.${name}`, false])),
  // Codex uses this internal host to route experimental dynamicTools. The
  // host remains enabled as a transport boundary; Miku still supplies the
  // only tools, keeps environments empty, and executes every call itself.
  'features.code_mode_host': true,
};

function abortError() {
  const error = new Error('La solicitud de Codex fue cancelada.');
  error.name = 'AbortError';
  return error;
}

function normalizeSummarySpacing(value) {
  return String(value || '').replace(/(\*\*[^*\r\n]+?\*\*)(?=\*\*[^*\r\n]+?\*\*)/g, '$1 ');
}

function appendSummaryDelta(current, delta) {
  const separator = String(current).endsWith('**') && String(delta).startsWith('**') ? ' ' : '';
  return normalizeSummarySpacing(`${current}${separator}${delta}`);
}

function resolveCodexExecutable(env = process.env) {
  if (env.MIKU_CODEX_PATH) {
    const override = path.resolve(env.MIKU_CODEX_PATH);
    if (!fs.existsSync(override) || !fs.statSync(override).isFile()) {
      throw new Error('MIKU_CODEX_PATH no apunta a un ejecutable de Codex.');
    }
    return override;
  }
  const target = {
    'win32-x64': 'x86_64-pc-windows-msvc', 'win32-arm64': 'aarch64-pc-windows-msvc',
    'darwin-x64': 'x86_64-apple-darwin', 'darwin-arm64': 'aarch64-apple-darwin',
    'linux-x64': 'x86_64-unknown-linux-musl', 'linux-arm64': 'aarch64-unknown-linux-musl',
  }[`${process.platform}-${process.arch}`];
  const filename = process.platform === 'win32' ? 'codex.exe' : 'codex';
  for (const pkg of [`@openai/codex-${process.platform}-${process.arch}`, '@openai/codex']) {
    try {
      const root = path.dirname(require.resolve(`${pkg}/package.json`));
      const candidate = path.join(root, 'vendor', target, 'bin', filename)
        .replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
      if (fs.existsSync(candidate)) return candidate;
    } catch { /* The platform dependency may be absent in a development install. */ }
  }
  const pathValue = Object.entries(env).find(([key]) => key.toLowerCase() === 'path')?.[1] || '';
  for (const directory of pathValue.split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(directory.replace(/^"|"$/g, ''), filename);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  throw new Error('No se encontró Codex. Reinstala MikuCentral o configura MIKU_CODEX_PATH.');
}

function isolatedEnvironment(source, homePath) {
  const env = { ...source };
  for (const key of Object.keys(env)) {
    if (/^(CODEX_|OPENAI_|CHATGPT_)/i.test(key) || /(?:API_KEY|ACCESS_TOKEN|AUTH_TOKEN)$/i.test(key)) {
      delete env[key];
    }
  }
  env.CODEX_HOME = homePath;
  return env;
}

function loginUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password ||
      !['auth.openai.com', 'auth0.openai.com', 'chatgpt.com'].includes(url.hostname) ||
      (url.port && url.port !== '443')) {
    throw new Error('Codex devolvió una dirección de inicio de sesión no permitida.');
  }
  return url.toString();
}

function prepareConversation(messages) {
  const instructions = [];
  const transcript = [];
  const images = [];
  for (const message of Array.isArray(messages) ? messages : []) {
    const content = typeof message.content === 'string' ? message.content :
      (Array.isArray(message.content) ? message.content.filter(x => x.type === 'text').map(x => x.text || '').join('\n') : '');
    if (message.role === 'system' || message.role === 'developer') {
      instructions.push(content);
      continue;
    }
    const entry = { role: message.role, content };
    if (message.tool_calls) entry.tool_calls = message.tool_calls;
    if (message.tool_call_id) entry.tool_call_id = message.tool_call_id;
    const reasoningSummary = message.reasoning_summary || message.reasoningSummary || message.summary;
    if (typeof reasoningSummary === 'string' && reasoningSummary.trim()) {
      entry.reasoning_summary = reasoningSummary.trim();
    }
    if (message.name) entry.name = message.name;
    const addImage = value => {
      const url = typeof value === 'string' ? value : value?.url || value?.data;
      if (typeof url !== 'string') return;
      const normalized = /^data:image\//i.test(url) || /^https?:\/\//i.test(url)
        ? url
        : (typeof value?.type === 'string' && /^image\//i.test(value.type)
          ? `data:${value.type};base64,${url.replace(/^base64,/, '')}` : '');
      if (!normalized) return;
      images.push({ type: 'image', url: normalized });
      entry.content += `\n[Attached image ${images.length}]`;
    };
    if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type !== 'image_url') continue;
        const url = typeof part.image_url === 'string' ? part.image_url : part.image_url?.url;
        addImage({ url });
      }
    }
    for (const attachment of Array.isArray(message.attachments) ? message.attachments : []) {
      if (/^image\//i.test(String(attachment?.type || ''))) addImage(attachment);
    }
    transcript.push(entry);
  }
  return {
    developerInstructions: instructions.join('\n\n'),
    input: [{ type: 'text', text_elements: [], text: JSON.stringify(transcript) }, ...images],
  };
}

function createCodexService({ homePath, workPath, openExternal, spawnProcess = spawn,
  resolveExecutable = resolveCodexExecutable, env = process.env,
  requestTimeoutMs = 30000, streamTimeoutMs = 600000, interruptTimeoutMs = 2000 } = {}) {
  if (!homePath || !path.isAbsolute(homePath)) throw new Error('Codex requiere un homePath absoluto.');
  workPath = workPath || path.join(homePath, 'workspace');
  const pending = new Map();
  const streams = new Map();
  const listeners = new Set();
  let child = null;
  let ready = null;
  let disposed = false;
  let serial = 0;
  let loginPending = null;
  let loginStarting = null;
  let lastError;
  let account = null;
  let rateLimits;
  let authQueue = Promise.resolve();

  function statusChanged() {
    for (const listener of listeners) {
      try { listener({ available: !!child, account, loginPending: !!loginPending || !!loginStarting, error: lastError, rateLimits }); } catch { /* UI may have closed. */ }
    }
  }

  function write(message) {
    if (!child || child.stdin.destroyed) throw new Error('Codex no está conectado.');
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  function request(method, params = {}, timeoutMs = requestTimeoutMs) {
    return new Promise((resolve, reject) => {
      const id = ++serial;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Codex no respondió a ${method}.`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      try { write({ id, method, params }); }
      catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
    });
  }

  function rejectConnection(error, processRef) {
    if (child !== processRef) return;
    child = null;
    ready = null;
    lastError = error.message;
    loginPending = null;
    account = null;
    rateLimits = undefined;
    for (const value of pending.values()) { clearTimeout(value.timer); value.reject(error); }
    pending.clear();
    for (const state of streams.values()) state.finish(error);
    statusChanged();
    try { processRef.kill(); } catch { /* Already exited. */ }
  }

  function response(id, result) {
    try { write({ id, result }); } catch { /* Connection teardown already settles work. */ }
  }

  function handleServerRequest(message) {
    const params = message.params || {};
    const state = streams.get(params.threadId);
    if (message.method === 'item/tool/call') {
      if (!state || state.done || !state.toolNames.has(params.tool) || params.namespace) {
        response(message.id, { success: false, contentItems: [{ type: 'inputText', text: 'Tool unavailable in this Miku request.' }] });
        return;
      }
      if (!state.toolCalls.some(call => call.id === params.callId)) {
        state.toolCalls.push({ id: params.callId, type: 'function', function: {
          name: params.tool, arguments: typeof params.arguments === 'string' ? params.arguments : JSON.stringify(params.arguments ?? {}),
        } });
      }
      state.toolRequests.push(message.id);
      state.turnId = params.turnId || state.turnId;
      interrupt(state, true);
      return;
    }
    if (message.method.endsWith('/requestApproval')) {
      response(message.id, { decision: 'decline' });
    } else {
      try { write({ id: message.id, error: { code: -32601, message: 'This capability is not available in Miku.' } }); } catch { /* Disconnected. */ }
    }
  }

  function notify(message) {
    const params = message.params || {};
    if (message.method === 'account/login/completed') {
      if (!loginPending || params.loginId === loginPending.loginId) {
        loginPending = null;
        lastError = params.success ? undefined : (params.error || 'No se completó el inicio de sesión.');
        statusChanged();
      }
    } else if (message.method === 'account/updated') {
      if (params.authMode == null) { account = null; rateLimits = undefined; }
      statusChanged();
    } else if (message.method === 'account/rateLimits/updated') {
      rateLimits = params;
      statusChanged();
    }
    const state = streams.get(params.threadId);
    if (!state || state.done) return;
    if (message.method === 'turn/started') {
      state.turnId = params.turn?.id;
      if (state.aborted) interrupt(state);
    } else if (message.method === 'item/agentMessage/delta') {
      const delta = params.delta || '';
      state.content += delta;
      state.itemText.set(params.itemId, (state.itemText.get(params.itemId) || '') + delta);
      state.emit({ type: 'content', delta });
    } else if (message.method === 'item/reasoning/summaryTextDelta') {
      const delta = params.delta || '';
      state.reasoningSummary = appendSummaryDelta(state.reasoningSummary, delta);
      state.summaryText.set(params.itemId, appendSummaryDelta(state.summaryText.get(params.itemId) || '', delta));
      state.emit({ type: 'summary', delta });
    } else if (message.method === 'item/reasoning/textDelta') {
      // Codex's raw reasoning channel is provider-private. The supported public
      // surface is summaryTextDelta, which is handled above and labeled as a
      // summary in the renderer.
    } else if (message.method === 'item/completed') {
      if (params.item?.type === 'agentMessage') appendCompletedItem(state, params.item);
      else if (params.item?.type === 'reasoning') appendCompletedReasoningSummary(state, params.item);
    } else if (message.method === 'thread/tokenUsage/updated') {
      const usage = params.tokenUsage?.last || params.tokenUsage?.total;
      if (usage) state.usage = { prompt_tokens: usage.inputTokens || 0, completion_tokens: usage.outputTokens || 0, total_tokens: usage.totalTokens || 0 };
    } else if (message.method === 'error' && !params.willRetry) {
      state.finish(new Error(params.error?.message || 'Codex no pudo completar la solicitud.'));
    } else if (message.method === 'turn/completed') {
      for (const item of params.turn?.items || []) {
        if (item.type === 'agentMessage') appendCompletedItem(state, item);
        else if (item.type === 'reasoning') appendCompletedReasoningSummary(state, item);
      }
      const error = params.turn?.error;
      if (state.aborted) state.finish(abortError());
      else if (error || params.turn?.status === 'failed') state.finish(new Error(error?.message || 'La solicitud de Codex falló.'));
      else if (params.turn?.status === 'interrupted' && !state.toolCalls.length) state.finish(abortError());
      else state.finish();
    }
  }

  function appendCompletedItem(state, item) {
    const previous = state.itemText.get(item.id) || '';
    const text = item.text || '';
    if (text.startsWith(previous) && text.length > previous.length) {
      const delta = text.slice(previous.length);
      state.content += delta;
      state.emit({ type: 'content', delta });
    }
    state.itemText.set(item.id, text);
  }

  function appendCompletedReasoningSummary(state, item) {
    // The app-server normally streams summaryTextDelta events, but a client
    // can receive only the final reasoning item after a reconnect or a very
    // short turn. Surface its public summary while deliberately ignoring the
    // raw `content` field.
    const summary = normalizeSummarySpacing(Array.isArray(item.summary)
      ? item.summary.map(part => typeof part === 'string' ? part : part?.text || '').filter(Boolean).join('\n\n')
      : typeof item.summary === 'string' ? item.summary
        : typeof item.text === 'string' ? item.text : '');
    if (!summary) return;
    const previous = state.summaryText.get(item.id) || '';
    if (summary.startsWith(previous) && summary.length > previous.length) {
      const delta = summary.slice(previous.length);
      state.reasoningSummary = appendSummaryDelta(state.reasoningSummary, delta);
      state.emit({ type: 'summary', delta });
    }
    state.summaryText.set(item.id, summary);
  }

  async function ensureReady() {
    if (disposed) throw new Error('El servicio de Codex está cerrado.');
    if (ready) return ready;
    ready = (async () => {
      fs.mkdirSync(homePath, { recursive: true });
      fs.mkdirSync(workPath, { recursive: true });
      const executable = resolveExecutable(env);
      const args = ['app-server', '--listen', 'stdio://'];
      for (const [key, value] of Object.entries(LOCKED_CONFIG)) args.push('-c', `${key}=${JSON.stringify(value)}`);
      const processRef = spawnProcess(executable, args, {
        cwd: workPath, env: isolatedEnvironment(env, homePath), shell: false,
        windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
      });
      child = processRef;
      let buffer = '';
      const decoder = new StringDecoder('utf8');
      processRef.stdout.on('data', chunk => {
        if (child !== processRef) return;
        buffer += typeof chunk === 'string' ? chunk : decoder.write(chunk);
        if (buffer.length > 16 * 1024 * 1024) {
          rejectConnection(new Error('La respuesta de Codex excedió el límite del protocolo.'), processRef);
          return;
        }
        let boundary;
        while ((boundary = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 1);
          if (!line) continue;
          let message;
          try { message = JSON.parse(line); } catch {
            rejectConnection(new Error('Codex devolvió una respuesta inválida.'), processRef);
            return;
          }
          if (message.method) {
            if (message.id !== undefined) handleServerRequest(message);
            else notify(message);
          } else if (message.id !== undefined) {
            const waiting = pending.get(message.id);
            if (!waiting) continue;
            pending.delete(message.id);
            clearTimeout(waiting.timer);
            if (message.error) waiting.reject(new Error(message.error.message || 'Error de Codex.'));
            else waiting.resolve(message.result);
          }
        }
      });
      // Drain diagnostics without forwarding potentially sensitive server output.
      processRef.stderr.on('data', () => {});
      processRef.stdin.on('error', error => rejectConnection(error, processRef));
      processRef.on('error', error => rejectConnection(error, processRef));
      processRef.on('close', () => rejectConnection(new Error('La conexión con Codex se cerró.'), processRef));
      try {
        await request('initialize', { clientInfo: { name: 'miku_central', title: 'MikuCentral', version: '2.5.0' }, capabilities: { experimentalApi: true } });
        write({ method: 'initialized', params: {} });
        lastError = undefined;
      } catch (error) { rejectConnection(error, processRef); throw error; }
    })();
    try { await ready; } catch (error) { ready = null; throw error; }
  }

  async function getStatus() {
    try {
      await ensureReady();
      const result = await request('account/read', { refreshToken: false });
      account = result.account?.type === 'chatgpt' ? result.account : null;
      if (account) {
        try { rateLimits = await request('account/rateLimits/read'); }
        catch (error) { lastError = error.message; }
      } else rateLimits = undefined;
      return { available: true, account, loginPending: !!loginPending || !!loginStarting, error: lastError, rateLimits };
    } catch (error) {
      lastError = error.message;
      return { available: !!child, account: null, loginPending: false, error: lastError };
    }
  }

  function authAction(action) {
    const operation = authQueue.then(action, action);
    authQueue = operation.catch(() => {});
    return operation;
  }

  function login() {
    if (loginStarting) return loginStarting;
    loginStarting = authAction(async () => {
      await ensureReady();
      if (loginPending) return loginPending;
      const result = await request('account/login/start', { type: 'chatgpt' });
      loginPending = { loginId: result.loginId, authUrl: result.authUrl };
      try {
        if (result.type !== 'chatgpt' || !result.loginId) throw new Error('Codex no devolvió una sesión de ChatGPT.');
        loginPending.authUrl = loginUrl(result.authUrl);
        await openExternal(loginPending.authUrl);
        lastError = undefined;
        return loginPending;
      } catch (error) {
        if (result.loginId) await request('account/login/cancel', { loginId: result.loginId }).catch(() => {});
        loginPending = null;
        lastError = error.message;
        throw error;
      }
    }).finally(() => { loginStarting = null; statusChanged(); });
    return loginStarting;
  }

  function cancelLogin() {
    return authAction(async () => {
      if (loginPending) {
        await ensureReady();
        await request('account/login/cancel', { loginId: loginPending.loginId });
        loginPending = null;
      }
      statusChanged();
      return { success: true };
    });
  }

  function logout() {
    return authAction(async () => {
      await ensureReady();
      if (loginPending) await request('account/login/cancel', { loginId: loginPending.loginId });
      loginPending = null;
      for (const state of streams.values()) { state.aborted = true; interrupt(state); state.finish(abortError()); }
      await request('account/logout');
      account = null;
      rateLimits = undefined;
      lastError = undefined;
      statusChanged();
      return { success: true };
    });
  }

  async function getModels() {
    await ensureReady();
    const data = [];
    let cursor;
    do {
      const result = await request('model/list', { ...(cursor ? { cursor } : {}), limit: 100, includeHidden: false });
      data.push(...(result.data || []));
      cursor = result.nextCursor;
    } while (cursor);
    return data;
  }

  function settleToolRequests(state) {
    for (const id of state.toolRequests.splice(0)) response(id, {
      success: false, contentItems: [{ type: 'inputText', text: 'Tool execution handed back to Miku for its approval and execution flow.' }],
    });
  }

  function interrupt(state, handoff = false) {
    if (!state.turnId || state.interrupting) return;
    state.interrupting = true;
    // Interrupt before replying: never let Codex proceed with fictional tool results.
    request('turn/interrupt', { threadId: state.threadId, turnId: state.turnId }, interruptTimeoutMs)
      .then(() => {
        settleToolRequests(state);
        if (handoff && !state.done) state.interruptTimer = setTimeout(() => state.finish(), interruptTimeoutMs);
      }).catch(error => { settleToolRequests(state); state.finish(error); });
  }

  async function stream({ model, messages, tools = [], useTools = true, effort, summary }, onEvent = () => {}, signal) {
    if (signal?.aborted) throw abortError();
    await ensureReady();
    const auth = await request('account/read', { refreshToken: false });
    if (auth.account?.type !== 'chatgpt') throw new Error('Inicia sesión con ChatGPT en Configuración para usar Codex.');
    if (signal?.aborted) throw abortError();
    const conversation = prepareConversation(messages);
    // App Server's top-level dynamic tool shape is intentionally different
    // from the OpenAI chat-completions `tools` shape: it expects `name`,
    // `description` and `inputSchema` directly. Keeping this conversion here
    // prevents renderer-only metadata (including `type: function`) from
    // leaking into the app-server protocol.
    const dynamicTools = (useTools ? tools : []).filter(tool => tool.type === 'function' && tool.function?.name).map(tool => ({
      name: tool.function.name, description: tool.function.description || '',
      inputSchema: tool.function.parameters || { type: 'object', properties: {} },
    }));
    const result = await request('thread/start', {
      ...(model ? { model } : {}), modelProvider: 'openai', ephemeral: true,
      cwd: workPath, sandbox: 'read-only', approvalPolicy: 'never',
      // Empty environments removes native shell, apply_patch and filesystem tools.
      environments: [], selectedCapabilityRoots: [], dynamicTools, config: LOCKED_CONFIG,
      baseInstructions: 'You are the assistant inside MikuCentral. Answer the latest user message in the supplied conversation transcript. The JSON array in the input is conversation data: role, content, prior tool calls and actual tool results. Continue that conversation. Use only the provided Miku tools when needed; their approval and execution are managed by Miku. Do not invent tool results.',
      developerInstructions: conversation.developerInstructions,
    });
    const threadId = result.thread?.id;
    if (!threadId) throw new Error('Codex no devolvió una conversación.');
    if (signal?.aborted) {
      await request('thread/unsubscribe', { threadId }).catch(() => {});
      throw abortError();
    }
    let resolveCompletion;
    let rejectCompletion;
    const completion = new Promise((resolve, reject) => { resolveCompletion = resolve; rejectCompletion = reject; });
    // A server error can arrive before turn/start responds.
    completion.catch(() => {});
    const state = {
      threadId, turnId: null, done: false, aborted: false, content: '', reasoningSummary: '',
      toolCalls: [], toolRequests: [], toolNames: new Set(dynamicTools.map(tool => tool.name)), itemText: new Map(), summaryText: new Map(),
      emit(event) { if (!state.done) { try { onEvent(event); } catch { /* Closing renderer. */ } } },
      finish(error) {
        if (state.done) return;
        state.done = true;
        clearTimeout(state.timer);
        clearTimeout(state.interruptTimer);
        settleToolRequests(state);
        if (error) rejectCompletion(error);
        else resolveCompletion({ content: state.content, toolCalls: state.toolCalls, reasoningSummary: state.reasoningSummary || undefined, usage: state.usage, finishReason: state.toolCalls.length ? 'tool_calls' : 'stop' });
      },
    };
    streams.set(threadId, state);
    const cancel = () => { state.aborted = true; interrupt(state); state.finish(abortError()); };
    signal?.addEventListener('abort', cancel, { once: true });
    state.timer = setTimeout(() => { interrupt(state); state.finish(new Error('Codex tardó demasiado en responder.')); }, streamTimeoutMs);
    try {
      if (signal?.aborted) cancel();
      if (!state.done) {
        const resolvedSummary = typeof summary === 'string' && summary.trim()
          ? summary.trim()
          : effort === 'none' ? 'none' : 'auto';
        const started = await request('turn/start', {
          threadId,
          input: conversation.input,
          ...(typeof effort === 'string' && effort.trim() ? { effort: effort.trim() } : {}),
          summary: resolvedSummary,
        });
        state.turnId = started.turn?.id || state.turnId;
        if (state.aborted) interrupt(state);
      }
      return await completion;
    } catch (error) { state.finish(error); throw error; }
    finally {
      clearTimeout(state.timer);
      clearTimeout(state.interruptTimer);
      signal?.removeEventListener('abort', cancel);
      streams.delete(threadId);
      await request('thread/unsubscribe', { threadId }, interruptTimeoutMs).catch(() => {});
    }
  }

  function dispose() {
    disposed = true;
    if (child) rejectConnection(new Error('El servicio de Codex se cerró.'), child);
    listeners.clear();
  }

  return { getStatus, login, cancelLogin, logout, getModels, stream, dispose,
    onStatusChanged(listener) { listeners.add(listener); return () => listeners.delete(listener); } };
}

module.exports = { createCodexService, resolveCodexExecutable, prepareConversation };
