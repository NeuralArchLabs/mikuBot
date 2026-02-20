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
    const [showFloatingSave, setShowFloatingSave] = useState(false);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        // Toggle the floating button when having scrolled past the top header
        setShowFloatingSave(e.currentTarget.scrollTop > 120);
    };

    useEffect(() => {
        setLocalApiKey(config.apiKeys[editingProvider] || '');
    }, [editingProvider, config.apiKeys]);

    const handleSaveKey = (provider: Provider, key: string) => {
        updateConfig('apiKeys', { ...config.apiKeys, [provider]: key });
    };

    const currentProvider = PROVIDERS[config.provider];

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar bg-[#050810] relative" onScroll={handleScroll}>
            {/* Subdued ambient glow background */}
            <div className="absolute top-0 left-1/4 w-1/2 h-96 bg-blue-600/10 blur-[120px] pointer-events-none rounded-full" />
            <div className="absolute bottom-0 right-1/4 w-1/3 h-64 bg-purple-600/10 blur-[100px] pointer-events-none rounded-full" />

            <div className="max-w-4xl mx-auto space-y-10 relative z-10">
                {/* Header Premium Section */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/5">
                    <div>
                        <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter mb-1 select-none" style={{ textShadow: '0 4px 12px rgba(255,255,255,0.15)' }}>
                            Core System
                        </h2>
                        <p className="text-blue-400 text-[10px] md:text-xs font-bold tracking-widest uppercase select-none opacity-80">Platform Configuration & Runtime Keys</p>
                    </div>

                    <div className="grid grid-cols-2 lg:flex lg:flex-row lg:items-center gap-2 md:gap-3 bg-slate-900/40 p-2 md:p-3 rounded-2xl border border-white/5 backdrop-blur-sm shadow-xl flex-shrink-0 w-full lg:w-auto">
                        <button
                            onClick={onLoadConfig}
                            className="w-full lg:w-11 lg:h-11 min-[1150px]:w-auto min-[1150px]:h-auto py-3 px-3 lg:p-0 min-[1150px]:px-4 min-[1150px]:py-3 bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-xl text-[10px] xl:text-xs font-extrabold uppercase tracking-wider shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 lg:gap-0 min-[1150px]:gap-2 border border-emerald-500/30 whitespace-nowrap"
                            title="Auto-detect saved config, or browse for a config.json file"
                        >
                            <Icon name="download" className="text-sm xl:text-base flex-shrink-0" /> <span className="inline lg:hidden min-[1150px]:inline">Load</span>
                        </button>
                        <button
                            onClick={onExportConfig}
                            className="w-full lg:w-11 lg:h-11 min-[1150px]:w-auto min-[1150px]:h-auto py-3 px-3 lg:p-0 min-[1150px]:px-4 min-[1150px]:py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[10px] xl:text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2 lg:gap-0 min-[1150px]:gap-2 border border-slate-600 shadow-lg whitespace-nowrap"
                            title="Download current config as JSON file"
                        >
                            <Icon name="file-export" className="text-sm xl:text-base flex-shrink-0" /> <span className="inline lg:hidden min-[1150px]:inline">Export</span>
                        </button>
                        <button
                            onClick={onResetGlobal}
                            className="w-full lg:w-11 lg:h-11 min-[1150px]:w-auto min-[1150px]:h-auto py-3 px-3 lg:p-0 min-[1150px]:px-4 min-[1150px]:py-3 bg-red-950/30 hover:bg-red-900/40 text-red-400 rounded-xl text-[10px] xl:text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2 lg:gap-0 min-[1150px]:gap-2 border border-red-900/50 shadow-lg whitespace-nowrap"
                        >
                            <Icon name="history" className="text-sm xl:text-base flex-shrink-0" /> <span className="inline lg:hidden min-[1150px]:inline">Default</span>
                        </button>
                        <button
                            onClick={onSaveGlobal}
                            className="w-full lg:w-11 lg:h-11 min-[1150px]:w-auto min-[1150px]:h-auto py-3 px-3 lg:p-0 min-[1150px]:px-4 min-[1150px]:py-3 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white rounded-xl text-[10px] xl:text-xs font-extrabold uppercase tracking-wider shadow-lg shadow-blue-900/30 transition-all flex items-center justify-center gap-2 lg:gap-0 min-[1150px]:gap-2 border border-blue-500/30 whitespace-nowrap"
                        >
                            <Icon name="save" className="text-sm xl:text-base flex-shrink-0" /> <span className="inline lg:hidden min-[1150px]:inline">Save</span>
                        </button>
                    </div>
                </div>

                {/* Knowledge Base Section */}
                <div className="space-y-5">
                    <label className="text-sm font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Icon name="database" className="text-blue-500" /> Knowledge Base Pathways
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* WorkSpace */}
                        <div className="bg-slate-900/60 backdrop-blur-md p-5 rounded-2xl border border-emerald-500/20 shadow-xl relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                            <div className="flex items-center gap-4 md:gap-3 xl:gap-4 mb-5 md:mb-4 xl:mb-5">
                                <div className="w-14 h-14 md:w-12 md:h-12 lg:w-10 lg:h-10 xl:w-12 xl:h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex flex-shrink-0 items-center justify-center shadow-inner transition-all">
                                    <Icon name="box" className="text-3xl md:text-xl lg:text-lg xl:text-xl transition-all" />
                                </div>
                                <div className="truncate flex-1">
                                    <div className="text-xl md:text-base lg:text-sm xl:text-base font-black text-slate-100 tracking-wide mb-1 lg:mb-0 transition-all">WorkSpace</div>
                                    <div className="text-[11px] md:text-[9px] lg:text-[8px] xl:text-[9px] font-bold uppercase tracking-widest text-emerald-500/80 truncate transition-all">Default Directory</div>
                                </div>
                            </div>
                            <div className="text-xs font-mono text-slate-400 mb-5 truncate bg-black/40 p-3 rounded-xl border border-white/5 shadow-inner leading-relaxed" title={workSpacePathName}>
                                {workSpacePathName || "Not configured"}
                            </div>
                            <button
                                onClick={onWorkSpaceSelect}
                                disabled={syncing}
                                className="w-full py-2.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-xl text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2 border border-emerald-500/30"
                            >
                                {syncing ? <Icon name="sync fa-spin" /> : <Icon name="folder-open" />} Select
                            </button>
                        </div>

                        {/* Core Identity */}
                        <div className="bg-slate-900/60 backdrop-blur-md p-5 rounded-2xl border border-indigo-500/20 shadow-xl relative overflow-hidden group hover:border-indigo-500/40 transition-colors">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                            <div className="flex items-center gap-4 md:gap-3 xl:gap-4 mb-5 md:mb-4 xl:mb-5">
                                <div className="w-14 h-14 md:w-12 md:h-12 lg:w-10 lg:h-10 xl:w-12 xl:h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex flex-shrink-0 items-center justify-center shadow-inner transition-all">
                                    <Icon name="hdd" className="text-3xl md:text-xl lg:text-lg xl:text-xl transition-all" />
                                </div>
                                <div className="truncate flex-1">
                                    <div className="text-xl md:text-base lg:text-sm xl:text-base font-black text-slate-100 tracking-wide mb-1 lg:mb-0 transition-all">Core Engine</div>
                                    <div className="text-[11px] md:text-[9px] lg:text-[8px] xl:text-[9px] font-bold uppercase tracking-widest text-indigo-500/80 truncate transition-all">SOUL, USER, CONTEXT</div>
                                </div>
                            </div>
                            <div className="text-xs font-mono text-slate-400 mb-5 truncate bg-black/40 p-3 rounded-xl border border-white/5 shadow-inner leading-relaxed" title={corePathName}>
                                {corePathName || "Internal Defaults"}
                            </div>
                            <button
                                onClick={onCoreSelect}
                                disabled={syncing}
                                className="w-full py-2.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 rounded-xl text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2 border border-indigo-500/30"
                            >
                                {syncing ? <Icon name="sync fa-spin" /> : <Icon name="folder-open" />} Select
                            </button>
                        </div>

                        {/* Library */}
                        <div className="bg-slate-900/60 backdrop-blur-md p-5 rounded-2xl border border-pink-500/20 shadow-xl relative overflow-hidden group hover:border-pink-500/40 transition-colors">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                            <div className="flex items-center gap-4 md:gap-3 xl:gap-4 mb-5 md:mb-4 xl:mb-5">
                                <div className="w-14 h-14 md:w-12 md:h-12 lg:w-10 lg:h-10 xl:w-12 xl:h-12 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex flex-shrink-0 items-center justify-center shadow-inner transition-all">
                                    <Icon name="book" className="text-3xl md:text-xl lg:text-lg xl:text-xl transition-all" />
                                </div>
                                <div className="truncate flex-1">
                                    <div className="text-xl md:text-base lg:text-sm xl:text-base font-black text-slate-100 tracking-wide mb-1 lg:mb-0 transition-all">Library</div>
                                    <div className="text-[11px] md:text-[9px] lg:text-[8px] xl:text-[9px] font-bold uppercase tracking-widest text-pink-500/80 truncate transition-all">Auxiliary Context</div>
                                </div>
                            </div>
                            <div className="text-xs font-mono text-slate-400 mb-5 truncate bg-black/40 p-3 rounded-xl border border-white/5 shadow-inner leading-relaxed" title={extraPathName}>
                                {extraPathName || "No Links"}
                            </div>
                            <button
                                onClick={onExtraSelect}
                                disabled={syncing}
                                className="w-full py-2.5 bg-pink-600/10 hover:bg-pink-600/20 text-pink-400 rounded-xl text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2 border border-pink-500/30"
                            >
                                {syncing ? <Icon name="sync fa-spin" /> : <Icon name="folder-plus" />} Select
                            </button>
                        </div>

                        {/* Command Engine */}
                        <div className="bg-slate-900/60 backdrop-blur-md p-5 rounded-2xl border border-amber-500/20 shadow-xl relative overflow-hidden group hover:border-amber-500/40 transition-colors">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                            <div className="flex items-center gap-4 md:gap-3 xl:gap-4 mb-5 md:mb-4 xl:mb-5">
                                <div className="w-14 h-14 md:w-12 md:h-12 lg:w-10 lg:h-10 xl:w-12 xl:h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex flex-shrink-0 items-center justify-center shadow-inner transition-all">
                                    <Icon name="bolt" className="text-3xl md:text-xl lg:text-lg xl:text-xl transition-all" />
                                </div>
                                <div className="truncate flex-1">
                                    <div className="text-xl md:text-base lg:text-sm xl:text-base font-black text-slate-100 tracking-wide mb-1 lg:mb-0 transition-all">Commands</div>
                                    <div className="text-[11px] md:text-[9px] lg:text-[8px] xl:text-[9px] font-bold uppercase tracking-widest text-amber-500/80 truncate transition-all">Tools & Skills</div>
                                </div>
                            </div>
                            <div className="text-xs font-mono text-slate-400 mb-5 truncate bg-black/40 p-3 rounded-xl border border-white/5 shadow-inner leading-relaxed" title={toolsPathName}>
                                {toolsPathName || "Not configured"}
                            </div>
                            <button
                                onClick={onToolsSelect}
                                disabled={syncing}
                                className="w-full py-2.5 bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 rounded-xl text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2 border border-amber-500/30"
                            >
                                {syncing ? <Icon name="sync fa-spin" /> : <Icon name="folder-open" />} Select
                            </button>
                        </div>
                    </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                {/* Dynamic Configuration per Mode */}
                <div className="space-y-6">
                    <label className="text-sm font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Icon name="microchip" className="text-purple-400" /> Neural Orchestration Model Routing
                    </label>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Chat Configuration Card */}
                        <div className="bg-slate-900/40 backdrop-blur-md rounded-3xl p-6 border border-blue-500/20 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-blue-600 to-cyan-400 opacity-50" />

                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-500/20 p-2 rounded-xl text-blue-400 ring-1 ring-blue-500/50">
                                        <Icon name="comments" className="text-xl mx-0.5" />
                                    </div>
                                    <span className="font-black text-white tracking-tight text-lg">Chat Runtime</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {config.chatProvider !== 'ollama' && (
                                        <button
                                            onClick={() => {
                                                const key = prompt(`Enter API Key for ${PROVIDERS[config.chatProvider || 'gemini'].name}:`, config.apiKeys[config.chatProvider || 'gemini']);
                                                if (key !== null) handleSaveKey(config.chatProvider || 'gemini', key);
                                            }}
                                            className="w-8 h-8 flex items-center justify-center bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl transition-all shadow-md border border-white/5"
                                            title="Quick Key Update"
                                        >
                                            <Icon name="key" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => onTestConnection(config.chatProvider)}
                                        disabled={loadingModels[config.chatProvider || 'groq']}
                                        className="h-8 px-3 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-xl transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-wider"
                                        title="Sync models for Chat Provider"
                                    >
                                        {loadingModels[config.chatProvider || 'groq'] ? <Icon name="sync fa-spin" /> : <Icon name="sync" />} Sync
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block ml-1">Routing Provider</label>
                                    <div className="flex gap-2 bg-black/20 p-1.5 rounded-2xl border border-white/5">
                                        {(Object.keys(PROVIDERS) as Provider[]).map(pId => {
                                            const isSelected = config.chatProvider === pId;
                                            return (
                                                <button
                                                    key={pId}
                                                    onClick={() => updateConfig('chatProvider', pId)}
                                                    className={`flex-1 py-3 rounded-xl transition-all flex flex-col items-center justify-center gap-1.5 ${isSelected
                                                        ? `bg-blue-600/90 text-white shadow-lg shadow-blue-900/40 ring-1 ring-white/20`
                                                        : 'hover:bg-white/5 text-slate-400'
                                                        }`}
                                                >
                                                    {pId === 'gemini' ? (
                                                        <img src="/geminiICON.png" alt="Gemini" className={`w-6 h-6 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : 'opacity-40 grayscale hover:opacity-80'}`} />
                                                    ) : pId === 'ollama' ? (
                                                        <img src="/ollamaICON.webp" alt="Ollama" className={`w-6 h-6 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_2px_4px_rgba(255,255,255,0.2)]' : 'brightness-0 invert opacity-40 hover:opacity-80'}`} />
                                                    ) : pId === 'groq' ? (
                                                        <img src="/groqICON.png" alt="Groq" className={`w-6 h-6 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_2px_4px_rgba(255,255,255,0.2)]' : 'brightness-0 invert opacity-40 hover:opacity-80'}`} />
                                                    ) : (
                                                        <Icon name={(PROVIDERS as any)[pId]?.icon || 'robot'} className="text-lg" />
                                                    )}
                                                    <span className={`text-[9px] font-black uppercase tracking-wider ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                                                        {PROVIDERS[pId].name.split(' ')[0]}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block ml-1">Active Model</label>
                                    <div className="relative">
                                        <select
                                            value={config.chatModel}
                                            onChange={(e) => updateConfig('chatModel', e.target.value)}
                                            className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3.5 text-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none shadow-inner"
                                        >
                                            <option value="">Select Target Architecture...</option>
                                            {(models[config.chatProvider || 'groq'] || []).map(m => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                            <Icon name="chevron-down" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Agent Configuration Card */}
                        <div className="bg-slate-900/40 backdrop-blur-md rounded-3xl p-6 border border-purple-500/20 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-purple-600 to-pink-500 opacity-50" />

                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="bg-purple-500/20 p-2 rounded-xl text-purple-400 ring-1 ring-purple-500/50">
                                        <Icon name="bolt" className="text-xl mx-1" />
                                    </div>
                                    <span className="font-black text-white tracking-tight text-lg">Agent Runtime</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {config.agentProvider !== 'ollama' && (
                                        <button
                                            onClick={() => {
                                                const key = prompt(`Enter API Key for ${PROVIDERS[config.agentProvider || 'groq'].name}:`, config.apiKeys[config.agentProvider || 'groq']);
                                                if (key !== null) handleSaveKey(config.agentProvider || 'groq', key);
                                            }}
                                            className="w-8 h-8 flex items-center justify-center bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl transition-all shadow-md border border-white/5"
                                            title="Quick Key Update"
                                        >
                                            <Icon name="key" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => onTestConnection(config.agentProvider)}
                                        disabled={loadingModels[config.agentProvider || 'groq']}
                                        className="h-8 px-3 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/30 text-purple-400 rounded-xl transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-wider"
                                        title="Sync models for Agent Provider"
                                    >
                                        {loadingModels[config.agentProvider || 'groq'] ? <Icon name="sync fa-spin" /> : <Icon name="sync" />} Sync
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block ml-1">Routing Provider</label>
                                    <div className="flex gap-2 bg-black/20 p-1.5 rounded-2xl border border-white/5">
                                        {(Object.keys(PROVIDERS) as Provider[]).map(pId => {
                                            const isSelected = config.agentProvider === pId;
                                            return (
                                                <button
                                                    key={pId}
                                                    onClick={() => updateConfig('agentProvider', pId)}
                                                    className={`flex-1 py-3 rounded-xl transition-all flex flex-col items-center justify-center gap-1.5 ${isSelected
                                                        ? `bg-purple-600/90 text-white shadow-lg shadow-purple-900/40 ring-1 ring-white/20`
                                                        : 'hover:bg-white/5 text-slate-400'
                                                        }`}
                                                >
                                                    {pId === 'gemini' ? (
                                                        <img src="/geminiICON.png" alt="Gemini" className={`w-6 h-6 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : 'opacity-40 grayscale hover:opacity-80'}`} />
                                                    ) : pId === 'ollama' ? (
                                                        <img src="/ollamaICON.webp" alt="Ollama" className={`w-6 h-6 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_2px_4px_rgba(255,255,255,0.2)]' : 'brightness-0 invert opacity-40 hover:opacity-80'}`} />
                                                    ) : pId === 'groq' ? (
                                                        <img src="/groqICON.png" alt="Groq" className={`w-6 h-6 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_2px_4px_rgba(255,255,255,0.2)]' : 'brightness-0 invert opacity-40 hover:opacity-80'}`} />
                                                    ) : (
                                                        <Icon name={(PROVIDERS as any)[pId]?.icon || 'robot'} className="text-lg" />
                                                    )}
                                                    <span className={`text-[9px] font-black uppercase tracking-wider ${isSelected ? 'text-purple-100' : 'text-slate-500'}`}>
                                                        {PROVIDERS[pId].name.split(' ')[0]}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block ml-1">Active Model</label>
                                    <div className="relative">
                                        <select
                                            value={config.agentModel}
                                            onChange={(e) => updateConfig('agentModel', e.target.value)}
                                            className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-4 py-3.5 text-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/50 appearance-none shadow-inner"
                                        >
                                            <option value="">Select Target Architecture...</option>
                                            {(models[config.agentProvider || 'groq'] || []).map(m => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                            <Icon name="chevron-down" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                {/* Secure Credential Vault Section */}
                <div className="space-y-6">
                    <label className="text-sm font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Icon name="shield-alt" className="text-amber-500" /> Neural Security & Identity Vault
                    </label>

                    <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl p-8 border border-amber-700/30 shadow-[0_0_40px_rgba(251,191,36,0.05)] space-y-6 relative overflow-hidden">
                        <div className="absolute -top-32 -right-32 w-80 h-80 bg-amber-600/10 blur-3xl rounded-full" />
                        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-orange-600/10 blur-3xl rounded-full" />

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-amber-500/10 pb-4 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-900/80 to-amber-950 border border-amber-700/50 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-900/20">
                                    <Icon name="lock" className="text-xl" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-orange-400 tracking-tight">Secure Credential Vault</h3>
                                    <p className="text-xs text-amber-500/60 font-medium">Manage master logic fallbacks and encrypted API keys</p>
                                </div>
                            </div>
                            <button
                                onClick={onSaveGlobal}
                                className="hidden md:flex h-10 px-4 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white rounded-xl text-[10px] xl:text-xs font-extrabold uppercase tracking-wider shadow-lg shadow-blue-900/30 transition-all items-center justify-center gap-2 border border-blue-500/30 whitespace-nowrap"
                            >
                                <Icon name="save" className="text-sm flex-shrink-0" /> Save Global
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 relative z-10">
                            {/* Fallback Config */}
                            <div className="md:col-span-5 bg-black/40 rounded-2xl p-5 border border-white/5 flex flex-col h-full">
                                <div>
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Master Fallback Routing</h4>
                                    <div className="space-y-4">
                                        <div>
                                            <select
                                                value={config.provider}
                                                onChange={(e) => updateConfig('provider', e.target.value as Provider)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-300 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-500"
                                            >
                                                {(Object.keys(PROVIDERS) as Provider[]).map(pId => (
                                                    <option key={pId} value={pId}>{PROVIDERS[pId].name} Provider</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="relative">
                                            <select
                                                value={config.model}
                                                onChange={(e) => updateConfig('model', e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-300 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-500 appearance-none"
                                            >
                                                <option value="">Master Model Fallback...</option>
                                                {(models[config.provider] || []).map(m => (
                                                    <option key={m.id} value={m.id}>{m.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-auto pt-4">
                                    <button
                                        onClick={() => onTestConnection()}
                                        disabled={loadingModels[config.provider]}
                                        className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                                    >
                                        {loadingModels[config.provider] ? <Icon name="spinner fa-spin" /> : <Icon name="network-wired" />} Ping Master Endpoint
                                    </button>
                                </div>
                            </div>

                            {/* Keys */}
                            <div className="md:col-span-7 bg-black/40 rounded-2xl p-5 border border-white/5 flex flex-col">
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Key Management</h4>

                                <div className="flex gap-2 bg-slate-900 p-1.5 rounded-xl border border-white/5 mb-4">
                                    {(Object.keys(PROVIDERS) as Provider[]).map(pId => (
                                        <button
                                            key={pId}
                                            onClick={() => setEditingProvider(pId)}
                                            className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${editingProvider === pId ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'
                                                }`}
                                        >
                                            {PROVIDERS[pId].name.split(' ')[0]}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex-1 flex flex-col justify-center">
                                    <div className="relative flex items-center group">
                                        <div className="absolute left-6 text-slate-500 flex items-center justify-center">
                                            <Icon name={editingProvider === 'ollama' ? 'link' : 'key'} />
                                        </div>
                                        <input
                                            type={editingProvider === 'ollama' || showApiKey ? "text" : "password"}
                                            value={editingProvider === 'ollama' ? config.ollamaUrl : localApiKey}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (editingProvider === 'ollama') {
                                                    updateConfig('ollamaUrl', val);
                                                } else {
                                                    setLocalApiKey(val);
                                                    handleSaveKey(editingProvider, val);
                                                }
                                            }}
                                            placeholder={editingProvider === 'ollama' ? "http://localhost:11434" : `Bearer Token for ${PROVIDERS[editingProvider].name}`}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-14 pr-16 py-3.5 text-blue-200 font-mono text-xs text-center focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-slate-600 placeholder:tracking-wider placeholder:text-center"
                                        />
                                        <div className="absolute right-4 flex items-center gap-1">
                                            {editingProvider !== 'ollama' && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowApiKey(!showApiKey)}
                                                    className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-300 bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-600"
                                                >
                                                    <Icon name={showApiKey ? "eye-slash" : "eye"} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-6 flex flex-col gap-3 p-4 bg-slate-900/50 rounded-xl border border-white/5">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <Icon name="thermometer-half" /> Inference Temperature
                                            </label>
                                            <span className="bg-slate-800 text-blue-400 font-mono text-xs font-bold px-2 py-1 rounded-md border border-slate-700">
                                                {config.temperature.toFixed(1)}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.1"
                                            value={config.temperature}
                                            onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
                                            className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-blue-500"
                                        />
                                        <div className="flex justify-between text-[9px] text-slate-600 font-bold uppercase tracking-wider px-1">
                                            <span>Precise / Analytical</span>
                                            <span>Creative / Hallucinative</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Telegram Protocol */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 relative z-10 pt-2">
                            <div className="md:col-span-12 bg-black/40 rounded-2xl p-5 border border-white/5 flex flex-col md:flex-row gap-6">
                                <div className="md:w-1/3">
                                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <Icon name="paper-plane" /> Telegram Protocol
                                    </h4>
                                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed">Link Miku to a Telegram Bot for remote mobile interactions. Leave blank to disable.</p>
                                </div>
                                <div className="md:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">Bot Token</label>
                                        <div className="relative">
                                            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500">
                                                <Icon name="key" />
                                            </div>
                                            <input
                                                type="password"
                                                value={config.telegramBotToken || ''}
                                                onChange={(e) => updateConfig('telegramBotToken', e.target.value)}
                                                placeholder="123456789:ABCDE..."
                                                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-blue-200 font-mono text-xs focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-slate-700 placeholder:tracking-widest"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">Allowed Chat ID (Admin)</label>
                                        <div className="relative">
                                            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500">
                                                <Icon name="user-shield" />
                                            </div>
                                            <input
                                                type="text"
                                                value={config.telegramChatId || ''}
                                                onChange={(e) => updateConfig('telegramChatId', e.target.value)}
                                                placeholder="Your numeric Chat ID"
                                                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-blue-200 font-mono text-xs focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-slate-700 placeholder:tracking-widest"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={`md:hidden pt-2 pb-6 flex justify-center sticky bottom-0 z-20 pointer-events-none transition-all duration-300 ${showFloatingSave ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                    <button
                        onClick={onSaveGlobal}
                        className="pointer-events-auto w-[70%] max-w-[280px] py-3.5 bg-blue-600/50 hover:bg-blue-600/90 border border-blue-400/30 text-blue-50 hover:text-white rounded-full text-[11px] font-extrabold uppercase tracking-widest shadow-[0_4px_15px_rgba(37,99,235,0.2)] hover:shadow-[0_4px_25px_rgba(37,99,235,0.5)] backdrop-blur-md transition-all duration-300 opacity-70 hover:opacity-100 flex items-center justify-center gap-2"
                    >
                        <Icon name="save" className="text-sm flex-shrink-0" /> Save Config
                    </button>
                </div>

                {/* System Alerts */}
                {config.provider === 'ollama' && (models['ollama'] || []).length === 0 && !loadingModels['ollama'] && (
                    <div className="p-5 bg-gradient-to-r from-amber-900/40 to-amber-900/10 border border-amber-500/30 rounded-2xl text-amber-200 text-sm flex gap-4 items-center shadow-lg backdrop-blur-sm animate-pulse">
                        <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-400 border border-amber-500/20 flex-shrink-0">
                            <Icon name="exclamation-triangle" className="text-2xl" />
                        </div>
                        <div>
                            <p className="font-extrabold mb-1 tracking-tight text-amber-100">Local Neural Engine Unresponsive</p>
                            <p className="text-xs text-amber-200/70 font-medium">Verify Ollama is active on <code>{config.ollamaUrl}</code> and that at least one model is initialized in memory.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

