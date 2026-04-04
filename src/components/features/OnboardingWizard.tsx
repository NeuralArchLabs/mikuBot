import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AppConfig, Provider, ModelInfo } from '../../types';
import { Icon, ModernSelect } from '../common/Common';
import { DEFAULT_CONFIG, PROVIDERS } from '../../constants';
import { runHealthCheck, type HealthCheckResult } from '../../services/core/HealthCheck';
import { hydrateAllTemplates, extractTemplatesFromFolderContent, type PromptVariables } from '../../services/core/BlueprintHydrator';

interface OnboardingProps {
    onComplete: (config: AppConfig, handles: any) => Promise<void>;
    models: Record<Provider, ModelInfo[]>;
    loadingModels: Record<Provider, boolean>;
    onTestConnection: (provider?: Provider) => void;
}

export const OnboardingWizard: React.FC<OnboardingProps> = ({ onComplete, models, loadingModels, onTestConnection }) => {
    const { t, i18n } = useTranslation();
    const [step, setStep] = useState(1);
    const [pathMode, setPathMode] = useState<'default' | 'custom'>('default');
    const [defaultPath, setDefaultPath] = useState('');
    const [customPath, setCustomPath] = useState('');
    const [config, setConfig] = useState<AppConfig>({ ...DEFAULT_CONFIG });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [existingData, setExistingData] = useState<{ exists: boolean; found: string[] }>({ exists: false, found: [] });
    const [cleanInstall, setCleanInstall] = useState(false);
    const [showingWarning, setShowingWarning] = useState(false);

    // Personalization Variables
    const [userName, setUserName] = useState('');
    const [userTone, setUserTone] = useState('');
    const [technicalLevel, setTechnicalLevel] = useState('');
    const [currentGoal, setCurrentGoal] = useState('');
    const [autonomyMode, setAutonomyMode] = useState('');
    const [assistantAlias, setAssistantAlias] = useState('mikuBot');
    const [verbosity, setVerbosity] = useState('');
    const [humorLevel, setHumorLevel] = useState('');

    // Predefined Keys for Migration
    const PERSONALITY_KEYS = ['formal', 'casual', 'direct', 'teacher'];
    const VERBOSITY_KEYS = ['verbosity_concise', 'verbosity_medium', 'verbosity_detailed'];
    const HUMOR_KEYS = ['humor_none', 'humor_low', 'humor_high'];
    const TECH_KEYS = ['beginner', 'intermediate', 'expert'];
    const AUTONOMY_KEYS = ['autonomy_manual', 'autonomy_assisted', 'autonomy_automatic'];

    // Track previous language to allow value migration
    const prevLangRef = useRef(i18n.language);

    // Initialize/Migrate localized defaults
    useEffect(() => {
        const prevLang = prevLangRef.current;
        const currentLang = i18n.language;

        // Helper to migrate a value if it was a predefined option in the previous language
        const migrate = (currentVal: string, keys: string[], prefix: string) => {
            if (!currentVal) return t(`${prefix}.${keys[0]}`); // Initial default
            
            // Try to find which key the current value belongs to by checking translations in ALL languages
            // (Standard i18next approach: check if it matches a translation in the old language)
            for (const key of keys) {
                const oldTranslation = i18n.getResource(prevLang, 'translation', `${prefix}.${key}`);
                if (currentVal === oldTranslation) {
                    return t(`${prefix}.${key}`);
                }
            }
            return currentVal; // Keep manual entry
        };

        // Special migration for goals (dynamic object)
        const migrateGoal = (currentVal: string) => {
            const goalsObjOld = i18n.getResource(prevLang, 'translation', 'onboarding.status.goals');
            if (goalsObjOld && typeof goalsObjOld === 'object') {
                const goalKeys = Object.keys(goalsObjOld);
                for (const key of goalKeys) {
                    if (currentVal === (goalsObjOld as any)[key]) {
                        return t(`onboarding.status.goals.${key}`);
                    }
                }
            }
            return currentVal;
        };

        setUserTone(prev => migrate(prev, PERSONALITY_KEYS, 'onboarding.personality'));
        setTechnicalLevel(prev => migrate(prev, TECH_KEYS, 'onboarding.status'));
        setAutonomyMode(prev => migrate(prev, AUTONOMY_KEYS, 'onboarding.status'));
        setVerbosity(prev => migrate(prev, VERBOSITY_KEYS, 'onboarding.personality'));
        setHumorLevel(prev => migrate(prev, HUMOR_KEYS, 'onboarding.personality'));
        setCurrentGoal(prev => {
            if (!prev) return t('onboarding.status.goals.assistant');
            return migrateGoal(prev);
        });

        prevLangRef.current = currentLang;
    }, [i18n.language]); // Run whenever language changes
    
    // Dynamic List States
    const [newContext, setNewContext] = useState('');
    const [contextList, setContextList] = useState<string[]>([]);
    const [userContext, setUserContext] = useState('');
    const [showManualTone, setShowManualTone] = useState(false);

    const [newRule, setNewRule] = useState('');
    const [rulesList, setRulesList] = useState<string[]>([]);
    const [customRules, setCustomRules] = useState('');
    const [isGoalMenuOpen, setIsGoalMenuOpen] = useState(false);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    const [telegramBotToken, setTelegramBotToken] = useState('');
    const [telegramChatId, setTelegramChatId] = useState('');

    const [healthStatus, setHealthStatus] = useState<HealthCheckResult | null>(null);
    const healthIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const performHealthCheck = useCallback(async () => {
        try {
            const result = await runHealthCheck();
            setHealthStatus(result);
        } catch { }
    }, []);

    useEffect(() => {
        if ([4, 5, 8].includes(step)) {
            performHealthCheck();
            healthIntervalRef.current = setInterval(performHealthCheck, 8000);
        } else if (healthIntervalRef.current) {
            clearInterval(healthIntervalRef.current);
            healthIntervalRef.current = null;
        }
        return () => { if (healthIntervalRef.current) clearInterval(healthIntervalRef.current); };
    }, [step, performHealthCheck]);

    useEffect(() => {
        const fetchDefault = async () => {
            if ((window as any).electron) {
                const res = await (window as any).electron.getDefaultPath();
                if (res.ok) { setDefaultPath(res.path); setCustomPath(res.path); }
            }
        };
        fetchDefault();
    }, []);

    // Refresh models when entering Neural Engines configuration
    useEffect(() => {
        if (step === 9) {
            ['gemini', 'groq', 'ollama', 'zai'].forEach(p => {
                onTestConnection(p as Provider);
            });
        }
    }, [step, onTestConnection]);

    const selectedPath = pathMode === 'default' ? defaultPath : customPath;

    useEffect(() => {
        const checkExisting = async () => {
            if ((window as any).electron && selectedPath) {
                const res = await (window as any).electron.fsCheckExisting(selectedPath);
                if (res.exists) { setExistingData(res); setShowingWarning(true); }
                else { setExistingData({ exists: false, found: [] }); setShowingWarning(false); setCleanInstall(true); }
            }
        };
        checkExisting();
    }, [selectedPath]);

    const finish = async () => {
        setLoading(true);
        try {
            if ((window as any).electron) {
                const setupRes = await (window as any).electron.setupOnboarding({ targetPath: selectedPath, cleanInstall });
                if (!setupRes.ok) throw new Error(setupRes.error);
            }
            const cleanPath = selectedPath.replace(/\\/g, '/');
            
            // Format dynamic lists for template hydration
            const formattedRules = rulesList.length > 0 
                ? rulesList.map(r => `- ${r}`).join('\n') 
                : t('onboarding.protocol.no_rules');

            const formattedContext = contextList.length > 0
                ? contextList.map(c => `- ${c}`).join('\n')
                : t('onboarding.protocol.no_context');

            const nextConfig = {
                ...config,
                isConfigured: true,
                telegramBotToken, telegramChatId,
                userName, assistantAlias, tone: userTone, technicalSkill: technicalLevel,
                currentGoal, autonomyMode, userContextDump: formattedContext,
                verbosity, humorLevel, customRules: formattedRules,
                folderPaths: {
                    core: cleanPath + '/core',
                    tools: cleanPath + '/commands',
                    workSpace: cleanPath + '/workspace',
                    extra: cleanPath + '/library'
                }
            };
            
            if ((window as any).electron) {
                const folderRes = await (window as any).electron.readFolder(nextConfig.folderPaths.tools);
                if (folderRes.ok && folderRes.files) {
                    const templateContent = extractTemplatesFromFolderContent(folderRes.files);
                    const variables: PromptVariables = {
                        LANGUAGE: i18n.language === 'es' ? 'Español' : i18n.language === 'zh' ? '中文' : 'English',
                        TONE: userTone, VERBOSITY: verbosity, HUMOR_LEVEL: humorLevel,
                        USER_NAME: userName || (i18n.language === 'es' ? 'Usuario' : 'User'), ASSISTANT_ALIAS: assistantAlias || 'mikuBot',
                        TECHNICAL_SKILL: technicalLevel, CURRENT_GOAL: currentGoal, AUTONOMY_MODE: autonomyMode,
                        USER_CONTEXT_DUMP: formattedContext,
                        CUSTOM_RULES: formattedRules,
                    };
                    const hydrated = hydrateAllTemplates(variables, templateContent, i18n.language);
                    for (const file of hydrated) {
                        await (window as any).electron.writeFile({
                            folderPath: file.target === 'core' ? nextConfig.folderPaths.core : nextConfig.folderPaths.tools,
                            filename: file.filename, content: file.content
                        });
                    }
                }
            }
            await onComplete(nextConfig, { targetPath: selectedPath });
        } catch (err: any) { setError(err.message || t('onboarding.errors.fatal')); } finally { setLoading(false); }
    };

    return (
        <div className={`fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/98 backdrop-blur-3xl ${step === 9 ? 'overflow-visible' : 'overflow-hidden'} p-2 md:p-4 app-region-drag`}>
            <style>{`
                @keyframes premiumIn {
                    from { opacity: 0; transform: scale(0.99) translateY(10px); filter: blur(8px); }
                    to { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
                }
                .animate-premium {
                    animation: premiumIn 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
            <div className={`bg-slate-900/60 backdrop-blur-3xl border-none shadow-[0_45px_120px_-25px_rgba(0,0,0,1)] w-full h-full md:w-[98vw] md:h-[95vh] max-w-6xl max-h-[610px] rounded-[2rem] md:rounded-[2.5rem] ${step === 9 ? 'overflow-visible' : 'overflow-hidden'} flex flex-col relative transition-all duration-700 app-region-no-drag`}>
                
                {/* Header */}
                <div className="h-14 md:h-16 shrink-0 border-b border-white/5 flex items-center px-8 bg-slate-950/25 gap-5 rounded-t-[2rem] md:rounded-t-[2.5rem]">
                    <img src="./mikuBotICON.png" alt="Logo" className="w-6 h-6 object-contain opacity-90 drop-shadow-[0_0_10px_rgba(59,130,246,0.3)] rounded" />
                    <div className="flex items-center gap-3.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.6)] shrink-0" />
                        <div className="flex flex-col items-start">
                            <h2 className="text-sm md:text-base lg:text-lg font-black text-white tracking-tight leading-none mb-1">{t('onboarding.subtitle')}</h2>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">{t('onboarding.title')}</p>
                        </div>
                    </div>
                    <div className="ml-auto flex items-center gap-4">
                        {/* Language Selector */}
                        <div className="flex gap-1.5 bg-slate-950/40 p-1.5 rounded-2xl border border-white/5 backdrop-blur-3xl shrink-0">
                            {[
                                { code: 'es', label: 'Español', icon: '🇪🇸' },
                                { code: 'en', label: 'English', icon: '🇺🇸' },
                                { code: 'zh', label: '中文', icon: '🇨🇳' }
                            ].map(lang => (
                                <button
                                    key={lang.code}
                                    onClick={() => {
                                        i18n.changeLanguage(lang.code);
                                        setConfig(prev => ({ ...prev, language: lang.code }));
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 ${
                                        i18n.language === lang.code 
                                            ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]' 
                                            : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                    }`}
                                >
                                    <span className="text-xs">{lang.icon}</span>
                                    <span>{lang.label}</span>
                                </button>
                            ))}
                        </div>
                        {error && <div className="bg-red-600/10 border border-red-600/20 px-5 py-2 rounded-2xl text-[10px] text-red-500 font-black animate-shake uppercase tracking-widest">{error}</div>}
                    </div>
                </div>

                {/* Content Body */}
                <div className={`flex-1 ${step === 9 ? 'overflow-visible z-[1000]' : 'overflow-hidden z-10'} px-8 py-2 md:px-14 flex flex-col items-center justify-start relative pt-4 md:pt-8`}>
                    
                    {step === 1 && (
                        <div className="w-full max-w-5xl grid grid-cols-2 gap-8 lg:gap-16 items-center animate-premium py-6 relative">

                            <div className="flex flex-col items-center text-center space-y-6 md:space-y-8">
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-blue-500/15 blur-[120px] rounded-full scale-125" />
                                    <div className="w-32 h-32 md:w-52 md:h-52 rounded-[4.5rem] bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center shadow-2xl relative z-10 hover:scale-105 transition-transform duration-1000 overflow-hidden">
                                        <img src="./mikuBotICON.png" alt="Miku" className="w-full h-full object-cover rounded-[4rem]" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <h1 className="text-4xl md:text-6xl font-black text-slate-100 tracking-tighter leading-none uppercase">{t('onboarding.welcome.title')}</h1>
                                    <p className="text-blue-200/80 text-sm md:text-lg leading-relaxed font-serif italic tracking-wide">{t('onboarding.welcome.subtitle')}</p>
                                </div>
                            </div>
                            
                            <div className="space-y-4 bg-slate-950/40 p-8 rounded-[3.5rem] shadow-inner border border-transparent hover:border-blue-500/20 transition-all backdrop-blur-xl group">
                                <h3 className="text-[11px] font-black text-blue-500 uppercase tracking-[0.5em] mb-4 text-center">{t('onboarding.welcome.phases')}</h3>
                                {[
                                    { t: t('onboarding.welcome.workspace'), d: t('onboarding.welcome.workspace_desc'), i: 'folder', c: 'emerald' },
                                    { t: t('onboarding.welcome.identity'), d: t('onboarding.welcome.identity_desc'), i: 'user', c: 'purple' },
                                    { t: t('onboarding.welcome.providers'), d: t('onboarding.welcome.providers_desc'), i: 'bolt', c: 'orange' },
                                    { t: t('onboarding.welcome.remote'), d: t('onboarding.welcome.remote_desc'), i: 'paper-plane', c: 'cyan' },
                                ].map((item, idx) => (
                                    <div key={idx} className="flex gap-5 items-start">
                                        <div className={`w-10 h-10 rounded-2xl bg-slate-900/80 flex items-center justify-center shrink-0 shadow-lg border border-transparent transition-all group-hover:border-${item.c}-500/30`}>
                                            <Icon name={item.i} className="text-xs text-slate-500" />
                                        </div>
                                        <div>
                                            <div className="text-[11px] font-black text-white uppercase tracking-widest">{item.t}</div>
                                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight opacity-50">{item.d}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="w-full max-w-4xl space-y-6 animate-premium flex flex-col justify-center h-full py-4">
                            <div className="text-center">
                                <h2 className="text-2xl font-black text-white tracking-[0.2em] uppercase mb-0.5">{t('onboarding.workspace.title')}</h2>
                                <p className="text-slate-500 text-[9px] font-bold uppercase tracking-[0.4em] opacity-40">{t('onboarding.workspace.subtitle')}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                {[
                                    { id: 'default', t: t('onboarding.workspace.default'), d: t('onboarding.workspace.default_desc'), p: defaultPath, i: 'folder', c: 'emerald' },
                                    { id: 'custom', t: t('onboarding.workspace.custom'), d: t('onboarding.workspace.custom_desc'), p: customPath, i: 'pen', c: 'indigo' }
                                ].map(o => (
                                    <div key={o.id} onClick={() => setPathMode(o.id as any)} className={`p-5 md:p-6 rounded-[2.5rem] cursor-pointer transition-all duration-500 bg-slate-950/40 relative overflow-hidden flex flex-col justify-start gap-4 border border-transparent ${pathMode === o.id ? `shadow-[0_20px_50px_rgba(0,0,0,0.3)] bg-${o.c}-500/10` : `hover:border-${o.c}-500/30 hover:bg-slate-900/60`}`}>
                                        <div className="flex items-center justify-between shrink-0">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${pathMode === o.id ? `bg-${o.c}-600 text-white` : 'bg-slate-800 text-slate-600'}`}>
                                                <Icon name={o.i} className="text-2xl" />
                                            </div>
                                            {pathMode === o.id && <div className={`text-[9px] font-black uppercase tracking-[0.3em] text-${o.c}-500`}>{t('onboarding.workspace.selected')}</div>}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-lg font-black text-white uppercase tracking-widest leading-none mb-2">{o.t}</div>
                                            <div className="text-[8.5px] text-slate-500 font-mono truncate bg-black/50 p-3 rounded-xl border border-transparent mb-3 shadow-inner">{o.p}</div>
                                            <p className="text-[8.5px] text-slate-600 font-black uppercase tracking-widest opacity-80">{o.d}</p>
                                        </div>
                                        {o.id === 'custom' && pathMode === 'custom' && (
                                            <button onClick={async (e) => { e.stopPropagation(); const r = await (window as any).electron.selectFolder(); if(r.ok) setCustomPath(r.path); }} className="mt-auto bg-indigo-600 text-white px-6 py-3 rounded-[1.2rem] text-[9px] font-black uppercase tracking-widest shadow-2xl hover:bg-indigo-500 active:scale-95 transition-all">{t('common.explore')}</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {showingWarning && (
                                <div className="bg-slate-950/60 p-5 rounded-[2rem] shadow-inner flex items-center justify-between gap-4 border border-transparent hover:border-orange-500/20 animate-premium transition-all">
                                    <div className="flex items-center gap-3">
                                        <Icon name="exclamation-triangle" className="text-orange-500 text-2xl" />
                                        <div className="text-[9px] text-slate-300 font-black uppercase tracking-widest leading-tight">{t('onboarding.workspace.detection_warning')}<br/><span className="text-orange-400 opacity-80 text-[8px]">{t('onboarding.workspace.action_required')}</span></div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => {setCleanInstall(false); setShowingWarning(false);}} className={`px-4 py-2 rounded-xl text-[8.5px] font-black uppercase tracking-widest transition-all ${!cleanInstall ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>{t('onboarding.workspace.link')}</button>
                                        <button onClick={() => {setCleanInstall(true); setShowingWarning(false);}} className={`px-4 py-2 rounded-xl text-[8.5px] font-black uppercase tracking-widest transition-all ${cleanInstall ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>{t('onboarding.workspace.clean')}</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="w-full max-w-2xl space-y-8 animate-premium h-full flex flex-col justify-center py-6">
                            <div className="text-center">
                                <h1 className="text-3xl font-black text-white uppercase tracking-widest mb-1">{t('onboarding.identity.title')}</h1>
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] opacity-40">{t('onboarding.identity.subtitle')}</p>
                            </div>
                            <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[9px] font-black text-slate-500 uppercase ml-6 tracking-[0.4em]">{t('onboarding.identity.user_name')}</label>
                                    <input value={userName} onChange={(e)=>setUserName(e.target.value)} placeholder={t('onboarding.identity.user_name_placeholder')} className="w-full bg-slate-950/40 border-2 border-transparent hover:border-cyan-500/30 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-cyan-500/50 transition-all font-black shadow-inner placeholder-slate-800" />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[9px] font-black text-slate-500 uppercase ml-6 tracking-[0.4em]">{t('onboarding.identity.assistant_alias')}</label>
                                    <input value={assistantAlias} onChange={(e)=>setAssistantAlias(e.target.value)} placeholder={t('onboarding.identity.assistant_alias_placeholder')} className="w-full bg-slate-950/40 border-2 border-transparent hover:border-blue-500/30 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-blue-500/50 transition-all font-black shadow-inner placeholder-slate-800" />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="w-full max-w-5xl space-y-5 animate-premium h-full flex flex-col justify-center py-4">
                            <div className="text-center">
                                <h1 className="text-3xl font-black text-white uppercase tracking-widest">{t('onboarding.personality.title')}</h1>
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.5em] opacity-40 text-center">{t('onboarding.personality.subtitle')}</p>
                            </div>
                            <div className="flex justify-center mt-2 mb-10 animate-premium duration-1000">
                                <div className="bg-slate-950/40 p-1.5 rounded-2xl border border-transparent hover:border-white/10 transition-all flex gap-1.5 shadow-inner">
                                    <button 
                                        onClick={() => { setShowManualTone(false); if(userTone === '' || ![t('onboarding.status.goals.assistant'), t('onboarding.status.goals.coding'), t('onboarding.status.goals.automation'), t('onboarding.status.goals.creative')].includes(userTone)) setUserTone(t('onboarding.personality.formal')); }} 
                                        className={`px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!showManualTone ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        {t('onboarding.personality.predefined')}
                                    </button>
                                    <button 
                                        onClick={() => { setShowManualTone(true); setUserTone(''); }} 
                                        className={`px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showManualTone ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        {t('onboarding.personality.manual')}
                                    </button>
                                </div>
                            </div>

                            {!showManualTone ? (
                                <div className="grid grid-cols-4 gap-4 animate-premium">
                                    {[
                                        { v: t('onboarding.personality.formal'), t: t('onboarding.personality.formal'), i: 'briefcase', d: t('onboarding.personality.formal_desc'), bg: 'bg-purple-500/10', border: 'hover:border-purple-500/30', icon: 'bg-purple-600' },
                                        { v: t('onboarding.personality.casual'), t: t('onboarding.personality.casual'), i: 'coffee', d: t('onboarding.personality.casual_desc'), bg: 'bg-amber-500/10', border: 'hover:border-amber-500/30', icon: 'bg-amber-600' },
                                        { v: t('onboarding.personality.direct'), t: t('onboarding.personality.direct'), i: 'bolt', d: t('onboarding.personality.direct_desc'), bg: 'bg-sky-500/10', border: 'hover:border-sky-500/30', icon: 'bg-sky-600' },
                                        { v: t('onboarding.personality.teacher'), t: t('onboarding.personality.teacher'), i: 'book', d: t('onboarding.personality.teacher_desc'), bg: 'bg-rose-500/10', border: 'hover:border-rose-500/30', icon: 'bg-rose-600' },
                                    ].map(o => (
                                        <div 
                                            key={o.v} 
                                            onClick={() => setUserTone(o.v)} 
                                            className={`p-4 rounded-2xl cursor-pointer text-center transition-all duration-500 border border-transparent ${userTone === o.v ? `${o.bg} shadow-[0_0_20px_rgba(0,0,0,0.3)] scale-105` : `bg-slate-950/30 ${o.border} hover:bg-slate-900/50 opacity-80 hover:opacity-100`}`}
                                        >
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 transition-all ${userTone === o.v ? `${o.icon} text-white shadow-xl` : 'bg-slate-800 text-slate-600'}`}>
                                                <Icon name={o.i} className="text-xl" />
                                            </div>
                                            <div className="text-xs font-black text-white uppercase tracking-widest mb-1">{o.t}</div>
                                            <p className="text-[9px] text-slate-500 font-bold uppercase leading-tight tracking-tighter opacity-80">{o.d}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="animate-premium w-full max-w-2xl mx-auto py-2">
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-500 uppercase ml-8 tracking-[0.4em]">{t('onboarding.personality.custom_personality')}</label>
                                        <input 
                                            autoFocus 
                                            value={userTone}
                                            placeholder={t('onboarding.personality.custom_personality_placeholder')} 
                                            className="w-full bg-slate-950/60 border-2 border-transparent hover:border-indigo-500/30 rounded-2xl px-10 py-6 text-base font-black text-white outline-none focus:border-indigo-500/50 shadow-inner placeholder-slate-800 transition-all font-mono"
                                            onChange={(e) => setUserTone(e.target.value)}
                                        />
                                        <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest ml-8 opacity-60">{t('onboarding.personality.custom_personality_hint')}</p>
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-500 uppercase block text-center tracking-[0.5em]">{t('onboarding.personality.verbosity')}</label>
                                    <ModernSelect
                                        value={verbosity}
                                        onChange={(val) => {
                                            if (val === 'CUSTOM') setVerbosity('custom');
                                            else setVerbosity(val);
                                        }}
                                        placeholder={t('onboarding.personality.verbosity')}
                                        iconVariant="plus"
                                        dropDirection="up"
                                        options={[
                                            { value: t('onboarding.personality.verbosity_concise'), label: t('onboarding.personality.verbosity_concise') },
                                            { value: t('onboarding.personality.verbosity_medium'), label: t('onboarding.personality.verbosity_medium') },
                                            { value: t('onboarding.personality.verbosity_detailed'), label: t('onboarding.personality.verbosity_detailed') },
                                            { value: 'CUSTOM', label: t('common.custom') }
                                        ]}
                                    />
                                    {verbosity === 'custom' && setVerbosity(t('onboarding.personality.verbosity_example'))}
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-500 uppercase block text-center tracking-[0.5em]">{t('onboarding.personality.humor')}</label>
                                    <ModernSelect
                                        value={humorLevel}
                                        onChange={(val) => {
                                            if (val === 'CUSTOM') setHumorLevel('custom');
                                            else setHumorLevel(val);
                                        }}
                                        placeholder={t('onboarding.personality.humor')}
                                        iconVariant="plus"
                                        dropDirection="up"
                                        options={[
                                            { value: t('onboarding.personality.humor_none'), label: t('onboarding.personality.humor_none') },
                                            { value: t('onboarding.personality.humor_low'), label: t('onboarding.personality.humor_low') },
                                            { value: t('onboarding.personality.humor_high'), label: t('onboarding.personality.humor_high') },
                                            { value: 'CUSTOM', label: t('common.custom') }
                                        ]}
                                    />
                                    {humorLevel === 'custom' && setHumorLevel(t('onboarding.personality.humor_example'))}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 5 && (
                        <div className="w-full max-w-4xl space-y-8 animate-premium h-full flex flex-col justify-center py-4">
                            <div className="text-center">
                                <h1 className="text-3xl font-black text-white uppercase tracking-widest">{t('onboarding.status.title')}</h1>
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.5em] opacity-40 text-center">{t('onboarding.status.subtitle')}</p>
                            </div>
                             <div className="grid grid-cols-2 gap-8 items-start">
                                <div className="space-y-5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase block text-center tracking-[0.5em]">{t('onboarding.status.technical_level')}</label>
                                    {!TECH_KEYS.map(k => t(`onboarding.status.${k}`)).includes(technicalLevel) && technicalLevel !== '' ? (
                                        <div className="relative animate-premium">
                                            <input title={t('onboarding.status.custom_tech_title')} placeholder={t('onboarding.status.technical_placeholder')} value={technicalLevel} onChange={(e)=>setTechnicalLevel(e.target.value)} autoFocus className="w-full bg-slate-950/70 border-2 border-transparent hover:border-orange-500/30 focus:border-orange-500/50 rounded-2xl px-6 py-4 text-xs text-white outline-none transition-all font-black text-center shadow-inner" />
                                            <button onClick={()=>setTechnicalLevel(t('onboarding.status.intermediate'))} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center border border-white/10 transition-all">×</button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3">
                                            {[t('onboarding.status.beginner'), t('onboarding.status.intermediate'), t('onboarding.status.expert')].map(l => (
                                                <div key={l} onClick={() => setTechnicalLevel(l)} className={`py-4 rounded-xl text-[9px] font-black uppercase text-center cursor-pointer transition-all border border-transparent ${technicalLevel === l ? 'bg-orange-500/15 text-orange-400 shadow-lg' : 'bg-slate-950/40 text-slate-500 hover:border-orange-500/20 hover:bg-slate-900/40'}`}>{l}</div>
                                            ))}
                                            <div onClick={() => setTechnicalLevel(t('common.custom') + '...')} className="py-4 rounded-xl text-[9px] font-black uppercase text-center cursor-pointer transition-all border border-transparent bg-slate-950/40 text-slate-600 hover:text-white hover:border-white/10 italic">{t('common.custom')}</div>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase block text-center tracking-[0.5em]">{t('onboarding.status.autonomy_mode')}</label>
                                    {!AUTONOMY_KEYS.map(k => t(`onboarding.status.${k}`)).includes(autonomyMode) && autonomyMode !== '' ? (
                                        <div className="relative animate-premium">
                                            <input title={t('onboarding.status.custom_autonomy_title')} placeholder={t('onboarding.status.autonomy_placeholder')} value={autonomyMode} onChange={(e)=>setAutonomyMode(e.target.value)} autoFocus className="w-full bg-slate-950/70 border-2 border-transparent hover:border-indigo-500/30 focus:border-indigo-500/50 rounded-2xl px-6 py-4 text-xs text-white outline-none transition-all font-black text-center shadow-inner" />
                                            <button onClick={()=>setAutonomyMode(t('onboarding.status.autonomy_assisted'))} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center border border-white/10 transition-all">×</button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3">
                                            {[t('onboarding.status.autonomy_manual'), t('onboarding.status.autonomy_assisted'), t('onboarding.status.autonomy_automatic')].map(l => (
                                                <div key={l} onClick={() => setAutonomyMode(l)} className={`py-4 rounded-xl text-[9px] font-black uppercase text-center cursor-pointer transition-all border border-transparent ${autonomyMode === l ? 'bg-indigo-500/15 text-indigo-400 shadow-lg' : 'bg-slate-950/40 text-slate-500 hover:border-indigo-500/20 hover:bg-slate-900/40'}`}>{l}</div>
                                            ))}
                                            <div onClick={() => setAutonomyMode(t('common.custom') + '...')} className="py-4 rounded-xl text-[9px] font-black uppercase text-center cursor-pointer transition-all border border-transparent bg-slate-950/40 text-slate-600 hover:text-white hover:border-white/10 italic">{t('common.custom')}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-3 pt-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase ml-6 tracking-[0.5em]">{t('onboarding.status.goal_title')}</label>
                                {!Object.values(t('onboarding.status.goals', { returnObjects: true }) as any).includes(currentGoal) && currentGoal !== '' ? (
                                    <div className="relative animate-premium group">
                                        <input 
                                            title={t('onboarding.status.custom_goal_title')}
                                            placeholder={t('onboarding.status.goal_placeholder')} 
                                            value={currentGoal} 
                                            onChange={(e) => setCurrentGoal(e.target.value)} 
                                            className="w-full bg-slate-950/50 border border-transparent hover:border-blue-500/30 rounded-2xl px-8 py-5 text-sm text-white outline-none focus:border-blue-500/60 transition-all font-black shadow-inner" 
                                        />
                                        <button onClick={()=>setCurrentGoal(t('onboarding.status.goals.assistant'))} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center border border-white/10 transition-all">×</button>
                                    </div>
                                ) : (
                                    <ModernSelect
                                        value={currentGoal}
                                        onChange={(val) => {
                                            if (val === 'CUSTOM') setCurrentGoal('custom');
                                            else setCurrentGoal(val);
                                        }}
                                        placeholder={t('onboarding.status.goal_placeholder')}
                                        iconVariant="plus"
                                        dropDirection="up"
                                        options={[
                                            ...Object.values(t('onboarding.status.goals', { returnObjects: true }) as any).map((g: any) => ({ value: g, label: g })),
                                            { value: 'CUSTOM', label: t('common.custom') }
                                        ]}
                                    />
                                )}
                                {currentGoal === 'custom' && setCurrentGoal(t('onboarding.status.goal_example'))}
                            </div>
                        </div>
                    )}

                    {step === 6 && (
                        <div className="w-full max-w-5xl space-y-8 animate-premium h-full flex flex-col justify-center">
                            <div className="text-center">
                                <h1 className="text-3xl font-black text-white uppercase tracking-widest mb-1">{t('onboarding.protocol.title')}</h1>
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.6em] opacity-40">{t('onboarding.protocol.subtitle')}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <label className="text-[11px] font-black text-slate-500 uppercase ml-12 tracking-[0.5em]">{t('onboarding.protocol.bio_title')}</label>
                                    <div className="bg-slate-950/40 border-2 border-transparent hover:border-blue-500/30 rounded-[3rem] px-5 py-6 shadow-inner flex flex-col h-[180px] lg:h-52 transition-all overflow-hidden">
                                        <div className="flex-1 overflow-y-auto custom-scrollbar mr-2 ml-1 space-y-2 mb-4 px-2 py-1">
                                            {contextList.length === 0 && (
                                                <p className="text-slate-600 font-bold text-xs mt-4 text-center">{t('onboarding.protocol.bio_example')}</p>
                                            )}
                                            {contextList.map((c, idx) => (
                                                <div key={idx} className="flex gap-3 items-center bg-slate-900/60 px-4 py-3 rounded-[1.5rem] group/ctx">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                                    <span className="text-xs text-slate-300 font-bold leading-tight flex-1">{c}</span>
                                                    <button onClick={() => setContextList(contextList.filter((_, i) => i !== idx))} className="text-slate-600 hover:text-blue-500 transition-colors" aria-label={t('common.delete')}>
                                                        <Icon name="times" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-2 relative mt-auto">
                                            <input value={newContext} onChange={(e) => setNewContext(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newContext.trim()) { setContextList([...contextList, newContext.trim()]); setNewContext(''); } }} placeholder={t('onboarding.protocol.bio_placeholder')} className="w-full bg-slate-900/80 border border-transparent rounded-[2rem] pl-6 pr-24 py-4 text-xs text-white outline-none focus:border-blue-500/40 transition-all font-bold placeholder-slate-700 shadow-inner" />
                                            <button onClick={() => { if (newContext.trim()) { setContextList([...contextList, newContext.trim()]); setNewContext(''); } }} className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-500 text-white px-5 rounded-[1.5rem] font-black text-[9px] uppercase tracking-widest transition-all shadow-lg active:scale-95">{t('common.add')}</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[11px] font-black text-slate-500 uppercase ml-12 tracking-[0.5em]">{t('onboarding.protocol.rules_title')}</label>
                                    <div className="bg-slate-950/40 border-2 border-transparent hover:border-rose-500/30 rounded-[3rem] px-5 py-6 shadow-inner flex flex-col h-[180px] lg:h-52 transition-all overflow-hidden">
                                        <div className="flex-1 overflow-y-auto custom-scrollbar mr-2 ml-1 space-y-2 mb-4 px-2 py-1">
                                            {rulesList.length === 0 && (
                                                <p className="text-slate-600 font-bold text-xs mt-4 text-center">{t('onboarding.protocol.rules_example')}</p>
                                            )}
                                            {rulesList.map((r, idx) => (
                                                <div key={idx} className="flex gap-3 items-center bg-slate-900/60 px-4 py-3 rounded-[1.5rem] group/rule">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                                                    <span className="text-xs text-slate-300 font-bold leading-tight flex-1">{r}</span>
                                                    <button onClick={() => setRulesList(rulesList.filter((_, i) => i !== idx))} className="text-slate-600 hover:text-rose-500 transition-colors" aria-label={t('common.delete')}>
                                                        <Icon name="times" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-2 relative mt-auto">
                                            <input value={newRule} onChange={(e) => setNewRule(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newRule.trim()) { setRulesList([...rulesList, newRule.trim()]); setNewRule(''); } }} placeholder={t('onboarding.protocol.rules_placeholder')} className="w-full bg-slate-900/80 border border-transparent rounded-[2rem] pl-6 pr-24 py-4 text-xs text-white outline-none focus:border-rose-500/40 transition-all font-bold placeholder-slate-700 shadow-inner" />
                                            <button onClick={() => { if (newRule.trim()) { setRulesList([...rulesList, newRule.trim()]); setNewRule(''); } }} className="absolute right-2 top-2 bottom-2 bg-rose-600 hover:bg-rose-500 text-white px-5 rounded-[1.5rem] font-black text-[9px] uppercase tracking-widest transition-all shadow-lg active:scale-95">{t('common.add')}</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 7 && (
                        <div className="w-full max-w-6xl space-y-6 animate-premium h-full flex flex-col justify-center py-4 text-white">
                            <div className="text-center space-y-2">
                                <h1 className="text-2xl font-black uppercase tracking-widest leading-none">{t('onboarding.providers.title')}</h1>
                                <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.4em] opacity-60 text-center">{t('onboarding.providers.subtitle')}</p>
                                <p className="text-blue-400 text-[8px] font-bold uppercase tracking-[0.2em] max-w-xl mx-auto border border-transparent hover:border-blue-500/30 transition-all bg-blue-500/10 px-6 py-2 rounded-2xl shadow-inner text-center">{t('onboarding.providers.hint')}</p>
                            </div>
                            <div className="grid grid-cols-4 gap-4">
                                {[
                                    { id: 'gemini', t: 'Google AI', m: 'Gemini', i: './geminiICON.png', url: 'https://aistudio.google.com/', inv: false, hc: 'hover:border-blue-500/40 hover:bg-blue-900/10 hover:shadow-[0_0_40px_-10px_rgba(59,130,246,0.3)]', c: 'blue', desc: t('onboarding.providers.gemini_desc') },
                                    { id: 'groq', t: 'Groq Cloud', m: 'LPU', i: './groqICON.png', url: 'https://console.groq.com/keys', inv: true, hc: 'hover:border-orange-500/40 hover:bg-orange-900/10 hover:shadow-[0_0_40px_-10px_rgba(249,115,22,0.3)]', c: 'orange', desc: t('onboarding.providers.groq_desc') },
                                    { id: 'zai', t: 'Z.AI', m: 'Avanzado', i: './zai.png', url: 'https://z.ai/subscribe', inv: true, hc: 'hover:border-violet-500/40 hover:bg-violet-900/10 hover:shadow-[0_0_40px_-10px_rgba(139,92,246,0.3)]', c: 'violet', desc: t('onboarding.providers.zai_desc') },
                                    { id: 'ollama', t: 'Ollama', i: './ollamaICON.webp', url: 'https://ollama.com/download', inv: true, hc: 'hover:border-emerald-500/40 hover:bg-emerald-900/10 hover:shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)]', c: 'emerald', m: 'Local', desc: t('onboarding.providers.ollama_desc') },
                                ].map(p => (
                                    <div key={p.id} className={`p-6 rounded-[2rem] bg-slate-950/40 text-center flex flex-col items-center justify-between group transition-all duration-500 border border-transparent ${p.hc} min-h-[240px]`}>
                                        <div className={`w-14 h-14 shrink-0 rounded-2xl bg-slate-800/60 flex items-center justify-center p-3 mb-4 transition-all group-hover:scale-110 shadow-inner border border-transparent group-hover:border-${p.c}-500/20`}>
                                            <img src={p.i} alt="" className={`w-full h-full object-contain transition-all duration-500 ${p.inv ? 'brightness-0 invert opacity-40 group-hover:invert-0 group-hover:brightness-100 group-hover:opacity-100 group-hover:drop-shadow-[0_4px_12px_rgba(255,255,255,0.3)]' : 'opacity-40 grayscale group-hover:grayscale-0 group-hover:opacity-100 group-hover:drop-shadow-[0_0_15px_rgba(59,130,246,0.4)]'}`} />
                                        </div>
                                        <div className="mb-4 space-y-1 flex-grow flex flex-col justify-center">
                                            <div className="text-[11px] font-black uppercase tracking-widest leading-none text-white/90">{p.t}</div>
                                            <div className="text-[8px] text-slate-500 font-bold leading-snug px-2 opacity-80">{p.desc}</div>
                                        </div>
                                        <button 
                                            onClick={() => window.open(p.url, '_blank', 'nodeIntegration=no')} 
                                            className={`w-full py-2.5 rounded-[1.2rem] bg-slate-800 transition-all duration-300 shadow-lg text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white group-hover:bg-slate-700 hover:scale-105 active:scale-95 shrink-0`}
                                        >
                                            {p.id === 'ollama' ? t('onboarding.providers.download') : t('onboarding.providers.get_key')}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 8 && (
                        <div className="w-full max-w-5xl space-y-10 animate-premium h-full flex flex-col justify-center py-6">
                            <div className="text-center">
                                <h1 className="text-3xl font-black text-white uppercase tracking-widest">{t('onboarding.credentials.title')}</h1>
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.5em] opacity-40 text-center">{t('onboarding.credentials.subtitle')}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-10 items-center">
                                <div className="space-y-6 flex flex-col justify-center bg-transparent">
                                    {[
                                        { id: 'gemini', l: t('onboarding.credentials.gemini_label'), c: 'blue' },
                                        { id: 'groq', l: t('onboarding.credentials.groq_label'), c: 'orange' },
                                        { id: 'zai', l: t('onboarding.credentials.zai_label'), c: 'violet' },
                                    ].map(k => (
                                        <div key={k.id} className="space-y-2 relative flex-1">
                                            <label className={`text-[10px] font-black text-slate-500 uppercase ml-4 tracking-[0.4em]`}>{k.l}</label>
                                            <input
                                                type="password"
                                                value={(config.apiKeys as any)[k.id]}
                                                onChange={(e) => setConfig({ ...config, apiKeys: { ...config.apiKeys, [k.id]: e.target.value } })}
                                                placeholder={t('onboarding.credentials.key_placeholder')}
                                                className={`w-full bg-slate-950/60 border border-transparent hover:border-${k.c}-500/30 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-${k.c}-500/60 transition-all font-mono shadow-inner placeholder-slate-800`}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="flex flex-col justify-center space-y-6">
                                    <div className="bg-slate-950/60 p-6 rounded-3xl space-y-4 shadow-inner relative overflow-hidden group border border-transparent hover:border-emerald-500/20 transition-all">
                                        <div className="flex justify-between items-center px-2">
                                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">{t('onboarding.credentials.ollama_url')}</span>
                                            <div className={`w-2.5 h-2.5 rounded-full ${healthStatus ? (healthStatus.ollama.online ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]') : 'bg-amber-500 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.8)]'}`} title={healthStatus ? (healthStatus.ollama.online ? t('onboarding.credentials.ollama_connected') : t('onboarding.credentials.ollama_offline')) : t('onboarding.credentials.ping_checking')} />
                                        </div>
                                        <input 
                                            title={t('onboarding.credentials.ollama_url')}
                                            placeholder="http://localhost:11434"
                                            value={config.ollamaUrl} 
                                            onChange={(e) => setConfig({ ...config, ollamaUrl: e.target.value })} 
                                            className="w-full bg-black/40 border border-transparent hover:border-emerald-500/30 rounded-xl px-5 py-3.5 text-sm text-emerald-500 font-mono outline-none shadow-inner transition-all focus:border-emerald-500/50" 
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className={`px-5 py-4 rounded-3xl flex items-center justify-between gap-3 transition-all border border-transparent ${healthStatus?.searxena.online ? 'bg-emerald-600/10 text-emerald-400 border-emerald-500/30 shadow-lg' : 'bg-slate-950/40 text-slate-600 hover:border-slate-500/10'}`}>
                                            <div className="flex gap-2 items-center">
                                                <Icon name="search" className="text-sm" /> <span className="text-[10px] font-black uppercase tracking-widest">{t('onboarding.credentials.searxena')}</span>
                                            </div>
                                            <div className={`w-2 h-2 rounded-full shrink-0 ${healthStatus ? (healthStatus.searxena.online ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]') : 'bg-amber-500 animate-pulse'}`} title={healthStatus ? (healthStatus.searxena.online ? t('onboarding.credentials.ollama_connected') : t('onboarding.credentials.ollama_offline')) : t('onboarding.credentials.ping_checking')} />
                                        </div>
                                        <div className={`px-5 py-4 rounded-3xl flex flex-col justify-center gap-3 transition-all border border-transparent ${config.voskModelPath ? (healthStatus?.vosk.online ? 'bg-blue-600/10 text-blue-400 border-blue-500/30 shadow-lg' : 'bg-blue-900/10 text-blue-500/80 hover:border-blue-500/10 border-blue-500/10 shadow-inner') : 'bg-slate-950/40 text-slate-600 hover:border-slate-500/10'}`}>
                                            <div className="flex justify-between items-center px-1">
                                                <div className="flex gap-2 items-center">
                                                    <Icon name="microphone" className="text-sm" /> <span className="text-[10px] font-black uppercase tracking-widest">{t('onboarding.credentials.vosk')}</span>
                                                </div>
                                                {config.voskModelPath && healthStatus?.vosk.online && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]" />}
                                            </div>
                                            <ModernSelect
                                                value={config.voskModelPath || ''}
                                                onChange={(val) => setConfig({ ...config, voskModelPath: val })}
                                                placeholder={t('onboarding.credentials.vosk_off')}
                                                iconVariant="plus"
                                                dropDirection="up"
                                                options={[
                                                    { value: '', label: t('onboarding.credentials.vosk_off') },
                                                    { value: 'vosk-model-small-es-0.42', label: t('onboarding.credentials.vosk_es') },
                                                    { value: 'vosk-model-small-en-us-0.15', label: t('onboarding.credentials.vosk_en') }
                                                ]}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {step === 9 && (
                        <div className="w-full max-w-5xl space-y-6 animate-premium h-full flex flex-col justify-center py-4">
                            <div className="text-center">
                                <h1 className="text-2xl font-black text-white uppercase tracking-widest leading-none">{t('onboarding.engines.title')}</h1>
                                <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.4em] opacity-60 text-center">{t('onboarding.engines.subtitle')}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-6 overflow-visible">
                                {[
                                    { id: 'chat', t: t('onboarding.engines.chat_title'), d: t('onboarding.engines.chat_desc'), c: 'cyan', p: config.chatProvider || 'gemini', m: config.chatModel || '', pf: 'chatProvider', mf: 'chatModel' },
                                    { id: 'agent', t: t('onboarding.engines.agent_title'), d: t('onboarding.engines.agent_desc'), c: 'indigo', p: config.agentProvider || 'groq', m: config.agentModel || '', pf: 'agentProvider', mf: 'agentModel' },
                                    { id: 'fallback', t: t('onboarding.engines.fallback_title'), d: t('onboarding.engines.fallback_desc'), c: 'rose', p: config.provider || 'gemini', m: config.model || '', pf: 'provider', mf: 'model' },
                                ].map(engine => {
                                    const PROVIDER_LIST = [
                                        { id: 'gemini', i: './geminiICON.png', c: 'blue' },
                                        { id: 'groq', i: './groqICON.png', c: 'orange' },
                                        { id: 'zai', i: './zai.png', c: 'violet' },
                                        { id: 'ollama', i: './ollamaICON.webp', c: 'emerald' }
                                    ];
                                    const engineProviderColor = PROVIDER_LIST.find(p => p.id === engine.p)?.c || 'blue';
                                    
                                    return (
                                        <div key={engine.id} className={`premium-card p-5 rounded-[2rem] bg-slate-950/40 border-white/5 border transition-all duration-700 relative flex flex-col gap-5 group hover:-translate-y-1 ${activeMenu === engine.id ? 'z-[500]' : 'z-0'}`}>
                                            <div className="shrink-0 relative z-10 px-1">
                                                <h3 className={`text-[10px] font-black uppercase tracking-[0.3em] text-${engineProviderColor}-400 mb-1`}>{engine.t}</h3>
                                                <p className="text-[9px] text-slate-500 font-bold leading-tight opacity-60 uppercase">{engine.d}</p>
                                            </div>
                                            
                                            <div className="space-y-5 relative z-10">
                                                <div>
                                                    <label className="text-[9px] font-black text-slate-500 uppercase ml-1 tracking-[0.2em] mb-2 block opacity-40">{t('onboarding.engines.routing_provider')}</label>
                                                    <div className="grid grid-cols-4 gap-2 !bg-black/20 p-1.5 rounded-2xl border border-white/5 overflow-visible relative z-10">
                                                        {PROVIDER_LIST.map(p => {
                                                            const isSelected = engine.p === p.id;
                                                            const HEX_COLORS: Record<string, string> = {
                                                                blue: '#2563eb',
                                                                orange: '#ea580c',
                                                                violet: '#7c3aed',
                                                                emerald: '#10b981'
                                                            };
                                                            const activeColor = HEX_COLORS[p.c] || '#2563eb';
                                                            
                                                            return (
                                                                <button 
                                                                    key={p.id} 
                                                                    title={p.id}
                                                                    onClick={() => setConfig({ ...config, [engine.pf]: p.id as any })}
                                                                    className={`py-3 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all ${isSelected 
                                                                        ? `text-white shadow-lg ring-1 ring-white/20 scale-105` 
                                                                        : 'hover:bg-white/5 text-slate-400 opacity-60'}`}
                                                                    style={isSelected ? { 
                                                                        backgroundColor: `${activeColor}ee`,
                                                                        boxShadow: `0 10px 15px -3px ${activeColor}66`
                                                                    } : {}}
                                                                >
                                                                    {p.id === 'gemini' ? (
                                                                        <img src={p.i} alt="" className={`w-5 h-5 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]' : 'opacity-40 grayscale'}`} style={isSelected ? { filter: 'none' } : {}} />
                                                                    ) : (
                                                                        <img src={p.i} alt="" className={`w-5 h-5 object-contain transition-all duration-300 ${isSelected ? 'opacity-100 scale-110 drop-shadow-[0_2px_4px_rgba(255,255,255,0.3)]' : 'brightness-0 invert opacity-40'}`} style={isSelected ? { filter: 'none' } : {}} />
                                                                    )}
                                                                    <span className={`text-[7px] font-black uppercase tracking-wider ${isSelected ? 'text-white' : 'text-slate-600'}`}>
                                                                        {PROVIDERS[p.id as Provider]?.name.split(' ')[0] || p.id}
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                <div className="space-y-2 relative">
                                                    <label className="text-[9px] font-black text-slate-500 uppercase ml-1 tracking-[0.2em] mb-2 block opacity-40">{t('onboarding.engines.select_model')}</label>
                                                    <div className="relative group/sel">
                                                        <input 
                                                            value={engine.m} 
                                                            onChange={(e) => setConfig({ ...config, [engine.mf]: e.target.value })}
                                                            placeholder={t('onboarding.engines.typing_placeholder')}
                                                            className={`w-full bg-black/30 border-2 border-transparent hover:border-${engineProviderColor}-500/20 rounded-xl px-4 pr-10 py-3.5 text-xs text-white font-mono outline-none shadow-inner transition-all focus:border-${engineProviderColor}-500/40 focus:bg-black/50`} 
                                                        />
                                                        <div 
                                                            className={`absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-600 hover:text-${engineProviderColor}-400 transition-colors p-1.5`}
                                                            onClick={() => setActiveMenu(activeMenu === engine.id ? null : engine.id)}
                                                        >
                                                            <Icon 
                                                                name={activeMenu === engine.id ? 'times' : 'bars'} 
                                                                className={`text-[10px] transition-all ${activeMenu === engine.id ? 'duration-500 transform rotate-90 scale-125 text-blue-500 opacity-100' : 'duration-200 rotate-0 scale-100 opacity-60'}`} 
                                                            />
                                                        </div>
                                                        {activeMenu === engine.id && (
                                                            <>
                                                                <div className="fixed inset-0 z-[1900]" onClick={() => setActiveMenu(null)} />
                                                                <div className="absolute left-0 right-0 bottom-full mb-2 bg-slate-900/98 backdrop-blur-3xl border border-white/10 rounded-[1.5rem] shadow-2xl z-[2000] py-2 overflow-hidden animate-premium">
                                                                    <div className="max-h-[150px] overflow-y-auto custom-scrollbar mr-2.5 ml-1 py-1">
                                                                        <div className="px-5 py-1 text-[8px] font-black text-slate-500 uppercase border-b border-white/5 mb-2 tracking-widest">{t('onboarding.engines.common_models')}</div>
                                                                        {loadingModels[engine.p as Provider] ? (
                                                                            <div className="px-5 py-4 flex flex-col items-center justify-center gap-2">
                                                                                <Icon name="spinner" className="animate-spin text-blue-500 text-lg" />
                                                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t('common.loading')}</span>
                                                                            </div>
                                                                        ) : (
                                                                            <>
                                                                                {(models[engine.p as Provider] || []).map(m => (
                                                                                    <div 
                                                                                        key={m.id} 
                                                                                        onClick={() => { setConfig({ ...config, [engine.mf]: m.id }); setActiveMenu(null); }} 
                                                                                        className={`px-5 py-2.5 text-xs font-black text-slate-400 hover:bg-${engineProviderColor}-500/10 hover:text-${engineProviderColor}-400 cursor-pointer transition-all truncate flex items-center gap-3 border-l-2 border-transparent hover:border-${engineProviderColor}-500`}
                                                                                    >
                                                                                        <div className={`w-1.5 h-1.5 rounded-full bg-${engineProviderColor}-500 shadow-[0_0_5px_rgba(0,0,0,0.5)]`} />
                                                                                        {m.id}
                                                                                    </div>
                                                                                ))}
                                                                                {(models[engine.p as Provider] || []).length === 0 && (
                                                                                    <div className="px-5 py-3 text-[8px] italic text-red-500/60 font-black uppercase text-center">{t('onboarding.engines.no_models_found')}</div>
                                                                                )}
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Accent Background Glow */}
                                            <div className={`absolute -right-20 -bottom-20 w-48 h-48 bg-${engineProviderColor}-500/5 blur-[100px] rounded-full group-hover:bg-${engineProviderColor}-500/15 transition-all duration-1000 pointer-events-none`} />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {step === 10 && (
                        <div className="w-full max-w-6xl space-y-6 animate-premium h-full flex flex-col justify-center py-4">
                            <div className="text-center">
                                <h1 className="text-2xl font-black text-white uppercase tracking-widest mb-0.5">{t('onboarding.telegram.title')}</h1>
                                <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.4em] opacity-40 text-center">{t('onboarding.telegram.subtitle')}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-8 items-center">
                                <div className="space-y-4 bg-slate-950/40 p-6 lg:p-8 rounded-[2.5rem] shadow-inner relative overflow-hidden group border border-transparent hover:border-cyan-500/20 transition-all h-full flex flex-col justify-center">
                                    <div className="flex items-center gap-3 text-cyan-400 mb-3">
                                        <Icon name="paper-plane" className="text-3xl drop-shadow-[0_0_15px_rgba(34,211,238,0.2)]" />
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-black uppercase tracking-[0.3em]">{t('onboarding.telegram.how_to')}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-3 lg:space-y-4 relative z-10 flex-grow">
                                        {[
                                            { d: t('onboarding.telegram.step1') },
                                            { d: t('onboarding.telegram.step2') },
                                            { d: t('onboarding.telegram.step3') },
                                        ].map((s, i) => (
                                            <div key={i} className="flex gap-4 items-start group/it bg-slate-900/40 p-2.5 rounded-2xl border border-transparent hover:border-cyan-500/20 transition-all">
                                                <span className="w-7 h-7 shrink-0 rounded-xl bg-slate-900/80 text-cyan-500 flex items-center justify-center font-black text-[10px] shadow-lg border border-transparent group-hover/it:border-cyan-500/30 transition-all">{i+1}</span>
                                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-normal pt-1">{s.d}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase ml-6 tracking-[0.4em]">{t('onboarding.telegram.bot_token')}</label>
                                        <input type="password" value={telegramBotToken} onChange={(e)=>setTelegramBotToken(e.target.value)} placeholder={t('onboarding.telegram.token_placeholder')} className="w-full bg-slate-950/60 border-2 border-transparent hover:border-cyan-500/30 rounded-2xl px-6 py-4 text-sm text-white outline-none font-mono focus:border-cyan-500/50 shadow-inner placeholder-slate-800 transition-all" />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase ml-6 tracking-[0.4em]">{t('onboarding.telegram.chat_id')}</label>
                                        <input type="text" value={telegramChatId} onChange={(e)=>setTelegramChatId(e.target.value)} placeholder={t('onboarding.telegram.chat_id_placeholder')} className="w-full bg-slate-950/60 border-2 border-transparent hover:border-blue-500/30 rounded-2xl px-6 py-4 text-sm text-white outline-none font-mono focus:border-blue-500/50 shadow-inner placeholder-slate-800 transition-all" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="h-16 md:h-20 shrink-0 border-t border-white/5 bg-slate-950/40 backdrop-blur-3xl flex justify-between items-center px-6 md:px-10 relative z-10 rounded-b-[2rem] md:rounded-b-[2.5rem]">
                    <div className="flex gap-1.5 md:gap-2.5 items-center">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                            <div 
                                key={i} 
                                className={`rounded-full transition-all duration-1000 ${
                                    step >= i 
                                        ? 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.7)] h-1.5 md:h-2' 
                                        : 'bg-slate-800 h-1.5 md:h-2'
                                } ${step === i ? 'w-8 md:w-12 bg-blue-400 opacity-100' : 'w-2 md:w-3 opacity-30 mx-0.5'}`} 
                            />
                        ))}
                    </div>
                    
                    <div className="flex gap-2 md:gap-5 shrink-0">
                        {step > 1 && (
                            <button onClick={() => setStep(step - 1)} disabled={loading} className="px-4 md:px-8 py-2 md:py-2.5 rounded-xl md:rounded-2xl font-black text-[9px] md:text-[11px] text-slate-500 hover:text-white uppercase tracking-[0.2em] md:tracking-[0.4em] transition-all bg-transparent hover:bg-slate-800 border border-transparent hover:border-white/10 shrink-0">
                                {t('common.back')}
                            </button>
                        )}
                        <button
                            onClick={step < 10 ? () => setStep(step + 1) : finish}
                            disabled={loading || (step === 3 && !userName)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 md:px-10 py-2 md:py-2.5 rounded-xl md:rounded-2xl font-black text-[9px] md:text-[11px] uppercase tracking-[0.2em] md:tracking-[0.3em] shadow-2xl active:scale-95 transition-all disabled:opacity-20 flex items-center gap-2 md:gap-3 group/btn whitespace-nowrap shrink-0"
                        >
                            {loading ? <Icon name="spinner" className="animate-spin text-xs" /> : (
                                <>
                                    {step < 10 ? t('common.continue') : t('common.finish')}
                                    <Icon name={step < 10 ? 'chevron-right' : 'check'} className="text-[10px] md:text-[11px] group-hover/btn:translate-x-1.5 transition-transform" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
