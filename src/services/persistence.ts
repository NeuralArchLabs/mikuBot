import { AppConfig, Session, SessionMetadata } from '../types';

const electron = (window as any).electron;
const STORAGE_KEY = 'mikucentral_settings';

/**
 * Persistence layer with two backends:
 *  1. Electron IPC → config.json on disk (when running as desktop app)
 *  2. localStorage  → browser fallback (when running via Vite dev server)
 */
export const persistence = {
    // ── Settings ─────────────────────────────────────────────────────

    async saveSettings(config: AppConfig, agentMode: string, safeMode: boolean, approvalMode: string): Promise<boolean> {
        const payload = { config, agentMode, safeMode, approvalMode };

        // 1. Try Electron IPC
        if (electron) {
            try {
                const result = await electron.saveSettings(payload);
                if (result.ok) return true;
            } catch (e) {
                console.warn('[Persistence] Electron save failed, falling back to localStorage:', e);
            }
        }

        // 2. localStorage fallback
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
            console.log('[Persistence] Settings saved to localStorage');
            return true;
        } catch (e) {
            console.error('[Persistence] Failed to save to localStorage:', e);
            return false;
        }
    },

    async loadSettings(): Promise<{ config: AppConfig; agentMode: string; safeMode: boolean; approvalMode: any } | null> {
        // 1. Try Electron IPC
        if (electron) {
            try {
                const result = await electron.loadSettings();
                if (result.ok && result.settings) {
                    console.log('[Persistence] Settings loaded from Electron (config.json)');
                    return result.settings;
                }
            } catch (e) {
                console.warn('[Persistence] Electron load failed, trying localStorage:', e);
            }
        }

        // 2. localStorage fallback
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.config) {
                    console.log('[Persistence] Settings loaded from localStorage');
                    return parsed;
                }
            }
        } catch (e) {
            console.error('[Persistence] Failed to read localStorage:', e);
        }

        return null;
    },

    /**
     * Import settings from a user-selected JSON file via the browser file picker.
     * Returns the parsed settings or null if cancelled/invalid.
     */
    async loadFromFile(): Promise<{ config: AppConfig; agentMode: string; safeMode: boolean; approvalMode: string } | null> {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,application/json';
            input.style.display = 'none';

            input.addEventListener('change', async () => {
                const file = input.files?.[0];
                if (!file) { resolve(null); return; }

                try {
                    const text = await file.text();
                    const parsed = JSON.parse(text);

                    // Validate structure: must have at least a config object with provider
                    if (parsed && parsed.config && parsed.config.provider) {
                        console.log(`[Persistence] Config loaded from file: ${file.name}`);
                        resolve({
                            config: parsed.config,
                            agentMode: parsed.agentMode || 'chat',
                            safeMode: parsed.safeMode || false,
                            approvalMode: parsed.approvalMode || 'auto'
                        });
                    } else {
                        console.error('[Persistence] Invalid config file structure');
                        resolve(null);
                    }
                } catch (e) {
                    console.error('[Persistence] Failed to parse config file:', e);
                    resolve(null);
                }

                input.remove();
            });

            input.addEventListener('cancel', () => {
                resolve(null);
                input.remove();
            });

            document.body.appendChild(input);
            input.click();
        });
    },

    /**
     * Export current settings to a downloadable JSON file.
     */
    exportToFile(config: AppConfig, agentMode: string, safeMode: boolean, approvalMode: string): void {
        const payload = JSON.stringify({ config, agentMode, safeMode, approvalMode }, null, 4);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'mikucentral-config.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // ── Sessions ─────────────────────────────────────────────────────
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
    },

    /**
     * Export a specific session as a downloadable JSON file.
     */
    exportSession(session: Session): void {
        const payload = JSON.stringify(session, null, 4);
        const filename = `miku-session-${session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Import a session from a JSON file.
     */
    async importSessionFromFile(): Promise<Session | null> {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,application/json';
            input.style.display = 'none';

            input.addEventListener('change', async () => {
                const file = input.files?.[0];
                if (!file) { resolve(null); return; }

                try {
                    const text = await file.text();
                    const parsed = JSON.parse(text);

                    // Basic validation: must have id, title, messages
                    if (parsed && parsed.id && parsed.title && Array.isArray(parsed.messages)) {
                        console.log(`[Persistence] Session imported from file: ${file.name}`);
                        resolve(parsed as Session);
                    } else {
                        console.error('[Persistence] Invalid session file structure');
                        alert('❌ Error: The file does not contain a valid Miku session.');
                        resolve(null);
                    }
                } catch (e) {
                    console.error('[Persistence] Failed to parse session file:', e);
                    resolve(null);
                }

                input.remove();
            });

            input.addEventListener('cancel', () => {
                resolve(null);
                input.remove();
            });

            document.body.appendChild(input);
            input.click();
        });
    }
};
