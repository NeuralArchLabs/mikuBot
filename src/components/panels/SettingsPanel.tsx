import React, { useState, useEffect } from 'react';
import { neuralScheduler } from '../../services';
import { AppConfig, ModelInfo, Provider } from '../../types';
import { PROVIDERS } from '../../constants';
import { Icon } from '../common/Common';
import { SchedulerTab } from './SchedulerTab';
import { SkillsPanel } from './SkillsPanel';

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
    askAlert: (message: string, position?: 'left' | 'right' | 'center') => Promise<void>;
    askConfirm: (message: string) => Promise<boolean>;
    toolsFiles: Record<string, string>;
    onSaveTools: (name: string, content: string) => Promise<boolean>;
    onUpdatePartialConfig: (updates: Partial<AppConfig>) => void;
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
    syncing,
    askAlert,
    askConfirm,
    toolsFiles,
    onSaveTools,
    onUpdatePartialConfig
}: SettingsPanelProps) => {
    const [showApiKey, setShowApiKey] = useState(false);
    // Track which provider's key we are currently editing in the global section
    const [editingProvider, setEditingProvider] = useState<Provider>(config.provider);
    const [localApiKey, setLocalApiKey] = useState('');
    const [showFloatingSave, setShowFloatingSave] = useState(false);
    const [isAtBottom, setIsAtBottom] = useState(false);
    const [settingsTab, setSettingsTab] = useState<'core' | 'skills'>('core');
    const [localModels, setLocalModels] = useState<string[]>([]);
    const [downloading, setDownloading] = useState<Record<string, number>>({});
    const [searxenaStatus, setSearxenaStatus] = useState<{ installed: boolean, envReady: boolean, running: boolean }>({ installed: false, envReady: false, running: false });
    const [startingSearxena, setStartingSearxena] = useState(false);
    const [updatingSearxena, setUpdatingSearxena] = useState(false);
    const [showSkillsBlueprints, setShowSkillsBlueprints] = useState(false);
    const [isWaving, setIsWaving] = useState(false);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        // Toggle the floating button when having scrolled past the top header
        setShowFloatingSave(e.currentTarget.scrollTop > 120);

        // Detect if user is at the bottom (with a small 10px buffer)
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        setIsAtBottom(scrollTop + clientHeight >= scrollHeight - 10);
    };

    useEffect(() => {
        setLocalApiKey(config.apiKeys[editingProvider] || '');
    }, [editingProvider, config.apiKeys]);

    useEffect(() => {
        if ((window as any).electron) {
            (window as any).electron.listVoiceModels().then((res: any) => {
                if (res.ok) setLocalModels(res.models);
            });

            const cleanup = (window as any).electron.onVoiceDownloadProgress((data: any) => {
                setDownloading(prev => ({ ...prev, [data.lang]: data.progress }));
            });

            // Initial searXena Status check
            (window as any).electron.getSearXenaStatus().then((status: any) => {
                setSearxenaStatus(status);
            });

            return cleanup;
        }
    }, []);

    const handleStartSearXena = async () => {
        if (!(window as any).electron) return;
        const isFirstTime = !searxenaStatus.envReady;
        if (isFirstTime) {
            await askAlert("☕ El motor searXena se instalará por primera vez. Esto puede tardar un minuto mientras configuramos el entorno de Python...");
        }

        setStartingSearxena(true);
        const res = await (window as any).electron.startSearXena();
        setStartingSearxena(false);

        if (res.ok) {
            await askAlert(isFirstTime ? "🚀 Entorno configurado y motor arrancado con éxito." : "✅ searXena arrancado correctamente.");
            const status = await (window as any).electron.getSearXenaStatus();
            setSearxenaStatus(status);
        } else {
            await askAlert(`❌ Error: ${res.error}`);
        }
    };

    const handleStopSearXena = async () => {
        if (!(window as any).electron) return;
        if (await askConfirm("¿Estás seguro de que deseas detener el motor searXena?")) {
            await (window as any).electron.stopSearXena();
            setSearxenaStatus(prev => ({ ...prev, running: false }));
            await askAlert("🛑 searXena se ha detenido.");
        }
    };

    const handleUpdateSearXenaEnv = async () => {
        if (!(window as any).electron) return;
        setUpdatingSearxena(true);
        const res = await (window as any).electron.updateSearXenaEnv();
        setUpdatingSearxena(false);
        
        if (res.ok) {
            await askAlert("✅ Entorno de searXena sincronizado y actualizado.");
        } else {
            await askAlert(`❌ Error al actualizar entorno: ${res.error}`);
        }
    };

    const handleDownloadModel = async (lang: 'es' | 'en') => {
        if (!(window as any).electron) return;
        setDownloading(prev => ({ ...prev, [lang]: 0 }));
        const res = await (window as any).electron.downloadVoiceModel({ lang });
        setDownloading(prev => {
            const next = { ...prev };
            delete next[lang];
            return next;
        });

        if (res.ok) {
            const listRes = await (window as any).electron.listVoiceModels();
            if (listRes.ok) setLocalModels(listRes.models);
            await askAlert(`✅ Modelo (${lang}) descargado y extraído correctamente.`);
        } else {
            await askAlert(`❌ Error al descargar modelo: ${res.error}`);
        }
    };

    const handleDeleteModel = async (modelName: string) => {
        if (!(window as any).electron) return;
        const confirm = await askConfirm(`¿Seguro que deseas eliminar el modelo ${modelName}?`);
        if (!confirm) return;

        const res = await (window as any).electron.deleteVoiceModel({ modelName });
        if (res.ok) {
            const listRes = await (window as any).electron.listVoiceModels();
            if (listRes.ok) setLocalModels(listRes.models);
        }
    };

    const handleSaveKey = (provider: Provider, key: string) => {
        updateConfig('apiKeys', { ...config.apiKeys, [provider]: key });
    };

    const currentProvider = PROVIDERS[config.provider];

    return (
        <div className={`flex-1 ${settingsTab === 'skills' ? 'lg:overflow-hidden pb-2' : 'overflow-y-auto pb-8'} p-4 md:p-8 pt-6 md:pt-10 custom-scrollbar relative`} onScroll={handleScroll}>
            {/* Subdued ambient glow background */}
            <div className="absolute top-0 left-1/4 w-1/2 h-96 bg-blue-600/10 blur-[120px] pointer-events-none rounded-full transform-gpu" />
            <div className="absolute bottom-0 right-1/4 w-1/3 h-64 bg-purple-600/10 blur-[100px] pointer-events-none rounded-full transform-gpu" />

            <div className={`mx-auto w-full relative z-10 transition-all duration-700 ease-in-out ${settingsTab === 'skills' ? 'max-w-7xl px-2 lg:px-4 space-y-0' : 'max-w-4xl space-y-10'}`}>

                {/* ── Shared Macro-Tab Header ─────────────────────────── */}
                <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-4 relative transition-all duration-500 ease-in-out`}>
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-800/80 to-transparent" />
                    <div className="flex flex-col sm:flex-row items-baseline lg:flex lg:items-baseline gap-2 md:gap-3 lg:gap-2 xl:gap-8 w-full lg:w-auto">
                        {/* Core System Tab Title */}
                        <button
                            onClick={() => setSettingsTab('core')}
                            className={`text-left transition-all duration-300 group ${settingsTab === 'core' ? '' : 'opacity-35 hover:opacity-60'}`}
                        >
                            <h2 className={`text-2xl md:text-3xl lg:text-xl xl:text-3xl font-black tracking-tighter select-none ${settingsTab === 'core' ? 'text-white text-shadow-premium animate-title-slide' : 'text-slate-400 group-hover:text-slate-200 transition-all duration-300'}`}>
                                Core System
                            </h2>
                            {settingsTab === 'core' && (
                                <p className="text-blue-400 text-[10px] md:text-xs font-bold tracking-widest uppercase select-none opacity-80 mt-0.5 animate-title-slide">Platform Configuration & Runtime Keys</p>
                            )}
                        </button>

                        {/* Separator */}
                        <div className="hidden xl:block w-px h-12 flex-shrink-0 self-center rounded-full bg-gradient-to-b from-transparent via-cyan-400/30 to-transparent" />

                        {/* Neural Skills Tab Title */}
                        <button
                            onClick={() => setSettingsTab('skills')}
                            className={`text-left transition-all duration-300 group ${settingsTab === 'skills' ? '' : 'opacity-35 hover:opacity-60'}`}
                        >
                            <h2 className={`text-2xl md:text-3xl lg:text-xl xl:text-3xl font-black tracking-tighter select-none flex items-center gap-2 ${settingsTab === 'skills' ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-teal-400 text-shadow-premium animate-title-slide' : 'text-slate-400 group-hover:text-slate-200 transition-all duration-300'}`}>
                                <Icon name="puzzle-piece" className={`text-lg ${settingsTab === 'skills' ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                                Neural Skills
                            </h2>
                            {settingsTab === 'skills' && (
                                <p className="text-cyan-500/60 text-[9px] md:text-xs font-bold tracking-widest uppercase select-none mt-0.5 animate-title-slide hidden sm:block">Synaptic Core Architecture</p>
                            )}
                        </button>
                    </div>

                    {/* Action Buttons — contextual */}
                    {settingsTab === 'core' && (
                        <div className="grid grid-cols-2 lg:flex lg:flex-row lg:items-center gap-2 md:gap-3 bg-slate-900/40 p-2 md:p-3 rounded-2xl border border-white/5 shadow-xl flex-shrink-0 w-full lg:w-auto animate-in fade-in slide-in-from-top-1 duration-700">
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
                    )}

                    {settingsTab === 'skills' && (
                        <div className="grid grid-cols-2 lg:flex lg:flex-row lg:items-center bg-slate-900/40 p-1.5 md:p-2 xl:p-3 rounded-2xl border border-white/5 shadow-xl flex-shrink-0 w-full lg:w-auto animate-in fade-in slide-in-from-top-1 duration-700 gap-1.5 xl:gap-3 transition-all duration-500 ease-in-out">
                             <button
                                onClick={() => setShowSkillsBlueprints(!showSkillsBlueprints)}
                                className={`w-full lg:w-11 min-[1150px]:w-auto h-11 xl:h-auto py-3 px-3 lg:px-4 xl:px-6 rounded-xl text-[10px] xl:text-xs font-extrabold uppercase tracking-widest transition-all duration-500 ease-in-out flex items-center justify-center gap-2 border hover:scale-105 active:scale-95 ${
                                    showSkillsBlueprints 
                                    ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)]' 
                                    : 'bg-slate-800/50 text-slate-300 border-slate-700/50 hover:bg-slate-800 hover:text-white'
                                }`}
                                title="New Directive"
                            >
                                <Icon name="plus" />
                                <span className="inline lg:hidden min-[1150px]:inline transition-all duration-500">New Directive</span>
                            </button>
                             <button
                                onClick={onSaveGlobal}
                                className="btn-halo w-full lg:w-11 min-[1150px]:w-auto h-11 xl:h-auto py-3 px-3 lg:px-4 xl:px-6 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-[10px] xl:text-xs font-extrabold uppercase tracking-widest transition-all duration-500 ease-in-out shadow-[0_0_30px_rgba(6,182,212,0.3)] flex items-center justify-center gap-2 border border-cyan-500/30 hover:scale-105 active:scale-95 group/sync"
                                title="Save Sync"
                            >
                                <Icon name="sync" className="group-hover/sync:rotate-180 transition-transform duration-500" />
                                <span className="inline lg:hidden min-[1150px]:inline transition-all duration-500">Save Sync</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Skills Tab ───────────────────────────────────── */}
                {
                    settingsTab === 'skills' && (
                        <div className="animate-in fade-in zoom-in-95 duration-200 flex flex-col h-auto lg:h-[calc(100vh-145px)]">
                            <SkillsPanel
                                config={config}
                                toolsFiles={toolsFiles}
                                onSaveTools={onSaveTools}
                                updateConfig={onUpdatePartialConfig}
                                onSaveGlobal={onSaveGlobal}
                                showBlueprints={showSkillsBlueprints}
                                setShowBlueprints={setShowSkillsBlueprints}
                            />
                        </div>
                    )
                }

                {/* ── Core System Tab ─────────────────────────────────── */}
                {
                    settingsTab === 'core' && (<div className="animate-in fade-in duration-500 space-y-10">

                        {/* Knowledge Base Section */}
                        <div className="space-y-5">
                            <label className="text-sm font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Icon name="database" className="text-blue-500" /> Neural System Pathways
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* WorkSpace */}
                                <div className="premium-card premium-emerald p-5 relative overflow-hidden group transition-all duration-500 transform-gpu">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none transform-gpu" />

                                    {/* Native Explorer Link - Absolute Corner */}
                                    {config.folderPaths?.workSpace && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const path = config.folderPaths?.workSpace;
                                                if (path) (window as any).electron?.openFolder(path);
                                            }}
                                            className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/30 text-emerald-400 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-50 border border-emerald-500/20 hover:scale-110 active:scale-95 shadow-lg"
                                            title="Open WorkSpace in Explorer"
                                        >
                                            <Icon name="external-link-alt" className="text-[10px]" />
                                        </button>
                                    )}

                                    <div className="flex items-center gap-4 md:gap-3 xl:gap-4 mb-5 md:mb-4 xl:mb-5">
                                        <div className="w-14 h-14 md:w-12 md:h-12 lg:w-10 lg:h-10 xl:w-12 xl:h-12 rounded-2xl bg-emerald-500/10 border border-transparent group-hover:border-emerald-500/30 text-emerald-400 flex flex-shrink-0 items-center justify-center shadow-inner premium-transition">
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
                                        className="w-full py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 border premium-button premium-emphasis premium-emerald text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                                    >
                                        {syncing ? <Icon name="sync fa-spin" /> : <Icon name="folder-open" />} Select
                                    </button>
                                </div>

                                {/* Core Identity */}
                                <div className="premium-card premium-indigo p-5 relative overflow-hidden group transition-all duration-500 transform-gpu">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none transform-gpu" />

                                    {/* Native Explorer Link - Absolute Corner */}
                                    {config.folderPaths?.core && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const path = config.folderPaths?.core;
                                                if (path) (window as any).electron?.openFolder(path);
                                            }}
                                            className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/30 text-indigo-400 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-50 border border-indigo-500/20 hover:scale-110 active:scale-95 shadow-lg"
                                            title="Open Core in Explorer"
                                        >
                                            <Icon name="external-link-alt" className="text-[10px]" />
                                        </button>
                                    )}

                                    <div className="flex items-center gap-4 md:gap-3 xl:gap-4 mb-5 md:mb-4 xl:mb-5">
                                        <div className="w-14 h-14 md:w-12 md:h-12 lg:w-10 lg:h-10 xl:w-12 xl:h-12 rounded-2xl bg-indigo-500/10 border border-transparent group-hover:border-indigo-500/30 text-indigo-400 flex flex-shrink-0 items-center justify-center shadow-inner premium-transition">
                                            <Icon name="hdd" className="text-3xl md:text-xl lg:text-lg xl:text-xl transition-all" />
                                        </div>
                                        <div className="truncate flex-1">
                                            <div className="text-xl md:text-base lg:text-sm xl:text-base font-black text-slate-100 tracking-wide mb-1 lg:mb-0 transition-all">Core</div>
                                            <div className="text-[11px] md:text-[9px] lg:text-[8px] xl:text-[9px] font-bold uppercase tracking-widest text-indigo-500/80 truncate transition-all">SOUL, USER, CONTEXT</div>
                                        </div>
                                    </div>
                                    <div className="text-xs font-mono text-slate-400 mb-5 truncate bg-black/40 p-3 rounded-xl border border-white/5 shadow-inner leading-relaxed" title={corePathName}>
                                        {corePathName || "Internal Defaults"}
                                    </div>
                                    <button
                                        onClick={onCoreSelect}
                                        disabled={syncing}
                                        className="w-full py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 border premium-button premium-emphasis premium-indigo text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20"
                                    >
                                        {syncing ? <Icon name="sync fa-spin" /> : <Icon name="folder-open" />} Select
                                    </button>
                                </div>

                                {/* Library */}
                                <div className="premium-card premium-pink p-5 relative overflow-hidden group transition-all duration-500 transform-gpu">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none transform-gpu" />

                                    {/* Native Explorer Link - Absolute Corner */}
                                    {config.folderPaths?.extra && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const path = config.folderPaths?.extra;
                                                if (path) (window as any).electron?.openFolder(path);
                                            }}
                                            className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-pink-500/10 hover:bg-pink-500/30 text-pink-400 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-50 border border-pink-500/20 hover:scale-110 active:scale-95 shadow-lg"
                                            title="Open Library in Explorer"
                                        >
                                            <Icon name="external-link-alt" className="text-[10px]" />
                                        </button>
                                    )}

                                    <div className="flex items-center gap-4 md:gap-3 xl:gap-4 mb-5 md:mb-4 xl:mb-5">
                                        <div className="w-14 h-14 md:w-12 md:h-12 lg:w-10 lg:h-10 xl:w-12 xl:h-12 rounded-2xl bg-pink-500/10 border border-transparent group-hover:border-pink-500/30 text-pink-400 flex flex-shrink-0 items-center justify-center shadow-inner premium-transition">
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
                                        className="w-full py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 border premium-button premium-emphasis premium-pink text-pink-400 bg-pink-500/10 hover:bg-pink-500/20"
                                    >
                                        {syncing ? <Icon name="sync fa-spin" /> : <Icon name="folder-plus" />} Select
                                    </button>
                                </div>

                                {/* Command Engine */}
                                <div className="premium-card premium-amber p-5 relative overflow-hidden group transition-all duration-500 transform-gpu">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none transform-gpu" />

                                    {/* Native Explorer Link - Absolute Corner */}
                                    {config.folderPaths?.tools && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const path = config.folderPaths?.tools;
                                                if (path) (window as any).electron?.openFolder(path);
                                            }}
                                            className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-amber-500/10 hover:bg-amber-500/30 text-amber-400 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-50 border border-amber-500/20 hover:scale-110 active:scale-95 shadow-lg"
                                            title="Open Commands in Explorer"
                                        >
                                            <Icon name="external-link-alt" className="text-[10px]" />
                                        </button>
                                    )}

                                    <div className="flex items-center gap-4 md:gap-3 xl:gap-4 mb-5 md:mb-4 xl:mb-5">
                                        <div className="w-14 h-14 md:w-12 md:h-12 lg:w-10 lg:h-10 xl:w-12 xl:h-12 rounded-2xl bg-amber-500/10 border border-transparent group-hover:border-amber-500/30 text-amber-400 flex flex-shrink-0 items-center justify-center shadow-inner premium-transition">
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
                                        className="w-full py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 border premium-button premium-emphasis premium-amber text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
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
                                <div className="premium-card premium-blue rounded-[2rem] p-6 shadow-2xl relative overflow-hidden transform-gpu group">
                                    <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-blue-600 to-cyan-400 opacity-0 group-hover:opacity-50 transition-all duration-700" />

                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-500/20 p-2 rounded-xl text-blue-400 border border-transparent group-hover:border-blue-500/40 premium-transition">
                                                <Icon name="comments" className="text-xl mx-0.5" />
                                            </div>
                                            <span className="font-black text-white tracking-tight text-lg">Chat Runtime</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div
                                                className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all shadow-md border premium-emphasis ${(config.chatProvider === 'ollama' ? (models['ollama'] || []).length > 0 : !!config.apiKeys[config.chatProvider || 'gemini'])
                                                    ? 'premium-emerald bg-emerald-500/10 text-emerald-400'
                                                    : 'bg-slate-800/80 text-slate-500 border-white/5'
                                                    }`}
                                                title={
                                                    (config.chatProvider === 'ollama' ? (models['ollama'] || []).length > 0 : !!config.apiKeys[config.chatProvider || 'gemini'])
                                                        ? "Connection/Key Active"
                                                        : "Configuration Pending"
                                                }
                                            >
                                                <Icon name={config.chatProvider === 'ollama' ? 'network-wired' : 'key'} />
                                            </div>
                                            <button
                                                onClick={() => onTestConnection(config.chatProvider)}
                                                disabled={loadingModels[config.chatProvider || 'groq']}
                                                className="h-8 px-3 bg-blue-600/10 hover:bg-blue-600/20 border-transparent text-blue-400 rounded-xl transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-wider premium-button premium-emphasis premium-blue"
                                                title="Sync models for Chat Provider"
                                            >
                                                {loadingModels[config.chatProvider || 'groq'] ? <Icon name="sync fa-spin" /> : <Icon name="sync" />} Sync
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-5">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block ml-1">Routing Provider</label>
                                            <div className="flex gap-2 premium-card !bg-black/20 p-1.5 rounded-2xl border border-white/5">
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
                                                                <img src="./geminiICON.png" alt="Gemini" className={`w-6 h-6 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : 'opacity-40 grayscale hover:opacity-80'}`} />
                                                            ) : pId === 'ollama' ? (
                                                                <img src="./ollamaICON.webp" alt="Ollama" className={`w-6 h-6 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_2px_4px_rgba(255,255,255,0.2)]' : 'brightness-0 invert opacity-40 hover:opacity-80'}`} />
                                                            ) : pId === 'groq' ? (
                                                                <img src="./groqICON.png" alt="Groq" className={`w-6 h-6 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_2px_4px_rgba(255,255,255,0.2)]' : 'brightness-0 invert opacity-40 hover:opacity-80'}`} />
                                                            ) : pId === 'zai' ? (
                                                                <img src="./zai.png" alt="Z.AI" className={`w-6 h-6 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_2px_4px_rgba(255,165,0,0.3)]' : 'brightness-0 invert opacity-40 hover:opacity-80'}`} />
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
                                                    title="Active Model for Chat"
                                                    className="w-full premium-input rounded-xl px-4 py-3.5 text-slate-200 text-xs font-medium focus:outline-none appearance-none shadow-inner"
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
                                <div className="premium-card premium-purple rounded-[2rem] p-6 shadow-2xl relative overflow-hidden transform-gpu group">
                                    <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-purple-600 to-pink-500 opacity-0 group-hover:opacity-50 transition-all duration-700" />

                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-purple-500/20 p-2 rounded-xl text-purple-400 border border-transparent group-hover:border-purple-500/40 premium-transition">
                                                <Icon name="bolt" className="text-xl mx-1" />
                                            </div>
                                            <span className="font-black text-white tracking-tight text-lg">Agent Runtime</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div
                                                className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all shadow-md border premium-emphasis ${(config.agentProvider === 'ollama' ? (models['ollama'] || []).length > 0 : !!config.apiKeys[config.agentProvider || 'groq'])
                                                    ? 'premium-emerald bg-emerald-500/10 text-emerald-400'
                                                    : 'bg-slate-800/80 text-slate-500 border-white/5'
                                                    }`}
                                                title={
                                                    (config.agentProvider === 'ollama' ? (models['ollama'] || []).length > 0 : !!config.apiKeys[config.agentProvider || 'groq'])
                                                        ? "Connection/Key Active"
                                                        : "Configuration Pending"
                                                }
                                            >
                                                <Icon name={config.agentProvider === 'ollama' ? 'network-wired' : 'key'} />
                                            </div>
                                            <button
                                                onClick={() => onTestConnection(config.agentProvider)}
                                                disabled={loadingModels[config.agentProvider || 'groq']}
                                                className="h-8 px-3 bg-purple-600/10 hover:bg-purple-600/20 border-transparent text-purple-400 rounded-xl transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-wider premium-button premium-emphasis premium-purple"
                                                title="Sync models for Agent Provider"
                                            >
                                                {loadingModels[config.agentProvider || 'groq'] ? <Icon name="sync fa-spin" /> : <Icon name="sync" />} Sync
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-5">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block ml-1">Routing Provider</label>
                                            <div className="flex gap-2 premium-card !bg-black/20 p-1.5 rounded-2xl border border-white/5">
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
                                                                <img src="./geminiICON.png" alt="Gemini" className={`w-6 h-6 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : 'opacity-40 grayscale hover:opacity-80'}`} />
                                                            ) : pId === 'ollama' ? (
                                                                <img src="./ollamaICON.webp" alt="Ollama" className={`w-6 h-6 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_2px_4px_rgba(255,255,255,0.2)]' : 'brightness-0 invert opacity-40 hover:opacity-80'}`} />
                                                            ) : pId === 'groq' ? (
                                                                <img src="./groqICON.png" alt="Groq" className={`w-6 h-6 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_2px_4px_rgba(255,255,255,0.2)]' : 'brightness-0 invert opacity-40 hover:opacity-80'}`} />
                                                            ) : pId === 'zai' ? (
                                                                <img src="./zai.png" alt="Z.AI" className={`w-6 h-6 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_2px_4px_rgba(255,165,0,0.3)]' : 'brightness-0 invert opacity-40 hover:opacity-80'}`} />
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
                                                    title="Active Model for Agent Actions"
                                                    className="w-full premium-input rounded-xl px-4 py-3.5 text-slate-200 text-xs font-medium focus:outline-none appearance-none shadow-inner"
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

                        {/* Secure Credential Vault Section - Balanced Spacing */}
                        <div className="space-y-6 pt-8 md:pt-14">
                            <label className="text-sm font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Icon name="shield-alt" className="text-amber-500" /> Neural Security & Main Engine Settings
                            </label>

                            <div className="premium-panel p-8 shadow-[0_0_40px_rgba(251,191,36,0.05)] space-y-6 relative overflow-hidden transform-gpu">
                                <div className="absolute -top-32 -right-32 w-80 h-80 bg-amber-600/10 blur-3xl rounded-full transform-gpu" />
                                <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-orange-600/10 blur-3xl rounded-full transform-gpu" />

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
                                    {/* Obsolete static save button - replaced by floating one */}
                                    {/* <button
                                        onClick={onSaveGlobal}
                                        className="hidden md:flex h-10 px-4 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white rounded-xl text-[10px] xl:text-xs font-extrabold uppercase tracking-wider shadow-lg shadow-blue-900/30 transition-all items-center justify-center gap-2 border border-blue-500/30 whitespace-nowrap"
                                    >
                                        <Icon name="save" className="text-sm flex-shrink-0" /> Save Global
                                    </button> */}
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
                                                        title="Master Fallback Provider"
                                                        className="w-full premium-input rounded-xl px-4 py-3 text-slate-300 text-xs font-medium focus:outline-none"
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
                                                        title="Master Fallback Model"
                                                        className="w-full premium-input rounded-xl px-4 py-3 text-slate-300 text-xs font-medium focus:outline-none appearance-none"
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
                                    <div className="md:col-span-7 premium-card p-5 border transition-all duration-700 flex flex-col">
                                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Key Management</h4>

                                        <div className="flex gap-2 premium-card !bg-slate-900/60 p-1.5 rounded-xl mb-4">
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
                                                <div className="absolute left-6 text-slate-500 group-hover:text-blue-300 flex items-center justify-center z-10 transition-colors">
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
                                                    className="w-full premium-input rounded-xl pl-14 pr-16 py-3.5 text-blue-200 font-mono text-xs text-center focus:outline-none transition-all placeholder:text-slate-600 placeholder:tracking-wider placeholder:text-center"
                                                />
                                                <div className="absolute right-4 flex items-center gap-1">
                                                    {editingProvider !== 'ollama' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowApiKey(!showApiKey)}
                                                            className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-300 bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-600"
                                                            title={showApiKey ? "Hide key" : "Show key"}
                                                        >
                                                            <Icon name={showApiKey ? "eye-slash" : "eye"} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-6 flex flex-col gap-3 p-4 premium-card !bg-slate-900/30">
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
                                                    title="Adjust Inference Temperature"
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
                                    <div className="md:col-span-12 premium-card premium-blue p-5 flex flex-col md:flex-row gap-6">
                                        <div className="md:w-1/3">
                                            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <Icon name="paper-plane" /> Telegram Protocol
                                            </h4>
                                            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">Link Miku to a Telegram Bot for remote mobile interactions. Leave blank to disable.</p>
                                        </div>
                                        <div className="md:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">Bot Token</label>
                                                <div className="relative group">
                                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-blue-300 z-10 transition-colors">
                                                        <Icon name="key" />
                                                    </div>
                                                    <input
                                                        type="password"
                                                        value={config.telegramBotToken || ''}
                                                        onChange={(e) => updateConfig('telegramBotToken', e.target.value)}
                                                        placeholder="123456789:ABCDE..."
                                                        className="w-full premium-input rounded-xl pl-12 pr-4 py-3 text-blue-200 font-mono text-xs focus:outline-none transition-all placeholder:text-slate-700 placeholder:tracking-widest"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">Allowed Chat ID (Admin)</label>
                                                <div className="relative group">
                                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-blue-300 z-10 transition-colors">
                                                        <Icon name="user-shield" />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={config.telegramChatId || ''}
                                                        onChange={(e) => updateConfig('telegramChatId', e.target.value)}
                                                        placeholder="Your numeric Chat ID"
                                                        className="w-full premium-input rounded-xl pl-12 pr-4 py-3 text-blue-200 font-mono text-xs focus:outline-none transition-all placeholder:text-slate-700 placeholder:tracking-widest"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                            {/* Vosk Recognition Engine Section */}
                            <div className="space-y-6 pt-6 md:pt-8">
                                <label className="text-sm font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Icon name="microphone" className="text-emerald-400" /> Vosk Recognition Engine
                                </label>

                                <div className="premium-card premium-emerald p-8 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 relative z-10">
                                        <div className="space-y-4">
                                            <h3 className="text-lg font-black text-white tracking-tight">Gestión de Modelos Vocales</h3>
                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                Descarga y selecciona modelos de reconocimiento de voz offline para procesar tus mensajes de voz.
                                            </p>

                                            <div className="flex flex-wrap gap-4 mt-4">
                                                {['es', 'en'].map(lang => {
                                                    const modelName = lang === 'es' ? 'vosk-model-small-es-0.42' : 'vosk-model-small-en-us-0.15';
                                                    const isDownloaded = localModels.some(m => m === modelName);
                                                    const isDownloading = downloading[lang] !== undefined;

                                                    return (
                                                        <div key={lang} className="flex items-center gap-2 w-full sm:w-auto">
                                                            <button
                                                                onClick={() => handleDownloadModel(lang as any)}
                                                                disabled={isDownloaded || isDownloading}
                                                                className={`flex-1 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 border premium-button premium-emphasis ${isDownloaded
                                                                    ? 'premium-emerald !bg-emerald-500/10 text-emerald-400 cursor-default'
                                                                    : isDownloading
                                                                        ? 'premium-blue !bg-blue-600/20 text-blue-400'
                                                                        : 'premium-indigo !bg-white/5 text-slate-300'
                                                                    }`}
                                                            >
                                                                <Icon name={isDownloaded ? "check-circle" : isDownloading ? "sync fa-spin" : "download"} />
                                                                {lang === 'es' ? 'Español' : 'English'} {isDownloading && `(${downloading[lang]}%)`}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block ml-1">Modelo Activo para el Usuario</label>
                                            <div className="relative">
                                                <select
                                                    value={config.voskModelPath || ''}
                                                    onChange={(e) => updateConfig('voskModelPath', e.target.value)}
                                                    title="Seleccionar modelo de voz"
                                                    className="w-full premium-input rounded-xl px-4 py-3.5 text-slate-200 text-xs font-medium focus:outline-none appearance-none shadow-inner"
                                                >
                                                    <option value="">Ninguno (Voz Desactivada)</option>
                                                    {localModels.map(m => (
                                                        <option key={m} value={m}>{m}</option>
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

                            <div className="space-y-6 pt-6 md:pt-8">
                                <div className="flex items-center justify-between pr-2">
                                    <label className="text-sm font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Icon name="search" className="text-blue-400" /> Web Search Engine
                                    </label>
                                </div>

                                <div className="premium-card premium-searxena p-8 relative overflow-hidden group">
                                    {/* Muted background gradient */}
                                    <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--sx-bg-radial)' }} />
                                    
                                    {/* Scattered Random Paw Prints (Visible on Hover - Exclusive to empty-neutral zones) */}
                                    <div className="absolute inset-0 pointer-events-none z-0">
                                        <svg className="w-full h-full opacity-30">
                                            <defs>
                                                <linearGradient id="ozenGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                                    <stop offset="0%" stopColor="#818cf8" />
                                                    <stop offset="50%" stopColor="#c084fc" />
                                                    <stop offset="100%" stopColor="#e879f9" />
                                                </linearGradient>
                                                <g id="ozen-paw-scatter">
                                                    <path d="M 0,-1 C -3,-1 -5,1 -5,4 C -5,7 -1,9 0,9 C 1,9 5,7 5,4 C 5,1 3,-1 0,-1 Z" fill="url(#ozenGrad)" />
                                                    <circle cx="-6" cy="-4" r="2.5" fill="url(#ozenGrad)" />
                                                    <circle cx="-2" cy="-8" r="2.5" fill="url(#ozenGrad)" />
                                                    <circle cx="2" cy="-8" r="2.5" fill="url(#ozenGrad)" />
                                                    <circle cx="6" cy="-4" r="2.5" fill="url(#ozenGrad)" />
                                                </g>
                                            </defs>
                                            {/* Areas away from text/buttons: Top Right, Far right, and Bottom Right around the footer */}
                                            <use href="#ozen-paw-scatter" className="xena-paw" style={{ animationDelay: '0.1s' }} x="90%" y="15%" transform="scale(0.3) rotate(-15)" />
                                            <use href="#ozen-paw-scatter" className="xena-paw" style={{ animationDelay: '0.9s' }} x="95%" y="25%" transform="scale(0.25) rotate(20)" />
                                            <use href="#ozen-paw-scatter" className="xena-paw" style={{ animationDelay: '0.4s' }} x="75%" y="10%" transform="scale(0.3) rotate(45)" />
                                            <use href="#ozen-paw-scatter" className="xena-paw" style={{ animationDelay: '1.2s' }} x="50%" y="90%" transform="scale(0.35) rotate(10)" />
                                            <use href="#ozen-paw-scatter" className="xena-paw" style={{ animationDelay: '1.5s' }} x="90%" y="85%" transform="scale(0.4) rotate(-20)" />
                                        </svg>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 relative z-10">
                                        <div className="space-y-6 relative h-full flex flex-col">
                                            <div className="space-y-5">
                                                <div className="flex items-center oy-2">
                                                    <h3 
                                                        className="text-5xl font-bold tracking-tighter transition-all duration-700 opacity-70 group-hover:opacity-100"
                                                        style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.05em' }}
                                                    >
                                                        <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 group-hover:from-indigo-400 group-hover:via-purple-400 group-hover:to-fuchsia-400 bg-clip-text text-transparent transition-all duration-700">searXena</span>
                                                    </h3>
                                                </div>
                                                
                                                <p className="text-[11px] text-slate-400 leading-relaxed max-w-sm">
                                                    Búsquedas y extracciones ilimitadas con <span className="text-indigo-300 font-bold text-[12px]">costo cero por API</span>. Un proyecto oficial de <span className="text-purple-400/80 font-bold">NeuralArchLabs</span> diseñado para agentes que requieren acceso soberano a la web sin cuotas ni rastreo.
                                                </p>
                                                
                                                <div className="flex flex-wrap items-center gap-3 pt-2">
                                                    <a 
                                                        href="http://127.0.0.1:8000" 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2 text-[10px] font-black text-slate-300 hover:text-white px-5 py-2.5 rounded-xl border border-white/5 hover:border-indigo-500/40 transition-all uppercase tracking-widest bg-white/5 hover:bg-white/10 premium-button"
                                                    >
                                                        <Icon name="external-link-alt" />
                                                        Abrir Buscador
                                                    </a>
                                                </div>
                                            </div>

                                            {/* Vertical Spacer - Captures the 'empty space' to center the mascot */}
                                            <div className="flex-1 relative min-h-[60px]">
                                                {/* Paw Walking Path Animation - Right Sequence Only */}
                                                <div className="absolute inset-0 pointer-events-none overflow-hidden group-hover:block hidden">
                                                    {/* Sequence: Right Descending (Subtle & Clean) */}
                                                    <div className="absolute top-[10%] right-[34%] rotate-[20deg] animate-paw-path" style={{ animationDelay: '0s' }}>
                                                        <Icon name="paw" className="text-[11px] text-indigo-400/20" />
                                                    </div>
                                                    <div className="absolute top-[20%] right-[28%] rotate-[-10deg] animate-paw-path" style={{ animationDelay: '0.4s' }}>
                                                        <Icon name="paw" className="text-[11px] text-indigo-400/20" />
                                                    </div>
                                                    <div className="absolute top-[32%] right-[24%] rotate-[30deg] animate-paw-path" style={{ animationDelay: '0.8s' }}>
                                                        <Icon name="paw" className="text-[11px] text-purple-400/20" />
                                                    </div>
                                                    <div className="absolute top-[42%] right-[18%] rotate-[-5deg] animate-paw-path" style={{ animationDelay: '1.2s' }}>
                                                        <Icon name="paw" className="text-[11px] text-purple-400/20" />
                                                    </div>
                                                    <div className="absolute top-[54%] right-[14%] rotate-[35deg] animate-paw-path" style={{ animationDelay: '1.6s' }}>
                                                        <Icon name="paw" className="text-[11px] text-fuchsia-400/15" />
                                                    </div>
                                                </div>

                                                {/* Mascot Layer - Centered in the spacer without pushing layout */}
                                                <div 
                                                    className="absolute inset-0 flex items-center justify-center lg:justify-start cursor-pointer select-none z-10"
                                                    onClick={() => {
                                                        if (!isWaving) {
                                                            setIsWaving(true);
                                                            setTimeout(() => setIsWaving(false), 1200);
                                                        }
                                                    }}
                                                >
                                                    <div className="w-28 h-28 md:w-32 md:h-32 opacity-15 group-hover:opacity-100 group-hover:scale-110 transition-all duration-1000 relative">
                                                        <svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" className="w-full h-full filter drop-shadow-[0_0_20px_rgba(129,140,248,0.2)]">
                                                            <g transform="translate(80, 80)">
                                                                <text x="0" y="-2" textAnchor="middle" dominantBaseline="central" fontSize="52" fontWeight="700" fill="url(#ozenGrad)"
                                                                    style={{ fontFamily: "'-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Inter', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif" }}>
                                                                    V<tspan className="xena-eye" dy="-2.5">•</tspan>
                                                                    <tspan style={{ opacity: 0 }}>ᴥ</tspan>
                                                                    <tspan className="xena-eye" dy="0">•</tspan>V
                                                                </text>
                                                                <text className={`xena-nose ${isWaving ? 'sniff-fast' : ''}`} x="0" y="6" textAnchor="middle" dominantBaseline="central" fontSize="52" fontWeight="700" fill="url(#ozenGrad)"
                                                                    style={{ fontFamily: "'-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Inter', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif" }}>
                                                                    ᴥ
                                                                </text>
                                                            </g>
                                                        </svg>

                                                        {/* Interactive Wave Paw - Positioned right next to the ear/face */}
                                                        <div className={`absolute top-1/2 -right-12 transition-all duration-700 transform ease-out pointer-events-none ${isWaving ? 'scale-110 opacity-100 -rotate-12 -translate-y-[80%]' : 'scale-0 opacity-0 rotate-45 translate-y-0'}`}>
                                                            <Icon name="paw" className="text-3xl text-indigo-400 drop-shadow-[0_0_20px_rgba(129,140,248,0.7)]" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-4 mt-auto relative z-10">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-2 rounded-full ${searxenaStatus.installed ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.4)]' : 'bg-slate-700'}`} />
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] transition-all">
                                                        {searxenaStatus.installed ? 'Motor Detectado' : 'Soberanía Desactivada'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-2 rounded-full ${searxenaStatus.running ? 'bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.4)]' : 'bg-slate-700'}`} />
                                                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">
                                                        {searxenaStatus.running ? 'Servicio Activo (8000)' : 'Servicio Detenido'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col justify-center space-y-4">
                                            <button
                                                onClick={handleStartSearXena}
                                                disabled={startingSearxena || (searxenaStatus.installed && searxenaStatus.running)}
                                                className={`w-full py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-4 border shadow-2xl premium-button premium-emphasis ${startingSearxena
                                                    ? 'premium-blue !bg-blue-600/20 text-blue-400 border-blue-500/20'
                                                    : searxenaStatus.installed && searxenaStatus.running
                                                        ? 'premium-indigo !bg-indigo-500/10 text-indigo-400 cursor-default border-indigo-500/20 shadow-indigo-500/10'
                                                        : 'premium-indigo !bg-indigo-950/80 hover:!bg-indigo-900/80 text-white shadow-indigo-900/40 border-indigo-500/20'
                                                    }`}
                                            >
                                                <Icon name={startingSearxena ? "sync fa-spin" : (!searxenaStatus.envReady ? "magic" : "rocket")} className="text-base" />
                                                {startingSearxena ? (searxenaStatus.envReady ? 'Desplegando...' : 'Configurando...') : searxenaStatus.running ? 'Motor Activo' : (!searxenaStatus.envReady ? 'Arrancar Motor' : 'Arrancar Motor')}
                                            </button>
                                            
                                            <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-4 backdrop-blur-sm">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${searxenaStatus.installed ? 'bg-[#818cf8] shadow-[0_0_8px_rgba(129,140,248,0.4)]' : 'bg-slate-700'}`} />
                                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Núcleo Local</span>
                                                    </div>
                                                    <span className="text-[9px] font-mono text-indigo-400/80 uppercase">{searxenaStatus.installed ? 'ONLINE' : 'MISSING'}</span>
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${searxenaStatus.envReady ? 'bg-[#c084fc] shadow-[0_0_8px_rgba(192,132,252,0.4)]' : 'bg-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.2)]'}`} />
                                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Entorno Base</span>
                                                    </div>
                                                    <span className="text-[9px] font-mono text-purple-400/80 uppercase">{searxenaStatus.envReady ? 'READY' : 'SETUP REQUIRED'}</span>
                                                </div>
                                                
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${searxenaStatus.running ? 'bg-[#e879f9] shadow-[0_0_8px_rgba(232,121,249,0.5)] animate-pulse' : 'bg-slate-700'}`} />
                                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Instancia Activa</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {searxenaStatus.running && (
                                                            <button 
                                                                onClick={handleStopSearXena}
                                                                title="Interrumpir Proceso"
                                                                className="w-6 h-6 flex items-center justify-center rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20 active:scale-90"
                                                            >
                                                                <Icon name="power-off" className="text-[9px]" />
                                                            </button>
                                                        )}
                                                        <span className="text-[9px] font-mono text-pink-400/80 uppercase min-w-[50px] text-right">{searxenaStatus.running ? 'ACTIVE' : 'IDLE'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <p className="text-[8px] text-slate-600 px-4 leading-tight font-black uppercase tracking-[0.1em] text-center opacity-70">
                                                {searxenaStatus.installed ? '» PROCESAMIENTO LOCAL HABILITADO' : '» MOTOR FUERA DE LÍNEA'}
                                            </p>

                                            {searxenaStatus.installed && (
                                                <div className="mt-4 pt-4 border-t border-white/5">
                                                    <button
                                                        onClick={handleUpdateSearXenaEnv}
                                                        disabled={updatingSearxena || searxenaStatus.running}
                                                        className={`w-full py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 premium-button ${updatingSearxena
                                                            ? 'premium-blue !bg-blue-600/20 text-blue-400'
                                                            : searxenaStatus.running
                                                                ? 'premium-indigo !bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-50'
                                                                : 'premium-indigo !bg-slate-800/20 text-slate-400'
                                                            }`}
                                                        title={searxenaStatus.running ? "Detén el motor antes de actualizar" : "Sincronizar librerías de Python"}
                                                    >
                                                        <Icon name={updatingSearxena ? "sync fa-spin" : "wrench"} />
                                                        {updatingSearxena ? 'Sincronizando...' : 'Sincronizar Dependencias (Update)'}
                                                    </button>
                                                    <p className="text-[8px] text-slate-500 mt-2 text-center leading-relaxed">
                                                        Usa esto si reemplazas los archivos de searXena por una versión más reciente para asegurar que las librerías necesarias estén instaladas.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                            {/* System Behavior & Integration */}
                            <div className="space-y-6 pt-4 md:pt-6">
                                <label className="text-sm font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Icon name="cog" className="text-slate-400" /> System Behavior & OS Integration
                                </label>
                                <div className="premium-card p-8 transition-all duration-700 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-slate-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-slate-500/10 transition-colors" />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                                        {/* Auto Launch */}
                                        <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-transparent hover:border-blue-500/20 transition-all group/sw">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-transparent group-hover/sw:border-blue-500/30 text-blue-400 flex items-center justify-center premium-transition">
                                                    <Icon name="rocket" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-white">Iniciar con Windows</div>
                                                    <div className="text-[10px] text-slate-500 font-medium">Arrancar Miku al iniciar el sistema</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => updateConfig('autoLaunch', !config.autoLaunch)}
                                                className={`premium-switch w-12 h-6 rounded-full relative ${config.autoLaunch ? 'bg-blue-600' : 'bg-slate-700'}`}
                                                title={config.autoLaunch ? "Desactivar inicio con Windows" : "Activar inicio con Windows"}
                                            >
                                                <div className={`premium-switch-knob absolute top-1 w-4 h-4 rounded-full bg-white shadow-md ${config.autoLaunch ? 'left-7' : 'left-1'}`} />
                                            </button>
                                        </div>

                                        {/* Minimize to Tray */}
                                        <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-transparent hover:border-indigo-500/20 transition-all group/sw">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-transparent group-hover/sw:border-indigo-500/30 text-indigo-400 flex items-center justify-center premium-transition">
                                                    <Icon name="window-minimize" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-white">Minimizar a la bandeja</div>
                                                    <div className="text-[10px] text-slate-500 font-medium">Cerrar oculta la app en la bandeja</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => updateConfig('minimizeToTray', !config.minimizeToTray)}
                                                className={`premium-switch w-12 h-6 rounded-full relative ${config.minimizeToTray ? 'bg-indigo-600' : 'bg-slate-700'}`}
                                                title={config.minimizeToTray ? "Desactivar minimizado a bandeja" : "Activar minimizado a bandeja"}
                                            >
                                                <div className={`premium-switch-knob absolute top-1 w-4 h-4 rounded-full bg-white shadow-md ${config.minimizeToTray ? 'left-7' : 'left-1'}`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                            {/* Neural Maintenance & Backup Section */}
                            <div className="space-y-6 pt-4 md:pt-6">
                                <label className="text-sm font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Icon name="tools" className="text-cyan-400" /> Neural Maintenance & Backup
                                </label>

                                <div className="premium-card premium-cyan p-8 space-y-6 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-cyan-500/10 transition-colors" />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                        <div>
                                            <h3 className="text-lg font-black text-white tracking-tight mb-2">Neural Workspace Backup</h3>
                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                Exporta una copia completa de tu entorno (configuraciones, sesiones, tareas programadas, comandos y habilidades) en un solo archivo comprimido. Ideal para migraciones o seguridad adicional.
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <button
                                                onClick={async () => {
                                                    if (!(window as any).electron) return;
                                                    const res = await (window as any).electron.exportBackup();
                                                    if (res.ok) await askAlert(`✅ Respaldo Creado\n\nEl archivo se ha guardado en:\n${res.path}`);
                                                    else if (!res.canceled) await askAlert(`❌ Error al crear respaldo: ${res.error}`);
                                                }}
                                                className="py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-2 border shadow-lg group/btn premium-button premium-emphasis premium-cyan bg-cyan-600/10 text-cyan-400"
                                            >
                                                <Icon name="archive" className="text-xl group-hover/btn:scale-110 transition-transform" />
                                                <span>Exportar Backup</span>
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (!(window as any).electron) return;
                                                    const confirm = window.confirm("⚠️ ¡ATENCIÓN! IMPORTANTE\n\nImportar un respaldo SOBREESCRIBIRÁ TODOS tus archivos actuales en el Workspace, incluyendo:\n\n• Configuraciones\n• Sesiones\n• Tareas programadas\n• Comandos y habilidades\n\nEsta acción NO SE PUEDE DESHACER.\n\n⚠️ ALERTA: El comando de PowerShell usa '-Force' que sobreescribirá archivos existentes sin preguntar nuevamente.\n\n¿Estás SEGURO de que deseas continuar?");

                                                    if (!confirm) return;

                                                    const res = await (window as any).electron.importBackup();
                                                    if (res.ok) {
                                                        await askAlert("✅ Restauración Completada\n\nTu sistema ha sido restaurado con éxito. Se recomienda reiniciar la aplicación para aplicar todos los cambios.");
                                                        window.location.reload();
                                                    } else if (!res.canceled) {
                                                        await askAlert(`❌ Error al importar respaldo: ${res.error}`);
                                                    }
                                                }}
                                                className="py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-2 border shadow-lg group/btn premium-button premium-emphasis premium-indigo bg-slate-800 text-slate-300"
                                            >
                                                <Icon name="cloud-upload-alt" className="text-xl group-hover/btn:scale-110 transition-transform" />
                                                <span>Restaurar Copia</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-4 p-4 bg-blue-950/20 border border-blue-500/20 rounded-2xl flex items-start gap-4">
                                        <Icon name="info-circle" className="text-blue-400 mt-1" />
                                        <div className="text-[10px] text-blue-200/60 leading-normal">
                                            <b className="text-blue-300">Nota de Seguridad:</b> El archivo de respaldo contiene tus <b className="text-blue-300">API Keys</b> y sesiones privadas. No compartas los archivos `.zip` generados con personas en las que no confíes.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Danger Zone: Factory Reset ─────────────────────── */}
                        <div className="pt-2">
                            <div className="premium-card premium-red p-6 bg-red-950/[0.03] hover:bg-red-950/15 border border-transparent hover:border-red-500/20 group overflow-hidden transition-all duration-700">
                                {/* Subtle Inner Glow - Appears on Hover */}
                                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 rounded-2xl bg-red-500/[0.05] border border-transparent group-hover:bg-red-500/20 group-hover:border-red-500/30 transition-all duration-500 flex items-center justify-center text-red-400/80 group-hover:text-red-400">
                                            <Icon name="exclamation-triangle" className="text-2xl animate-pulse" />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-black text-red-200/90 group-hover:text-red-100 tracking-tight mb-1 transition-colors">Factory Reset</h3>
                                            <p className="text-[10px] text-red-400/30 group-hover:text-red-400/60 font-medium leading-relaxed max-w-sm transition-colors">Reset configuration and re-run the setup wizard from scratch.</p>
                                        </div>
                                    </div>
                                    
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const first = await askConfirm(
                                                "⚠️ Esto reiniciará la configuración y forzará el asistente de instalación.\n\nTus sesiones y archivos de core NO se eliminarán, pero tus rutas y preferencias se restablecerán.\n\n¿Deseas continuar?"
                                            );
                                            if (!first) return;

                                            const second = await askConfirm(
                                                "🔴 CONFIRMACIÓN FINAL\n\n¿Estás absolutamente seguro? La aplicación se reiniciará y deberás completar el setup nuevamente."
                                            );
                                            if (!second) return;

                                            try {
                                                onUpdatePartialConfig({ isConfigured: false } as any);
                                                onSaveGlobal();
                                                await askAlert("♻️ Reiniciando aplicación...");
                                                window.location.reload();
                                            } catch (e) {
                                                await askAlert("❌ Error al reiniciar: " + (e as any)?.message);
                                            }
                                        }}
                                        className="h-11 px-6 bg-red-500/[0.02] hover:bg-red-500/15 border border-transparent hover:border-red-500/40 text-red-400/60 hover:text-red-100 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 shadow-lg hover:shadow-red-500/10 active:scale-95 group/btn"
                                    >
                                        <Icon name="redo-alt" className="text-sm group-hover/btn:rotate-[360deg] transition-all duration-700" /> 
                                        Reset & Re-run Setup
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className={`md:hidden pt-2 pb-6 flex justify-center sticky bottom-0 z-20 pointer-events-none transition-all duration-300 ${showFloatingSave ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                            <button
                                onClick={onSaveGlobal}
                                className="pointer-events-auto w-[70%] max-w-[280px] py-3.5 bg-blue-600/50 hover:bg-blue-600/90 border border-blue-400/30 text-blue-50 hover:text-white rounded-full text-[11px] font-extrabold uppercase tracking-widest shadow-[0_4px_15px_rgba(37,99,235,0.2)] hover:shadow-[0_4px_25px_rgba(37,99,235,0.5)] transition-all duration-300 opacity-70 hover:opacity-100 flex items-center justify-center gap-2"
                            >
                                <Icon name="save" className="text-sm flex-shrink-0" /> Save Config
                            </button>
                        </div>

                        {/* Floating Save Button - Desktop (Organic & Liquid Design) */}
                        <div className={`hidden md:flex pt-2 pb-10 justify-center sticky bottom-0 z-30 pointer-events-none transition-all duration-1000 ${showFloatingSave ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                            <div className="relative group">
                                {/* Ambient Soft Glow */}
                                <div className="absolute -inset-4 bg-blue-500/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition duration-1000" />

                                <button
                                    onClick={onSaveGlobal}
                                    className={`pointer-events-auto h-12 bg-slate-950/20 hover:bg-slate-900/40 border border-white/5 hover:border-blue-500/20 text-slate-500 hover:text-blue-200 rounded-full transition-all duration-700 ease-in-out flex items-center justify-center shadow-[0_10px_40px_rgba(0,0,0,0.3)] backdrop-blur-2xl group relative overflow-hidden premium-button px-0 ${isAtBottom ? 'w-36 px-6' : 'w-12 group-hover:w-36 group-hover:px-6'}`}
                                    title="Save All Global Settings"
                                >
                                    {/* Liquid Shine Effect */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />

                                    <div className="flex items-center gap-0 group-hover:gap-2.5 transition-all duration-500">
                                        <Icon name="save" className={`text-lg relative z-10 transition-all duration-500 ${isAtBottom ? 'text-blue-400/80' : ''}`} />
                                        <span className={`max-w-0 opacity-0 overflow-hidden transition-all duration-500 font-medium uppercase tracking-[0.2em] text-[10px] whitespace-nowrap relative z-10 ${isAtBottom ? 'max-w-[80px] opacity-100 ml-2.5' : 'group-hover:max-w-[80px] group-hover:opacity-100'}`}>
                                            Save
                                        </span>
                                    </div>

                                    {/* Organic Highlight (Soft Gradient, not a sharp line) */}
                                    <div className={`absolute bottom-0 inset-x-8 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent transition-opacity duration-700 ${isAtBottom ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                                </button>
                            </div>
                        </div>

                        {/* System Alerts */}
                        {config.provider === 'ollama' && (models['ollama'] || []).length === 0 && !loadingModels['ollama'] && (
                            <div className="p-5 bg-gradient-to-r from-amber-900/40 to-amber-900/10 border border-amber-500/30 rounded-2xl text-amber-200 text-sm flex gap-4 items-center shadow-lg animate-pulse">
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
                )}
            </div>
        </div>
    );
};
