import type { AppConfig, ModelInfo, Provider, ReasoningEffort, ReasoningEffortOption } from '../../types';

/**
 * Normalized vocabulary shared by adapters. This is not a capability list:
 * the UI must use the model catalog or the provider-specific inference below
 * before offering a value to the user.
 */
export const REASONING_EFFORTS: ReasoningEffort[] = [
    'auto', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'
];

const normalizeEffort = (value: unknown): ReasoningEffort | undefined => {
    if (typeof value !== 'string') return undefined;
    const effort = value.trim().toLowerCase();
    return effort ? effort as ReasoningEffort : undefined;
};

const normalizeCatalogEfforts = (value: unknown): ReasoningEffortOption[] => {
    if (!Array.isArray(value)) return [];
    const result: ReasoningEffortOption[] = [];
    for (const entry of value) {
        const effort = normalizeEffort(
            typeof entry === 'string'
                ? entry
                : entry?.effort ?? entry?.reasoningEffort ?? entry?.reasoning_effort
        );
        // Providers such as Groq call their model default `default`; the
        // selector's Auto option already represents that same behavior.
        if (!effort || effort === 'auto' || effort === 'default' || result.some(item => item.effort === effort)) continue;
        const description = typeof entry === 'object' && typeof entry?.description === 'string'
            ? entry.description
            : undefined;
        result.push({ effort, ...(description ? { description } : {}) });
    }
    return result;
};

/**
 * Resolve the preference for a request. Per-runtime values have precedence.
 * `ollamaThink` is deliberately handled by the Ollama adapter only: it is a
 * provider-specific legacy flag and must not silently disable reasoning for a
 * Groq, Unsloth, Gemini, Z.AI, or Codex request.
 */
export const getConfiguredReasoningEffort = (
    config: AppConfig,
    runtime?: 'chat' | 'agent'
): ReasoningEffort => {
    const runtimeValue = runtime === 'chat'
        ? config.chatReasoningEffort
        : runtime === 'agent'
            ? config.agentReasoningEffort
            : undefined;
    return normalizeEffort(runtimeValue ?? config.reasoningEffort) || 'auto';
};

/**
 * Normalize catalog metadata from the different model-list protocols. The
 * returned list deliberately preserves provider order when it is advertised.
 */
