/**
 * useAgentStatus Hook
 * Manages agent status state
 */

import { useState, useCallback } from 'react';
import type { AgentStatus, AgentPhase } from '../types';

export function useAgentStatus() {
    const [agentStatus, setAgentStatus] = useState<AgentStatus>({
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
    });

    const setPhase = useCallback((phase: AgentPhase) => {
        setAgentStatus(prev => ({ ...prev, phase }));
    }, []);

    const addLogEntry = useCallback((entry: Omit<AgentStatus['log'][0], 'timestamp'>) => {
        setAgentStatus(prev => ({
            ...prev,
            log: [...prev.log, { ...entry, timestamp: Date.now() }]
        }));
    }, []);

    const incrementIteration = useCallback(() => {
        setAgentStatus(prev => ({ ...prev, iteration: prev.iteration + 1 }));
    }, []);

    const reset = useCallback(() => {
        setAgentStatus({
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
        });
    }, []);

    return {
        agentStatus,
        setAgentStatus,
        setPhase,
        addLogEntry,
        incrementIteration,
        reset,
    };
}
