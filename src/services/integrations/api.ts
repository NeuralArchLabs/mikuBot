import { Provider, AppConfig, ModelInfo } from '../../types';
import { safeFetch } from '../../utils';

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
                const url = config.ollamaUrl || 'http://localhost:11434';
                const data = await safeFetch(`${url}/api/tags`);
                if (!data || !data.models) return [];
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
    provider: Provider | undefined,
    config: AppConfig,
    systemPrompt: string,
    messages: { role: string; content: string }[],
    onChunk: (text: string) => void
): Promise<void> {
    const providerToUse = provider || config.provider;

    if (providerToUse === 'ollama') {
        const url = config.ollamaUrl || 'http://localhost:11434';
        const response = await fetch(`${url}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: config.model,
                messages: [{ role: 'system', content: systemPrompt }, ...messages],
                stream: true,
                options: { temperature: config.temperature }
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Ollama Error: ${err}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (reader) {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(Boolean);
                for (const line of lines) {
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.message?.content) onChunk(parsed.message.content);
                    } catch { }
                }
            }
        }
        return;
    }

    if (providerToUse === 'groq') {
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

                    const data = cleanLine.slice(6);
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
        const isGemma = config.model.toLowerCase().includes('gemma');
        const contents = messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : m.role,
            parts: [{ text: m.content }]
        }));

        // Gemma doesn't support separate systemInstruction; prepend to first user message
        if (isGemma && contents.length > 0 && contents[0].role === 'user') {
            contents[0].parts[0].text = `[SYSTEM]\n${systemPrompt}\n[/SYSTEM]\n\n${contents[0].parts[0].text}`;
        }

        const body: any = {
            contents,
            generationConfig: { temperature: config.temperature }
        };

        if (!isGemma) {
            body.systemInstruction = { parts: [{ text: systemPrompt }] };
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:streamGenerateContent?alt=sse&key=${config.apiKeys.gemini}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }
        );

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || `HTTP ${response.status}`);
        }

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
                        const parsed = JSON.parse(cleanLine.slice(6));
                        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) onChunk(text);
                    } catch { }
                }
            }
        }
    }
}
