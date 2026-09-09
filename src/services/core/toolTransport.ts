import type { ToolDefinition } from '../../types';

/**
 * Selects exactly one tool-call transport for a model request.
 * Text recovery is deliberately unavailable while native tools are active.
 */
export type ToolTransport = 'native' | 'text-fallback' | 'none';

export type ToolTextSource = 'content' | 'reasoning';

export interface TextFallbackToolCall {
    name: string;
    arguments: Record<string, unknown>;
    start: number;
    end: number;
}

const nativeToolUnsupportedModels = new Set<string>();

/** Runtime capability key. A process restart intentionally re-probes models. */
export function getToolCapabilityKey(config: {
    provider?: unknown;
    model?: unknown;
    ollamaUrl?: unknown;
}): string {
    return [config.provider || '', config.model || '', config.ollamaUrl || '']
        .map(value => String(value).trim().toLowerCase())
        .join('::');
}

export function rememberNativeToolsUnsupported(capabilityKey: string): void {
    if (capabilityKey) nativeToolUnsupportedModels.add(capabilityKey);
}

const THINK_OPEN_TAG = /\\?(?:<|&lt;)\s*(?:thinking|thought|reflection|think|\\think)\b(?:\s+[^&>]*)?(?:>|&gt;)/gi;
const THINK_CLOSE_TAG = /\\?(?:<|&lt;)\s*\\?\/\s*(?:thinking|thought|reflection|think|\\think)\s*(?:>|&gt;)/gi;
const THINK_START_TOKEN = /\\?<\|(?:thinking|thought|think)\|>/gi;
const THINK_END_TOKEN = /\\?<\|(?:end_of_(?:thinking|thought|think)|(?:thinking|thought|think)_end)\|>/gi;

/** Normalizes local-model thought delimiters without exposing provider syntax. */
export function normalizeThoughtDelimiters(text: string): string {
    return String(text || '')
        .replace(THINK_END_TOKEN, '</thinking>')
        .replace(THINK_START_TOKEN, '<thinking>')
        .replace(THINK_OPEN_TAG, '<thinking>')
        .replace(THINK_CLOSE_TAG, '</thinking>');
}

export function getInitialToolTransport(
    toolsEnabled: boolean,
    tools: ToolDefinition[],
    capabilityKey: string = ''
): ToolTransport {
    if (!toolsEnabled || tools.length === 0) return 'none';
    return capabilityKey && nativeToolUnsupportedModels.has(capabilityKey)
        ? 'text-fallback'
        : 'native';
}

/**
 * Reasoning is never an executable channel. Free-form content is executable
 * only after the runtime has explicitly switched to the text fallback.
 */
export function canRecoverTextToolCalls(
    transport: ToolTransport,
    source: ToolTextSource
): boolean {
    return transport === 'text-fallback' && source === 'content';
}

function replaceRangeWithSpaces(text: string, start: number, end: number): string {
    return `${text.slice(0, start)}${' '.repeat(end - start)}${text.slice(end)}`;
}

