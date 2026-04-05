
import React from 'react';
import { AppState, SessionMetadata } from '../../types';

export interface CommandContext {
    state: AppState;
    setState: React.Dispatch<React.SetStateAction<AppState>>;
    sessions: SessionMetadata[];
    setSessions: React.Dispatch<React.SetStateAction<SessionMetadata[]>>;
    onNewSession: () => Promise<void>;
    updateConfig: (key: string, value: any) => void;
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
            // This is a placeholder. A real implementation would invoke a script or UI flow.
            // For now, let's just return a list if we could, or a message.
            // But the user wants a script execution or options flow.
            // Since we can't easily do interactive script execution in this function without UI support for it,
            // we will simulate it or provide a direct action if possible.
            // If the user wants to choose a model, we might need a way to show a list.
            return 'Model selection not yet fully implemented via command. Use Settings.';

        case '/debug':
            context.setState(prev => ({ ...prev, debugMode: !prev.debugMode }));
            return `Debug mode ${!context.state.debugMode ? 'enabled' : 'disabled'}.`;

        case '/safe':
            context.setState(prev => ({ ...prev, safeMode: !prev.safeMode }));
            return `Safe mode ${!context.state.safeMode ? 'enabled' : 'disabled'}.`;

        default:
            return null; // Not a handled command
    }
};
