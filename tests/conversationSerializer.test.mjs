import test from 'node:test';
import assert from 'node:assert/strict';

import { blocksToAgentMessages } from '../src/services/core/conversationSerializer.ts';

function createToolBlocks(name, data) {
    return [
        { type: 'answer', content: 'I will use the tool.' },
        {
            type: 'tool_call',
            content: `Mode: ${name}`,
            status: 'success',
            toolCall: {
                id: 'call-1',
                function: { name, arguments: { query: 'example' } }
            },
            result: { success: true, data }
        },
        { type: 'answer', content: 'The completed answer.' }
    ];
}

test('historical web search output keeps sources but drops consumed full previews', () => {
    const repeatedContent = 'large extracted article '.repeat(1000);
    const blocks = createToolBlocks('web_search', {
        results: Array.from({ length: 10 }, (_, index) => ({
            title: `Result ${index + 1}`,
            url: `https://example.com/${index + 1}`,
            rank: index + 1,
            content: repeatedContent,
            content_truncated: true,
            full_content_available: true,
            media: [{ type: 'image', url: `https://example.com/${index + 1}.jpg` }]
        })),
        meta: {
            search_id: 'search-1',
            query: 'example',
            total: 30,
            has_more: true,
            next_offset: 10,
            guidance: { instruction: 'Call a tool with a JSON example.' }
        }
    });

    const messages = blocksToAgentMessages(blocks);
    const toolMessage = messages.find(message => message.role === 'tool');
    const compact = JSON.parse(toolMessage.content);

    assert.equal(toolMessage.tool_name, 'web_search');
    assert.equal(toolMessage.tool_call_id, 'call-1');
    assert.equal(compact.historical_tool_result, true);
    assert.equal(compact.results.length, 10);
    assert.equal(compact.results[9].url, 'https://example.com/10');
    assert.equal(compact.meta.search_id, 'search-1');
    assert.equal(compact.meta.next_offset, 10);
    assert.equal(compact.meta.guidance, undefined);
    assert.ok(toolMessage.content.length < 8000);
    assert.ok(!toolMessage.content.includes(repeatedContent));
});

test('non-search tool output remains lossless in historical reconstruction', () => {
    const data = { content: 'exact file contents', nested: { value: 42 } };
    const messages = blocksToAgentMessages(createToolBlocks('read_file', data));
    const toolMessage = messages.find(message => message.role === 'tool');

    assert.deepEqual(JSON.parse(toolMessage.content), data);
});
