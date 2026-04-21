/**
 * Configuration Types
 * Application and provider configuration interfaces
 */

import type { Provider, FileTarget, ApprovalMode, AgentMode } from './common';

/** Provider Configuration */
export interface ProviderConfig {
    name: string;
    icon: string;
    color: string;
    apiKeyRequired: boolean;
    baseUrl: string;
    getApiKeyUrl?: string;
}

/** Model Information */
export interface ModelInfo {
    id: string;
    name: string;
    provider: Provider;
}

/** Application Configuration */
export interface AppConfig {
    isConfigured?: boolean;
    provider: Provider;
    model: string;
    chatProvider?: Provider;
    chatModel?: string;
    agentProvider?: Provider;
    agentModel?: string;
    visionProvider?: Provider;
    visionModel?: string;
    apiKeys: Record<Provider, string>;
    ollamaUrl: string;
    temperature: number;
    telegramBotToken: string;

    telegramChatId: string;
    folderNames?: {
        core: string;
        extra: string;
        workSpace: string;
        tools: string;
        root?: string;
    };
    folderPaths?: {
        core: string;
        extra: string;
        workSpace: string;
        tools: string;
        root?: string;
    };
    skillsConfig?: Record<string, Record<string, any>>;
    disabledSkills?: string[];
    autoLaunch?: boolean;
    minimizeToTray?: boolean;
    voskModelPath?: string;
    maxOutputTokens?: number;
    language?: 'es' | 'en' | 'zh';
    // Personality / Context variables (for Template Hydration)
    userName?: string;
    assistantAlias?: string;
    // Appearance
    theme?: string;
    chatBackgroundImage?: string;
    chatFont?: string;
}

/** Application State */
export interface AppState {
    config: AppConfig;
    files: Record<string, string>;
    additionalFiles: Record<string, string>;
    workSpaceFiles: Record<string, string>;
    toolsFiles: Record<string, string>;
    rootFiles: Record<string, string>;
    selectedLibraryFiles: string[];
    activeTab: 'chat' | 'cortex' | 'commands' | 'settings' | 'skills';
    selectedFile: string;
    isLibraryExpanded: boolean;
    unsavedChanges: Record<string, string>;
    agentMode: AgentMode;
    sessionId: string | null;
    /** When true, tools execute one at a time with render between each. NO parallelism. */
    safeMode: boolean;
    /** 'auto' = smart auto-approval (reads auto, dangerous needs OK). 'manual' = EVERY tool needs user OK. */
    approvalMode: ApprovalMode;
    debugMode: boolean;
    folderPermissions: Record<FileTarget, PermissionStatus>;
    isAboutOpen?: boolean;
}
