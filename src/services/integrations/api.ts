import { Provider, AppConfig, ModelInfo, Attachment } from '../../types';
import { safeFetch, streamViaProxy } from '../../utils';
import { hasVisionCapability, inferOllamaCapabilities, inferProviderModelCapabilities } from './modelCapabilities';
import { inferReasoningEfforts } from '../core/reasoning';

const enrichOllamaModel = async (url: string, model: ModelInfo): Promise<ModelInfo> => {
    // Most recent Ollama versions already include this in /api/tags. Avoid a
    // second request in that common case.
    if (hasVisionCapability(model.capabilities)) return model;

    try {
        const showResponse = await safeFetch(`${url}/api/show`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: model.id })
        });
        const capabilities = inferOllamaCapabilities(showResponse);
        return capabilities.length > 0 ? { ...model, capabilities } : model;
    } catch (error) {
        // Metadata enrichment is best-effort. The model list should remain
        // usable if an older Ollama build does not support /api/show.
        console.warn(`[Models] Could not inspect Ollama model ${model.id}:`, error);
        return model;
    }
};

export async function fetchModels(provider: Provider, config: AppConfig): Promise<ModelInfo[]> {
    if (provider === 'unsloth') {
        const bridge = (window as any).electron;
        if (!bridge?.getUnslothModels) throw new Error('Reinicia la aplicación de escritorio para cargar la conexión de Unsloth.');
        const models = await bridge.getUnslothModels({ url: config.unslothUrl || 'http://localhost:8888/v1' });
        return (Array.isArray(models) ? models : []).map((model: any) => ({
            ...model,
            reasoningEfforts: inferReasoningEfforts('unsloth', model.id, model)
        }));
    }
    try {
        // Guard: Skip providers that require an API key when none is configured
        const keyMap: Partial<Record<Provider, string>> = {
            groq: config.apiKeys?.groq,
            gemini: config.apiKeys?.gemini,
            zai: config.apiKeys?.zai,
        };
        // Ollama is local and doesn't need a key, so it's excluded from this check
        if (provider in keyMap && !keyMap[provider as keyof typeof keyMap]?.trim()) {
            return [];
        }

        switch (provider) {
            case 'codex': {
                const bridge = (window as any).electron;
                if (!bridge?.codexGetStatus || !bridge?.codexGetModels) return [];
                const status = await bridge.codexGetStatus();
                if (!status.available || status.account?.type !== 'chatgpt') return [];
                const models = await bridge.codexGetModels();
                return (Array.isArray(models) ? models : [])
                    .filter((model: any) => typeof model.model === 'string' && !model.hidden)
                    .sort((a: any, b: any) => Number(!!b.isDefault) - Number(!!a.isDefault))
                    .map((model: any) => ({
                        id: model.model,
                        name: model.displayName || model.model,
                        provider: 'codex' as const,
                        capabilities: model.inputModalities?.includes('image') ? ['text', 'vision'] : ['text'],
                        reasoningEfforts: inferReasoningEfforts('codex', model.model, model),
                        defaultReasoningEffort: model.defaultReasoningEffort
                            || model.default_reasoning_effort
                            || model.defaultReasoningLevel
                            || model.default_reasoning_level
                    }));
            }
            case 'groq': {
                const data = await safeFetch('https://api.groq.com/openai/v1/models', {
                    headers: { 'Authorization': `Bearer ${config.apiKeys.groq}` }
                });
                return Array.isArray(data?.data)
                    ? data.data.map((m: any) => ({
                        id: m.id,
                        name: m.id,
                        provider: 'groq',
                        capabilities: inferProviderModelCapabilities('groq', m),
                        reasoningEfforts: inferReasoningEfforts('groq', m.id, m),
                        defaultReasoningEffort: m.defaultReasoningEffort || m.default_reasoning_effort
                    }))
                    : [];
            }
            case 'gemini': {
                const data = await safeFetch(
                    `https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKeys.gemini}`
                );
                return (Array.isArray(data?.models) ? data.models : [])
                    .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
                    .map((m: any) => ({
                        id: m.name.replace('models/', ''),
                        name: m.displayName,
                        provider: 'gemini',
                        capabilities: inferProviderModelCapabilities('gemini', m),
                        reasoningEfforts: inferReasoningEfforts('gemini', m.name, m),
                        defaultReasoningEffort: m.defaultReasoningEffort || m.default_reasoning_effort
                    }));
            }
            case 'ollama': {
                const url = (config.ollamaUrl || 'http://localhost:11434').trim().replace(/\/+$/, '');
                const data = await safeFetch(`${url}/api/tags`);
                if (!data || !Array.isArray(data.models)) return [];
                const models: ModelInfo[] = data.models.map((m: any) => ({
                    id: m.name,
                    name: m.name,
                    provider: 'ollama',
                    capabilities: Array.isArray(m.capabilities) ? m.capabilities : [],
                    reasoningEfforts: inferReasoningEfforts('ollama', m.name, m),
                    defaultReasoningEffort: m.defaultReasoningEffort || m.default_reasoning_effort
                }));
                // /api/tags is intentionally kept as the fast list endpoint;
                // /api/show fills the capability gap only for models that do
                // not advertise vision there (Gemma 3/4 are common examples).
                return Promise.all(models.map(model => enrichOllamaModel(url, model)));
            }
            case 'zai': {
                const data = await safeFetch('https://api.z.ai/api/coding/paas/v4/models', {
                    headers: { 'Authorization': `Bearer ${config.apiKeys.zai}` }
                });
                if (!data || !Array.isArray(data.data)) return [];
                return data.data.map((m: any) => ({
                    id: m.id,
                    name: m.id,
                    provider: 'zai',
                    capabilities: inferProviderModelCapabilities('zai', m),
                    reasoningEfforts: inferReasoningEfforts('zai', m.id, m),
                    defaultReasoningEffort: m.defaultReasoningEffort || m.default_reasoning_effort
                }));
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
                const d = new Date(m.timestamp);
                const locale = config.language || 'en';
                const month = d.toLocaleString(locale, { month: 'short' }).toUpperCase().replace('.', '');
                const day = d.toLocaleString(locale, { day: '2-digit' });
                const time = d.toLocaleString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
                const ts = `${time} ${month}/${day}`;
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
