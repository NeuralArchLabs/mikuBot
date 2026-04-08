import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageBlock } from '../../types';
import { Icon as IconComp } from './Common';

interface ToolBlockProps {
    block: MessageBlock;
    isOld?: boolean;
}

const AtomLoader = ({ className }: { className?: string }) => (
    <svg 
        viewBox="0 0 24 24" 
        className={`${className} atom-loader-svg`} 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1.5"
    >
        {/* Nucleus with glow */}
        <circle cx="12" cy="12" r="2.5" fill="currentColor" className="animate-atom-nucleus" />
        
        {/* Orbit 1 - Clockwise */}
        <g className="animate-atom-orbit-cw text-blue-400/30 atom-orbit-group">
            <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(45 12 12)" stroke="currentColor" strokeWidth="0.5" />
            <circle cx="22" cy="12" r="1.5" fill="currentColor" className="text-blue-400" transform="rotate(45 12 12)">
                <animate attributeName="r" values="1.2;1.8;1.2" dur="2s" repeatCount="indefinite" />
            </circle>
        </g>
        
        {/* Orbit 2 - Counter-Clockwise */}
        <g className="animate-atom-orbit-ccw text-purple-400/30 atom-orbit-group">
            <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-45 12 12)" stroke="currentColor" strokeWidth="0.5" />
            <circle cx="2" cy="12" r="1.5" fill="currentColor" className="text-purple-400" transform="rotate(-45 12 12)">
                <animate attributeName="r" values="1.8;1.2;1.8" dur="1.5s" repeatCount="indefinite" />
            </circle>
        </g>
    </svg>
);

