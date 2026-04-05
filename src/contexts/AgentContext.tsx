/**
 * AgentContext
 * Agent state and mode management
 */

import { createContext, useContext, ReactNode } from 'react';
import type { AgentStatus, AgentMode } from '../types';

interface AgentContextValue {
    agentStatus: AgentStatus;
    setAgentStatus: (status: Partial<AgentStatus>) => void;
    agentMode: AgentMode;
    setAgentMode: (mode: AgentMode) => void;
    safeMode: boolean;
    setSafeMode: (enabled: boolean) => void;
}

export const AgentContext = createContext<AgentContextValue | undefined>(undefined);

export function AgentProvider({ children }: { children: ReactNode }) {
    // This is a placeholder - actual implementation would use useState
    const contextValue: AgentContextValue = {
        agentStatus: {
            phase: 'idle',
            iteration: 0,
            retries: 0,
            maxRetries: 10,
            elapsedMs: 0,
            currentTool: null,
            log: [],
            streamedText: '',
            errorCount: 0,
        },
        setAgentStatus: () => {},
        agentMode: 'chat',
        setAgentMode: () => {},
        safeMode: true,
        setSafeMode: () => {},
    };

    return (
        <AgentContext.Provider value={contextValue}>
            {children}
        </AgentContext.Provider>
    );
}

export function useAgentContext() {
    const context = useContext(AgentContext);
    if (context === undefined) {
        throw new Error('useAgentContext must be used within AgentProvider');
    }
    return context;
}
