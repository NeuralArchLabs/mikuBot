import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageBlock } from '../../types';
import { Icon as IconComp } from './Common';

/** Core built-in tools — anything NOT in this set is a Neural Skill */
export const CORE_TOOLS = new Set([
    'read_file', 'update_file', 'patch_file', 'delete_file',
    'list_files', 'search_files', 'get_system_metrics',
    'web_search',
    'run_console', 'read_url', 'add_scheduled_task',
    'send_telegram_message', 'batch_operation', 'get_file_outline',
    'request_agent_mode'
]);

interface ToolBlockProps {
    block: MessageBlock;
    isOld?: boolean;
    invertRotation?: boolean;
}

const AtomLoader = ({ className, invertRotation }: { className?: string, invertRotation?: boolean }) => (
    <svg 
        viewBox="0 0 24 24" 
        className={`${className} atom-loader-svg`} 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1.5"
    >
        <defs>
            <path id="orbit1" d="M 22 12 A 10 4 0 1 1 2 12 A 10 4 0 1 1 22 12" />
            <path id="orbit2" d="M 2 12 A 10 4 0 1 1 22 12 A 10 4 0 1 1 2 12" />
        </defs>

        {/* Nucleus with glow */}
        <circle cx="12" cy="12" r="2.5" fill="currentColor" className="animate-atom-nucleus" />
        
        {/* Orbit 1 - Clockwise Track, Path Traversal */}
        <g className={`animate-atom-orbit-${invertRotation ? 'ccw' : 'cw'} text-blue-400/30 atom-orbit-group`}>
            <g transform="rotate(45 12 12)">
                <ellipse cx="12" cy="12" rx="10" ry="4" stroke="currentColor" strokeWidth="0.5" />
                <circle r="1.5" fill="currentColor" className="text-blue-400 drop-shadow-[0_0_3px_currentColor]">
                    <animateMotion dur="1s" repeatCount="indefinite">
                        <mpath href="#orbit1" />
                    </animateMotion>
                    <animate attributeName="r" values="1.5;0.7;1.5" dur="2s" repeatCount="indefinite" />
                </circle>
            </g>
        </g>
        
        {/* Orbit 2 - Counter-Clockwise Track, Path Traversal */}
        <g className={`animate-atom-orbit-${invertRotation ? 'cw' : 'ccw'} text-purple-400/30 atom-orbit-group`}>
            <g transform="rotate(-45 12 12)">
                <ellipse cx="12" cy="12" rx="10" ry="4" stroke="currentColor" strokeWidth="0.5" />
                <circle r="1.5" fill="currentColor" className="text-purple-400 drop-shadow-[0_0_3px_currentColor]">
                    <animateMotion dur="0.8s" repeatCount="indefinite">
                        <mpath href="#orbit2" />
                    </animateMotion>
                    <animate attributeName="r" values="0.7;1.5;0.7" dur="1.5s" repeatCount="indefinite" />
                </circle>
            </g>
        </g>
    </svg>
);

