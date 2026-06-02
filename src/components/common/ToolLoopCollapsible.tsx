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

    return (
        <div className="mb-4 relative">
            {/* Unified Header: Always visible, acts as toggle */}
            <button
                onClick={handleToggle}
                className={`group/loop w-full text-left focus:outline-none ${isCollapsed ? 'py-2.5' : 'pb-1 mb-2'}`}
            >
                <div className="flex items-center gap-3 px-1 transition-all duration-300">
                    <div className={`w-8 h-px flex-shrink-0 ${isCollapsed ? 'bg-gradient-to-r from-transparent to-blue-500/30' : 'bg-gradient-to-r from-transparent to-blue-500/20'}`} />
                    
                    <div className={`flex items-center gap-2 font-mono transition-colors ${isCollapsed ? 'gap-2.5 text-[11px]' : 'gap-2 text-[10px] text-slate-500 hover:text-blue-400'}`}>
                        <span className={`transition-colors ${isCollapsed ? 'text-blue-400/70 group-hover/loop:text-blue-400' : ''}`}>
                            <Icon name="layer-group" className="text-[10px]" />
                        </span>
                        <span className={`tracking-wide transition-colors ${isCollapsed ? 'text-slate-400/80 group-hover/loop:text-slate-300' : ''}`}>
                            {stepsLabel}
                        </span>
                        <span className="text-slate-600 group-hover/loop:text-slate-500 transition-colors">·</span>
                        <span className="text-slate-500/60 group-hover/loop:text-slate-400 transition-colors tabular-nums text-[10px]">
                            {formatDuration(elapsedMs)}
                        </span>
                        
                        {/* Conditional Action Labels */}
                        <span className={`text-[8px] uppercase tracking-widest font-bold ml-1 transition-opacity ${isCollapsed ? 'opacity-0 group-hover/loop:opacity-100' : 'opacity-0 group-hover/loop:opacity-100'}`}>
                            {isCollapsed 
                                ? t('chat.actions.expand', { defaultValue: 'ver' }) 
                                : t('chat.actions.hide', { defaultValue: 'ocultar' })}
                        </span>
                        <Icon 
                            name={isCollapsed ? 'chevron-down' : 'chevron-up'} 
                            className={`text-[8px] transition-all ${isCollapsed ? 'transform group-hover/loop:translate-y-0.5' : ''} opacity-0 group-hover/loop:opacity-100`} 
                        />
                    </div>

                    <div className="flex-1 h-px bg-gradient-to-r from-blue-500/20 to-transparent" />
                </div>
            </button>

            {/* Animated Content Container */}
            <div 
                className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'}`}
            >
                <div className="overflow-y-hidden overflow-x-clip">
                    <div className={`px-4 transition-opacity duration-300 ease-in-out ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};
