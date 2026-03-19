/**
 * Agent Helpers
 * Agent-specific utility functions
 */

import type { AgentStatus } from '../../types';

/**
 * Creates a default agent status object
 */
export function createDefaultAgentStatus(): AgentStatus {
    return {
        phase: 'idle',
        iteration: 0,
        retries: 0,
        maxRetries: 10,
        elapsedMs: 0,
        currentTool: null,
        log: [],
        streamedText: '',
        streamedReasoning: '',
        errorCount: 0,
    };
}
