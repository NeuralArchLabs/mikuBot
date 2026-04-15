import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MarkdownRenderer, Icon } from './Common';
import { useTranslation } from 'react-i18next';

interface CollapsibleTextBlockProps {
    content: string;
    forceCollapse?: boolean;
    isThought?: boolean;
    isStreaming?: boolean;
    mode?: 'full' | 'minimal' | 'none';
}

// ── Content Renderers (Polymorphic Logic) ──────────────────────────

interface ContentRendererProps {
    content: string;
    isStreaming?: boolean;
    mode?: 'full' | 'minimal' | 'none';
    onHeightChange?: (height: number) => void;
}
/**
 * Standard content display without animations.
 */
const StaticRenderer: React.FC<ContentRendererProps> = ({ content, isStreaming, mode, onHeightChange }) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (ref.current && onHeightChange) {
            const observer = new ResizeObserver(entries => {
                onHeightChange(entries[0].target.clientHeight);
            });
            observer.observe(ref.current);
            return () => observer.disconnect();
        }
    }, [onHeightChange]);

    return (
        <div ref={ref} className="animate-in fade-in duration-500">
            <MarkdownRenderer content={content} isStreaming={isStreaming} mode={mode} />
        </div>
    );
};

/**
 * Streaming content display that reveals text over time.
 * Optimized to NOT reset animation when content appends (streaming).
 */
