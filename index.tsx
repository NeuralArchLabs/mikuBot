
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

// --- Types ---

type Provider = 'groq' | 'gemini' | 'ollama';

interface ProviderConfig {
  name: string;
  icon: string;
  color: string;
  apiKeyRequired: boolean;
  baseUrl: string;
  getApiKeyUrl?: string;
}

interface ModelInfo {
  id: string;
  name: string;
  provider: Provider;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  text: string;
  timestamp: Date;
  isStreaming?: boolean;
  toolCalls?: ToolCall[];
  toolCallId?: string; // For tool result messages
  toolName?: string;   // For UI display
}

interface AppConfig {
  provider: Provider;
  model: string;
  apiKeys: Record<Provider, string>;
  ollamaUrl: string;
  temperature: number;
}

interface AppState {
  config: AppConfig;
  files: Record<string, string>;
  additionalFiles: Record<string, string>;
  selectedLibraryFiles: string[];
  activeTab: 'chat' | 'cortex' | 'settings';
  selectedFile: string;
  isLibraryExpanded: boolean; // New UI state
  unsavedChanges: Record<string, string>; // Filename -> New Content
}

// --- Tool Calling Types ---

interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
}

interface ToolDefinition {
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

interface ToolCall {
  id?: string;
  function: {
    name: string;
    arguments: Record<string, any>;
  };
}

interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

interface PendingFileAction {
  filename: string;
  suggestedSource: string;
  resolve: (decision: { approved: boolean; targetSource: 'core' | 'extra' } | null) => void;
}

// --- File System & DB types ---

// Minimal type definitions for File System Access API
interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
}
interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}
interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: 'directory';
  values(): AsyncIterable<FileSystemHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
}
interface FileSystemWritableFileStream extends WritableStream {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}
declare global {
  interface Window {
    showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
  }
}

// IndexedDB Helper for Persisting Handles
const DB_NAME = 'mikuBot_DB';
const STORE_NAME = 'handles';

const db = {
  init: () => new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }),
  set: async (key: string, val: any) => {
    const database = await db.init();
    return new Promise<void>((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(val, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  get: async (key: string) => {
    const database = await db.init();
    return new Promise<any>((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
};

// --- Constants ---

const PROVIDERS: Record<Provider, ProviderConfig> = {
  groq: {
    name: 'Groq',
    icon: 'bolt',
    color: 'from-orange-500 to-amber-500',
    apiKeyRequired: true,
    baseUrl: 'https://api.groq.com/openai/v1',
    getApiKeyUrl: 'https://console.groq.com/keys'
  },
  gemini: {
    name: 'Google Gemini',
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
  }
};

// Empty defaults - files MUST be loaded from disk via Core Folder selection
const DEFAULT_FILES: Record<string, string> = {};

const DEFAULT_CONFIG: AppConfig = {
  provider: 'groq',
  model: '',
  apiKeys: { groq: '', gemini: '', ollama: '' },
  ollamaUrl: 'http://localhost:11434',
  temperature: 0.7
};

// --- Tool Definitions (Agent Capabilities) ---

const AGENT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file from the core memory folder or library folder. Use this to check current file state before making changes.',
      parameters: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: 'The filename to read (e.g. SOUL.md, USER.md, ACTIVE_CONTEXT.md)' },
          source: { type: 'string', description: 'Which folder to read from', enum: ['core', 'library'] }
        },
        required: ['filename', 'source']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_file',
      description: 'Write or update a file in the core memory folder or library folder. Use this to persist new information, update your context, or modify your memory files. Always read the file first to avoid overwriting important content.',
      parameters: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: 'The file path to write (e.g. project/index.html). Directories will be created if they do not exist.' },
          content: { type: 'string', description: 'The full new content for the file' },
          source: { type: 'string', description: 'Which folder to write to', enum: ['core', 'library'] }
        },
        required: ['filename', 'content', 'source']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List all files available in the core memory folder or library folder. Use this to discover what files exist.',
      parameters: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'Which folder to list', enum: ['core', 'library'] }
        },
        required: ['source']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Search for a text pattern across all files in a folder. Returns matching filenames and the lines containing the pattern.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The text pattern to search for' },
          source: { type: 'string', description: 'Which folder to search', enum: ['core', 'library'] }
        },
        required: ['query', 'source']
      }
    }
  }
];

const PROTECTED_CORE_FILES = ['SOUL.md', 'USER.md', 'TOOLS.md', 'PROTOCOL.md'];

// --- File Location Modal ---

const FileLocationModal = ({
  pending,
  corePathName,
  extraPathName,
}: {
  pending: PendingFileAction;
  corePathName: string;
  extraPathName: string;
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-600 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Icon name="folder-plus" className="text-white text-lg" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-lg">File Creation Request</h3>
            <p className="text-slate-400 text-xs">The agent wants to create a file</p>
          </div>
        </div>

        <div className="bg-slate-900/60 rounded-lg p-3 mb-5 border border-slate-700/50">
          <p className="text-amber-400 font-mono text-sm break-all">
            <Icon name="file" className="mr-2" />{pending.filename}
          </p>
        </div>

        <p className="text-slate-300 text-sm mb-4">Choose where to save this file:</p>

        <div className="space-y-2 mb-5">
          {corePathName && (
            <button
              onClick={() => pending.resolve({ approved: true, targetSource: 'core' })}
              className="w-full flex items-center gap-3 p-3 bg-slate-700/50 hover:bg-blue-600/30 border border-slate-600 hover:border-blue-500/50 rounded-xl transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/40 transition-colors">
                <Icon name="brain" className="text-blue-400" />
              </div>
              <div className="text-left">
                <p className="text-white text-sm font-medium">Core Memory</p>
                <p className="text-slate-400 text-xs">{corePathName}</p>
              </div>
            </button>
          )}

          {extraPathName && (
            <button
              onClick={() => pending.resolve({ approved: true, targetSource: 'extra' })}
              className="w-full flex items-center gap-3 p-3 bg-slate-700/50 hover:bg-emerald-600/30 border border-slate-600 hover:border-emerald-500/50 rounded-xl transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/40 transition-colors">
                <Icon name="folder-open" className="text-emerald-400" />
              </div>
              <div className="text-left">
                <p className="text-white text-sm font-medium">Library / Workspace</p>
                <p className="text-slate-400 text-xs">{extraPathName}</p>
              </div>
            </button>
          )}

          {!corePathName && !extraPathName && (
            <p className="text-red-400 text-sm text-center py-3">
              <Icon name="exclamation-triangle" className="mr-2" />
              No folders selected. Go to Settings to select a Core or Library folder first.
            </p>
          )}
        </div>

        <button
          onClick={() => pending.resolve(null)}
          className="w-full py-2 text-slate-400 hover:text-red-400 text-sm transition-colors"
        >
          <Icon name="times" className="mr-1" /> Cancel
        </button>
      </div>
    </div>
  );
};

