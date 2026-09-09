/**
 * Converts structured UI blocks into provider-neutral conversation history.
 * Provider-specific serialization happens later in ModelProviders.
 */
export interface ConversationBlock {
    type: 'answer' | 'thought' | 'tool_call' | 'text' | string;
    content: string;
    toolCall?: any;
    result?: any;
    status?: string;
    thought_signature?: string;
    thoughtSignature?: string;
}

const SEARCH_HISTORY_TOOLS = new Set(['web_search', 'web_search_more']);
const SEARCH_HISTORY_RESULT_LIMIT = 25;
const SEARCH_HISTORY_PREVIEW_CHARS = 180;

function compactText(value: unknown, limit: number): string | undefined {
    if (typeof value !== 'string') return undefined;
    const compact = value.replace(/\s+/g, ' ').trim();
    if (!compact) return undefined;
    return compact.length > limit ? `${compact.slice(0, limit).trimEnd()}…` : compact;
}

function compactHistoricalSearchResult(toolName: string, data: unknown): string | null {
    let parsed = data;
    if (typeof parsed === 'string') {
        try {
            parsed = JSON.parse(parsed);
        } catch {
            return null;
        }
    }

    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as any).results)) return null;

    const source = parsed as any;
    const results = source.results.slice(0, SEARCH_HISTORY_RESULT_LIMIT).map((result: any) => {
        const compact: Record<string, unknown> = {
            title: compactText(result?.title, 240),
            url: compactText(result?.url, 2048),
            rank: result?.rank,
            source: compactText(result?.source, 80),
            preview: compactText(result?.snippet || result?.content, SEARCH_HISTORY_PREVIEW_CHARS),
            content_truncated: result?.content_truncated === true,
            full_content_available: result?.full_content_available === true
        };

        if (Array.isArray(result?.media)) {
            const media = result.media
                .filter((item: any) => item && typeof item.url === 'string')
                .slice(0, 1)
                .map((item: any) => ({
                    type: compactText(item.type, 40) || 'media',
                    url: compactText(item.url, 2048)
                }));
            if (media.length) compact.media = media;
        }

        return Object.fromEntries(Object.entries(compact).filter(([, value]) => value !== undefined));
    });

    const metaSource = source.meta && typeof source.meta === 'object' ? source.meta : {};
    const metaKeys = [
        'search_id', 'query', 'category', 'total', 'offset', 'limit',
        'returned', 'has_more', 'next_offset', 'enriched'
    ];
    const meta = Object.fromEntries(metaKeys
        .filter(key => metaSource[key] !== undefined)
        .map(key => [key, metaSource[key]]));

    return JSON.stringify({
        historical_tool_result: true,
        tool: toolName,
        history_notice: 'The full search payload was consumed in the completed turn and remains in saved UI state. URLs and search metadata are retained here; use read_url if source text is needed again.',
        results,
        ...(Object.keys(meta).length ? { meta } : {})
    });
}

function serializeHistoricalToolOutput(block: ConversationBlock, toolName: string): string {
    if (!block.result) return block.status === 'denied'
        ? 'manual mode error: user denied tool execution'
        : '';

    if (block.status !== 'success') return block.result.error || 'Execution failed';

    const data = block.result.data ?? block.result;
    if (SEARCH_HISTORY_TOOLS.has(toolName)) {
        const compactSearch = compactHistoricalSearchResult(toolName, data);
        if (compactSearch) return compactSearch;
    }

    return typeof data === 'string' ? data : JSON.stringify(data);
}

export function extractAnswerFromBlocks(blocks?: ConversationBlock[] | null): string {
    return (blocks || [])
        .filter(block => (block.type === 'answer' || block.type === 'text') && block.content?.trim())
        .map(block => block.content.trim())
        .join('\n\n')
        .trim();
}

export function blocksToAgentMessages(blocks?: ConversationBlock[] | null): any[] {
    if (!blocks?.length) return [];

    const messages: any[] = [];
    let currentAssistant: any = null;
    let queuedToolResponses: any[] = [];

    const finalizeAssistant = () => {
        if (currentAssistant) messages.push(currentAssistant);
        currentAssistant = null;
        if (queuedToolResponses.length) messages.push(...queuedToolResponses);
        queuedToolResponses = [];
    };

    for (const block of blocks) {
        if (block.type === 'thought') {
            if (queuedToolResponses.length) finalizeAssistant();
            currentAssistant ||= { role: 'assistant', content: '' };
            const signature = block.thought_signature || block.thoughtSignature ||
                block.toolCall?.thought_signature || block.toolCall?.thoughtSignature;
            if (signature) currentAssistant.thought_signature = signature;
            currentAssistant.reasoning = currentAssistant.reasoning
                ? `${currentAssistant.reasoning}\n\n${block.content.trim()}`
                : block.content.trim();
            continue;
        }

        if (block.type === 'text' || block.type === 'answer') {
            if (queuedToolResponses.length) finalizeAssistant();
            currentAssistant ||= { role: 'assistant', content: '' };
            currentAssistant.content = currentAssistant.content
                ? `${currentAssistant.content}\n\n${block.content.trim()}`
                : block.content.trim();
            continue;
        }

        if (block.type !== 'tool_call' || !block.toolCall?.id) continue;
        const toolCallData = block.toolCall;
        currentAssistant ||= { role: 'assistant', content: null };
        currentAssistant.tool_calls ||= [];

        const signature = toolCallData.thought_signature || toolCallData.thoughtSignature ||
            block.thought_signature || block.thoughtSignature;
        const toolCall: any = {
            id: toolCallData.id,
            type: 'function',
            function: {
                name: toolCallData.function.name,
                arguments: toolCallData.function.arguments ?? {}
            }
        };
        if (signature) {
            toolCall.thought_signature = signature;
            currentAssistant.thought_signature ||= signature;
        }
        currentAssistant.tool_calls.push(toolCall);

        const rawOutput = serializeHistoricalToolOutput(block, toolCallData.function.name);

        const toolResponse: any = {
            role: 'tool',
            tool_name: toolCallData.function.name,
            tool_call_id: toolCallData.id,
            content: rawOutput
        };
        if (signature) toolResponse.thought_signature = signature;
        queuedToolResponses.push(toolResponse);
    }

    finalizeAssistant();
    return messages.map(message => {
        if (message.role === 'assistant' && typeof message.content === 'string') {
            message.content = message.content.trim() || null;
        }
        return message;
    });
}
