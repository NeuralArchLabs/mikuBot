
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
}

export const executeCommand = async (command: string, context: CommandContext): Promise<string | null> => {
    const parts = command.trim().split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
        case '/new':
            await context.onNewSession();
            return 'New session created.';

        case '/models':
        case '/modelos':
            return 'TRIGGER_MODEL_FLOW';

        case '/debug':
            context.setState(prev => ({ ...prev, debugMode: !prev.debugMode }));
            return `Debug mode ${!context.state.debugMode ? 'enabled' : 'disabled'}.`;

        case '/mode':
        case '/modo':
            return 'TRIGGER_MODE_SELECTION';

        case '/agent':
        case '/agente':
            context.setState(prev => ({ ...prev, agentMode: 'agent', safeMode: true }));
            return 'Mode switched to 🤖 <b>Agent</b> (Safe Mode: ON)';

        case '/chat':
            context.setState(prev => ({ ...prev, agentMode: 'chat' }));
            return 'Mode switched to 💬 <b>Chat</b>';

        case '/approve':
        case '/ok':
        case '/yes':
            if (context.resolveApproval) {
                context.resolveApproval(true);
                return 'Tool call APPROVED remotely.';
            }
            return 'No pending tool approval found.';

        case '/decline':
        case '/reject':
        case '/no':
            if (context.resolveApproval) {
                context.resolveApproval(false);
                return 'Tool call REJECTED remotely.';
            }
            return 'No pending tool approval found.';

        case '/status':
        case '/estado':
            return 'TRIGGER_STATUS';

        default:
            return null; // Not a handled command
    }
};
