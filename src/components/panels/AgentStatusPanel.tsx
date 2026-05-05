import React, { useEffect, useRef, useState } from 'react';
import { AgentStatus, AgentPhase } from '../../types';
import { useTranslation } from 'react-i18next';
import { Icon } from '../common/Common';

interface AgentStatusPanelProps {
    status: AgentStatus;
    onAbort: () => void;
    onReprompt: () => void;
}

/**
 * Formats milliseconds into a human-readable elapsed time string.
 * < 60s  →  "12s"
 * < 60m  →  "2m 34s"
 * >= 60m →  "1h 02m"
 */
function formatElapsed(ms: number): string {
    // Guard against invalid values (undefined, NaN, null, etc.)
    if (typeof ms !== 'number' || isNaN(ms) || ms < 0) {
        return '0s';
    }
    const totalSeconds = Math.floor(ms / 1000);
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes < 60) return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins.toString().padStart(2, '0')}m`;
}

// Lightweight basic markdown formatter for streaming text.
// Designed to be very fast and not heavy while avoiding raw tags like ** or `
const StreamedMarkdown = ({ text, className }: { text: string; className?: string }) => {
    const html = React.useMemo(() => {
        let escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        const lines = escaped.split('\n');
        let inCodeBlock = false;
        
        const processed = lines.map(line => {
            const t = line.trim();
            
            // Code block / Mermaid block toggle
            if (t.startsWith('```')) {
                if (!inCodeBlock) {
                    inCodeBlock = true;
                    // Simple "proto block" for code: light contrast, no marked lines, preserves whitespace
                    return `<div class="bg-black/10 border border-slate-700/20 rounded p-1.5 my-1 text-slate-400 font-mono text-[9px] overflow-x-auto whitespace-pre">`;
                } else {
                    inCodeBlock = false;
                    return `</div>`;
                }
            }
            
            if (inCodeBlock) {
                return line + '\n'; // Keep raw text inside code block
            }

            // Inline formatting (Solid colors, no flashy colors)
            let processedLine = line;
            processedLine = processedLine.replace(/\*\*\*(?!\s)(.+?)\*\*\*/g, '<strong class="font-bold text-slate-300"><em>$1</em></strong>');
            processedLine = processedLine.replace(/\*\*(?!\s)(.+?)\*\*/g, '<strong class="font-bold text-slate-300">$1</strong>');
            processedLine = processedLine.replace(/\*(?!\s)(.+?)\*/g, '<em class="italic text-slate-300">$1</em>');
            processedLine = processedLine.replace(/`(.*?)`/g, '<code class="bg-black/20 rounded px-1 text-slate-300 border border-white/5">$1</code>');

            const pt = processedLine.trim();

            // Headings
            if (pt.match(/^#{1,4}\s+(.*)/)) {
                const hMatch = pt.match(/^(#{1,4})\s+(.*)/);
                const level = hMatch![1].length;
                const cls = level === 1 ? 'text-[12px] font-bold text-slate-200 mt-2 mb-1' :
                            level === 2 ? 'text-[11px] font-bold text-slate-300 mt-2 mb-1' :
                            'text-[10px] font-semibold text-slate-300 mt-1 mb-0.5';
                return `<div class="${cls}">` + hMatch![2] + `</div>`;
            }

            // Quotes
            if (pt.startsWith('&gt;')) {
                return `<div class="border-l-2 border-slate-600 pl-2 my-1 text-slate-500 italic bg-black/10 py-0.5">` + pt.substring(4).trim() + `</div>`;
            }
            // Unordered Lists
            const ulMatch = pt.match(/^[-*]\s+(.*)/);
            if (ulMatch) {
                return `<div class="pl-2 flex gap-1.5 my-0.5"><span class="text-slate-600">•</span><span class="text-slate-400">` + ulMatch[1] + `</span></div>`;
            }
            // Ordered Lists
            const olMatch = pt.match(/^(\d+\.)\s+(.*)/);
            if (olMatch) {
                return `<div class="pl-1 flex gap-1.5 my-0.5"><span class="text-slate-500 font-bold">` + olMatch[1] + `</span><span class="text-slate-400">` + olMatch[2] + `</span></div>`;
            }
            // Basic Tables (Minimalist)
            if (pt.startsWith('|') && pt.endsWith('|')) {
                if (pt.match(/^\|(?:[\s-:]+\|)+$/)) return ``; // Ignore separator lines to keep it simple
                const cells = pt.split('|').slice(1, -1).map(c => `<span class="inline-block px-1.5 text-slate-400">${c.trim()}</span>`).join('<span class="text-slate-700/50">|</span>');
                return `<div class="text-[9px] bg-black/5 whitespace-nowrap overflow-hidden text-ellipsis my-[1px] font-mono">${cells}</div>`;
            }

            // Plain text lines
            return pt === '' ? '<div class="h-2"></div>' : `<div>${processedLine}</div>`;
        });

        // Close unclosed block
        if (inCodeBlock) {
            processed.push(`</div>`);
        }

        return processed.join('');
    }, [text]);

    return (
        <div 
            className={`text-slate-400 ${className || ''}`} 
            dangerouslySetInnerHTML={{ 
                __html: html + '<span class="inline-block w-[3px] h-[10px] ml-1 bg-slate-500 animate-pulse translate-y-[1px]"></span>' 
            }} 
        />
    );
};

export const AgentStatusPanel = React.memo(({
    status,
    onAbort,
    onReprompt,
}: AgentStatusPanelProps) => {
    const { t } = useTranslation();
    const logContainerRef = useRef<HTMLDivElement>(null);
    const streamContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [status.log]);

    // Auto-scroll streaming preview
    useEffect(() => {
        if (streamContainerRef.current) {
            streamContainerRef.current.scrollTop = streamContainerRef.current.scrollHeight;
        }
    }, [status.streamedText, status.streamedReasoning]);

    // Live timer — ticks every second while agent is active
    const [liveElapsed, setLiveElapsed] = useState(typeof status.elapsedMs === 'number' ? status.elapsedMs : 0);
    const isActive = !['idle', 'aborted', 'error'].includes(status.phase);

    useEffect(() => {
        // Sync with actual elapsed from status updates (guard against invalid values)
        if (typeof status.elapsedMs === 'number' && !isNaN(status.elapsedMs)) {
            setLiveElapsed(status.elapsedMs);
        }
    }, [status.elapsedMs]);

    useEffect(() => {
        if (!isActive) return;
        const interval = setInterval(() => {
            setLiveElapsed(prev => prev + 1000);
        }, 1000);
        return () => clearInterval(interval);
    }, [isActive]);

    const phaseColors: Record<AgentPhase, string> = {
        idle: 'text-slate-500',
        thinking: 'text-blue-400',
        streaming: 'text-cyan-400',
        tool_calling: 'text-amber-400',
        tool_executing: 'text-purple-400',
        waiting_approval: 'text-yellow-400',
        error: 'text-red-400',
        aborted: 'text-red-500',
    };
    const phaseLabels: Record<AgentPhase, string> = {
        idle: t('status.phases.idle'),
        thinking: t('status.phases.thinking'),
        streaming: t('status.phases.streaming'),
        tool_calling: t('status.phases.tool_calling'),
        tool_executing: t('status.phases.tool_executing'),
        waiting_approval: t('status.phases.waiting_approval'),
        error: t('status.phases.error'),
        aborted: t('status.phases.aborted'),
    };

    const canReprompt = ['idle', 'error', 'aborted'].includes(status.phase) && status.iteration > 0;

    return (
        <div className="bg-slate-800/60 font-mono text-[11px]">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700/50">
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-1.5 ${phaseColors[status.phase]}`}>
                        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                        <span className="font-semibold tracking-wider">{phaseLabels[status.phase]}</span>
                    </div>
                    {/* Step counter — always grows, purely informational */}
                    {status.iteration > 0 && (
                        <span className="text-slate-400">
                            {t('status.step', { count: status.iteration })}
                        </span>
                    )}
                    {/* Elapsed timer */}
                    {(isActive || (typeof status.elapsedMs === 'number' && status.elapsedMs > 0)) && (
                        <span className="text-slate-500 tabular-nums">
                            ⏱ {formatElapsed(isActive ? liveElapsed : (typeof status.elapsedMs === 'number' ? status.elapsedMs : 0))}
                        </span>
                    )}
                    {/* Current tool badge */}
                    {status.currentTool && (
                        <span className="text-purple-300 bg-purple-900/30 px-1.5 py-0.5 rounded">
                            🔧 {status.currentTool}
                        </span>
                    )}
                    {/* Retry indicator — only shown when retries > 0 */}
                    {status.retries > 0 && (
                        <span className={`px-1.5 py-0.5 rounded ${status.retries >= 7 ? 'text-red-400 bg-red-900/20' :
                            status.retries >= 3 ? 'text-amber-400 bg-amber-900/20' :
                                'text-yellow-400 bg-yellow-900/20'
                            }`}>
                            {t('status.retries', { count: status.retries, max: status.maxRetries })}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {canReprompt && (
                        <button
                            onClick={onReprompt}
                            className="flex items-center justify-center gap-1.5 px-2 h-5 bg-amber-700 hover:bg-amber-600 text-white rounded text-[10px] transition-colors font-bold uppercase tracking-wider leading-none"
                            title={t('status.actions.reprompt_title')}
                        >
                            <Icon name="history" className="text-[8px]" /> {t('status.actions.reprompt')}
                        </button>
                    )}
                    {isActive && (
                        <button
                            onClick={onAbort}
                            className="flex items-center justify-center gap-1.5 px-2 h-5 bg-red-700 hover:bg-red-600 text-white rounded text-[10px] transition-colors font-bold uppercase tracking-wider leading-none"
                        >
                            <Icon name="stop" className="text-[8px]" /> {t('status.actions.abort')}
                        </button>
                    )}
                </div>
            </div>

            {/* Diagnostic Debug Banner */}
            {status.debug && (
                <div className="px-3 py-1 bg-slate-900/60 border-b border-white/5 flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)] animate-pulse" />
                    <span className="text-[9px] text-blue-300/80 font-bold uppercase tracking-widest">{t('status.log_types.debug')}:</span>
                    <span className="text-[10px] text-slate-400 font-mono truncate">{status.debug}</span>
                </div>
            )}

            {status.log?.length > 0 && (
                <div ref={logContainerRef} className="max-h-32 overflow-y-auto custom-scrollbar px-3 bg-slate-900/40 border-t border-white/5">
                {status.log.map((entry, i) => {
                    const isOptimization = entry.message.includes('optimizado para el llamado');

                    if (isOptimization) {
                        return (
                            <div key={i} className="animate-in fade-in slide-in-from-top-2 duration-500 my-1">
                                <div className="optimization-badge">
                                    <div className="optimization-inner transform-gpu">
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full border border-white/10 flex items-center justify-center">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                        </div>
                                        <span className="optimization-text tracking-widest text-[9px] uppercase">
                                            {entry.message}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center text-[10px] mr-1">
                                            <span className="engine-arrow engine-arrow-1">&gt;</span>
                                            <span className="engine-arrow engine-arrow-2">&gt;</span>
                                            <span className="engine-arrow engine-arrow-3">&gt;</span>
                                        </div>
                                        <div className="engine-label uppercase tracking-widest">{t('status.log_types.enhanced_engine')}</div>
                                    </div>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={i} className="flex gap-2 py-1 first:pt-2 last:pb-2">
                            <span className="text-slate-600 shrink-0">[{new Date(entry.timestamp).toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                            <span className={`shrink-0 font-bold uppercase ${entry.type === 'error' ? 'text-red-500' :
                                entry.type === 'tool_call' ? 'text-amber-500' :
                                    entry.type === 'tool_result' ? 'text-emerald-500' :
                                        entry.type === 'warn' ? 'text-yellow-500' :
                                            'text-slate-400'
                                }`}>
                                {t(`status.log_types.${entry.type}`)}:
                            </span>
                            <span className="text-slate-300 break-all">{entry.message}</span>
                        </div>
                    );
                })}
                </div>
            )}

            {(status.streamedText || status.streamedReasoning) && (
                <div className="border-t border-slate-700/50">
                    <div ref={streamContainerRef} className="max-h-60 overflow-y-auto custom-scrollbar p-2 bg-slate-900/20 text-slate-400 italic">
                        {status.streamedReasoning && (
                            <div className="mb-1 text-cyan-500/80 border-l-2 border-cyan-500/20 pl-2 text-[10px] animate-in fade-in slide-in-from-left-2 duration-500">
                                [{t('status.phases.thinking')}] <StreamedMarkdown text={status.streamedReasoning} className="inline" />
                            </div>
                        )}
                        {status.streamedText && (
                            <StreamedMarkdown text={status.streamedText} className="whitespace-pre-wrap break-words" />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});
