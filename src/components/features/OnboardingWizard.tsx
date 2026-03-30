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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-[2.5rem] w-full max-w-2xl overflow-hidden flex flex-col h-[85vh] min-h-[500px] max-h-[820px] animate-macos-expand relative">
                {/* Background Ambient Glows */}
                <div className="absolute top-0 left-1/4 w-1/2 h-64 bg-blue-600/10 blur-[100px] pointer-events-none rounded-full transform-gpu" />
                <div className="absolute bottom-0 right-1/4 w-1/3 h-48 bg-purple-600/10 blur-[80px] pointer-events-none rounded-full transform-gpu" />

                {/* Header */}
                <div className="h-20 flex items-center justify-start px-8 border-b border-white/5 bg-slate-950/40 gap-4 relative z-10">
                    <div className="w-10 h-10 rounded-xl bg-slate-800/50 flex items-center justify-center border border-white/10 shadow-inner">
                        <img src="./mikuBotICON.png" alt="Logo" className="w-7 h-7 object-contain opacity-90" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-white tracking-[0.2em] uppercase">MikuCentral Setup</h2>
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Neural Link Initialization</p>
                        </div>
                    </div>
                    <div className="ml-auto flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5, 6].map(s => (
                            <div key={s} className={`h-1 rounded-full transition-all duration-500 ${step >= s ? 'w-4 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'w-2 bg-slate-800'}`} />
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 p-8 overflow-y-auto custom-scrollbar flex flex-col items-center">

                    {step === 1 && (
                        <div className="w-full h-full flex flex-col items-center text-center justify-center space-y-6">
                            <div className="w-24 h-24 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                                <Icon name="robot" className="text-5xl text-blue-400" />
                            </div>
                            <h1 className="text-3xl font-bold text-white">Welcome to MikuCentral</h1>
                            <p className="text-slate-400 max-w-md">
                                The Neural AI Interface for Multi-Model Management. Before you start, we need to set up your environment, prepare the neural core base, and select your AI providers.
                            </p>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="w-full max-w-md space-y-6 animate-fade-in text-left">
                            <div className="text-center mb-8">
                                <h1 className="text-2xl font-bold text-white mb-2">Environment Setup</h1>
                                <p className="text-slate-400 text-sm">Select where MikuCentral should store your neural logic, tools, and workspaces.</p>
                            </div>

                            <div className="space-y-4">
                                <button
                                    onClick={() => setPathMode('default')}
                                    className={`w-full p-4 rounded-xl border flex items-start gap-4 transition-all text-left ${pathMode === 'default' ? 'bg-blue-900/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'}`}
                                >
                                    <Icon name={pathMode === 'default' ? 'dot-circle' : 'circle'} className={`text-xl mt-0.5 ${pathMode === 'default' ? 'text-blue-400' : 'text-slate-500'}`} />
                                    <div>
                                        <div className="font-bold text-white mb-1">Default Path (Recommended)</div>
                                        <div className="text-xs text-slate-400 font-mono break-all">{defaultPath}</div>
                                        <div className="text-xs text-slate-500 mt-2">Automatically creates 'core', 'commands', 'workspace', and 'library' folders inside.</div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setPathMode('custom')}
                                    className={`w-full p-4 rounded-xl border flex items-start gap-4 transition-all text-left ${pathMode === 'custom' ? 'bg-blue-900/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'}`}
                                >
                                    <Icon name={pathMode === 'custom' ? 'dot-circle' : 'circle'} className={`text-xl mt-0.5 ${pathMode === 'custom' ? 'text-blue-400' : 'text-slate-500'}`} />
                                    <div className="w-full">
                                        <div className="font-bold text-white mb-1">Custom Path</div>
                                        <div className="text-xs text-slate-400 mb-2">Choose your own directory to store the agent framework.</div>
                                    </div>
                                </button>

                                {pathMode === 'custom' && (
                                    <div className="animate-fade-in bg-slate-800/80 p-3 rounded-lg flex items-center gap-2 border border-slate-700">
                                        <input
                                            value={customPath}
                                            onChange={(e) => setCustomPath(e.target.value)}
                                            placeholder="C:\\Path\\To\\Folder"
                                            className="bg-transparent border-none outline-none text-white text-sm flex-1 font-mono"
                                        />
                                        {(window as any).electron && (
                                            <button
                                                onClick={async () => {
                                                    const res = await (window as any).electron.selectFolder();
                                                    if (res.ok) setCustomPath(res.path);
                                                }}
                                                className="px-3 py-1.5 bg-slate-700 hover:bg-blue-600 rounded text-xs font-bold text-white transition-colors flex items-center gap-2"
                                            >
                                                <Icon name="folder-open" /> Browse
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg mt-4 flex items-start gap-3">
                                <Icon name="info-circle" className="text-amber-400 text-lg flex-shrink-0" />
                                <div className="text-xs text-amber-200/80 leading-relaxed">
                                    The core system files (base personality and instructions) will be automatically extracted and copied into the <code className="bg-amber-500/20 px-1 rounded">commands</code> folder for you.
                                </div>
                            </div>

                            {showingWarning && (
                                <div className="animate-macos-expand bg-slate-950 border border-blue-500/30 p-5 rounded-xl mt-6 space-y-4 shadow-2xl">
                                    <div className="flex items-center gap-3 text-blue-400">
                                        <Icon name="exclamation-triangle" className="text-xl" />
                                        <h3 className="font-bold">¡Instalación Previa Detectada!</h3>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        Se han encontrado archivos de MikuCentral en esta carpeta. ¿Cómo deseas proceder?
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => { setCleanInstall(false); setShowingWarning(false); }}
                                            className={`p-3 rounded-lg border text-xs font-bold transition-all ${!cleanInstall ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                                        >
                                            <Icon name="history" className="mb-1 block text-sm" />
                                            Mantener Archivos
                                        </button>
                                        <button
                                            onClick={() => { setCleanInstall(true); setShowingWarning(false); }}
                                            className={`p-3 rounded-lg border text-xs font-bold transition-all ${cleanInstall ? 'bg-red-600 border-red-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                                        >
                                            <Icon name="trash-alt" className="mb-1 block text-sm" />
                                            Limpiar Todo
                                        </button>
                                    </div>
                                    {!showingWarning && (
                                        <div className="text-[10px] text-center text-slate-500 italic">
                                            {cleanInstall ? "Se borrarán los datos anteriores para una instalación limpia." : "Se vincularán tus sesiones y configuraciones existentes."}
                                        </div>
                                    )}
                                </div>
                            )}

                            {!showingWarning && existingData.exists && (
                                <div className="text-[10px] text-center text-slate-500 mt-2">
                                    <Icon name="check-circle" className="text-emerald-500 mr-1" />
                                    {cleanInstall ? "Instalación limpia seleccionada." : "Archivos previos vinculados con éxito."}
                                    <button onClick={() => setShowingWarning(true)} className="ml-2 text-blue-400 hover:underline">Cambiar</button>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="w-full max-w-md space-y-6 animate-fade-in text-left">
                            <div className="text-center mb-6">
                                <h1 className="text-2xl font-bold text-white mb-2">Agent Personalization</h1>
                                <p className="text-slate-400 text-sm">Customize how your assistant interacts with you. These settings shape its core personality.</p>
                            </div>

                            <div className="space-y-4">
                                {/* User Name & Assistant Alias */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                        <label className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                                            <Icon name="user" className="text-sm text-blue-400" /> Your Name
                                        </label>
                                        <input
                                            type="text"
                                            value={userName}
                                            onChange={(e) => setUserName(e.target.value)}
                                            placeholder="¿Cómo te llamas?"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-600 text-sm focus:border-blue-500 focus:outline-none"
                                        />
                                    </div>
                                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                        <label className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                                            <Icon name="terminal" className="text-sm text-emerald-400" /> Assistant Alias
                                        </label>
                                        <input
                                            type="text"
                                            value={assistantAlias}
                                            onChange={(e) => setAssistantAlias(e.target.value)}
                                            placeholder="mikuBot"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-600 text-sm focus:border-emerald-500 focus:outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Tone & Autonomy */}
                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                    <label className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                                        <Icon name="comment-dots" className="text-sm text-purple-400" /> Communication Tone
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { value: 'Profesional y amigable', label: 'Professional', icon: 'briefcase' },
                                            { value: 'Casual y relajado', label: 'Casual', icon: 'coffee' },
                                            { value: 'Conciso y directo', label: 'Direct', icon: 'bolt' },
                                            { value: 'Detallado y didáctico', label: 'Detailed', icon: 'book' },
                                        ].map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setUserTone(opt.value)}
                                                className={`p-3 rounded-lg border text-xs font-bold transition-all flex items-center gap-2 ${
                                                    userTone === opt.value
                                                        ? 'bg-purple-600/20 border-purple-500 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                                                        : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:bg-slate-800'
                                                }`}
                                            >
                                                <Icon name={opt.icon} className="text-xs" /> {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Verbosity & Humor & Technical Level */}
                                <div className="space-y-4">
                                     <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                        <label className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                                            <Icon name="align-left" className="text-sm text-blue-400" /> Verbosity & Humor Level
                                        </label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <select 
                                                value={verbosity} 
                                                onChange={(e) => setVerbosity(e.target.value)}
                                                aria-label="Verbosity Level"
                                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                                            >
                                                <option value="Conciso">Concise Output</option>
                                                <option value="Medio">Balanced Output</option>
                                                <option value="Detallado">Detailed/Verbose</option>
                                            </select>
                                            <select 
                                                value={humorLevel} 
                                                onChange={(e) => setHumorLevel(e.target.value)}
                                                aria-label="Humor Level"
                                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-yellow-500"
                                            >
                                                <option value="Ninguno">No Humor</option>
                                                <option value="Bajo">Subtle Humor</option>
                                                <option value="Alto">High/Witty Humor</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                        <label className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                                            <Icon name="robot" className="text-sm text-amber-400" /> Technical & Autonomy Level
                                        </label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <select 
                                                value={technicalLevel} 
                                                onChange={(e) => setTechnicalLevel(e.target.value)}
                                                aria-label="Technical Level"
                                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                                            >
                                                <option value="Principiante">Beginner User</option>
                                                <option value="Intermedio">Intermediate User</option>
                                                <option value="Avanzado">Advanced/Dev User</option>
                                            </select>
                                            <select 
                                                value={autonomyMode} 
                                                onChange={(e) => setAutonomyMode(e.target.value)}
                                                aria-label="Autonomy Level"
                                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                                            >
                                                <option value="Conservador">Conservative Agent</option>
                                                <option value="Semi-autónomo">Balanced Autonomy</option>
                                                <option value="Autónomo">Full Autonomous</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Custom Rules & About You */}
                                <div className="space-y-4">
                                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                        <label className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                                            <Icon name="scroll" className="text-sm text-pink-400" /> Custom Instructions
                                            <span className="text-[9px] text-slate-500 font-normal ml-auto">Rules for Assistant</span>
                                        </label>
                                        <textarea
                                            value={customRules}
                                            onChange={(e) => setCustomRules(e.target.value)}
                                            placeholder="Introduce reglas específicas: 'háblame de tú', 'no uses emojis', etc."
                                            rows={2}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-600 text-sm focus:border-pink-500 focus:outline-none resize-none"
                                        />
                                    </div>

                                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                        <label className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                                            <Icon name="info-circle" className="text-sm text-blue-400" /> User Context
                                            <span className="text-[9px] text-slate-500 font-normal ml-auto">About You</span>
                                        </label>
                                        <textarea
                                            value={userContext}
                                            onChange={(e) => setUserContext(e.target.value)}
                                            placeholder="Profesión, proyectos activos, herramientas favoritas..."
                                            rows={2}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-600 text-sm focus:border-blue-500 focus:outline-none resize-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="w-full max-w-md space-y-6 animate-fade-in text-left">
                            <div className="text-center mb-6">
                                <h1 className="text-2xl font-bold text-white mb-2">Providers Guide</h1>
                                <p className="text-slate-400 text-sm">How to get your API keys and set up local inference.</p>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                {/* Google AI Studio */}
                                <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 hover:border-blue-500/50 transition-colors group">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                            <img src="./geminiICON.png" alt="Gemini" className="w-5 h-5 object-contain" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-white">Google AI Studio</h3>
                                            <p className="text-[10px] text-slate-500">Gemini 1.5 Pro/Flash (Free Tier)</p>
                                        </div>
                                        <button 
                                            onClick={() => (window as any).electron?.openExternal('https://aistudio.google.com/app/apikey')}
                                            className="ml-auto text-[10px] bg-blue-600/20 text-blue-400 px-2 py-1 rounded hover:bg-blue-600/40 transition-colors font-bold"
                                        >
                                            Get Key <Icon name="external-link-alt" className="ml-1 text-[8px]" />
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-relaxed">
                                        Ve a AI Studio, crea un proyecto y genera tu API Key. Es el modelo principal de MikuCentral.
                                    </p>
                                </div>

                                {/* Groq */}
                                <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 hover:border-orange-500/50 transition-colors group">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                                            <img src="./groqICON.png" alt="Groq" className="w-4 h-4 object-contain brightness-0 invert" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-white">Groq Cloud</h3>
                                            <p className="text-[10px] text-slate-500">Ultra-fast Llama 3 & Mixtral</p>
                                        </div>
                                        <button 
                                            onClick={() => (window as any).electron?.openExternal('https://console.groq.com/keys')}
                                            className="ml-auto text-[10px] bg-orange-600/20 text-orange-400 px-2 py-1 rounded hover:bg-orange-600/40 transition-colors font-bold"
                                        >
                                            Get Key <Icon name="external-link-alt" className="ml-1 text-[8px]" />
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-relaxed">
                                        Inicia sesión con Google/GitHub y genera una API Key en la sección 'API Keys'. Ideal para respuestas instantáneas.
                                    </p>
                                </div>

                                {/* Z.AI */}
                                <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 hover:border-purple-500/50 transition-colors group">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                                            <img src="./zai.png" alt="Z.AI" className="w-4 h-4 object-contain brightness-0 invert" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-white">Z.AI (BigModel)</h3>
                                            <p className="text-[10px] text-slate-500">Large Context Inference</p>
                                        </div>
                                        <button 
                                            onClick={() => (window as any).electron?.openExternal('https://z.ai')}
                                            className="ml-auto text-[10px] bg-purple-600/20 text-purple-400 px-2 py-1 rounded hover:bg-purple-600/40 transition-colors font-bold"
                                        >
                                            Get Key <Icon name="external-link-alt" className="ml-1 text-[8px]" />
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-relaxed">
                                        La API privada para modelos de contexto masivo. Visita z.ai para obtener tu token v4.
                                    </p>
                                </div>

                                {/* Ollama */}
                                <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 hover:border-emerald-500/50 transition-colors group">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                            <img src="./ollamaICON.webp" alt="Ollama" className="w-5 h-5 object-contain brightness-0 invert" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-white">Ollama (Local)</h3>
                                            <p className="text-[10px] text-slate-500">Run LLMs on your computer</p>
                                        </div>
                                        <button 
                                            onClick={() => (window as any).electron?.openExternal('https://ollama.com/download')}
                                            className="ml-auto text-[10px] bg-emerald-600/20 text-emerald-400 px-2 py-1 rounded hover:bg-emerald-600/40 transition-colors font-bold"
                                        >
                                            Download <Icon name="download" className="ml-1 text-[8px]" />
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-relaxed">
                                        Descarga e instala Ollama. Una vez abierto, podrás conectar MikuCentral para inferencia 100% privada y local.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 5 && (
                        <div className="w-full max-w-md space-y-6 animate-fade-in">
                            <div className="text-center mb-6">
                                <h1 className="text-2xl font-bold text-white mb-2">Providers & API Keys</h1>
                                <p className="text-slate-400 text-sm">Configure your preferred AI providers to power the engine.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                    <label className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                                        <img src="./geminiICON.png" alt="Gemini" className="w-4 h-4 object-contain" /> Google Gemini (Primary)
                                    </label>
                                    <input
                                        type="password"
                                        value={config.apiKeys.gemini}
                                        onChange={(e) => setConfig({ ...config, apiKeys: { ...config.apiKeys, gemini: e.target.value } })}
                                        placeholder="AIzaSy..."
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-600 text-sm focus:border-blue-500 focus:outline-none"
                                    />
                                </div>

                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                    <label className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                                        <img src="./groqICON.png" alt="Groq" className="w-4 h-4 object-contain brightness-0 invert" /> Groq (Speed Inference)
                                    </label>
                                    <input
                                        type="password"
                                        value={config.apiKeys.groq}
                                        onChange={(e) => setConfig({ ...config, apiKeys: { ...config.apiKeys, groq: e.target.value } })}
                                        placeholder="gsk_..."
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-600 text-sm focus:border-orange-500 focus:outline-none"
                                    />
                                </div>

                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                    <label className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                                        <img src="./zai.png" alt="Z.AI" className="w-4 h-4 object-contain brightness-0 invert" /> Z.AI BigModel (Large Context)
                                    </label>
                                    <input
                                        type="password"
                                        value={config.apiKeys.zai}
                                        onChange={(e) => setConfig({ ...config, apiKeys: { ...config.apiKeys, zai: e.target.value } })}
                                        placeholder="v4_..."
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-600 text-sm focus:border-purple-500 focus:outline-none"
                                    />
                                </div>

                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                    <label className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                                        <img src="./ollamaICON.webp" alt="Ollama" className="w-4 h-4 object-contain brightness-0 invert" /> Ollama URL (Local Models)
                                        {/* Ollama status dot */}
                                        {healthStatus && (
                                            <span className={`ml-auto inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${
                                                healthStatus.ollama.online ? 'text-emerald-400' : 'text-red-400'
                                            }`}>
                                                <span className={`w-2 h-2 rounded-full ${
                                                    healthStatus.ollama.online
                                                        ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] animate-pulse'
                                                        : 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]'
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
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-600 text-sm focus:border-blue-500 focus:outline-none"
                                    />
                                    {healthStatus?.ollama.online && healthStatus.ollama.latencyMs !== null && (
                                        <div className="text-[10px] text-emerald-500/60 mt-1.5 font-mono">
                                            Latency: {healthStatus.ollama.latencyMs}ms
                                        </div>
                                    )}
                                </div>

                                {/* SearXena Status Card */}
                                <div className={`p-4 rounded-xl border transition-all ${
                                    healthStatus?.searxena.online
                                        ? 'bg-emerald-900/10 border-emerald-500/30'
                                        : 'bg-slate-800/50 border-slate-700'
                                }`}>
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-bold text-white flex items-center gap-2">
                                            <Icon name="search" className="text-sm text-cyan-400" /> SearXena (Local Search)
                                        </label>
                                        {healthStatus && (
                                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${
                                                healthStatus.searxena.online ? 'text-emerald-400' : 'text-red-400'
                                            }`}>
                                                <span className={`w-2 h-2 rounded-full ${
                                                    healthStatus.searxena.online
                                                        ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] animate-pulse'
                                                        : 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]'
                                                }`} />
                                                {healthStatus.searxena.online ? 'Online' : 'Offline'}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-2">
                                        {healthStatus?.searxena.online
                                            ? `Connected — ${healthStatus.searxena.latencyMs}ms`
                                            : 'Optional. Provides private local web search via SearXNG.'
                                        }
                                    </p>
                                </div>

                                {/* Vosk Status Card */}
                                <div className={`p-4 rounded-xl border transition-all ${
                                    healthStatus?.vosk.online
                                        ? 'bg-emerald-900/10 border-emerald-500/30'
                                        : 'bg-slate-800/50 border-slate-700'
                                }`}>
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-bold text-white flex items-center gap-2">
                                            <Icon name="microphone" className="text-sm text-pink-400" /> Vosk (Voice Engine)
                                        </label>
                                        {healthStatus && (
                                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${
                                                healthStatus.vosk.online ? 'text-emerald-400' : 'text-red-400'
                                            }`}>
                                                <span className={`w-2 h-2 rounded-full ${
                                                    healthStatus.vosk.online
                                                        ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] animate-pulse'
                                                        : 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]'
                                                }`} />
                                                {healthStatus.vosk.online ? 'Ready' : 'Not Loaded'}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-2">
                                        {healthStatus?.vosk.online
                                            ? 'Vosk Python module detected and working.'
                                            : 'Requires the `vosk` Python module in the engine workspace.'
                                        }
                                    </p>
                                </div>
                            </div>
                            {error && (
                                <div className="text-red-400 text-xs text-center border border-red-500/30 bg-red-900/20 py-2 rounded">
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {step === 6 && (
                        <div className="w-full max-w-md space-y-6 animate-fade-in">
                            <div className="text-center mb-6">
                                <h1 className="text-2xl font-bold text-white mb-2">Telegram Integration</h1>
                                <p className="text-slate-400 text-sm">Configure Telegram to receive notifications and interact remotely. (Optional)</p>
                            </div>

                            {/* BotFather Instructions */}
                            <div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-xl space-y-3">
                                <div className="flex items-center gap-2 text-blue-400">
                                    <Icon name="info-circle" className="text-lg" />
                                    <span className="font-bold text-sm">How to create your bot</span>
                                </div>
                                <ol className="text-xs text-blue-200/80 space-y-2 list-decimal list-inside">
                                    <li>Abre Telegram y busca <span className="font-mono bg-blue-500/20 px-1.5 py-0.5 rounded">@BotFather</span></li>
                                    <li>Envía el comando <span className="font-mono bg-blue-500/20 px-1.5 py-0.5 rounded">/newbot</span> y sigue las instrucciones</li>
                                    <li>Copia el <span className="font-bold">Bot Token</span> que BotFather te proporcione</li>
                                    <li>Busca <span className="font-mono bg-blue-500/20 px-1.5 py-0.5 rounded">@userinfobot</span> en Telegram</li>
                                    <li>Envía cualquier mensaje para obtener tu <span className="font-bold">Chat ID</span></li>
                                </ol>
                                <div className="text-[10px] text-blue-300/60 italic mt-2">
                                    Puedes configurar Telegram más tarde desde Settings si prefieres hacerlo después.
                                </div>
                            </div>

                            <div className="space-y-4">
                                {/* Bot Token */}
                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                    <label className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                                        <Icon name="telegram-plane" className="text-sm text-cyan-400" /> Bot Token
                                        <span className="text-[9px] text-slate-500 font-normal ml-auto">Optional</span>
                                    </label>
                                    <input
                                        type="password"
                                        value={telegramBotToken}
                                        onChange={(e) => setTelegramBotToken(e.target.value)}
                                        placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-600 text-sm focus:border-cyan-500 focus:outline-none font-mono"
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1.5">Token proporcionado por BotFather (formato: números:letras)</p>
                                </div>

                                {/* Chat ID */}
                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                    <label className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                                        <Icon name="user" className="text-sm text-cyan-400" /> Chat ID
                                        <span className="text-[9px] text-slate-500 font-normal ml-auto">Optional</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={telegramChatId}
                                        onChange={(e) => setTelegramChatId(e.target.value)}
                                        placeholder="123456789"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-600 text-sm focus:border-cyan-500 focus:outline-none font-mono"
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1.5">Tu ID de chat (obténlo desde @userinfobot)</p>
                                </div>

                                {/* Optional Note */}
                                <div className="bg-slate-800/30 border border-slate-700/50 p-3 rounded-lg flex items-start gap-2">
                                    <Icon name="check-circle" className="text-emerald-400 text-xs mt-0.5 flex-shrink-0" />
                                    <div className="text-[10px] text-slate-400 leading-relaxed">
                                        Si dejas estos campos vacíos, puedes configurar Telegram más tarde desde <span className="text-slate-300">Settings → Telegram</span>.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-between items-center">
                    <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className={`w-2 h-2 rounded-full transition-all ${step === i ? 'bg-blue-500 w-4' : 'bg-slate-700'}`} />
                        ))}
                    </div>
                    <div className="flex gap-3">
                        {step > 1 && (
                            <button
                                onClick={handlePrev}
                                disabled={loading}
                                className="px-6 py-2 rounded-lg font-bold text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
                            >
                                Back
                            </button>
                        )}
                        {step < 6 ? (
                            <button
                                onClick={handleNext}
                                disabled={step === 3 && !userName.trim()}
                                className="px-8 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:active:scale-100"
                            >
                                Continue
                            </button>
                        ) : (
                            <>
                                {/* Soft warning if no provider configured and Ollama offline */}
                                {healthStatus && !healthStatus.ollama.online && !config.apiKeys.gemini && !config.apiKeys.groq && !config.apiKeys.zai && (
                                    <span className="text-[10px] text-amber-400 mr-2 flex items-center gap-1">
                                        <Icon name="exclamation-triangle" className="text-xs" /> No provider available
                                    </span>
                                )}
                                <button
                                    onClick={finish}
                                    disabled={loading || !selectedPath}
                                    className="px-8 py-2 rounded-lg font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:active:scale-100"
                                >
                                    {loading ? <Icon name="spinner" className="animate-spin" /> : <Icon name="check" />}
                                    Initialize Engine
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
