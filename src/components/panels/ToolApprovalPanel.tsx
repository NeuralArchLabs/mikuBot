import React, { useState } from 'react';
import { PendingToolApproval } from '../../types';
import { Icon } from '../common/Common';
import { useTranslation } from 'react-i18next';
import { CORE_TOOLS } from '../common/ToolBlock';

interface ToolApprovalPanelProps {
    pending: PendingToolApproval;
    onApprove: (feedback?: string) => void;
    onReject: (feedback?: string) => void;
}

export const ToolApprovalPanel = React.memo(({
    pending,
    onApprove: onApproveProp,
    onReject: onRejectProp,
}: ToolApprovalPanelProps) => {
    const { t } = useTranslation();
    const [status, setStatus] = useState<'waiting' | 'approved' | 'rejected'>('waiting');
    const [feedback, setFeedback] = useState('');

    React.useEffect(() => {
        const handleKeyDownMain = (e: KeyboardEvent) => {
            if (status !== 'waiting') return;

            if (e.altKey && e.key === 'Enter') {
                e.preventDefault();
                handleApprove();
            } else if (e.altKey && e.key === 'Backspace') {
                e.preventDefault();
                handleReject();
            }
        };

        window.addEventListener('keydown', handleKeyDownMain);
        return () => window.removeEventListener('keydown', handleKeyDownMain);
    }, [status]);

    const handleApprove = () => {
        setStatus('approved');
        setTimeout(() => {
            onApproveProp(feedback);
        }, 2200); // 2.2s delay for a sophisticated and visible animation
    };

    const handleReject = () => {
        setStatus('rejected');
        setTimeout(() => {
            onRejectProp(feedback);
        }, 600);
    };

    const args = JSON.stringify(pending.toolCall.function.arguments, null, 2);
    // Truncate args for display if too long
    const displayArgs = args.length > 300 ? args.substring(0, 300) + '...' : args;

    const isNeural = !CORE_TOOLS.has(pending.toolCall.function.name);

    if (status === 'approved') {
        return (
            <div className={`w-full p-8 flex flex-col items-center justify-center min-h-[220px] ${isNeural ? 'text-blue-400' : 'text-emerald-400'}`}>
                <div className="relative mb-6">
                    <div className={`w-16 h-16 rounded-full border-2 animate-spin ${isNeural ? 'border-blue-400/20 border-t-blue-400' : 'border-emerald-500/20 border-t-emerald-400'}`}></div>
                    <div className="absolute inset-0 flex items-center justify-center text-2xl animate-pulse">
                        <Icon name="check" />
                    </div>
                </div>
                <div className="text-sm font-mono tracking-[0.3em] uppercase animate-pulse">{t('chat.approval.sync_success')}</div>
                <div className={`text-[10px] mt-3 font-mono tracking-widest uppercase ${isNeural ? 'text-blue-400/40' : 'text-emerald-500/40'}`}>
                    {t('chat.approval.executing')} {pending.toolCall.function.name}
                </div>
            </div>
        );
    }

    if (status === 'rejected') {
        return (
            <div className="w-full p-6 flex flex-col items-center justify-center text-red-400">
                <div className="text-3xl mb-2"><Icon name="ban" /></div>
                <div className="text-sm font-mono tracking-widest uppercase">{t('chat.approval.denied')}</div>
            </div>
        );
    }

    // --- Determine security tier ---
    const toolName = pending.toolCall.function.name;
    const toolArgs = pending.toolCall.function.arguments || {};
    const isConsoleCommand = toolName === 'run_console';
    const isNonWorkSpace = (toolArgs.source === 'core' || toolArgs.source === 'library') &&
        (toolName === 'update_file' || toolName === 'read_file');
    const isNeuralSkill = !CORE_TOOLS.has(toolName);

    // Accent color based on risk level
    const borderClass = isConsoleCommand ? 'border-red-500/50' : 'border-slate-700/30';
    const barClass = isConsoleCommand ? 'bg-red-500/70' : isNonWorkSpace ? 'bg-amber-500/50' : isNeuralSkill ? 'bg-blue-400/50' : 'bg-amber-500/50';

    const getSourceLabel = (src?: string) => {
        if (!src) return t('settings.pathways.workspace');
        const s = src.toLowerCase();
        if (s === 'workspace') return t('settings.pathways.workspace');
        if (s === 'core') return t('settings.pathways.core');
        if (s === 'extra' || s === 'library') return t('settings.pathways.library');
        if (s === 'tools' || s === 'commands') return t('settings.pathways.commands');
        return src;
    };

    return (
        <div className="w-full font-mono relative group">
            <div className={`absolute top-0 left-0 w-1 h-full ${barClass}`}></div>

            {/* Unified Header */}
            <div className={`px-5 py-3 bg-slate-900/40 border-b ${borderClass} flex items-center justify-between gap-4`}>
                <div className="flex items-center gap-3 min-w-max border-r border-slate-700/50 pr-4">
                    <div className={`w-8 h-8 rounded flex items-center justify-center border ${isConsoleCommand
                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : isNeuralSkill
                            ? 'bg-blue-400/10 text-blue-400 border-blue-400/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                        <Icon name={isConsoleCommand ? 'terminal' : isNeuralSkill ? 'brain' : 'shield-alt'} />
                    </div>
                    <div>
                        <div className={`text-[10px] uppercase tracking-widest font-bold ${isConsoleCommand ? 'text-red-500/80' : isNeuralSkill ? 'text-blue-400/80' : 'text-amber-500/80'
                            }`}>
                            {isConsoleCommand ? t('chat.approval.console_access') : t('chat.approval.security_check')}
                        </div>
                        <div className="text-sm text-slate-200 font-bold tracking-wide">
                            {toolName}
                        </div>
                    </div>
                </div>

                {/* Inline Warning Indicator */}
                <div className="flex-1 hidden sm:block">
                    {isConsoleCommand ? (
                        <div className="flex items-center gap-2 text-red-400">
                            <Icon name="exclamation-triangle" className="text-sm" />
                            <span className="text-[10px] font-bold uppercase tracking-widest truncate">
                                ⚠ {t('chat.approval.elevated_risk')}
                            </span>
                        </div>
                    ) : isNonWorkSpace ? (
                        <div className="flex items-center gap-2 text-amber-500/90">
                            <Icon name="exclamation-circle" className="text-sm" />
                            <span className="text-[10px] font-bold uppercase tracking-widest truncate">
                                {t('chat.approval.modifying_core', { source: getSourceLabel(toolArgs.source).toUpperCase() })}
                            </span>
                        </div>
                    ) : null}
                </div>

                <div className="text-[10px] text-slate-500 bg-slate-900/50 px-2 py-1 rounded border border-slate-800 whitespace-nowrap">
                    ID: {pending.toolCall.id.slice(0, 8)}
                </div>
            </div>

            {/* Console-specific command preview */}
            {isConsoleCommand && toolArgs.command && (
                <div className="px-5 py-2 bg-black/40 border-b border-red-500/10">
                    <div className="text-[10px] text-red-400/70 uppercase tracking-wide mb-1">{t('chat.approval.cmd_preview')}</div>
                    <code className="text-xs text-red-300 font-mono">
                        $ {toolArgs.command} {toolArgs.args || ''}
                    </code>
                </div>
            )}

            <div className="p-4 bg-slate-900/20">
                <div className="text-[10px] text-slate-400 mb-2 uppercase tracking-wide opacity-70">{t('chat.approval.params_requested')}</div>
                <pre className="text-[11px] text-indigo-300/90 font-mono bg-black/40 rounded-lg p-3 border border-indigo-500/10 custom-scrollbar max-h-40 overflow-y-auto whitespace-pre-wrap break-all shadow-inner">
                    {displayArgs}
                </pre>

            </div>

            {/* Actions & Feedback */}
            <div className="px-4 py-3 bg-slate-900/40 border-t border-slate-700/30 flex flex-col sm:flex-row items-center gap-4">
                {/* Feedback Section inline */}
                <div className="flex flex-1 items-center gap-3 w-full">
                    <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold whitespace-nowrap hidden lg:block">
                        {t('chat.approval.feedback_optional')}
                    </div>
                    <div className="flex-1 w-full group/feedback relative flex items-center">
                        <input 
                            type="text"
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder={t('chat.approval.feedback_placeholder')}
                            className="w-full bg-black/20 border border-white/5 focus:border-blue-500/30 focus:bg-black/40 rounded-lg px-3 text-[11px] font-mono text-slate-300 placeholder-slate-600 outline-none transition-all duration-300 h-9 shadow-inner"
                            onKeyDown={(e) => {
                                // Stop propagation to prevent global shortcuts if typing here
                                e.stopPropagation();
                                if (e.altKey && e.key === 'Enter') {
                                    e.preventDefault();
                                    handleApprove();
                                } else if (e.altKey && e.key === 'Backspace') {
                                    e.preventDefault();
                                    handleReject();
                                }
                            }}
                        />
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 shrink-0 w-full sm:w-auto">
                    <button
                        onClick={handleReject}
                        className="approval-btn px-4 h-[36px] rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 flex-1 sm:flex-none"
                    >
                        <Icon name="times" /> {t('chat.approval.deny')}
                    </button>
                    <button
                        onClick={handleApprove}
                        className={`approval-btn px-6 h-[36px] rounded-lg text-white shadow-lg text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 flex-1 sm:flex-none border ${isConsoleCommand
                            ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20 border-red-500/50'
                            : isNeuralSkill
                                ? 'bg-blue-500 hover:bg-blue-400 shadow-blue-900/20 border-blue-400/50'
                                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20 border-emerald-500/50'
                            }`}
                    >
                        <Icon name="check" /> {isConsoleCommand ? t('chat.approval.authorize_console') : t('chat.approval.authorize_exec')}
                    </button>
                </div>
            </div>

            {/* Decorative glint */}
            <div className="absolute top-0 right-0 p-2 opacity-20 pointer-events-none">
                <div className="w-20 h-20 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-xl transform translate-x-10 -translate-y-10"></div>
            </div>
        </div>
    );
});
