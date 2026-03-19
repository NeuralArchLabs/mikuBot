/**
 * IPC Types
 * Interfaces for Electron IPC communication
 */

/** IPC Response */
export interface IpcResponse<T = any> {
    ok: boolean;
    data?: T;
    error?: string;
    status?: number;
}

/** IPC Channel */
export type IpcChannel =
    // Settings
    | 'save-settings' | 'load-settings' | 'set-auto-launch'
    // Sessions
    | 'get-sessions' | 'load-session' | 'save-session' | 'delete-session'
    // Neural Scheduler
    | 'save-scheduler-tasks' | 'load-scheduler-tasks' | 'save-scheduler-logs' | 'load-scheduler-logs'
    // Native FS
    | 'fs-select-folder' | 'fs-open-folder' | 'fs-read-folder' | 'fs-write-file' | 'fs-delete-file' | 'get-default-path' | 'setup-onboarding' | 'fs-check-existing' | 'export-backup' | 'import-backup'
    // Console & Python engine
    | 'run-console' | 'run-search' | 'run-extract'
    // Network proxy
    | 'fetch-proxy' | 'api-stream'
    // Skills
    | 'list-skills' | 'list-blueprints' | 'execute-skill'
    // Advanced Agent Tools
    | 'agent:read-file' | 'agent:get-file-outline' | 'agent:batch-operation' | 'agent:search-files' | 'agent:patch-file' | 'agent:undo-patch' | 'agent:system-metrics'
    // Voice & Vosk Models
    | 'voice:list-models' | 'voice:download-model' | 'voice:delete-model' | 'voice:download-progress' | 'voice:start-recognition' | 'voice:stop-recognition' | 'voice:audio-chunk' | 'voice:engine-ready' | 'voice:recognition-result' | 'voice:recognition-error'
    // Telegram Voice Processing
    | 'telegram:process-voice'
    // searXena Search Engine
    | 'searxena:start' | 'searxena:stop' | 'searxena:update-env' | 'searxena:status'
    // API streaming
    | 'api-stream-chunk'
    // Menu events
    | 'menu-action';
