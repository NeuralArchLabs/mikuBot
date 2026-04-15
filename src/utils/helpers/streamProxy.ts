/**
 * Secure API Streaming Proxy
 * 
 * Routes all LLM API calls through Electron's main process.
 * API keys are NEVER sent from the renderer — they are injected
 * by the main process from config.json on disk.
 * 
 * Falls back to direct fetch in browser mode (development only).
 */

let streamIdCounter = 0;

interface StreamProxyOptions {
    provider: string;
    model: string;
    body: any;
    ollamaUrl?: string;
    onChunk: (rawChunk: string) => void;
    abortSignal?: AbortSignal;
}

/**
 * Opens a streaming connection to an LLM API through the main process.
 * 
 * In Electron: The main process reads API keys from disk and proxies the request.
 * In Browser:  Falls back to direct fetch (for development ONLY).
 * 
 * @returns The raw text response accumulated from all chunks.
 */
export async function streamViaProxy(options: StreamProxyOptions): Promise<void> {
    const electron = (window as any).electron;
    const isElectron = !!electron?.apiStream;

    if (!isElectron) {
        throw new Error('Secure streaming requires the Electron desktop app.');
    }

    const streamId = `stream_${Date.now()}_${++streamIdCounter}`;

    return new Promise<void>((resolve, reject) => {
        let cleanup: (() => void) | null = null;
        let resolved = false;

        // Listen for chunks
        cleanup = electron.onApiStreamChunk((data: any) => {
            if (data.streamId !== streamId) return; // Ignore chunks from other streams

            if (data.done) {
                if (cleanup) cleanup();
                if (data.error && !resolved) {
                    resolved = true;
                    reject(new Error(data.error));
                } else if (!resolved) {
                    resolved = true;
                    resolve();
                }
                return;
            }

            // modelLoading: Ollama pre-flight passed but the model is being loaded into VRAM.
            // This is a status heartbeat — not a data chunk. We ignore it here; the UI
            // already shows a 'thinking' phase indicator during this period.
            if (data.modelLoading) return;

            if (data.chunk) {
                options.onChunk(data.chunk);
            }
        });

        // Handle abort
        if (options.abortSignal) {
            options.abortSignal.addEventListener('abort', () => {
                if (isElectron) electron.abortApiStream(streamId);
                if (cleanup) cleanup();
                if (!resolved) {
                    resolved = true;
                    reject(new DOMException('Aborted', 'AbortError'));
                }
            });
        }

        // Start the stream via IPC invoke
        electron.apiStream({
            provider: options.provider,
            model: options.model,
            body: options.body,
            ollamaUrl: options.ollamaUrl,
            streamId,
        }).then((result: any) => {
            if (!result.ok && !resolved) {
                if (cleanup) cleanup();
                resolved = true;
                reject(new Error(result.error || 'Stream failed'));
            }
        }).catch((err: any) => {
            if (cleanup) cleanup();
            if (!resolved) {
                resolved = true;
                reject(err);
            }
        });
    });
}
