import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Common';

interface ToolLoopCollapsibleProps {
    /** Number of tool_call blocks in this loop segment */
    stepCount: number;
    /** Whether the parent message is still streaming */
    isStreaming?: boolean;
    /** Whether this message is old (scrolled out of recent view) */
    isOld?: boolean;
    /** Total duration already elapsed (for history messages) */
    elapsedMs?: number;
    /** The rendered tool blocks and interstitial thoughts (children) */
    children: React.ReactNode;
}

/**
 * ToolLoopCollapsible
 * 
 * Wraps a sequence of tool execution blocks and auto-collapses them when 
 * the message finishes streaming. Shows an elegant inline summary with
 * step count and elapsed time. Expanding reveals the full execution view.
 */
export const ToolLoopCollapsible: React.FC<ToolLoopCollapsibleProps> = ({
    stepCount,
    isStreaming,
    isOld,
    elapsedMs: initialElapsedMs,
    children
}) => {
    const { t } = useTranslation();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const hasUserInteractedRef = useRef(false);
    const loopStartTimeRef = useRef<number>(Date.now());
    const [elapsedMs, setElapsedMs] = useState<number>(initialElapsedMs || 0);
    const wasStreamingRef = useRef(isStreaming);

    // Sync elapsedMs if initialElapsedMs changes and we're not streaming
    useEffect(() => {
        if (!isStreaming && initialElapsedMs !== undefined) {
            setElapsedMs(initialElapsedMs);
        }
    }, [initialElapsedMs, isStreaming]);

    // Track elapsed time while streaming
    useEffect(() => {
        if (isStreaming) {
            // Reset start time when streaming starts/resumes
            loopStartTimeRef.current = Date.now() - (elapsedMs || 0);
            
            const interval = setInterval(() => {
                setElapsedMs(Date.now() - loopStartTimeRef.current);
            }, 250);
            return () => clearInterval(interval);
        }
    }, [isStreaming]);

    // Auto-collapse when streaming ends (the "loop finishes")
    useEffect(() => {
        if (wasStreamingRef.current && !isStreaming && !hasUserInteractedRef.current) {
            // Capture final elapsed time
            setElapsedMs(Date.now() - loopStartTimeRef.current);
            // Small delay so the user sees the last tool complete before collapsing
            const timer = setTimeout(() => {
                if (!hasUserInteractedRef.current) {
                    setIsCollapsed(true);
                }
            }, 600);
            return () => clearTimeout(timer);
        }
        wasStreamingRef.current = isStreaming;
    }, [isStreaming]);

    // Old messages start collapsed
    useEffect(() => {
        if (isOld && !hasUserInteractedRef.current) {
            setIsCollapsed(true);
        }
    }, [isOld]);

    const handleToggle = () => {
        hasUserInteractedRef.current = true;
        setIsCollapsed(!isCollapsed);
    };

    const formatDuration = (ms: number): string => {
        if (ms < 1000) return `${ms}ms`;
        const seconds = ms / 1000;
        if (seconds < 60) return `${seconds.toFixed(1)}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = (seconds % 60).toFixed(0);
        return `${minutes}m ${remainingSeconds}s`;
    };

    const stepsLabel = t('chat.labels.steps_executed', { 
        count: stepCount, 
        defaultValue: `${stepCount} ${stepCount === 1 ? 'acción' : 'acciones'}` 
    });

    if (isCollapsed) {
        return (
            <div className="mb-4">
                <button
                    onClick={handleToggle}
                    className="group/loop w-full text-left focus:outline-none"
                >
                    <div className="flex items-center gap-3 py-2.5 px-1 transition-all duration-300">
                        {/* Left accent line */}
                        <div className="w-8 h-px bg-gradient-to-r from-transparent to-blue-500/30 flex-shrink-0" />
                        
                        {/* Summary content */}
                        <div className="flex items-center gap-2.5 text-[11px] font-mono">
                            <span className="text-blue-400/70 group-hover/loop:text-blue-400 transition-colors">
                                <Icon name="layer-group" className="text-[10px]" />
                            </span>
                            <span className="text-slate-400/80 group-hover/loop:text-slate-300 transition-colors tracking-wide">
                                {stepsLabel}
                            </span>
                            <span className="text-slate-600 group-hover/loop:text-slate-500 transition-colors">·</span>
                            <span className="text-slate-500/60 group-hover/loop:text-slate-400 transition-colors tabular-nums text-[10px]">
                                {formatDuration(elapsedMs)}
                            </span>
                        </div>

                        {/* Right accent line */}
                        <div className="flex-1 h-px bg-gradient-to-r from-blue-500/20 to-transparent" />

                        {/* Expand indicator */}
                        <div className="flex items-center gap-1 text-[9px] text-slate-600 group-hover/loop:text-blue-400/80 transition-all opacity-0 group-hover/loop:opacity-100 flex-shrink-0">
                            <span className="uppercase tracking-widest font-bold">
                                {t('chat.actions.expand', { defaultValue: 'ver' })}
                            </span>
                            <Icon name="chevron-down" className="text-[8px] transform group-hover/loop:translate-y-0.5 transition-transform" />
                        </div>
                    </div>
                </button>
            </div>
        );
    }

    return (
        <div className="mb-4 relative">
            {/* Collapse handle — appears on hover at the top of the expanded tool section */}
            <div className="flex items-center gap-3 pb-1 mb-2">
                <div className="w-8 h-px bg-gradient-to-r from-transparent to-blue-500/20 flex-shrink-0" />
                <button
                    onClick={handleToggle}
                    className="group/collapse flex items-center gap-2 text-[10px] font-mono text-slate-500 hover:text-blue-400 transition-colors focus:outline-none"
                >
                    <Icon name="layer-group" className="text-[9px]" />
                    <span className="tracking-wide">{stepsLabel}</span>
                    <span className="text-slate-600">·</span>
                    <span className="tabular-nums text-slate-500/60">{formatDuration(elapsedMs)}</span>
                    <span className="text-[8px] uppercase tracking-widest font-bold ml-1 opacity-0 group-hover/collapse:opacity-100 transition-opacity">
                        {t('chat.actions.hide', { defaultValue: 'ocultar' })}
                    </span>
                    <Icon name="chevron-up" className="text-[8px] opacity-0 group-hover/collapse:opacity-100 transition-opacity" />
                </button>
                <div className="flex-1 h-px bg-gradient-to-r from-blue-500/15 to-transparent" />
            </div>

            {/* Full expanded content — exactly the same as before */}
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                {children}
            </div>
        </div>
    );
};
