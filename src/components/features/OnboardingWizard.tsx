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

    // Personalization Variables
    const [userName, setUserName] = useState('');
    const [userTone, setUserTone] = useState('Profesional y amigable');
    const [technicalLevel, setTechnicalLevel] = useState('Intermedio');
    const [currentGoal, setCurrentGoal] = useState('Asistente y Acompañante personal');
    const [autonomyMode, setAutonomyMode] = useState('Asistido');
    const [assistantAlias, setAssistantAlias] = useState('mikuBot');
    const [verbosity, setVerbosity] = useState('Medio');
    const [humorLevel, setHumorLevel] = useState('Bajo');
    
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
                : 'Sin reglas específicas.';

            const formattedContext = contextList.length > 0
                ? contextList.map(c => `- ${c}`).join('\n')
                : 'Sin contexto.';

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
                        LANGUAGE: 'Español', TONE: userTone, VERBOSITY: verbosity, HUMOR_LEVEL: humorLevel,
                        USER_NAME: userName || 'Usuario', ASSISTANT_ALIAS: assistantAlias || 'mikuBot',
                        TECHNICAL_SKILL: technicalLevel, CURRENT_GOAL: currentGoal, AUTONOMY_MODE: autonomyMode,
                        USER_CONTEXT_DUMP: formattedContext,
                        CUSTOM_RULES: formattedRules,
                    };
                    const hydrated = hydrateAllTemplates(variables, templateContent);
                    for (const file of hydrated) {
                        await (window as any).electron.writeFile({
                            folderPath: file.target === 'core' ? nextConfig.folderPaths.core : nextConfig.folderPaths.tools,
                            filename: file.filename, content: file.content
                        });
                    }
                }
            }
            await onComplete(nextConfig, { targetPath: selectedPath });
        } catch (err: any) { setError(err.message || 'Error grave en inicialización'); } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/98 backdrop-blur-3xl overflow-hidden p-2 md:p-4">
            <style>{`
                @keyframes premiumIn {
                    from { opacity: 0; transform: scale(0.99) translateY(10px); filter: blur(8px); }
                    to { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
                }
                .animate-premium {
                    animation: premiumIn 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
            <div className="bg-slate-900/60 backdrop-blur-3xl border-none shadow-[0_45px_120px_-25px_rgba(0,0,0,1)] w-full h-full md:w-[98vw] md:h-[95vh] max-w-6xl max-h-[610px] rounded-[2rem] md:rounded-[2.5rem] overflow-hidden flex flex-col relative transition-all duration-700">
                
                {/* Header */}
                <div className="h-14 md:h-16 shrink-0 border-b border-white/5 flex items-center px-8 bg-slate-950/25 gap-5">
                    <img src="./mikuBotICON.png" alt="Logo" className="w-6 h-6 object-contain opacity-90 drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]" />
                    <div className="flex items-center gap-3.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.6)] shrink-0" />
                        <div className="flex flex-col items-start">
                            <h2 className="text-sm md:text-base lg:text-lg font-black text-white tracking-tight leading-none mb-1">mikuBot Dashboard</h2>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Inicialización del Sistema</p>
                        </div>
                    </div>
                    {error && <div className="ml-auto bg-red-600/10 border border-red-600/20 px-5 py-2 rounded-2xl text-[10px] text-red-500 font-black animate-shake uppercase tracking-widest">{error}</div>}
                </div>

                {/* Content Body */}
                <div className="flex-1 overflow-hidden px-8 py-2 md:px-14 flex flex-col items-center justify-start relative pt-4 md:pt-8">
                    
                    {step === 1 && (
                        <div className="w-full max-w-5xl grid grid-cols-2 gap-8 lg:gap-16 items-center animate-premium py-6">
                            <div className="flex flex-col items-center text-center space-y-6 md:space-y-8">
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-blue-500/15 blur-[120px] rounded-full scale-125" />
                                    <div className="w-32 h-32 md:w-52 md:h-52 rounded-[4.5rem] bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center shadow-2xl relative z-10 hover:scale-105 transition-transform duration-1000 overflow-hidden">
                                        <img src="./mikuBotICON.png" alt="Miku" className="w-full h-full object-cover" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <h1 className="text-4xl md:text-6xl font-black text-slate-100 tracking-tighter leading-none uppercase">Bienvenido</h1>
                                    <p className="text-blue-200/80 text-sm md:text-lg leading-relaxed font-serif italic tracking-wide">Crea y personaliza a tu nuevo asistente</p>
                                </div>
                            </div>
                            
                            <div className="space-y-4 bg-slate-950/40 p-8 rounded-[3.5rem] shadow-inner border border-transparent hover:border-blue-500/20 transition-all backdrop-blur-xl group">
                                <h3 className="text-[11px] font-black text-blue-500 uppercase tracking-[0.5em] mb-4 text-center">Fases de Configuración</h3>
                                {[
                                    { t: 'Espacio de Trabajo', d: 'Configuración de directorios del sistema.', i: 'folder', c: 'emerald' },
                                    { t: 'Identidad y Personalidad', d: 'Definición de tono, verbosidad y contexto.', i: 'user', c: 'purple' },
                                    { t: 'Proveedores de IA', d: 'Conexión con motores cognitivos.', i: 'bolt', c: 'orange' },
                                    { t: 'Control Remoto', d: 'Enlace bidireccional vía Telegram.', i: 'paper-plane', c: 'cyan' },
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
                                <h2 className="text-2xl font-black text-white tracking-[0.2em] uppercase mb-0.5">ESPACIO DE TRABAJO</h2>
                                <p className="text-slate-500 text-[9px] font-bold uppercase tracking-[0.4em] opacity-40">Almacenamiento del Sistema</p>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                {[
                                    { id: 'default', t: 'Predeterminado', d: 'Ruta nativa.', p: defaultPath, i: 'folder', c: 'emerald' },
                                    { id: 'custom', t: 'Personalizado', d: 'Ubicación específica.', p: customPath, i: 'pen', c: 'indigo' }
                                ].map(o => (
                                    <div key={o.id} onClick={() => setPathMode(o.id as any)} className={`p-5 md:p-6 rounded-[2.5rem] cursor-pointer transition-all duration-500 bg-slate-950/40 relative overflow-hidden flex flex-col justify-start gap-4 border border-transparent ${pathMode === o.id ? `shadow-[0_20px_50px_rgba(0,0,0,0.3)] bg-${o.c}-500/10` : `hover:border-${o.c}-500/30 hover:bg-slate-900/60`}`}>
                                        <div className="flex items-center justify-between shrink-0">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${pathMode === o.id ? `bg-${o.c}-600 text-white` : 'bg-slate-800 text-slate-600'}`}>
                                                <Icon name={o.i} className="text-2xl" />
                                            </div>
                                            {pathMode === o.id && <div className={`text-[9px] font-black uppercase tracking-[0.3em] text-${o.c}-500`}>Seleccionado</div>}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-lg font-black text-white uppercase tracking-widest leading-none mb-2">{o.t}</div>
                                            <div className="text-[8.5px] text-slate-500 font-mono truncate bg-black/50 p-3 rounded-xl border border-transparent mb-3 shadow-inner">{o.p}</div>
                                            <p className="text-[8.5px] text-slate-600 font-black uppercase tracking-widest opacity-80">{o.d}</p>
                                        </div>
                                        {o.id === 'custom' && pathMode === 'custom' && (
                                            <button onClick={async (e) => { e.stopPropagation(); const r = await (window as any).electron.selectFolder(); if(r.ok) setCustomPath(r.path); }} className="mt-auto bg-indigo-600 text-white px-6 py-3 rounded-[1.2rem] text-[9px] font-black uppercase tracking-widest shadow-2xl hover:bg-indigo-500 active:scale-95 transition-all">Explorar</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {showingWarning && (
                                <div className="bg-slate-950/60 p-5 rounded-[2rem] shadow-inner flex items-center justify-between gap-4 border border-transparent hover:border-orange-500/20 animate-premium transition-all">
                                    <div className="flex items-center gap-3">
                                        <Icon name="exclamation-triangle" className="text-orange-500 text-2xl" />
                                        <div className="text-[9px] text-slate-300 font-black uppercase tracking-widest leading-tight">Instalación detectada.<br/><span className="text-orange-400 opacity-80 text-[8px]">Seleccione acción.</span></div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => {setCleanInstall(false); setShowingWarning(false);}} className={`px-4 py-2 rounded-xl text-[8.5px] font-black uppercase tracking-widest transition-all ${!cleanInstall ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Vincular</button>
                                        <button onClick={() => {setCleanInstall(true); setShowingWarning(false);}} className={`px-4 py-2 rounded-xl text-[8.5px] font-black uppercase tracking-widest transition-all ${cleanInstall ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Limpiar</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="w-full max-w-2xl space-y-8 animate-premium h-full flex flex-col justify-center py-6">
                            <div className="text-center">
                                <h1 className="text-3xl font-black text-white uppercase tracking-widest mb-1">IDENTIDAD</h1>
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Nombres de Reconocimiento</p>
                            </div>
                            <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[9px] font-black text-slate-500 uppercase ml-6 tracking-[0.4em]">Nombre del Usuario</label>
                                    <input value={userName} onChange={(e)=>setUserName(e.target.value)} placeholder="Ej: Tony Stark" className="w-full bg-slate-950/40 border-2 border-transparent hover:border-cyan-500/30 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-cyan-500/50 transition-all font-black shadow-inner placeholder-slate-800" />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[9px] font-black text-slate-500 uppercase ml-6 tracking-[0.4em]">Alias del Asistente</label>
                                    <input value={assistantAlias} onChange={(e)=>setAssistantAlias(e.target.value)} placeholder="Ej: Miku" className="w-full bg-slate-950/40 border-2 border-transparent hover:border-blue-500/30 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-blue-500/50 transition-all font-black shadow-inner placeholder-slate-800" />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="w-full max-w-5xl space-y-5 animate-premium h-full flex flex-col justify-center py-4">
                            <div className="text-center">
                                <h1 className="text-3xl font-black text-white uppercase tracking-widest">PERSONALIDAD</h1>
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.5em] opacity-40 text-center">Comportamiento y Tono del Asistente</p>
                            </div>
                            <div className="flex justify-center mb-0">
                                <div className="bg-slate-950/40 p-1.5 rounded-2xl border border-transparent hover:border-white/10 transition-all flex gap-1.5 shadow-inner">
                                    <button 
                                        onClick={() => { setShowManualTone(false); if(userTone === '' || !['Profesional y amigable', 'Casual y relajado', 'Conciso y directo', 'Detallado y didáctico'].includes(userTone)) setUserTone('Profesional y amigable'); }} 
                                        className={`px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!showManualTone ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        Predefinido
                                    </button>
                                    <button 
                                        onClick={() => { setShowManualTone(true); if (['Profesional y amigable', 'Casual y relajado', 'Conciso y directo', 'Detallado y didáctico'].includes(userTone)) setUserTone(''); }} 
                                        className={`px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showManualTone ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        Manual
                                    </button>
                                </div>
                            </div>

                            {!showManualTone ? (
                                <div className="grid grid-cols-4 gap-4 animate-premium">
                                    {[
                                        { v: 'Profesional y amigable', t: 'Formal', i: 'briefcase', d: 'Comunicación estructurada.', c: 'purple' },
                                        { v: 'Casual y relajado', t: 'Casual', i: 'coffee', d: 'Tono amigable y fluido.', c: 'amber' },
                                        { v: 'Conciso y directo', t: 'Directo', i: 'bolt', d: 'Respuestas breves y al grano.', c: 'sky' },
                                        { v: 'Detallado y didáctico', t: 'Docente', i: 'book', d: 'Explicaciones profundas.', c: 'rose' },
                                    ].map(o => (
                                        <div key={o.v} onClick={() => setUserTone(o.v)} className={`p-4 rounded-2xl cursor-pointer text-center transition-all duration-500 border border-transparent ${userTone === o.v ? `bg-${o.c}-500/10 shadow-[0_0_20px_rgba(0,0,0,0.3)] scale-105` : `bg-slate-950/30 hover:border-${o.c}-500/30 hover:bg-slate-900/50 opacity-80 hover:opacity-100`}`}>
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 transition-all ${userTone === o.v ? (o.c === 'purple' ? 'bg-purple-600' : o.c === 'amber' ? 'bg-amber-600' : o.c === 'sky' ? 'bg-sky-600' : 'bg-rose-600') + ' text-white shadow-xl' : 'bg-slate-800 text-slate-600'}`}>
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
                                        <label className="text-[10px] font-black text-slate-500 uppercase ml-8 tracking-[0.4em]">Personalidad a Medida</label>
                                        <input 
                                            autoFocus 
                                            value={userTone}
                                            placeholder="Ej: Sarcástico y rebelde como un pirata espacial..." 
                                            className="w-full bg-slate-950/60 border-2 border-transparent hover:border-indigo-500/30 rounded-2xl px-10 py-6 text-base font-black text-white outline-none focus:border-indigo-500/50 shadow-inner placeholder-slate-800 transition-all font-mono"
                                            onChange={(e) => setUserTone(e.target.value)}
                                        />
                                        <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest ml-8 opacity-60">Define exactamente cómo quieres que se comporte el sistema.</p>
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-500 uppercase block text-center tracking-[0.5em]">Verbosidad</label>
                                    {!['Conciso', 'Medio', 'Detallado'].includes(verbosity) && verbosity !== '' ? (
                                        <div className="relative animate-premium">
                                            <input title="Verbosidad Personalizada" placeholder="Escribe el nivel de detalle..." value={verbosity} onChange={(e)=>setVerbosity(e.target.value)} autoFocus className="w-full bg-slate-950/70 border-2 border-transparent hover:border-blue-500/30 focus:border-blue-500/50 rounded-2xl px-8 py-5 text-xs text-white outline-none transition-all font-black text-center shadow-inner" />
                                            <button onClick={()=>setVerbosity('Medio')} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center border border-white/10 transition-all">×</button>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <button 
                                                onClick={() => setActiveMenu(activeMenu === 'verb' ? null : 'verb')}
                                                className="w-full bg-slate-950/70 border border-transparent hover:border-white/10 rounded-2xl px-8 py-4 text-xs text-white outline-none transition-all font-black flex items-center justify-between shadow-inner"
                                            >
                                                <span className="flex-grow text-center">{verbosity}</span>
                                                <Icon name={activeMenu === 'verb' ? 'chevron-up' : 'chevron-down'} className="text-slate-600 text-[10px] ml-2" />
                                            </button>
                                            {activeMenu === 'verb' && (
                                                <>
                                                    <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
                                                    <div className="absolute left-0 right-0 bottom-full mb-2 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-20 py-2 animate-premium">
                                                        {['Conciso', 'Medio', 'Detallado'].map(v => (
                                                            <div key={v} onClick={() => { setVerbosity(v); setActiveMenu(null); }} className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all ${verbosity === v ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>{v}</div>
                                                        ))}
                                                        <div onClick={() => {setVerbosity('custom'); setActiveMenu(null);}} className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-500/10 cursor-pointer transition-all border-t border-white/5 mt-1 italic">Personalizado</div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                    {verbosity === 'custom' && setVerbosity('Ej: Muy breve, solo código')}
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-500 uppercase block text-center tracking-[0.5em]">Sentido del Humor</label>
                                    {!['Ninguno', 'Bajo', 'Alto'].includes(humorLevel) && humorLevel !== '' ? (
                                        <div className="relative animate-premium">
                                            <input title="Humor Personalizado" placeholder="Escribe el estilo de humor..." value={humorLevel} onChange={(e)=>setHumorLevel(e.target.value)} autoFocus className="w-full bg-slate-950/70 border-2 border-transparent hover:border-teal-500/30 focus:border-teal-500/50 rounded-2xl px-8 py-5 text-xs text-white outline-none transition-all font-black text-center shadow-inner" />
                                            <button onClick={()=>setHumorLevel('Bajo')} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center border border-white/10 transition-all">×</button>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <button 
                                                onClick={() => setActiveMenu(activeMenu === 'humor' ? null : 'humor')}
                                                className="w-full bg-slate-950/70 border border-transparent hover:border-white/10 rounded-2xl px-8 py-4 text-xs text-white outline-none transition-all font-black flex items-center justify-between shadow-inner"
                                            >
                                                <span className="flex-grow text-center">{humorLevel}</span>
                                                <Icon name={activeMenu === 'humor' ? 'chevron-up' : 'chevron-down'} className="text-slate-600 text-[10px] ml-2" />
                                            </button>
                                            {activeMenu === 'humor' && (
                                                <>
                                                    <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
                                                    <div className="absolute left-0 right-0 bottom-full mb-2 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-20 py-2 animate-premium">
                                                        {['Ninguno', 'Bajo', 'Alto'].map(v => (
                                                            <div key={v} onClick={() => { setHumorLevel(v); setActiveMenu(null); }} className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all ${humorLevel === v ? 'bg-teal-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>{v}</div>
                                                        ))}
                                                        <div onClick={() => {setHumorLevel('custom'); setActiveMenu(null);}} className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-500/10 cursor-pointer transition-all border-t border-white/5 mt-1 italic">Personalizado</div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                    {humorLevel === 'custom' && setHumorLevel('Ej: Sarcasmo fino')}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 5 && (
                        <div className="w-full max-w-4xl space-y-8 animate-premium h-full flex flex-col justify-center py-4">
                            <div className="text-center">
                                <h1 className="text-3xl font-black text-white uppercase tracking-widest">ESTADO OPERATIVO</h1>
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.5em] opacity-40 text-center">Nivel del Usuario y Autonomía del Asistente</p>
                            </div>
                             <div className="grid grid-cols-2 gap-8 items-start">
                                <div className="space-y-5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase block text-center tracking-[0.5em]">Nivel Técnico (Usuario)</label>
                                    {!['Principiante', 'Intermedio', 'Experto'].includes(technicalLevel) && technicalLevel !== '' ? (
                                        <div className="relative animate-premium">
                                            <input title="Nivel Técnico Personalizado" placeholder="Define tu nivel técnico..." value={technicalLevel} onChange={(e)=>setTechnicalLevel(e.target.value)} autoFocus className="w-full bg-slate-950/70 border-2 border-transparent hover:border-orange-500/30 focus:border-orange-500/50 rounded-2xl px-6 py-4 text-xs text-white outline-none transition-all font-black text-center shadow-inner" />
                                            <button onClick={()=>setTechnicalLevel('Intermedio')} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center border border-white/10 transition-all">×</button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3">
                                            {['Principiante', 'Intermedio', 'Experto'].map(l => (
                                                <div key={l} onClick={() => setTechnicalLevel(l)} className={`py-4 rounded-xl text-[9px] font-black uppercase text-center cursor-pointer transition-all border border-transparent ${technicalLevel === l ? 'bg-orange-500/15 text-orange-400 shadow-lg' : 'bg-slate-950/40 text-slate-500 hover:border-orange-500/20 hover:bg-slate-900/40'}`}>{l}</div>
                                            ))}
                                            <div onClick={() => setTechnicalLevel('Custom...')} className="py-4 rounded-xl text-[9px] font-black uppercase text-center cursor-pointer transition-all border border-transparent bg-slate-950/40 text-slate-600 hover:text-white hover:border-white/10 italic">Personalizar</div>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase block text-center tracking-[0.5em]">Modo de Autonomía (Asistente)</label>
                                    {!['Manual', 'Asistido', 'Automático'].includes(autonomyMode) && autonomyMode !== '' ? (
                                        <div className="relative animate-premium">
                                            <input title="Modo de Autonomía Personalizado" placeholder="Define la autonomía..." value={autonomyMode} onChange={(e)=>setAutonomyMode(e.target.value)} autoFocus className="w-full bg-slate-950/70 border-2 border-transparent hover:border-indigo-500/30 focus:border-indigo-500/50 rounded-2xl px-6 py-4 text-xs text-white outline-none transition-all font-black text-center shadow-inner" />
                                            <button onClick={()=>setAutonomyMode('Asistido')} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center border border-white/10 transition-all">×</button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3">
                                            {['Manual', 'Asistido', 'Automático'].map(l => (
                                                <div key={l} onClick={() => setAutonomyMode(l)} className={`py-4 rounded-xl text-[9px] font-black uppercase text-center cursor-pointer transition-all border border-transparent ${autonomyMode === l ? 'bg-indigo-500/15 text-indigo-400 shadow-lg' : 'bg-slate-950/40 text-slate-500 hover:border-indigo-500/20 hover:bg-slate-900/40'}`}>{l}</div>
                                            ))}
                                            <div onClick={() => setAutonomyMode('Custom...')} className="py-4 rounded-xl text-[9px] font-black uppercase text-center cursor-pointer transition-all border border-transparent bg-slate-950/40 text-slate-600 hover:text-white hover:border-white/10 italic">Personalizar</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-3 pt-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase ml-6 tracking-[0.5em]">Objetivo Principal (Asistente)</label>
                                {!['Asistente y Acompañante personal', 'Asistencia en programación', 'Automatización de tareas', 'Generación de contenido creativo', 'Análisis de datos avanzado', 'Compañía y charla casual', 'Soporte técnico especializado', 'Aprendizaje y tutoría interactiva', 'Redacción de correos y documentos', 'Búsqueda y resumen de información', 'Planificación de proyectos', 'Resolución de problemas complejos', 'Traducción y localización', 'Gestión de agenda'].includes(currentGoal) && currentGoal !== '' ? (
                                    <div className="relative animate-premium group">
                                        <input 
                                            title="Objetivo Personalizado"
                                            placeholder="Ej: Exploración de datos espaciales..." 
                                            value={currentGoal} 
                                            onChange={(e) => setCurrentGoal(e.target.value)} 
                                            className="w-full bg-slate-950/50 border border-transparent hover:border-blue-500/30 rounded-2xl px-8 py-5 text-sm text-white outline-none focus:border-blue-500/60 transition-all font-black shadow-inner" 
                                        />
                                        <button onClick={()=>setCurrentGoal('Asistente y Acompañante personal')} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center border border-white/10 transition-all">×</button>
                                    </div>
                                ) : (
                                    <div className="relative group">
                                        <button 
                                            onClick={() => setIsGoalMenuOpen(!isGoalMenuOpen)}
                                            className="w-full bg-slate-950/50 border border-white/5 hover:border-white/10 rounded-2xl px-8 py-5 text-sm text-white outline-none transition-all font-black flex items-center justify-between shadow-inner"
                                        >
                                            <span className="flex-grow text-center">{currentGoal}</span>
                                            <Icon name={isGoalMenuOpen ? 'chevron-up' : 'chevron-down'} className="text-slate-500 text-xs ml-2" />
                                        </button>

                                        {isGoalMenuOpen && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setIsGoalMenuOpen(false)} />
                                                <div className="absolute left-0 right-0 bottom-full mb-2 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-20 py-2 max-h-[180px] overflow-y-auto animate-premium custom-scrollbar">
                                                    {[
                                                        "Asistente y Acompañante personal", "Asistencia en programación", "Automatización de tareas", 
                                                        "Generación de contenido creativo", "Análisis de datos avanzado", 
                                                        "Compañía y charla casual", "Soporte técnico especializado", 
                                                        "Aprendizaje y tutoría interactiva", "Redacción de correos y documentos", 
                                                        "Búsqueda y resumen de información", "Planificación de proyectos", 
                                                        "Resolución de problemas complejos", "Traducción y localización", 
                                                        "Gestión de agenda"
                                                    ].map(g => (
                                                        <div 
                                                            key={g} 
                                                            onClick={() => { setCurrentGoal(g); setIsGoalMenuOpen(false); }}
                                                            className={`px-6 py-2.5 text-[11px] font-black uppercase tracking-wider cursor-pointer transition-all ${currentGoal === g ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                                                        >
                                                            {g}
                                                        </div>
                                                    ))}
                                                    <div 
                                                        onClick={() => { setCurrentGoal('custom'); setIsGoalMenuOpen(false); }}
                                                        className="px-6 py-2.5 text-[11px] font-black uppercase tracking-wider text-indigo-400 hover:bg-indigo-500/10 cursor-pointer transition-all border-t border-white/5 mt-1 italic"
                                                    >
                                                        ─── Personalizado ───
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                                {currentGoal === 'custom' && setCurrentGoal('Ej: Investigar nuevos fármacos')}
                            </div>
                        </div>
                    )}

                    {step === 6 && (
                        <div className="w-full max-w-5xl space-y-8 animate-premium h-full flex flex-col justify-center">
                            <div className="text-center">
                                <h1 className="text-3xl font-black text-white uppercase tracking-widest mb-1">PROTOCOLO</h1>
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.6em] opacity-40">Contexto del Usuario y Reglas del Asistente</p>
                            </div>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <label className="text-[11px] font-black text-slate-500 uppercase ml-12 tracking-[0.5em]">Biografía (Usuario)</label>
                                    <div className="bg-slate-950/40 border-2 border-transparent hover:border-blue-500/30 rounded-[4rem] px-6 py-6 shadow-inner flex flex-col h-[190px] lg:h-56 transition-all">
                                        <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 mb-4 px-2">
                                            {contextList.length === 0 && (
                                                <p className="text-slate-600 font-bold text-xs mt-4 text-center">Ejemplo: "Soy desarrollador web", "Me dedico a las ventas", etc.</p>
                                            )}
                                            {contextList.map((c, idx) => (
                                                <div key={idx} className="flex gap-3 items-center bg-slate-900/60 px-4 py-3 rounded-[1.5rem] group/ctx">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                                    <span className="text-xs text-slate-300 font-bold leading-tight flex-1">{c}</span>
                                                    <button onClick={() => setContextList(contextList.filter((_, i) => i !== idx))} className="text-slate-600 hover:text-blue-500 transition-colors" aria-label="Eliminar contexto">
                                                        <Icon name="times" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-2 relative mt-auto">
                                            <input value={newContext} onChange={(e) => setNewContext(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newContext.trim()) { setContextList([...contextList, newContext.trim()]); setNewContext(''); } }} placeholder="Agrega un dato y presiona Enter..." className="w-full bg-slate-900/80 border border-transparent rounded-[2rem] pl-6 pr-24 py-4 text-xs text-white outline-none focus:border-blue-500/40 transition-all font-bold placeholder-slate-700 shadow-inner" />
                                            <button onClick={() => { if (newContext.trim()) { setContextList([...contextList, newContext.trim()]); setNewContext(''); } }} className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-500 text-white px-5 rounded-[1.5rem] font-black text-[9px] uppercase tracking-widest transition-all shadow-lg active:scale-95">Añadir</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[11px] font-black text-slate-500 uppercase ml-12 tracking-[0.5em]">Directivas (Asistente)</label>
                                    <div className="bg-slate-950/40 border-2 border-transparent hover:border-rose-500/30 rounded-[4rem] px-6 py-6 shadow-inner flex flex-col h-[190px] lg:h-56 transition-all">
                                        <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 mb-4 px-2">
                                            {rulesList.length === 0 && (
                                                <p className="text-slate-600 font-bold text-xs mt-4 text-center">Ejemplo: "Nunca uses emojis", "Responde siempre en inglés", etc.</p>
                                            )}
                                            {rulesList.map((r, idx) => (
                                                <div key={idx} className="flex gap-3 items-center bg-slate-900/60 px-4 py-3 rounded-[1.5rem] group/rule">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                                                    <span className="text-xs text-slate-300 font-bold leading-tight flex-1">{r}</span>
                                                    <button onClick={() => setRulesList(rulesList.filter((_, i) => i !== idx))} className="text-slate-600 hover:text-rose-500 transition-colors" aria-label="Eliminar regla">
                                                        <Icon name="times" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-2 relative mt-auto">
                                            <input value={newRule} onChange={(e) => setNewRule(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newRule.trim()) { setRulesList([...rulesList, newRule.trim()]); setNewRule(''); } }} placeholder="Escribe una regla y presiona Enter..." className="w-full bg-slate-900/80 border border-transparent rounded-[2rem] pl-6 pr-24 py-4 text-xs text-white outline-none focus:border-rose-500/40 transition-all font-bold placeholder-slate-700 shadow-inner" />
                                            <button onClick={() => { if (newRule.trim()) { setRulesList([...rulesList, newRule.trim()]); setNewRule(''); } }} className="absolute right-2 top-2 bottom-2 bg-rose-600 hover:bg-rose-500 text-white px-5 rounded-[1.5rem] font-black text-[9px] uppercase tracking-widest transition-all shadow-lg active:scale-95">Añadir</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 7 && (
                        <div className="w-full max-w-6xl space-y-6 animate-premium h-full flex flex-col justify-center py-4 text-white">
                            <div className="text-center space-y-2">
                                <h1 className="text-2xl font-black uppercase tracking-widest leading-none">PROVEEDORES DE IA</h1>
                                <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.4em] opacity-60 text-center">Fase 1 de 2: Recolección de Claves</p>
                                <p className="text-blue-400 text-[8px] font-bold uppercase tracking-[0.2em] max-w-xl mx-auto border border-transparent hover:border-blue-500/30 transition-all bg-blue-500/10 px-6 py-2 rounded-2xl shadow-inner text-center">Recolecta solo las llaves que desees usar. <b>Solo necesitas 1 método configurado (llave API o inferencia local)</b> para operar tu Asistente.</p>
                            </div>
                            <div className="grid grid-cols-4 gap-4">
                                {[
                                    { id: 'gemini', t: 'Google AI', m: 'Gemini', i: './geminiICON.png', url: 'https://aistudio.google.com/', inv: false, hc: 'hover:border-blue-500/40 hover:bg-blue-900/10 hover:shadow-[0_0_40px_-10px_rgba(59,130,246,0.3)]', c: 'blue', desc: 'Free Tier Disponible, Modelos Masivos.' },
                                    { id: 'groq', t: 'Groq Cloud', m: 'LPU', i: './groqICON.png', url: 'https://console.groq.com/keys', inv: true, hc: 'hover:border-orange-500/40 hover:bg-orange-900/10 hover:shadow-[0_0_40px_-10px_rgba(249,115,22,0.3)]', c: 'orange', desc: 'Extenso Catálogo de Modelos.' },
                                    { id: 'zai', t: 'Z.AI', m: 'Avanzado', i: './zai.png', url: 'https://z.ai/subscribe', inv: true, hc: 'hover:border-violet-500/40 hover:bg-violet-900/10 hover:shadow-[0_0_40px_-10px_rgba(139,92,246,0.3)]', c: 'violet', desc: 'Suscripción Económica, Modelos Potentes.' },
                                    { id: 'ollama', t: 'Ollama', i: './ollamaICON.webp', url: 'https://ollama.com/download', inv: true, hc: 'hover:border-emerald-500/40 hover:bg-emerald-900/10 hover:shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)]', c: 'emerald', m: 'Local', desc: 'Inferencia Local. Modelos Cloud Gratis creando una Cuenta.' },
                                ].map(p => (
                                    <div key={p.id} className={`p-6 rounded-[2rem] bg-slate-950/40 text-center flex flex-col items-center justify-between group transition-all duration-500 border border-transparent ${p.hc} min-h-[240px]`}>
                                        <div className={`w-14 h-14 shrink-0 rounded-2xl bg-slate-800/60 flex items-center justify-center p-3 mb-4 transition-all group-hover:scale-110 shadow-inner border border-transparent group-hover:border-${p.c}-500/20`}>
                                            <img src={p.i} alt="" className={`w-full h-full object-contain ${p.inv ? 'brightness-0 invert opacity-60' : ''}`} />
                                        </div>
                                        <div className="mb-4 space-y-1 flex-grow flex flex-col justify-center">
                                            <div className="text-[11px] font-black uppercase tracking-widest leading-none text-white/90">{p.t}</div>
                                            <div className="text-[8px] text-slate-500 font-bold leading-snug px-2 opacity-80">{p.desc}</div>
                                        </div>
                                        <button 
                                            onClick={() => window.open(p.url, '_blank', 'nodeIntegration=no')} 
                                            className={`w-full py-2.5 rounded-[1.2rem] bg-slate-800 transition-all duration-300 shadow-lg text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white group-hover:bg-slate-700 hover:scale-105 active:scale-95 shrink-0`}
                                        >
                                            {p.id === 'ollama' ? 'Descargar' : 'Obtener Key'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 8 && (
                        <div className="w-full max-w-5xl space-y-10 animate-premium h-full flex flex-col justify-center py-6">
                            <div className="text-center">
                                <h1 className="text-3xl font-black text-white uppercase tracking-widest">CREDENCIALES</h1>
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.5em] opacity-40">Seguridad y Claves</p>
                            </div>
                            <div className="grid grid-cols-2 gap-10 items-center">
                                <div className="space-y-6 flex flex-col justify-center bg-transparent">
                                    {[
                                        { id: 'gemini', l: 'Clave API de Gemini', c: 'blue' },
                                        { id: 'groq', l: 'Clave API de Groq', c: 'orange' },
                                        { id: 'zai', l: 'Clave API de Z.AI', c: 'violet' },
                                    ].map(k => (
                                        <div key={k.id} className="space-y-2 relative flex-1">
                                            <label className={`text-[10px] font-black text-slate-500 uppercase ml-4 tracking-[0.4em]`}>{k.l}</label>
                                            <input
                                                type="password"
                                                value={(config.apiKeys as any)[k.id]}
                                                onChange={(e) => setConfig({ ...config, apiKeys: { ...config.apiKeys, [k.id]: e.target.value } })}
                                                placeholder="Pega la clave que obtuviste aquí..."
                                                className={`w-full bg-slate-950/60 border border-transparent hover:border-${k.c}-500/30 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-${k.c}-500/60 transition-all font-mono shadow-inner placeholder-slate-800`}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="flex flex-col justify-center space-y-6">
                                    <div className="bg-slate-950/60 p-6 rounded-3xl space-y-4 shadow-inner relative overflow-hidden group border border-transparent hover:border-emerald-500/20 transition-all">
                                        <div className="flex justify-between items-center px-2">
                                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">URL de Ollama</span>
                                            <div className={`w-2.5 h-2.5 rounded-full ${healthStatus ? (healthStatus.ollama.online ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]') : 'bg-amber-500 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.8)]'}`} title={healthStatus ? (healthStatus.ollama.online ? 'Ollama Conectado' : 'Ollama Offline') : 'Verificando Ping...'} />
                                        </div>
                                        <input 
                                            title="URL de la API de Ollama"
                                            placeholder="http://localhost:11434"
                                            value={config.ollamaUrl} 
                                            onChange={(e) => setConfig({ ...config, ollamaUrl: e.target.value })} 
                                            className="w-full bg-black/40 border border-transparent hover:border-emerald-500/30 rounded-xl px-5 py-3.5 text-sm text-emerald-500 font-mono outline-none shadow-inner transition-all focus:border-emerald-500/50" 
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className={`px-5 py-4 rounded-3xl flex items-center justify-between gap-3 transition-all border border-transparent ${healthStatus?.searxena.online ? 'bg-emerald-600/10 text-emerald-400 border-emerald-500/30 shadow-lg' : 'bg-slate-950/40 text-slate-600 hover:border-slate-500/10'}`}>
                                            <div className="flex gap-2 items-center">
                                                <Icon name="search" className="text-sm" /> <span className="text-[10px] font-black uppercase tracking-widest">SearXena</span>
                                            </div>
                                            <div className={`w-2 h-2 rounded-full shrink-0 ${healthStatus ? (healthStatus.searxena.online ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]') : 'bg-amber-500 animate-pulse'}`} title={healthStatus ? (healthStatus.searxena.online ? 'SearXena Conectado' : 'SearXena Offline') : 'Verificando Ping...'} />
                                        </div>
                                        <div className={`px-5 py-4 rounded-3xl flex flex-col justify-center gap-3 transition-all border border-transparent ${config.voskModelPath ? (healthStatus?.vosk.online ? 'bg-blue-600/10 text-blue-400 border-blue-500/30 shadow-lg' : 'bg-blue-900/10 text-blue-500/80 hover:border-blue-500/10 border-blue-500/10 shadow-inner') : 'bg-slate-950/40 text-slate-600 hover:border-slate-500/10'}`}>
                                            <div className="flex justify-between items-center px-1">
                                                <div className="flex gap-2 items-center">
                                                    <Icon name="microphone" className="text-sm" /> <span className="text-[10px] font-black uppercase tracking-widest">Vosk Audio</span>
                                                </div>
                                                {config.voskModelPath && healthStatus?.vosk.online && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]" />}
                                            </div>
                                            <div className="relative">
                                                <button 
                                                    onClick={() => setActiveMenu(activeMenu === 'vosk' ? null : 'vosk')}
                                                    className="w-full bg-black/40 border border-transparent hover:border-blue-500/30 rounded-xl px-3 py-2 text-[10px] text-white outline-none transition-all font-bold flex items-center justify-between shadow-inner"
                                                >
                                                    <span className="flex-grow text-center">{config.voskModelPath ? (config.voskModelPath.includes('es') ? 'Activado (ES)' : 'Activado (EN)') : 'Desactivado'}</span>
                                                    <Icon name={activeMenu === 'vosk' ? 'chevron-up' : 'chevron-down'} className="text-slate-600 text-[8px] ml-1" />
                                                </button>
                                                {activeMenu === 'vosk' && (
                                                    <>
                                                        <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
                                                        <div className="absolute left-0 right-0 bottom-full mb-1 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-20 py-1 animate-premium">
                                                            {[
                                                                { v: '', t: 'Desactivado' },
                                                                { v: 'vosk-model-small-es-0.42', t: 'Activado (ES)' },
                                                                { v: 'vosk-model-small-en-us-0.15', t: 'Activado (EN)' }
                                                            ].map(opt => (
                                                                <div 
                                                                    key={opt.v} 
                                                                    onClick={() => { setConfig({ ...config, voskModelPath: opt.v }); setActiveMenu(null); }} 
                                                                    className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest cursor-pointer transition-all ${config.voskModelPath === opt.v ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                                                                >
                                                                    {opt.t}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 9 && (
                        <div className="w-full max-w-6xl space-y-6 animate-premium h-full flex flex-col justify-center py-4">
                            <div className="text-center">
                                <h1 className="text-2xl font-black text-white uppercase tracking-widest mb-0.5">TELEGRAM (Opcional)</h1>
                                <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.4em] opacity-40 text-center">Control remoto desde cualquier lugar.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-8 items-center">
                                <div className="space-y-4 bg-slate-950/40 p-6 lg:p-8 rounded-[2.5rem] shadow-inner relative overflow-hidden group border border-transparent hover:border-cyan-500/20 transition-all h-full flex flex-col justify-center">
                                    <div className="flex items-center gap-3 text-cyan-400 mb-3">
                                        <Icon name="paper-plane" className="text-3xl drop-shadow-[0_0_15px_rgba(34,211,238,0.2)]" />
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-black uppercase tracking-[0.3em]">¿Cómo conectarlo?</span>
                                        </div>
                                    </div>
                                    <div className="space-y-3 lg:space-y-4 relative z-10 flex-grow">
                                        {[
                                            { d: 'Busca "@BotFather" en Telegram, envía /newbot y dale un nombre.' },
                                            { d: 'Copia el Token API que te dará y pégalo en el campo superior.' },
                                            { d: 'Busca "@userinfobot", presiona Iniciar y copia tu ID numérico.' },
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
                                        <label className="text-[10px] font-black text-slate-500 uppercase ml-6 tracking-[0.4em]">Token del Bot (BotFather)</label>
                                        <input type="password" value={telegramBotToken} onChange={(e)=>setTelegramBotToken(e.target.value)} placeholder="Ej: 123456789:ABC..." className="w-full bg-slate-950/60 border-2 border-transparent hover:border-cyan-500/30 rounded-2xl px-6 py-4 text-sm text-white outline-none font-mono focus:border-cyan-500/50 shadow-inner placeholder-slate-800 transition-all" />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase ml-6 tracking-[0.4em]">ID de Usuario (UserInfoBot)</label>
                                        <input type="text" value={telegramChatId} onChange={(e)=>setTelegramChatId(e.target.value)} placeholder="Ej: 98765432..." className="w-full bg-slate-950/60 border-2 border-transparent hover:border-blue-500/30 rounded-2xl px-6 py-4 text-sm text-white outline-none font-mono focus:border-blue-500/50 shadow-inner placeholder-slate-800 transition-all" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="h-16 md:h-20 shrink-0 border-t border-white/5 bg-slate-950/40 backdrop-blur-3xl flex justify-between items-center px-6 md:px-10 relative z-20">
                    <div className="flex gap-1.5 md:gap-2.5 items-center">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
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
                                Atrás
                            </button>
                        )}
                        <button
                            onClick={step < 9 ? () => setStep(step + 1) : finish}
                            disabled={loading || (step === 3 && !userName)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 md:px-10 py-2 md:py-2.5 rounded-xl md:rounded-2xl font-black text-[9px] md:text-[11px] uppercase tracking-[0.2em] md:tracking-[0.3em] shadow-2xl active:scale-95 transition-all disabled:opacity-20 flex items-center gap-2 md:gap-3 group/btn whitespace-nowrap shrink-0"
                        >
                            {loading ? <Icon name="spinner" className="animate-spin text-xs" /> : (
                                <>
                                    {step < 9 ? 'Continuar' : 'Inicializar'}
                                    <Icon name={step < 9 ? 'chevron-right' : 'check'} className="text-[10px] md:text-[11px] group-hover/btn:translate-x-1.5 transition-transform" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
