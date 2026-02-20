import React, { useState, useEffect } from 'react';
import { AppConfig, ModelInfo, Provider } from '../../types';
import { PROVIDERS } from '../../constants';
import { Icon } from '../common/Common';

interface SettingsPanelProps {
    config: AppConfig;
    updateConfig: (key: string, value: any) => void;
    models: Record<Provider, ModelInfo[]>;
    loadingModels: Record<Provider, boolean>;
    connectionStatus: 'idle' | 'testing' | 'connected' | 'error';
    onTestConnection: (provider?: Provider) => void;
    onCoreSelect: () => void;
    onExtraSelect: () => void;
    onWorkSpaceSelect: () => void;
    onToolsSelect: () => void;
    onSaveGlobal: () => void;
    onResetGlobal: () => void;
    onLoadConfig: () => void;
    onExportConfig: () => void;
    corePathName: string;
    extraPathName: string;
    workSpacePathName: string;
    toolsPathName: string;
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
    onWorkSpaceSelect,
    onToolsSelect,
    onSaveGlobal,
    onResetGlobal,
    onLoadConfig,
    onExportConfig,
    corePathName,
    extraPathName,
    workSpacePathName,
    toolsPathName,
    syncing
}: SettingsPanelProps) => {
    const [showApiKey, setShowApiKey] = useState(false);
    // Track which provider's key we are currently editing in the global section
    const [editingProvider, setEditingProvider] = useState<Provider>(config.provider);
    const [localApiKey, setLocalApiKey] = useState('');

    useEffect(() => {
        setLocalApiKey(config.apiKeys[editingProvider] || '');
    }, [editingProvider, config.apiKeys]);

    const handleSaveKey = (provider: Provider, key: string) => {
        updateConfig('apiKeys', { ...config.apiKeys, [provider]: key });
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
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={onLoadConfig}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2"
                            title="Auto-detect saved config, or browse for a config.json file"
                        >
                            <Icon name="download" /> Load Config
                        </button>
                        <button
                            onClick={onExportConfig}
                            className="px-4 py-2 border border-slate-600 text-slate-300 hover:bg-slate-700 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2"
                            title="Download current config as JSON file"
                        >
                            <Icon name="file-export" /> Export
                        </button>
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
                        {/* WorkSpace (Default Agent Workspace) */}
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-emerald-700/50">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                                    <Icon name="box" className="text-lg" />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-200">WorkSpace</div>
                                    <div className="text-[10px] text-emerald-500/70">Default agent workspace</div>
                                </div>
                            </div>
                            <div className="text-xs font-mono text-slate-400 mb-3 truncate bg-slate-900/50 p-2 rounded border border-emerald-700/30">
                                {workSpacePathName || "Not configured — select folder"}
                            </div>
                            <button
                                onClick={onWorkSpaceSelect}
                                disabled={syncing}
                                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                {syncing ? <Icon name="sync fa-spin" /> : <Icon name="folder-open" />}
                                Select WorkSpace Folder
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

                        {/* Command Engine */}
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-amber-900/40">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                                    <Icon name="bolt" className="text-lg" />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-200">Command Engine</div>
                                    <div className="text-[10px] text-amber-500/70">Agent instructions & tools</div>
                                </div>
                            </div>
                            <div className="text-xs font-mono text-slate-400 mb-3 truncate bg-slate-900/50 p-2 rounded border border-amber-900/20">
                                {toolsPathName || "Not configured — select folder"}
                            </div>
                            <button
                                onClick={onToolsSelect}
                                disabled={syncing}
                                className="w-full py-2 bg-amber-700 hover:bg-amber-600 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                {syncing ? <Icon name="sync fa-spin" /> : <Icon name="folder-open" />}
                                Select Commands Folder
                            </button>
                        </div>
                    </div>
                </div>

                <div className="h-px bg-slate-800" />

                {/* Dynamic Configuration per Mode */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                            <Icon name="microchip" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest">Neural Orchestration</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Chat Configuration Card */}
                        <div className="bg-slate-800/80 rounded-2xl p-6 border border-blue-500/30 shadow-xl shadow-blue-500/5 transition-all hover:border-blue-500/50">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Icon name="comments" className="text-blue-400 text-lg" />
                                    <span className="font-bold text-blue-400 tracking-tight uppercase text-xs">Chat Mode Engine</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {config.chatProvider !== 'ollama' && (
                                        <button
                                            onClick={() => {
                                                const key = prompt(`Enter API Key for ${PROVIDERS[config.chatProvider || 'gemini'].name}:`, config.apiKeys[config.chatProvider || 'gemini']);
                                                if (key !== null) handleSaveKey(config.chatProvider || 'gemini', key);
                                            }}
                                            className="p-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-400 rounded-md transition-all sm:flex hidden"
                                            title="Quick Key Update"
                                        >
                                            <Icon name="key" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => onTestConnection(config.chatProvider)}
                                        disabled={loadingModels[config.chatProvider || 'groq']}
                                        className="p-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded-md transition-all flex items-center gap-1.5 text-[10px] font-bold uppercase"
                                        title="Sync models for Chat Provider"
                                    >
                                        {loadingModels[config.chatProvider || 'groq'] ? <Icon name="sync fa-spin" /> : <Icon name="sync" />}
                                        Sync
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Provider</label>
                                    <div className="flex gap-2">
                                        {(Object.keys(PROVIDERS) as Provider[]).map(pId => (
                                            <button
                                                key={pId}
                                                onClick={() => updateConfig('chatProvider', pId)}
                                                className={`flex-1 p-2 rounded-lg border transition-all flex flex-col items-center gap-1 ${config.chatProvider === pId
                                                    ? `border-${PROVIDERS[pId].color.split(' ')[0].split('-')[1]}-500 bg-slate-700`
                                                    : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'}`}
                                            >
                                                <Icon name={PROVIDERS[pId].icon} className={`text-sm ${config.chatProvider === pId ? 'text-white' : 'text-slate-500'}`} />
                                                <span className="text-[9px] font-bold text-slate-300 uppercase">{PROVIDERS[pId].name.split(' ')[0]}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Model</label>
                                    <select
                                        value={config.chatModel}
                                        onChange={(e) => updateConfig('chatModel', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                                    >
                                        <option value="">Default/Select Model...</option>
                                        {(models[config.chatProvider || 'groq'] || []).map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Agent Configuration Card */}
                        <div className="bg-slate-800/80 rounded-2xl p-6 border border-purple-500/30 shadow-xl shadow-purple-500/5 transition-all hover:border-purple-500/50">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Icon name="bolt" className="text-purple-400 text-lg" />
                                    <span className="font-bold text-purple-400 tracking-tight uppercase text-xs">Agent Mode Engine</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {config.agentProvider !== 'ollama' && (
                                        <button
                                            onClick={() => {
                                                const key = prompt(`Enter API Key for ${PROVIDERS[config.agentProvider || 'groq'].name}:`, config.apiKeys[config.agentProvider || 'groq']);
                                                if (key !== null) handleSaveKey(config.agentProvider || 'groq', key);
                                            }}
                                            className="p-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-400 rounded-md transition-all sm:flex hidden"
                                            title="Quick Key Update"
                                        >
                                            <Icon name="key" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => onTestConnection(config.agentProvider)}
                                        disabled={loadingModels[config.agentProvider || 'groq']}
                                        className="p-1.5 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 rounded-md transition-all flex items-center gap-1.5 text-[10px] font-bold uppercase"
                                        title="Sync models for Agent Provider"
                                    >
                                        {loadingModels[config.agentProvider || 'groq'] ? <Icon name="sync fa-spin" /> : <Icon name="sync" />}
                                        Sync
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Provider</label>
                                    <div className="flex gap-2">
                                        {(Object.keys(PROVIDERS) as Provider[]).map(pId => (
                                            <button
                                                key={pId}
                                                onClick={() => updateConfig('agentProvider', pId)}
                                                className={`flex-1 p-2 rounded-lg border transition-all flex flex-col items-center gap-1 ${config.agentProvider === pId
                                                    ? 'border-purple-500 bg-slate-700'
                                                    : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'}`}
                                            >
                                                <Icon name={PROVIDERS[pId].icon} className={`text-sm ${config.agentProvider === pId ? 'text-white' : 'text-slate-500'}`} />
                                                <span className="text-[9px] font-bold text-slate-300 uppercase">{PROVIDERS[pId].name.split(' ')[0]}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Model</label>
                                    <select
                                        value={config.agentModel}
                                        onChange={(e) => updateConfig('agentModel', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500"
                                    >
                                        <option value="">Default/Select Model...</option>
                                        {(models[config.agentProvider || 'groq'] || []).map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                                Global Credentials & Fallbacks
                            </label>
                            <span className="text-[10px] text-slate-500 tracking-tight">Manage your API keys for all providers here.</span>
                        </div>
                    </div>

                    <div className="space-y-4 bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Master Provider (Fallback)</label>
                                <select
                                    value={config.provider}
                                    onChange={(e) => updateConfig('provider', e.target.value as Provider)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                                >
                                    {(Object.keys(PROVIDERS) as Provider[]).map(pId => (
                                        <option key={pId} value={pId}>{PROVIDERS[pId].name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Master Model</label>
                                <select
                                    value={config.model}
                                    onChange={(e) => updateConfig('model', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                                >
                                    <option value="">Select Master Model...</option>
                                    {(models[config.provider] || []).map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={() => onTestConnection()}
                                disabled={loadingModels[config.provider]}
                                className="mt-5 p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
                                title="Test Master Connection"
                            >
                                {loadingModels[config.provider] ? <Icon name="spinner fa-spin" /> : <Icon name="network-wired" />}
                            </button>
                        </div>

                        <div className="h-px bg-slate-800" />

                        <div className="flex items-center gap-3">
                            <select
                                value={editingProvider}
                                onChange={(e) => setEditingProvider(e.target.value as Provider)}
                                className="bg-slate-800 border-none text-blue-400 text-xs font-bold uppercase cursor-pointer focus:ring-0"
                            >
                                {(Object.keys(PROVIDERS) as Provider[]).map(pId => (
                                    <option key={pId} value={pId}>{PROVIDERS[pId].name} KEY</option>
                                ))}
                            </select>
                            <div className="relative flex-1">
                                <input
                                    type={editingProvider === 'ollama' || showApiKey ? "text" : "password"}
                                    value={editingProvider === 'ollama' ? config.ollamaUrl : localApiKey}
                                    onChange={(e) => editingProvider === 'ollama' ? updateConfig('ollamaUrl', e.target.value) : setLocalApiKey(e.target.value)}
                                    placeholder={editingProvider === 'ollama' ? "http://localhost:11434" : `Enter API key for ${PROVIDERS[editingProvider].name}...`}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-[11px] focus:outline-none focus:border-blue-500 transition-colors"
                                />
                                {editingProvider !== 'ollama' && (
                                    <button
                                        type="button"
                                        onClick={() => setShowApiKey(!showApiKey)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400"
                                    >
                                        <Icon name={showApiKey ? "eye-slash" : "eye"} />
                                    </button>
                                )}
                            </div>
                            {editingProvider !== 'ollama' && (
                                <button
                                    onClick={() => handleSaveKey(editingProvider, localApiKey)}
                                    className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg text-[10px] font-bold uppercase transition-all"
                                >
                                    Save
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4 pt-2">
                        <div className="flex justify-between mb-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Global Temperature</label>
                            <span className="text-[10px] font-mono text-blue-400">{config.temperature}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={config.temperature}
                            onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                </div>

                {config.provider === 'ollama' && (models['ollama'] || []).length === 0 && !loadingModels['ollama'] && (
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
    );
};
