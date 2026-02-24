export type Provider = 'groq' | 'gemini' | 'ollama';
export type AgentMode = 'chat' | 'agent';
export type FileTarget = 'core' | 'extra' | 'workSpace' | 'tools';

export interface ProviderConfig {
    name: string;
    icon: string;
    color: string;
    apiKeyRequired: boolean;
    baseUrl: string;
    getApiKeyUrl?: string;
}

export interface ModelInfo {
    id: string;
    name: string;
    provider: Provider;
}

export interface MessageBlock {
    type: 'text' | 'tool_call' | 'answer' | 'thought';
    content: string;
    toolCall?: ToolCall;
    isCollapsed?: boolean;
    result?: ToolResult;
}

export interface Attachment {
    id: string;
    name: string;
    type: string;
    data: string; // Base64 encoded data
}

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'tool' | 'system';
    text: string;
    timestamp: number; // Stored as timestamp for easier JSON serialization
    isStreaming?: boolean;
    blocks?: MessageBlock[];
    toolCalls?: ToolCall[];
    toolCallId?: string;
    toolName?: string;
    rawHistory?: any[];
    source?: 'telegram' | 'ui';
    excludeFromContext?: boolean;
    provider?: string;
    model?: string;
    attachments?: Attachment[];
    isScheduler?: boolean;
    isScheduledResponse?: boolean;
    isInitiallyCollapsed?: boolean;
}

export interface SessionMetadata {
    id: string;
    title: string;
    lastModified: number;
    messageCount: number;
}

export interface Session {
    id: string;
    title: string;
    messages: Message[];
    timestamp: number;
    agentMode?: AgentMode;
    safeMode?: boolean;
    approvalMode?: ApprovalMode;
    debugMode?: boolean;
    draft?: string;
}

export interface AppConfig {
    isConfigured?: boolean;
    provider: Provider;
    model: string;
    chatProvider?: Provider;
    chatModel?: string;
    agentProvider?: Provider;
    agentModel?: string;
    apiKeys: Record<Provider, string>;
    ollamaUrl: string;
    temperature: number;
    tavilyApiKey: string;
    braveApiKey: string;
    telegramBotToken: string;
    telegramChatId: string;
    folderNames?: {
        core: string;
        extra: string;
        workSpace: string;
        tools: string;
    };
    folderPaths?: {
        core: string;
        extra: string;
        workSpace: string;
        tools: string;
    };
    skillsConfig?: Record<string, Record<string, any>>;
    disabledSkills?: string[];
}

export type ApprovalMode = 'auto' | 'manual';
export type PermissionStatus = 'granted' | 'prompt' | 'denied';

export interface AppState {
    config: AppConfig;
    files: Record<string, string>;
    additionalFiles: Record<string, string>;
    workSpaceFiles: Record<string, string>;
    toolsFiles: Record<string, string>;
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
}

export interface ToolParameter {
    type: string;
    description: string;
    enum?: string[];
    items?: ToolParameter; // For recursive array definitions
}

export interface ToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: {
            type: 'object';
            properties: Record<string, ToolParameter>;
            required: string[];
        };
    };
}

export interface ToolCall {
    id?: string;
    function: {
        name: string;
        arguments: Record<string, any>;
    };
}

export interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
}

export type AgentPhase = 'idle' | 'thinking' | 'streaming' | 'tool_calling' | 'tool_executing' | 'waiting_approval' | 'error' | 'aborted';

export interface AgentLogEntry {
    timestamp: number;
    type: 'info' | 'tool_call' | 'tool_result' | 'error' | 'warn';
    message: string;
    details?: any;
}

export interface AgentStatus {
    phase: AgentPhase;
    iteration: number;
    retries: number;
    maxRetries: number;
    elapsedMs: number;
    currentTool: string | null;
    log: AgentLogEntry[];
    streamedText: string;
    errorCount: number;
    rawMessages?: any[];
    currentSystemPrompt?: string;
    lastExecutionFeedback?: string;
    isInstructionMode?: boolean;
}

export interface PendingToolApproval {
    toolCall: ToolCall;
    resolve: (approved: boolean) => void;
}

// ── Neural Scheduler Types ───────────────────────────────────────────

export type TaskScheduleType = 'interval' | 'cron' | 'once';
export type TaskChannel = 'telegram' | 'ui' | 'both';
export type TaskMode = 'chat' | 'agent';

export interface ScheduledTask {
    id: string;
    name: string;
    prompt: string;
    scheduleType: TaskScheduleType;
    /** For 'interval': minutes between executions. For 'cron': cron expression. For 'once': ISO timestamp. */
    schedule: string;
    channel: TaskChannel;
    mode: TaskMode;
    enabled: boolean;
    /** Max executions per day (0 = unlimited) */
    maxExecutionsPerDay: number;
    /** Timestamps */
    createdAt: number;
    lastRunAt: number | null;
    nextRunAt: number | null;
    /** Execution counters */
    totalExecutions: number;
    executionsToday: number;
    lastExecutionDay: string | null; // YYYY-MM-DD
}

export interface TaskExecutionLog {
    taskId: string;
    taskName: string;
    timestamp: number;
    status: 'success' | 'error' | 'skipped';
    response?: string;
    error?: string;
    durationMs?: number;
}

export interface FileSystemHandle {
    kind: 'file' | 'directory';
    name: string;
}

export interface FileSystemFileHandle extends FileSystemHandle {
    kind: 'file';
    getFile(): Promise<File>;
    createWritable(): Promise<FileSystemWritableFileStream>;
}

export interface FileSystemDirectoryHandle extends FileSystemHandle {
    kind: 'directory';
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
    values(): AsyncIterableIterator<FileSystemHandle>;
}

export interface FileSystemWritableFileStream extends WritableStream {
    write(data: string | Buffer | Blob): Promise<void>;
    close(): Promise<void>;
}
