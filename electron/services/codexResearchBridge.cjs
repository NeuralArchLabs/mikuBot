'use strict';

const http = require('node:http');
const { randomBytes, randomUUID } = require('node:crypto');

const MAX_BODY_BYTES = 8 * 1024 * 1024;
const BRIDGE_PATH = '/v1/chat/completions';

function responseJson(response, statusCode, payload) {
    if (response.writableEnded) return;
    const body = JSON.stringify(payload);
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
    });
    response.end(body);
}

function readJsonBody(request) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let length = 0;
        let settled = false;

        const fail = error => {
            if (settled) return;
            settled = true;
            reject(error);
        };

        request.on('data', chunk => {
            if (settled) return;
            length += chunk.length;
            if (length > MAX_BODY_BYTES) {
                const error = new Error('Codex Deep Research request is too large.');
                error.code = 'REQUEST_TOO_LARGE';
                request.resume();
                fail(error);
                return;
            }
            chunks.push(chunk);
        });
        request.on('aborted', () => fail(new Error('Codex Deep Research request was aborted.')));
        request.on('error', fail);
        request.on('end', () => {
            if (settled) return;
            settled = true;
            try {
                const text = Buffer.concat(chunks).toString('utf8');
                resolve(text ? JSON.parse(text) : {});
            } catch {
                const error = new Error('Codex Deep Research sent invalid JSON.');
                error.code = 'INVALID_JSON';
                reject(error);
            }
        });
    });
}

function validRequest(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
    if (!Array.isArray(payload.messages) || payload.messages.length === 0) return false;
    if (!Array.isArray(payload.tools) || payload.tools.length !== 1) return false;
    const tool = payload.tools[0];
    return tool?.type === 'function'
        && typeof tool.function?.name === 'string'
        && /^[A-Za-z0-9_-]{1,96}$/.test(tool.function.name)
        && typeof tool.function?.parameters === 'object'
        && tool.function.parameters !== null;
}

function toOpenAiToolCalls(toolCalls) {
    return (Array.isArray(toolCalls) ? toolCalls : [])
        .filter(call => call?.function?.name)
        .map((call, index) => ({
            id: typeof call.id === 'string' && call.id ? call.id : `codex_call_${index + 1}`,
            type: 'function',
            function: {
                name: call.function.name,
                arguments: typeof call.function.arguments === 'string'
                    ? call.function.arguments
                    : JSON.stringify(call.function.arguments || {}),
            },
        }));
}

/**
 * Exposes one short-lived, loopback-only OpenAI-compatible endpoint so the
 * bundled Python skill can use the authenticated Codex app-server without
 * receiving or reading Codex credentials.
 */
function createCodexResearchBridge({ service, host = '127.0.0.1', serverFactory = http.createServer, bridgeName = 'Codex' } = {}) {
    if (!service || typeof service.stream !== 'function') {
        throw new Error(`${bridgeName} Deep Research bridge requires a provider service.`);
    }

    const token = randomBytes(32).toString('hex');
    const activeRequests = new Set();
    let server = null;
    let started = false;
    let closing = null;

    const handleRequest = async (request, response) => {
        if (request.method !== 'POST' || request.url?.split('?')[0] !== BRIDGE_PATH) {
            responseJson(response, 404, { error: { message: 'Not found.' } });
            return;
        }
        if (request.headers.authorization !== `Bearer ${token}`) {
            responseJson(response, 401, { error: { message: 'Invalid Codex bridge token.' } });
            return;
        }

        let payload;
        try {
            payload = await readJsonBody(request);
        } catch (error) {
            responseJson(response, error.code === 'REQUEST_TOO_LARGE' ? 413 : 400, {
                error: { message: error.message },
            });
            return;
        }
        if (!validRequest(payload)) {
            responseJson(response, 400, {
                error: { message: 'Codex Deep Research requires messages and exactly one valid function tool.' },
            });
            return;
        }

        const controller = new AbortController();
        activeRequests.add(controller);
        const abortIfDisconnected = () => {
            if (!response.writableEnded) controller.abort();
        };
        request.on('aborted', abortIfDisconnected);
        response.on('close', abortIfDisconnected);

        try {
            const result = await service.stream({
                model: typeof payload.model === 'string' ? payload.model : '',
                messages: payload.messages,
                tools: payload.tools,
                useTools: true,
                summary: 'none',
            }, undefined, controller.signal);
            if (response.writableEnded || controller.signal.aborted) return;

            const toolCalls = toOpenAiToolCalls(result?.toolCalls);
            responseJson(response, 200, {
                id: `chatcmpl-codex-${randomUUID()}`,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: payload.model || '',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: typeof result?.content === 'string' ? result.content : '',
                        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
                    },
                    finish_reason: toolCalls.length ? 'tool_calls' : 'stop',
                }],
                ...(result?.usage ? { usage: result.usage } : {}),
            });
        } catch (error) {
            if (response.writableEnded || controller.signal.aborted) return;
            responseJson(response, 502, { error: { message: error?.message || 'Codex request failed.' } });
        } finally {
            activeRequests.delete(controller);
        }
    };

    const start = () => {
        if (started && server?.address()) {
            const address = server.address();
            return Promise.resolve({
                url: `http://${host}:${address.port}${BRIDGE_PATH}`,
                token,
            });
        }
        if (closing) return closing.then(() => start());
        server = serverFactory((request, response) => {
            void handleRequest(request, response);
        });
        return new Promise((resolve, reject) => {
            const onError = error => {
                server?.off('listening', onListening);
                reject(error);
            };
            const onListening = () => {
                server?.off('error', onError);
                const address = server.address();
                if (!address || typeof address === 'string') {
                    reject(new Error('Codex Deep Research bridge did not expose a TCP port.'));
                    return;
                }
                started = true;
                resolve({ url: `http://${host}:${address.port}${BRIDGE_PATH}`, token });
            };
            server.once('error', onError);
            server.once('listening', onListening);
            server.listen(0, host);
        });
    };

    const close = () => {
        if (closing) return closing;
        for (const controller of activeRequests) controller.abort();
        if (!server || !started) {
            started = false;
            return Promise.resolve();
        }
        closing = new Promise(resolve => {
            server.close(() => {
                started = false;
                server = null;
                closing = null;
                resolve();
            });
        });
        return closing;
    };

    return { start, close };
}

module.exports = { createCodexResearchBridge };
