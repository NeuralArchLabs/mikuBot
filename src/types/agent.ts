/**
 * Agent Types
 * Interfaces for agent state, phases, and logging
 */

/** Agent Operation Phase */
export type AgentPhase = 'idle' | 'thinking' | 'streaming' | 'tool_calling' | 'tool_executing' | 'waiting_approval' | 'error' | 'aborted';

/** Agent Log Entry Type */
export type AgentLogEntryType = 'info' | 'tool_call' | 'tool_result' | 'error' | 'warn';

/** Agent Log Entry */
export interface AgentLogEntry {
    timestamp: number;
    type: AgentLogEntryType;
    message: string;
    details?: any;
}

/** Agent Status */
export interface AgentStatus {
    phase: AgentPhase;
    iteration: number;
    retries: number;
    maxRetries: number;
    elapsedMs: number;
    currentTool: string | null;
    log: AgentLogEntry[];
    streamedText: string;
    streamedReasoning?: string;
    errorCount: number;
    rawMessages?: any[];
    currentSystemPrompt?: string;
    lastExecutionFeedback?: string;
    isInstructionMode?: boolean;
    debug?: string;
}
