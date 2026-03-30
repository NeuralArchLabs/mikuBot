import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppConfig } from '../../types';
import { Icon } from '../common/Common';
import { DEFAULT_CONFIG } from '../../constants';
import { runHealthCheck, type HealthCheckResult } from '../../services/core/HealthCheck';
import { hydrateAllTemplates, extractTemplatesFromFolderContent, type PromptVariables } from '../../services/core/BlueprintHydrator';

interface OnboardingProps {
    onComplete: (config: AppConfig, handles: any) => Promise<void>;
}

export const OnboardingWizard: React.FC<OnboardingProps> = ({ onComplete }) => {
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

    // ── Personalization state (psychographic variables) ───────────────
    const [userName, setUserName] = useState('');
    const [userTone, setUserTone] = useState('Profesional y amigable');
    const [technicalLevel, setTechnicalLevel] = useState('Intermedio');
    const [currentGoal, setCurrentGoal] = useState('Asistencia general');
    const [autonomyMode, setAutonomyMode] = useState('Semi-autónomo');
    const [userContext, setUserContext] = useState('');
    const [assistantAlias, setAssistantAlias] = useState('mikuBot');
    const [verbosity, setVerbosity] = useState('Medio');
    const [humorLevel, setHumorLevel] = useState('Bajo');
    const [customRules, setCustomRules] = useState('');

    // ── Telegram configuration state ─────────────────────────────────────
    const [telegramBotToken, setTelegramBotToken] = useState('');
    const [telegramChatId, setTelegramChatId] = useState('');

    // ── HealthCheck state ────────────────────────────────────────────
    const [healthStatus, setHealthStatus] = useState<HealthCheckResult | null>(null);
    const [healthLoading, setHealthLoading] = useState(false);
    const healthIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const performHealthCheck = useCallback(async () => {
        setHealthLoading(true);
        try {
            const result = await runHealthCheck();
            setHealthStatus(result);
        } catch {
            // Silently ignore — UI remains in "unknown" state
        } finally {
            setHealthLoading(false);
        }
    }, []);

    // Trigger health check when entering Step 4 or 5 (tutorial/providers), poll every 8s
    useEffect(() => {
        if (step === 4 || step === 5) {
            performHealthCheck();
            healthIntervalRef.current = setInterval(performHealthCheck, 8000);
        } else {
            if (healthIntervalRef.current) {
                clearInterval(healthIntervalRef.current);
                healthIntervalRef.current = null;
            }
        }
        return () => {
            if (healthIntervalRef.current) {
                clearInterval(healthIntervalRef.current);
                healthIntervalRef.current = null;
            }
        };
    }, [step, performHealthCheck]);

    useEffect(() => {
        const fetchDefault = async () => {
            if ((window as any).electron) {
                const res = await (window as any).electron.getDefaultPath();
                if (res.ok) {
                    setDefaultPath(res.path);
                    setCustomPath(res.path);
                }
            } else {
                setDefaultPath('/mikuCentral');
            }
        };
        fetchDefault();
    }, []);

    const selectedPath = pathMode === 'default' ? defaultPath : customPath;

    useEffect(() => {
        const checkExisting = async () => {
            if ((window as any).electron && selectedPath) {
                const res = await (window as any).electron.fsCheckExisting(selectedPath);
                if (res.exists) {
                    setExistingData(res);
                    setShowingWarning(true);
                } else {
                    setExistingData({ exists: false, found: [] });
                    setShowingWarning(false);
                    setCleanInstall(true); // Default to clean if nothing exists
                }
            }
        };
        checkExisting();
    }, [selectedPath]);

    const handleNext = () => {
        if (step < 6) setStep(step + 1);
    };

    const handlePrev = () => {
        if (step > 1) setStep(step - 1);
    };

    const finish = async () => {
        setLoading(true);
        setError('');
        try {
            if ((window as any).electron) {
                const setupRes = await (window as any).electron.setupOnboarding({
                    targetPath: selectedPath,
                    cleanInstall: cleanInstall
                });
                if (!setupRes.ok) {
                    throw new Error("Failed to create folders: " + setupRes.error);
                }
            }

            const cleanPath = selectedPath.replace(/\\/g, '/');
            const nextConfig = {
                ...config,
                isConfigured: true,
                telegramBotToken: telegramBotToken,
                telegramChatId: telegramChatId,
                userName,
                assistantAlias,
                tone: userTone,
                technicalSkill: technicalLevel,
                currentGoal,
                autonomyMode,
                userContextDump: userContext,
                verbosity,
                humorLevel,
                customRules,
                folderPaths: {
                    core: cleanPath + '/core',
                    tools: cleanPath + '/commands',
                    workSpace: cleanPath + '/workspace',
                    extra: cleanPath + '/library'
                }
            };

            // ── Hydrate templates and write personalized files ────────
            if ((window as any).electron) {
                try {
                    // 1. Read the commands folder which has blueprints/templates/ (copied by setup-onboarding)
                    const folderRes = await (window as any).electron.readFolder(nextConfig.folderPaths.tools);
                    if (folderRes.ok && folderRes.files) {
                        // 2. Extract template content from the folder listing
                        const templateContent = extractTemplatesFromFolderContent(folderRes.files);

                        if (Object.keys(templateContent).length > 0) {
                            // 3. Build variables from collected user data
                            const variables: PromptVariables = {
                                LANGUAGE: 'Español',
                                TONE: userTone,
                                VERBOSITY: verbosity,
                                HUMOR_LEVEL: humorLevel,
                                USER_NAME: userName || 'Usuario',
                                ASSISTANT_ALIAS: assistantAlias || 'mikuBot',
                                TECHNICAL_SKILL: technicalLevel,
                                CURRENT_GOAL: currentGoal,
                                AUTONOMY_MODE: autonomyMode,
                                USER_CONTEXT_DUMP: userContext.trim() || 'Sin contexto adicional proporcionado.',
                                CUSTOM_RULES: customRules.trim() || 'Sin instrucciones adicionales.',
                            };

                            // 4. Hydrate templates (synchronous, no IPC)
                            const hydrated = hydrateAllTemplates(variables, templateContent);

                            // 5. Write each file using correct IPC params: { folderPath, filename, content }
                            for (const file of hydrated) {
                                const folderPath = file.target === 'core'
                                    ? nextConfig.folderPaths.core
                                    : nextConfig.folderPaths.tools;

                                await (window as any).electron.writeFile({
                                    folderPath,
                                    filename: file.filename,
                                    content: file.content
                                });
                                console.log(`[Onboarding] ✅ ${file.filename} → ${folderPath}`);
                            }
                        } else {
                            console.warn('[Onboarding] No templates found in commands folder.');
                        }
                    }
                } catch (e) {
                    console.warn('[Onboarding] Template hydration failed (non-blocking):', e);
                }
            }

            await onComplete(nextConfig, { targetPath: selectedPath });
        } catch (err: any) {
            setError(err.message || 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-4">
            <div className="bg-slate-900/80 backdrop-blur-2xl border border-white/5 shadow-[0_0_60px_rgba(0,0,0,0.5)] rounded-[2rem] w-full max-w-2xl overflow-hidden flex flex-col h-[85vh] min-h-[500px] max-h-[820px] relative">
                {/* Background Ambient Glows */}
                <div className="absolute top-0 left-1/4 w-1/2 h-64 bg-blue-600/5 blur-[120px] pointer-events-none rounded-full transform-gpu" />
                <div className="absolute bottom-0 right-1/4 w-1/3 h-48 bg-purple-600/5 blur-[100px] pointer-events-none rounded-full transform-gpu" />

                {/* Header */}
                <div className="h-20 flex items-center justify-start px-8 border-b border-white/5 bg-slate-950/40 gap-4 relative z-10">
                    <div className="w-10 h-10 rounded-xl bg-slate-800/30 flex items-center justify-center border border-white/10 shadow-inner group hover:border-blue-500/30 transition-all duration-500">
                        <img src="./mikuBotICON.png" alt="Logo" className="w-7 h-7 object-contain opacity-90 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-white tracking-[0.2em] uppercase">Setup</h2>
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">System Initialization</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 p-8 md:p-10 overflow-y-auto custom-scrollbar flex flex-col items-center">

                    {step === 1 && (
                        <div className="w-full h-full flex flex-col items-center text-center justify-center space-y-8 animate-fade-in">
                            <div className="w-36 h-36 rounded-[2.5rem] bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center border border-white/5 shadow-[0_0_40px_rgba(59,130,246,0.1)]">
                                <img src="./mikuBotICON.png" alt="MikuCentral" className="w-24 h-24 object-contain" />
                            </div>
                            <div className="space-y-4">
                                <h1 className="text-4xl font-black text-white tracking-tight">Welcome</h1>
                                <p className="text-slate-400 max-w-3xl leading-relaxed text-sm">
                                    Neural AI Interface. Setup your environment, prepare the neural core, and configure AI providers.
                                </p>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="w-full max-w-3xl space-y-6 animate-fade-in text-left">
                            <div className="text-center mb-8 space-y-2">
                                <h1 className="text-2xl font-black text-white tracking-tight">Environment</h1>
                                <p className="text-slate-400 text-sm">Select storage location for neural logic, tools, and workspaces.</p>
                            </div>

                            <div className="space-y-4 flex flex-col items-center justify-center max-w-2xl mx-auto">
                                <button
                                    onClick={() => setPathMode('default')}
                                    className={`premium-card p-5 rounded-2xl flex items-start gap-4 transition-all duration-500 text-left group relative overflow-hidden ${pathMode === 'default' ? 'premium-emerald !bg-emerald-500/5' : '!bg-slate-900/40'}`}
                                >
                                    <div className={`absolute inset-0 bg-gradient-to-br ${pathMode === 'default' ? 'from-emerald-500/10 to-emerald-600/5' : 'from-transparent to-slate-800/30'} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                                    <div className={`w-10 h-10 rounded-xl bg-emerald-500/10 border ${pathMode === 'default' ? 'border-emerald-500/30' : 'border-transparent'} text-emerald-400 flex items-center justify-center flex-shrink-0 premium-transition z-10`}>
                                        <Icon name={pathMode === 'default' ? 'check-circle' : 'circle'} className="text-lg" />
                                    </div>
                                    <div className="flex-1 z-10">
                                        <div className="font-black text-white mb-2 tracking-wide">Default Path</div>
                                        <div className="text-[11px] text-slate-400 font-mono break-all bg-slate-900/40 p-2 rounded-lg border border-white/5">{defaultPath}</div>
                                        <div className="text-[10px] text-slate-500 mt-2 font-medium">Files will be created in selected paths: `@CORE`, `@TOOLS`, `@WORKSPACE`, `@LIBRARY`</div>
                                    </div>
                                    {pathMode === 'default' && (
                                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse" />
                                    )}
                                </button>

                                <button
                                    onClick={() => setPathMode('custom')}
                                    className={`premium-card p-5 rounded-2xl flex items-start gap-4 transition-all duration-500 text-left group relative overflow-hidden ${pathMode === 'custom' ? 'premium-indigo !bg-indigo-500/5' : '!bg-slate-900/40'}`}
                                >
                                    <div className={`absolute inset-0 bg-gradient-to-br ${pathMode === 'custom' ? 'from-indigo-500/10 to-indigo-600/5' : 'from-transparent to-slate-800/30'} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                                    <div className={`w-10 h-10 rounded-xl bg-indigo-500/10 border ${pathMode === 'custom' ? 'border-indigo-500/30' : 'border-transparent'} text-indigo-400 flex items-center justify-center flex-shrink-0 premium-transition z-10`}>
                                        <Icon name={pathMode === 'custom' ? 'check-circle' : 'circle'} className="text-lg" />
                                    </div>
                                    <div className="flex-1 z-10">
                                        <div className="font-black text-white mb-1 tracking-wide">Custom Path</div>
                                        <div className="text-[10px] text-slate-400 font-medium">Choose your own directory to store the agent framework.</div>
                                    </div>
                                    {pathMode === 'custom' && (
                                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.6)] animate-pulse" />
                                    )}
                                </button>

                                {pathMode === 'custom' && (
                                    <div className="animate-fade-in bg-slate-900/40 p-4 rounded-2xl border border-white/5 flex items-center gap-3">
                                        <Icon name="folder" className="text-slate-500 flex-shrink-0" />
                                        <input
                                            value={customPath}
                                            onChange={(e) => setCustomPath(e.target.value)}
                                            placeholder="C:\\Path\\To\\Folder"
                                            className="bg-transparent border-none outline-none text-white text-sm flex-1 font-mono placeholder-slate-600"
                                        />
                                        {(window as any).electron && (
                                            <button
                                                onClick={async () => {
                                                    const res = await (window as any).electron.selectFolder();
                                                    if (res.ok) setCustomPath(res.path);
                                                }}
                                                className="premium-button premium-emphasis premium-indigo px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20"
                                            >
                                                <Icon name="folder-open" className="mr-1" /> Browse
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="bg-slate-900/40 border border-amber-500/20 p-4 rounded-2xl mt-4 flex items-start gap-3">
                                <Icon name="info-circle" className="text-amber-400 text-base flex-shrink-0" />
                                <div className="text-[10px] text-amber-200/70 leading-relaxed">
                                    Core system files will be automatically extracted into respective subfolders: <code className="bg-amber-500/20 px-1.5 rounded text-amber-100">@CORE</code> and <code className="bg-amber-500/20 px-1.5 rounded text-amber-100">@TOOLS</code>.
                                </div>
                            </div>

                            {showingWarning && (
                                <div className="animate-fade-in bg-slate-950/80 backdrop-blur-xl border border-blue-500/30 p-6 rounded-2xl mt-6 space-y-5 shadow-2xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                                    <div className="flex items-center gap-3 text-blue-400 relative z-10">
                                        <Icon name="exclamation-triangle" className="text-xl" />
                                        <h3 className="font-bold text-white tracking-wide">Existing Installation Detected</h3>
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-relaxed relative z-10">
                                        Files found in this directory. Choose how to proceed.
                                    </p>
                                    <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-3 relative z-10">
                                        <button
                                            onClick={() => { setCleanInstall(false); setShowingWarning(false); }}
                                            className={`p-4 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all ${!cleanInstall ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-900/40 border-white/5 text-slate-400 hover:bg-slate-800'}`}
                                        >
                                            <Icon name="history" className="mb-1 block text-sm" />
                                            Keep Files
                                        </button>
                                        <button
                                            onClick={() => { setCleanInstall(true); setShowingWarning(false); }}
                                            className={`p-4 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all ${cleanInstall ? 'bg-red-600 border-red-400 text-white shadow-lg shadow-red-500/20' : 'bg-slate-900/40 border-white/5 text-slate-400 hover:bg-slate-800'}`}
                                        >
                                            <Icon name="trash-alt" className="mb-1 block text-sm" />
                                            Clean Install
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!showingWarning && existingData.exists && (
                                <div className="text-[10px] text-center text-slate-500 mt-3">
                                    <Icon name="check-circle" className="text-emerald-500 mr-1" />
                                    {cleanInstall ? "Clean install selected." : "Existing files linked successfully."}
                                    <button onClick={() => setShowingWarning(true)} className="ml-2 text-blue-400 hover:text-blue-300 font-medium">Change</button>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="w-full max-w-3xl space-y-6 animate-fade-in text-left">
                            <div className="text-center mb-6 space-y-2">
                                <h1 className="text-2xl font-black text-white tracking-tight">Personalization</h1>
                                <p className="text-slate-400 text-sm">Customize assistant interaction style and personality.</p>
                            </div>

                            <div className="space-y-4">
                                {/* User Name & Assistant Alias */}
                                <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4">
                                    <div className="premium-card premium-blue p-5 rounded-2xl">
                                        <label className="text-[10px] font-black text-blue-400 uppercase tracking-[0.15em] flex items-center gap-2 mb-3">
                                            <Icon name="user" className="text-xs" /> Your Name
                                        </label>
                                        <div className="relative group">
                                            <input
                                                type="text"
                                                value={userName}
                                                onChange={(e) => setUserName(e.target.value)}
                                                placeholder="¿Cómo te llamas?"
                                                className="w-full premium-input rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none premium-transition"
                                            />
                                        </div>
                                    </div>
                                    <div className="premium-card premium-emerald p-5 rounded-2xl">
                                        <label className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.15em] flex items-center gap-2 mb-3">
                                            <Icon name="terminal" className="text-xs" /> Assistant Alias
                                        </label>
                                        <div className="relative group">
                                            <input
                                                type="text"
                                                value={assistantAlias}
                                                onChange={(e) => setAssistantAlias(e.target.value)}
                                                placeholder="mikuBot"
                                                className="w-full premium-input rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none premium-transition"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Tone & Autonomy */}
                                <div className="premium-card premium-purple p-5 rounded-2xl">
                                    <label className="text-[10px] font-black text-purple-400 uppercase tracking-[0.15em] flex items-center gap-2 mb-4">
                                        <Icon name="comment-dots" className="text-xs" /> Communication Tone
                                    </label>
                                    <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-3">
                                        {[
                                            { value: 'Profesional y amigable', label: 'Professional', icon: 'briefcase' },
                                            { value: 'Casual y relajado', label: 'Casual', icon: 'coffee' },
                                            { value: 'Conciso y directo', label: 'Direct', icon: 'bolt' },
                                            { value: 'Detallado y didáctico', label: 'Detailed', icon: 'book' },
                                        ].map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setUserTone(opt.value)}
                                                className={`p-4 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 border group ${
                                                    userTone === opt.value
                                                        ? 'bg-purple-500/20 border-purple-500/30 text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
                                                        : 'bg-slate-900/40 border-white/5 text-slate-400 hover:bg-slate-800 hover:border-white/10'
                                                }`}
                                            >
                                                <Icon name={opt.icon} className={`text-sm ${userTone === opt.value ? 'text-purple-300' : 'text-slate-500'}`} />
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Verbosity & Humor & Technical Level */}
                                <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4">
                                     <div className="premium-card premium-blue p-5 rounded-2xl">
                                        <label className="text-[10px] font-black text-blue-400 uppercase tracking-[0.15em] flex items-center gap-2 mb-4">
                                            <Icon name="align-left" className="text-xs" /> Verbosity & Humor
                                        </label>
                                        <div className="space-y-4">
                                            <div className="relative group">
                                                <select
                                                    value={verbosity}
                                                    onChange={(e) => setVerbosity(e.target.value)}
                                                    aria-label="Verbosity Level"
                                                    className="w-full premium-input rounded-xl px-4 py-3 text-white text-xs font-medium focus:outline-none appearance-none shadow-inner"
                                                >
                                                    <option value="Conciso">Concise Output</option>
                                                    <option value="Medio">Balanced Output</option>
                                                    <option value="Detallado">Detailed/Verbose</option>
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                                    <Icon name="chevron-down" className="text-xs" />
                                                </div>
                                            </div>
                                            <div className="relative group">
                                                <select
                                                    value={humorLevel}
                                                    onChange={(e) => setHumorLevel(e.target.value)}
                                                    aria-label="Humor Level"
                                                    className="w-full premium-input rounded-xl px-4 py-3 text-white text-xs font-medium focus:outline-none appearance-none shadow-inner"
                                                >
                                                    <option value="Ninguno">No Humor</option>
                                                    <option value="Bajo">Subtle Humor</option>
                                                    <option value="Alto">High/Witty Humor</option>
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                                    <Icon name="chevron-down" className="text-xs" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="premium-card premium-amber p-5 rounded-2xl">
                                        <label className="text-[10px] font-black text-amber-400 uppercase tracking-[0.15em] flex items-center gap-2 mb-4">
                                            <Icon name="robot" className="text-xs" /> Technical & Autonomy
                                        </label>
                                        <div className="space-y-4">
                                            <div className="relative group">
                                                <select
                                                    value={technicalLevel}
                                                    onChange={(e) => setTechnicalLevel(e.target.value)}
                                                    aria-label="Technical Level"
                                                    className="w-full premium-input rounded-xl px-4 py-3 text-white text-xs font-medium focus:outline-none appearance-none shadow-inner"
                                                >
                                                    <option value="Principiante">Beginner User</option>
                                                    <option value="Intermedio">Intermediate User</option>
                                                    <option value="Avanzado">Advanced/Dev User</option>
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                                    <Icon name="chevron-down" className="text-xs" />
                                                </div>
                                            </div>
                                            <div className="relative group">
                                                <select
                                                    value={autonomyMode}
                                                    onChange={(e) => setAutonomyMode(e.target.value)}
                                                    aria-label="Autonomy Level"
                                                    className="w-full premium-input rounded-xl px-4 py-3 text-white text-xs font-medium focus:outline-none appearance-none shadow-inner"
                                                >
                                                    <option value="Conservador">Conservative Agent</option>
                                                    <option value="Semi-autónomo">Balanced Autonomy</option>
                                                    <option value="Autónomo">Full Autonomous</option>
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                                    <Icon name="chevron-down" className="text-xs" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Custom Rules & About You */}
                                <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4">
                                    <div className="premium-card premium-pink p-5 rounded-2xl">
                                        <label className="text-[10px] font-black text-pink-400 uppercase tracking-[0.15em] flex items-center gap-2 mb-3">
                                            <Icon name="scroll" className="text-xs" /> Custom Rules
                                        </label>
                                        <textarea
                                            value={customRules}
                                            onChange={(e) => setCustomRules(e.target.value)}
                                            placeholder="Introduce reglas específicas: 'háblame de tú', 'no uses emojis', etc."
                                            rows={6}
                                            className="w-full premium-input rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none resize-none"
                                        />
                                    </div>

                                    <div className="premium-card premium-cyan p-5 rounded-2xl">
                                        <label className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.15em] flex items-center gap-2 mb-3">
                                            <Icon name="info-circle" className="text-xs" /> User Context
                                        </label>
                                        <textarea
                                            value={userContext}
                                            onChange={(e) => setUserContext(e.target.value)}
                                            placeholder="Profesión, proyectos activos, herramientas favoritas..."
                                            rows={6}
                                            className="w-full premium-input rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none resize-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="w-full max-w-3xl space-y-6 animate-fade-in text-left">
                            <div className="text-center mb-6 space-y-2">
                                <h1 className="text-2xl font-black text-white tracking-tight">Providers</h1>
                                <p className="text-slate-400 text-sm">Get API keys and set up local inference.</p>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4">
                                {/* Google AI Studio */}
                                <div className="premium-card premium-blue p-5 rounded-2xl group relative overflow-hidden h-full flex flex-col">
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                                <img src="./geminiICON.png" alt="Gemini" className="w-6 h-6 object-contain" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-white tracking-wide">Google AI</h3>
                                                <p className="text-[9px] text-slate-500 font-medium">Gemini 1.5 Pro/Flash</p>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-400 leading-relaxed mb-4">
                                            Free tier available. Main model for MikuCentral.
                                        </p>
                                        <button
                                            onClick={() => (window as any).electron?.openExternal('https://aistudio.google.com/app/apikey')}
                                            className="premium-button premium-emphasis premium-blue w-full py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 hover:bg-blue-500/20"
                                        >
                                            <Icon name="external-link-alt" className="mr-1 text-xs" /> Get Key
                                        </button>
                                    </div>
                                </div>

                                {/* Groq */}
                                <div className="premium-card premium-amber p-5 rounded-2xl group relative overflow-hidden h-full flex flex-col">
                                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                                                <img src="./groqICON.png" alt="Groq" className="w-5 h-5 object-contain brightness-0 invert" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-white tracking-wide">Groq Cloud</h3>
                                                <p className="text-[9px] text-slate-500 font-medium">Ultra-fast Inference</p>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-400 leading-relaxed mb-4">
                                            Llama 3 & Mixtral. Instant responses.
                                        </p>
                                        <button
                                            onClick={() => (window as any).electron?.openExternal('https://console.groq.com/keys')}
                                            className="premium-button premium-emphasis premium-amber w-full py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 hover:bg-orange-500/20"
                                        >
                                            <Icon name="external-link-alt" className="mr-1 text-xs" /> Get Key
                                        </button>
                                    </div>
                                </div>

                                {/* Z.AI */}
                                <div className="premium-card premium-purple p-5 rounded-2xl group relative overflow-hidden h-full flex flex-col">
                                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                                                <img src="./zai.png" alt="Z.AI" className="w-5 h-5 object-contain brightness-0 invert" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-white tracking-wide">Z.AI</h3>
                                                <p className="text-[9px] text-slate-500 font-medium">Large Context</p>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-400 leading-relaxed mb-4">
                                            Massive context inference. Token v4.
                                        </p>
                                        <button
                                            onClick={() => (window as any).electron?.openExternal('https://z.ai/api-key')}
                                            className="premium-button premium-emphasis premium-purple w-full py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 hover:bg-purple-500/20"
                                        >
                                            <Icon name="external-link-alt" className="mr-1 text-xs" /> Get Key
                                        </button>
                                    </div>
                                </div>

                                {/* Ollama */}
                                <div className="premium-card premium-emerald p-5 rounded-2xl group relative overflow-hidden h-full flex flex-col">
                                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                                <img src="./ollamaICON.webp" alt="Ollama" className="w-6 h-6 object-contain brightness-0 invert" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-white tracking-wide">Ollama</h3>
                                                <p className="text-[9px] text-slate-500 font-medium">Local Models</p>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-400 leading-relaxed mb-4">
                                            Run LLMs locally. 100% private.
                                        </p>
                                        <button
                                            onClick={() => (window as any).electron?.openExternal('https://ollama.com/download')}
                                            className="premium-button premium-emphasis premium-emerald w-full py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                                        >
                                            <Icon name="download" className="mr-1 text-xs" /> Download
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 5 && (
                        <div className="w-full max-w-3xl space-y-6 animate-fade-in">
                            <div className="text-center mb-6 space-y-2">
                                <h1 className="text-2xl font-black text-white tracking-tight">API Configuration</h1>
                                <p className="text-slate-400 text-sm">Configure preferred AI providers for the engine.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="premium-card premium-blue p-5 rounded-2xl">
                                    <label className="text-[10px] font-black text-blue-400 uppercase tracking-[0.15em] flex items-center gap-2 mb-3">
                                        <img src="./geminiICON.png" alt="Gemini" className="w-4 h-4 object-contain" /> Google Gemini
                                    </label>
                                    <input
                                        type="password"
                                        value={config.apiKeys.gemini}
                                        onChange={(e) => setConfig({ ...config, apiKeys: { ...config.apiKeys, gemini: e.target.value } })}
                                        placeholder="AIzaSy..."
                                        className="w-full premium-input rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none"
                                    />
                                </div>

                                <div className="premium-card premium-amber p-5 rounded-2xl">
                                    <label className="text-[10px] font-black text-orange-400 uppercase tracking-[0.15em] flex items-center gap-2 mb-3">
                                        <img src="./groqICON.png" alt="Groq" className="w-4 h-4 object-contain brightness-0 invert" /> Groq
                                    </label>
                                    <input
                                        type="password"
                                        value={config.apiKeys.groq}
                                        onChange={(e) => setConfig({ ...config, apiKeys: { ...config.apiKeys, groq: e.target.value } })}
                                        placeholder="gsk_..."
                                        className="w-full premium-input rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none"
                                    />
                                </div>

                                <div className="premium-card premium-purple p-5 rounded-2xl">
                                    <label className="text-[10px] font-black text-purple-400 uppercase tracking-[0.15em] flex items-center gap-2 mb-3">
                                        <img src="./zai.png" alt="Z.AI" className="w-4 h-4 object-contain brightness-0 invert" /> Z.AI BigModel
                                    </label>
                                    <input
                                        type="password"
                                        value={config.apiKeys.zai}
                                        onChange={(e) => setConfig({ ...config, apiKeys: { ...config.apiKeys, zai: e.target.value } })}
                                        placeholder="v4_..."
                                        className="w-full premium-input rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none"
                                    />
                                </div>

                                <div className="premium-card premium-emerald p-5 rounded-2xl">
                                    <label className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.15em] flex items-center gap-2 mb-3">
                                        <img src="./ollamaICON.webp" alt="Ollama" className="w-4 h-4 object-contain brightness-0 invert" /> Ollama URL
                                        {healthStatus && (
                                            <span className={`ml-auto inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${
                                                healthStatus.ollama.online ? 'text-emerald-400' : 'text-slate-500'
                                            }`}>
                                                <span className={`w-2 h-2 rounded-full ${
                                                    healthStatus.ollama.online
                                                        ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)] animate-pulse'
                                                        : 'bg-slate-600'
                                                }`} />
                                                {healthStatus.ollama.online ? 'Online' : 'Offline'}
                                            </span>
                                        )}
                                    </label>
                                    <input
                                        type="text"
                                        value={config.ollamaUrl}
                                        onChange={(e) => setConfig({ ...config, ollamaUrl: e.target.value })}
                                        placeholder="http://localhost:11434"
                                        className="w-full premium-input rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none"
                                    />
                                    {healthStatus?.ollama.online && healthStatus.ollama.latencyMs !== null && (
                                        <div className="text-[10px] text-emerald-400/80 mt-2 font-mono font-medium">
                                            Latency: {healthStatus.ollama.latencyMs}ms
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4">
                                    <div className={`p-5 rounded-2xl border transition-all ${
                                        healthStatus?.searxena.online
                                            ? 'bg-emerald-900/10 border-emerald-500/30'
                                            : 'bg-slate-900/40 border-white/5'
                                    }`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-[10px] font-black text-white uppercase tracking-[0.15em] flex items-center gap-2">
                                                <Icon name="search" className="text-xs text-cyan-400" /> SearXena
                                            </label>
                                            {healthStatus && (
                                                <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider ${
                                                    healthStatus.searxena.online ? 'text-emerald-400' : 'text-slate-500'
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                                        healthStatus.searxena.online
                                                            ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] animate-pulse'
                                                            : 'bg-slate-600'
                                                    }`} />
                                                    {healthStatus.searxena.online ? 'Online' : 'Offline'}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-500">
                                            {healthStatus?.searxena.online
                                                ? `${healthStatus.searxena.latencyMs}ms`
                                                : 'Local web search via SearXNG.'
                                            }
                                        </p>
                                    </div>

                                    <div className={`p-5 rounded-2xl border transition-all ${
                                        healthStatus?.vosk.online
                                            ? 'bg-emerald-900/10 border-emerald-500/30'
                                            : 'bg-slate-900/40 border-white/5'
                                    }`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-[10px] font-black text-white uppercase tracking-[0.15em] flex items-center gap-2">
                                                <Icon name="microphone" className="text-xs text-pink-400" /> Vosk
                                            </label>
                                            {healthStatus && (
                                                <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider ${
                                                    healthStatus.vosk.online ? 'text-emerald-400' : 'text-slate-500'
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                                        healthStatus.vosk.online
                                                            ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] animate-pulse'
                                                            : 'bg-slate-600'
                                                    }`} />
                                                    {healthStatus.vosk.online ? 'Ready' : 'Not Loaded'}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-500">
                                            {healthStatus?.vosk.online
                                                ? 'Voice engine active.'
                                                : 'Vosk Python module required.'
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>
                            {error && (
                                <div className="bg-red-950/20 border border-red-500/20 p-4 rounded-2xl text-red-300 text-[11px] text-center">
                                    <Icon name="exclamation-circle" className="mr-2" />
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {step === 6 && (
                        <div className="w-full max-w-3xl space-y-6 animate-fade-in">
                            <div className="text-center mb-6 space-y-2">
                                <h1 className="text-2xl font-black text-white tracking-tight">Telegram</h1>
                                <p className="text-slate-400 text-sm">Configure Telegram for notifications and remote interaction. (Optional)</p>
                            </div>

                            {/* BotFather Instructions */}
                            <div className="bg-slate-900/40 border border-cyan-500/20 p-5 rounded-2xl space-y-4 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none" />
                                <div className="flex items-center gap-2 text-cyan-400 relative z-10">
                                    <Icon name="info-circle" className="text-base" />
                                    <span className="font-black text-sm tracking-wide">Create Your Bot</span>
                                </div>
                                <ol className="text-[10px] text-slate-400 space-y-2 list-decimal list-inside relative z-10">
                                    <li>Open Telegram and search <span className="font-mono bg-cyan-500/10 px-1.5 py-0.5 rounded text-cyan-300">@BotFather</span></li>
                                    <li>Send <span className="font-mono bg-cyan-500/10 px-1.5 py-0.5 rounded text-cyan-300">/newbot</span> and follow instructions</li>
                                    <li>Copy the <span className="text-white font-medium">Bot Token</span> provided</li>
                                    <li>Search <span className="font-mono bg-cyan-500/10 px-1.5 py-0.5 rounded text-cyan-300">@userinfobot</span></li>
                                    <li>Send any message to get your <span className="text-white font-medium">Chat ID</span></li>
                                </ol>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4">
                                    <div className="premium-card premium-cyan p-5 rounded-2xl">
                                        <label className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.15em] flex items-center gap-2 mb-3">
                                            <Icon name="telegram-plane" className="text-xs" /> Bot Token
                                        </label>
                                        <input
                                            type="password"
                                            value={telegramBotToken}
                                            onChange={(e) => setTelegramBotToken(e.target.value)}
                                            placeholder="123456789:ABC..."
                                            className="w-full premium-input rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none font-mono"
                                        />
                                    </div>

                                    <div className="premium-card premium-cyan p-5 rounded-2xl">
                                        <label className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.15em] flex items-center gap-2 mb-3">
                                            <Icon name="user" className="text-xs" /> Chat ID
                                        </label>
                                        <input
                                            type="text"
                                            value={telegramChatId}
                                            onChange={(e) => setTelegramChatId(e.target.value)}
                                            placeholder="123456789"
                                            className="w-full premium-input rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none font-mono"
                                        />
                                    </div>
                                </div>

                                <div className="bg-slate-900/40 border border-white/5 p-4 rounded-2xl flex items-start gap-3">
                                    <Icon name="check-circle" className="text-emerald-400 text-sm flex-shrink-0" />
                                    <div className="text-[10px] text-slate-400 leading-relaxed">
                                        Leave empty to skip. Configure later in <span className="text-slate-300 font-medium">Settings → Telegram</span>.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 bg-slate-950/40 backdrop-blur-xl flex justify-between items-center">
                    <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className={`w-2 h-2 rounded-full transition-all duration-500 ${step === i ? 'bg-blue-500 w-4 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-slate-800'}`} />
                        ))}
                    </div>
                    <div className="flex gap-3">
                        {step > 1 && (
                            <button
                                onClick={handlePrev}
                                disabled={loading}
                                className="premium-button px-6 py-2.5 rounded-xl font-bold text-slate-400 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Back
                            </button>
                        )}
                        {step < 6 ? (
                            <button
                                onClick={handleNext}
                                disabled={step === 3 && !userName.trim()}
                                className="premium-button premium-emphasis premium-blue px-8 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed"
                            >
                                Continue
                            </button>
                        ) : (
                            <>
                                {healthStatus && !healthStatus.ollama.online && !config.apiKeys.gemini && !config.apiKeys.groq && !config.apiKeys.zai && (
                                    <span className="text-[10px] text-amber-400 mr-2 flex items-center gap-1">
                                        <Icon name="exclamation-triangle" className="text-xs" /> No provider
                                    </span>
                                )}
                                <button
                                    onClick={finish}
                                    disabled={loading || !selectedPath}
                                    className="premium-button premium-emphasis premium-emerald px-8 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed"
                                >
                                    {loading ? <Icon name="spinner" className="animate-spin" /> : <Icon name="check" />}
                                    Initialize
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
