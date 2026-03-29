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

    // Trigger health check when entering Step 4 (providers), poll every 8s
    useEffect(() => {
        if (step === 4) {
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

    const handleNext = () => setStep(prev => prev + 1);
    const handlePrev = () => setStep(prev => prev - 1);

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
                                VERBOSITY: 'Medio',
                                HUMOR_LEVEL: 'Bajo',
                                USER_NAME: userName || 'Usuario',
                                TECHNICAL_SKILL: technicalLevel,
                                CURRENT_GOAL: currentGoal,
                                AUTONOMY_MODE: autonomyMode,
                                USER_CONTEXT_DUMP: 'Sin contexto adicional proporcionado.',
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
            <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[85vh] min-h-[500px] max-h-[800px] animate-macos-expand">
                {/* Header */}
                <div className="h-16 flex items-center justify-start px-6 border-b border-slate-800 bg-slate-950 gap-4">
                    <img src="./mikuBotICON.png" alt="Logo" className="w-8 h-8 object-cover rounded shadow-inner" />
                    <div>
                        <h2 className="text-lg font-bold text-white tracking-wider">MikuCentral Setup</h2>
                        <p className="text-xs text-slate-500">First Run Initialization</p>
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
                        <div className="w-full max-w-md space-y-6 animate-fade-in">
                            <div className="text-center mb-6">
                                <h1 className="text-2xl font-bold text-white mb-2">Agent Personalization</h1>
                                <p className="text-slate-400 text-sm">Customize how MikuBot interacts with you. These settings shape the agent's personality files.</p>
                            </div>

                            <div className="space-y-4">
                                {/* User Name */}
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
                                    <p className="text-[10px] text-slate-500 mt-1.5">The agent will address you by this name.</p>
                                </div>

                                {/* Tone Selection */}
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

                                {/* Technical Level */}
                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                    <label className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                                        <Icon name="layer-group" className="text-sm text-cyan-400" /> Technical Level
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { value: 'Principiante', label: 'Beginner' },
                                            { value: 'Intermedio', label: 'Intermediate' },
                                            { value: 'Avanzado', label: 'Advanced' },
                                        ].map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setTechnicalLevel(opt.value)}
                                                className={`p-2.5 rounded-lg border text-xs font-bold transition-all ${
                                                    technicalLevel === opt.value
                                                        ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                                                        : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:bg-slate-800'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Current Goal */}
                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                    <label className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                                        <Icon name="bullseye" className="text-sm text-emerald-400" /> Primary Goal
                                    </label>
                                    <input
                                        type="text"
                                        value={currentGoal}
                                        onChange={(e) => setCurrentGoal(e.target.value)}
                                        placeholder="¿Cuál es tu objetivo principal?"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-600 text-sm focus:border-emerald-500 focus:outline-none"
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1.5">e.g. Desarrollo de software, Investigación, Productividad personal</p>
                                </div>

                                {/* Autonomy Mode */}
                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                    <label className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                                        <Icon name="robot" className="text-sm text-amber-400" /> Autonomy Level
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { value: 'Conservador', label: 'Conservative' },
                                            { value: 'Semi-autónomo', label: 'Balanced' },
                                            { value: 'Autónomo', label: 'Autonomous' },
                                        ].map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setAutonomyMode(opt.value)}
                                                className={`p-2.5 rounded-lg border text-xs font-bold transition-all ${
                                                    autonomyMode === opt.value
                                                        ? 'bg-amber-600/20 border-amber-500 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                                                        : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:bg-slate-800'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="w-full max-w-md space-y-6 animate-fade-in">
                            <div className="text-center mb-6">
                                <h1 className="text-2xl font-bold text-white mb-2">Providers & API Keys</h1>
                                <p className="text-slate-400 text-sm">Configure your preferred AI providers to power the engine. (These can be changed later)</p>
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
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-600 text-sm focus:border-blue-500 focus:outline-none"
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
                                        {!healthStatus && healthLoading && (
                                            <Icon name="spinner" className="animate-spin text-slate-500 text-xs" />
                                        )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-2">
                                        {healthStatus?.searxena.online
                                            ? `Connected — ${healthStatus.searxena.latencyMs}ms`
                                            : 'Optional. Provides private local web search via SearXNG.'
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
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-between items-center">
                    <div className="flex gap-1.5">
                        {[1, 2, 3, 4].map(i => (
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
                        {step < 4 ? (
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
                                {healthStatus && !healthStatus.ollama.online && !config.apiKeys.gemini && !config.apiKeys.groq && (
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
