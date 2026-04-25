import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Message } from '../../types';
import { Icon } from './Common';

// Internal component for collapsible messages
interface CollapsibleMessageProps {
    message: Message;
    children: React.ReactNode;
    initiallyCollapsed?: boolean;
    hasCustomBg?: boolean;
}

export const CollapsibleMessage: React.FC<CollapsibleMessageProps> = ({ message, children, initiallyCollapsed = true, hasCustomBg }) => {
    const { t } = useTranslation();
    const [isCollapsed, setIsCollapsed] = React.useState(initiallyCollapsed);
    const [copySuccess, setCopySuccess] = React.useState(false);

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
            : 'left-9'; // Assistant: Micro-adjusted (was left-11)

    if (!isCollapsed) {
        return (
            <div id={`msg-${message.id}`} className="relative group w-full">
                {children}
                
                {/* Bottom Action Group: Hide & Copy */}
                <div className={`absolute -bottom-2.5 ${buttonPositionClass} flex ${isUser ? 'flex-row-reverse' : 'flex-row'} items-center gap-1.5 z-20 invisible opacity-0 group-hover:visible group-hover:opacity-100 focus-within:visible focus-within:opacity-100 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto`}>
                    <button
                        onClick={() => setIsCollapsed(true)}
                        className="px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider shadow-lg flex items-center gap-1 transition-all hover:scale-105 active:scale-95 border hover:bg-[var(--hover-color)]"
                        style={{ 
                            backgroundColor: 'var(--surface-color)', 
                            borderColor: 'var(--border-color)',
                            color: 'var(--text-primary)'
                        }}
                        title="Collapse message"
                    >
                        <Icon name="compress-alt" className="group-hover:text-[var(--primary-color)]" /> {t('chat.actions.hide')}
                    </button>
                    
                    {!isSystem && !isScheduler && (
                        <button
                            onClick={() => {
                                const textToCopy = message.text || message.blocks?.find(b => b.type === 'text')?.content || '';
                                navigator.clipboard.writeText(textToCopy);
                                setCopySuccess(true);
                                setTimeout(() => setCopySuccess(false), 2000);
                            }}
                            className="px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider shadow-lg flex items-center gap-1 transition-all hover:scale-105 active:scale-95 border hover:bg-[var(--hover-color)]"
                            style={{ 
                                backgroundColor: 'var(--surface-color)', 
                                borderColor: 'var(--border-color)',
                                color: copySuccess ? 'var(--primary-color)' : 'var(--text-secondary)'
                            }}
                        >
                            <Icon name={copySuccess ? "check" : "copy"} className={copySuccess ? 'text-[var(--primary-color)]' : ''} /> {copySuccess ? t('chat.actions.copied') : t('chat.actions.copy')}
                        </button>
                    )}
                </div>
            </div>
        );
    }



    // Role-specific styling for the collapsed state
    const bgClass = isUser
        ? hasCustomBg ? 'bg-blue-900/60 border-blue-400/40' : 'bg-blue-900/10 border-transparent hover:bg-blue-900/20 hover:border-blue-500/30'
        : isScheduler
            ? (message as any).isScheduledResponse
                ? hasCustomBg ? 'bg-indigo-950/60 border-indigo-400/40' : 'bg-indigo-950/20 border-transparent hover:bg-indigo-900/30 hover:border-indigo-500/40'
                : hasCustomBg ? 'bg-orange-950/60 border-orange-400/40' : 'bg-orange-950/20 border-transparent hover:bg-orange-900/30 hover:border-orange-500/40'
            : isSystem
                ? hasCustomBg ? 'bg-amber-950/60 border-amber-500/40' : 'bg-amber-950/10 border-transparent hover:bg-amber-900/20 hover:border-amber-500/30'
                : hasCustomBg ? 'bg-slate-900/60 border-slate-700/60' : 'bg-slate-800/30 border-transparent hover:bg-slate-800/50 hover:border-slate-600/50';

    const iconColorClass = isUser ? (hasCustomBg ? 'text-blue-300' : 'text-blue-400') : (isScheduler ? ((message as any).isScheduledResponse ? 'text-indigo-400' : 'text-orange-400') : (isSystem ? 'text-amber-500' : 'text-slate-500'));
    const iconName = isUser ? 'user' : (isScheduler ? ((message as any).isScheduledResponse ? 'brain' : 'bell') : (isSystem ? 'shield-alt' : 'brain'));

    // Get a plain text summary
    const summary = message.text
        ? message.text.substring(0, 80).replace(/[\n\r]/g, ' ')
        : message.blocks?.find(b => b.type === 'text' || b.type === 'thought')?.content.substring(0, 80).replace(/[\n\r]/g, ' ') || 'Process Executed...';

    return (
        <div id={`msg-${message.id}`} className={`flex ${justifyClass} my-2 w-full`}>
            <div
                onClick={() => setIsCollapsed(false)}
                className={`cursor-pointer group flex items-center justify-between gap-3 px-4 py-2 rounded-xl transition-all duration-300 border border-transparent w-full max-w-[350px] min-h-[40px] shadow-lg will-change-transform ${hasCustomBg ? 'shadow-black/80' : 'shadow-black/40'} ${bgClass}`}
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
