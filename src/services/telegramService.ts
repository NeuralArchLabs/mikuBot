
import { AppConfig } from '../types';

export interface TelegramUpdate {
    update_id: number;
    message?: {
        message_id: number;
        from: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
        };
        chat: {
            id: number;
            type: string;
        };
        date: number;
        text?: string;
    };
}

class TelegramService {
    private polling = false;
    private lastUpdateId = 0;
    private abortController: AbortController | null = null;

    async getUpdates(config: AppConfig): Promise<TelegramUpdate[]> {
        if (!config.telegramBotToken) return [];

        const offset = this.lastUpdateId ? this.lastUpdateId + 1 : 0;
        const url = `https://api.telegram.org/bot${config.telegramBotToken}/getUpdates?offset=${offset}&timeout=30`;

        try {
            this.abortController = new AbortController();
            const response = await fetch(url, { signal: this.abortController.signal });
            const data = await response.json();

            if (data.ok && data.result.length > 0) {
                const updates = data.result as TelegramUpdate[];
                this.lastUpdateId = updates[updates.length - 1].update_id;
                return updates;
            }
        } catch (e) {
            if (e instanceof Error && e.name === 'AbortError') return [];
            console.error('[TelegramService] Polling error:', e);
        }
        return [];
    }

    async startPolling(config: AppConfig, onMessage: (message: TelegramUpdate['message']) => Promise<void> | void) {
        if (this.polling) return;
        this.polling = true;

        // On first start, try to skip old messages if lastUpdateId is 0
        if (this.lastUpdateId === 0) {
            try {
                const initResp = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/getUpdates?limit=1&offset=-1`);
                const initData = await initResp.json();
                if (initData.ok && initData.result.length > 0) {
                    this.lastUpdateId = initData.result[0].update_id;
                    console.log(`[TelegramService] Skipping old messages. Starting from update_id: ${this.lastUpdateId}`);
                }
            } catch (e) {
                console.warn('[TelegramService] Could not fetch initial offset:', e);
            }
        }

        console.log('[TelegramService] Starting poll loop...');

        while (this.polling) {
            const updates = await this.getUpdates(config);
            if (!this.polling) break; // Check again after await

            for (const update of updates) {
                if (update.message && update.message.text) {
                    if (config.telegramChatId && update.message.chat.id.toString() !== config.telegramChatId) continue;
                    await onMessage(update.message);
                }
            }
            if (this.polling) await new Promise(r => setTimeout(r, 1000));
        }
    }

    stopPolling() {
        this.polling = false;
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        console.log('[TelegramService] Polling stopped.');
    }
}

export const telegramService = new TelegramService();
