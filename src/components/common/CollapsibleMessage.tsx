import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Message } from '../../types';
import { Icon } from './Common';

// Internal component for collapsible messages
interface CollapsibleMessageProps {
    message: Message;
    children: React.ReactNode;
    initiallyCollapsed?: boolean;
}

export const CollapsibleMessage: React.FC<CollapsibleMessageProps> = ({ message, children, initiallyCollapsed = true }) => {
    const { t } = useTranslation();
    const [isCollapsed, setIsCollapsed] = React.useState(initiallyCollapsed);

    // Sync with prop to ensure auto-collapse works as chat progresses
    React.useEffect(() => {
        setIsCollapsed(initiallyCollapsed);
    }, [initiallyCollapsed]);

    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';

    const isScheduler = (message as any).isScheduler;

    const justifyClass = isUser ? 'justify-end' : (isSystem ? 'justify-center' : 'justify-start');

    // Determine button position based on role
    const buttonPositionClass = isUser
        ? 'right-2' // User: Right side
        : (isSystem || isScheduler)
            ? 'left-1/2 -translate-x-1/2' // System/Scheduler: Center
            : 'left-2'; // Assistant: Left side

    if (!isCollapsed) {
        return (
            <div className="relative group w-full">
                {children}
                <button
                    onClick={() => setIsCollapsed(true)}
                    className={`absolute -bottom-2 ${buttonPositionClass} bg-slate-800 border border-slate-700 text-slate-400 hover:text-white px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider shadow-lg flex items-center gap-1 z-20 invisible opacity-0 group-hover:visible group-hover:opacity-100 focus:visible focus:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto`}
                    title="Collapse message"
                >
                    <Icon name="compress-alt" /> {t('chat.actions.hide')}
                </button>
            </div>
        );
    }

    // Role-specific styling for the collapsed state
    const bgClass = isUser
        ? 'bg-blue-900/10 border-transparent hover:bg-blue-900/20 hover:border-blue-500/30'
        : isScheduler
            ? (message as any).isScheduledResponse
                ? 'bg-indigo-950/20 border-transparent hover:bg-indigo-900/30 hover:border-indigo-500/40'
                : 'bg-orange-950/20 border-transparent hover:bg-orange-900/30 hover:border-orange-500/40'
            : isSystem
                ? 'bg-amber-950/10 border-transparent hover:bg-amber-900/20 hover:border-amber-500/30'
                : 'bg-slate-800/30 border-transparent hover:bg-slate-800/50 hover:border-slate-600/50';

    const iconColorClass = isUser ? 'text-blue-400' : (isScheduler ? ((message as any).isScheduledResponse ? 'text-indigo-400' : 'text-orange-400') : (isSystem ? 'text-amber-500' : 'text-slate-500'));
    const iconName = isUser ? 'user' : (isScheduler ? ((message as any).isScheduledResponse ? 'brain' : 'bell') : (isSystem ? 'shield-alt' : 'brain'));

    // Get a plain text summary
    const summary = message.text
        ? message.text.substring(0, 80).replace(/[\n\r]/g, ' ')
        : message.blocks?.find(b => b.type === 'text' || b.type === 'thought')?.content.substring(0, 80).replace(/[\n\r]/g, ' ') || 'Process Executed...';

    return (
        <div key={message.id} className={`flex ${justifyClass} my-2 w-full`}>
            <div
                onClick={() => setIsCollapsed(false)}
                className={`cursor-pointer group flex items-center justify-between gap-3 px-4 py-2 rounded-xl transition-all duration-300 border border-transparent w-full max-w-[350px] min-h-[40px] ${bgClass}`}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`text-[10px] font-bold uppercase tracking-widest flex-shrink-0 ${iconColorClass}`}>
                        <Icon name={iconName} />
                    </div>

                    <div className="text-[11px] font-mono text-slate-400 truncate opacity-60 group-hover:opacity-100 transition-opacity">
                        {summary}...
                    </div>
                </div>

                <div className="text-[9px] font-bold text-slate-600 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 flex items-center gap-1">
                    <Icon name="expand-alt" /> {t('chat.actions.show')}
                </div>
            </div>
        </div>
    );
};
