/**
 * Provider Constants
 * AI model provider configurations
 */

import type { Provider, ProviderConfig } from '../types';

export const PROVIDERS: Record<Provider, ProviderConfig> = {
    groq: {
        name: 'Groq',
        icon: 'bolt',
        color: 'from-orange-500 to-amber-500',
        apiKeyRequired: true,
        baseUrl: 'https://api.groq.com/openai/v1',
        getApiKeyUrl: 'https://console.groq.com/keys'
    },
    gemini: {
        name: 'Google',
        icon: 'gem',
        color: 'from-blue-500 to-cyan-500',
        apiKeyRequired: true,
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        getApiKeyUrl: 'https://aistudio.google.com/apikey'
    },
    ollama: {
        name: 'Ollama (Local)',
        icon: 'server',
        color: 'from-emerald-500 to-green-500',
        apiKeyRequired: false,
        baseUrl: 'http://localhost:11434'
    },
    zai: {
        name: 'Z.AI (BigModel)',
        icon: 'bolt',
        color: 'from-purple-500 to-indigo-500',
        apiKeyRequired: true,
        baseUrl: 'https://api.z.ai/api/coding/paas/v4',
        getApiKeyUrl: 'https://z.ai/dashboard/apikeys'
    }
};
