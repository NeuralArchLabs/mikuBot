/**
 * Interaction Context Wrapper (OOP)
 * Path: src/services/core/InteractionContext.ts
 */

import { AgentMode } from '../../types';

export interface InteractionParams {
    forceToolMode?: boolean;
    isRemote?: boolean;
    isScheduled?: boolean;
}

/**
 * Encapsulates the logic for determining the operational mode
 * based on the source of the message (UI, Telegram, or Scheduler).
 */
export class InteractionContext {
    public readonly forceToolMode: boolean;
    public readonly isRemote: boolean;
    public readonly isScheduled: boolean;

    constructor(params: InteractionParams) {
        this.forceToolMode = params.forceToolMode ?? false;
        this.isRemote = params.isRemote ?? false;
        this.isScheduled = params.isScheduled ?? false;
    }

    /**
     * Resolves the operational mode independently of the UI state when necessary.
     * Telegram (isRemote) ALWAYS defaults to 'chat' mode for security and identity consistency.
     */
    getEffectiveMode(uiMode: AgentMode): AgentMode {
        if (this.isScheduled) return this.forceToolMode ? 'agent' : 'chat';
        
        // Follow the global mode (or forced mode) for both UI and Remote (Telegram)
        return (this.forceToolMode || uiMode === 'agent') ? 'agent' : 'chat';
    }

    /**
     * Determines if the full Agent Engine (recursive looping) should be used.
     */
    shouldUseAgentEngine(uiMode: AgentMode): boolean {
        return this.getEffectiveMode(uiMode) === 'agent';
    }

    /**
     * Determines if the model should be allowed to use tools (even in chat mode for reading/searching).
     */
    shouldAllowTools(uiMode: AgentMode): boolean {
        // En Telegram solo permitimos herramientas si está explícitamente forzado (raro)
        // Pero por ahora, seguimos la regla de que el modo agente habilita herramientas.
        return this.getEffectiveMode(uiMode) === 'agent' || this.forceToolMode;
    }
}