export const inferReasoningEfforts = (
    provider: Provider,
    modelId: string,
    rawModel?: any
): ReasoningEffortOption[] => {
    const catalog = normalizeCatalogEfforts(
        rawModel?.supportedReasoningEfforts
        ?? rawModel?.supported_reasoning_efforts
        ?? rawModel?.supportedReasoningLevels
        ?? rawModel?.supported_reasoning_levels
        ?? rawModel?.reasoningEfforts
        ?? rawModel?.reasoning_efforts
        ?? rawModel?.reasoningLevels
        ?? rawModel?.reasoning_levels
    );
    const id = String(modelId || '').replace(/^models\//i, '').toLowerCase();

    // Codex model/list is authoritative. An empty list means the provider did
    // not advertise selectable levels, so the UI keeps only Auto.
    if (provider === 'codex') return catalog;

    if (catalog.length > 0) return catalog;

    // Gemini maps the common effort vocabulary to thinkingLevel (Gemini 3)
    // or thinkingBudget (Gemini 2.5). Non-thinking Gemini models stay empty.
    if (provider === 'gemini') {
        if (/gemini[-_.]?3(?:[.-]|$)/.test(id)) {
            // Gemini 3.1 Pro and the newest 3.7/3.8 Flash variants reject
            // `minimal`; keep only levels accepted by those model families.
            if (/gemini[-_.]?3[.]1[-_.]?pro/.test(id)
                || /gemini[-_.]?3[.](?:7|8)[-_.]?flash/.test(id)) {
                return effortOptions(['low', 'medium', 'high']);
            }
            if (/gemini[-_.]?3[-_.]?pro/.test(id)) {
                return effortOptions(['low', 'high']);
            }
            if (/gemini[-_.]?3[.]1[-_.]?flash[-_.]?lite[-_.]?image/.test(id)) {
                return effortOptions(['minimal', 'high']);
            }
            return effortOptions(['minimal', 'low', 'medium', 'high']);
        }
        if (/gemini[-_.]?2[.]5[-_.]?(?:flash|flash-lite)/.test(id)) {
            return effortOptions(['none', 'low', 'medium', 'high']);
        }
        if (/gemini[-_.]?2[.]5[-_.]?pro/.test(id)) return effortOptions(['low', 'medium', 'high']);
        return [];
    }

    // Groq's model-specific contract is narrower than its global enum. Keep
    // the picker conservative so a level rejected by one Qwen revision is
    // never advertised for another revision. Unsloth is OpenAI-compatible,
    // so recognize common local reasoning families while leaving arbitrary
    // local models on Auto.
    if (provider === 'groq') {
        if (/gpt[-_.]?oss/.test(id)) return effortOptions(['low', 'medium', 'high']);
        if (/qwen.*3[.]8/.test(id)) return effortOptions(['none', 'low', 'medium', 'high']);
        if (/qwen.*3(?:[.]6)?/.test(id)) return effortOptions(['none']);
        return [];
    }
    if (provider === 'unsloth') {
        if (/(?:qwen(?:[-_.]?3)|gpt[-_.]?oss|deepseek[-_.]?r1|deepseek[-_.]?v3[.]1)/.test(id)) {
            return effortOptions(['none', 'low', 'medium', 'high']);
        }
        return [];
    }

    if (provider === 'zai' && /glm[-_.]?(?:4[.]5|4[.]6|4[.]7|5)/.test(id)) {
        // Z.AI exposes a binary thinking.type switch. Auto delegates to the
        // model default and None is the only explicit override.
        return effortOptions(['none']);
    }

    if (provider === 'ollama') {
        if (/gpt[-_.]?oss/.test(id)) return effortOptions(['low', 'medium', 'high']);
        if (/(?:qwen[-_.]?3|deepseek|r1|reasoning|think)/.test(id)) {
            // Ollama's native `/api/chat` contract exposes a boolean `think`
            // switch for these families. Auto enables the model default and
            // None disables it; graduated levels belong only to GPT-OSS.
            return effortOptions(['none']);
        }
    }

    return [];
};

const effortOptions = (efforts: ReasoningEffort[]): ReasoningEffortOption[] => (
    efforts.map(effort => ({ effort }))
);

export const getModelReasoningEfforts = (
    provider: Provider,
    model: Pick<ModelInfo, 'id' | 'reasoningEfforts' | 'defaultReasoningEffort'> | undefined
): ReasoningEffortOption[] => {
    if (!model) return [];
    return model.reasoningEfforts?.length
        ? model.reasoningEfforts
        : inferReasoningEfforts(provider, model.id);
};

/** Map the normalized selector to Ollama's boolean/level `think` field. */
export const resolveOllamaThink = (
    modelId: string,
    effort: ReasoningEffort
): boolean | ReasoningEffort => {
    const id = modelId.toLowerCase();
    if (/gpt[-_.]?oss/.test(id)) {
        if (effort === 'none') return 'low'; // GPT-OSS cannot disable thinking.
        if (effort === 'auto') return 'medium';
        if (effort === 'minimal' || effort === 'low') return 'low';
        if (effort === 'medium') return 'medium';
        return 'high';
    }
    if (effort === 'none') return false;
    if (effort === 'auto') return true;
    // Native Ollama accepts a boolean for Qwen/DeepSeek-style thinking
    // models. Explicit graduated values are treated as enabled so a stale
    // setting cannot send an invalid string to those models.
    return true;
};

/** Build Gemini's native thinkingConfig without mixing it with OpenAI fields. */
export const resolveGeminiThinkingConfig = (
    modelId: string,
    effort: ReasoningEffort
): Record<string, unknown> | undefined => {
    const id = modelId.toLowerCase();
    const isGemini3 = /gemini[-_.]?3(?:[.-]|$)/.test(id);
    const isGemini25Flash = /gemini[-_.]?2[.]5[-_.]?(?:flash|flash-lite)/.test(id);
    const isGemini25Pro = /gemini[-_.]?2[.]5[-_.]?pro/.test(id);

    if (!isGemini3 && !isGemini25Flash && !isGemini25Pro) return undefined;
    if (effort === 'auto') return { includeThoughts: true };

    if (isGemini3) {
        const isGemini31Pro = /gemini[-_.]?3[.]1[-_.]?pro/.test(id);
        const isGemini3Pro = /gemini[-_.]?3[-_.]?pro/.test(id) && !isGemini31Pro;
        const isGemini31FlashLiteImage = /gemini[-_.]?3[.]1[-_.]?flash[-_.]?lite[-_.]?image/.test(id);
        const thinkingLevel = isGemini31FlashLiteImage
            ? effort === 'high' ? 'high' : 'minimal'
            : isGemini3Pro
                ? effort === 'low' ? 'low' : 'high'
                : effort === 'none' || effort === 'minimal' && isGemini31Pro
                    ? 'low'
                    : ['xhigh', 'max', 'ultra'].includes(effort)
                        ? 'high'
                        : effort;
        return { thinkingLevel, includeThoughts: true };
    }

    const thinkingBudget = effort === 'none'
        ? 0
        : effort === 'minimal' || effort === 'low'
            ? 1024
            : effort === 'medium'
                ? 8192
                : 24576;
    // Gemini 2.5 Pro cannot disable thinking; retaining a small budget is the
    // safest graceful interpretation of a legacy `none` preference.
    return { thinkingBudget: isGemini25Pro && thinkingBudget === 0 ? 1024 : thinkingBudget, includeThoughts: true };
};

export const isReasoningParameterError = (error: unknown): boolean => {
    const message = String((error as any)?.message || error || '').toLowerCase();
    return /reasoning[_ -]?effort|thinking[_ -]?(?:config|budget|level)|unknown field|unrecognized field|unsupported.*(?:reasoning|thinking)|(?:reasoning|thinking).*(?:unsupported|not supported|invalid)/i.test(message);
};
