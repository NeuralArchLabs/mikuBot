/**
 * Common Types
 * Basic types used throughout the application
 */

/** AI Model Provider */
export type Provider = 'groq' | 'gemini' | 'ollama' | 'zai';

/** Operational Mode */
export type AgentMode = 'chat' | 'agent';

/** File System Target */
export type FileTarget = 'core' | 'extra' | 'workSpace' | 'tools' | 'root';

/** Approval Mode for tools */
export type ApprovalMode = 'auto' | 'manual';

/** Permission Status for file operations */
export type PermissionStatus = 'granted' | 'prompt' | 'denied';
