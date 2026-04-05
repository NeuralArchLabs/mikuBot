
import { AppConfig } from '../../types';

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
        voice?: {
            file_id: string;
            duration: number;
            mime_type?: string;
            file_size?: number;
        };
    };
}

class TelegramService {
    private polling = false;
    private lastUpdateId = 0;
    private abortController: AbortController | null = null;
    private typingInterval: ReturnType<typeof setInterval> | null = null;

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

    /**
     * Sends a chat action (e.g. "typing") to a Telegram chat.
     * The action auto-expires after ~5 seconds on Telegram's side.
     */
    async sendChatAction(token: string, chatId: string, action: string = 'typing'): Promise<void> {
        try {
            await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, action })
            });
        } catch (e) {
            console.warn('[TelegramService] sendChatAction failed:', e);
        }
    }

    /**
     * Starts sending the "typing..." indicator every 4 seconds.
     * Telegram auto-cancels the indicator after 5s, so we refresh it before expiry.
     */
    startTypingIndicator(token: string, chatId: string): void {
        this.stopTypingIndicator(); // Clear any previous interval
        // Send immediately
        this.sendChatAction(token, chatId, 'typing');
        // Refresh every 4 seconds
        this.typingInterval = setInterval(() => {
            this.sendChatAction(token, chatId, 'typing');
        }, 4000);
        console.log('[TelegramService] Typing indicator started.');
    }

    /**
     * Stops the "typing..." indicator loop.
     */
    stopTypingIndicator(): void {
        if (this.typingInterval) {
            clearInterval(this.typingInterval);
            this.typingInterval = null;
            console.log('[TelegramService] Typing indicator stopped.');
        }
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
            if (!this.polling) break;

            for (const update of updates) {
                if (update.message) {
                    if (config.telegramChatId && update.message.chat.id.toString() !== config.telegramChatId) continue;

                    // Start typing indicator immediately
                    const token = config.telegramBotToken;
                    const chatId = update.message.chat.id.toString();
                    if (token) this.startTypingIndicator(token, chatId);

                    try {
                        // Handle Text Messages
                        if (update.message.text) {
                            await onMessage(update.message);
                        }
                        // Handle Voice Messages
                        else if (update.message.voice && (window as any).electron) {
                            console.log('[TelegramService] Received voice message. Processing...');
                            const res = await (window as any).electron.processTelegramVoice(update.message.voice.file_id);
                            if (res.ok && res.text) {
                                console.log('[TelegramService] Voice transcribed:', res.text);
                                const voiceMsg = {
                                    ...update.message,
                                    text: `[Mensaje de Voz] ${res.text}`
                                };
                                await onMessage(voiceMsg);
                            } else {
                                console.warn('[TelegramService] Voice transcription failed:', res.error);
                                const errorMsg = {
                                    ...update.message,
                                    text: `[Sistema] No pude transcribir el mensaje de voz. Error: ${res.error || 'Desconocido'}`
                                };
                                await onMessage(errorMsg);
                            }
                        }
                    } catch (err) {
                        console.error('[TelegramService] Processing error:', err);
                    } finally {
                        this.stopTypingIndicator();
                    }
                }
            }
            if (this.polling) await new Promise(r => setTimeout(r, 1000));
        }
    }

    stopPolling() {
        this.polling = false;
        this.stopTypingIndicator();
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        console.log('[TelegramService] Polling stopped.');
    }
}

export const telegramService = new TelegramService();
