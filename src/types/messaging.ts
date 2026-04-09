/**
 * Messaging Types
 * Interfaces for messages, sessions, and attachments
 */

import type { ToolCall, ToolResult } from './tools';

/** Message Block Type */
export type MessageBlockType = 'text' | 'tool_call' | 'answer' | 'thought';

/** Message Block */
export interface MessageBlock {
    type: MessageBlockType;
    content: string;
    toolCall?: ToolCall;
    isCollapsed?: boolean;
    result?: ToolResult;
    status?: 'success' | 'error' | 'pending' | 'denied';
    isFromNarrative?: boolean;
    isFromFinalTool?: boolean;
}

/** File Attachment */
export interface Attachment {
    id: string;
    name: string;
    type: string;
    data: string; // Base64 encoded data
}

/** Message Role */
export type MessageRole = 'user' | 'assistant' | 'tool' | 'system';

/** Message */
export interface Message {
    id: string;
    role: MessageRole;
    text: string;
    timestamp: number; // Stored as timestamp for easier JSON serialization
    isStreaming?: boolean;
    blocks?: MessageBlock[];
    toolCalls?: ToolCall[];
    toolCallId?: string;
    toolName?: string;
    rawHistory?: any[];
    source?: 'telegram' | 'ui';
    excludeFromContext?: boolean;
    provider?: string;
    model?: string;
    attachments?: Attachment[];
    isScheduler?: boolean;
    isScheduledResponse?: boolean;
    isInitiallyCollapsed?: boolean;
}

/** Session Metadata */
export interface SessionMetadata {
    id: string;
    title: string;
    lastModified: number;
    messageCount: number;
}

/** Session */
export interface Session {
    id: string;
    title: string;
    messages: Message[];
    timestamp: number;
    agentMode?: 'chat' | 'agent';
    safeMode?: boolean;
    approvalMode?: 'auto' | 'manual';
    debugMode?: boolean;
    draft?: string;
}
