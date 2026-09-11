'use strict';

const { createCodexResearchBridge } = require('./codexResearchBridge.cjs');
const {
    unslothEndpoint,
    unslothControlEndpoint,
    unslothHeaders,
    unslothHttpError,
    shouldLoadUnslothModel,
    unslothChatSettingsLoadSettings,
    fetchUnslothLoadSpec,
    fetchUnslothChatSettings,
    fetchUnslothLoadSettings,
    fetchUnslothRuntimeStatus,
    unslothLoadPayload,
} = require('./unsloth.cjs');

async function responseText(response) {
    try { return await response.text(); } catch { return ''; }
}

async function loadModel({ configuredUrl, requestedModel, apiKey, fetchImpl, signal }) {
    if (signal?.aborted) throw new Error('Unsloth Deep Research was cancelled.');
    const loadSpec = await fetchUnslothLoadSpec({ configuredUrl, requestedModel, apiKey, fetchImpl });
    const isGguf = /\.gguf$/i.test(String(loadSpec.model_path || '')) || !!loadSpec.gguf_variant;
    const chatSettings = await fetchUnslothChatSettings({ configuredUrl, apiKey, fetchImpl });
    const desktopSettings = unslothChatSettingsLoadSettings(chatSettings, isGguf);
    const rememberedSettings = await fetchUnslothLoadSettings({
        configuredUrl,
        loadSpec,
        requestedModel,
        apiKey,
        defaultSettings: desktopSettings,
        fetchImpl,
    });
    const loadPayload = unslothLoadPayload({ ...loadSpec, ...rememberedSettings });
    const loadResponse = await fetchImpl(unslothControlEndpoint(configuredUrl, 'api/inference/load'), {
        method: 'POST',
        headers: { ...unslothHeaders(apiKey), Accept: 'application/json' },
        body: JSON.stringify(loadPayload),
        redirect: 'error',
        signal,
    });
    const detail = await responseText(loadResponse);
    if (!loadResponse.ok) throw new Error(unslothHttpError(loadResponse.status, detail, !!apiKey?.trim()));
    if (!detail.trim()) throw new Error('Unsloth cerró la respuesta de carga antes de confirmar el modelo.');
    try {
        const result = JSON.parse(detail);
        const deferred = result?._deferred_error;
        if (deferred) throw new Error(unslothHttpError(Number(deferred.status_code) || 500, deferred.detail, !!apiKey?.trim()));
        if (result?.error || result?.detail || result?.status === 'error' || result?.ok === false) {
            throw new Error(result.error?.message || result.error || result.detail || 'Unsloth no pudo cargar el modelo.');
        }
    } catch (error) {
        if (error instanceof SyntaxError) throw new Error('Unsloth devolvió una respuesta de carga inválida.');
        throw error;
    }
    await fetchUnslothRuntimeStatus({ configuredUrl, apiKey, fetchImpl });
}

async function requestUnsloth({ configuredUrl, apiKey, request, fetchImpl, signal }) {
    const url = unslothEndpoint(configuredUrl, 'chat/completions');
    const headers = { ...unslothHeaders(apiKey), Accept: 'application/json' };
    const body = {
        model: request.model,
        messages: request.messages,
        stream: false,
        tools: request.tools,
        tool_choice: { type: 'function', function: { name: request.tools[0].function.name } },
        temperature: 0,
    };
    let response = await fetchImpl(url, {
        method: 'POST', headers, body: JSON.stringify(body), redirect: 'error', signal,
    });
    let detail = await responseText(response);
    if (!response.ok && shouldLoadUnslothModel(response.status, detail)) {
        await loadModel({ configuredUrl, requestedModel: request.model, apiKey, fetchImpl, signal });
        response = await fetchImpl(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ ...body, model: 'default' }),
            redirect: 'error',
            signal,
        });
        detail = await responseText(response);
    }
    if (!response.ok) throw new Error(unslothHttpError(response.status, detail, !!apiKey?.trim()));
    let payload;
    try { payload = detail ? JSON.parse(detail) : {}; }
    catch { throw new Error('Unsloth devolvió una respuesta JSON inválida.'); }
    const message = payload?.choices?.[0]?.message || {};
    const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    return {
        content: typeof message.content === 'string' ? message.content : '',
        toolCalls,
        usage: payload.usage,
    };
}

/** Uses Unsloth Desktop's OpenAI-compatible endpoint while keeping its key in Electron. */
function createUnslothResearchBridge({ configuredUrl, apiKey, fetchImpl = fetch, host, serverFactory } = {}) {
    const service = {
        stream: (request, _onEvent, signal) => requestUnsloth({ configuredUrl, apiKey, request, fetchImpl, signal }),
    };
    return createCodexResearchBridge({ service, host, serverFactory, bridgeName: 'Unsloth' });
}

module.exports = { createUnslothResearchBridge };
