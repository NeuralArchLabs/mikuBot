import React, { useState } from 'react';
import { MarkdownRenderer, Icon } from './Common';

interface CollapsibleTextBlockProps {
    content: string;
    forceCollapsed?: boolean;
    isThought?: boolean;
}

export const CollapsibleTextBlock: React.FC<CollapsibleTextBlockProps> = ({ content, forceCollapsed, isThought }) => {
    const [isCollapsed, setIsCollapsed] = useState(forceCollapsed || false);
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
        <div className={`relative group/text-block mb-3 pl-6 transition-all duration-500`}>
            {/* Neural connector line (Thread trace) */}
            <div className={`absolute left-[5px] top-0 bottom-[-15px] w-0.5 transition-all duration-700 ${isCollapsed ? 'bg-slate-700/20' : 'bg-gradient-to-b from-blue-500/80 via-purple-500/40 to-transparent shadow-[0_0_8px_rgba(59,130,246,0.2)]'}`}></div>

            {/* Neural focal point (Node) */}
            <div className={`absolute left-[2.5px] top-2.5 w-1.5 h-1.5 rounded-full transition-all duration-500 z-10 ${isCollapsed ? 'bg-slate-700 border border-slate-600' : 'bg-blue-400 border border-blue-200 shadow-[0_0_12px_rgba(96,165,250,0.8)] animate-pulse'}`}></div>

            {isCollapsed ? (
                /* COLLAPSED: Single integrated reasoning bar */
                <div
                    onClick={handleToggle}
                    className="cursor-pointer group/inner relative bg-slate-900/60 hover:bg-slate-800/80 border border-white/5 hover:border-blue-500/30 rounded-xl p-3 py-2 text-[11px] text-slate-400 transition-all flex items-center gap-4 shadow-lg"
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
                </div>
            ) : (
                /* EXPANDED: Full view with integrated header */
                <div className="animate-in fade-in slide-in-from-top-1 duration-500">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <div className="flex items-center gap-2">
                            <Icon name="brain" className="text-[10px] text-blue-400 animate-pulse" />
                            <span className="text-[9px] uppercase tracking-[0.25em] font-black text-blue-400/80">Active Reasoning</span>
                        </div>
                        <button
                            onClick={handleToggle}
                            className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors flex items-center gap-1.5"
                        >
                            Hide <Icon name="chevron-up" className="text-[8px]" />
                        </button>
                    </div>
                    <div className="text-[12px] sm:text-[13px] leading-relaxed text-slate-300 bg-white/[0.02] border border-white/5 rounded-2xl p-4 shadow-inner">
                        <MarkdownRenderer content={cleanContent} />
                    </div>
                </div>
            )}
        </div>
    );
};
