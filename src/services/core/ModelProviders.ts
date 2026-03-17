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
     * Formats messages to the specific provider's expected structure.
     */
    protected abstract serializeMessages(messages: any[]): any[];

    protected async streamFetch(url: string, headers: Record<string, string>, body: any): Promise<ProviderResponse> {
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
        let buffer = '';

        if (reader) {
            while (true) {
                if (this.options.abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const cleanLine = line.trim();
                    if (!cleanLine || !cleanLine.startsWith('data: ')) continue;
                    const data = cleanLine.slice(6);
                    if (data === '[DONE]') continue;
                    
                    try {
                        const parsed = JSON.parse(data);
                        this.processDelta(parsed.choices?.[0]?.delta, parsed);
                    } catch { }
                }
            }
        }

        return {
            content: this.fullContent,
            toolCalls: this.getToolCalls(),
            reasoning: this.fullReasoning
        };
    }

    protected async streamProxy(provider: string, body: any): Promise<ProviderResponse> {
        let buffer = '';
        await streamViaProxy({
            provider,
            model: this.options.config.model,
            body,
            abortSignal: this.options.abortSignal,
            onChunk: (raw) => {
                buffer += raw;
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    const cleanLine = line.trim();
                    if (!cleanLine || !cleanLine.startsWith('data: ')) continue;
                    const data = cleanLine.slice(6);
                    if (data === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(data);
                        this.processDelta(parsed.choices?.[0]?.delta, parsed);
                    } catch { }
                }
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
            this.options.onStatus({ streamedText: this.fullContent, phase: 'streaming' });
        }
        if (delta.reasoning_content) {
            this.fullReasoning += delta.reasoning_content;
            this.options.onStatus({ streamedReasoning: this.fullReasoning, phase: 'streaming' });
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
            temperature: this.options.config.temperature,
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
            this.options.onStatus({ streamedText: this.fullContent, phase: 'streaming' });
        }
        if (fullParsed?.message?.thought) {
            this.fullReasoning += fullParsed.message.thought;
            this.options.onStatus({ streamedReasoning: this.fullReasoning, phase: 'streaming' });
        }
        if (fullParsed?.message?.tool_calls) {
            this.toolCallsDeltas = [...this.toolCallsDeltas, ...fullParsed.message.tool_calls];
        }
    }

    async streamRequest(messages: any[]): Promise<ProviderResponse> {
        const url = `${this.options.config.ollamaUrl || 'http://localhost:11434'}/api/chat`;
        const body = {
            model: this.options.config.model,
            messages: this.serializeMessages(messages),
            stream: true,
            tools: this.options.useTools ? this.options.tools : undefined
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: this.options.abortSignal,
        });

        if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            throw new Error(`Ollama HTTP ${response.status}: ${errBody}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        if (reader) {
            while (true) {
                if (this.options.abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const cleanLine = line.trim();
                    if (!cleanLine) continue;
                    try {
                        const parsed = JSON.parse(cleanLine);
                        this.processDelta(null, parsed);
                    } catch { }
                }
            }
        }

        return { content: this.fullContent, toolCalls: this.getToolCalls(), reasoning: this.fullReasoning };
    }
}

/**
 * Gemini Provider
 */
export class GeminiProvider extends ModelProvider {
    supportsNativeTools(): boolean {
        return true;
    }

    protected serializeMessages(messages: any[]): any[] {
        const consolidatedHistory: any[] = [];
        const systemPromptContent = messages.find(m => m.role === 'system')?.content || '';

        for (const m of messages.filter(msg => msg.role !== 'system')) {
            const role = m.role === 'assistant' ? 'model' : (m.role === 'tool' ? 'user' : m.role);
            const parts: any[] = [];

            if (m.role === 'tool') {
                parts.push({
                    functionResponse: {
                        name: (m as any).tool_name || 'unknown_tool',
                        response: { content: m.content || '{}' }
                    }
                });
            } else if (m.role === 'assistant' && m.tool_calls && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
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

    protected processDelta(delta: any) {}

    async streamRequest(messages: any[]): Promise<ProviderResponse> {
        const isThinkingModel = this.options.config.model.toLowerCase().includes('thinking');
        const systemPromptContent = messages.find(m => m.role === 'system')?.content || '';
        const body: any = {
            contents: this.serializeMessages(messages),
            generationConfig: {
                temperature: this.options.config.temperature,
                thinkingConfig: isThinkingModel ? { include_thoughts: true } : undefined
            },
            systemInstruction: { parts: [{ text: systemPromptContent }] },
            tools: this.options.useTools ? [{ functionDeclarations: this.options.tools.map(t => t.function) }] : undefined
        };

        if (this.options.isElectronProxy) {
            await streamViaProxy({
                provider: 'gemini',
                model: this.options.config.model,
                body,
                abortSignal: this.options.abortSignal,
                onChunk: (raw) => {
                    const lines = raw.split('\n');
                    for (const line of lines) {
                        const cleanLine = line.trim();
                        if (!cleanLine || !cleanLine.startsWith('data: ')) continue;
                        try {
                            const parsed = JSON.parse(cleanLine.slice(6));
                            this.handleGeminiParsed(parsed);
                        } catch { }
                    }
                }
            });
        } else {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.options.config.model}:streamGenerateContent?alt=sse&key=${this.options.config.apiKeys.gemini}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: this.options.abortSignal,
            });

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                        const cleanLine = line.trim();
                        if (!cleanLine || !cleanLine.startsWith('data: ')) continue;
                        try {
                            this.handleGeminiParsed(JSON.parse(cleanLine.slice(6)));
                        } catch { }
                    }
                }
            }
        }

        return { content: this.fullContent, toolCalls: this.getToolCalls(), reasoning: this.fullReasoning };
    }

    private handleGeminiParsed(parsed: any) {
        const parts = parsed.candidates?.[0]?.content?.parts;
        if (parts && Array.isArray(parts)) {
            parts.forEach((part: any) => {
                if (part.text) {
                    this.fullContent += part.text;
                    this.options.onStatus({ streamedText: this.fullContent, phase: 'streaming' });
                }
                if (part.thought || part.thought_content) {
                    this.fullReasoning += (part.thought || part.thought_content);
                    this.options.onStatus({ streamedReasoning: this.fullReasoning, phase: 'streaming' });
                }
                if (part.functionCall) {
                    this.toolCallsDeltas.push({
                        id: 'tc-' + Math.random().toString(36).slice(2, 9),
                        type: 'function',
                        function: {
                            name: part.functionCall.name,
                            arguments: part.functionCall.args
                        }
                    });
                }
            });
        }
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
                return new OpenAICompatibleProvider(options, 'zai', 'https://api.z.ai/api/coding/paas/v4/chat/completions', options.config.apiKeys.zai);
            case 'ollama':
                return new OllamaProvider(options);
            case 'gemini':
                return new GeminiProvider(options);
            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }
    }
}