const StreamingRenderer: React.FC<ContentRendererProps> = ({ content, isStreaming, mode, onHeightChange }) => {
    const [visibleContent, setVisibleContent] = useState('');
    const [isFinished, setIsFinished] = useState(false);
    const cursorChar = '\u00A0\u258c';
    const ref = useRef<HTMLDivElement>(null);
    const typedLengthRef = useRef(0);

    useEffect(() => {
        if (ref.current && onHeightChange) {
            const observer = new ResizeObserver(entries => {
                onHeightChange(entries[0].target.clientHeight);
            });
            observer.observe(ref.current);
            return () => observer.disconnect();
        }
    }, [onHeightChange]);

    useEffect(() => {
        // 🎯 ADAPTIVE CHUNK SIZING: Scales chars-per-tick based on content length
        //   - Short (<200): 1 char/tick → classic typewriter feel
        //   - Medium (<800): ~3 chars/tick → smooth flow
        //   - Long (800+): batch to finish in ~3.5s max → no flicker
        const remaining = content.length - typedLengthRef.current;
        if (remaining <= 0) { setIsFinished(true); return; }

        const TICK_MS = 16; // ~60fps aligned
        const MAX_DURATION_MS = Math.min(3500 + Math.max(0, content.length - 800) * 2, 12000);
        const totalTicks = MAX_DURATION_MS / TICK_MS;
        const charsPerTick = remaining < 200 ? 1
            : remaining < 800 ? Math.max(2, Math.ceil(remaining / totalTicks))
            : Math.max(4, Math.ceil(remaining / totalTicks));

        let rafId: number;
        let lastTime = 0;

        const tick = (now: number) => {
            if (!lastTime) lastTime = now;
            if (now - lastTime >= TICK_MS) {
                lastTime = now;
                if (typedLengthRef.current < content.length) {
                    typedLengthRef.current = Math.min(typedLengthRef.current + charsPerTick, content.length);
                    setVisibleContent(content.substring(0, typedLengthRef.current));
                    setIsFinished(false);
                } else {
                    setIsFinished(true);
                    return; // Stop loop
                }
            }
            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(rafId);
    }, [content]);

    return (
        <div ref={ref} className="relative animate-in fade-in duration-300">
            <MarkdownRenderer content={visibleContent + (!isFinished ? cursorChar : '')} isStreaming={isStreaming} mode={mode} />
        </div>
    );
};

// ── Main Component ──────────────────────────────────────────────────

export const CollapsibleTextBlock: React.FC<CollapsibleTextBlockProps> = ({ content, forceCollapse, isThought, isStreaming, mode }) => {
    const { t } = useTranslation();
    const [isCollapsed, setIsCollapsed] = useState(forceCollapse !== undefined ? forceCollapse : (isThought || false));
    const hasInteractedRef = React.useRef(false);

    // Auto-collapse logic: Only force if user hasn't manually toggled it
    React.useEffect(() => {
        if (forceCollapse !== undefined && !hasInteractedRef.current) {
            setIsCollapsed(forceCollapse);
        }
    }, [forceCollapse]);

    // PRE-PROCESSING: Remove <think> tags if they exist to avoid NESTED collapsibles from MarkdownRenderer
    const cleanContent = React.useMemo(() => {
        if (!isThought) return content;
        return content.replace(/<\/?think>/gi, '').trim();
    }, [content, isThought]);

    const handleToggle = () => {
        hasInteractedRef.current = true;
        setIsCollapsed(!isCollapsed);
    };

    // Get a tiny summary for the collapsed state
    const summary = cleanContent.length > 80
        ? cleanContent.substring(0, 80).replace(/[\n\r]/g, ' ') + '...'
        : cleanContent.replace(/[\n\r]/g, ' ');

    const [dotOffset, setDotOffset] = useState(0);

    const handleHeightUpdate = useCallback((h: number) => {
        setDotOffset(h + 12);
    }, []);

    return (
        <div className={`relative group/text-block mb-3 pl-6 transition-all duration-300 w-full ${isCollapsed ? '' : 'h-auto'}`}>
            {/* Neural connector line (Thread trace) */}
            <div 
                className={`absolute left-[5px] top-0 bottom-[-15px] w-0.5 transition-all duration-700 ${isCollapsed ? 'bg-slate-700/20' : 'shadow-[0_0_8px_rgba(59,130,246,0.2)]'}`}
                style={{
                    background: isCollapsed 
                        ? 'rgba(51, 65, 85, 0.2)' 
                        : 'linear-gradient(to bottom, transparent 0%, rgba(59, 130, 246, 0.8) 15%, rgba(139, 92, 246, 0.4) 50%, transparent 100%)'
                }}
            ></div>

            {/* Neural focal point (Node) with dynamic positioning */}
            <div 
                className={`absolute left-[2.5px] top-[14px] w-1.5 h-1.5 rounded-full z-20 transition-all duration-300 ease-out ${isCollapsed ? 'bg-slate-700 border border-slate-600' : 'bg-blue-400 border border-blue-200 shadow-[0_0_12px_rgba(96,165,250,0.8)] animate-pulse'}`}
                style={{ 
                    transform: isCollapsed ? 'none' : `translateY(${dotOffset}px)`
                }}
            ></div>

            {isCollapsed ? (
                /* COLLAPSED ... */
                <button
                    onClick={handleToggle}
                    className="w-full text-left cursor-pointer group/inner relative bg-slate-900/40 hover:bg-slate-800/80 border border-white/5 hover:border-blue-500/30 rounded-xl p-3 py-2 text-[11px] text-slate-400 transition-all flex items-center gap-3 shadow-lg focus:outline-none focus:ring-1 focus:ring-blue-500/20 overflow-hidden"
                >
                    <div className="flex-shrink-0 flex items-center gap-2">
                        <Icon name="brain" className={`text-[11px] ${isThought ? 'text-blue-400' : 'text-slate-500'}`} />
                        <span className="text-[9px] uppercase tracking-[0.2em] font-black text-blue-500/70">{t('chat.labels.reasoning')}</span>
                    </div>
                    <div className="w-px h-3 bg-white/10 flex-shrink-0" />
                    
                    {/* Zero-Intrinsic-Width Flex Wrapper */}
                    <div className="flex-1 relative h-4 min-w-0">
                        <span className="absolute inset-0 truncate opacity-50 group-hover/inner:opacity-100 font-mono tracking-tight transition-opacity leading-4">
                            {summary}
                        </span>
                    </div>

                    <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 ml-auto">
                        <Icon name="chevron-down" className="text-[10px] opacity-40 group-hover/inner:opacity-100 transition-all transform group-hover/inner:translate-y-0.5" />
                    </div>
                </button>
            ) : (
                /* EXPANDED: Full view with integrated header */
                <div className="animate-in fade-in duration-500 relative">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <div className="flex items-center gap-2">
                            <Icon name="brain" className="text-[10px] text-blue-400 animate-pulse" />
                            <span className="text-[9px] uppercase tracking-[0.25em] font-black text-blue-400/80">{t('chat.labels.active_reasoning')}</span>
                        </div>
                        <button
                            onClick={handleToggle}
                            className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors flex items-center gap-1.5 focus:outline-none"
                        >
                            {t('chat.actions.hide')} <Icon name="chevron-up" className="text-[8px]" />
                        </button>
                    </div>
                    <div className={`text-[13px] sm:text-[14px] leading-relaxed text-slate-300 rounded-2xl p-4 overflow-hidden transition-[background-color,transform] duration-500 ${isThought ? 'bg-blue-500/[0.03] border border-blue-500/10 shadow-[inner_0_0_20px_rgba(59,130,246,0.01)]' : 'bg-white/[0.01] border border-white/5'}`}>
                        {isThought ? (
                            <StreamingRenderer content={cleanContent} isStreaming={isStreaming} mode={mode || 'minimal'} onHeightChange={handleHeightUpdate} />
                        ) : (
                            <StaticRenderer content={cleanContent} isStreaming={isStreaming} mode={mode} onHeightChange={handleHeightUpdate} />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