// --- Components ---

const Icon = ({ name, className = "" }: { name: string; className?: string }) => (
  <i className={`fas fa-${name} ${className}`} aria-hidden="true" />
);

const MarkdownRenderer = ({ content }: { content: string }) => (
  <div className="markdown-body whitespace-pre-wrap leading-relaxed text-sm font-mono">{content}</div>
);

// --- Settings Panel ---

const SettingsPanel = ({
  config,
  updateConfig,
  models,
  loadingModels,
  connectionStatus,
  onTestConnection,
  onCoreSelect,
  onExtraSelect,
  corePathName,
  extraPathName,
  syncing
}: {
  config: AppConfig;
  updateConfig: (key: string, value: any) => void;
  models: ModelInfo[];
  loadingModels: boolean;
  connectionStatus: 'idle' | 'testing' | 'connected' | 'error';
  onTestConnection: () => void;
  onCoreSelect: () => void;
  onExtraSelect: () => void;
  corePathName: string;
  extraPathName: string;
  syncing: boolean;
}) => {
  const [localApiKey, setLocalApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    setLocalApiKey(config.apiKeys[config.provider] || '');
  }, [config.provider, config.apiKeys]);

  const handleSaveKey = () => {
    updateConfig('apiKeys', { ...config.apiKeys, [config.provider]: localApiKey });
  };

  const currentProvider = PROVIDERS[config.provider];

  return (
    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-900">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">⚙️ Configuration</h2>
          <p className="text-slate-400 text-sm">Configure AI providers and knowledge context.</p>
        </div>

        {/* Context Management Section */}
        <div className="space-y-4">
          <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">Knowledge Base</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Core Folder */}
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Icon name="hdd" className="text-lg" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-200">Core Identity</div>
                  <div className="text-[10px] text-slate-500">SOUL.md, USER.md, TASKS.md</div>
                </div>
              </div>
              <div className="text-xs font-mono text-slate-400 mb-3 truncate bg-slate-900/50 p-2 rounded border border-slate-700/50">
                {corePathName || "Using internal defaults"}
              </div>
              <button
                onClick={onCoreSelect}
                disabled={syncing}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-2"
              >
                {syncing ? <Icon name="sync fa-spin" /> : <Icon name="folder-open" />}
                Select Core Folder
              </button>
            </div>

            {/* Additional Context */}
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center">
                  <Icon name="book" className="text-lg" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-200">Library</div>
                  <div className="text-[10px] text-slate-500">Additional .md context</div>
                </div>
              </div>
              <div className="text-xs font-mono text-slate-400 mb-3 truncate bg-slate-900/50 p-2 rounded border border-slate-700/50">
                {extraPathName || "No extra context linked"}
              </div>
              <button
                onClick={onExtraSelect}
                disabled={syncing}
                className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs font-medium transition-colors flex items-center justify-center gap-2"
              >
                {syncing ? <Icon name="sync fa-spin" /> : <Icon name="folder-plus" />}
                Select Library Folder
              </button>
            </div>
          </div>
        </div>

        <div className="h-px bg-slate-800" />

        {/* Provider Selection */}
        <div className="space-y-4">
          <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">Select Provider</label>
          <div className="grid grid-cols-3 gap-4">
            {(Object.keys(PROVIDERS) as Provider[]).map(providerId => {
              const provider = PROVIDERS[providerId];
              const isSelected = config.provider === providerId;
              return (
                <button
                  key={providerId}
                  onClick={() => updateConfig('provider', providerId)}
                  className={`relative p-4 rounded-xl border-2 transition-all duration-300 ${isSelected
                    ? 'border-blue-500 bg-slate-800'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                    }`}
                >
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${provider.color} flex items-center justify-center mb-3 mx-auto`}>
                    <Icon name={provider.icon} className="text-white text-xl" />
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-white text-sm">{provider.name}</div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      {provider.apiKeyRequired ? 'API Key Required' : 'Local Server'}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-3 h-3 bg-blue-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* API Key / URL Configuration */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">
              {config.provider === 'ollama' ? 'Server URL' : 'API Key'}
            </label>
            <div className="flex items-center gap-2">
              {connectionStatus === 'connected' && (
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <Icon name="check-circle" /> Connected
                </span>
              )}
              {connectionStatus === 'error' && (
                <span className="text-xs text-red-400 flex items-center gap-1">
                  <Icon name="times-circle" /> Failed
                </span>
              )}
            </div>
          </div>

          {config.provider === 'ollama' ? (
            <input
              type="text"
              value={config.ollamaUrl}
              onChange={(e) => updateConfig('ollamaUrl', e.target.value)}
              placeholder="http://localhost:11434"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-sm font-mono text-slate-200 placeholder-slate-500 focus:border-blue-500 outline-none transition-colors"
            />
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); handleSaveKey(); }}
              className="relative"
            >
              <input
                type={showApiKey ? 'text' : 'password'}
                value={localApiKey}
                onChange={(e) => setLocalApiKey(e.target.value)}
                placeholder={`Enter your ${currentProvider.name} API Key`}
                autoComplete="new-password"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 pr-20 text-sm font-mono text-slate-200 placeholder-slate-500 focus:border-blue-500 outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-12 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <Icon name={showApiKey ? 'eye-slash' : 'eye'} />
              </button>
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors"
              >
                Save
              </button>
            </form>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={onTestConnection}
              disabled={loadingModels}
              className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50"
            >
              <Icon name={loadingModels ? 'spinner fa-spin' : 'plug'} />
              {loadingModels ? 'Connecting...' : 'Test Connection & Load Models'}
            </button>

            {currentProvider.getApiKeyUrl && (
              <a
                href={currentProvider.getApiKeyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-slate-500 hover:text-slate-300 flex items-center gap-1"
              >
                Get API Key <Icon name="external-link-alt" className="text-xs" />
              </a>
            )}
          </div>
        </div>

        {/* Model Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">Select Model</label>
            <span className="text-xs text-slate-500">{models.length} models available</span>
          </div>

          {models.length === 0 ? (
            <div className="bg-slate-800/30 rounded-xl p-8 border border-dashed border-slate-700 text-center">
              <Icon name="cube" className="text-4xl text-slate-600 mb-3" />
              <p className="text-slate-500 text-sm">No models loaded. Click "Test Connection" above to fetch available models.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto custom-scrollbar">
              {models.map(model => (
                <button
                  key={model.id}
                  onClick={() => updateConfig('model', model.id)}
                  className={`text-left p-3 rounded-lg border transition-all ${config.model === model.id
                    ? 'border-blue-500 bg-blue-900/20'
                    : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-slate-200">{model.name || model.id}</span>
                    {config.model === model.id && <Icon name="check" className="text-blue-400" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Temperature */}
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">Temperature</label>
            <span className="text-sm font-mono text-blue-400">{config.temperature.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={config.temperature}
            onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>Precise</span>
            <span>Balanced</span>
            <span>Creative</span>
          </div>
        </div>

        {/* Reset Button */}
        <button
          onClick={() => {
            localStorage.removeItem('mikuBot_config');
            window.location.reload();
          }}
          className="w-full py-3 border border-red-900/50 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
        >
          <Icon name="trash-alt" />
          Reset All Settings
        </button>
      </div>
    </div>
  );
};

// --- Sidebar ---

const Sidebar = ({
  state,
  setState,
  onClear,
  models,
  connectionStatus
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  onClear: () => void;
  models: ModelInfo[];
  connectionStatus: 'idle' | 'testing' | 'connected' | 'error';
}) => {
  const currentProvider = PROVIDERS[state.config.provider];
  const currentModel = models.find(m => m.id === state.config.model);

  return (
    <div className="w-72 flex-shrink-0 flex flex-col h-full glass-panel border-r border-slate-700">
      <div className="p-6 border-b border-slate-700 bg-slate-900/50">
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
          mikuBot
        </h1>
        <p className="text-[10px] text-slate-400 font-mono mt-1">OPERATIONAL LOOP: ACTIVE</p>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Navigation */}
        <div className="p-4 space-y-2">
          {(['chat', 'cortex', 'settings'] as const).map(tab => {
            const icons = { chat: 'terminal', cortex: 'brain', settings: 'cog' };
            const labels = { chat: 'Terminal (Chat)', cortex: 'Cortex (Memory)', settings: 'Settings' };
            const colors = { chat: 'blue', cortex: 'purple', settings: 'amber' };
            return (
              <button
                key={tab}
                onClick={() => setState(prev => ({ ...prev, activeTab: tab }))}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${state.activeTab === tab
                  ? `bg-${colors[tab]}-600/20 border border-${colors[tab]}-500/50 text-${colors[tab]}-100`
                  : 'text-slate-400 hover:bg-slate-800'
                  }`}
              >
                <Icon name={icons[tab]} />
                <span className="font-medium">{labels[tab]}</span>
              </button>
            );
          })}
        </div>

        <div className="h-px bg-slate-700 mx-4 my-2" />

        {/* Current Provider/Model Status */}
        <div className="p-4 space-y-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Config</label>

          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-6 h-6 rounded bg-gradient-to-br ${currentProvider.color} flex items-center justify-center`}>
                <Icon name={currentProvider.icon} className="text-white text-xs" />
              </div>
              <span className="text-sm font-medium text-slate-200">{currentProvider.name}</span>
              {connectionStatus === 'connected' && (
                <span className="ml-auto w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              )}
            </div>
            <div className="text-[10px] text-slate-500 font-mono truncate">
              {currentModel?.name || currentModel?.id || 'No model selected'}
            </div>
          </div>

          <button
            onClick={() => setState(prev => ({ ...prev, activeTab: 'settings' }))}
            className="w-full py-2 text-xs text-slate-400 hover:text-slate-200 flex items-center justify-center gap-2"
          >
            <Icon name="exchange-alt" /> Switch Provider
          </button>
        </div>

        {/* Library Files Selection - Always Visible for Management */}
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Library Context</label>
            <button
              onClick={() => setState(prev => ({ ...prev, isLibraryExpanded: true }))}
              className="text-[10px] text-pink-400 hover:text-pink-300 flex items-center gap-1 transition-colors"
            >
              <Icon name="expand-alt" /> Manage
            </button>
          </div>

          {Object.keys(state.additionalFiles || {}).length === 0 ? (
            <div className="text-center py-4 px-2 border border-dashed border-slate-700 rounded bg-slate-800/20">
              <p className="text-[10px] text-slate-500 mb-2">No context loaded</p>
              <div
                className="text-[10px] text-pink-400 hover:text-pink-300 cursor-pointer flex items-center justify-center gap-1"
                onClick={() => setState(prev => ({ ...prev, activeTab: 'settings' }))}
              >
                <Icon name="folder-plus" /> Link Folder
              </div>
            </div>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
              {Object.keys(state.additionalFiles || {}).map(filename => {
                const isSelected = (state.selectedLibraryFiles || []).includes(filename);
                return (
                  <button
                    key={filename}
                    onClick={() => {
                      setState(prev => {
                        const current = prev.selectedLibraryFiles || [];
                        const updated = isSelected
                          ? current.filter(f => f !== filename)
                          : [...current, filename];
                        return { ...prev, selectedLibraryFiles: updated };
                      });
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono truncate flex items-center gap-2 transition-colors ${isSelected
                      ? 'bg-pink-900/30 text-pink-300 border border-pink-700/50'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                      }`}
                  >
                    <Icon name={isSelected ? 'check-square' : 'square'} className="flex-shrink-0" />
                    <span className="truncate">{filename}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-slate-700 bg-slate-900/50">
        <button
          onClick={onClear}
          className="w-full py-2 px-4 border border-red-900/50 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors flex items-center justify-center gap-2 text-xs font-medium"
        >
          <Icon name="trash-alt" />
          Clear Chat
        </button>
      </div>
    </div>
  );
};

// --- File Editor (Cortex) ---

const FileEditor = ({
  files,
  selectedFile,
  setSelectedFile,
  onSave,
  unsavedChanges,
  setUnsavedChanges,
  onAddFile
}: {
  files: Record<string, string>;
  selectedFile: string;
  setSelectedFile: (s: string) => void;
  onSave: (name: string, content: string) => Promise<boolean>;
  unsavedChanges: Record<string, string>;
  setUnsavedChanges: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onAddFile: () => void;
}) => {
  const content = unsavedChanges[selectedFile] ?? files[selectedFile] ?? '';
  const isDirty = selectedFile in unsavedChanges;

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-slate-900 text-slate-200">
      {/* Sidebar List */}
      <div className="w-56 bg-slate-900/50 border-r border-slate-700 flex flex-col">
        <div className="p-3 flex items-center justify-between border-b border-slate-800">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Core Memory</span>
          <button onClick={onAddFile} className="text-slate-500 hover:text-white transition-colors">
            <Icon name="plus" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {Object.keys(files).sort().map(filename => (
            <button
              key={filename}
              onClick={() => setSelectedFile(filename)}
              className={`w-full text-left px-4 py-3 text-xs font-mono border-l-2 transition-all flex items-center justify-between group ${selectedFile === filename
                ? 'bg-indigo-900/20 border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                }`}
            >
              <span className="truncate">{filename}</span>
              {filename in unsavedChanges && (
                <span className="w-2 h-2 rounded-full bg-amber-500" title="Unsaved changes" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedFile ? (
          <>
            <div className="h-12 bg-slate-800/30 border-b border-slate-700 flex items-center justify-between px-4">
              <div className="flex items-center gap-2 text-sm font-mono text-slate-300">
                <Icon name="file-alt" className="text-slate-500" />
                {selectedFile}
                {isDirty && <span className="text-[10px] text-amber-500 font-bold bg-amber-900/20 px-1.5 rounded">UNSAVED</span>}
              </div>

              <div className="flex items-center gap-2">
                {isDirty && (
                  <>
                    <button
                      onClick={() => {
                        const next = { ...unsavedChanges };
                        delete next[selectedFile];
                        setUnsavedChanges(next);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                    >
                      Discard
                    </button>
                    <button
                      onClick={() => onSave(selectedFile, content)}
                      className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors flex items-center gap-1"
                    >
                      <Icon name="save" /> Save
                    </button>
                  </>
                )}
              </div>
            </div>
            <textarea
              value={content}
              onChange={(e) => setUnsavedChanges(prev => ({ ...prev, [selectedFile]: e.target.value }))}
              className="flex-1 w-full bg-slate-900 p-4 font-mono text-sm leading-relaxed outline-none resize-none text-slate-300 placeholder-slate-600 custom-scrollbar"
              spellCheck={false}
              placeholder="Empty file..."
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-600 flex-col gap-2">
            <Icon name="arrow-left" className="text-2xl" />
            <p className="text-sm">Select a file to edit</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Library Manager Overlay ---
const LibraryManager = ({
  isOpen,
  onClose,
  files,
  selectedFiles,
  onToggleSelect,
  onSave,
  onAdd
}: {
  isOpen: boolean;
  onClose: () => void;
  files: Record<string, string>;
  selectedFiles: string[];
  onToggleSelect: (name: string) => void;
  onSave: (name: string, content: string) => Promise<boolean>;
  onAdd: () => void;
}) => {
  const [viewFile, setViewFile] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-8 transition-opacity duration-300">
      <div className="bg-slate-950 border border-slate-700 w-full max-w-5xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-pink-500/10 text-pink-400 flex items-center justify-center">
              <Icon name="book" className="text-xl" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Library Manager</h2>
              <p className="text-xs text-slate-500">Inject additional context into your session</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onAdd} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors text-xs font-medium flex items-center gap-2">
              <Icon name="plus" /> New Document
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center transition-colors">
              <Icon name="times" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* File List */}
          <div className="w-1/3 border-r border-slate-800 bg-slate-900/50 flex flex-col">
            <div className="p-3 bg-slate-900/80 border-b border-slate-800">
              <input type="text" placeholder="Search files..." className="w-full bg-slate-800 border-none rounded px-3 py-1.5 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-pink-500/50" />
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
              {Object.keys(files).length === 0 ? (
                <div className="p-8 text-center text-slate-600 text-xs italic">
                  No files in library folder. Select a folder in settings or create a file.
                </div>
              ) : (
                Object.keys(files).sort().map(name => {
                  const isSelected = selectedFiles.includes(name);
                  const isActive = viewFile === name;
                  return (
                    <div
                      key={name}
                      onClick={() => setViewFile(name)}
                      className={`w-full group flex items-center justify-between p-2 rounded cursor-pointer transition-all ${isActive ? 'bg-slate-800' : 'hover:bg-slate-800/50'
                        }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div
                          onClick={(e) => { e.stopPropagation(); onToggleSelect(name); }}
                          className={`w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer flex-shrink-0 ${isSelected
                            ? 'bg-pink-600 border-pink-500 text-white'
                            : 'bg-slate-800 border-slate-600 text-transparent hover:border-slate-500'
                            }`}
                        >
                          <Icon name="check" className="text-[10px]" />
                        </div>
                        <div className="truncate">
                          <div className={`text-sm font-mono truncate ${isActive ? 'text-pink-300' : 'text-slate-300'}`}>{name}</div>
                          <div className="text-[10px] text-slate-600 truncate">{files[name].length} chars</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Preview Pane */}
          <div className="flex-1 bg-slate-950 flex flex-col relative">
            {viewFile ? (
              <>
                <div className="h-10 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900/30">
                  <span className="text-xs font-mono text-slate-500">{viewFile}</span>
                  <span className="text-[10px] text-slate-600 uppercase tracking-widest">Read Only Preview</span>
                </div>
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                  <MarkdownRenderer content={files[viewFile]} />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center flex-col gap-4 text-slate-700">
                <Icon name="eye" className="text-4xl opacity-20" />
                <p className="text-sm font-mono">Select a file to preview</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Action */}
        <div className="h-14 border-t border-slate-800 bg-slate-900 px-6 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {selectedFiles.length} files selected for injection
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded font-medium text-sm transition-colors shadow-lg shadow-pink-900/20"
          >
            Apply Application Context
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Chat Area ---

const ChatArea = ({
  messages,
  isLoading,
  input,
  setInput,
  onSend,
  scrollRef
}: {
  messages: Message[];
  isLoading: boolean;
  input: string;
  setInput: (s: string) => void;
  onSend: () => void;
  scrollRef: React.RefObject<HTMLDivElement>;
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full relative bg-slate-900">
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-40">
            <div className="w-20 h-20 rounded-full border-2 border-slate-700 flex items-center justify-center mb-4 text-3xl">
              <Icon name="terminal" />
            </div>
            <p className="font-mono text-sm">System Ready. Context Loaded.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end'
            : msg.role === 'system' ? 'justify-center'
              : 'justify-start'
            }`}>
            {msg.role === 'system' ? (
              /* Tool Activity Bubble */
              <div className="max-w-[70%] rounded-md px-3 py-2 bg-amber-900/20 border border-amber-800/30 text-amber-300/80 text-[11px] font-mono">
                <MarkdownRenderer content={msg.text} />
              </div>
            ) : (
              <div className={`max-w-[85%] rounded-lg p-4 shadow-lg ${msg.role === 'user'
                ? 'bg-blue-900/40 border border-blue-700/50 text-blue-100'
                : 'bg-slate-800 border border-slate-700 text-slate-200'
                }`}>
                <div className="text-[10px] font-mono opacity-50 mb-2 flex items-center gap-2 uppercase tracking-wider">
                  <Icon name={msg.role === 'user' ? 'user' : 'robot'} />
                  {msg.role === 'user' ? 'Armando' : 'mikuBot'}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <span className="text-amber-400 ml-1">
                      <Icon name="cog" className="animate-spin" /> using tools
                    </span>
                  )}
                </div>
                <MarkdownRenderer content={msg.text} />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '300ms' }} />
              </div>
              <div className="text-blue-400 text-xs font-mono">AGENT_PROCESSING...</div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-900 border-t border-slate-800">
        <div className="relative max-w-5xl mx-auto flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Execute command or query..."
            className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg py-3 px-4 text-slate-200 font-mono text-sm placeholder-slate-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            rows={1}
            style={{ minHeight: '50px' }}
          />
          <button
            onClick={onSend}
            disabled={!input.trim() || isLoading}
            className="w-12 h-[50px] bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="arrow-right" />
          </button>
        </div>
      </div>
    </div>
  );
};

// --- API Functions ---

async function fetchModels(provider: Provider, config: AppConfig): Promise<ModelInfo[]> {
  try {
    switch (provider) {
      case 'groq': {
        const response = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${config.apiKeys.groq}` }
        });
        if (!response.ok) throw new Error('Failed to fetch Groq models');
        const data = await response.json();
        return data.data.map((m: any) => ({ id: m.id, name: m.id, provider: 'groq' }));
      }
      case 'gemini': {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKeys.gemini}`
        );
        if (!response.ok) throw new Error('Failed to fetch Gemini models');
        const data = await response.json();
        return data.models
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => ({
            id: m.name.replace('models/', ''),
            name: m.displayName,
            provider: 'gemini'
          }));
      }
      case 'ollama': {
        const response = await fetch(`${config.ollamaUrl}/api/tags`);
        if (!response.ok) throw new Error('Failed to connect to Ollama');
        const data = await response.json();
        return data.models.map((m: any) => ({ id: m.name, name: m.name, provider: 'ollama' }));
      }
      default:
        return [];
    }
  } catch (error) {
    console.error('Error fetching models:', error);
    throw error;
  }
}

// --- Tool Executor ---

async function executeToolCall(
  toolCall: ToolCall,
  files: Record<string, string>,
  additionalFiles: Record<string, string>,
  saveFileFn: (name: string, content: string, type: 'core' | 'extra') => Promise<boolean>,
  requestLocationFn?: (filename: string, suggestedSource: string) => Promise<{ approved: boolean; targetSource: 'core' | 'extra' } | null>
): Promise<ToolResult> {
  const { name, arguments: args } = toolCall.function;

  try {
    switch (name) {
      case 'read_file': {
        const source = args.source === 'library' ? additionalFiles : files;
        const content = source[args.filename];
        if (content !== undefined) {
          return { success: true, data: { filename: args.filename, content } };
        }
        return { success: false, error: `File "${args.filename}" not found in ${args.source} folder.` };
      }

      case 'update_file': {
        if (!args.filename) {
          return { success: false, error: 'Missing required parameter: filename.' };
        }

        // Block protected identity files
        if (PROTECTED_CORE_FILES.includes(args.filename)) {
          return { success: false, error: `"${args.filename}" is a PROTECTED identity file and cannot be modified by tools. Only ACTIVE_CONTEXT.md and TASKS.md are writable in core.` };
        }

        // Determine if it's a new file
        const isExisting = (args.filename in files) || (args.filename in additionalFiles);
        let targetType: 'core' | 'extra' = args.source === 'library' ? 'extra' : 'core';

        // For new files, ask user for location
        if (!isExisting && requestLocationFn) {
          const decision = await requestLocationFn(args.filename, args.source || 'library');
          if (!decision || !decision.approved) {
            return { success: false, error: 'File creation was cancelled by the user.' };
          }
          targetType = decision.targetSource;
        }

        const saved = await saveFileFn(args.filename, args.content, targetType);
        if (saved) {
          return { success: true, data: { filename: args.filename, message: `File "${args.filename}" saved successfully.` } };
        }
        return { success: false, error: `Failed to save "${args.filename}". Ensure a folder is selected in Settings.` };
      }

      case 'list_files': {
        const source = args.source === 'library' ? additionalFiles : files;
        const fileList = Object.keys(source).map(f => ({
          name: f,
          size: source[f].length
        }));
        return { success: true, data: { files: fileList, count: fileList.length } };
      }

      case 'search_files': {
        const source = args.source === 'library' ? additionalFiles : files;
        const query = args.query.toLowerCase();
        const matches: { filename: string; lines: string[] }[] = [];
        for (const [filename, content] of Object.entries(source)) {
          const matchingLines = content.split('\n')
            .filter(line => line.toLowerCase().includes(query))
            .slice(0, 5); // Limit to 5 matches per file
          if (matchingLines.length > 0) {
            matches.push({ filename, lines: matchingLines });
          }
        }
        return { success: true, data: { query: args.query, matches, totalFiles: matches.length } };
      }

      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { success: false, error: `Tool execution error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// --- Streaming Message (Groq / Gemini) ---

async function sendStreamingMessage(
  provider: 'groq' | 'gemini',
  config: AppConfig,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  onChunk: (text: string) => void
): Promise<void> {
  if (provider === 'groq') {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKeys.groq}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        stream: true,
        temperature: config.temperature,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '));
        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) onChunk(content);
          } catch { }
        }
      }
    }
  } else {
    // Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:streamGenerateContent?alt=sse&key=${config.apiKeys.gemini}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : m.role,
            parts: [{ text: m.content }]
          })),
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { temperature: config.temperature }
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '));
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line.slice(6));
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) onChunk(text);
          } catch { }
        }
      }
    }
  }
}

// --- Agent Loop (Ollama with Tool Calling) ---

const MAX_TOOL_ITERATIONS = 8; // Safety limit

async function sendAgentMessage(
  config: AppConfig,
  systemPrompt: string,
  chatMessages: { role: string; content: string }[],
  tools: ToolDefinition[],
  files: Record<string, string>,
  additionalFiles: Record<string, string>,
  saveFileFn: (name: string, content: string, type: 'core' | 'extra') => Promise<boolean>,
  onChunk: (text: string) => void,
  onToolEvent: (event: { type: 'call' | 'result'; toolName: string; args?: any; result?: ToolResult }) => void,
  requestLocationFn?: (filename: string, suggestedSource: string) => Promise<{ approved: boolean; targetSource: 'core' | 'extra' } | null>
): Promise<void> {
  // Build message array for Ollama
  const ollamaMessages: any[] = [
    { role: 'system', content: systemPrompt },
    ...chatMessages
  ];

  // --- First request: try with tools ---
  const firstResponse = await fetch(`${config.ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages: ollamaMessages,
      tools: tools,
      stream: false,
      options: { temperature: config.temperature }
    }),
  });

  // If 400 = model likely doesn't support tools → fall back to streaming without tools
  if (firstResponse.status === 400) {
    console.warn('[Agent] Model does not support tool calling, falling back to streaming mode.');
    const fallbackResponse = await fetch(`${config.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages: ollamaMessages,
        stream: true,
        options: { temperature: config.temperature }
      }),
    });

    if (!fallbackResponse.ok) throw new Error(`Ollama error: HTTP ${fallbackResponse.status}`);

    const reader = fallbackResponse.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              fullContent += parsed.message.content;
            }
          } catch { }
        }
      }
    }

    // Strip <think> blocks (DeepSeek-R1 support)
    fullContent = fullContent.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    if (fullContent) onChunk(fullContent);
    return;
  }

  if (!firstResponse.ok) {
    const errBody = await firstResponse.text().catch(() => '');
    throw new Error(`Ollama error: HTTP ${firstResponse.status} ${errBody}`);
  }

  // --- Tool-calling agent loop ---
  let data = await firstResponse.json();
  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;
    const assistantMsg = data.message;

    // Add assistant response to history
    ollamaMessages.push(assistantMsg);

    // Check for tool calls
    if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
      // Process each tool call
      for (const tc of assistantMsg.tool_calls) {
        const toolCall: ToolCall = {
          function: {
            name: tc.function.name,
            arguments: typeof tc.function.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments
          }
        };

        // Notify UI
        onToolEvent({ type: 'call', toolName: toolCall.function.name, args: toolCall.function.arguments });

        // Execute
        const result = await executeToolCall(toolCall, files, additionalFiles, saveFileFn, requestLocationFn);

        // Notify UI
        onToolEvent({ type: 'result', toolName: toolCall.function.name, result });

        // If the tool was update_file and succeeded, update our local copy for subsequent calls
        if (toolCall.function.name === 'update_file' && result.success) {
          const args = toolCall.function.arguments;
          if (args.source === 'library') {
            additionalFiles = { ...additionalFiles, [args.filename]: args.content };
          } else {
            files = { ...files, [args.filename]: args.content };
          }
        }

        // Add tool result to history
        ollamaMessages.push({
          role: 'tool',
          content: JSON.stringify(result)
        });
      }

      // Send next request with tool results
      const nextResponse = await fetch(`${config.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          messages: ollamaMessages,
          tools: tools,
          stream: false,
          options: { temperature: config.temperature }
        }),
      });

      if (!nextResponse.ok) throw new Error(`Ollama error: HTTP ${nextResponse.status}`);
      data = await nextResponse.json();
      // Continue the loop - model will see tool results
    } else {
      // No tool calls = final response
      if (assistantMsg.content) {
        // Strip <think> blocks if present (DeepSeek-R1 support)
        let content = assistantMsg.content;
        content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        onChunk(content);
      }
      break; // Exit the loop
    }
  }

  if (iterations >= MAX_TOOL_ITERATIONS) {
    onChunk('\n\n⚠️ Agent reached maximum tool iterations. Stopping to prevent infinite loops.');
  }
}

// --- Main App ---

const App = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('mikuBot_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          config: { ...DEFAULT_CONFIG, ...parsed.config },
          files: parsed.files || DEFAULT_FILES,
          additionalFiles: parsed.additionalFiles || {},
          selectedLibraryFiles: parsed.selectedLibraryFiles || [],
          activeTab: 'chat' as const,
          selectedFile: 'SOUL.md',
          isLibraryExpanded: false,
          unsavedChanges: {}
        };
      } catch { }
    }
    return {
      config: DEFAULT_CONFIG,
      files: DEFAULT_FILES,
      additionalFiles: {},
      selectedLibraryFiles: [],
      activeTab: 'chat' as const,
      selectedFile: 'SOUL.md',
      isLibraryExpanded: false,
      unsavedChanges: {}
    };
  });

  // File operations
  const saveFile = async (name: string, content: string, type: 'core' | 'extra') => {
    if (!name) {
      console.error("Save failed: No filename provided");
      return false;
    }

    try {
      let handle = type === 'core' ? coreHandle : extraHandle;
      if (!handle) throw new Error("No handle selected for " + type);

      // Verify/Request write permission
      // @ts-ignore
      if (handle.queryPermission) {
        // @ts-ignore
        const status = await handle.queryPermission({ mode: 'readwrite' });
        if (status !== 'granted') {
          // @ts-ignore
          const request = await handle.requestPermission({ mode: 'readwrite' });
          if (request !== 'granted') throw new Error("Write permission denied by user");
        }
      }

      // Handle subdirectories (e.g., "project/index.html")
      const parts = name.split('/').filter(p => p && p !== '.');
      const fileName = parts.pop();
      if (!fileName) throw new Error("Invalid filename");

      // Traverse/Create folders
      for (const folder of parts) {
        handle = await handle.getDirectoryHandle(folder, { create: true });
      }

      const fileHandle = await handle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      // Update state
      setState(prev => {
        const nextUnsaved = { ...prev.unsavedChanges };
        delete nextUnsaved[name];

        if (type === 'core') {
          return { ...prev, files: { ...prev.files, [name]: content }, unsavedChanges: nextUnsaved };
        } else {
          return { ...prev, additionalFiles: { ...prev.additionalFiles, [name]: content }, unsavedChanges: nextUnsaved };
        }
      });

      return true;
    } catch (e) {
      console.error("Save failed", e);
      return false;
    }
  };

  const createFile = async (name: string, type: 'core' | 'extra') => {
    if (!name.endsWith('.md')) name += '.md';
    await saveFile(name, '# New File', type);
  };

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle');

  // File System State
  const [coreHandle, setCoreHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [extraHandle, setExtraHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [pendingFileAction, setPendingFileAction] = useState<PendingFileAction | null>(null);
  const sessionLocationRef = useRef<{ source: 'core' | 'extra' } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize DB and load handles
  useEffect(() => {
    const restoreHandles = async () => {
      try {
        const core = await db.get('coreHandle');
        if (core) {
          setCoreHandle(core);
          // Try to sync if permission allows
          // Browsers typically block auto-read without gesture, so user might need to click "Select" again to re-grant
          // However, we keep the handle so we know a folder WAS selected.
          console.log("Restored Core Handle");
          // Attempt silent sync if verifyPermission exists (Chrome/Edge)
          // @ts-ignore
          if (core.queryPermission) {
            // @ts-ignore
            const perm = await core.queryPermission({ mode: 'read' });
            if (perm === 'granted') syncFiles('core', core);
          }
        }

        const extra = await db.get('extraHandle');
        if (extra) {
          setExtraHandle(extra);
          console.log("Restored Extra Handle");
          // @ts-ignore
          if (extra.queryPermission) {
            // @ts-ignore
            const perm = await extra.queryPermission({ mode: 'read' });
            if (perm === 'granted') syncFiles('extra', extra);
          }
        }
      } catch (e) {
        console.error("Failed to restore handles", e);
      }
    };
    restoreHandles();
  }, []);

  const syncFiles = useCallback(async (
    target: 'core' | 'extra',
    handle: FileSystemDirectoryHandle
  ) => {
    setSyncing(true);
    try {
      const newFiles: Record<string, string> = {};

      // Recursive reader
      const readDir = async (dirHandle: FileSystemDirectoryHandle, path = '') => {
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file' && /\.(md|txt|json|js|jsx|ts|tsx|html|css)$/i.test(entry.name)) {
            const fileHandle = entry as FileSystemFileHandle;
            const file = await fileHandle.getFile();
            const text = await file.text();
            newFiles[path + entry.name] = text;
          } else if (entry.kind === 'directory') {
            // Optional: Recursive? For now keep flat for core, recursive for library
            // Let's do 1 level deep for safety or full recursive
            const newPath = path + entry.name + '/';
            await readDir(entry as FileSystemDirectoryHandle, newPath);
          }
        }
      };

      await readDir(handle);

      setState(prev => {
        if (target === 'core') {
          // REPLACE files from this folder, do not merge with old state
          // This ensures if TASKS.md is deleted on disk, it goes away here too
          return { ...prev, files: newFiles };
        } else {
          // For library, we replace the whole dictionary
          return { ...prev, additionalFiles: newFiles };
        }
      });

      setSyncing(false);
    } catch (e) {
      console.error(`Error syncing ${target}`, e);
      // alert(`Could not sync ${target} folder. Browser permissions may have expired. re-select folder.`);
    } finally {
      setSyncing(false);
    }
  }, []);

  // Removed automatic sync effects to prevent permission errors on reload.
  // Sync now happens only on explicit folder select or manual re-sync button (to be added if needed).

  const handleSelectFolder = async (type: 'core' | 'extra') => {
    try {
      // @ts-ignore
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      if (type === 'core') {
        setCoreHandle(handle);
        await db.set('coreHandle', handle);
        await syncFiles('core', handle);
      } else {
        setExtraHandle(handle);
        await db.set('extraHandle', handle);
        await syncFiles('extra', handle);
      }
    } catch (e) {
      // User cancelled or error
      console.log("Folder select cancelled", e);
    }
  };

  useEffect(() => {
    localStorage.setItem('mikuBot_config', JSON.stringify({
      config: state.config,
      files: state.files
    }));
  }, [state]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const updateConfig = useCallback((key: string, value: any) => {
    setState(prev => ({
      ...prev,
      config: { ...prev.config, [key]: value }
    }));
  }, []);

  const handleTestConnection = useCallback(async () => {
    setLoadingModels(true);
    setConnectionStatus('testing');
    try {
      const fetchedModels = await fetchModels(state.config.provider, state.config);
      setModels(fetchedModels);
      setConnectionStatus('connected');
      if (fetchedModels.length > 0 && !state.config.model) {
        updateConfig('model', fetchedModels[0].id);
      }
    } catch (error) {
      setConnectionStatus('error');
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, [state.config, updateConfig]);

  const constructSystemInstruction = () => {
    const files = state.files || {};
    const additionalFiles = state.additionalFiles || {};
    const selectedFiles = state.selectedLibraryFiles || [];
    const hasCore = Object.keys(files).length > 0;
    const isAgent = state.config.provider === 'ollama';

    const coreContext = hasCore ? `
[SYSTEM KERNEL: mikuBot]
You are a persistent, autonomous agent. Your memory resides in files on the user's local file system.

${Object.entries(files).map(([name, content]) =>
      `=== ${name} ===\n${content}`
    ).join('\n\n')}
    `.trim() : '[SYSTEM: No core files loaded. Please select Core folder in Settings.]';

    const toolSection = isAgent ? `

=== AGENT CAPABILITIES ===
You have access to tools for self-management:
- read_file: Read any file from core or library folders.
- update_file: Write or overwrite a file to persist information. Supports paths with folders (e.g. project/index.html).
- list_files: Discover what files exist.
- search_files: Search for text across files.

RULES:
1. Use update_file to remember new facts the user shares.
2. Read files before updating them to avoid losing content.
3. Only call tools when there is a clear reason.
4. After using tools, confirm what you did to the user.
5. NEVER modify these protected identity files: SOUL.md, USER.md, TOOLS.md, PROTOCOL.md. They are READ-ONLY.
6. You may only write to ACTIVE_CONTEXT.md and TASKS.md in core. For everything else, use the library folder.
7. When creating project files, use update_file with source "library" and use folder paths (e.g. "proyecto/index.html").
` : '';

    const selectedEntries = Object.entries(additionalFiles).filter(([name]) =>
      selectedFiles.includes(name)
    );
    const libraryContext = selectedEntries.length > 0
      ? `\n\n=== LIBRARY / ADDITIONAL CONTEXT ===\n${selectedEntries.map(([name, content]) =>
        `\n--- FILE: ${name} ---\n${content}\n--- END FILE ---\n`
      ).join('')}`
      : '';

    return coreContext + toolSection + libraryContext;
  };

  const processMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    if (!state.config.model) {
      alert('Please select a model in Settings first.');
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const modelMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: modelMsgId,
      role: 'assistant' as const,
      text: '',
      timestamp: new Date(),
      isStreaming: true
    }]);

    try {
      let fullText = '';
      const chatHistory = messages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({
        role: m.role,
        content: m.text
      }));
      chatHistory.push({ role: 'user', content: userMsg.text });

      const systemInstruction = constructSystemInstruction();

      if (state.config.provider === 'ollama') {
        // Reset session location for this agent run
        sessionLocationRef.current = null;

        // Location request callback - shows modal for new file creation
        const requestLocation = (filename: string, suggestedSource: string): Promise<{ approved: boolean; targetSource: 'core' | 'extra' } | null> => {
          // If user already chose a location in this session, reuse it
          if (sessionLocationRef.current) {
            return Promise.resolve({ approved: true, targetSource: sessionLocationRef.current.source });
          }

          return new Promise((resolve) => {
            setPendingFileAction({
              filename,
              suggestedSource,
              resolve: (decision) => {
                setPendingFileAction(null);
                if (decision) {
                  // Remember for subsequent files in this agent run
                  sessionLocationRef.current = { source: decision.targetSource };
                }
                resolve(decision);
              }
            });
          });
        };

        // Agent mode with tool calling
        await sendAgentMessage(
          state.config,
          systemInstruction,
          chatHistory,
          AGENT_TOOLS,
          { ...state.files },
          { ...state.additionalFiles },
          saveFile,
          (chunk) => {
            fullText += chunk;
            setMessages(prev => prev.map(m =>
              m.id === modelMsgId ? { ...m, text: fullText } : m
            ));
          },
          (event) => {
            // Show tool events in chat as system bubbles
            const toolMsgId = `tool_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            if (event.type === 'call') {
              setMessages(prev => [...prev.filter(m => m.id !== modelMsgId), {
                id: toolMsgId,
                role: 'system' as const,
                text: `🔧 **Tool Call:** \`${event.toolName}\`\n\`\`\`json\n${JSON.stringify(event.args, null, 2)}\n\`\`\``,
                timestamp: new Date(),
                toolName: event.toolName
              }, { ...prev.find(m => m.id === modelMsgId)! }]);
            } else if (event.type === 'result') {
              const statusIcon = event.result?.success ? '✅' : '❌';
              const resultPreview = event.result?.success
                ? (event.result?.data?.message || `${event.result?.data?.count ?? ''} items`)
                : event.result?.error;
              setMessages(prev => [...prev.filter(m => m.id !== modelMsgId), {
                id: toolMsgId,
                role: 'system' as const,
                text: `${statusIcon} **Result** (\`${event.toolName}\`): ${resultPreview}`,
                timestamp: new Date(),
                toolName: event.toolName
              }, { ...prev.find(m => m.id === modelMsgId)! }]);

              // If a file was updated, re-sync state
              if (event.toolName === 'update_file' && event.result?.success && coreHandle) {
                syncFiles('core', coreHandle);
              }
            }
          },
          requestLocation
        );
      } else {
        // Streaming mode for Groq/Gemini
        await sendStreamingMessage(
          state.config.provider as 'groq' | 'gemini',
          state.config,
          systemInstruction,
          chatHistory,
          (chunk) => {
            fullText += chunk;
            setMessages(prev => prev.map(m =>
              m.id === modelMsgId ? { ...m, text: fullText } : m
            ));
          }
        );
      }
    } catch (error) {
      console.error('API Error:', error);
      setMessages(prev => prev.map(m =>
        m.id === modelMsgId
          ? { ...m, text: `⚠️ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }
          : m
      ));
    } finally {
      setIsLoading(false);
      setMessages(prev => prev.map(m =>
        m.id === modelMsgId ? { ...m, isStreaming: false } : m
      ));
    }
  };

  const handleClear = () => setMessages([]);

  return (
    <div className="flex h-screen w-full bg-[#0f172a] text-slate-200 overflow-hidden font-sans">
      <Sidebar
        state={state}
        setState={setState}
        onClear={handleClear}
        models={models}
        connectionStatus={connectionStatus}
      />

      {state.activeTab === 'chat' && (
        <ChatArea
          messages={messages}
          isLoading={isLoading}
          input={input}
          setInput={setInput}
          onSend={() => processMessage(input)}
          scrollRef={scrollRef}
        />
      )}

      {state.activeTab === 'cortex' && (
        <FileEditor
          files={state.files}
          selectedFile={state.selectedFile}
          setSelectedFile={(f) => setState(prev => ({ ...prev, selectedFile: f }))}
          onSave={(name, content) => saveFile(name, content, 'core')}
          unsavedChanges={state.unsavedChanges}
          setUnsavedChanges={(newUnsaved) => {
            setState(prev => ({
              ...prev,
              unsavedChanges: typeof newUnsaved === 'function'
                ? newUnsaved(prev.unsavedChanges)
                : newUnsaved
            }));
          }}
          onAddFile={() => createFile(`New_Core_File_${Date.now()}`, 'core')}
        />
      )}

      <LibraryManager
        isOpen={state.isLibraryExpanded}
        onClose={() => setState(prev => ({ ...prev, isLibraryExpanded: false }))}
        files={state.additionalFiles}
        selectedFiles={state.selectedLibraryFiles}
        onToggleSelect={(name) => {
          setState(prev => {
            const current = prev.selectedLibraryFiles || [];
            const updated = current.includes(name)
              ? current.filter(f => f !== name)
              : [...current, name];
            return { ...prev, selectedLibraryFiles: updated };
          });
        }}
        onSave={(name, content) => saveFile(name, content, 'extra')}
        onAdd={() => createFile(`Library_Note_${Date.now()}`, 'extra')}
      />

      {state.activeTab === 'settings' && (
        <SettingsPanel
          config={state.config}
          updateConfig={updateConfig}
          models={models}
          loadingModels={loadingModels}
          connectionStatus={connectionStatus}
          onTestConnection={handleTestConnection}
          onCoreSelect={() => handleSelectFolder('core')}
          onExtraSelect={() => handleSelectFolder('extra')}
          corePathName={coreHandle?.name || ''}
          extraPathName={extraHandle?.name || ''}
          syncing={syncing}
        />
      )}

      {pendingFileAction && (
        <FileLocationModal
          pending={pendingFileAction}
          corePathName={coreHandle?.name || ''}
          extraPathName={extraHandle?.name || ''}
        />
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);