import test from 'node:test';
import assert from 'node:assert/strict';

import {
    canRecoverTextToolCalls,
    extractTextFallbackToolCalls,
    getToolCapabilityKey,
    getInitialToolTransport,
    injectTextToolFallbackInstruction,
    rememberNativeToolsUnsupported,
    normalizeThoughtDelimiters
} from '../src/services/core/toolTransport.ts';
import { validateStructuredToolCall } from '../src/services/core/tooling/toolCallValidation.ts';

const tools = [{
    type: 'function',
    function: {
        name: 'web_search',
        description: 'Search the web.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query.' },
                limit: { type: 'number', description: 'Result limit.' }
            },
            required: ['query']
        }
    }
}];

test('native mode never recovers executable calls from free-form text', () => {
    assert.equal(canRecoverTextToolCalls('native', 'content'), false);
    assert.equal(canRecoverTextToolCalls('native', 'reasoning'), false);
});

test('reasoning is never executable, including in text fallback mode', () => {
    assert.equal(canRecoverTextToolCalls('text-fallback', 'reasoning'), false);
    assert.equal(canRecoverTextToolCalls('text-fallback', 'content'), true);
});

test('tool transport starts native only when tools are enabled and available', () => {
    assert.equal(getInitialToolTransport(true, tools), 'native');
    assert.equal(getInitialToolTransport(false, tools), 'none');
    assert.equal(getInitialToolTransport(true, []), 'none');
});

test('native tool compatibility is remembered only for the rejected runtime capability', () => {
    const rejected = getToolCapabilityKey({ provider: 'ollama', model: 'legacy-test-model', ollamaUrl: 'http://one' });
    const independent = getToolCapabilityKey({ provider: 'ollama', model: 'legacy-test-model', ollamaUrl: 'http://two' });
    rememberNativeToolsUnsupported(rejected);
    assert.equal(getInitialToolTransport(true, tools, rejected), 'text-fallback');
    assert.equal(getInitialToolTransport(true, tools, independent), 'native');
});

test('structured calls are validated without aliases or semantic rewrites', () => {
    assert.equal(validateStructuredToolCall({ name: 'search_web', arguments: { query: 'AI' } }, tools).blocked, true);
    const valid = validateStructuredToolCall({ name: 'web_search', arguments: { query: 'delete' } }, tools);
    assert.equal(valid.blocked, false);
    assert.deepEqual(valid.toolCall.function.arguments, { query: 'delete' });
});

test('text fallback protocol is injected without mutating the original messages', () => {
    const messages = [{ role: 'system', content: 'Base system prompt.' }];
    const injected = injectTextToolFallbackInstruction(messages, tools);

    assert.equal(messages[0].content, 'Base system prompt.');
    assert.match(injected[0].content, /\[TEXT_TOOL_FALLBACK_PROTOCOL\]/);
    assert.match(injected[0].content, /web_search\(query\*, limit\)/);
    assert.match(injected[0].content, /Never place a tool call in reasoning/);
});

test('strict fallback parser accepts only a standalone explicit envelope', () => {
    const calls = extractTextFallbackToolCalls(
        '<tool_call>call:web_search{"query":"latest AI news","limit":5}</tool_call>',
        tools
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, 'web_search');
    assert.deepEqual(calls[0].arguments, { query: 'latest AI news', limit: 5 });
});

test('plain JSON and discussion of a tool never become executable', () => {
    assert.deepEqual(extractTextFallbackToolCalls(
        '{"name":"web_search","arguments":{"query":"example"}}',
        tools
    ), []);
    assert.deepEqual(extractTextFallbackToolCalls(
        'For example: <tool_call>call:web_search{"query":"example"}</tool_call>',
        tools
    ), []);
});

test('tool syntax inside reasoning or code fences is inert', () => {
    const envelope = '<tool_call>call:web_search{"query":"example"}</tool_call>';
    assert.deepEqual(extractTextFallbackToolCalls(`<thinking>${envelope}</thinking>`, tools), []);
    assert.deepEqual(extractTextFallbackToolCalls('```json\n' + envelope + '\n```', tools), []);
});

test('stream display preserves raw tool-like output while normalizing thought delimiters', () => {
    const envelope = '<tool_call>call:web_search{"query":"example"}</tool_call>';
    assert.equal(normalizeThoughtDelimiters(envelope), envelope);
    assert.equal(
        normalizeThoughtDelimiters(`<|thinking|>planning\n${envelope}<|end_of_thinking|>`),
        `<thinking>planning\n${envelope}</thinking>`
    );
});
