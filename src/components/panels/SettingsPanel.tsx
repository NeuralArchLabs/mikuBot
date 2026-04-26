import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import './SettingsPanel.css';
import { neuralScheduler } from '../../services';
import { AppConfig, ModelInfo, Provider } from '../../types';
import { PROVIDERS } from '../../constants';
import { Icon, ModernSelect, SelectOption } from '../common/Common';
import { THEMES } from '../../constants/themes';
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
    onRootSelect: () => void;
    onSaveGlobal: (silent?: boolean, extraConfig?: Partial<AppConfig>) => Promise<any>;
    onResetGlobal: () => void;
    onLoadConfig: () => void;
    onExportConfig: () => void;
    corePathName: string;
    extraPathName: string;
    workSpacePathName: string;
    toolsPathName: string;
    rootPathName: string;
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
    onRootSelect,
    onSaveGlobal,
    onResetGlobal,
    onLoadConfig,
    onExportConfig,
    corePathName,
    extraPathName,
    workSpacePathName,
    toolsPathName,
    rootPathName,
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
    const [showBackgroundGallery, setShowBackgroundGallery] = useState(false);

    const onSyncModelArchitectures = () => {
        onTestConnection(config.provider === 'ollama' ? 'ollama' : config.provider);
    };
    const [showSkillsBlueprints, setShowSkillsBlueprints] = useState(false);
    const [isWaving, setIsWaving] = useState(false);
    const { t, i18n } = useTranslation();

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
            await askAlert(t('settings.searxena_alerts.installing'));
        }

        setStartingSearxena(true);
        const res = await (window as any).electron.startSearXena();
        setStartingSearxena(false);

        if (res.ok) {
            await askAlert(isFirstTime ? t('settings.searxena_alerts.started_first') : t('settings.searxena_alerts.started'));
            const status = await (window as any).electron.getSearXenaStatus();
            setSearxenaStatus(status);
        } else {
            await askAlert(`❌ Error: ${res.error}`);
        }
    };

    const handleStopSearXena = async () => {
        if (!(window as any).electron) return;
        if (await askConfirm(t('settings.searxena_alerts.stop_confirm'))) {
            await (window as any).electron.stopSearXena();
            setSearxenaStatus(prev => ({ ...prev, running: false }));
            await askAlert(t('settings.searxena_alerts.stopped'));
        }
    };

    const handleUpdateSearXenaEnv = async () => {
        if (!(window as any).electron) return;
        setUpdatingSearxena(true);
        const res = await (window as any).electron.updateSearXenaEnv();
        setUpdatingSearxena(false);

        if (res.ok) {
            await askAlert(t('settings.searxena_alerts.sync_success'));
        } else {
            await askAlert(`${t('settings.searxena_alerts.sync_error')}${res.error}`);
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
            await askAlert(t('dialogs.voice_model_downloaded', { lang }));
        } else {
            await askAlert(t('dialogs.voice_model_error', { error: res.error }));
        }
    };

    const handleDeleteModel = async (modelName: string) => {
        if (!(window as any).electron) return;
        const confirm = await askConfirm(t('dialogs.voice_model_delete_confirm', { name: modelName }));
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
        <div className={`settings-panel-content theme-${config.theme} flex-1 ${settingsTab === 'skills' ? 'flex flex-col overflow-hidden pb-2' : 'overflow-y-auto pb-6'} p-3 md:p-6 pt-4 md:pt-6 custom-scrollbar relative`} onScroll={handleScroll}>
            {/* Subdued ambient glow background */}
            <div className="absolute top-0 left-1/4 w-1/2 h-96 bg-[var(--primary-color)] opacity-[0.07] blur-[120px] pointer-events-none rounded-full transform-gpu" />
            <div className="absolute bottom-0 right-1/4 w-1/3 h-64 bg-purple-600/05 blur-[100px] pointer-events-none rounded-full transform-gpu" />

            <div className={`mx-auto w-full relative z-10 transition-all duration-700 ease-in-out ${settingsTab === 'skills' ? 'flex-1 min-h-0 flex flex-col max-w-7xl px-2 lg:px-4' : 'max-w-4xl space-y-6'}`}>

                {/* ── Shared Macro-Tab Header ─────────────────────────── */}
                <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 relative transition-all duration-500 ease-in-out`}>
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent" />
                    <div className="flex flex-col sm:flex-row items-baseline lg:flex lg:items-baseline gap-2 md:gap-2 lg:gap-2 xl:gap-4 w-full lg:w-auto">
                        {/* Core System Tab Title */}
                        <button
                            onClick={() => setSettingsTab('core')}
                            className={`text-left flex flex-col items-start transition-all duration-300 group ${settingsTab === 'core' ? '' : 'opacity-40 hover:opacity-100'}`}
                        >
                            <h2 className={`text-2xl md:text-3xl lg:text-xl xl:text-3xl font-black tracking-tighter select-none ${settingsTab === 'core' ? 'text-[var(--text-primary)] text-shadow-premium animate-title-slide' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-all duration-300'}`}>
                                {t('settings.tabs.core')}
                            </h2>
                            {settingsTab === 'core' && (
                                <p className="text-[var(--primary-color)] text-[10px] md:text-xs font-bold tracking-widest uppercase select-none opacity-80 mt-0.5 animate-title-slide">{t('settings.tabs.core_desc')}</p>
                            )}
                        </button>

                        {/* Separator */}
                        <div className={`hidden xl:block w-px h-8 flex-shrink-0 self-center rounded-full bg-gradient-to-b from-transparent transition-colors duration-500 ${settingsTab === 'skills' ? 'via-cyan-400/30' : 'via-[var(--border-color)]'} to-transparent`} />

                        {/* Neural Skills Tab Title */}
                        <button
                            onClick={() => setSettingsTab('skills')}
                            className={`text-left transition-all duration-300 group flex items-baseline gap-2 lg:gap-3 ${settingsTab === 'skills' ? '' : 'opacity-40 hover:opacity-100'}`}
                        >
                            <div className="flex-shrink-0 self-baseline">
                                <Icon name="puzzle-piece" className={`text-xl lg:text-lg xl:text-xl transform -translate-y-[3px] lg:-translate-y-[3.5px] ${settingsTab === 'skills' ? 'text-cyan-400' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`} />
                            </div>
                            <div className="flex flex-col">
                                <h2 className={`text-2xl md:text-3xl lg:text-xl xl:text-3xl font-black tracking-tighter select-none ${settingsTab === 'skills' ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-teal-400 text-shadow-premium animate-title-slide' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-all duration-300'}`}>
                                    {t('settings.tabs.skills')}
                                </h2>
                                {settingsTab === 'skills' && (
                                    <p className="text-cyan-500/60 text-[9px] md:text-xs font-bold tracking-widest uppercase select-none mt-0.5 animate-title-slide hidden sm:block leading-none">
                                        {t('settings.tabs.skills_desc')}
                                    </p>
                                )}
                            </div>
                        </button>
                    </div>

                    {/* Action Buttons — contextual */}
                    {settingsTab === 'core' && (
                        <div className="grid grid-cols-2 lg:flex lg:flex-row lg:items-center gap-2 md:gap-2 bg-[var(--surface-color)] p-1.5 md:p-2 rounded-2xl border border-transparent shadow-xl flex-shrink-0 w-full lg:w-auto animate-in fade-in slide-in-from-top-1 duration-700">
                            <button
                                onClick={onLoadConfig}
                                className="w-full lg:w-11 lg:h-11 min-[1150px]:w-auto min-[1150px]:h-auto py-3 px-3 lg:p-0 min-[1150px]:px-4 min-[1150px]:py-3 bg-[var(--hover-color)] hover:bg-[var(--primary-color)]/20 text-[var(--primary-color)] rounded-xl text-[10px] xl:text-xs font-extrabold uppercase tracking-wider shadow-lg shadow-[var(--primary-color)]/10 transition-all flex items-center justify-center gap-2 lg:gap-0 min-[1150px]:gap-2 border border-transparent hover:border-[var(--primary-color)]/40 whitespace-nowrap"
                                title={t('settings.actions.load')}
                            >
                                <Icon name="download" className="text-sm xl:text-base flex-shrink-0" /> <span className="inline lg:hidden min-[1150px]:inline">{t('settings.actions.load')}</span>
                            </button>
                            <button
                                onClick={onExportConfig}
                                className="w-full lg:w-11 lg:h-11 min-[1150px]:w-auto min-[1150px]:h-auto py-3 px-3 lg:p-0 min-[1150px]:px-4 min-[1150px]:py-3 bg-[var(--hover-color)] hover:bg-[var(--surface-color)] text-[var(--text-secondary)] rounded-xl text-[10px] xl:text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2 lg:gap-0 min-[1150px]:gap-2 border border-transparent hover:border-[var(--border-color)] shadow-lg whitespace-nowrap"
                                title={t('settings.actions.export')}
                            >
                                <Icon name="upload" className="text-sm xl:text-base flex-shrink-0" /> <span className="inline lg:hidden min-[1150px]:inline">{t('settings.actions.export')}</span>
                            </button>
                            <button
                                onClick={onResetGlobal}
                                title={t('settings.actions.default')}
                                className="w-full lg:w-11 lg:h-11 min-[1150px]:w-auto min-[1150px]:h-auto py-3 px-3 lg:p-0 min-[1150px]:px-4 min-[1150px]:py-3 bg-[var(--hover-color)] hover:bg-red-500/10 text-[var(--text-secondary)] hover:text-red-400 rounded-xl text-[10px] xl:text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2 lg:gap-0 min-[1150px]:gap-2 border border-transparent hover:border-red-500/40 shadow-lg whitespace-nowrap"
                            >
                                <Icon name="history" className="text-sm xl:text-base flex-shrink-0" /> <span className="inline lg:hidden min-[1150px]:inline">{t('settings.actions.default')}</span>
                            </button>
                            <button
                                onClick={onSaveGlobal}
                                className="w-full lg:w-11 lg:h-11 min-[1150px]:w-auto min-[1150px]:h-auto py-3 px-3 lg:p-0 min-[1150px]:px-4 min-[1150px]:py-3 bg-gradient-to-br from-[var(--primary-color)] to-[var(--secondary-color)] hover:brightness-110 text-white rounded-xl text-[10px] xl:text-xs font-extrabold uppercase tracking-wider shadow-lg shadow-[var(--primary-color)]/30 transition-all flex items-center justify-center gap-2 lg:gap-0 min-[1150px]:gap-2 border-0 whitespace-nowrap"
                            >
                                <Icon name="save" className="text-sm xl:text-base flex-shrink-0" /> <span className="inline lg:hidden min-[1150px]:inline">{t('settings.actions.save')}</span>
                            </button>
                        </div>
                    )}

                    {settingsTab === 'skills' && (
                        <div className="grid grid-cols-2 lg:flex lg:flex-row lg:items-center bg-[var(--surface-color)] p-1.5 md:p-2 xl:p-3 rounded-2xl border border-transparent hover:border-[var(--border-color)] shadow-xl flex-shrink-0 w-full lg:w-auto animate-in fade-in slide-in-from-top-1 duration-700 gap-1.5 xl:gap-3 transition-all duration-500 ease-in-out overflow-hidden">
                            <button
                                onClick={() => setShowSkillsBlueprints(!showSkillsBlueprints)}
                                className={`w-full lg:w-11 min-[1150px]:w-auto h-11 xl:h-auto py-3 px-3 lg:px-4 xl:px-6 rounded-xl text-[10px] xl:text-xs font-extrabold uppercase tracking-widest transition-all duration-500 ease-in-out flex items-center justify-center gap-2 border lg:hover:scale-105 lg:active:scale-95 shadow-md ${showSkillsBlueprints
                                    ? 'bg-cyan-500 text-black border-transparent shadow-[0_0_20px_rgba(6,182,212,0.4)]'
                                    : 'bg-[var(--hover-color)] text-[var(--text-secondary)] border-transparent hover:bg-[var(--surface-color)] hover:text-[var(--text-primary)] hover:border-[var(--border-color)] hover:shadow-cyan-900/10'
                                    }`}
                                title={t('settings.actions.new_directive')}
                            >
                                <Icon name="plus" />
                                <span className="inline lg:hidden min-[1150px]:inline transition-all duration-500">{t('settings.actions.new_directive')}</span>
                            </button>
                            <button
                                onClick={onSaveGlobal}
                                className="btn-halo w-full lg:w-11 min-[1150px]:w-auto h-11 xl:h-auto py-3 px-3 lg:px-4 xl:px-6 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-[10px] xl:text-xs font-extrabold uppercase tracking-widest transition-all duration-500 ease-in-out shadow-lg shadow-cyan-900/40 hover:shadow-[0_0_40px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 border !border-transparent hover:!border-cyan-500/40 lg:hover:scale-105 lg:active:scale-95 group/sync focus:outline-none"
                                title={t('settings.actions.save')}
                            >
                                <Icon name="save" className="group-hover/sync:animate-pulse" />
                                <span className="inline lg:hidden min-[1150px]:inline transition-all duration-500">{t('settings.actions.save')}</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Skills Tab ───────────────────────────────────── */}
                {
                    settingsTab === 'skills' && (
                        <div className="animate-in fade-in zoom-in-95 duration-200 flex flex-col flex-1 min-h-0">
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
                    settingsTab === 'core' && (<div className="animate-in fade-in duration-500 space-y-6">

                        {/* Language Selection Section */}
                        <div className="space-y-3">
                            <div className="premium-card p-5 flex items-center justify-between gap-6">
                                <div className="space-y-1">
                                    <div className="text-sm font-black text-[var(--text-primary)]">{t('settings.language_select')}</div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{t('settings.language_desc')}</div>
                                </div>
                                <div className="flex gap-2 bg-black/20 p-1.5 rounded-2xl border border-white/5">
                                    {[
                                        { id: 'es', label: 'Español' },
                                        { id: 'en', label: 'English' },
                                        { id: 'zh', label: '中文' }
                                    ].map(lang => (
                                        <button
                                            key={lang.id}
                                            onClick={() => updateConfig('language', lang.id)}
                                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(config.language || 'es') === lang.id
                                                ? 'bg-[var(--primary-color)] text-white shadow-lg shadow-[var(--primary-color)]/40'
                                                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                                }`}
                                        >
                                            {lang.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                        {/* Appearance Section */}
                        <div className="space-y-4">
                            <label className="text-sm font-black text-[var(--text-primary)] uppercase tracking-[0.2em] flex items-center gap-2">
                                <Icon name="palette" className="text-[var(--primary-color)]" /> {t('settings.appearance.title', 'Appearance')}
                            </label>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                {/* Theme Selection */}
                                <div className="premium-card p-6 space-y-4">
                                    <div className="flex flex-col gap-1">
                                        <div className="text-sm font-black text-[var(--text-primary)]">{t('settings.appearance.theme', 'System Theme')}</div>
                                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{t('settings.appearance.theme_desc', 'Change the visual vibe of your assistant')}</div>
                                    </div>

                                    <div className="flex flex-row items-center justify-between gap-2 sm:gap-3 w-full">
                                        {Object.entries(THEMES).map(([id, themeData]) => {
                                            let gradient = `linear-gradient(135deg, ${themeData['--primary-color']}, ${themeData['--secondary-color']}, ${themeData['--background-color']})`;

                                            // Theme-specific dominance overrides
                                            if (id === 'miku') {
                                                gradient = `linear-gradient(135deg, ${THEMES.cloud['--primary-color']} 0%, ${THEMES.cloud['--primary-color']} 65%, ${themeData['--primary-color']} 100%)`;
                                            } else if (id === 'midnight') {
                                                gradient = `linear-gradient(135deg, #000000 0%, #0c1a40 45%, ${themeData['--background-color']} 100%)`;
                                            } else if (id === 'cloud') {
                                                gradient = `linear-gradient(135deg, #ffffff 0%, #ffffff 60%, ${themeData['--primary-color']} 100%)`;
                                            } else if (id === 'cyberpunk') {
                                                gradient = `linear-gradient(135deg, ${themeData['--background-color']} 0%, ${themeData['--background-color']} 55%, ${themeData['--primary-color']} 100%)`;
                                            }

                                            return (
                                                <button
                                                    key={id}
                                                    onClick={() => updateConfig('theme', id)}
                                                    className={`group relative flex-1 xl:flex-initial flex flex-col items-center justify-center gap-2 p-3 sm:p-4 xl:p-2 rounded-2xl xl:rounded-xl transition-all duration-500 border-2 min-h-[90px] sm:min-h-[110px] xl:min-h-0 xl:min-w-[68px] max-w-[160px] xl:max-w-none ${(config.theme || 'miku') === id
                                                        ? 'bg-white/10 border-[var(--primary-color)] shadow-[0_0_25px_-5px_rgba(6,182,212,0.3)] scale-[1.02] xl:scale-100'
                                                        : 'bg-black/20 border-transparent hover:bg-white/5 hover:border-white/10'
                                                        }`}
                                                >
                                                    <div
                                                        className="w-10 h-10 sm:w-14 sm:h-14 xl:w-12 xl:h-12 rounded-full border border-white/10 relative overflow-hidden transform-gpu group-hover:scale-110 transition-all duration-500 shadow-xl"
                                                        style={{
                                                            boxShadow: `0 10px 25px -5px ${themeData['--primary-color']}80`
                                                        }}
                                                    >
                                                        <div
                                                            className="absolute inset-0 scale-[1.25]"
                                                            style={{ background: gradient }}
                                                        />
                                                    </div>
                                                    <span className={`text-[8px] sm:text-[10px] xl:text-[9px] font-black uppercase tracking-[0.15em] xl:tracking-tighter ${(config.theme || 'miku') === id ? 'text-[var(--primary-color)]' : 'text-slate-500 group-hover:text-slate-300'
                                                        }`}>
                                                        {id}
                                                    </span>
                                                    {(config.theme || 'miku') === id && (
                                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-[var(--primary-color)] rounded-full blur-[1px]" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Typography & Background */}
                                <div className="premium-card p-6 space-y-5">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block ml-1">{t('settings.appearance.chat_font', 'Chat Font')}</label>
                                            <ModernSelect
                                                value={config.chatFont || 'Outfit'}
                                                onChange={(val) => updateConfig('chatFont', val)}
                                                options={[
                                                    { value: 'Outfit', label: 'Outfit (Default)', style: { fontFamily: 'Outfit' } },
                                                    // Sans-Serif
                                                    { value: 'Inter', label: 'Inter', style: { fontFamily: 'Inter' } },
                                                    { value: 'Montserrat', label: 'Montserrat', style: { fontFamily: 'Montserrat' } },
                                                    { value: 'Roboto', label: 'Roboto', style: { fontFamily: 'Roboto' } },
                                                    { value: 'Questrial', label: 'Questrial', style: { fontFamily: 'Questrial' } },
                                                    { value: 'Comfortaa', label: 'Comfortaa', style: { fontFamily: 'Comfortaa' } },
                                                    // Serif
                                                    { value: 'Playfair Display', label: 'Playfair Display', style: { fontFamily: 'Playfair Display' } },
                                                    { value: 'Lora', label: 'Lora', style: { fontFamily: 'Lora' } },
                                                    { value: 'Merriweather', label: 'Merriweather', style: { fontFamily: 'Merriweather' } },
                                                    // Monospace
                                                    { value: 'JetBrains Mono', label: 'JetBrains Mono', style: { fontFamily: 'JetBrains Mono' } },
                                                    { value: 'Fira Code', label: 'Fira Code', style: { fontFamily: 'Fira Code' } },
                                                    // Decorative
                                                    { value: 'Orbitron', label: 'Orbitron (Futuristic)', style: { fontFamily: 'Orbitron' } },
                                                    { value: 'Sacramento', label: 'Sacramento (Script)', style: { fontFamily: 'Sacramento' } },
                                                    { value: 'Architects Daughter', label: 'Architects Daughter', style: { fontFamily: 'Architects Daughter' } }
                                                ]}
                                                title="Font"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block ml-1">{t('settings.appearance.chat_bg', 'Chat Background URL')}</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={config.chatBackgroundImage || ''}
                                                    onChange={(e) => updateConfig('chatBackgroundImage', e.target.value)}
                                                    placeholder="https://example.com/image.jpg"
                                                    className="flex-1 bg-[var(--surface-color)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all shadow-inner"
                                                />
                                                <button
                                                    onClick={() => setShowBackgroundGallery(true)}
                                                    className="px-4 h-10 rounded-xl bg-[var(--primary-color)]/10 hover:bg-[var(--primary-color)]/20 text-[var(--primary-color)] text-[10px] font-black uppercase tracking-widest transition-all border !border-transparent hover:!border-[var(--primary-color)]/30 flex items-center gap-2 focus:outline-none"
                                                    title={t('settings.appearance.open_gallery_desc')}
                                                >
                                                    <Icon name="images" />
                                                    <span>{t('settings.appearance.backgrounds', 'Fondos')}</span>
                                                </button>
                                                {config.chatBackgroundImage && (
                                                    <button
                                                        onClick={() => updateConfig('chatBackgroundImage', '')}
                                                        className="w-10 h-10 rounded-xl flex items-center justify-center transition-all bg-red-500/25 hover:bg-red-500/35 text-red-500 border !border-transparent hover:!border-red-500/30 focus:outline-none"
                                                        title={t('common.clear', 'Clear Background')}
                                                        aria-label={t('common.clear', 'Clear Background')}
                                                    >
                                                        <Icon name="times" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent" />

                        {/* Knowledge Base Section */}
                        <div className="space-y-3">
                            <label className="text-sm font-black text-[var(--text-primary)] uppercase tracking-[0.2em] flex items-center gap-2">
                                <Icon name="database" className="text-[var(--primary-color)]" /> {t('settings.pathways.title')}
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
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

                                    <div className="flex items-center gap-4 md:gap-3 xl:gap-4 mb-3 md:mb-2 xl:mb-3">
                                        <div className="w-14 h-14 md:w-12 md:h-12 lg:w-10 lg:h-10 xl:w-12 xl:h-12 rounded-2xl bg-emerald-500/10 border border-transparent group-hover:border-emerald-500/30 text-emerald-400 flex flex-shrink-0 items-center justify-center shadow-inner premium-transition">
                                            <Icon name="box" className="text-3xl md:text-xl lg:text-lg xl:text-xl transition-all" />
                                        </div>
                                        <div className="truncate flex-1">
                                            <div className="text-xl md:text-base lg:text-sm xl:text-base font-black text-[var(--text-primary)] tracking-wide mb-1 lg:mb-0 transition-all">{t('settings.pathways.workspace')}</div>
                                            <div className="text-[11px] md:text-[9px] lg:text-[8px] xl:text-[9px] font-bold uppercase tracking-widest text-emerald-500/80 truncate transition-all">{t('settings.pathways.workspace_desc')}</div>
                                        </div>
                                    </div>
                                    <div className="text-xs font-mono text-[var(--text-secondary)] mb-5 truncate bg-[var(--hover-color)] p-3 rounded-xl border border-[var(--border-color)] leading-relaxed" title={workSpacePathName}>
                                        {workSpacePathName || "Not configured"}
                                    </div>
                                    <button
                                        onClick={onWorkSpaceSelect}
                                        disabled={syncing}
                                        className="w-full py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 border premium-button premium-emphasis premium-emerald text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                                    >
                                        {syncing ? <Icon name="sync fa-spin" /> : <Icon name="folder-plus" />} {t('settings.pathways.select')}
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

                                    <div className="flex items-center gap-4 md:gap-3 xl:gap-4 mb-3 md:mb-2 xl:mb-3">
                                        <div className="w-14 h-14 md:w-12 md:h-12 lg:w-10 lg:h-10 xl:w-12 xl:h-12 rounded-2xl bg-indigo-500/10 border border-transparent group-hover:border-indigo-500/30 text-indigo-400 flex flex-shrink-0 items-center justify-center shadow-inner premium-transition">
                                            <Icon name="hdd" className="text-3xl md:text-xl lg:text-lg xl:text-xl transition-all" />
                                        </div>
                                        <div className="truncate flex-1">
                                            <div className="text-xl md:text-base lg:text-sm xl:text-base font-black text-[var(--text-primary)] tracking-wide mb-1 lg:mb-0 transition-all">{t('settings.pathways.core')}</div>
                                            <div className="text-[11px] md:text-[9px] lg:text-[8px] xl:text-[9px] font-bold uppercase tracking-widest text-indigo-500/80 truncate transition-all">{t('settings.pathways.core_desc')}</div>
                                        </div>
                                    </div>
                                    <div className="text-xs font-mono text-[var(--text-secondary)] mb-5 truncate bg-[var(--hover-color)] p-3 rounded-xl border border-[var(--border-color)] leading-relaxed" title={corePathName}>
                                        {corePathName || "Internal Defaults"}
                                    </div>
                                    <button
                                        onClick={onCoreSelect}
                                        disabled={syncing}
                                        className="w-full py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 border premium-button premium-emphasis premium-indigo text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20"
                                    >
                                        {syncing ? <Icon name="sync fa-spin" /> : <Icon name="folder-plus" />} {t('settings.pathways.select')}
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

                                    <div className="flex items-center gap-4 md:gap-3 xl:gap-4 mb-3 md:mb-2 xl:mb-3">
                                        <div className="w-14 h-14 md:w-12 md:h-12 lg:w-10 lg:h-10 xl:w-12 xl:h-12 rounded-2xl bg-pink-500/10 border border-transparent group-hover:border-pink-500/30 text-pink-400 flex flex-shrink-0 items-center justify-center shadow-inner premium-transition">
                                            <Icon name="book" className="text-3xl md:text-xl lg:text-lg xl:text-xl transition-all" />
                                        </div>
                                        <div className="truncate flex-1">
                                            <div className="text-xl md:text-base lg:text-sm xl:text-base font-black text-[var(--text-primary)] tracking-wide mb-1 lg:mb-0 transition-all">{t('settings.pathways.library')}</div>
                                            <div className="text-[11px] md:text-[9px] lg:text-[8px] xl:text-[9px] font-bold uppercase tracking-widest text-pink-500/80 truncate transition-all">{t('settings.pathways.library_desc')}</div>
                                        </div>
                                    </div>
                                    <div className="text-xs font-mono text-[var(--text-secondary)] mb-5 truncate bg-[var(--hover-color)] p-3 rounded-xl border border-[var(--border-color)] leading-relaxed" title={extraPathName}>
                                        {extraPathName || "No Links"}
                                    </div>
                                    <button
                                        onClick={onExtraSelect}
                                        disabled={syncing}
                                        className="w-full py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 border premium-button premium-emphasis premium-pink text-pink-400 bg-pink-500/10 hover:bg-pink-500/20"
                                    >
                                        {syncing ? <Icon name="sync fa-spin" /> : <Icon name="folder-plus" />} {t('settings.pathways.select')}
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

                                    <div className="flex items-center gap-4 md:gap-3 xl:gap-4 mb-3 md:mb-2 xl:mb-3">
                                        <div className="w-14 h-14 md:w-12 md:h-12 lg:w-10 lg:h-10 xl:w-12 xl:h-12 rounded-2xl bg-amber-500/10 border border-transparent group-hover:border-amber-500/30 text-amber-400 flex flex-shrink-0 items-center justify-center shadow-inner premium-transition">
                                            <Icon name="bolt" className="text-3xl md:text-xl lg:text-lg xl:text-xl transition-all" />
                                        </div>
                                        <div className="truncate flex-1">
                                            <div className="text-xl md:text-base lg:text-sm xl:text-base font-black text-[var(--text-primary)] tracking-wide mb-1 lg:mb-0 transition-all">{t('settings.pathways.commands')}</div>
                                            <div className="text-[11px] md:text-[9px] lg:text-[8px] xl:text-[9px] font-bold uppercase tracking-widest text-amber-500/80 truncate transition-all">{t('settings.pathways.commands_desc')}</div>
                                        </div>
                                    </div>
                                    <div className="text-xs font-mono text-[var(--text-secondary)] mb-5 truncate bg-[var(--hover-color)] p-3 rounded-xl border border-[var(--border-color)] leading-relaxed" title={toolsPathName}>
                                        {toolsPathName || "Not configured"}
                                    </div>
                                    <button
                                        onClick={onToolsSelect}
                                        disabled={syncing}
                                        className="w-full py-2.5 rounded-xl text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 border premium-button premium-emphasis premium-amber text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
                                    >
                                        {syncing ? <Icon name="sync fa-spin" /> : <Icon name="folder-plus" />} {t('settings.pathways.select')}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                        {/* Dynamic Configuration per Mode */}
                        <div className="space-y-4">
                            <label className="text-sm font-black text-[var(--text-primary)] uppercase tracking-[0.2em] flex items-center gap-2">
                                <Icon name="microchip" className="text-purple-400" /> {t('settings.orchestration.title')}
                            </label>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Chat Configuration Card */}
                                <div className="premium-card premium-blue rounded-[2rem] p-6 shadow-2xl relative miku-composite-isolate group">
                                    <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-blue-600 to-cyan-400 opacity-0 group-hover:opacity-50 transition-all duration-700" />

                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-500/20 p-2 rounded-xl text-blue-400 border border-transparent group-hover:border-blue-500/40 premium-transition">
                                                <Icon name="brain" className="text-xl mx-0.5" />
                                            </div>
                                            <span className="font-black text-[var(--text-primary)] tracking-tight text-lg">{t('settings.orchestration.chat_runtime')}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div
                                                className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all shadow-md border premium-emphasis ${(config.chatProvider === 'ollama' ? (models['ollama'] || []).length > 0 : !!config.apiKeys[config.chatProvider || 'gemini'])
                                                    ? 'premium-emerald bg-emerald-500/10 text-emerald-400'
                                                    : 'bg-slate-800/80 text-slate-500 border-white/5'
                                                    }`}
                                                title={
                                                    (config.chatProvider === 'ollama' ? (models['ollama'] || []).length > 0 : !!config.apiKeys[config.chatProvider || 'gemini'])
                                                        ? t('settings.orchestration.connection_active')
                                                        : t('settings.orchestration.config_pending')
                                                }
                                            >
                                                <Icon name={config.chatProvider === 'ollama' ? 'network-wired' : 'key'} />
                                            </div>
                                            <button
                                                onClick={onSyncModelArchitectures}
                                                disabled={loadingModels[config.chatProvider || 'gemini'] || connectionStatus === 'testing'}
                                                title={t('settings.orchestration.sync')}
                                                className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all shadow-md border premium-emphasis bg-[var(--surface-color)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--hover-color)] hover:text-[var(--text-primary)] active:scale-95 group/sync overflow-hidden`}
                                            >
                                                <Icon
                                                    name="sync"
                                                    className={`${(loadingModels[config.chatProvider || 'gemini'] || (connectionStatus === 'testing' && config.provider === config.chatProvider))
                                                        ? 'fa-spin text-blue-400 opacity-100 !transition-none'
                                                        : 'opacity-60 group-hover/sync:opacity-100 group-hover/sync:rotate-180 transition-all duration-500'
                                                        }`}
                                                />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-5">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block ml-1">{t('settings.orchestration.provider')}</label>
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
                                                                <img src="./ollamaICON.webp" alt="Ollama" className={`w-6 h-6 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_2px_4px_rgba(255,255,255,0.2)]' : 'opacity-40 grayscale group-hover:opacity-80 group-hover:grayscale-0 transition-opacity transition-[filter]'}`} />
                                                            ) : pId === 'groq' ? (
                                                                <img src="./groqICON.png" alt="Groq" className={`w-6 h-6 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_2px_4px_rgba(255,255,255,0.2)]' : 'opacity-40 grayscale group-hover:opacity-80 group-hover:grayscale-0 transition-opacity transition-[filter]'}`} />
                                                            ) : pId === 'zai' ? (
                                                                <img src="./zai.png" alt="Z.AI" className={`w-6 h-6 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_2px_4px_rgba(255,165,0,0.3)]' : 'opacity-40 grayscale group-hover:opacity-80 group-hover:grayscale-0 transition-opacity transition-[filter]'}`} />
                                                            ) : (
                                                                <Icon name={(PROVIDERS as any)[pId]?.icon || 'robot'} className="text-lg" />
                                                            )}
                                                            <span className={`text-[9px] font-black uppercase tracking-wider ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                                                                {PROVIDERS[pId].name.split(' ')[0]}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block ml-1">{t('settings.orchestration.model')}</label>
                                            <div className="relative">
                                                <ModernSelect
                                                    value={config.chatModel}
                                                    onChange={(val) => updateConfig('chatModel', val)}
                                                    placeholder={t('settings.orchestration.select_model')}
                                                    options={(models[config.chatProvider || 'groq'] || []).map(m => ({ value: m.id, label: m.name }))}
                                                    title={t('settings.orchestration.model')}
                                                />
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
                                            <span className="font-black text-[var(--text-primary)] tracking-tight text-lg">{t('settings.orchestration.agent_runtime')}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div
                                                className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all shadow-md border premium-emphasis ${(config.agentProvider === 'ollama' ? (models['ollama'] || []).length > 0 : !!config.apiKeys[config.agentProvider || 'groq'])
                                                    ? 'premium-emerald bg-emerald-500/10 text-emerald-400'
                                                    : 'bg-slate-800/80 text-slate-500 border-white/5'
                                                    }`}
                                                title={
                                                    (config.agentProvider === 'ollama' ? (models['ollama'] || []).length > 0 : !!config.apiKeys[config.agentProvider || 'groq'])
                                                        ? t('settings.orchestration.connection_active')
                                                        : t('settings.orchestration.config_pending')
                                                }
                                            >
                                                <Icon name={config.agentProvider === 'ollama' ? 'network-wired' : 'key'} />
                                            </div>
                                            <button
                                                onClick={() => onTestConnection(config.agentProvider)}
                                                disabled={loadingModels[config.agentProvider || 'groq'] || loadingModels[config.provider] || connectionStatus === 'testing'}
                                                title={t('settings.orchestration.sync')}
                                                className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all shadow-md border premium-emphasis bg-[var(--surface-color)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--hover-color)] hover:text-[var(--text-primary)] active:scale-95 group/sync overflow-hidden`}
                                            >
                                                <Icon
                                                    name="sync"
                                                    className={`${(loadingModels[config.agentProvider || 'groq'] || (connectionStatus === 'testing' && config.provider === config.agentProvider))
                                                        ? 'fa-spin text-purple-400 opacity-100 !transition-none'
                                                        : 'opacity-60 group-hover/sync:opacity-100 group-hover/sync:rotate-180 transition-all duration-500'
                                                        }`}
                                                />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-5">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block ml-1">{t('settings.orchestration.provider')}</label>
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
                                                                <img src="./ollamaICON.webp" alt="Ollama" className={`w-6 h-6 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_2px_4px_rgba(255,255,255,0.2)]' : 'opacity-40 grayscale group-hover:opacity-80 group-hover:grayscale-0 transition-opacity transition-[filter]'}`} />
                                                            ) : pId === 'groq' ? (
                                                                <img src="./groqICON.png" alt="Groq" className={`w-6 h-6 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_2px_4px_rgba(255,255,255,0.2)]' : 'opacity-40 grayscale group-hover:opacity-80 group-hover:grayscale-0 transition-opacity transition-[filter]'}`} />
                                                            ) : pId === 'zai' ? (
                                                                <img src="./zai.png" alt="Z.AI" className={`w-6 h-6 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_2px_4px_rgba(255,165,0,0.3)]' : 'opacity-40 grayscale group-hover:opacity-80 group-hover:grayscale-0 transition-opacity transition-[filter]'}`} />
                                                            ) : (
                                                                <Icon name={(PROVIDERS as any)[pId]?.icon || 'robot'} className="text-lg" />
                                                            )}
                                                            <span className={`text-[9px] font-black uppercase tracking-wider ${isSelected ? 'text-purple-100' : 'text-slate-400'}`}>
                                                                {PROVIDERS[pId].name.split(' ')[0]}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block ml-1">{t('settings.orchestration.model')}</label>
                                            <div className="relative">
                                                <ModernSelect
                                                    value={config.agentModel}
                                                    onChange={(val) => updateConfig('agentModel', val)}
                                                    placeholder={t('settings.orchestration.select_model')}
                                                    options={(models[config.agentProvider || 'groq'] || []).map(m => ({ value: m.id, label: m.name }))}
                                                    title={t('settings.orchestration.model')}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Vision Runtime (Vortex Visual) - Full Width Banner */}
                                <div className="md:col-span-2 premium-card premium-emerald rounded-[2rem] p-6 shadow-2xl relative overflow-hidden transform-gpu group">
                                    <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-emerald-600 to-cyan-400 opacity-0 group-hover:opacity-50 transition-all duration-700" />
                                    <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-emerald-500/5 blur-3xl rounded-full pointer-events-none transform-gpu" />

                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        {/* Left: Icon and Title */}
                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="bg-emerald-500/20 p-2 rounded-xl text-emerald-400 border border-transparent group-hover:border-emerald-500/40 premium-transition">
                                                <Icon name="eye" className="text-xl mx-0.5" />
                                            </div>
                                            <span className="font-black text-[var(--text-primary)] tracking-tight text-lg whitespace-nowrap">{t('settings.orchestration.vision_runtime')}</span>
                                        </div>

                                        {/* Middle: Distributed Warning Text */}
                                        <div className="hidden md:flex flex-1 items-center px-4 space-x-4 border-l border-emerald-500/20">
                                            <span className="text-[10px] text-emerald-500/80 font-bold uppercase tracking-[0.15em] leading-tight">
                                                {t('settings.orchestration.vision_desc')}
                                            </span>
                                        </div>

                                        {/* Right: Sync Controls */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <div
                                                className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all shadow-md border premium-emphasis ${(config.visionModel)
                                                    ? 'premium-emerald bg-emerald-500/10 text-emerald-400'
                                                    : 'bg-slate-800/80 text-slate-500 border-white/5'
                                                    }`}
                                                title={config.visionModel ? t('settings.orchestration.connection_active') : 'Default: Native Mode'}
                                            >
                                                <Icon name={config.visionProvider === 'ollama' ? 'network-wired' : 'key'} />
                                            </div>

                                            <button
                                                onClick={() => onTestConnection(config.visionProvider)}
                                                disabled={loadingModels[config.visionProvider || 'gemini'] || connectionStatus === 'testing'}
                                                title={t('settings.orchestration.sync')}
                                                className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all shadow-md border premium-emphasis bg-[var(--surface-color)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--hover-color)] hover:text-[var(--text-primary)] active:scale-95 group/v-sync overflow-hidden`}
                                            >
                                                <Icon
                                                    name="sync"
                                                    className={`${(loadingModels[config.visionProvider || 'gemini'] || (connectionStatus === 'testing' && (config.visionProvider === config.provider)))
                                                        ? 'fa-spin text-emerald-400 opacity-100 !transition-none'
                                                        : 'opacity-60 group-hover/v-sync:opacity-100 group-hover/v-sync:rotate-180 transition-all duration-500'
                                                        }`}
                                                />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-8 items-end">
                                        <div className="lg:col-span-5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block ml-1">{t('settings.orchestration.provider')}</label>
                                            <div className="flex gap-2 premium-card !bg-black/20 p-1.5 rounded-2xl border border-white/5">
                                                {(Object.keys(PROVIDERS) as Provider[]).map(pId => {
                                                    const isSelected = config.visionProvider === pId;
                                                    return (
                                                        <button
                                                            key={pId}
                                                            onClick={() => updateConfig('visionProvider', pId)}
                                                            className={`flex-1 py-3 rounded-xl transition-all flex flex-col items-center justify-center gap-1.5 ${isSelected
                                                                ? `bg-emerald-600/90 text-white shadow-lg shadow-emerald-900/40 ring-1 ring-white/20`
                                                                : 'hover:bg-white/5 text-slate-400'
                                                                }`}
                                                        >
                                                            {pId === 'gemini' ? (
                                                                <img src="./geminiICON.png" alt="Gemini" className={`w-6 h-6 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : 'opacity-40 grayscale hover:opacity-80'}`} />
                                                            ) : pId === 'ollama' ? (
                                                                <img src="./ollamaICON.webp" alt="Ollama" className={`w-6 h-6 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_2px_4px_rgba(255,255,255,0.2)]' : 'opacity-40 grayscale group-hover:opacity-80 group-hover:grayscale-0 transition-opacity transition-[filter]'}`} />
                                                            ) : pId === 'groq' ? (
                                                                <img src="./groqICON.png" alt="Groq" className={`w-6 h-6 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_2px_4px_rgba(255,255,255,0.2)]' : 'opacity-40 grayscale group-hover:opacity-80 group-hover:grayscale-0 transition-opacity transition-[filter]'}`} />
                                                            ) : pId === 'zai' ? (
                                                                <img src="./zai.png" alt="Z.AI" className={`w-6 h-6 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_2px_4px_rgba(255,165,0,0.3)]' : 'opacity-40 grayscale group-hover:opacity-80 group-hover:grayscale-0 transition-opacity transition-[filter]'}`} />
                                                            ) : (
                                                                <Icon name={(PROVIDERS as any)[pId]?.icon || 'robot'} className="text-lg" />
                                                            )}
                                                            <span className={`text-[9px] font-black uppercase tracking-wider ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                                                                {PROVIDERS[pId].name.split(' ')[0]}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="lg:col-span-7">
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 block ml-1">{t('settings.orchestration.model')}</label>
                                                {config.visionModel && (
                                                    <button
                                                        onClick={() => updateConfig('visionModel', '')}
                                                        className="text-[9px] font-black text-red-400/80 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1.5 rounded-lg uppercase tracking-wider transition-all duration-300 flex items-center gap-1.5 border border-transparent hover:border-red-500/40"
                                                    >
                                                        <Icon name="power-off" /> {t('settings.orchestration.disable_vision')}
                                                    </button>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <ModernSelect
                                                    value={config.visionModel}
                                                    onChange={(val) => updateConfig('visionModel', val)}
                                                    placeholder="-- MODO NATIVO SELECCIONADO --"
                                                    options={[
                                                        { value: '', label: 'NATIVE VISION (Using Chat/Agent model)' },
                                                        ...(models[config.visionProvider || 'gemini'] || []).map(m => {
                                                            const isVision = m.id.toLowerCase().includes('vision') ||
                                                                m.id.toLowerCase().includes('llava') ||
                                                                m.name.toLowerCase().includes('vision') ||
                                                                m.id.toLowerCase().includes('multimodal') ||
                                                                m.id.toLowerCase().includes('1.5-pro') ||
                                                                m.id.toLowerCase().includes('1.5-flash') ||
                                                                m.id.toLowerCase().includes('sonnet') ||
                                                                m.id.toLowerCase().includes('glm-4v') ||
                                                                m.id.toLowerCase().includes('pixtral');

                                                            return {
                                                                value: m.id,
                                                                label: isVision ? `✨ ${m.name} (Multimodal)` : m.name
                                                            };
                                                        })
                                                    ]}
                                                    title={t('settings.orchestration.model')}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                        {/* Secure Credential Vault Section - Balanced Spacing */}
                        <div className="space-y-4 pt-4 md:pt-6">
                            <label className="text-sm font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Icon name="shield-alt" className="text-amber-500" /> {t('settings.security.title')}
                            </label>

                            <div className="premium-panel !bg-amber-500/[0.03] hover:!bg-amber-500/[0.06] p-6 shadow-[0_0_40px_rgba(251,191,36,0.05)] space-y-5 relative miku-composite-isolate border-amber-500/10 hover:border-amber-500/30">

                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-amber-500/10 pb-4 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-900/80 to-amber-950 border border-amber-700/50 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-900/20">
                                            <Icon name="lock" className="text-xl" />
                                        </div>
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                            <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-orange-400 tracking-tight whitespace-nowrap">{t('settings.security.vault_title')}</h3>
                                            <div className="hidden sm:block w-px h-4 bg-amber-500/20" />
                                            <p className="text-[10px] sm:text-xs text-amber-500/60 font-medium uppercase tracking-wider">{t('settings.security.vault_desc')}</p>
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
                                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">{t('settings.security.fallback_title')}</h4>
                                            <div className="space-y-4">
                                                <div className="relative">
                                                    <ModernSelect
                                                        value={config.provider}
                                                        onChange={(val) => updateConfig('provider', val as Provider)}
                                                        placeholder={t('settings.security.provider_label')}
                                                        options={(Object.keys(PROVIDERS) as Provider[]).map(pId => ({
                                                            value: pId,
                                                            label: `${PROVIDERS[pId].name} ${t('settings.security.provider_label')}`
                                                        }))}
                                                        title={t('settings.security.provider_label')}
                                                    />
                                                </div>
                                                <div className="relative">
                                                    <ModernSelect
                                                        value={config.model}
                                                        onChange={(val) => updateConfig('model', val)}
                                                        placeholder={t('settings.security.model_label') + '...'}
                                                        options={(models[config.provider] || []).map(m => ({ value: m.id, label: m.name }))}
                                                        title={t('settings.security.model_label')}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-auto pt-4">
                                            <button
                                                onClick={() => onTestConnection()}
                                                disabled={loadingModels[config.provider]}
                                                className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                                            >
                                                {loadingModels[config.provider] ? <Icon name="spinner fa-spin" /> : <Icon name="network-wired" />} {t('settings.security.ping')}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Keys */}
                                    <div className="md:col-span-7 premium-card p-5 border transition-all duration-700 flex flex-col miku-composite-isolate">
                                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">{t('settings.security.key_mgmt')}</h4>

                                        <div className="flex gap-2 premium-card !bg-slate-900/60 p-1.5 rounded-2xl mb-4">
                                            {(Object.keys(PROVIDERS) as Provider[]).map(pId => (
                                                <button
                                                    key={pId}
                                                    onClick={() => setEditingProvider(pId)}
                                                    className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${editingProvider === pId ? 'bg-slate-700/80 text-white shadow-lg shadow-black/20 ring-1 ring-white/5' : 'text-slate-300/50 hover:text-slate-100 hover:bg-white/5'
                                                        }`}
                                                >
                                                    {PROVIDERS[pId].name.split(' ')[0]}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="flex-1 flex flex-col justify-center">
                                            <div className="relative flex items-center group">
                                                <div className="absolute left-6 text-slate-500 group-hover:text-[var(--primary-color)] flex items-center justify-center z-10 transition-colors">
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
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        if (editingProvider !== 'ollama') {
                                                            handleSaveKey(editingProvider, localApiKey);
                                                        }
                                                    }}
                                                    placeholder={editingProvider === 'ollama' ? "http://localhost:11434" : t('settings.security.key_placeholder', { provider: PROVIDERS[editingProvider].name })}
                                                    className="w-full premium-input rounded-xl pl-14 pr-16 py-3.5 text-[var(--primary-color)] font-mono text-xs text-center focus:outline-none transition-all placeholder:text-slate-600 placeholder:tracking-wider placeholder:text-center"
                                                />
                                                <div className="absolute right-4 flex items-center gap-1">
                                                    {editingProvider !== 'ollama' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowApiKey(!showApiKey)}
                                                            className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-300 bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-600"
                                                            title={showApiKey ? t('settings.security.hide_key') : t('settings.security.show_key')}
                                                        >
                                                            <Icon name={showApiKey ? "eye-slash" : "eye"} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-6 flex flex-col gap-3 p-4 premium-card !bg-slate-900/30">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                        <Icon name="thermometer-half" /> {t('settings.security.temp_label')}
                                                    </label>
                                                    <span className="bg-slate-800 text-[var(--primary-color)] font-mono text-xs font-bold px-2 py-1 rounded-md border border-slate-700">
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
                                                    className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-[var(--primary-color)]"
                                                />
                                                <div className="flex justify-between text-[9px] text-slate-600 font-bold uppercase tracking-wider px-1">
                                                    <span>{t('settings.security.temp_precise')}</span>
                                                    <span>{t('settings.security.temp_creative')}</span>
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
                                                <Icon name="paper-plane" /> {t('settings.security.telegram_title')}
                                            </h4>
                                            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{t('settings.security.telegram_desc')}</p>
                                        </div>
                                        <div className="md:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">{t('settings.security.bot_token')}</label>
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
                                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">{t('settings.security.chat_id')}</label>
                                                <div className="relative group">
                                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-blue-300 z-10 transition-colors">
                                                        <Icon name="user-shield" />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={config.telegramChatId || ''}
                                                        onChange={(e) => updateConfig('telegramChatId', e.target.value)}
                                                        placeholder={t('settings.security.chat_id_placeholder')}
                                                        className="w-full premium-input rounded-xl pl-12 pr-4 py-3 text-blue-200 font-mono text-xs focus:outline-none transition-all placeholder:text-slate-700 placeholder:tracking-widest"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 md:pt-6">
                                <label className="text-sm font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Icon name="microphone" className="text-emerald-400" /> {t('settings.vosk.title')}
                                </label>

                                <div className="premium-card premium-emerald p-8 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 relative z-10">
                                        <div className="space-y-4">
                                            <h3 className="text-lg font-black text-[var(--text-primary)] tracking-tight">{t('settings.vosk.manage_title')}</h3>
                                            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                                                {t('settings.vosk.manage_desc')}
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
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block ml-1">{t('settings.vosk.active_model')}</label>
                                            <div className="relative">
                                                <ModernSelect
                                                    value={config.voskModelPath || ''}
                                                    onChange={(val) => updateConfig('voskModelPath', val)}
                                                    placeholder={t('settings.vosk.none')}
                                                    options={localModels.map(m => ({ value: m, label: m }))}
                                                    title={t('settings.vosk.active_model')}
                                                    dropDirection="down"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 md:pt-6">
                                <div className="flex items-center justify-between pr-2">
                                    <label className="text-sm font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Icon name="search" className="text-blue-400" /> {t('settings.searxena.title')}
                                    </label>
                                </div>

                                <div className="premium-card premium-searxena p-8 relative overflow-hidden group">
                                    {/* Muted background gradient */}
                                    <div className="absolute inset-0 pointer-events-none sx-bg-radial" />

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
                                            <use href="#ozen-paw-scatter" className="xena-paw xena-paw-01" x="90%" y="15%" transform="scale(0.3) rotate(-15)" />
                                            <use href="#ozen-paw-scatter" className="xena-paw xena-paw-02" x="95%" y="25%" transform="scale(0.25) rotate(20)" />
                                            <use href="#ozen-paw-scatter" className="xena-paw xena-paw-03" x="75%" y="10%" transform="scale(0.3) rotate(45)" />
                                            <use href="#ozen-paw-scatter" className="xena-paw xena-paw-04" x="50%" y="90%" transform="scale(0.35) rotate(10)" />
                                            <use href="#ozen-paw-scatter" className="xena-paw xena-paw-05" x="90%" y="85%" transform="scale(0.4) rotate(-20)" />
                                        </svg>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
                                        <div className="space-y-6 relative h-full flex flex-col">
                                            <div className="space-y-5">
                                                <div className="flex items-center py-2">
                                                    <h3
                                                        className="text-5xl font-bold tracking-tighter transition-all duration-700 opacity-70 group-hover:opacity-100 searxena-title"
                                                    >
                                                        <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 group-hover:from-indigo-400 group-hover:via-purple-400 group-hover:to-fuchsia-400 bg-clip-text text-transparent transition-all duration-700">searXena</span>
                                                    </h3>
                                                </div>

                                                <p className="text-[11px] text-slate-400 leading-relaxed max-w-sm">
                                                    {t('settings.searxena.desc')}
                                                </p>

                                                <div className="flex flex-wrap items-center gap-3 pt-2 relative z-20">
                                                    <a
                                                        href="http://127.0.0.1:8000"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2 text-[10px] font-black text-slate-300 hover:text-white px-5 py-2.5 rounded-xl border border-white/5 hover:border-indigo-500/40 transition-all uppercase tracking-widest bg-white/5 hover:bg-white/10 premium-button outline-none"
                                                    >
                                                        <Icon name="external-link-alt" />
                                                        {t('settings.searxena.open')}
                                                    </a>
                                                </div>
                                            </div>

                                            {/* Vertical Spacer - Captures the 'empty space' to center the mascot */}
                                            <div className="flex-1 relative min-h-[60px]">
                                                {/* Paw Walking Path Animation - Right Sequence Only */}
                                                <div className="absolute inset-0 pointer-events-none overflow-hidden group-hover:block hidden">
                                                    {/* Sequence: Right Descending (Subtle & Clean) */}
                                                    <div className="absolute top-[10%] right-[34%] rotate-[20deg] animate-paw-path paw-path-01">
                                                        <Icon name="paw" className="text-[11px] text-indigo-400/20" />
                                                    </div>
                                                    <div className="absolute top-[20%] right-[28%] rotate-[-10deg] animate-paw-path paw-path-02">
                                                        <Icon name="paw" className="text-[11px] text-indigo-400/20" />
                                                    </div>
                                                    <div className="absolute top-[32%] right-[24%] rotate-[30deg] animate-paw-path paw-path-03">
                                                        <Icon name="paw" className="text-[11px] text-purple-400/20" />
                                                    </div>
                                                    <div className="absolute top-[42%] right-[18%] rotate-[-5deg] animate-paw-path paw-path-04">
                                                        <Icon name="paw" className="text-[11px] text-purple-400/20" />
                                                    </div>
                                                    <div className="absolute top-[54%] right-[14%] rotate-[35deg] animate-paw-path paw-path-05">
                                                        <Icon name="paw" className="text-[11px] text-fuchsia-400/15" />
                                                    </div>
                                                </div>

                                                {/* Mascot Layer - Centered in the spacer without pushing layout */}
                                                <div className="absolute inset-0 flex items-center justify-center lg:justify-start select-none pointer-events-none z-10">
                                                    <div
                                                        className="w-28 h-28 md:w-32 md:h-32 opacity-15 group-hover:opacity-100 group-hover:scale-110 transition-all duration-1000 relative pointer-events-auto cursor-pointer"
                                                        onClick={() => {
                                                            if (!isWaving) {
                                                                setIsWaving(true);
                                                                setTimeout(() => setIsWaving(false), 1200);
                                                            }
                                                        }}
                                                    >
                                                        <svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" className="w-full h-full filter drop-shadow-[0_0_20px_rgba(129,140,248,0.2)]">
                                                            <g transform="translate(80, 80)">
                                                                <text x="0" y="-2" textAnchor="middle" dominantBaseline="central" fontSize="52" fontWeight="700" fill="url(#ozenGrad)"
                                                                    className="xena-text-base">
                                                                    V<tspan className="xena-eye" dy="-2.5">•</tspan>
                                                                    <tspan className="opacity-0">ᴥ</tspan>
                                                                    <tspan className="xena-eye" dy="0">•</tspan>V
                                                                </text>
                                                                <text className={`xena-nose ${isWaving ? 'sniff-fast' : ''} xena-text-base`} x="0" y="6" textAnchor="middle" dominantBaseline="central" fontSize="52" fontWeight="700" fill="url(#ozenGrad)">
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
                                                        {searxenaStatus.installed ? t('settings.searxena.status_detected') : t('settings.searxena.status_missing')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-2 rounded-full ${searxenaStatus.running ? 'bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.4)]' : 'bg-slate-700'}`} />
                                                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">
                                                        {searxenaStatus.running ? t('settings.searxena.status_running') : t('settings.searxena.status_stopped')}
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
                                                {startingSearxena ? (
                                                    searxenaStatus.envReady ? t('settings.searxena.btn_deploying') : t('settings.searxena.btn_starting')
                                                ) : searxenaStatus.running ? (
                                                    t('settings.searxena.btn_active')
                                                ) : !searxenaStatus.envReady ? (
                                                    t('settings.searxena.btn_install_start')
                                                ) : (
                                                    t('settings.searxena.btn_start')
                                                )}
                                            </button>

                                            <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-4 backdrop-blur-sm">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${searxenaStatus.installed ? 'bg-[#818cf8] shadow-[0_0_8px_rgba(129,140,248,0.4)]' : 'bg-slate-700'}`} />
                                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t('settings.searxena.core_local')}</span>
                                                    </div>
                                                    <span className="text-[9px] font-mono text-indigo-400/80 uppercase">{searxenaStatus.installed ? t('settings.searxena.status_online') : t('settings.searxena.status_offline')}</span>
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${searxenaStatus.envReady ? 'bg-[#c084fc] shadow-[0_0_8px_rgba(192,132,252,0.4)]' : 'bg-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.2)]'}`} />
                                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t('settings.searxena.core_env')}</span>
                                                    </div>
                                                    <span className="text-[9px] font-mono text-purple-400/80 uppercase">{searxenaStatus.envReady ? t('settings.searxena.status_ready') : t('settings.searxena.status_setup_req')}</span>
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${searxenaStatus.running ? 'bg-[#e879f9] shadow-[0_0_8px_rgba(232,121,249,0.5)] animate-pulse' : 'bg-slate-700'}`} />
                                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t('settings.searxena.core_instance')}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {searxenaStatus.running && (
                                                            <button
                                                                onClick={handleStopSearXena}
                                                                title={t('settings.searxena.btn_stop_title')}
                                                                className="w-6 h-6 flex items-center justify-center rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20 active:scale-90"
                                                            >
                                                                <Icon name="power-off" className="text-[9px]" />
                                                            </button>
                                                        )}
                                                        <span className="text-[9px] font-mono text-pink-400/80 uppercase min-w-[50px] text-right">{searxenaStatus.running ? t('settings.searxena.status_active') : t('settings.searxena.status_idle')}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <p className="text-[8px] text-slate-600 px-4 leading-tight font-black uppercase tracking-[0.1em] text-center opacity-70">
                                                {searxenaStatus.installed ? t('settings.searxena.enabled') : t('settings.searxena.offline')}
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
                                                        title={searxenaStatus.running ? t('settings.searxena.sync_warn_running') : t('settings.searxena.sync_btn_title')}
                                                    >
                                                        <Icon name={updatingSearxena ? "sync fa-spin" : "wrench"} />
                                                        {updatingSearxena ? t('settings.searxena.btn_syncing') : t('settings.searxena.btn_sync')}
                                                    </button>
                                                    <p className="text-[8px] text-slate-500 mt-2 text-center leading-relaxed">
                                                        {t('settings.searxena.sync_desc')}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                            {/* System Behavior & Integration */}
                            <div className="space-y-4 pt-4 md:pt-4">
                                <label className="text-sm font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Icon name="cog" className="text-slate-400" /> {t('settings.integration.title')}
                                </label>
                                <div className="premium-card p-8 transition-all duration-700 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-slate-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-slate-500/10 transition-colors" />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                                        {/* Auto Launch */}
                                        <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-transparent hover:border-blue-500/20 transition-all group/sw">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-[var(--primary-color)]/10 border border-transparent group-hover/sw:border-[var(--primary-color)]/30 text-[var(--primary-color)] flex items-center justify-center premium-transition">
                                                    <Icon name="rocket" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-[var(--text-primary)]">{t('settings.integration.autostart')}</div>
                                                    <div className="text-[10px] text-slate-500 font-medium">{t('settings.integration.autostart_desc')}</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => updateConfig('autoLaunch', !config.autoLaunch)}
                                                className={`premium-switch w-12 h-6 rounded-full relative ${config.autoLaunch ? 'bg-[var(--primary-color)]' : 'bg-slate-700'}`}
                                                title={config.autoLaunch ? "Desactivar inicio con Windows" : "Activar inicio con Windows"}
                                            >
                                                <div className={`premium-switch-knob absolute top-1 w-4 h-4 rounded-full bg-white shadow-md ${config.autoLaunch ? 'left-7' : 'left-1'}`} />
                                            </button>
                                        </div>

                                        {/* Minimize to Tray */}
                                        <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-transparent hover:border-indigo-500/20 transition-all group/sw">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-[var(--secondary-color)]/10 border border-transparent group-hover/sw:border-[var(--secondary-color)]/30 text-[var(--secondary-color)] flex items-center justify-center premium-transition">
                                                    <Icon name="window-minimize" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-[var(--text-primary)]">{t('settings.integration.mintotray')}</div>
                                                    <div className="text-[10px] text-slate-500 font-medium">{t('settings.integration.mintotray_desc')}</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => updateConfig('minimizeToTray', !config.minimizeToTray)}
                                                className={`premium-switch w-12 h-6 rounded-full relative ${config.minimizeToTray ? 'bg-[var(--secondary-color)]' : 'bg-slate-700'}`}
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
                            <div className="space-y-4 pt-4 md:pt-4">
                                <label className="text-sm font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Icon name="tools" className="text-cyan-400" /> {t('settings.backup.title')}
                                </label>

                                <div className="premium-card premium-cyan p-8 space-y-6 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-cyan-500/10 transition-colors" />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                        <div>
                                            <h3 className="text-lg font-black text-[var(--text-primary)] tracking-tight mb-2">{t('settings.backup.subtitle')}</h3>
                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                {t('settings.backup.desc')}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <button
                                                onClick={async () => {
                                                    if (!(window as any).electron) return;
                                                    const res = await (window as any).electron.exportBackup();
                                                    if (res.ok) await askAlert(t('dialogs.backup_success', { path: res.path }));
                                                    else if (!res.canceled) await askAlert(t('dialogs.backup_error', { error: res.error }));
                                                }}
                                                className="py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-2 border shadow-lg group/btn premium-button premium-emphasis premium-cyan bg-cyan-600/10 text-cyan-400"
                                            >
                                                <Icon name="file-upload" className="text-xl group-hover/btn:scale-110 transition-transform" />
                                                <span>{t('settings.backup.export_btn')}</span>
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (!(window as any).electron) return;
                                                    const confirm = await askConfirm(t('dialogs.restore_confirm'));

                                                    if (!confirm) return;

                                                    const res = await (window as any).electron.importBackup();
                                                    if (res.ok) {
                                                        await askAlert(t('dialogs.restore_success'));
                                                        window.location.reload();
                                                    } else if (!res.canceled) {
                                                        await askAlert(t('dialogs.restore_error', { error: res.error }));
                                                    }
                                                }}
                                                className="py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-2 border shadow-lg group/btn premium-button premium-emphasis premium-indigo bg-slate-800 text-slate-300"
                                            >
                                                <Icon name="file-download" className="text-xl group-hover/btn:scale-110 transition-transform" />
                                                <span>{t('settings.backup.restore_btn')}</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-4 p-4 bg-blue-500/10 dark:bg-blue-950/20 border border-blue-500/20 rounded-2xl flex items-center gap-4">
                                        <Icon name="info-circle" className="text-blue-500" />
                                        <div className="text-[10px] text-[var(--text-secondary)] leading-normal">
                                            <b className="text-blue-600 dark:text-blue-300">{t('settings.backup.security_note')}</b> {t('settings.backup.security_desc')}
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
                                        <div className="flex flex-col">
                                            <h3 className="text-base font-black text-red-600 dark:text-red-200 tracking-tight mb-1 transition-colors cloud-factory-title">{t('settings.factory_reset.title')}</h3>
                                            <p className="text-[10px] text-red-500/80 dark:text-red-400/30 font-medium leading-relaxed max-w-sm transition-colors">{t('settings.factory_reset.desc')}</p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const first = await askConfirm(
                                                t('dialogs.factory_reset_first')
                                            );
                                            if (!first) return;

                                            const second = await askConfirm(
                                                t('dialogs.factory_reset_second')
                                            );
                                            if (!second) return;

                                            try {
                                                await onSaveGlobal(true, { isConfigured: false });
                                                await askAlert(t('dialogs.factory_reset_rebooting'));
                                                // La UI se actualizará automáticamente activando el Onboarding Wizard al cambiar isConfigured
                                            } catch (e) {
                                                await askAlert(t('dialogs.factory_reset_error', { error: (e as any)?.message }));
                                            }
                                        }}
                                        className="h-11 px-6 bg-red-500/[0.02] hover:bg-red-500/15 border border-transparent hover:border-red-500/40 text-red-400/80 dark:text-red-400/60 hover:text-red-700 dark:hover:text-red-100 cloud-destructive-btn rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 shadow-lg hover:shadow-red-500/10 active:scale-95 group/btn"
                                    >
                                        <Icon name="redo-alt" className="text-sm group-hover/btn:rotate-[360deg] transition-all duration-700" />
                                        {t('settings.reset_btn')}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className={`md:hidden pt-2 pb-6 flex justify-center sticky bottom-0 z-20 pointer-events-none transition-all duration-300 ${showFloatingSave ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                            <button
                                onClick={onSaveGlobal}
                                className="pointer-events-auto w-[70%] max-w-[280px] py-3.5 bg-blue-600/80 hover:bg-blue-600 border border-transparent hover:border-blue-400/50 text-blue-50 hover:text-white rounded-full text-[11px] font-extrabold uppercase tracking-widest shadow-[0_4px_15px_rgba(37,99,235,0.2)] hover:shadow-[0_4px_25px_rgba(37,99,235,0.5)] transition-all duration-300 opacity-70 hover:opacity-100 flex items-center justify-center gap-2"
                            >
                                <Icon name="save" className="text-sm flex-shrink-0" /> {t('settings.save_btn')}
                            </button>
                        </div>

                        {/* Floating Save Button - Desktop (Organic & Liquid Design) */}
                        <div className={`hidden md:flex pt-2 pb-10 justify-center sticky bottom-0 z-30 pointer-events-none transition-all duration-1000 ${showFloatingSave ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                            <div className="relative group">
                                {/* Ambient Soft Glow */}
                                <div className="absolute -inset-4 bg-blue-500/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition duration-1000" />

                                <button
                                    onClick={onSaveGlobal}
                                    className={`pointer-events-auto h-12 bg-slate-900 hover:bg-slate-800 border border-transparent hover:border-blue-500/50 text-slate-400 hover:text-blue-200 rounded-full transition-all duration-700 ease-in-out flex items-center justify-center shadow-[0_10px_40px_rgba(0,0,0,0.4)] group relative overflow-hidden premium-button px-0 ${isAtBottom ? 'w-36 px-6' : 'w-12 group-hover:w-36 group-hover:px-6'}`}
                                    title={t('settings.actions.save')}
                                >
                                    {/* Liquid Shine Effect */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />

                                    <div className="flex items-center gap-0 group-hover:gap-2.5 transition-all duration-500">
                                        <Icon name="save" className={`text-lg relative z-10 transition-all duration-500 ${isAtBottom ? 'text-blue-400/80' : ''}`} />
                                        <span className={`max-w-0 opacity-0 overflow-hidden transition-all duration-500 font-medium uppercase tracking-[0.2em] text-[10px] whitespace-nowrap relative z-10 ${isAtBottom ? 'max-w-[80px] opacity-100 ml-2.5' : 'group-hover:max-w-[80px] group-hover:opacity-100'}`}>
                                            {t('settings.save_btn')}
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
                                    <p className="font-extrabold mb-1 tracking-tight text-amber-100">{t('settings.alerts.ollama_error_title')}</p>
                                    <p className="text-xs text-amber-200/70 font-medium">{t('settings.alerts.ollama_error_desc', { url: config.ollamaUrl })}</p>
                                </div>
                            </div>
                        )}

                    </div>
                    )}

                {/* Background Gallery Modal */}
                <BackgroundGalleryModal
                    isOpen={showBackgroundGallery}
                    onClose={() => setShowBackgroundGallery(false)}
                    onSelect={(url) => updateConfig('chatBackgroundImage', url)}
                    currentBackground={config.chatBackgroundImage}
                />
            </div>
        </div>
    );
};