/** Neural Atom — 3 fixed orbits, 3 moving electrons, neon blue nucleus & electrons */
const NeuralAtomLoader = ({ className }: { className?: string }) => (
    <svg
        viewBox="0 0 24 24"
        className={`${className} atom-loader-svg neural-atom-svg`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
    >
        <defs>
            <path id="neural-orbit1" d="M 22 12 A 10 4 0 1 1 2 12 A 10 4 0 1 1 22 12" />
            <path id="neural-orbit2" d="M 22 12 A 10 4 0 1 0 2 12 A 10 4 0 1 0 22 12" />
            <path id="neural-orbit3" d="M 22 12 A 10 4 0 1 1 2 12 A 10 4 0 1 1 22 12" />
        </defs>

        {/* Nucleus — neon blue pulse */}
        <circle cx="12" cy="12" r="2.5" fill="currentColor" className="animate-neural-nucleus text-blue-400" />

        {/* Orbit 1 — 0° (horizontal), fixed */}
        <g className="neural-orbit-fixed">
            <g transform="rotate(0 12 12)">
                <ellipse cx="12" cy="12" rx="10" ry="4" stroke="currentColor" strokeWidth="0.5" className="text-blue-400/20" />
                <circle r="1.5" fill="currentColor" className="text-blue-400 drop-shadow-[0_0_4px_currentColor]">
                    <animateMotion dur="1.2s" repeatCount="indefinite">
                        <mpath href="#neural-orbit1" />
                    </animateMotion>
                    <animate attributeName="r" values="1.5;0.8;1.5" dur="2s" repeatCount="indefinite" />
                </circle>
            </g>
        </g>

        {/* Orbit 2 — 60°, fixed */}
        <g className="neural-orbit-fixed">
            <g transform="rotate(60 12 12)">
                <ellipse cx="12" cy="12" rx="10" ry="4" stroke="currentColor" strokeWidth="0.5" className="text-blue-400/20" />
                <circle r="1.5" fill="currentColor" className="text-blue-400 drop-shadow-[0_0_4px_currentColor]">
                    <animateMotion dur="0.9s" repeatCount="indefinite">
                        <mpath href="#neural-orbit2" />
                    </animateMotion>
                    <animate attributeName="r" values="0.8;1.5;0.8" dur="1.5s" repeatCount="indefinite" />
                </circle>
            </g>
        </g>

        {/* Orbit 3 — -60°, fixed */}
        <g className="neural-orbit-fixed">
            <g transform="rotate(-60 12 12)">
                <ellipse cx="12" cy="12" rx="10" ry="4" stroke="currentColor" strokeWidth="0.5" className="text-blue-400/20" />
                <circle r="1.5" fill="currentColor" className="text-blue-400 drop-shadow-[0_0_4px_currentColor]">
                    <animateMotion dur="1.5s" repeatCount="indefinite">
                        <mpath href="#neural-orbit3" />
                    </animateMotion>
                    <animate attributeName="r" values="1.2;0.7;1.2" dur="1.8s" repeatCount="indefinite" />
                </circle>
            </g>
        </g>
    </svg>
);

export const ToolBlock: React.FC<ToolBlockProps & { isStreaming?: boolean }> = ({ block, isOld, isStreaming, invertRotation }) => {
    const { t, i18n } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(false);
    const { toolCall, result } = block;

    const [isReplaying, setIsReplaying] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const hasReplayedRef = useRef(false);
    const wasVisibleDuringLiveRef = useRef(false);
    const [isVisible, setIsVisible] = useState(false);
    
    // 🎭 ENTRANCE GUARD: Track if this tool block was born during an active stream
    const isNewRef = useRef(!result);

    // 🎯 VISIBILITY SENSOR: Tracks presence for live witnessed executions and final replays
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new IntersectionObserver(([entry]) => {
            setIsVisible(entry.isIntersecting);
            // If it enters the viewport while still pending or streaming, we mark it as "witnessed"
            if (entry.isIntersecting && (!result || isStreaming)) {
                wasVisibleDuringLiveRef.current = true;
            }
        }, { threshold: 0.1 });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [result, isStreaming]);

    // ✨ LIVE COMPLETION LANDING: Only trigger pulse/glow when it actually finishes live
    // This is now unblocked from isStreaming to provide immediate feedback
    useEffect(() => {
        if ((!result && block.status !== 'denied') || hasReplayedRef.current) return;

        if (isVisible || wasVisibleDuringLiveRef.current) {
            hasReplayedRef.current = true;
            setIsReplaying(true);
            setTimeout(() => setIsReplaying(false), 800);
        } else {
            // If it finished off-screen, just mark as played without the fanfare
            hasReplayedRef.current = true;
        }
    }, [result, block.status, isVisible]);

    // Auto-collapse old tools
    useEffect(() => {
        if (isOld) {
            setIsExpanded(false);
        }
    }, [isOld]);

    // Captured timestamps for the 'Execution Log'
    const [startTime] = useState(() => new Date().toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    const [endTime, setEndTime] = useState<string | null>(null);

    useEffect(() => {
        if (result && !endTime) {
            setEndTime(new Date().toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
        }
    }, [result, endTime, i18n.language]);

    if (!toolCall) return null;

    // 🧠 Neural Skill Detection — dynamic tools not in the core set
    const isNeuralSkill = !CORE_TOOLS.has(toolCall.function.name);

    const isSuccess = result?.success && 
                      result?.data?.success !== false && 
                      (result?.data?.exitCode === undefined || result?.data?.exitCode === 0);
    
    const hasError = !!(result?.error || 
                       result?.data?.success === false || 
                       (result?.data?.exitCode !== undefined && result?.data?.exitCode !== 0) ||
                       (result?.data?.stderr && !result?.data?.stdout && result?.data?.exitCode !== 0));
    const isDenied = block.status === 'denied';
    const isPending = !result && isStreaming && !isDenied;
    const isAborted = !result && !isStreaming && !isOld && !isDenied;
    
    // 🚧 PLACEHOLDER LOGIC: Gear ONLY shows while the tool is pending (execution in progress)
    const isPlaceholder = isPending;
    
    // ✨ SHOW RESULT LANDING: True when we have a result and we want to show the 'transformation'
    const showTransformation = (!!result || isDenied) && isReplaying;

    // ✨ ENTRANCE ANIMATION: Smooth entry for live blocks only
    const entranceClass = (isNewRef.current && (isStreaming || isPending)) ? 'animate-in fade-in zoom-in slide-in-from-top-2 duration-700' : '';

    const getSourceLabel = (src?: string) => {
        if (!src) return t('settings.pathways.workspace');
        const s = src.toLowerCase();
        if (s === 'workspace') return t('settings.pathways.workspace');
        if (s === 'core') return t('settings.pathways.core');
        if (s === 'extra' || s === 'library') return t('settings.pathways.library');
        if (s === 'tools' || s === 'commands') return t('settings.pathways.commands');
        return src;
    };

    const getFriendlySummary = () => {
        if (isDenied) return t('common.denied_execution');
        if (isAborted) return t('common.aborted_execution');
        if (!result || isReplaying) return t('common.processing');
        const data = result.data || {};
        const args = toolCall.function.arguments || {};
        const name = toolCall.function.name;

        if (hasError) {
            return `${t('common.error')}: ${result.error || data.error || data.stderr || t('common.operation_failed')}`;
        }

        switch (name) {
            case 'get_system_metrics':
                return t('tools.metrics_summary', { platform: data.platform || 'OS', cpu: data.cpu || '?', ram: data.ram || '?' });
            case 'web_search':
                return t('tools.web_search_summary', { query: args.query });
            case 'web_research':
                return t('tools.web_research_summary', { 
                    query: args.query, 
                    count: data.extracted_sources?.length || 0,
                    categories: (args.categories || ['general']).join(', ')
                });
            case 'deep_research':
                return t('tools.deep_research_summary', { 
                    topic: args.topic, 
                    count: data.report?.stats?.validated || 0,
                    categories: (args.categories || ['general']).join(', ')
                });
            case 'list_files':
                return t('tools.list_files_summary', { source: getSourceLabel(args.source), count: data.files?.length || 0 });
            case 'read_file':
                return t('tools.read_file_summary', { filename: args.filename });
            case 'update_file':
                return typeof result.data === 'string' ? result.data : t('tools.update_file_summary', { filename: args.filename });
            case 'patch_file':
                return t('tools.patch_file_summary', { filename: args.filename });
            case 'search_files':
                return t('tools.search_files_summary', { query: args.query });
            case 'run_console':
                return t('tools.run_console_summary', { command: `${args.command}${args.args ? ' ' + args.args : ''}` });
            case 'read_url':
                return t('tools.read_url_summary', { url: args.url });
            case 'delete_file':
                return t('tools.delete_file_summary', { filename: args.filename });
            case 'add_scheduled_task':
                return t('tools.add_task_summary', { name: args.name, schedule: args.schedule });
            case 'send_telegram_message':
                return t('tools.telegram_summary');
            case 'batch_operation':
                return t('tools.batch_summary', { operation: args.operation, source_path: getSourceLabel(args.source_path) });
            case 'get_file_outline':
                return t('tools.outline_summary', { filename: args.filename });
            default:
                return typeof result.data === 'string' ? result.data : result.data?.message || t('tools.default_summary', { name });
        }
    };

    const friendlySummary = getFriendlySummary();
    const fullResultText = result
        ? (typeof result.data === 'string' ? result.data : result.data?.message || JSON.stringify(result.data || result.error, null, 2))
        : '';

    // Truncated version for the big display (using friendly summary)
    const truncatedText = friendlySummary.length > 80
        ? friendlySummary.substring(0, 80) + '...'
        : friendlySummary;

    return (
        <div ref={containerRef} className={`relative mb-4 pl-6 transition-all duration-300 ${entranceClass} ${isExpanded ? 'w-full' : 'w-full max-w-3xl'}`}>
            <div className={`tool-block overflow-hidden transition-all duration-300 rounded-xl bg-slate-950/50 backdrop-blur-md shadow-[inset_0_4px_12px_rgba(0,0,0,0.4),0_8px_30px_rgba(0,0,0,0.5)] border-t-[1.5px] border-l-[1.5px] border-white/10 border-b border-r border-b-black/20 border-r-black/20 ${isExpanded ? 'bg-slate-950/80' : 'hover:bg-slate-950/60'} ring-1 ${isNeuralSkill ? 'ring-blue-500/20' : 'ring-white/5'}`}>
                {/* Consolidated Header / Summary Strip */}
                <div
                    className={`tool-block-header flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors hover:bg-white/[0.02] ${isExpanded ? 'bg-slate-800/20 border-b border-white/5' : ''}`}
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className={`relative w-4 h-4 flex items-center justify-center rounded-full transition-all duration-700 ${showTransformation ? 'tool-completion-glow' : ''}`}>
                            {/* Loading Atom (Fades out when result arrives) */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) ${!isPlaceholder ? 'opacity-0 scale-0 rotate-180' : 'opacity-100 scale-100 tool-icon-pending'}`}>
                                {isNeuralSkill
                                    ? <NeuralAtomLoader className="w-5 h-5 flex-shrink-0 text-blue-400" />
                                    : <AtomLoader className="w-5 h-5 flex-shrink-0 text-amber-500" invertRotation={invertRotation} />
                                }
                            </div>
                            
                            {/* Result Icon (Morphs in when result arrives) */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) ${isPlaceholder ? 'opacity-0 scale-0 -rotate-180' : ((isSuccess && !isAborted && !isDenied) ? (isNeuralSkill ? 'tool-icon-neural-success animate-neural-strobe' : 'tool-icon-success') : (hasError || isAborted || isDenied) ? 'tool-icon-error' : 'tool-icon-pending')}`}>
                                <IconComp
                                    name={(isSuccess && !isAborted && !isDenied) ? 'check-circle' : isDenied ? 'ban' : isAborted ? 'stop-circle' : hasError ? 'exclamation-triangle' : 'cog'}
                                    className={`icon-center-rig fa-fw ${showTransformation ? (isNeuralSkill ? '' : 'animate-tool-pulse') : ''} ${!isPlaceholder && !isOld ? 'animate-tool-morph' : ''} ${isAborted ? 'text-orange-500/50' : isDenied ? 'text-rose-500/50' : ''}`} 
                                />
                            </div>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-tighter ${isNeuralSkill ? 'text-blue-400' : 'text-slate-400'}`}>
                            {toolCall.function.name}
                        </span>
                        {(isSuccess && !isPlaceholder) && <span className={`text-[9px] font-mono font-bold ml-1 hidden sm:inline ${isNeuralSkill ? 'text-cyan-400/50' : 'text-emerald-500/50'}`}>{t('common.ready')}</span>}
                    </div>

                    {!isExpanded && (
                        <>
                            <div className="w-px h-3 bg-white/10 flex-shrink-0" />
                            <span className={`tool-block-summary text-[11px] truncate flex-1 font-mono tracking-tight ${isPlaceholder ? (isNeuralSkill ? 'text-blue-400 italic animate-pulse' : 'text-slate-400 italic animate-pulse') : (isAborted || isDenied) ? 'text-orange-400 italic' : (isSuccess ? (isNeuralSkill ? 'text-cyan-400' : 'text-emerald-400') : hasError ? 'text-rose-400 font-bold' : 'text-slate-400 italic')}`}>
                                {truncatedText}
                            </span>
                        </>
                    )}

                    <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''} text-slate-600 flex-shrink-0 ml-auto flex items-center justify-center w-5 h-5`}>
                        <IconComp name="chevron-down" className="text-[10px]" />
                    </div>
                </div>

                {/* Inline Summary for Expanded State */}
                {isExpanded && (
                    <div className={`tool-block-summary px-4 py-3 bg-slate-800/10 border-b border-white/5 font-medium ${isSuccess ? (isNeuralSkill ? 'text-cyan-400' : 'text-emerald-400') : hasError ? 'text-rose-400' : 'text-slate-500 italic'} text-[12px] sm:text-[13px] leading-relaxed`}>
                         <IconComp name="info-circle" className="mr-2 opacity-50" />
                         {friendlySummary}
                    </div>
                )}

                {/* Details Area: Typing JSON and Args */}
                {isExpanded && (
                    <div className="tool-block-content bg-slate-900/20 p-3 pt-4 space-y-4 animate-in fade-in duration-500">
                        <div className="space-y-2">
                            <div className="text-[9px] text-slate-600 uppercase tracking-widest font-bold flex items-center gap-1">
                                <IconComp name="stream" /> {t('common.execution_log')}
                            </div>
                            <div className="tool-block-id text-[10px] text-[var(--text-secondary)] font-mono leading-relaxed bg-black/20 p-2 rounded-lg border border-white/5">
                                <span className="opacity-60">{t('common.status')}:</span> <span className={isSuccess ? (isNeuralSkill ? 'text-cyan-400' : 'text-emerald-400') : hasError ? 'text-rose-400' : ''}>{isSuccess ? t('common.status_success') : hasError ? t('common.status_error') : t('common.status_pending')}</span><br />
                                <span className="opacity-60">{t('common.executed')}:</span> {endTime || startTime}<br />
                                <span className="opacity-60">ID:</span> {toolCall.id}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="text-[9px] text-slate-600 uppercase tracking-widest font-bold flex items-center gap-1">
                                <IconComp name="code" /> {t('common.arguments')}
                            </div>
                            <pre className="custom-scrollbar overflow-y-auto max-h-32 p-3 bg-black/20 rounded-lg text-[10px] whitespace-pre-wrap break-all text-[var(--text-primary)] opacity-80 border border-white/5 font-mono">
                                {JSON.stringify(toolCall.function.arguments, null, 2)}
                            </pre>
                        </div>

                        {result && (
                            <div className="space-y-2">
                                <div className={`text-[9px] uppercase tracking-widest font-bold flex items-center justify-between gap-1 ${isSuccess ? (isNeuralSkill ? 'text-cyan-600' : 'text-emerald-600') : 'text-rose-600'}`}>
                                    <div className="flex items-center gap-1">
                                        <IconComp name={isSuccess ? 'check-double' : 'exclamation-triangle'} /> {t('common.detailed_response')}
                                    </div>
                                    {isSuccess && result.data?.engine === 'searXena' && (
                                        <div className="text-[8px] font-black text-slate-600 bg-slate-800/20 px-2 py-0.5 rounded border border-slate-800 tracking-[0.2em] animate-in fade-in slide-in-from-right-2 duration-700">
                                            POWERED BY <span className="text-blue-500/60">searXena</span>
                                        </div>
                                    )}
                                </div>
                                <pre className={`custom-scrollbar overflow-y-auto max-h-60 p-3 bg-black/20 rounded-lg text-[10px] whitespace-pre-wrap break-all border transition-colors duration-500 font-mono ${isSuccess ? (isNeuralSkill ? 'text-cyan-400 border-cyan-500/20' : 'text-emerald-400 border-emerald-500/20') : 'text-rose-400 border-rose-500/20'}`}>
                                    {JSON.stringify(result.data || result.error, null, 2)}
                                    {!isSuccess && hasError && <span className="block mt-2 text-rose-400 italic font-sans">{t('common.system_exception')}</span>}
                                </pre>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
