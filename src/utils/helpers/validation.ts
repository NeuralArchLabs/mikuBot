/**
 * Validation Helpers
 * Input validation and schema validation utilities
 */

import type { ToolCall, ToolDefinition } from '../../types';

/**
 * Validates tool call arguments against tool definition
 */
export function validateToolArgs(toolCall: ToolCall, tools: ToolDefinition[]): { valid: boolean; error?: string } {
    const { name, arguments: args } = toolCall.function;
    const toolDef = tools.find(t => t.function.name === name);
    if (!toolDef) {
        return { valid: false, error: `Unknown tool "${name}". Available: ${tools.map(t => t.function.name).join(', ')}` };
    }
    const params = toolDef.function.parameters;
    const requiredFields = params?.required || [];
    const properties = params?.properties || {};
    for (const field of requiredFields) {
        if (args[field] === undefined || args[field] === null) {
            return { valid: false, error: `Missing required field "${field}" for tool "${name}". Expected: ${properties[field]?.description || field}` };
        }
    }
    for (const [key, value] of Object.entries(args)) {
        const paramDef = properties[key];
        if (paramDef?.enum && !paramDef.enum.includes(value as string)) {
            return { valid: false, error: `Invalid value "${value}" for "${key}". Must be one of: ${paramDef.enum.join(', ')}` };
        }
    }
    return { valid: true };
}

/**
 * Validates email address format
 */
export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validates URL format
 */
export function validateUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Validates file path (basic validation)
 */
export function validateFilePath(path: string): boolean {
    if (!path || typeof path !== 'string') return false;
    // Prevent path traversal
    if (path.includes('..') || path.includes('~')) return false;
    return true;
}

/**
 * Sanitizes user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}
