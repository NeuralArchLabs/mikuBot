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

export const AgentStatusPanel = React.memo(({
    status,
    onAbort,
    onReprompt,
}: AgentStatusPanelProps) => {
    const { t } = useTranslation();
    const logContainerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [status.log]);

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
        <div className="border-t border-slate-700 bg-slate-800/60 font-mono text-[11px]">
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

            <div ref={logContainerRef} className="max-h-32 overflow-y-auto custom-scrollbar p-2 space-y-1 bg-slate-900/40">
                {status.log.map((entry, i) => {
                    const isOptimization = entry.message.includes('optimizado para el llamado');

                    if (isOptimization) {
                        return (
                            <div key={i} className="optimization-badge">
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
                        );
                    }

                    return (
                        <div key={i} className="flex gap-2">
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

            {(status.streamedText || status.streamedReasoning) && (
                <div className="p-2 border-t border-slate-700/50 bg-slate-900/20 text-slate-400 italic">
                    {status.streamedReasoning && (
                        <div className="mb-1 text-cyan-500/80 border-l-2 border-cyan-500/20 pl-2 text-[10px]">
                            [{t('status.phases.thinking')}] {status.streamedReasoning}
                        </div>
                    )}
                    {status.streamedText && (
                        <div className="line-clamp-2">
                            {status.streamedText}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});