// ── Background Gallery Modal Component ──────────────────────────────
const BackgroundGalleryModal = ({
    isOpen,
    onClose,
    onSelect,
    currentBackground
}: {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (url: string) => void;
    currentBackground?: string;
}) => {
    const [backgrounds, setBackgrounds] = useState<{ name: string; url: string | null }[]>([]);
    const [loading, setLoading] = useState(true);
    const { t } = useTranslation();

    useEffect(() => {
        if (!isOpen) return;

        const loadBgs = async () => {
            setLoading(true);
            try {
                const res = await (window as any).electron?.getBackgrounds();
                if (res?.ok) {
                    // Efficiency Update: Main process now returns direct 'local://' URLs
                    // for high-performance lazy loading without memory-heavy Base64.
                    setBackgrounds(res.backgrounds);
                }
            } catch (e) {
                console.error("Error loading backgrounds:", e);
            } finally {
                setLoading(false);
            }
        };

        loadBgs();
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-8">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-[var(--background-color)]/60 backdrop-blur-2xl animate-in fade-in duration-700"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-5xl h-full max-h-[85vh] bg-[var(--surface-color)]/80 backdrop-blur-xl border border-[var(--border-color)]/30 rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col animate-in zoom-in-95 fade-in duration-500 transition-all">
                {/* Header */}
                <div className="pl-8 pr-3 py-3 border-b border-[var(--border-color)]/20 flex items-center justify-between shrink-0 relative z-10 shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
                    <div className="flex items-center gap-4">
                        <h2 className="text-sm font-black text-[var(--text-primary)] tracking-tight uppercase flex items-center gap-2.5">
                            <Icon name="images" className="text-[var(--primary-color)] text-xs" />
                            {t('settings.appearance.backgrounds', 'Fondos Disponibles')}
                        </h2>

                        <div className="h-3 w-px bg-[var(--border-color)]" />

                        <p className="text-[9px] text-[var(--text-secondary)] font-bold tracking-widest uppercase opacity-60">
                            {t('settings.appearance.open_gallery_desc')}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 rounded-full bg-transparent hover:bg-[var(--hover-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-all"
                        title={t('common.close', 'Cerrar')}
                        aria-label={t('common.close', 'Cerrar')}
                    >
                        <Icon name="times" className="text-xs" />
                    </button>
                </div>

                {/* Gallery Grid */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-4">
                            <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                            <span className="text-xs font-black text-cyan-500/50 uppercase tracking-[0.2em] animate-pulse">{t('settings.appearance.gallery_sync', 'Sincronizando Galería...')}</span>
                        </div>
                    ) : backgrounds.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                            <Icon name="image" className="text-5xl opacity-20" />
                            <p className="text-xs font-bold uppercase tracking-widest italic">{t('settings.appearance.gallery_empty', 'No se encontraron imágenes en la carpeta de fondos')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {backgrounds.map((bg) => (
                                <div
                                    key={bg.name}
                                    onClick={() => {
                                        if (bg.url) {
                                            onSelect(bg.url);
                                            onClose();
                                        }
                                    }}
                                    className={`group relative aspect-video rounded-2xl overflow-hidden cursor-pointer border transition-all duration-500 hover:scale-[1.02] active:scale-95 shadow-[0_8px_30px_rgb(0,0,0,0.4)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] ${currentBackground === bg.url
                                        ? 'border-[var(--primary-color)] shadow-[0_0_20px_var(--primary-color)]/30'
                                        : 'border-[var(--border-color)]/20 hover:border-[var(--primary-color)]/40'
                                        }`}
                                    title={bg.name}
                                >
                                    {bg.url ? (
                                        <img
                                            src={bg.url}
                                            alt={bg.name}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                                            <Icon name="spinner" className="animate-spin text-slate-600" />
                                        </div>
                                    )}

                                    {/* Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                                        <span className="text-[10px] font-black text-white truncate drop-shadow-md">
                                            {bg.name}
                                        </span>
                                    </div>

                                    {/* Selected Indicator */}
                                    {currentBackground === bg.url && (
                                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-cyan-500 text-white flex items-center justify-center shadow-lg animate-in zoom-in duration-300">
                                            <Icon name="check" className="text-[10px]" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-4 bg-[var(--background-color)]/50 border-t border-[var(--border-color)]/20 text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] flex items-center gap-3 relative z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
                    <Icon name="info-circle" className="text-[var(--text-secondary)] opacity-50" />
                    {t('settings.appearance.gallery_footer_hint', 'Las imágenes se cargan desde la carpeta de instalación (@ROOT/backgrounds)')}
                </div>
            </div>
        </div>,
        document.body
    );
};