function maskNonExecutableText(text: string): string {
    const thoughtOpen = String.raw`\\?(?:<|&lt;)\s*(?:thinking|thought|reflection|think|\\think)\b(?:\s+[^&>]*)?(?:>|&gt;)`;
    const thoughtClose = String.raw`\\?(?:<|&lt;)\s*\\?\/\s*(?:thinking|thought|reflection|think|\\think)\s*(?:>|&gt;)`;
    const thoughtEnd = String.raw`\\?<\|(?:end_of_)?(?:thinking|thought|think)\|>`;
    const completeThought = new RegExp(`${thoughtOpen}[\\s\\S]*?(?:${thoughtClose}|${thoughtEnd})`, 'gi');
    let masked = text.replace(completeThought, match => ' '.repeat(match.length));

    const partialThought = new RegExp(thoughtOpen, 'gi');
    let thoughtMatch: RegExpExecArray | null;
    let lastThought: RegExpExecArray | null = null;
    while ((thoughtMatch = partialThought.exec(masked)) !== null) lastThought = thoughtMatch;
    if (lastThought) masked = replaceRangeWithSpaces(masked, lastThought.index, masked.length);

    masked = masked.replace(/```[\s\S]*?```/g, match => ' '.repeat(match.length));
    const unmatchedFence = masked.lastIndexOf('```');
    if (unmatchedFence >= 0) masked = replaceRangeWithSpaces(masked, unmatchedFence, masked.length);

    return masked.replace(/`[^`\r\n]*`/g, match => ' '.repeat(match.length));
}

function extractBalancedJsonObject(text: string, start: number): { raw: string; end: number } | null {
    if (text[start] !== '{') return null;

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index++) {
        const character = text[index];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (character === '\\') {
            escaped = true;
            continue;
        }
        if (character === '"') {
            inString = !inString;
            continue;
        }
        if (inString) continue;

        if (character === '{') depth++;
        else if (character === '}' && --depth === 0) {
            return { raw: text.slice(start, index + 1), end: index + 1 };
        }
    }

    return null;
}

/**
 * Parses only the explicit, standalone protocol injected by the text fallback.
 * Plain JSON, prose, code examples, and reasoning are deliberately rejected.
 */
export function extractTextFallbackToolCalls(
    rawText: string,
    tools: ToolDefinition[]
): TextFallbackToolCall[] {
    let executableText = maskNonExecutableText(String(rawText || ''));
    const allowedNames = new Set(tools.map(tool => tool.function.name));
    const calls: TextFallbackToolCall[] = [];
    const opening = /<tool_call>\s*call\s*:\s*([A-Za-z0-9_-]+)\s*/gi;
    let match: RegExpExecArray | null;

    while ((match = opening.exec(executableText)) !== null) {
        const name = match[1];
        if (!allowedNames.has(name)) continue;

        const objectStart = opening.lastIndex;
        const object = extractBalancedJsonObject(executableText, objectStart);
        if (!object) continue;

        const closing = executableText.slice(object.end).match(/^\s*<\/tool_call\s*>/i);
        if (!closing) continue;

        try {
            const args = JSON.parse(object.raw);
            if (!args || typeof args !== 'object' || Array.isArray(args)) continue;

            const end = object.end + closing[0].length;
            calls.push({ name, arguments: args, start: match.index, end });
            opening.lastIndex = end;
        } catch {
            // Strict fallback calls must be valid JSON; malformed payloads are inert.
        }
    }

    for (const call of [...calls].sort((a, b) => b.start - a.start)) {
        executableText = replaceRangeWithSpaces(executableText, call.start, call.end);
    }

    return executableText.trim() ? [] : calls;
}

function compactToolSummary(tool: ToolDefinition): string {
    const properties = tool.function.parameters?.properties || {};
    const required = new Set(tool.function.parameters?.required || []);
    const args = Object.keys(properties)
        .map(name => `${name}${required.has(name) ? '*' : ''}`)
        .join(', ');
    const description = String(tool.function.description || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 180);

    return `- ${tool.function.name}(${args || 'no arguments'}): ${description}`.trim();
}

export function buildTextToolFallbackInstruction(tools: ToolDefinition[]): string {
    const catalog = tools.map(compactToolSummary).join('\n');

    return [
        '[TEXT_TOOL_FALLBACK_PROTOCOL]',
        'Native structured tool calling is unavailable for this request.',
        'To invoke a tool, output only a standalone line in exactly this form:',
        '<tool_call>call:TOOL_NAME{"argument":"value"}</tool_call>',
        'For multiple independent calls, repeat that standalone line.',
        'Use an exact tool name and exact argument keys from the catalog below.',
        'Never place a tool call in reasoning, prose, Markdown, a code fence, or an example.',
        'If no tool is needed, answer normally and do not reproduce the protocol.',
        '',
        'Available tools (* means required):',
        catalog,
        '[/TEXT_TOOL_FALLBACK_PROTOCOL]'
    ].join('\n');
}

export function injectTextToolFallbackInstruction(
    messages: any[],
    tools: ToolDefinition[]
): any[] {
    const instruction = buildTextToolFallbackInstruction(tools);
    const nextMessages = messages.map(message => ({ ...message }));
    const systemIndex = nextMessages.findIndex(message => message.role === 'system');

    if (systemIndex >= 0) {
        nextMessages[systemIndex].content = `${nextMessages[systemIndex].content || ''}\n\n${instruction}`.trim();
    } else {
        nextMessages.unshift({ role: 'system', content: instruction });
    }

    return nextMessages;
}
