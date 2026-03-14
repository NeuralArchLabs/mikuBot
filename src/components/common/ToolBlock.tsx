import React, { useState, useEffect, useRef } from 'react';
import { MessageBlock } from '../../types';
import { Icon as IconComp } from './Common';

interface ToolBlockProps {
    block: MessageBlock;
    isOld?: boolean;
}

export const ToolBlock: React.FC<ToolBlockProps> = ({ block, isOld }) => {
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

    if (!toolCall) return null;

    const isSuccess = result?.success && result?.data?.success !== false;
    const hasError = result?.error || (result?.data?.success === false && result?.data?.error);
    const isPending = !result;

    const getFriendlySummary = () => {
        if (!result) return 'Procesando...';
        const data = result.data || {};
        const args = toolCall.function.arguments || {};
        const name = toolCall.function.name;

        if (!isSuccess && hasError) {
            return `Error: ${result.error || data.error || 'Operación fallida'}`;
        }

        switch (name) {
            case 'get_system_metrics':
                return `Métricas del sistema obtenidas: ${data.platform || 'OS'} [CPU: ${data.cpu || '?'}%, RAM: ${data.ram || '?'}]`;
            case 'web_search':
                return `Búsqueda en la red finalizada para: "${args.query}". Se encontraron resultados relevantes.`;
            case 'list_files':
                return `Exploración de archivos completada en "${args.source || 'workSpace'}". ${data.files?.length || 0} elementos encontrados.`;
            case 'read_file':
                return `Lectura del archivo "${args.filename}" completada con éxito.`;
            case 'update_file':
                return typeof result.data === 'string' ? result.data : `Archivo "${args.filename}" guardado correctamente.`;
            case 'patch_file':
                return `Parche "Smart" aplicado a "${args.filename}". Cambios integrados.`;
            case 'search_files':
                return `Búsqueda de texto finalizada. Coincidencias encontradas para: "${args.query}".`;
            case 'run_console':
                return `Comando "${args.command}${args.args ? ' ' + args.args : ''}" ejecutado en la terminal.`;
            case 'read_url':
                return `Contenido extraído y analizado de la URL: ${args.url}`;
            case 'delete_file':
                return `Archivo "${args.filename}" eliminado satisfactoriamente.`;
            case 'add_scheduled_task':
                return `Tarea autónoma programada: "${args.name}". Próxima ejecución: ${args.schedule}.`;
            case 'send_telegram_message':
                return `Transmisión enviada a Telegram con éxito.`;
            case 'batch_operation':
                return `Operación por lotes (${args.operation}) realizada sobre "${args.source_path}".`;
            case 'get_file_outline':
                return `Mapa estructural de "${args.filename}" generado correctamente.`;
            default:
                return typeof result.data === 'string' ? result.data : result.data?.message || `Operación "${name}" completada.`;
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

    useEffect(() => {
        if (isExpanded && result && !isTyping && displayText === '') {
            startTyping();
        } else if (!isExpanded) {
            setDisplayText('');
            setIsTyping(false);
        }
    }, [isExpanded, result]);

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

    return (
        <div className={`tool-block ${isExpanded ? 'shadow-xl' : ''}`}>
            {/* Header: Fixed size */}
            <div
                className="tool-block-header"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    <div className={isSuccess ? 'tool-icon-success' : hasError ? 'tool-icon-error' : 'tool-icon-pending'}>
                        <IconComp name={isSuccess ? 'check-circle' : hasError ? 'exclamation-triangle' : 'cog'} className={isPending ? 'animate-spin' : ''} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        {toolCall.function.name}
                    </span>
                    {isSuccess && <span className="text-[9px] text-emerald-500/50 font-mono font-bold ml-1">READY</span>}
                </div>
                <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''} text-slate-600`}>
                    <IconComp name="chevron-down" />
                </div>
            </div>

            {/* Summary Area: Dynamic Font Size */}
            <div className={`tool-summary-container px-4 py-3 bg-slate-800/20 border-t border-slate-700/30 ${isExpanded ? 'pb-1' : ''}`}>
                <div className={`result-text-dynamic flex items-start gap-3 
                    ${isExpanded ? 'result-text-small text-slate-400' : 'result-text-large'}
                    ${isSuccess ? 'text-emerald-400' : hasError ? 'text-rose-400' : 'text-slate-500 italic'}
                `}>
                    {!isExpanded && (
                        <div className="mt-1 opacity-60">
                            <IconComp name={isSuccess ? 'check' : hasError ? 'times' : 'sync-alt'} className={isPending ? 'animate-spin' : ''} />
                        </div>
                    )}
                    <span className={isExpanded ? '' : 'truncate'}>
                        {isExpanded ? (isTyping ? displayText : fullResultText) : truncatedText}
                        {isTyping && <span className="typing-cursor"></span>}
                    </span>
                </div>
            </div>

            {/* Details Area: Typing JSON and Args */}
            {isExpanded && (
                <div className="tool-block-content bg-slate-900/40 p-3 pt-0 space-y-4 animate-in fade-in duration-500">
                    <div className="space-y-2">
                        <div className="text-[9px] text-slate-600 uppercase tracking-widest font-bold flex items-center gap-1">
                            <IconComp name="stream" /> Execution Log
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono leading-relaxed bg-black/20 p-2 rounded-lg border border-white/5">
                            Status: {isSuccess ? 'SUCCESS' : hasError ? 'ERROR' : 'PENDING'}<br />
                            Timestamp: {new Date().toLocaleTimeString()}<br />
                            ID: {toolCall.id}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="text-[9px] text-slate-600 uppercase tracking-widest font-bold flex items-center gap-1">
                            <IconComp name="code" /> Arguments
                        </div>
                        <pre className="custom-scrollbar overflow-y-auto max-h-32 p-3 bg-black/40 rounded-lg text-[10px] whitespace-pre-wrap break-all text-indigo-300/60 border border-white/5 shadow-inner">
                            {JSON.stringify(toolCall.function.arguments, null, 2)}
                        </pre>
                    </div>

                    {result && (
                        <div className="space-y-2">
                            <div className={`text-[9px] uppercase tracking-widest font-bold flex items-center justify-between gap-1 ${isSuccess ? 'text-emerald-600' : 'text-rose-600'}`}>
                                <div className="flex items-center gap-1">
                                    <IconComp name={isSuccess ? 'check-double' : 'exclamation-triangle'} /> Detailed Response
                                </div>
                                {isSuccess && result.data?.engine === 'searXena' && (
                                    <div className="text-[8px] font-black text-slate-600 bg-slate-800/40 px-2 py-0.5 rounded border border-slate-800 tracking-[0.2em] animate-in fade-in slide-in-from-right-2 duration-700">
                                        POWERED BY <span className="text-blue-500/60">searXena</span>
                                    </div>
                                )}
                            </div>
                            <pre className={`custom-scrollbar overflow-y-auto max-h-60 p-3 bg-black/40 rounded-lg text-[10px] whitespace-pre-wrap break-all border transition-colors duration-500 ${isSuccess ? 'text-emerald-400/70 border-emerald-500/10' : 'text-rose-400/70 border-rose-500/10'}`}>
                                {isTyping ? displayText : JSON.stringify(result.data || result.error, null, 2)}
                                {!isTyping && !isSuccess && hasError && <span className="block mt-2 text-rose-500/50 italic font-sans">// System encountered an exception.</span>}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
