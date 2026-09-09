/**
 * Model Providers Implementation (OOP)
 * Path: src/services/core/ModelProviders.ts
 */

import { AppConfig, Provider, AgentStatus, ToolDefinition } from '../../types';
import { streamViaProxy } from '../../utils/helpers/streamProxy';
import {
    streamViaCodex,
    getConfiguredReasoningEffort,
    isReasoningParameterError,
    resolveGeminiThinkingConfig,
    resolveOllamaThink
} from '../../utils/helpers/codexStream';

export interface ProviderResponse {
    content: string;
    toolCalls: any[];
    reasoning?: string;
    /** Preserves the first observed channel order for providers that interleave them. */
    reasoningFollowsContent?: boolean;
    thought_signature?: string;
    finishReason?: string;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export interface ProviderOptions {
    config: AppConfig;
    onStatus: (status: Partial<AgentStatus>) => void;
    onChunk?: (chunk: string) => void;
    abortSignal: AbortSignal;
    useTools: boolean;
    tools: ToolDefinition[];
    isElectronProxy: boolean;
}

/**
 * Read-only compatibility for histories saved before reasoning became a
 * structured message field. New messages must never write this representation.
 */
function extractLegacyThinkingBlock(content: string): { thinking: string; rest: string } {
    const match = content.match(/^<thinking>\n?([\s\S]*?)\n?<\/thinking>\n*/m);
    if (match) {
        return { thinking: match[1].trim(), rest: content.slice(match[0].length).trim() };
    }
    return { thinking: '', rest: content };
}

/** Some OpenAI-compatible servers send a structured error as an SSE event
 * after returning HTTP 200. Preserve it so the chat never renders a blank
 * assistant reply for an overlong request or another stream-side failure. */
function streamErrorMessage(parsed: any): string | null {
    if (!parsed || typeof parsed !== 'object' || !Object.prototype.hasOwnProperty.call(parsed, 'error')) return null;
    const error = parsed.error;
    if (error == null) return null;
    if (typeof error === 'string' && error.trim()) return error.trim();
    if (error && typeof error === 'object') {
        for (const candidate of [error.message, error.detail, error.error]) {
            if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
        }
    }
    return 'El servidor devolvió un error durante la respuesta en streaming.';
}

export abstract class ModelProvider {
    protected fullContent = '';
    protected fullReasoning = '';
    protected firstContentSequence?: number;
    protected firstReasoningSequence?: number;
    protected streamSequence = 0;
    protected thoughtSignature = '';
    protected toolCallsDeltas: any[] = [];
    protected lastFinishReason = '';
    protected lastUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };

    constructor(protected options: ProviderOptions) {}

    /**
     * Main entry point for streaming requests.
     */
    abstract streamRequest(messages: any[]): Promise<ProviderResponse>;

    /**
     * Returns true if the model natively supports tool calling.
     */
    abstract supportsNativeTools(): boolean;

    /**
     * Determines if a specific error should trigger a fallback (retry without tools).
     */
    shouldFallback(error: any): boolean {
        const msg = (error?.message || '').toLowerCase();
        return msg.includes('http 400') || msg.includes('http 422') || msg.includes('invalid_argument') || msg.includes('too many tools');
    }

    protected getToolCalls(): any[] {
        return this.toolCallsDeltas.filter(Boolean);
    }

    protected abstract processDelta(delta: any, fullParsed?: any): void;

    /**
     * Helper to process stream chunks by lines, handling buffer and SSE syntax.
     */
    protected handleStreamRaw(raw: string, bufferState: { buffer: string }, useSSE: boolean = true): string | null {
        bufferState.buffer += raw;
        const lines = bufferState.buffer.split('\n');
        bufferState.buffer = lines.pop() || '';

        const prevContentLen = this.fullContent.length;
        const prevReasoningLen = this.fullReasoning.length;
        let hasChanges = false;
        let streamedError: string | null = null;

        for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;

            let data = cleanLine;
            if (useSSE) {
                if (!cleanLine.startsWith('data:')) continue;
                data = cleanLine.slice(5).trimStart();
                if (data === '[DONE]') continue;
            }

            try {
                const contentLengthBeforeDelta = this.fullContent.length;
                const reasoningLengthBeforeDelta = this.fullReasoning.length;
                const parsed = JSON.parse(data);
                const error = streamErrorMessage(parsed);
                if (error) {
                    streamedError ||= error;
                    continue;
                }
                this.processDelta(parsed.choices?.[0]?.delta, parsed);
                if (this.fullContent.length > contentLengthBeforeDelta && this.firstContentSequence === undefined) {
                    this.firstContentSequence = ++this.streamSequence;
                }
                if (this.fullReasoning.length > reasoningLengthBeforeDelta && this.firstReasoningSequence === undefined) {
                    this.firstReasoningSequence = ++this.streamSequence;
                }
                hasChanges = true;
            } catch { }
        }

