/**
 * Config Constants
 * Default application configuration
 */

import type { AppConfig } from '../types';

export const APP_VERSION = '2.3.0';

export const DEFAULT_FILES: Record<string, string> = {};

export const DEFAULT_CONFIG: AppConfig = {
    provider: 'groq',
    model: '',
    chatProvider: 'groq',
    chatModel: '',
    agentProvider: 'groq',
    agentModel: '',
    apiKeys: { groq: '', gemini: '', ollama: '', zai: '' },
    ollamaUrl: 'http://localhost:11434',
    temperature: 0.7,
    tavilyApiKey: '',
    braveApiKey: '',
    telegramBotToken: '',
    telegramChatId: '',
    folderNames: { core: '', extra: '', workSpace: '', tools: '', root: '' },
    folderPaths: { core: '', extra: '', workSpace: '', tools: '', root: '' },
    skillsConfig: {},
    disabledSkills: [],
    voskModelPath: '',
    maxOutputTokens: 128000,
    language: 'es'
};
