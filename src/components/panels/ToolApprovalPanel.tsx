import React, { useState } from 'react';
import { PendingToolApproval } from '../../types';
import { Icon } from '../common/Common';
import { useTranslation } from 'react-i18next';

interface ToolApprovalPanelProps {
    pending: PendingToolApproval;
    onApprove: () => void;
    onReject: () => void;
}

export const ToolApprovalPanel = React.memo(({
    pending,
    onApprove: onApproveProp,
    onReject: onRejectProp,
}: ToolApprovalPanelProps) => {
    const { t } = useTranslation();
    const [status, setStatus] = useState<'waiting' | 'approved' | 'rejected'>('waiting');

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
            onApproveProp();
        }, 2200); // 2.2s delay for a sophisticated and visible animation
    };

    const handleReject = () => {
        setStatus('rejected');
        setTimeout(() => {
            onRejectProp();
        }, 600);
    };

    const args = JSON.stringify(pending.toolCall.function.arguments, null, 2);
    // Truncate args for display if too long
    const displayArgs = args.length > 300 ? args.substring(0, 300) + '...' : args;

    if (status === 'approved') {
        return (
            <div className="approval-panel-glass p-8 flex flex-col items-center justify-center text-emerald-400 min-h-[220px]">
                <div className="relative mb-6">
                    <div className="w-16 h-16 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-2xl animate-pulse">
                        <Icon name="check" />
                    </div>
                </div>
                <div className="text-sm font-mono tracking-[0.3em] uppercase animate-pulse">{t('chat.approval.sync_success')}</div>
                <div className="text-[10px] text-emerald-500/40 mt-3 font-mono tracking-widest uppercase">
                    {t('chat.approval.executing')} {pending.toolCall.function.name}
                </div>
            </div>
        );
    }

    if (status === 'rejected') {
        return (
            <div className="approval-panel-glass p-6 flex flex-col items-center justify-center text-red-400">
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

    // Accent color based on risk level
    const accentColor = isConsoleCommand ? 'red' : isNonWorkSpace ? 'amber' : 'amber';
    const borderClass = isConsoleCommand ? 'border-red-500/50' : 'border-slate-700/30';
    const barClass = isConsoleCommand ? 'bg-red-500/70' : isNonWorkSpace ? 'bg-amber-500/50' : 'bg-amber-500/50';

    return (
        <div className="approval-panel-glass font-mono relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-1 h-full ${barClass}`}></div>

            {/* Security Warning Banner — Console */}
            {isConsoleCommand && (
                <div className="px-5 py-2 bg-red-900/30 border-b border-red-500/30 flex items-center gap-2">
                    <Icon name="exclamation-triangle" className="text-red-400 text-sm" />
                    <span className="text-[10px] text-red-300 font-bold uppercase tracking-widest">
                        ⚠ {t('chat.approval.elevated_risk')}
                    </span>
                </div>
            )}

            {/* Security Warning Banner — Non-WorkSpace */}
            {isNonWorkSpace && !isConsoleCommand && (
                <div className="px-5 py-2 bg-amber-900/20 border-b border-amber-500/20 flex items-center gap-2">
                    <Icon name="exclamation-circle" className="text-amber-400 text-sm" />
                    <span className="text-[10px] text-amber-300 font-bold uppercase tracking-widest">
                        {t('chat.approval.modifying_core', { source: toolArgs.source?.toUpperCase() })}
                    </span>
                </div>
            )}

            {/* Header */}
            <div className={`px-5 py-3 bg-slate-900/40 border-b ${borderClass} flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded flex items-center justify-center border ${isConsoleCommand
                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                        <Icon name={isConsoleCommand ? 'terminal' : 'shield-alt'} />
                    </div>
                    <div>
                        <div className={`text-[10px] uppercase tracking-widest font-bold ${isConsoleCommand ? 'text-red-500/80' : 'text-amber-500/80'
                            }`}>
                            {isConsoleCommand ? t('chat.approval.console_access') : t('chat.approval.security_check')}
                        </div>
                        <div className="text-sm text-slate-200 font-bold tracking-wide">
                            {toolName}
                        </div>
                    </div>
                </div>
                <div className="text-[10px] text-slate-500 bg-slate-900/50 px-2 py-1 rounded border border-slate-800">
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

            {/* Content */}
            <div className="p-4 bg-slate-900/20">
                <div className="text-[10px] text-slate-400 mb-2 uppercase tracking-wide opacity-70">{t('chat.approval.params_requested')}</div>
                <pre className="text-[11px] text-indigo-300/90 font-mono bg-black/40 rounded-lg p-3 border border-indigo-500/10 custom-scrollbar max-h-40 overflow-y-auto whitespace-pre-wrap break-all shadow-inner">
                    {displayArgs}
                </pre>
            </div>

            {/* Actions */}
            <div className="px-4 py-3 bg-slate-900/40 border-t border-slate-700/30 flex items-center justify-end gap-3">
                <button
                    onClick={handleReject}
                    className="approval-btn px-4 py-2 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                >
                    <Icon name="times" /> {t('chat.approval.deny')}
                </button>
                <button
                    onClick={handleApprove}
                    className={`approval-btn px-6 py-2 rounded-lg text-white shadow-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 border ${isConsoleCommand
                        ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20 border-red-500/50'
                        : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20 border-emerald-500/50'
                        }`}
                >
                    <Icon name="check" /> {isConsoleCommand ? t('chat.approval.authorize_console') : t('chat.approval.authorize_exec')}
                </button>
            </div>

            {/* Decorative glint */}
            <div className="absolute top-0 right-0 p-2 opacity-20 pointer-events-none">
                <div className="w-20 h-20 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-xl transform translate-x-10 -translate-y-10"></div>
            </div>
        </div>
    );
});