        if (hasChanges) {
            // Batch Emit: Send consolidated status update once per raw data chunk
            if (this.fullContent.length > prevContentLen) {
                const newText = this.fullContent.slice(prevContentLen);
                if (this.options.onChunk) this.options.onChunk(newText);
            }
            
            this.options.onStatus({ 
                streamedText: this.fullContent, 
                streamedReasoning: this.fullReasoning.length > 0 ? this.fullReasoning : undefined,
                streamedReasoningFollowsText: this.reasoningFollowsContent(),
                phase: 'streaming' 
            });
        }
        return streamedError;
    }

    /**
     * Formats messages to the specific provider's expected structure.
     */
    protected abstract serializeMessages(messages: any[]): any[];

    protected async streamFetch(url: string, headers: Record<string, string>, body: any, useSSE: boolean = true): Promise<ProviderResponse> {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: this.options.abortSignal,
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const message = typeof err === 'string'
                ? err
                : err?.error?.message
                    || (typeof err?.error === 'string' ? err.error : undefined)
                    || err?.message
                    || err?.detail;
            throw new Error(message || `HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        const streamState = { buffer: '' };
        let streamedError: string | null = null;

        if (reader) {
            while (true) {
                if (this.options.abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');
                const { done, value } = await reader.read();
                if (done) break;

                const raw = decoder.decode(value, { stream: true });
                const chunkError = this.handleStreamRaw(raw, streamState, useSSE);
                streamedError ||= chunkError;
            }
        }
        const finalError = this.handleStreamRaw(decoder.decode() + '\n', streamState, useSSE);
        streamedError ||= finalError;
        if (streamedError) throw new Error(streamedError);

        return {
            content: this.fullContent,
            toolCalls: this.getToolCalls(),
            reasoning: this.fullReasoning,
            reasoningFollowsContent: this.reasoningFollowsContent(),
            thought_signature: this.thoughtSignature,
            finishReason: this.lastFinishReason,
            usage: this.lastUsage
        };
    }

    protected async streamProxy(provider: string, body: any, useSSE: boolean = true, overrideUrl?: string): Promise<ProviderResponse> {
        const streamState = { buffer: '' };
        let streamedError: string | null = null;
        await streamViaProxy({
            provider,
            model: this.options.config.model,
            body,
            ollamaUrl: this.options.config.ollamaUrl,
            overrideUrl,
            abortSignal: this.options.abortSignal,
            onChunk: (raw) => {
                const chunkError = this.handleStreamRaw(raw, streamState, useSSE);
                streamedError ||= chunkError;
            }
        });
        const finalError = this.handleStreamRaw('\n', streamState, useSSE);
        streamedError ||= finalError;
        if (streamedError) throw new Error(streamedError);

        return {
            content: this.fullContent,
            toolCalls: this.getToolCalls(),
            reasoning: this.fullReasoning,
            reasoningFollowsContent: this.reasoningFollowsContent(),
            thought_signature: this.thoughtSignature,
            finishReason: this.lastFinishReason,
            usage: this.lastUsage
        };
    }

    protected reasoningFollowsContent(): boolean {
        return this.firstContentSequence !== undefined
            && this.firstReasoningSequence !== undefined
            && this.firstReasoningSequence > this.firstContentSequence;
    }
}

/** ChatGPT-authenticated Codex, transported through the managed desktop app server. */
export class CodexProvider extends ModelProvider {
    supportsNativeTools(): boolean {
        return true;
    }

    shouldFallback(_error: unknown): boolean {
        // Authentication, quota and native-tool failures stay on the Codex session.
        return false;
    }

    protected serializeMessages(messages: any[]): any[] {
        return messages;
    }

    protected processDelta(_delta: any): void {
        // Codex sends typed IPC events rather than SSE model deltas.
    }

    async streamRequest(messages: any[]): Promise<ProviderResponse> {
        return streamViaCodex(this.serializeMessages(messages), this.options);
    }
}

const legacyGeminiSystemInstructionModels = new Set<string>();

function explicitlyRejectsSystemInstruction(error: unknown): boolean {
    const message = String((error as any)?.message || error || '').toLowerCase();
    const systemInstruction = /(?:system[\s_-]*(?:instruction|role)|developer[\s_-]*instruction)/;
    const unsupported = /(?:not supported|unsupported|not allowed|invalid|unknown field|unrecognized field)/;
    return (systemInstruction.test(message) && unsupported.test(message)) ||
        /(?:not supported|unsupported).*(?:system[\s_-]*(?:instruction|role)|developer[\s_-]*instruction)/.test(message);
}

/**
 * OpenAI-style providers (Groq, Unsloth, and Z.AI)
 */
export class OpenAICompatibleProvider extends ModelProvider {
    constructor(options: ProviderOptions, private providerName: string, private baseUrl: string, private apiKey: string) {
        super(options);
    }

    supportsNativeTools(): boolean {
        return true;
    }

    shouldFallback(error: any): boolean {
        const message = String(error?.message || error || '');
        if (this.providerName === 'unsloth'
            && /context_length_exceeded|exceed_context_size|available context size|n_prompt_tokens|context.{0,50}(?:exceed|overflow|too (?:long|large))|(?:exceed|overflow|too (?:long|large)).{0,50}context/i.test(message)) {
            // A full context says nothing about the model's tool capability.
            // Keep the error visible instead of caching a false incompatibility.
            return false;
        }
        return super.shouldFallback(error);
    }

    protected serializeMessages(messages: any[]): any[] {
        return messages.map(m => {
            const res: any = { role: m.role };
            
            // Handle tool call history (assistant message that made the calls)
            if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
                res.tool_calls = m.tool_calls.map((tc: any) => ({
                    id: tc.id,
                    type: 'function',
                    function: {
                        name: tc.function.name,
                        arguments: typeof tc.function.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function.arguments)
                    }
                }));
            }

            // Handle tool response history
            if (m.role === 'tool') {
                res.tool_call_id = m.tool_call_id;
                res.content = m.content || '{}';
                return res;
            }

            const imageAttachments = m.attachments?.filter((a: any) => a.type?.startsWith('image/') && a.data && !a.extractedContent) || [];
            if (imageAttachments.length > 0) {
                const contentBlocks: any[] = [{ type: 'text', text: m.content || '' }];
                imageAttachments.forEach((img: any) => {
                    contentBlocks.push({
                        type: 'image_url',
                        image_url: { url: img.data }
                    });
                });
                res.content = contentBlocks;
            } else {
                res.content = m.content || '';
            }
            return res;
        });
    }

    protected processDelta(delta: any, fullParsed?: any) {
        if (!delta && !fullParsed) return;
        const fr = fullParsed?.choices?.[0]?.finish_reason;
        if (fr) this.lastFinishReason = fr;

        if (delta?.content) this.fullContent += delta.content;
        const reasoningDelta = delta?.reasoning_content ?? delta?.reasoning ?? delta?.thinking;
        if (typeof reasoningDelta === 'string') this.fullReasoning += reasoningDelta;
        if (delta?.tool_calls) {
            for (const tcDelta of delta.tool_calls) {
                const idx = tcDelta.index;
                if (!this.toolCallsDeltas[idx]) {
                    this.toolCallsDeltas[idx] = { id: tcDelta.id, function: { name: '', arguments: '' } };
                }
                if (tcDelta.id) this.toolCallsDeltas[idx].id = tcDelta.id;
                if (tcDelta.function?.name) this.toolCallsDeltas[idx].function.name += tcDelta.function.name;
                if (tcDelta.function?.arguments) this.toolCallsDeltas[idx].function.arguments += tcDelta.function.arguments;
            }
        }
        if (fullParsed?.usage) {
            this.lastUsage = {
                promptTokens: fullParsed.usage.prompt_tokens,
                completionTokens: fullParsed.usage.completion_tokens,
                totalTokens: fullParsed.usage.total_tokens
            };
        }
    }

    async streamRequest(messages: any[]): Promise<ProviderResponse> {
        const serializedMessages = this.serializeMessages(messages);
        const configuredEffort = getConfiguredReasoningEffort(this.options.config);
        const execute = async (includeReasoning: boolean): Promise<ProviderResponse> => {
            const reasoningBody = includeReasoning && configuredEffort !== 'auto'
                ? {
                    reasoning_effort: configuredEffort,
                    ...(this.providerName === 'groq' && configuredEffort !== 'none'
                        ? { reasoning_format: 'parsed' }
                        : {})
                }
                : {};
            const body = {
                model: this.options.config.model,
                messages: serializedMessages,
                stream: true,
                temperature: this.options.config.temperature ?? 0.7,
                ...(this.providerName === 'unsloth'
                    ? { stream_options: { include_usage: true } }
                    : { max_tokens: this.providerName === 'groq' ? 4096 : ((this.options.config as any).maxOutputTokens || 128000) }),
                tools: this.options.useTools ? this.options.tools : undefined,
                ...reasoningBody
            };

            if (this.options.isElectronProxy || this.providerName === 'unsloth') {
                return this.streamProxy(this.providerName, body);
            }
            const headers = {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            };
            return this.streamFetch(this.baseUrl, headers, body);
        };

        try {
            return await execute(true);
        } catch (error) {
            // OpenAI-compatible servers differ in whether they implement
            // reasoning_effort. If a selected level is rejected, retry once
            // without that optional field and keep the response usable.
            if (configuredEffort !== 'auto' && isReasoningParameterError(error)) {
                console.warn(`[${this.providerName}] reasoning effort is not supported by ${this.options.config.model}; retrying with the model default.`);
                this.fullContent = '';
                this.fullReasoning = '';
                this.toolCallsDeltas = [];
                this.firstContentSequence = undefined;
                this.firstReasoningSequence = undefined;
                this.streamSequence = 0;
                return execute(false);
            }
            throw error;
        }
    }
}

/**
 * Z.AI (Zhipu BigModel) - Specialized implementation
 */
export class ZAIProvider extends ModelProvider {
    constructor(options: ProviderOptions, private apiKey: string) {
        super(options);
    }

    supportsNativeTools(): boolean {
        return true;
    }

    protected serializeMessages(messages: any[]): any[] {
        return messages.map(m => {
            const role = (m.role === 'assistant') ? 'assistant' : 
                         (m.role === 'system' ? 'system' : 
                         (m.role === 'tool' ? 'tool' : 'user'));
            const res: any = { role };
            if (m.role === 'assistant' && m.tool_calls?.length) {
                res.tool_calls = m.tool_calls.map((tc: any) => ({
                    id: tc.id, type: 'function',
                    function: { name: tc.function.name, arguments: typeof tc.function.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function.arguments) }
                }));
            }
            if (m.role === 'tool') {
                res.tool_call_id = m.tool_call_id;
                res.content = m.content || '{}';
                return res;
            }
            const imageAttachments = m.attachments?.filter((a: any) => a.type?.startsWith('image/') && a.data && !a.extractedContent) || [];
            if (imageAttachments.length > 0) {
                const contentBlocks: any[] = [{ type: 'text', text: m.content || '' }];
                imageAttachments.forEach((img: any) => contentBlocks.push({ type: 'image_url', image_url: { url: img.data } }));
                res.content = contentBlocks;
            } else {
                res.content = m.content || '';
            }
            return res;
        });
    }

    protected processDelta(delta: any, fullParsed?: any) {
        if (!delta && !fullParsed) return;
        const fr = fullParsed?.choices?.[0]?.finish_reason;
        if (fr) this.lastFinishReason = fr;
        if (delta?.content) this.fullContent += delta.content;
        const reasoningDelta = delta?.reasoning_content ?? delta?.reasoning ?? delta?.thinking;
        if (typeof reasoningDelta === 'string') this.fullReasoning += reasoningDelta;
        if (delta?.tool_calls) {
            for (const tcDelta of delta.tool_calls) {
                const idx = tcDelta.index;
                if (!this.toolCallsDeltas[idx]) this.toolCallsDeltas[idx] = { id: tcDelta.id, function: { name: '', arguments: '' } };
                if (tcDelta.id) this.toolCallsDeltas[idx].id = tcDelta.id;
                if (tcDelta.function?.name) this.toolCallsDeltas[idx].function.name += tcDelta.function.name;
                if (tcDelta.function?.arguments) this.toolCallsDeltas[idx].function.arguments += tcDelta.function.arguments;
            }
        }
        if (fullParsed?.usage) {
            this.lastUsage = {
                promptTokens: fullParsed.usage.prompt_tokens,
                completionTokens: fullParsed.usage.completion_tokens,
                totalTokens: fullParsed.usage.total_tokens
            };
        }
    }

    async streamRequest(messages: any[]): Promise<ProviderResponse> {
        const configuredEffort = getConfiguredReasoningEffort(this.options.config);
        const body = {
            model: this.options.config.model,
            messages: this.serializeMessages(messages),
            stream: true,
            temperature: this.options.config.temperature ?? 0.7,
            max_tokens: this.options.config.maxOutputTokens || 128000,
            tools: this.options.useTools ? this.options.tools : undefined,
            ...(configuredEffort === 'none'
                ? { thinking: { type: 'disabled' } }
                : configuredEffort !== 'auto'
                    ? { thinking: { type: 'enabled' } }
                    : {})
        };

        const endpoints = [
            'https://api.z.ai/api/coding/paas/v4/chat/completions', // Primary (Coding Plan)
            'https://api.z.ai/api/paas/v4/chat/completions'         // Fallback (General/Pay-as-you-go plan)
        ];

        let lastError: any;

        for (let i = 0; i < endpoints.length; i++) {
            const url = endpoints[i];
            try {
                if (this.options.isElectronProxy) {
                    return await this.streamProxy('zai', body, true, url);
                } else {
                    const headers = { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' };
                    return await this.streamFetch(url, headers, body);
                }
            } catch (err: any) {
                lastError = err;
                const msg = (err.message || '').toLowerCase();
                
                // If it's the last endpoint, we must throw the error
                if (i === endpoints.length - 1) throw err;
                
                // Only fallback on specific environment/quota related errors:
                // 1113 = ZAI specific insufficient balance
                // 429 = Rate limit or quota exhausted
                // 501, 404 = Endpoint doesn't exist or not implemented
                // 401 = Unauthorized (some plans reject keys at specific endpoints)
                if (msg.includes('1113') || msg.includes('429') || msg.includes('501') || msg.includes('404') || msg.includes('401')) {
                    console.warn(`[ZAIProvider] Endpoint ${url} failed to authenticate or execute (${msg}). Falling back to alternative endpoint...`);
                    // Reset memory accumulation for the retry
                    this.fullContent = '';
                    this.fullReasoning = '';
                    this.toolCallsDeltas = [];
                    continue;
                }
                
                // For all other errors (like network failures), throw immediately
                throw err;
            }
        }
        
        throw lastError;
    }
}

/**
 * Ollama Provider
 */
export class OllamaProvider extends ModelProvider {
    supportsNativeTools(): boolean {
        return true;
    }

    protected serializeMessages(messages: any[]): any[] {
        return messages.filter(m => m.content || (m.tool_calls && m.tool_calls.length > 0)).map(m => {
            // Only send images if the attachment has raw data and was NOT already processed
            // by the Vision Vortex (extractedContent means Vortex ran and data was stripped upstream).
            // Sending images to non-vision Ollama models causes them to crash.
            const imageAttachments = m.attachments?.filter((a: any) =>
                a.type?.startsWith('image/') && a.data && !a.extractedContent
            ) || [];
            const serialized: any = {
                role: m.role,
                content: m.content,
                tool_calls: m.tool_calls,
                images: imageAttachments.length > 0 ? imageAttachments.map((img: any) => img.data.split(',')[1]) : undefined
            };
            if (m.role === 'tool') {
                serialized.tool_name = m.tool_name;
                serialized.tool_call_id = m.tool_call_id;
            }
            return serialized;
        });
    }

    protected processDelta(delta: any, fullParsed?: any) {
        if (fullParsed?.message?.content) {
            this.fullContent += fullParsed.message.content;
        }
        if (fullParsed?.message?.thought) {
            this.fullReasoning += fullParsed.message.thought;
        }
        if (fullParsed?.message?.thinking) {
            this.fullReasoning += fullParsed.message.thinking;
        }
        if (fullParsed?.message?.reasoning) {
            this.fullReasoning += fullParsed.message.reasoning;
        }
        if (fullParsed?.message?.tool_calls) {
            this.toolCallsDeltas = [...this.toolCallsDeltas, ...fullParsed.message.tool_calls];
        }
        if (fullParsed?.prompt_eval_count !== undefined) {
            const prompt = fullParsed.prompt_eval_count;
            const comp = fullParsed.eval_count || 0;
            this.lastUsage = {
                promptTokens: prompt,
                completionTokens: comp,
                totalTokens: prompt + comp
            };
        }
    }

    async streamRequest(messages: any[]): Promise<ProviderResponse> {
        const configuredEffort = getConfiguredReasoningEffort(this.options.config);
        const thinkValue = resolveOllamaThink(this.options.config.model, configuredEffort);
        const buildBody = (includeThink: boolean) => ({
            model: this.options.config.model,
            messages: this.serializeMessages(messages),
            stream: true,
            // keep_alive prevents the model from being unloaded from VRAM between requests.
            // Without this, every message after ~5 min of inactivity triggers a full model
            // reload (30-120s for larger models), causing the UI to appear "hung".
            keep_alive: '30m',
            options: { 
                temperature: this.options.config.temperature ?? 0.7,
                ...(this.options.config.ollamaNumGpu !== undefined && this.options.config.ollamaNumGpu >= 0 
                    ? { num_gpu: this.options.config.ollamaNumGpu } 
                    : {}),
                ...(this.options.config.ollamaNumCtx && this.options.config.ollamaNumCtx > 0 
                    ? { num_ctx: this.options.config.ollamaNumCtx } 
                    : {}),
                ...(this.options.config.ollamaMainGpu !== undefined 
                    ? { main_gpu: this.options.config.ollamaMainGpu } 
                    : {}),
                ...(this.options.config.ollamaNumThread && this.options.config.ollamaNumThread > 0 
                    ? { num_thread: this.options.config.ollamaNumThread } 
                    : {})
            },
            tools: this.options.useTools ? this.options.tools : undefined,
            // `think` accepts a boolean for most models and a level for newer
            // models such as GPT-OSS. Omit it only on the compatibility retry.
            ...(includeThink ? { think: thinkValue } : {})
        });

        // The normalized selector is authoritative when it contains an
        // explicit level. The old toggle only applies while the selector is
        // Auto, so a user can recover from a legacy disabled setting by
        // choosing Low/Medium/High for the current model.
        const isGptOss = /gpt[-_.]?oss/i.test(this.options.config.model);
        const wantsThink = (isGptOss && configuredEffort === 'none')
            || (configuredEffort !== 'none'
                && (configuredEffort !== 'auto' || this.options.config.ollamaThink !== false));

        const execute = async (includeThink: boolean): Promise<ProviderResponse> => {
            if (this.options.isElectronProxy) {
                return this.streamProxy('ollama', buildBody(includeThink), false);
            } else {
                const rawBase = (this.options.config.ollamaUrl || 'http://localhost:11434').replace('localhost', '127.0.0.1');
                return this.streamFetch(`${rawBase}/api/chat`, { 'Content-Type': 'application/json' }, buildBody(includeThink), false);
            }
        };

        try {
            return await execute(wantsThink);
        } catch (err: any) {
            // Automatic fallback: model reported it doesn't support thinking.
            // Retry transparently without the `think` field so any Ollama model
            // works regardless of the global ollamaThink setting.
            const msg = (err?.message || '').toLowerCase();
            if (wantsThink && msg.includes('does not support thinking')) {
                console.warn(`[OllamaProvider] Model "${this.options.config.model}" does not support thinking. Retrying without think field...`);
                // Reset accumulated state before retry
                this.fullContent = '';
                this.fullReasoning = '';
                this.toolCallsDeltas = [];
                this.firstContentSequence = undefined;
                this.firstReasoningSequence = undefined;
                this.streamSequence = 0;
                return execute(false);
            }
            throw err;
        }
    }
}

/**
 * Gemini Provider
 */
export class GeminiProvider extends ModelProvider {
    private readonly streamedPartSnapshots = new Map<string, string>();
    private readonly streamedFunctionCalls = new Set<string>();

    private appendStreamedPart(channel: 'content' | 'reasoning', index: number, value: unknown): void {
        if (typeof value !== 'string' || value.length === 0) return;
        const key = `${channel}:${index}`;
        const previous = this.streamedPartSnapshots.get(key) || '';
        const isExpandedSnapshot = previous.length > 0 && value.length > previous.length && value.startsWith(previous);
        const addition = isExpandedSnapshot ? value.slice(previous.length) : value;
        this.streamedPartSnapshots.set(key, isExpandedSnapshot ? value : previous + value);
        if (channel === 'reasoning') this.fullReasoning += addition;
        else this.fullContent += addition;
    }

    supportsNativeTools(): boolean {
        // Modern Gemini and Gemma models provided through the API all support native structuring now.
        return true;
    }

    protected serializeMessages(messages: any[], legacySystemAsUser: boolean = false): any[] {
        const systemPromptContent = messages.find(m => m.role === 'system')?.content || '';
        const filteredMessages = messages.filter(msg => msg.role !== 'system');
        const consolidatedHistory: any[] = [];

        for (let i = 0; i < filteredMessages.length; i++) {
            const m = filteredMessages[i];
            const role = m.role === 'assistant' ? 'model' : (m.role === 'tool' ? 'user' : m.role);
            const parts: any[] = [];

            if (m.role === 'tool' && this.supportsNativeTools()) {
                const sig = (m as any).thought_signature || (m as any).thoughtSignature;
                const toolName = (m as any).tool_name;
                const safeName = (toolName && String(toolName).trim()) || 'unknown_tool';
                parts.push({
                    functionResponse: {
                        name: safeName,
                        response: { content: m.content || '{}' }
                    },
                    ...(sig ? { thought_signature: sig } : {})
                });
            } else if (m.role === 'assistant' && m.tool_calls && Array.isArray(m.tool_calls) && m.tool_calls.length > 0 && this.supportsNativeTools()) {
                const legacyThinking0 = extractLegacyThinkingBlock(m.content || '');
                const thinkingText0 = m.reasoning || legacyThinking0.thinking;
                const narrativeText0 = legacyThinking0.rest;
                const sig = m.thought_signature || m.thoughtSignature;
                if (thinkingText0 && sig) {
                    parts.push({ text: thinkingText0, thought: true, thoughtSignature: sig });
                    if (narrativeText0) {
                        parts.push({ text: narrativeText0 });
                    }
                } else {
                    if (m.content) {
                        parts.push({ text: m.content });
                    }
                }

                m.tool_calls.forEach((tc: any) => {
                    const callSig = tc.thought_signature || tc.thoughtSignature;
                    parts.push({
                        functionCall: {
                            name: tc.function.name,
                            args: typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments
                        },
                        ...(callSig ? { thought_signature: callSig } : {})
                    });
                });
            } else {
                let text = m.content || '';
                if (!text && m.role === 'assistant') text = '[Procesando...]';

                // Fallback for non-native tool calling (like Gemma) or simple text turns
                if (m.role === 'tool' && !this.supportsNativeTools()) {
                    text = `[RESULTADO DE HERRAMIENTA]: ${m.content}`;
                } else if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0 && !this.supportsNativeTools()) {
                    const callSummary = m.tool_calls.map((tc: any) => 
                        `LLAMADA: ${tc.function?.name || 'unknown'}(${JSON.stringify(tc.function?.arguments || {})})`
                    ).join('\n');
                    text = (text ? text + '\n\n' : '') + callSummary;
                }

                // Compatibility is activated only after the provider explicitly
                // rejects systemInstruction. It contains no model-specific advice.
                if (legacySystemAsUser && i === 0 && role === 'user' && systemPromptContent) {
                    text = `[SYSTEM_INSTRUCTIONS]\n${systemPromptContent}\n[/SYSTEM_INSTRUCTIONS]\n\n[USER_QUERY]\n${text}`;
                }

                if (m.role === 'assistant') {
                    const legacyThinking1 = extractLegacyThinkingBlock(text);
                    const thinkingText1 = m.reasoning || legacyThinking1.thinking;
                    const visibleText1 = legacyThinking1.rest;
                    const sig = m.thought_signature || m.thoughtSignature;
                    if (thinkingText1 && sig) {
                        parts.push({ text: thinkingText1, thought: true, thoughtSignature: sig });
                        parts.push({ text: visibleText1 || '[Procesando...]' });
                    } else {
                        parts.push({ text: text || '[Procesando...]' });
                    }
                } else {
                    if (text) parts.push({ text });
                }

                const imageAttachments = m.attachments?.filter((a: any) => a.type?.startsWith('image/') && a.data && !a.extractedContent) || [];
                imageAttachments.forEach((img: any) => {
                    parts.push({
                        inlineData: { mimeType: img.type, data: img.data.split(',')[1] }
                    });
                });
            }

            if (consolidatedHistory.length > 0 && consolidatedHistory[consolidatedHistory.length - 1].role === role) {
                consolidatedHistory[consolidatedHistory.length - 1].parts.push(...parts);
            } else {
                consolidatedHistory.push({ role, parts });
            }
        }
        return consolidatedHistory;
    }

    protected processDelta(delta: any, fullParsed?: any) {
        // Capture finish reason (Gemini format)
        const fr = fullParsed?.candidates?.[0]?.finishReason;
        if (fr && fr !== 'FINISH_REASON_UNSPECIFIED') {
            this.lastFinishReason = fr;
        }

        const parts = fullParsed?.candidates?.[0]?.content?.parts;
        if (parts && Array.isArray(parts)) {
            parts.forEach((part: any, idx: number) => {
                const isThoughtPart = part.thought === true;

                if (isThoughtPart) {
                    this.appendStreamedPart('reasoning', idx, part.text);
                    const sig = part.thoughtSignature || part.thought_signature;
                    if (sig) this.thoughtSignature = sig;
                } else if (part.text) {
                    this.appendStreamedPart('content', idx, part.text);
                }

                // Fallback for older/alternate Gemini versions that pass string directly
                if (typeof part.thought === 'string') {
                    this.appendStreamedPart('reasoning', idx, part.thought);
                    const sig = part.thoughtSignature || part.thought_signature;
                    if (sig) this.thoughtSignature = sig;
                } else if (typeof part.thought_content === 'string') {
                    this.appendStreamedPart('reasoning', idx, part.thought_content);
                    const sig = part.thoughtSignature || part.thought_signature;
                    if (sig) this.thoughtSignature = sig;
                }
                if (part.functionCall) {
                    const callName = part.functionCall.name;
                    const callKey = `${idx}:${callName}:${JSON.stringify(part.functionCall.args ?? {})}:${part.id || ''}`;
                    if (!this.streamedFunctionCalls.has(callKey)) {
                        this.streamedFunctionCalls.add(callKey);
                        const sig = part.thought_signature || part.thoughtSignature;
                        this.toolCallsDeltas.push({
                            id: 'tc-' + Math.random().toString(36).slice(2, 9),
                            type: 'function',
                            function: {
                                name: callName,
                                arguments: part.functionCall.args
                            },
                            thought_signature: sig
                        });
                    }
                }
            });
        }
        if (fullParsed?.usageMetadata) {
            this.lastUsage = {
                promptTokens: fullParsed.usageMetadata.promptTokenCount,
                completionTokens: fullParsed.usageMetadata.candidatesTokenCount,
                totalTokens: fullParsed.usageMetadata.totalTokenCount
            };
        }
    }

    async streamRequest(messages: any[]): Promise<ProviderResponse> {
        const configuredEffort = getConfiguredReasoningEffort(this.options.config);
        const isThinkingModel = this.options.config.model.toLowerCase().includes('thinking');
        const systemPromptContent = messages.find(m => m.role === 'system')?.content || '';
        const capabilityKey = `${this.options.config.model}::${this.options.isElectronProxy ? 'proxy' : 'direct'}`;
        
        const makeRequest = async (legacySystemAsUser: boolean) => {
            // Reset accumulation for retry
            this.fullContent = '';
            this.fullReasoning = '';
            this.toolCallsDeltas = [];
            this.streamedPartSnapshots.clear();
            this.streamedFunctionCalls.clear();
            this.thoughtSignature = '';
            this.lastFinishReason = '';
            this.lastUsage = undefined;
            this.firstContentSequence = undefined;
            this.firstReasoningSequence = undefined;
            this.streamSequence = 0;

            const contents = this.serializeMessages(messages, legacySystemAsUser);
            const historyHasTools = contents.some((c: any) => c.parts.some((p: any) => p.functionCall || p.functionResponse));
            
            const body: any = {
                contents,
                generationConfig: {
                    temperature: this.options.config.temperature ?? 0.7,
                    maxOutputTokens: this.options.config.maxOutputTokens || 128000, 
                    thinkingConfig: resolveGeminiThinkingConfig(this.options.config.model, configuredEffort)
                        || (isThinkingModel ? { includeThoughts: true } : undefined)
                },
                systemInstruction: (!legacySystemAsUser && systemPromptContent) ? { parts: [{ text: systemPromptContent }] } : undefined,
                tools: (this.options.useTools || (historyHasTools && this.options.tools.length > 0))
                    ? [{ functionDeclarations: this.options.tools.map(t => t.function) }]
                    : undefined
            };

            if (this.options.isElectronProxy) {
                return this.streamProxy('gemini', body, true);
            } else {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.options.config.model}:streamGenerateContent?alt=sse&key=${this.options.config.apiKeys.gemini}`;
                return this.streamFetch(url, { 'Content-Type': 'application/json' }, body, true);
            }
        };

        const legacySystemAsUser = legacyGeminiSystemInstructionModels.has(capabilityKey);
        try {
            return await makeRequest(legacySystemAsUser);
        } catch (error) {
            if (!legacySystemAsUser && systemPromptContent && explicitlyRejectsSystemInstruction(error)) {
                legacyGeminiSystemInstructionModels.add(capabilityKey);
                console.warn('[GeminiProvider] systemInstruction was explicitly rejected; enabling the minimal legacy transport for this model.');
                return makeRequest(true);
            }
            throw error;
        }
    }
}

/**
 * Provider Factory
 */
export class ProviderFactory {
    static create(provider: Provider, options: ProviderOptions): ModelProvider {
        switch (provider) {
            case 'unsloth':
                return new OpenAICompatibleProvider(options, 'unsloth', '', '');
            case 'codex':
                return new CodexProvider(options);
            case 'groq':
                return new OpenAICompatibleProvider(options, 'groq', 'https://api.groq.com/openai/v1/chat/completions', options.config.apiKeys.groq);
            case 'zai':
                return new ZAIProvider(options, options.config.apiKeys.zai);
            case 'ollama':
                return new OllamaProvider(options);
            case 'gemini':
                return new GeminiProvider(options);
            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }
    }
}
