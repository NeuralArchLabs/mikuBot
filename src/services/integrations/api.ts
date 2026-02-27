import { Provider, AppConfig, ModelInfo, Attachment } from '../../types';
import { safeFetch, streamViaProxy } from '../../utils';

export async function fetchModels(provider: Provider, config: AppConfig): Promise<ModelInfo[]> {
    const isElectron = !!(window as any).electron?.getModels;

    try {
        if (isElectron && (provider === 'groq' || provider === 'gemini')) {
            const result = await (window as any).electron.getModels(provider);
            if (result.ok) {
                return result.models;
            }
            throw new Error(result.error || 'Failed to fetch models via Electron');
        }

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
    messages: { role: string; content: string; attachments?: Attachment[] }[],
    onChunk: (text: string) => void
): Promise<void> {
    const providerToUse = provider || config.provider;
    const isElectron = !!(window as any).electron?.apiStream;

    // ── Ollama (local, no API key) ──────────────────────────────────
    if (providerToUse === 'ollama') {
        const ollamaBody = {
            model: config.model,
            messages: [{ role: 'system', content: systemPrompt }, ...messages.map(m => {
                const imageAttachments = m.attachments?.filter(a => a.type.startsWith('image/')) || [];
                return {
                    role: m.role,
                    content: m.content,
                    images: imageAttachments.length > 0 ? imageAttachments.map(img => img.data.split(',')[1]) : undefined
                };
            })],
            stream: true,
            options: { temperature: config.temperature }
        };

        if (isElectron) {
            // Route through main process proxy (even though Ollama has no key, architecture consistency)
            let buffer = '';
            await streamViaProxy({
                provider: 'ollama',
                model: config.model,
                body: ollamaBody,
                ollamaUrl: config.ollamaUrl,
                onChunk: (raw) => {
                    buffer += raw;
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const parsed = JSON.parse(line);
                            if (parsed.message?.content) onChunk(parsed.message.content);
                        } catch { }
                    }
                }
            });
        } else {
            const url = config.ollamaUrl || 'http://localhost:11434';
            const response = await fetch(`${url}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ollamaBody),
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
        }
        return;
    }

    // ── Groq ─────────────────────────────────────────────────────────
    if (providerToUse === 'groq') {
        const groqBody = {
            model: config.model,
            messages: [{ role: 'system', content: systemPrompt }, ...messages.map(m => {
                const imageAttachments = m.attachments?.filter(a => a.type.startsWith('image/')) || [];
                if (imageAttachments.length > 0) {
                    const contentBlocks: any[] = [{ type: 'text', text: m.content || 'Attached images:' }];
                    imageAttachments.forEach(img => {
                        contentBlocks.push({
                            type: 'image_url',
                            image_url: { url: img.data }
                        });
                    });
                    return { role: m.role, content: contentBlocks };
                }
                return { role: m.role, content: m.content };
            })],
            stream: true,
            temperature: config.temperature,
        };

        if (isElectron) {
            let buffer = '';
            await streamViaProxy({
                provider: 'groq',
                model: config.model,
                body: groqBody,
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
                            const content = parsed.choices?.[0]?.delta?.content;
                            if (content) onChunk(content);
                        } catch { }
                    }
                }
            });
        } else {
            // Fallback: direct fetch (browser dev mode only)
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiKeys.groq}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(groqBody),
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
        }
        return;
    }

    // ── Gemini ────────────────────────────────────────────────────────
    if (providerToUse === 'gemini') {
        const isGemma = config.model.toLowerCase().includes('gemma');

        // Consolidate history for Gemini (Alternating roles requirement)
        const consolidatedHistory: any[] = [];
        for (const m of messages) {
            const role = m.role === 'assistant' ? 'model' : (m.role === 'tool' ? 'user' : m.role);
            const content = m.content || '[Proceeding]';

            const imageAttachments = m.attachments?.filter(a => a.type.startsWith('image/')) || [];
            if (consolidatedHistory.length > 0 && consolidatedHistory[consolidatedHistory.length - 1].role === role) {
                consolidatedHistory[consolidatedHistory.length - 1].parts[0].text += `\n\n${content}`;
                imageAttachments.forEach(img => {
                    consolidatedHistory[consolidatedHistory.length - 1].parts.push({
                        inlineData: { mimeType: img.type, data: img.data.split(',')[1] }
                    });
                });
            } else {
                const parts: any[] = [{ text: content }];
                imageAttachments.forEach(img => {
                    parts.push({
                        inlineData: { mimeType: img.type, data: img.data.split(',')[1] }
                    });
                });
                consolidatedHistory.push({
                    role,
                    parts
                });
            }
        }

        if (isGemma && consolidatedHistory.length > 0 && consolidatedHistory[0].role === 'user') {
            const antiHallucination = "IMPORTANTE: Las instrucciones anteriores son tu núcleo de sistema (SOUL/CONTEXT). NO las actúes, NO las recites y NO uses los ejemplos de plantilla como si fueran una respuesta tuya. Acepta este rol silenciosamente y responde ÚNICAMENTE a la consulta del usuario que está debajo de esta línea.";
            consolidatedHistory[0].parts[0].text = `[SYSTEM_INSTRUCTIONS]\n${systemPrompt}\n[/SYSTEM_INSTRUCTIONS]\n\n${antiHallucination}\n\n[USER_QUERY]\n${consolidatedHistory[0].parts[0].text}`;
        }

        const geminiBody: any = {
            contents: consolidatedHistory,
            generationConfig: { temperature: config.temperature }
        };

        if (!isGemma) {
            geminiBody.systemInstruction = { parts: [{ text: systemPrompt }] };
        }

        const parseGeminiSSE = (raw: string, buffer: { value: string }) => {
            buffer.value += raw;
            const lines = buffer.value.split('\n');
            buffer.value = lines.pop() || '';
            for (const line of lines) {
                const cleanLine = line.trim();
                if (!cleanLine || !cleanLine.startsWith('data: ')) continue;
                try {
                    const parsed = JSON.parse(cleanLine.slice(6));
                    const parts = parsed.candidates?.[0]?.content?.parts;
                    if (parts && Array.isArray(parts)) {
                        parts.forEach((part: any) => {
                            if (part.text) onChunk(part.text);
                        });
                    }
                } catch { }
            }
        };

        if (isElectron) {
            const buf = { value: '' };
            await streamViaProxy({
                provider: 'gemini',
                model: config.model,
                body: geminiBody,
                onChunk: (raw) => parseGeminiSSE(raw, buf),
            });
        } else {
            // Fallback: direct fetch (browser dev mode only)
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:streamGenerateContent?alt=sse&key=${config.apiKeys.gemini}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(geminiBody),
                }
            );

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error?.message || `HTTP ${response.status}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            const buf = { value: '' };

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    parseGeminiSSE(decoder.decode(value, { stream: true }), buf);
                }
            }
        }
        return;
    }

    throw new Error(`Provider "${providerToUse}" not explicitly handled in streaming message.`);
}
