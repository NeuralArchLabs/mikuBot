import React from 'react';
import { Message } from '../../types';
import { Icon } from './Common';

// Internal component for collapsible messages
interface CollapsibleMessageProps {
    message: Message;
    children: React.ReactNode;
    initiallyCollapsed?: boolean;
}

export const CollapsibleMessage: React.FC<CollapsibleMessageProps> = ({ message, children, initiallyCollapsed = true }) => {
    const [isCollapsed, setIsCollapsed] = React.useState(initiallyCollapsed);

    // Sync with prop only if it becomes true (auto-collapse as chat progresses)
    // We use a ref to track if user has manually interacted, to avoid annoying auto-collapse while reading?
    // Actually, simple effect:
    React.useEffect(() => {
        if (initiallyCollapsed) setIsCollapsed(true);
    }, [initiallyCollapsed]);

    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';

    // Determine button position based on role
    const buttonPositionClass = isUser
        ? 'right-2' // User: Right side
        : isSystem
            ? 'left-1/2 -translate-x-1/2' // System: Center
            : 'left-2'; // Assistant: Left side

    if (!isCollapsed) {
        return (
            <div className="relative group">
                {children}
                <button
                    onClick={() => setIsCollapsed(true)}
                    className={`absolute -bottom-2 ${buttonPositionClass} bg-slate-800 border border-slate-700 text-slate-400 hover:text-white px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider shadow-lg flex items-center gap-1 z-20 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0`}
                    title="Collapse message"
                >
                    <Icon name="compress-alt" /> Hide
                </button>
            </div>
        );
    }

    // Role-specific styling for the collapsed state
    // (isUser is hoisted)

    // Get a plain text summary
    const summary = message.text
        ? message.text.substring(0, 80).replace(/[\n\r]/g, ' ')
        : message.blocks?.find(b => b.type === 'text' || b.type === 'thought')?.content.substring(0, 80).replace(/[\n\r]/g, ' ') || 'Process Executed...';

    return (
        <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} my-2`}>
            <div
                onClick={() => setIsCollapsed(false)}
                className={`cursor-pointer group flex items-center justify-between gap-3 px-4 py-2 rounded-xl transition-all duration-300 border w-[350px] h-[40px] ${isUser
                    ? 'bg-blue-900/10 border-blue-500/10 hover:bg-blue-900/20 hover:border-blue-500/30'
                    : 'bg-slate-800/30 border-slate-700/30 hover:bg-slate-800/50 hover:border-slate-600/50'
                    }`}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`text-[10px] font-bold uppercase tracking-widest flex-shrink-0 ${isUser ? 'text-blue-400' : 'text-slate-500'}`}>
                        <Icon name={isUser ? 'user' : 'brain'} />
                    </div>

                    <div className="text-[11px] font-mono text-slate-500 truncate opacity-60 group-hover:opacity-100 transition-opacity">
                        {summary}
                    </div>
                </div>

                <div className="text-[9px] font-bold text-slate-600 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 flex items-center gap-1">
                    <Icon name="expand-alt" /> Show
                </div>
            </div>
        </div>
    );
};
