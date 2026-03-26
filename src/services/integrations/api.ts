import { Provider, AppConfig, ModelInfo, Attachment } from '../../types';
import { safeFetch, streamViaProxy } from '../../utils';

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
            case 'zai': {
                const data = await safeFetch('https://api.z.ai/api/coding/paas/v4/models', {
                    headers: { 'Authorization': `Bearer ${config.apiKeys.zai}` }
                });
                if (!data || !data.data) return [];
                return data.data.map((m: any) => ({ id: m.id, name: m.id, provider: 'zai' }));
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
    messages: { role: string; content: string; timestamp?: number; attachments?: Attachment[] }[],
    onChunk: (text: string) => void
): Promise<void> {
    const providerType = provider || config.provider;
    const isElectronProxy = !!(window as any).electron?.apiStream;

    // Prepare full history for the provider
    const fullMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => {
            if (m.role === 'user' && m.timestamp) {
                const ts = new Date(m.timestamp).toLocaleString('es-ES', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '');
                return { ...m, content: `[${ts}] ${m.content || ''}` };
            }
            return { ...m, content: m.content || '' };
        })
    ];

    const providerInstance = (await import('../core/ModelProviders')).ProviderFactory.create(providerType, {
        config,
        onStatus: () => {}, // No-op for simple chat status
        onChunk,
        abortSignal: new AbortController().signal, // Should ideally be passed down, but this matches current API
        useTools: false, // Simple chat doesn't use tools here
        tools: [],
        isElectronProxy
    });

    try {
        await providerInstance.streamRequest(fullMessages);
    } catch (error) {
        console.error(`[API] Error in global streaming for ${providerType}:`, error);
        throw error;
    }
}
