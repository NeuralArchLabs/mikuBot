/**
 * Config Constants
 * Default application configuration
 */

import type { AppConfig } from '../types';

export const APP_VERSION = '2.5.0';

export const DEFAULT_FILES: Record<string, string> = {};

export const DEFAULT_CONFIG: AppConfig = {
    provider: 'groq',
    model: '',
    chatProvider: 'groq',
    chatModel: '',
    agentProvider: 'groq',
    agentModel: '',
    // Native Vision is the default. A provider is stored only when the user
    // explicitly configures a separate Vortex runtime.
    visionProvider: undefined,
    visionModel: '',
    apiKeys: { groq: '', gemini: '', ollama: '', zai: '', codex: '', unsloth: '' },
    ollamaUrl: 'http://localhost:11434',
    unslothUrl: 'http://localhost:8888/v1',
    reasoningEffort: 'auto',
    chatReasoningEffort: 'auto',
    agentReasoningEffort: 'auto',
    temperature: 0.7,
    telegramBotToken: '',

    telegramChatId: '',
    folderNames: { core: '', extra: '', workSpace: '', tools: '', root: '' },
    folderPaths: { core: '', extra: '', workSpace: '', tools: '', root: '' },
    skillsConfig: {},
    disabledSkills: [],
    voskModelPath: '',
    maxOutputTokens: 128000,
    ollamaNumGpu: -1,
    ollamaNumCtx: 0,
    ollamaMainGpu: 0,
    ollamaNumThread: 0,
    language: 'es',
    theme: 'miku',
    chatBackgroundImage: '',
    chatFont: 'Outfit'
};
