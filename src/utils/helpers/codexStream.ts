import type { ProviderOptions, ProviderResponse } from '../../services/core/ModelProviders';
import { getConfiguredReasoningEffort } from '../../services/core/reasoning.ts';

// Re-export the provider-neutral helpers from this already testable transport
// module. The desktop test harness loads ModelProviders from an in-memory data
// URL and rewrites this module's URL; keeping the runtime import behind this
// file preserves that harness while the UI/API layers continue importing the
// dedicated reasoning module directly.
export {
    getConfiguredReasoningEffort,
    isReasoningParameterError,
    resolveGeminiThinkingConfig,
    resolveOllamaThink
} from '../../services/core/reasoning.ts';

interface CodexStreamEvent {
    streamId: string;
    type: 'content' | 'reasoning';
    delta: string;
}

type CodexReasoningSummary = 'auto' | 'concise' | 'detailed' | 'none';

interface CodexBridge {
    codexStream: (request: {
        streamId: string;
        model: string;
        messages: any[];
        tools: ProviderOptions['tools'];
        useTools: boolean;
        effort?: string;
        summary?: CodexReasoningSummary;
    }) => Promise<ProviderResponse>;
    onCodexStreamEvent: (callback: (event: CodexStreamEvent) => void) => () => void;
    codexAbortStream: (streamId: string) => void;
}

let streamSequence = 0;

/** Uses only the managed desktop Codex session; it never opens an API endpoint. */
export async function streamViaCodex(messages: any[], options: ProviderOptions): Promise<ProviderResponse> {
    const { abortSignal } = options;
    if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');

    const electron: CodexBridge | undefined = typeof window !== 'undefined'
        ? (window as any).electron
        : undefined;
    if (typeof electron?.codexStream !== 'function'
        || typeof electron?.onCodexStreamEvent !== 'function'
        || typeof electron?.codexAbortStream !== 'function') {
        throw new Error('Codex requiere la aplicación de escritorio de MikuCentral y una sesión de ChatGPT conectada.');
    }

    const streamId = `codex_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${++streamSequence}`}`;

    // State belongs to this request, including when a provider instance is reused.
    let content = '';
    let reasoning = '';
    let sequence = 0;
    let firstContentSequence: number | undefined;
    let firstReasoningSequence: number | undefined;
    const reasoningFollowsContent = () => firstContentSequence !== undefined
        && firstReasoningSequence !== undefined
        && firstReasoningSequence > firstContentSequence;

    return new Promise<ProviderResponse>((resolve, reject) => {
        let settled = false;
        let started = false;
        let unsubscribe: (() => void) | undefined;

        const cleanup = () => {
            abortSignal.removeEventListener('abort', onAbort);
            try { unsubscribe?.(); } catch { /* Cleanup must not replace the result. */ }
            unsubscribe = undefined;
        };

        const fail = (error: unknown, cancel: boolean = false) => {
            if (settled) return;
            settled = true;
            cleanup();
            if (cancel && started) {
                try { electron.codexAbortStream(streamId); } catch { /* Preserve the original error. */ }
            }
            reject(error);
        };

        const onAbort = () => fail(new DOMException('Aborted', 'AbortError'), true);
        const publishStatus = (followsContent = reasoningFollowsContent()) => options.onStatus({
            streamedText: content,
            streamedReasoning: reasoning || undefined,
            streamedReasoningFollowsText: followsContent,
            phase: 'streaming'
        });

        try {
            // Register before invoking IPC so the first streamed event cannot be lost.
            unsubscribe = electron.onCodexStreamEvent(event => {
                if (settled || abortSignal.aborted || event?.streamId !== streamId
                    || typeof event.delta !== 'string' || !event.delta) return;
                try {
                    if (event.type === 'content') {
                        if (firstContentSequence === undefined) firstContentSequence = ++sequence;
                        content += event.delta;
                        options.onChunk?.(event.delta);
                    } else if (event.type === 'reasoning') {
                        if (firstReasoningSequence === undefined) firstReasoningSequence = ++sequence;
                        reasoning += event.delta;
                    } else {
                        return;
                    }
                    if (!settled) publishStatus();
                } catch (error) {
                    fail(error, true);
                }
            });
            abortSignal.addEventListener('abort', onAbort, { once: true });
            if (abortSignal.aborted) {
                onAbort();
                return;
            }

            started = true;
            const effort = getConfiguredReasoningEffort(options.config);
            // `effort` selects how much reasoning the model may use. The
            // separate `summary` override asks the app-server to expose a
            // readable reasoning summary in the stream. Without it, Codex
            // may keep the summary mode at its server default (`none`).
            // `none` remains explicit so disabling reasoning also hides its
            // summary channel.
            const summary: CodexReasoningSummary = effort === 'none' ? 'none' : 'detailed';
            Promise.resolve(electron.codexStream({
                streamId,
                model: options.config.model,
                messages,
                tools: options.tools,
                useTools: options.useTools,
                ...(effort !== 'auto' ? { effort } : {}),
                summary
            })).then(result => {
                if (settled) return;
                if (!result || typeof result.content !== 'string' || !Array.isArray(result.toolCalls)) {
                    throw new Error('Codex devolvió una respuesta inválida.');
                }
                const finalReasoning = result.reasoning ?? reasoning;
                const finalOrder = result.reasoningFollowsContent ?? reasoningFollowsContent();
                if (result.content !== content || finalReasoning !== reasoning) {
                    // A final item can contain text that was not delivered as deltas.
                    const tail = result.content.startsWith(content) ? result.content.slice(content.length) : '';
                    content = result.content;
                    reasoning = finalReasoning;
                    if (tail) options.onChunk?.(tail);
                    if (!settled) publishStatus(finalOrder);
                }
                if (settled) return;
                settled = true;
                cleanup();
                resolve({ ...result, reasoning: finalReasoning, reasoningFollowsContent: finalOrder });
            }).catch(error => fail(error, true));
        } catch (error) {
            fail(error, true);
        }
    });
}
