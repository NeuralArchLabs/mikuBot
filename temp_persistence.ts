import { AppConfig, Session, SessionMetadata } from '../types';

const electron = (window as any).electron;

export const persistence = {
    // ÔöÇÔöÇ Settings ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
    async saveSettings(config: AppConfig, agentMode: string): Promise<boolean> {
        if (!electron) return false;
        const result = await electron.saveSettings({ config, agentMode });
        return result.ok;
    },

    async loadSettings(): Promise<{ config: AppConfig; agentMode: string } | null> {
        if (!electron) return null;
        const result = await electron.loadSettings();
        if (result.ok && result.settings) {
            return result.settings;
        }
        return null;
    },

    // ÔöÇÔöÇ Sessions ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
    async getSessions(): Promise<SessionMetadata[]> {
        if (!electron) return [];
        const result = await electron.getSessions();
        return result.ok ? result.sessions : [];
    },

    async loadSession(id: string): Promise<Session | null> {
        if (!electron) return null;
        const result = await electron.loadSession(id);
        return result.ok ? result.session : null;
    },

    async saveSession(session: Session): Promise<boolean> {
        if (!electron) return false;
        const result = await electron.saveSession(session);
        return result.ok;
    },

    async deleteSession(id: string): Promise<boolean> {
        if (!electron) return false;
        const result = await electron.deleteSession(id);
        return result.ok;
    }
};
