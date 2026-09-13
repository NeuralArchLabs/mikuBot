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
/**
 * Normalized reasoning effort values used by the UI. Providers may expose
 * additional values; those are kept as strings when returned by a catalog.
 */
export type ReasoningEffort =
    | 'auto'
    | 'none'
    | 'minimal'
    | 'low'
    | 'medium'
    | 'high'
    | 'xhigh'
    | 'max'
    | 'ultra'
    | (string & {});

export interface ReasoningEffortOption {
    effort: ReasoningEffort;
    description?: string;
}

export interface ModelInfo {
    id: string;
    name: string;
    provider: Provider;
    /** Provider-advertised capabilities (for example Ollama's `vision`). */
    capabilities?: string[];
    contextLength?: number;
    /** Reasoning levels advertised by the provider's model catalog. */
    reasoningEfforts?: ReasoningEffortOption[];
    defaultReasoningEffort?: ReasoningEffort;
}

/** Application Configuration */
export interface AppConfig {
    /** Per-turn execution identity; never persisted or derived from tool arguments. */
    executionContext?: { projectId: string | null; sessionId: string | null };
    isConfigured?: boolean;
    provider: Provider;
    model: string;
    chatProvider?: Provider;
    chatModel?: string;
    agentProvider?: Provider;
    agentModel?: string;
    /**
     * Runtime selected by the active Chat/Agent mode for long-running skills.
     * It remains stable even if the conversational request itself is retried
     * through the master fallback.
     */
    activeModeProvider?: Provider;
    activeModeModel?: string;
    visionProvider?: Provider;
    visionModel?: string;
    apiKeys: Record<Provider, string>;
    ollamaUrl: string;
    unslothUrl?: string;
    ollamaNumGpu?: number;
    ollamaNumCtx?: number;
    ollamaMainGpu?: number;
    ollamaNumThread?: number;
    ollamaThink?: boolean;
    ollamaZeroOverhead?: boolean;
    /** Master fallback reasoning preference. `auto` delegates to the model. */
    reasoningEffort?: ReasoningEffort;
    /** Optional per-runtime overrides; old configs continue using the master value. */
    chatReasoningEffort?: ReasoningEffort;
    agentReasoningEffort?: ReasoningEffort;
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
    voice?: string | null;
    speed?: number;
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
    activeTab: 'chat' | 'editor' | 'cortex' | 'commands' | 'settings' | 'skills';
    selectedFile: string;
    isLibraryExpanded: boolean;
    unsavedChanges: Record<string, string>;
    agentMode: AgentMode;
    sessionId: string | null;
    /** Current navigator mode for the sessions/projects area. */
    sessionViewMode: 'sessions' | 'projects';
    /** Project selected in the project navigator, if any. */
    activeProjectId: string | null;
    /** Legacy persisted key: when true, tools execute sequentially with render between each. */
    safeMode: boolean;
    /** 'auto' = smart auto-approval (reads auto, dangerous needs OK). 'manual' = EVERY tool needs user OK. */
    approvalMode: ApprovalMode;
    debugMode: boolean;
    folderPermissions: Record<FileTarget, PermissionStatus>;
    isAboutOpen?: boolean;
}
