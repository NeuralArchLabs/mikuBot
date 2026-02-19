import React, { useState } from 'react';
import { MarkdownRenderer, Icon } from './Common';

interface CollapsibleTextBlockProps {
    content: string;
    forceCollapsed?: boolean;
}

export const CollapsibleTextBlock: React.FC<CollapsibleTextBlockProps> = ({ content, forceCollapsed }) => {
    const [isCollapsed, setIsCollapsed] = useState(forceCollapsed || false);
    const hasInteractedRef = React.useRef(false);

    // Auto-collapse logic: Only force if user hasn't manually toggled it
    React.useEffect(() => {
        if (forceCollapsed !== undefined && !hasInteractedRef.current) {
            setIsCollapsed(forceCollapsed);
        }
    }, [forceCollapsed]);

    const handleToggle = () => {
        hasInteractedRef.current = true;
        setIsCollapsed(!isCollapsed);
    };

    // Get a tiny summary for the collapsed state
    const summary = content.length > 60
        ? content.substring(0, 60).replace(/[\n\r]/g, ' ') + '...'
        : content.replace(/[\n\r]/g, ' ');

    return (
        <div className="relative group/text-block mb-1 pl-4 border-l border-blue-500/10 hover:border-blue-500/30 transition-colors">
            {/* Neural connector focal point */}
            <div className={`absolute left-[-3.5px] top-2 w-1.5 h-1.5 rounded-full transition-all duration-500 ${isCollapsed ? 'bg-slate-600' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] animate-pulse'}`}></div>

            {/* Header/Toggle */}
            <div className={`flex items-center justify-between mb-1.5 transition-all duration-300 ${isCollapsed ? 'opacity-100' : 'opacity-0 group-hover/text-block:opacity-100'}`}>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold">
                        {isCollapsed ? 'Memoria de Proceso' : 'Proceso de Razonamiento'}
                    </span>
                </div>
                <button
                    onClick={handleToggle}
                    className="p-1 px-2 rounded hover:bg-slate-700/50 text-slate-500 hover:text-blue-400 transition-colors flex items-center gap-1.5"
                    title={isCollapsed ? "Ampliar proceso" : "Colapsar proceso"}
                >
                    <span className="text-[9px] font-bold uppercase tracking-wider">{isCollapsed ? 'Detalles' : 'Ocultar'}</span>
                    <Icon name={isCollapsed ? 'chevron-down' : 'chevron-up'} />
                </button>
            </div>

            {isCollapsed ? (
                <div
                    onClick={handleToggle}
                    className="cursor-pointer bg-slate-800/20 border border-slate-700/20 rounded-lg p-3 py-2 text-[10px] text-slate-400 italic hover:bg-slate-800/40 hover:border-blue-500/20 transition-all flex items-center gap-3 backdrop-blur-sm"
                >
                    <Icon name="brain" className="text-slate-600 text-[10px]" />
                    <span className="truncate opacity-60 font-mono tracking-tight">{summary}</span>
                </div>
            ) : (
                <div className="animate-in fade-in slide-in-from-top-1 duration-300 text-[13px] leading-relaxed text-slate-300">
                    <MarkdownRenderer content={content} />
                </div>
            )}
        </div>
    );
};
