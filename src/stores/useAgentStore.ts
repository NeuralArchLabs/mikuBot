import { create } from 'zustand';
import { Message, AgentStatus, PendingToolApproval, Attachment } from '../types';
import { createDefaultAgentStatus } from '../utils';

/**
 * Agent Store - Estado atómico para alta frecuencia de actualizaciones
 *
 * Este store gestiona los estados que cambian durante el streaming,
 * evitando cuellos de botella de renderizado al permitir suscripciones
 * granulares a nodos específicos del estado.
 */

interface AgentStore {
    // Estado principal
    messages: Message[];
    agentStatus: AgentStatus;
    isLoading: boolean;
    input: string;
    pendingToolApproval: PendingToolApproval | null;
    executingSessionId: string | null;

    // Actions para mensajes
    setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
    addMessage: (message: Message) => void;
    updateMessage: (id: string, updates: Partial<Message>) => void;
    updateMessageContent: (id: string, content: string, blocks?: any[]) => void;
    updateMessageStreaming: (id: string, isStreaming: boolean) => void;
    clearMessages: () => void;

    // Actions para agentStatus
    setAgentStatus: (status: AgentStatus | Partial<AgentStatus> | ((prev: AgentStatus) => AgentStatus | Partial<AgentStatus>)) => void;
    updateAgentPhase: (phase: AgentStatus['phase']) => void;
    updateStreamedText: (text: string, reasoning?: string) => void;
    resetAgentStatus: () => void;

    // Actions para otros estados
    setIsLoading: (loading: boolean) => void;
    setInput: (input: string) => void;
    setPendingToolApproval: (approval: PendingToolApproval | null) => void;
    setExecutingSessionId: (id: string | null) => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
    // Estado inicial
    messages: [],
    agentStatus: createDefaultAgentStatus(),
    isLoading: false,
    input: '',
    pendingToolApproval: null,
    executingSessionId: null,

    // Messages actions
    setMessages: (messages) => set((state) => ({
        messages: typeof messages === 'function' ? messages(state.messages) : messages
    })),

    addMessage: (message) => set((state) => ({
        messages: [...state.messages, message]
    })),

    updateMessage: (id, updates) => set((state) => ({
        messages: state.messages.map(m => m.id === id ? { ...m, ...updates } : m)
    })),

    updateMessageContent: (id, content, blocks) => set((state) => ({
        messages: state.messages.map(m => m.id === id ? { ...m, text: content, blocks: blocks || m.blocks } : m)
    })),

    updateMessageStreaming: (id, isStreaming) => set((state) => ({
        messages: state.messages.map(m => m.id === id ? { ...m, isStreaming } : m)
    })),

    clearMessages: () => set({ messages: [] }),

    // AgentStatus actions
    setAgentStatus: (status) => set((state) => {
        const resolveStatus = (
            s: AgentStatus | Partial<AgentStatus> | ((prev: AgentStatus) => AgentStatus | Partial<AgentStatus>)
        ): AgentStatus => {
            if (typeof s === 'function') {
                const result = s(state.agentStatus);
                if (typeof result === 'function') return resolveStatus(result);
                return typeof (result as any).phase === 'string'
                    ? { ...state.agentStatus, ...result as Partial<AgentStatus> }
                    : result as AgentStatus;
            }
            return typeof (s as any).phase === 'string'
                ? { ...state.agentStatus, ...s as Partial<AgentStatus> }
                : s as AgentStatus;
        };
        return { agentStatus: resolveStatus(status) };
    }),

    updateAgentPhase: (phase) => set((state) => ({
        agentStatus: { ...state.agentStatus, phase }
    })),

    updateStreamedText: (text, reasoning) => set((state) => ({
        agentStatus: {
            ...state.agentStatus,
            streamedText: text,
            ...(reasoning !== undefined && { streamedReasoning: reasoning })
        }
    })),

    resetAgentStatus: () => set({ agentStatus: createDefaultAgentStatus() }),

    // Other states actions
    setIsLoading: (isLoading) => set({ isLoading }),
    setInput: (input) => set({ input }),
    setPendingToolApproval: (pendingToolApproval) => set({ pendingToolApproval }),
    setExecutingSessionId: (executingSessionId) => set({ executingSessionId })
}));

// Selectores granulares para suscripciones optimizadas
export const selectMessages = (state: AgentStore) => state.messages;
export const selectLastMessage = (state: AgentStore) => state.messages[state.messages.length - 1];
export const selectStreamingMessages = (state: AgentStore) =>
    state.messages.filter(m => m.isStreaming);
export const selectAgentStatus = (state: AgentStore) => state.agentStatus;
export const selectStreamedText = (state: AgentStore) => state.agentStatus.streamedText;
export const selectStreamedReasoning = (state: AgentStore) => state.agentStatus.streamedReasoning;
export const selectAgentPhase = (state: AgentStore) => state.agentStatus.phase;
export const selectCurrentTool = (state: AgentStore) => state.agentStatus.currentTool;
export const selectAgentLog = (state: AgentStore) => state.agentStatus.log;
export const selectIsLoading = (state: AgentStore) => state.isLoading;
export const selectInput = (state: AgentStore) => state.input;
export const selectPendingToolApproval = (state: AgentStore) => state.pendingToolApproval;
export const selectExecutingSessionId = (state: AgentStore) => state.executingSessionId;