export const ToolBlock: React.FC<ToolBlockProps & { isStreaming?: boolean }> = ({ block, isOld, isStreaming }) => {
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
        if (!result || hasReplayedRef.current) return;

        if (isVisible || wasVisibleDuringLiveRef.current) {
            hasReplayedRef.current = true;
            setIsReplaying(true);
            setTimeout(() => setIsReplaying(false), 800);
        } else {
            // If it finished off-screen, just mark as played without the fanfare
            hasReplayedRef.current = true;
        }
    }, [result]);

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

    const isSuccess = result?.success && 
                      result?.data?.success !== false && 
                      (result?.data?.exitCode === undefined || result?.data?.exitCode === 0);
    
    const hasError = !!(result?.error || 
                       result?.data?.success === false || 
                       (result?.data?.exitCode !== undefined && result?.data?.exitCode !== 0) ||
                       (result?.data?.stderr && !result?.data?.stdout && result?.data?.exitCode !== 0));
    const isPending = !result;
    
    // 🚧 PLACEHOLDER LOGIC: Gear ONLY shows while the tool is pending (execution in progress)
    // We remove isStreaming so it transforms to "Ready" immediately upon result arrival
    const isPlaceholder = isPending;
    
    // ✨ SHOW RESULT LANDING: True when we have a result and we want to show the 'transformation'
    const showTransformation = !!result && isReplaying;

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
            <div className={`tool-block overflow-hidden transition-all duration-300 rounded-xl bg-black/60 shadow-[inset_0_4px_12px_rgba(0,0,0,0.4),0_8px_30px_rgba(0,0,0,0.5)] border-t-[3px] border-l-[3px] border-t-slate-900/50 border-l-slate-900/50 border-b border-r border-b-white/5 border-r-white/5 ${isExpanded ? 'bg-black/70' : 'hover:bg-black/50'} ring-1 ring-slate-900/50`}>
                {/* Consolidated Header / Summary Strip */}
                <div
                    className={`tool-block-header flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors hover:bg-white/[0.02] ${isExpanded ? 'bg-slate-800/40 border-b border-white/5' : ''}`}
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className={`relative w-4 h-4 flex items-center justify-center rounded-full transition-all duration-700 ${showTransformation ? 'tool-completion-glow' : ''}`}>
                            {/* Loading Atom (Fades out when result arrives) */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) ${!isPlaceholder ? 'opacity-0 scale-0 rotate-180' : 'opacity-100 scale-100 tool-icon-pending'}`}>
                                <AtomLoader className="w-full h-full" />
                            </div>
                            
                            {/* Result Icon (Morphs in when result arrives) */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) ${isPlaceholder ? 'opacity-0 scale-0 -rotate-180' : (isSuccess ? 'tool-icon-success' : hasError ? 'tool-icon-error' : 'tool-icon-pending')}`}>
                                <IconComp 
                                    name={isSuccess ? 'check-circle' : hasError ? 'exclamation-triangle' : 'cog'} 
                                    className={`icon-center-rig fa-fw ${showTransformation ? 'animate-tool-pulse' : ''} ${!isPlaceholder && !isOld ? 'animate-tool-morph' : ''}`} 
                                />
                            </div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                            {toolCall.function.name}
                        </span>
                        {(isSuccess && !isPlaceholder) && <span className="text-[9px] text-emerald-500/50 font-mono font-bold ml-1 hidden sm:inline">{t('common.ready')}</span>}
                    </div>

                    {!isExpanded && (
                        <>
                            <div className="w-px h-3 bg-white/10 flex-shrink-0" />
                            <span className={`text-[11px] truncate flex-1 font-mono tracking-tight ${isPlaceholder ? 'text-slate-500 italic animate-pulse' : (isSuccess ? 'text-emerald-400/80' : hasError ? 'text-rose-400/80' : 'text-slate-500 italic')}`}>
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
                    <div className={`px-4 py-3 bg-slate-800/10 border-b border-white/5 font-medium ${isSuccess ? 'text-emerald-400' : hasError ? 'text-rose-400' : 'text-slate-500 italic'} text-[12px] sm:text-[13px] leading-relaxed`}>
                         <IconComp name="info-circle" className="mr-2 opacity-50" />
                         {friendlySummary}
                    </div>
                )}

                {/* Details Area: Typing JSON and Args */}
                {isExpanded && (
                    <div className="tool-block-content bg-slate-900/40 p-3 pt-4 space-y-4 animate-in fade-in duration-500">
                        <div className="space-y-2">
                            <div className="text-[9px] text-slate-600 uppercase tracking-widest font-bold flex items-center gap-1">
                                <IconComp name="stream" /> {t('common.execution_log')}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono leading-relaxed bg-black/20 p-2 rounded-lg border border-white/5">
                                {t('common.status')}: {isSuccess ? t('common.status_success') : hasError ? t('common.status_error') : t('common.status_pending')}<br />
                                {t('common.executed')}: {endTime || startTime}<br />
                                ID: {toolCall.id}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="text-[9px] text-slate-600 uppercase tracking-widest font-bold flex items-center gap-1">
                                <IconComp name="code" /> {t('common.arguments')}
                            </div>
                            <pre className="custom-scrollbar overflow-y-auto max-h-32 p-3 bg-black/40 rounded-lg text-[10px] whitespace-pre-wrap break-all text-indigo-300/60 border border-white/5">
                                {JSON.stringify(toolCall.function.arguments, null, 2)}
                            </pre>
                        </div>

                        {result && (
                            <div className="space-y-2">
                                <div className={`text-[9px] uppercase tracking-widest font-bold flex items-center justify-between gap-1 ${isSuccess ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    <div className="flex items-center gap-1">
                                        <IconComp name={isSuccess ? 'check-double' : 'exclamation-triangle'} /> {t('common.detailed_response')}
                                    </div>
                                    {isSuccess && result.data?.engine === 'searXena' && (
                                        <div className="text-[8px] font-black text-slate-600 bg-slate-800/40 px-2 py-0.5 rounded border border-slate-800 tracking-[0.2em] animate-in fade-in slide-in-from-right-2 duration-700">
                                            POWERED BY <span className="text-blue-500/60">searXena</span>
                                        </div>
                                    )}
                                </div>
                                <pre className={`custom-scrollbar overflow-y-auto max-h-60 p-3 bg-black/40 rounded-lg text-[10px] whitespace-pre-wrap break-all border transition-colors duration-500 ${isSuccess ? 'text-emerald-400/70 border-emerald-500/10' : 'text-rose-400/70 border-rose-500/10'}`}>
                                    {JSON.stringify(result.data || result.error, null, 2)}
                                    {!isSuccess && hasError && <span className="block mt-2 text-rose-500/50 italic font-sans">{t('common.system_exception')}</span>}
                                </pre>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
