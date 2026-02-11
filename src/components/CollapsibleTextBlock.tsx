import React, { useState } from 'react';
import { MarkdownRenderer, Icon } from './Common';

interface CollapsibleTextBlockProps {
    content: string;
    forceCollapsed?: boolean;
}

export const CollapsibleTextBlock: React.FC<CollapsibleTextBlockProps> = ({ content, forceCollapsed }) => {
    const [isCollapsed, setIsCollapsed] = useState(forceCollapsed || false);

    // Auto-collapse logic when the prompt moves far back in history
    React.useEffect(() => {
        if (forceCollapsed) {
            setIsCollapsed(true);
        }
    }, [forceCollapsed]);

    // Get a tiny summary for the collapsed state
    const summary = content.length > 60
        ? content.substring(0, 60).replace(/[\n\r]/g, ' ') + '...'
        : content.replace(/[\n\r]/g, ' ');

    return (
        <div className="relative group/text-block mb-2">
            {/* Minimalist Toggle - Shown on hover or when collapsed */}
            <div className={`flex items-center justify-between mb-1 transition-all duration-300 ${isCollapsed ? 'opacity-100' : 'opacity-0 group-hover/text-block:opacity-100'}`}>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500/40"></div>
                    <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold">
                        {isCollapsed ? 'Packet Compressed' : 'Transmission Data'}
                    </span>
                </div>
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-1 px-2 rounded hover:bg-slate-700/50 text-slate-500 hover:text-blue-400 transition-colors flex items-center gap-1.5"
                    title={isCollapsed ? "Expand Message" : "Collapse Message"}
                >
                    <span className="text-[9px] font-bold uppercase tracking-wider">{isCollapsed ? 'Expand' : 'Hide'}</span>
                    <Icon name={isCollapsed ? 'chevron-down' : 'chevron-up'} />
                </button>
            </div>

            {isCollapsed ? (
                <div
                    onClick={() => setIsCollapsed(false)}
                    className="cursor-pointer bg-slate-800/30 border border-slate-700/30 rounded-lg p-3 py-2 text-[11px] text-slate-400 italic hover:bg-slate-800/50 hover:border-blue-500/20 transition-all flex items-center gap-3"
                >
                    <Icon name="comment-alt" className="text-slate-600" />
                    <span className="truncate opacity-70 font-mono tracking-tight">{summary}</span>
                </div>
            ) : (
                <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                    <MarkdownRenderer content={content} />
                </div>
            )}
        </div>
    );
};
