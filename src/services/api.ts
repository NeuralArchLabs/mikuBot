import { Provider, AppConfig, ModelInfo } from '../types';
import { safeFetch } from '../utils';

export async function fetchModels(provider: Provider, config: AppConfig): Promise<ModelInfo[]> {
    try {
        switch (provider) {
            case 'groq': {
                const data = await safeFetch('https://api.groq.com/openai/v1/models', {
                    headers: { 'Authorization': `Bearer ${config.apiKeys.groq}` }
                });
                return data.data.map((m: any) => ({ id: m.id, name: m.id, provider: 'groq' }));
            }
            case 'gemini': {
                const data = await safeFetch(
                    `https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKeys.gemini}`
                );
                return data.models
                    .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
                    .map((m: any) => ({
                        id: m.name.replace('models/', ''),
                        name: m.displayName,
                        provider: 'gemini'
                    }));
            }
            case 'ollama': {
                const data = await safeFetch(`${config.ollamaUrl}/api/tags`);
                return data.models.map((m: any) => ({ id: m.name, name: m.name, provider: 'ollama' }));
            }
            default:
                return [];
        }
    } catch (error) {
        console.error('Error fetching models:', error);
        throw error;
    }
}

export async function sendStreamingMessage(
    provider: 'groq' | 'gemini',
    config: AppConfig,
    systemPrompt: string,
    messages: { role: string; content: string }[],
    onChunk: (text: string) => void
): Promise<void> {
    if (provider === 'groq') {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.apiKeys.groq}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: config.model,
                messages: [{ role: 'system', content: systemPrompt }, ...messages],
                stream: true,
                temperature: config.temperature,
            }),
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || `HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (reader) {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.startsWith('data: '));
                for (const line of lines) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content;
                        if (content) onChunk(content);
                    } catch { }
                }
            }
        }
    } else {
        // Gemini
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:streamGenerateContent?alt=sse&key=${config.apiKeys.gemini}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: messages.map(m => ({
                        role: m.role === 'assistant' ? 'model' : m.role,
                        parts: [{ text: m.content }]
                    })),
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    generationConfig: { temperature: config.temperature }
                }),
            }
        );

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || `HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (reader) {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.startsWith('data: '));
                for (const line of lines) {
                    try {
                        const parsed = JSON.parse(line.slice(6));
                        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) onChunk(text);
                    } catch { }
                }
            }
        }
    }
}
