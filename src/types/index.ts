export type Provider = 'groq' | 'gemini' | 'ollama';
export type AgentMode = 'chat' | 'agent';
export type FileTarget = 'core' | 'extra' | 'sandbox';

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
    type: 'text' | 'tool_call';
    content: string;
    toolCall?: ToolCall;
    isCollapsed?: boolean;
    result?: ToolResult;
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
}

export interface AppConfig {
    provider: Provider;
    model: string;
    apiKeys: Record<Provider, string>;
    ollamaUrl: string;
    temperature: number;
    tavilyApiKey: string;
    braveApiKey: string;
}

export interface AppState {
    config: AppConfig;
    files: Record<string, string>;
    additionalFiles: Record<string, string>;
    sandboxFiles: Record<string, string>;
    selectedLibraryFiles: string[];
    activeTab: 'chat' | 'cortex' | 'settings';
    selectedFile: string;
    isLibraryExpanded: boolean;
    unsavedChanges: Record<string, string>;
    agentMode: AgentMode;
    sessionId: string | null;
}

export interface ToolParameter {
    type: string;
    description: string;
    enum?: string[];
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
}

export interface PendingToolApproval {
    toolCall: ToolCall;
    resolve: (approved: boolean) => void;
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
