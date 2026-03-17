import React, { useState } from 'react';
import { MarkdownRenderer, Icon } from './Common';

interface CollapsibleTextBlockProps {
    content: string;
    forceCollapsed?: boolean;
    isThought?: boolean;
}

// ── Content Renderers (Polymorphic Logic) ──────────────────────────

interface ContentRendererProps {
    content: string;
}

/**
 * Standard content display without animations.
 */
const StaticRenderer: React.FC<ContentRendererProps> = ({ content }) => (
    <div className="animate-in fade-in duration-500">
        <MarkdownRenderer content={content} />
    </div>
);

/**
 * Streaming content display that reveals text over time.
 * Used for "Thought" blocks to simulate real-time processing.
 */
const StreamingRenderer: React.FC<ContentRendererProps> = ({ content }) => {
    const [visibleContent, setVisibleContent] = useState('');
    
    React.useEffect(() => {
        const words = content.split(' ');
        let index = 0;
        let currentText = '';
        
        const interval = setInterval(() => {
            if (index < words.length) {
                currentText += (index === 0 ? '' : ' ') + words[index];
                setVisibleContent(currentText);
                index++;
            } else {
                clearInterval(interval);
            }
        }, 12); // Slightly faster for smoother feel
        
        return () => clearInterval(interval);
    }, [content]);

    return (
        <div className="relative animate-in fade-in duration-300">
            <MarkdownRenderer content={visibleContent} />
            {visibleContent.length < content.length && (
                <span className="inline-block w-1.5 h-3.5 bg-blue-500/60 ml-1 animate-pulse rounded-sm align-middle" />
            )}
        </div>
    );
};

// ── Main Component ──────────────────────────────────────────────────

export const CollapsibleTextBlock: React.FC<CollapsibleTextBlockProps> = ({ content, forceCollapsed, isThought }) => {
    const [isCollapsed, setIsCollapsed] = useState(forceCollapsed !== undefined ? forceCollapsed : (isThought || false));
    const hasInteractedRef = React.useRef(false);

    // Auto-collapse logic: Only force if user hasn't manually toggled it
    React.useEffect(() => {
        if (forceCollapsed !== undefined && !hasInteractedRef.current) {
            setIsCollapsed(forceCollapsed);
        }
    }, [forceCollapsed]);

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

    return (
        <div className="relative group/text-block mb-3 pl-6 transition-all duration-300">
            {/* Neural connector line (Thread trace) */}
            <div className={`absolute left-[5px] top-0 bottom-[-15px] w-0.5 transition-all duration-700 ${isCollapsed ? 'bg-slate-700/20' : 'bg-gradient-to-b from-blue-500/80 via-purple-500/40 to-transparent shadow-[0_0_8px_rgba(59,130,246,0.2)]'}`}></div>

            {/* Neural focal point (Node) */}
            <div className={`absolute left-[2.5px] top-2.5 w-1.5 h-1.5 rounded-full transition-all duration-500 z-10 ${isCollapsed ? 'bg-slate-700 border border-slate-600' : 'bg-blue-400 border border-blue-200 shadow-[0_0_12px_rgba(96,165,250,0.8)] animate-pulse'}`}></div>

            {isCollapsed ? (
                /* COLLAPSED: Single integrated reasoning bar */
                <button
                    onClick={handleToggle}
                    className="w-full text-left cursor-pointer group/inner relative bg-slate-900/40 hover:bg-slate-800/80 border border-white/5 hover:border-blue-500/30 rounded-xl p-3 py-2 text-[11px] text-slate-400 transition-all flex items-center gap-4 shadow-lg focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                >
                    <div className="flex-shrink-0 flex items-center gap-2">
                        <Icon name="brain" className={`text-[11px] ${isThought ? 'text-blue-400' : 'text-slate-500'}`} />
                        <span className="text-[9px] uppercase tracking-[0.2em] font-black text-blue-500/70">Razonamiento</span>
                    </div>
                    <div className="w-px h-3 bg-white/10" />
                    <span className="truncate opacity-50 group-hover/inner:opacity-100 font-mono tracking-tight transition-opacity flex-1">
                        {summary}
                    </span>
                    <Icon name="chevron-down" className="text-[10px] opacity-40 group-hover/inner:opacity-100 transition-all transform group-hover/inner:translate-y-0.5" />
                </button>
            ) : (
                /* EXPANDED: Full view with integrated header */
                <div className="animate-in fade-in duration-500 relative">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <div className="flex items-center gap-2">
                            <Icon name="brain" className="text-[10px] text-blue-400 animate-pulse" />
                            <span className="text-[9px] uppercase tracking-[0.25em] font-black text-blue-400/80">Active Reasoning</span>
                        </div>
                        <button
                            onClick={handleToggle}
                            className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors flex items-center gap-1.5 focus:outline-none"
                        >
                            Hide <Icon name="chevron-up" className="text-[8px]" />
                        </button>
                    </div>
                    <div className={`text-[13px] sm:text-[14px] leading-relaxed text-slate-300 rounded-2xl p-4 overflow-hidden transition-[background-color,transform] duration-500 ${isThought ? 'bg-blue-500/[0.03] border border-blue-500/10 shadow-[inner_0_0_20px_rgba(59,130,246,0.01)]' : 'bg-white/[0.01] border border-white/5'}`}>
                        {isThought ? (
                            <StreamingRenderer content={cleanContent} />
                        ) : (
                            <StaticRenderer content={cleanContent} />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
