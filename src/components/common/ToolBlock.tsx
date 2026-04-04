import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageBlock } from '../../types';
import { Icon as IconComp } from './Common';

interface ToolBlockProps {
    block: MessageBlock;
    isOld?: boolean;
}

export const ToolBlock: React.FC<ToolBlockProps> = ({ block, isOld }) => {
    const { t, i18n } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(false);
    const { toolCall, result } = block;

    // Auto-collapse old tools
    useEffect(() => {
        if (isOld) {
            setIsExpanded(false);
        }
    }, [isOld]);

    // Typing state
    const [displayText, setDisplayText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    
    // Captured timestamps for the 'Execution Log'
    const [startTime] = useState(() => new Date().toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    const [endTime, setEndTime] = useState<string | null>(null);

    useEffect(() => {
        if (result && !endTime) {
            setEndTime(new Date().toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
        }
    }, [result, endTime, i18n.language]);

    if (!toolCall) return null;

    const isSuccess = result?.success && result?.data?.success !== false;
    const hasError = result?.error || (result?.data?.success === false && result?.data?.error);
    const isPending = !result;

    const getSourceLabel = (src?: string) => {
        if (!src) return t('settings.pathways.workspace');
        const s = src.toLowerCase();
        if (s === 'workspace') return t('settings.pathways.workspace');
        if (s === 'core') return t('settings.pathways.core');
        if (s === 'extra' || s === 'library') return t('settings.pathways.library');
        if (s === 'tools' || s === 'commands') return t('settings.pathways.commands');
        return src;
    };

    const getFriendlySummary = () => {
        if (!result) return t('common.processing');
        const data = result.data || {};
        const args = toolCall.function.arguments || {};
        const name = toolCall.function.name;

        if (!isSuccess && hasError) {
            return `${t('common.error')}: ${result.error || data.error || t('common.operation_failed')}`;
        }

        switch (name) {
            case 'get_system_metrics':
                return t('tools.metrics_summary', { platform: data.platform || 'OS', cpu: data.cpu || '?', ram: data.ram || '?' });
            case 'web_search':
                return t('tools.web_search_summary', { query: args.query });
            case 'web_research':
                return t('tools.web_research_summary', { 
                    query: args.query, 
                    count: data.extracted_sources?.length || 0,
                    categories: (args.categories || ['general']).join(', ')
                });
            case 'deep_research':
                return t('tools.deep_research_summary', { 
                    topic: args.topic, 
                    count: data.report?.stats?.validated || 0,
                    categories: (args.categories || ['general']).join(', ')
                });
            case 'list_files':
                return t('tools.list_files_summary', { source: getSourceLabel(args.source), count: data.files?.length || 0 });
            case 'read_file':
                return t('tools.read_file_summary', { filename: args.filename });
            case 'update_file':
                return typeof result.data === 'string' ? result.data : t('tools.update_file_summary', { filename: args.filename });
            case 'patch_file':
                return t('tools.patch_file_summary', { filename: args.filename });
            case 'search_files':
                return t('tools.search_files_summary', { query: args.query });
            case 'run_console':
                return t('tools.run_console_summary', { command: `${args.command}${args.args ? ' ' + args.args : ''}` });
            case 'read_url':
                return t('tools.read_url_summary', { url: args.url });
            case 'delete_file':
                return t('tools.delete_file_summary', { filename: args.filename });
            case 'add_scheduled_task':
                return t('tools.add_task_summary', { name: args.name, schedule: args.schedule });
            case 'send_telegram_message':
                return t('tools.telegram_summary');
            case 'batch_operation':
                return t('tools.batch_summary', { operation: args.operation, source_path: getSourceLabel(args.source_path) });
            case 'get_file_outline':
                return t('tools.outline_summary', { filename: args.filename });
            default:
                return typeof result.data === 'string' ? result.data : result.data?.message || t('tools.default_summary', { name });
        }
    };

    const friendlySummary = getFriendlySummary();
    const fullResultText = result
        ? (typeof result.data === 'string' ? result.data : result.data?.message || JSON.stringify(result.data || result.error, null, 2))
        : '';

    // Truncated version for the big display (using friendly summary)
    const truncatedText = friendlySummary.length > 80
        ? friendlySummary.substring(0, 80) + '...'
        : friendlySummary;

    const startTyping = () => {
        setIsTyping(true);
        let currentPos = 0;
        const textToType = fullResultText;
        const speed = Math.max(5, 50 - (textToType.length / 20)); // Accelerate for long texts

        const timer = setInterval(() => {
            currentPos += Math.ceil(textToType.length / 50); // Jump multiple chars for "accelerated" feel
            if (currentPos >= textToType.length) {
                setDisplayText(textToType);
                setIsTyping(false);
                clearInterval(timer);
            } else {
                setDisplayText(textToType.substring(0, currentPos));
            }
        }, speed);

        return () => clearInterval(timer);
    };

    useEffect(() => {
        if (isExpanded && result && !isTyping && displayText === '') {
            return startTyping();
        } else if (!isExpanded) {
            setDisplayText('');
            setIsTyping(false);
        }
    }, [isExpanded, result]);

    return (
        <div className={`relative mb-3 pl-6 transition-all duration-300 ${isExpanded ? 'w-full' : 'w-full max-w-3xl'}`}>
            <div className={`tool-block overflow-hidden transition-all duration-300 ${isExpanded ? 'shadow-xl' : 'border border-slate-700/50'}`}>
                {/* Consolidated Header / Summary Strip */}
                <div
                    className={`tool-block-header flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors hover:bg-white/[0.02] ${isExpanded ? 'bg-slate-800/40 border-b border-white/5' : ''}`}
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className={isSuccess ? 'tool-icon-success' : hasError ? 'tool-icon-error' : 'tool-icon-pending'}>
                            <IconComp name={isSuccess ? 'check-circle' : hasError ? 'exclamation-triangle' : 'cog'} className={isPending ? 'animate-spin' : ''} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                            {toolCall.function.name}
                        </span>
                        {isSuccess && <span className="text-[9px] text-emerald-500/50 font-mono font-bold ml-1 hidden sm:inline">{t('common.ready')}</span>}
                    </div>

                    {!isExpanded && (
                        <>
                            <div className="w-px h-3 bg-white/10 flex-shrink-0" />
                            <span className={`text-[11px] truncate flex-1 font-mono tracking-tight ${isSuccess ? 'text-emerald-400/80' : hasError ? 'text-rose-400/80' : 'text-slate-500 italic'}`}>
                                {truncatedText}
                            </span>
                        </>
                    )}

                    <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''} text-slate-600 flex-shrink-0 ml-auto flex items-center justify-center w-5 h-5`}>
                        <IconComp name="chevron-down" className="text-[10px]" />
                    </div>
                </div>

                {/* Inline Summary for Expanded State */}
                {isExpanded && (
                    <div className={`px-4 py-3 bg-slate-800/10 border-b border-white/5 font-medium ${isSuccess ? 'text-emerald-400' : hasError ? 'text-rose-400' : 'text-slate-500 italic'} text-[12px] sm:text-[13px] leading-relaxed`}>
                         <IconComp name="info-circle" className="mr-2 opacity-50" />
                         {friendlySummary}
                    </div>
                )}

                {/* Details Area: Typing JSON and Args */}
                {isExpanded && (
                    <div className="tool-block-content bg-slate-900/40 p-3 pt-4 space-y-4 animate-in fade-in duration-500">
                        <div className="space-y-2">
                            <div className="text-[9px] text-slate-600 uppercase tracking-widest font-bold flex items-center gap-1">
                                <IconComp name="stream" /> {t('common.execution_log')}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono leading-relaxed bg-black/20 p-2 rounded-lg border border-white/5">
                                {t('common.status')}: {isSuccess ? t('common.status_success') : hasError ? t('common.status_error') : t('common.status_pending')}<br />
                                {t('common.executed')}: {endTime || startTime}<br />
                                ID: {toolCall.id}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="text-[9px] text-slate-600 uppercase tracking-widest font-bold flex items-center gap-1">
                                <IconComp name="code" /> {t('common.arguments')}
                            </div>
                            <pre className="custom-scrollbar overflow-y-auto max-h-32 p-3 bg-black/40 rounded-lg text-[10px] whitespace-pre-wrap break-all text-indigo-300/60 border border-white/5 shadow-inner">
                                {JSON.stringify(toolCall.function.arguments, null, 2)}
                            </pre>
                        </div>

                        {result && (
                            <div className="space-y-2">
                                <div className={`text-[9px] uppercase tracking-widest font-bold flex items-center justify-between gap-1 ${isSuccess ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    <div className="flex items-center gap-1">
                                        <IconComp name={isSuccess ? 'check-double' : 'exclamation-triangle'} /> {t('common.detailed_response')}
                                    </div>
                                    {isSuccess && result.data?.engine === 'searXena' && (
                                        <div className="text-[8px] font-black text-slate-600 bg-slate-800/40 px-2 py-0.5 rounded border border-slate-800 tracking-[0.2em] animate-in fade-in slide-in-from-right-2 duration-700">
                                            POWERED BY <span className="text-blue-500/60">searXena</span>
                                        </div>
                                    )}
                                </div>
                                <pre className={`custom-scrollbar overflow-y-auto max-h-60 p-3 bg-black/40 rounded-lg text-[10px] whitespace-pre-wrap break-all border transition-colors duration-500 ${isSuccess ? 'text-emerald-400/70 border-emerald-500/10' : 'text-rose-400/70 border-rose-500/10'}`}>
                                    {isTyping ? displayText : JSON.stringify(result.data || result.error, null, 2)}
                                    {!isTyping && !isSuccess && hasError && <span className="block mt-2 text-rose-500/50 italic font-sans">{t('common.system_exception')}</span>}
                                </pre>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
