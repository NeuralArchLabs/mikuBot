/**
 * Model Providers Implementation (OOP)
 * Path: src/services/core/ModelProviders.ts
 */

import { AppConfig, Provider, AgentStatus, ToolDefinition } from '../../types';
import { streamViaProxy } from '../../utils/helpers/streamProxy';

export interface ProviderResponse {
    content: string;
    toolCalls: any[];
    reasoning?: string;
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

export abstract class ModelProvider {
    protected fullContent = '';
    protected fullReasoning = '';
    protected toolCallsDeltas: any[] = [];

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
    protected handleStreamRaw(raw: string, bufferState: { buffer: string }, useSSE: boolean = true) {
        bufferState.buffer += raw;
        const lines = bufferState.buffer.split('\n');
        bufferState.buffer = lines.pop() || '';

        const prevContentLen = this.fullContent.length;
        const prevReasoningLen = this.fullReasoning.length;
        let hasChanges = false;

        for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;

            let data = cleanLine;
            if (useSSE) {
                if (!cleanLine.startsWith('data: ')) continue;
                data = cleanLine.slice(6);
                if (data === '[DONE]') continue;
            }

            try {
                const parsed = JSON.parse(data);
                this.processDelta(parsed.choices?.[0]?.delta, parsed);
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
                phase: 'streaming' 
            });
        }
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
            throw new Error(err.error?.message || `HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        const streamState = { buffer: '' };

        if (reader) {
            while (true) {
                if (this.options.abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');
                const { done, value } = await reader.read();
                if (done) break;

                const raw = decoder.decode(value, { stream: true });
                this.handleStreamRaw(raw, streamState, useSSE);
            }
        }

        return {
            content: this.fullContent,
            toolCalls: this.getToolCalls(),
            reasoning: this.fullReasoning
        };
    }

    protected async streamProxy(provider: string, body: any, useSSE: boolean = true): Promise<ProviderResponse> {
        const streamState = { buffer: '' };
        await streamViaProxy({
            provider,
            model: this.options.config.model,
            body,
            abortSignal: this.options.abortSignal,
            onChunk: (raw) => {
                this.handleStreamRaw(raw, streamState, useSSE);
            }
        });

        return {
            content: this.fullContent,
            toolCalls: this.getToolCalls(),
            reasoning: this.fullReasoning
        };
    }
}

/**
 * OpenAI-style providers (Groq, Z.AI)
 */
export class OpenAICompatibleProvider extends ModelProvider {
    constructor(options: ProviderOptions, private providerName: string, private baseUrl: string, private apiKey: string) {
        super(options);
    }

    supportsNativeTools(): boolean {
        return true;
    }

    protected serializeMessages(messages: any[]): any[] {
        return messages.map(m => {
            const imageAttachments = m.attachments?.filter((a: any) => a.type.startsWith('image/')) || [];
            if (imageAttachments.length > 0) {
                const contentBlocks: any[] = [{ type: 'text', text: m.content || '' }];
                imageAttachments.forEach((img: any) => {
                    contentBlocks.push({
                        type: 'image_url',
                        image_url: { url: img.data }
                    });
                });
                return { role: m.role, content: contentBlocks };
            }
            return { role: m.role, content: m.content || '' };
        });
    }

    protected processDelta(delta: any) {
        if (!delta) return;

        if (delta.content) {
            this.fullContent += delta.content;
        }
        if (delta.reasoning_content) {
            this.fullReasoning += delta.reasoning_content;
        }
        if (delta.tool_calls) {
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
    }

    async streamRequest(messages: any[]): Promise<ProviderResponse> {
        const body = {
            model: this.options.config.model,
            messages: this.serializeMessages(messages),
            stream: true,
            temperature: this.options.config.temperature ?? 0.7,
            tools: this.options.useTools ? this.options.tools : undefined
        };

        if (this.options.isElectronProxy) {
            return this.streamProxy(this.providerName, body);
        } else {
            const headers = {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            };
            return this.streamFetch(this.baseUrl, headers, body);
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
            const role = m.role === 'assistant' ? 'assistant' : (m.role === 'system' ? 'system' : 'user');
            const imageAttachments = m.attachments?.filter((a: any) => a.type.startsWith('image/')) || [];
            
            if (imageAttachments.length > 0) {
                const contentBlocks: any[] = [{ type: 'text', text: m.content || '' }];
                imageAttachments.forEach((img: any) => {
                    contentBlocks.push({
                        type: 'image_url',
                        image_url: { url: img.data }
                    });
                });
                return { role, content: contentBlocks };
            }
            return { role, content: m.content || '' };
        });
    }

    protected processDelta(delta: any) {
        if (!delta) return;

        // Zhipu uses standard content but also supports reasoning_content in newer models
        if (delta.content) {
            this.fullContent += delta.content;
        }
        if (delta.reasoning_content) {
            this.fullReasoning += delta.reasoning_content;
        }
        if (delta.tool_calls) {
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
    }

    async streamRequest(messages: any[]): Promise<ProviderResponse> {
        const body = {
            model: this.options.config.model,
            messages: this.serializeMessages(messages),
            stream: true,
            temperature: this.options.config.temperature ?? 0.7,
            tools: this.options.useTools ? this.options.tools : undefined
        };

        const baseUrl = 'https://api.z.ai/api/coding/paas/v4/chat/completions';

        if (this.options.isElectronProxy) {
            return this.streamProxy('zai', body);
        } else {
            const headers = {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            };
            return this.streamFetch(baseUrl, headers, body);
        }
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
            const imageAttachments = m.attachments?.filter((a: any) => a.type.startsWith('image/')) || [];
            return {
                role: m.role,
                content: m.content,
                tool_calls: m.tool_calls,
                images: imageAttachments.length > 0 ? imageAttachments.map((img: any) => img.data.split(',')[1]) : undefined
            };
        });
    }

    protected processDelta(delta: any, fullParsed?: any) {
        if (fullParsed?.message?.content) {
            this.fullContent += fullParsed.message.content;
        }
        if (fullParsed?.message?.thought) {
            this.fullReasoning += fullParsed.message.thought;
        }
        if (fullParsed?.message?.tool_calls) {
            this.toolCallsDeltas = [...this.toolCallsDeltas, ...fullParsed.message.tool_calls];
        }
    }

    async streamRequest(messages: any[]): Promise<ProviderResponse> {
        const body = {
            model: this.options.config.model,
            messages: this.serializeMessages(messages),
            stream: true,
            options: { temperature: this.options.config.temperature ?? 0.7 },
            tools: this.options.useTools ? this.options.tools : undefined
        };

        if (this.options.isElectronProxy) {
            return this.streamProxy('ollama', { ...body, ollamaUrl: this.options.config.ollamaUrl }, false);
        } else {
            const url = `${this.options.config.ollamaUrl || 'http://localhost:11434'}/api/chat`;
            return this.streamFetch(url, { 'Content-Type': 'application/json' }, body, false);
        }
    }
}

/**
 * Gemini Provider
 */
export class GeminiProvider extends ModelProvider {
    supportsNativeTools(): boolean {
        return !this.options.config.model.toLowerCase().includes('gemma');
    }

    protected serializeMessages(messages: any[]): any[] {
        const isGemma = this.options.config.model.toLowerCase().includes('gemma');
        const systemPromptContent = messages.find(m => m.role === 'system')?.content || '';
        const filteredMessages = messages.filter(msg => msg.role !== 'system');
        const consolidatedHistory: any[] = [];

        for (let i = 0; i < filteredMessages.length; i++) {
            const m = filteredMessages[i];
            const role = m.role === 'assistant' ? 'model' : (m.role === 'tool' ? 'user' : m.role);
            const parts: any[] = [];

            if (m.role === 'tool' && this.supportsNativeTools()) {
                parts.push({
                    functionResponse: {
                        name: (m as any).tool_name || 'unknown_tool',
                        response: { content: m.content || '{}' }
                    }
                });
            } else if (m.role === 'assistant' && m.tool_calls && Array.isArray(m.tool_calls) && m.tool_calls.length > 0 && this.supportsNativeTools()) {
                if (m.content) parts.push({ text: m.content });
                m.tool_calls.forEach((tc: any) => {
                    parts.push({
                        functionCall: {
                            name: tc.function.name,
                            args: typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments
                        }
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

                // Gemma Restoration: Inject system prompt into first user message
                if (isGemma && i === 0 && role === 'user') {
                    const antiHallucination = "IMPORTANTE: Las instrucciones anteriores son tu núcleo de sistema. NO las actúes, NO las recites y NO uses los ejemplos de plantilla como si fueran una respuesta tuya. Acepta este rol silenciosamente.";
                    text = `[SYSTEM_INSTRUCTIONS]\n${systemPromptContent}\n[/SYSTEM_INSTRUCTIONS]\n\n${antiHallucination}\n\n[USER_QUERY]\n${text}`;
                }

                if (text) parts.push({ text });

                const imageAttachments = m.attachments?.filter((a: any) => a.type.startsWith('image/')) || [];
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
        const parts = fullParsed?.candidates?.[0]?.content?.parts;
        if (parts && Array.isArray(parts)) {
            parts.forEach((part: any, idx: number) => {
                // GEMINI ACCUMULATION FIX: The API sometimes sends previously sent parts in same list.
                // We only append if these parts are actually new OR if we manage it by index.
                // Simple approach: only take the text part if it's not already the suffix of our content
                if (part.text) {
                    if (!this.fullContent.endsWith(part.text)) {
                        this.fullContent += part.text;
                    }
                }
                if (part.thought || part.thought_content) {
                    const t = (part.thought || part.thought_content);
                    if (!this.fullReasoning.endsWith(t)) {
                        this.fullReasoning += t;
                    }
                }
                if (part.functionCall) {
                    // Check if this tool call is already indexed
                    const callName = part.functionCall.name;
                    const alreadyHas = this.toolCallsDeltas.some(tc => tc.function.name === callName);
                    
                    if (!alreadyHas) {
                        this.toolCallsDeltas.push({
                            id: 'tc-' + Math.random().toString(36).slice(2, 9),
                            type: 'function',
                            function: {
                                name: callName,
                                arguments: part.functionCall.args
                            }
                        });
                    }
                }
            });
        }
    }

    async streamRequest(messages: any[]): Promise<ProviderResponse> {
        const isThinkingModel = this.options.config.model.toLowerCase().includes('thinking');
        const isGemma = this.options.config.model.toLowerCase().includes('gemma');
        const systemPromptContent = messages.find(m => m.role === 'system')?.content || '';
        
        const contents = this.serializeMessages(messages);
        const historyHasTools = contents.some((c: any) => c.parts.some((p: any) => p.functionCall || p.functionResponse));

        const body: any = {
            contents,
            generationConfig: {
                temperature: this.options.config.temperature,
                thinkingConfig: isThinkingModel ? { include_thoughts: true } : undefined
            },
            // Gemma doesn't support the systemInstruction field
            systemInstruction: !isGemma ? { parts: [{ text: systemPromptContent }] } : undefined,
            tools: (this.options.useTools || (historyHasTools && this.options.tools.length > 0))
                ? [{ functionDeclarations: this.options.tools.map(t => t.function) }]
                : undefined
        };

        if (this.options.isElectronProxy) {
            await this.streamProxy('gemini', body, true);
        } else {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.options.config.model}:streamGenerateContent?alt=sse&key=${this.options.config.apiKeys.gemini}`;
            await this.streamFetch(url, { 'Content-Type': 'application/json' }, body, true);
        }

        return { content: this.fullContent, toolCalls: this.getToolCalls(), reasoning: this.fullReasoning };
    }
}

/**
 * Provider Factory
 */
export class ProviderFactory {
    static create(provider: Provider, options: ProviderOptions): ModelProvider {
        switch (provider) {
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
