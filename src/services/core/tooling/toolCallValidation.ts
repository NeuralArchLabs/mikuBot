import type { ToolCall, ToolDefinition } from '../../../types';

export interface ToolCallValidationResult {
    toolCall: ToolCall | null;
    blocked: boolean;
    error?: string;
}

export interface RecoveredCall {
    toolCall: ToolCall;
    start: number;
    end: number;
}

function parseArguments(value: unknown): Record<string, unknown> | null {
    if (value === undefined || value === null || value === '') return {};
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
        } catch {
            return null;
        }
    }
    return typeof value === 'object' && !Array.isArray(value)
        ? { ...(value as Record<string, unknown>) }
        : null;
}

/**
 * Validates the structured tool envelope without rewriting model intent.
 * Compatibility with non-native models is handled explicitly by toolTransport.
 */
export function validateStructuredToolCall(
    rawCall: Record<string, unknown>,
    tools: ToolDefinition[]
): ToolCallValidationResult {
    const name = typeof rawCall?.name === 'string' ? rawCall.name.trim() : '';
    if (!name || !tools.some(tool => tool.function.name === name)) {
        return { toolCall: null, blocked: true, error: 'Unknown tool name.' };
    }

    const args = parseArguments(rawCall.arguments);
    if (!args) {
        return { toolCall: null, blocked: true, error: 'Tool arguments must be a JSON object.' };
    }

    return {
        blocked: false,
        toolCall: {
            id: `call-${Math.random().toString(36).slice(2, 11)}`,
            function: { name, arguments: args }
        }
    };
}

