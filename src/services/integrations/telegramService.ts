
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
    callback_query?: {
        id: string;
        from: {
            id: number;
            username?: string;
        };
        message?: TelegramUpdate['message'];
        data: string;
    };
}

class TelegramService {
    private static polling = false;
    private static lastUpdateId = 0;
    private static currentPollingId = 0;
    private static processedUpdateIds = new Set<number>();
    
    private abortController: AbortController | null = null;
    private typingInterval: any = null;

    async getUpdates(config: AppConfig): Promise<TelegramUpdate[]> {
        if (!config.telegramBotToken) return [];

        const offset = TelegramService.lastUpdateId ? TelegramService.lastUpdateId + 1 : 0;
        const url = `https://api.telegram.org/bot${config.telegramBotToken}/getUpdates?offset=${offset}&timeout=30`;

        try {
            this.abortController = new AbortController();
            const response = await fetch(url, { signal: this.abortController.signal });
            const data = await response.json();

            if (data.ok && data.result.length > 0) {
                const updates = data.result as TelegramUpdate[];
                TelegramService.lastUpdateId = updates[updates.length - 1].update_id;
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
        // Typing indicator started.
    }

    /**
     * Stops the "typing..." indicator loop.
     */
    stopTypingIndicator(): void {
        if (this.typingInterval) {
            clearInterval(this.typingInterval);
            this.typingInterval = null;
            // Typing indicator stopped.
        }
    }

    /**
     * Sends a plain text message (with HTML support) to a Telegram chat.
     */
    async sendMessage(token: string, chatId: string, text: string): Promise<void> {
        try {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text,
                    parse_mode: 'HTML'
                })
            });
        } catch (e) {
            console.error('[TelegramService] sendMessage failed:', e);
        }
    }

    async sendMessageWithButtons(token: string, chatId: string, text: string, buttons: { text: string; data: string }[][]): Promise<void> {
        const replyMarkup = {
            inline_keyboard: buttons.map(row => row.map(btn => ({ text: btn.text, callback_data: btn.data })))
        };

        try {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text,
                    reply_markup: replyMarkup,
                    parse_mode: 'HTML'
                })
            });
        } catch (e) {
            console.error('[TelegramService] sendMessageWithButtons failed:', e);
        }
    }

    async answerCallback(token: string, callbackQueryId: string, text?: string): Promise<void> {
        try {
            await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    callback_query_id: callbackQueryId,
                    text: text || ''
                })
            });
        } catch (e) {
            console.error('[TelegramService] answerCallback failed:', e);
        }
    }

    async startPolling(
        config: AppConfig, 
        onMessage: (message: TelegramUpdate['message'], updateId: number) => Promise<void> | void,
        onCallback?: (callback: TelegramUpdate['callback_query'], updateId: number) => Promise<void> | void
    ) {
        // Restore singleton guard to prevent multiple while loops
        if (TelegramService.polling) return;
        
        // Increment ID for versioning logic
        TelegramService.currentPollingId++;
        const localLoopId = TelegramService.currentPollingId;
        
        TelegramService.polling = true;

        // On first start, try to skip old messages if lastUpdateId is 0
        if (TelegramService.lastUpdateId === 0) {
            try {
                const initResp = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/getUpdates?limit=1&offset=-1`);
                const initData = await initResp.json();
                if (initData.ok && initData.result.length > 0) {
                    TelegramService.lastUpdateId = initData.result[0].update_id;
                    // Skipping old messages. Starting from update_id: ${TelegramService.lastUpdateId}
                }
            } catch (e) {
                console.warn('[TelegramService] Could not fetch initial offset:', e);
            }
        }

        // Starting poll loop...

        while (TelegramService.polling && TelegramService.currentPollingId === localLoopId) {
            const updates = await this.getUpdates(config);
            
            // Check again after long poll returns
            if (!TelegramService.polling || TelegramService.currentPollingId !== localLoopId) {
                // Loop invalidated or stopped.
                break;
            }

            for (const update of updates) {
                // Deduplication Case: If we already processed this update ID, skip it.
                if (TelegramService.processedUpdateIds.has(update.update_id)) {
                    continue;
                }
                TelegramService.processedUpdateIds.add(update.update_id);
                
                // Limit set size to avoid memory leak
                if (TelegramService.processedUpdateIds.size > 200) {
                    const oldest = Array.from(TelegramService.processedUpdateIds)[0];
                    TelegramService.processedUpdateIds.delete(oldest);
                }

                // Handle Callbacks (Buttons)
                if (update.callback_query && onCallback) {
                    if (config.telegramChatId && update.callback_query.from.id.toString() !== config.telegramChatId) continue;
                    await onCallback(update.callback_query, update.update_id);
                    continue;
                }

                if (update.message) {
                    if (config.telegramChatId && update.message.chat.id.toString() !== config.telegramChatId) continue;

                    // Start typing indicator immediately
                    const token = config.telegramBotToken;
                    const chatId = update.message.chat.id.toString();
                    if (token) this.startTypingIndicator(token, chatId);

                    try {
                        // Handle Text Messages
                        if (update.message.text) {
                            await onMessage(update.message, update.update_id);
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
                                await onMessage(voiceMsg, update.update_id);
                            } else {
                                console.warn('[TelegramService] Voice transcription failed:', res.error);
                                const errorMsg = {
                                    ...update.message,
                                    text: `[Sistema] No pude transcribir el mensaje de voz. Error: ${res.error || 'Desconocido'}`
                                };
                                await onMessage(errorMsg, update.update_id);
                            }
                        }
                    } catch (err) {
                        console.error('[TelegramService] Processing error:', err);
                    } finally {
                        this.stopTypingIndicator();
                    }
                }
            }
            if (TelegramService.polling) await new Promise(r => setTimeout(r, 1000));
        }
    }

    stopPolling() {
        TelegramService.polling = false;
        this.stopTypingIndicator();
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        // Polling stopped.
    }
}

export const telegramService = new TelegramService();
