import React, { useState, useEffect } from 'react';
import { AppConfig, ModelInfo, Provider } from '../types';
import { PROVIDERS } from '../constants';
import { Icon } from './Common';

interface SettingsPanelProps {
    config: AppConfig;
    updateConfig: (key: string, value: any) => void;
    models: ModelInfo[];
    loadingModels: boolean;
    connectionStatus: 'idle' | 'testing' | 'connected' | 'error';
    onTestConnection: () => void;
    onCoreSelect: () => void;
    onExtraSelect: () => void;
    onSandboxSelect: () => void;
    onSaveGlobal: () => void;
    onResetGlobal: () => void;
    corePathName: string;
    extraPathName: string;
    sandboxPathName: string;
    syncing: boolean;
}

export const SettingsPanel = ({
    config,
    updateConfig,
    models,
    loadingModels,
    connectionStatus,
    onTestConnection,
    onCoreSelect,
    onExtraSelect,
    onSandboxSelect,
    onSaveGlobal,
    onResetGlobal,
    corePathName,
    extraPathName,
    sandboxPathName,
    syncing
}: SettingsPanelProps) => {
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
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1 tracking-tight">⚙️ Control Room</h2>
                        <p className="text-slate-400 text-sm">Configure Neural Engine and Neural Cortex settings.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onResetGlobal}
                            className="px-4 py-2 border border-red-900/40 text-red-500 hover:bg-red-900/20 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2"
                        >
                            <Icon name="history" /> Default Presets
                        </button>
                        <button
                            onClick={onSaveGlobal}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold uppercase shadow-lg shadow-blue-900/20 transition-all flex items-center gap-2"
                        >
                            <Icon name="save" /> Save Config
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">Knowledge Base</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Sandbox (Default Agent Workspace) */}
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-emerald-700/50">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                                    <Icon name="box" className="text-lg" />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-200">Sandbox</div>
                                    <div className="text-[10px] text-emerald-500/70">Default agent workspace</div>
                                </div>
                            </div>
                            <div className="text-xs font-mono text-slate-400 mb-3 truncate bg-slate-900/50 p-2 rounded border border-emerald-700/30">
                                {sandboxPathName || "Not configured — select folder"}
                            </div>
                            <button
                                onClick={onSandboxSelect}
                                disabled={syncing}
                                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                {syncing ? <Icon name="sync fa-spin" /> : <Icon name="folder-open" />}
                                Select Sandbox Folder
                            </button>
                        </div>

                        {/* Core Identity */}
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                                    <Icon name="hdd" className="text-lg" />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-200">Core Identity</div>
                                    <div className="text-[10px] text-slate-500">core/SOUL.md, core/USER.md, core/ACTIVE_CONTEXT.md</div>
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

                        {/* Library */}
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

                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input
                                type={config.provider === 'ollama' || showApiKey ? "text" : "password"}
                                value={config.provider === 'ollama' ? config.ollamaUrl : localApiKey}
                                onChange={(e) => config.provider === 'ollama' ? updateConfig('ollamaUrl', e.target.value) : setLocalApiKey(e.target.value)}
                                placeholder={config.provider === 'ollama' ? "http://localhost:11434" : "paste your API key here..."}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors"
                            />
                            {config.provider !== 'ollama' && (
                                <button
                                    type="button"
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                >
                                    <Icon name={showApiKey ? "eye-slash" : "eye"} />
                                </button>
                            )}
                        </div>
                        {config.provider !== 'ollama' && (
                            <button
                                onClick={handleSaveKey}
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                            >
                                Save
                            </button>
                        )}
                        <button
                            onClick={onTestConnection}
                            disabled={loadingModels || connectionStatus === 'testing'}
                            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-2"
                        >
                            {connectionStatus === 'testing' ? <Icon name="spinner fa-spin" /> : <Icon name="network-wired" />}
                            Test
                        </button>
                    </div>

                    {currentProvider.getApiKeyUrl && (
                        <p className="text-xs text-slate-500">
                            Don't have a key? Get one at <a href={currentProvider.getApiKeyUrl} target="_blank" rel="noopener" className="text-blue-400 hover:underline">{currentProvider.name} Console</a>
                        </p>
                    )}
                </div>

                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                            <Icon name="search" />
                        </div>
                        <label className="text-sm font-bold text-slate-200">Web Search Engine</label>
                    </div>
                    <p className="text-xs text-slate-400">Enable real-time information retrieval using Tavily API.</p>

                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <div className="w-20 text-[10px] font-bold text-slate-500 flex items-center">TAVILY</div>
                            <input
                                type="password"
                                value={config.tavilyApiKey}
                                onChange={(e) => updateConfig('tavilyApiKey', e.target.value)}
                                placeholder="Enter Tavily API Key..."
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                        <div className="flex gap-2">
                            <div className="w-20 text-[10px] font-bold text-slate-500 flex items-center">BRAVE</div>
                            <input
                                type="password"
                                value={config.braveApiKey}
                                onChange={(e) => updateConfig('braveApiKey', e.target.value)}
                                placeholder="Enter Brave Search API Key..."
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-500">
                        Get keys at: <a href="https://tavily.com/" target="_blank" rel="noopener" className="text-blue-400 hover:underline">Tavily.com</a> o <a href="https://api.search.brave.com/app/dashboard" target="_blank" rel="noopener" className="text-blue-400 hover:underline">Brave Search</a>
                    </p>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                            <Icon name="microchip" />
                        </div>
                        <label className="text-sm font-bold text-slate-200">Model Selection</label>
                    </div>

                    <div className="space-y-4">
                        <select
                            value={config.model}
                            onChange={(e) => updateConfig('model', e.target.value)}
                            disabled={loadingModels || models.filter(m => m.provider === config.provider).length === 0}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white appearance-none focus:outline-none focus:border-blue-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="">Select a model...</option>
                            {models
                                .filter(m => m.provider === config.provider)
                                .map(model => (
                                    <option key={model.id} value={model.id}>{model.name}</option>
                                ))}
                        </select>

                        <div className="flex items-center gap-4 px-2">
                            <div className="flex-1">
                                <div className="flex justify-between mb-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Creativity (Temp)</label>
                                    <span className="text-xs font-mono text-blue-400">{config.temperature}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={config.temperature}
                                    onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
                                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    {config.provider === 'ollama' && models.filter(m => m.provider === 'ollama').length === 0 && !loadingModels && (
                        <div className="p-4 bg-amber-900/20 border border-amber-800/30 rounded-lg text-amber-200 text-xs flex gap-3">
                            <Icon name="exclamation-triangle" className="text-amber-500 text-base" />
                            <div>
                                <p className="font-bold mb-1">Ollama not detected or no models found.</p>
                                <p>Make sure Ollama is running and you have pulled at least one model (e.g., <code>ollama pull gemma2</code>).</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
