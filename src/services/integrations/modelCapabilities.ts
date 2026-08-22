import type { ModelInfo, Provider } from '../../types';

/**
 * Ollama exposes capabilities in two places depending on its version:
 * `/api/tags` can contain a short list, while `/api/show` contains the
 * authoritative model metadata. Keep the normalization in one place so the
 * settings UI and the model fetcher cannot drift apart.
 */
export const normalizeModelCapabilities = (capabilities: unknown): string[] => (
    (Array.isArray(capabilities) || typeof capabilities === 'string')
        ? (Array.isArray(capabilities) ? capabilities.flat(Infinity) : [capabilities])
            .filter((capability): capability is string => typeof capability === 'string')
            .map(capability => capability.trim().toLowerCase())
            .filter(Boolean)
            .filter((capability, index, all) => all.indexOf(capability) === index)
        : []
);

export const hasVisionCapability = (capabilities: unknown): boolean => {
    const normalized = normalizeModelCapabilities(capabilities);
    return normalized.some(capability => (
        capability === 'vision' ||
        capability === 'multimodal' ||
        capability === 'image' ||
        capability === 'image_input'
    ));
};

/**
 * Derives vision from Ollama's `/api/show` response when the endpoint does not
 * explicitly include `vision` in `capabilities`. Vision architectures expose
 * stable metadata keys such as `gemma3.vision.*` or `qwen35.image_token_id`.
 */
export const inferOllamaCapabilities = (showResponse: unknown): string[] => {
    if (!showResponse || typeof showResponse !== 'object') return [];

    const response = showResponse as {
        capabilities?: unknown;
        model_info?: Record<string, unknown>;
    };
    const capabilities = normalizeModelCapabilities(response.capabilities);
    if (hasVisionCapability(capabilities)) return capabilities;

    const metadataKeys = Object.keys(response.model_info || {});
    const hasVisionMetadata = metadataKeys.some(key => (
        /(?:^|[._-])vision(?:[._-]|$)/i.test(key) ||
        /(?:^|[._-])(?:image|clip|projector|multimodal)(?:[._-]|$)/i.test(key)
    ));

    return hasVisionMetadata ? [...new Set([...capabilities, 'vision'])] : capabilities;
};

/**
 * Normalizes the optional capability fields returned by hosted providers.
 * They use different names (`modalities`, `inputModalities`, etc.), so this
 * translation belongs at the integration boundary rather than in React.
 */
export const inferProviderModelCapabilities = (provider: Provider, rawModel: any): string[] => {
    const explicit = normalizeModelCapabilities([
        rawModel?.capabilities,
        rawModel?.modalities,
        rawModel?.inputModalities,
        rawModel?.supportedInputModalities,
        rawModel?.supportedInputTypes,
        rawModel?.supportedModalities
    ]);
    if (hasVisionCapability(explicit)) return explicit;

    const id = String(rawModel?.id || rawModel?.name || '')
        .replace(/^models\//i, '')
        .toLowerCase();
    const displayName = String(rawModel?.displayName || rawModel?.display_name || '').toLowerCase();
    const identity = `${id} ${displayName}`;
    const isGeminiGenerative = provider === 'gemini' &&
        /^gemini(?:[-_:]|$)/.test(id) &&
        !/(?:embedding|imagen|veo|tts)/.test(id);
    const isKnownVisionFamily = /(?:vision|multimodal|llava|pixtral|molmo|internvl|minicpm[-_.]?v|glm[-_.]?4v|kimi[^\s/:]*[-_.]?vl|qwen(?:3[.]5|[^\s/:]*[-_.]?(?:vl|vllm))|(?:llama[-_.]?4|gemma[-_.]?[34]))/.test(identity);

    return isGeminiGenerative || isKnownVisionFamily
        ? [...new Set([...explicit, 'vision'])]
        : explicit;
};

/**
 * Last-resort naming fallback for providers that omit all capability metadata.
 * It is intentionally small and provider-neutral; Ollama models are enriched
 * from `/api/show` before this fallback is used.
 */
export const isVisionModel = (model: Pick<ModelInfo, 'id' | 'name' | 'provider' | 'capabilities'>): boolean => {
    const capabilities = normalizeModelCapabilities(model.capabilities);
    if (hasVisionCapability(capabilities)) return true;
    // An explicit non-vision capability list is authoritative (for example a
    // Gemma 4 text-only build must not be marked as multimodal by its family).
    if (capabilities.length > 0) return false;

    const identity = `${model.id} ${model.name}`.toLowerCase();
    const isGeminiGenerative = model.provider === 'gemini' &&
        /^gemini(?:[-_:]|$)/.test(String(model.id).toLowerCase()) &&
        !/(?:embedding|imagen|veo|tts)/.test(String(model.id).toLowerCase());
    return isGeminiGenerative || /(?:vision|multimodal|llava|pixtral|molmo|internvl|minicpm[-_.]?v|glm[-_.]?4v|sonnet|kimi[^\s/:]*[-_.]?vl|qwen(?:3[.]5|[^\s/:]*[-_.]?(?:vl|vllm))|(?:llama[-_.]?4|gemma[-_.]?[34]))/.test(identity);
};
