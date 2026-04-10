
import React from 'react';
import { AppState, SessionMetadata } from '../../types';

export interface CommandContext {
    state: AppState;
    setState: React.Dispatch<React.SetStateAction<AppState>>;
    sessions: SessionMetadata[];
    setSessions: React.Dispatch<React.SetStateAction<SessionMetadata[]>>;
    onNewSession: () => Promise<void>;
    updateConfig: (key: string, value: any) => void;
    resolveApproval?: (approved: boolean) => void;
    t: (key: string, options?: any) => string;
}

export const executeCommand = async (command: string, context: CommandContext): Promise<string | null> => {
    const parts = command.trim().split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
        case '/new':
            await context.onNewSession();
            return context.t('commands_exec.new_session_created');

        case '/models':
        case '/modelos':
            return 'TRIGGER_MODEL_FLOW';

        case '/debug':
            context.setState(prev => ({ ...prev, debugMode: !prev.debugMode }));
            return context.state.debugMode ? context.t('commands_exec.debug_disabled') : context.t('commands_exec.debug_enabled');

        case '/mode':
        case '/modo':
            return 'TRIGGER_MODE_SELECTION';

        case '/agent':
        case '/agente':
            context.setState(prev => ({ ...prev, agentMode: 'agent', safeMode: true }));
            return context.t('commands_exec.mode_agent');

        case '/chat':
            context.setState(prev => ({ ...prev, agentMode: 'chat' }));
            return context.t('commands_exec.mode_chat');

        case '/approve':
        case '/ok':
        case '/yes':
            if (context.resolveApproval) {
                context.resolveApproval(true);
                return context.t('commands_exec.tool_approved');
            }
            return context.t('commands_exec.no_pending_tool');

        case '/decline':
        case '/reject':
        case '/no':
            if (context.resolveApproval) {
                context.resolveApproval(false);
                return context.t('commands_exec.tool_rejected');
            }
            return context.t('commands_exec.no_pending_tool');

        case '/status':
        case '/estado':
            return 'TRIGGER_STATUS';

        default:
            return null; // Not a handled command
    }
};
