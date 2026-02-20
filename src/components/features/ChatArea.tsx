import React from 'react';
import { Message, AgentStatus, PendingToolApproval, AgentMode, ApprovalMode } from '../../types';
import { Icon, MarkdownRenderer } from '../common/Common';
import { ToolApprovalPanel } from '../panels/ToolApprovalPanel';
import { AgentStatusPanel } from '../panels/AgentStatusPanel';
import { ToolBlock } from '../common/ToolBlock';
import { CollapsibleTextBlock } from '../common/CollapsibleTextBlock';
import { CollapsibleMessage } from '../common/CollapsibleMessage';

interface ChatAreaProps {
    messages: Message[];
    isLoading: boolean;
    input: string;
    setInput: (s: string) => void;
    onSend: () => void;
    onSendAsInstruction: () => void;
    onAbort: () => void;
    onReprompt: () => void;
    onRewind: (index: number) => void;
    scrollRef: React.RefObject<HTMLDivElement | null>;
    agentStatus: AgentStatus;
    pendingApproval: PendingToolApproval | null;
    onApproveToolCall: () => void;
    onRejectToolCall: () => void;
    agentMode: AgentMode;
    onAgentModeChange: (mode: AgentMode) => void;
    safeMode: boolean;
    onSafeModeChange: (safe: boolean) => void;
    approvalMode: ApprovalMode;
    onApprovalModeChange: (mode: ApprovalMode) => void;
    debugMode: boolean;
    onDebugModeChange: (debug: boolean) => void;
    folderPermissions: Record<string, string>;
    onRequestPermission: (target: any) => void;
}

export const ChatArea = ({
    messages,
    isLoading,
    input,
    setInput,
    onSend,
    onSendAsInstruction,
    onAbort,
    onReprompt,
    scrollRef,
    agentStatus,
    pendingApproval,
    onApproveToolCall,
    onRejectToolCall,
    agentMode,
    onAgentModeChange,
    onRewind,
    safeMode,
    onSafeModeChange,
    approvalMode,
    onApprovalModeChange,
    debugMode,
    onDebugModeChange,
    folderPermissions,
    onRequestPermission,
}: ChatAreaProps) => {
    const inputRef = React.useRef<HTMLTextAreaElement>(null);

    // Auto-focus input when agent finishes
    React.useEffect(() => {
        if (!isLoading) {
            inputRef.current?.focus({ preventScroll: true });
        }
    }, [isLoading]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };

    const isAgentActive = !['idle'].includes(agentStatus.phase) && isLoading;

    // Supplemental scroll for layout changes (status panel expansion)
    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
        }, 100); // Wait bit for CSS transition to start/settle
        return () => clearTimeout(timer);
    }, [agentStatus.phase, pendingApproval]);

    return (
        <div className="flex-1 flex flex-col h-full relative bg-slate-900">
            {/* Connection Banner (Persistent Neural Link) */}
            {Object.entries(folderPermissions).some(([_, status]) => status !== 'granted') && (
                <div className="bg-amber-900/40 border-b border-amber-500/20 p-2 sm:p-3 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 animate-in slide-in-from-top duration-500 z-[110] w-full max-w-full shadow-lg">
                    <span className="text-[9px] sm:text-[11px] font-mono text-amber-200 uppercase tracking-widest flex items-center justify-center text-center gap-1.5 sm:gap-2 leading-tight w-full sm:w-auto">
                        <Icon name="exclamation-triangle" className="animate-pulse flex-shrink-0 text-[14px]" />
                        <span className="truncate whitespace-normal">Neural Link Intermittent: Local directories sleeping.</span>
                    </span>
                    <button
                        title="Otorgar permisos a todos los directorios"
                        onClick={() => {
                            Object.keys(folderPermissions).forEach(target => {
                                if (folderPermissions[target] !== 'granted') onRequestPermission(target);
                            });
                        }}
                        className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 px-4 py-1.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-tighter transition-all whitespace-nowrap flex-shrink-0 shadow-lg shadow-amber-900/20"
                    >
                        Wake Up Linkages
                    </button>
                </div>
            )}



            {/* Neural Raw Viewer (Debug Overlay) */}
            {debugMode && (
                <div className="absolute inset-0 z-[90] bg-slate-950/95 backdrop-blur-xl flex flex-col p-6 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between mb-4 border-b border-purple-500/20 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center text-purple-400 border border-purple-500/30">
                                <Icon name="vial" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Neural Debugging Interface</h3>
                                <p className="text-[10px] text-purple-400/60 font-mono">Raw Context & Internal Log Streaming</p>
                            </div>
                        </div>
                        <button onClick={() => onDebugModeChange(false)} className="text-slate-500 hover:text-white transition-colors" title="Close Debug Interface">
                            <Icon name="times" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
                        {/* Brain State Snapshot (Latest Comprehensive Log) */}
                        {(() => {
                            // Find the last assistant message that has history, or use current status if animating
                            const lastHistoryMsg = [...messages].reverse().find(m => m.rawHistory);
                            const displayHistory = (isLoading || !lastHistoryMsg) ? agentStatus.rawMessages : lastHistoryMsg.rawHistory;

                            return displayHistory?.map((m: any, i: number) => (
                                <div key={i} className="bg-black/40 border border-white/5 rounded-xl p-4 font-mono text-[11px] space-y-2">
                                    <div className={`flex items-center gap-2 font-bold uppercase tracking-wider ${m.role === 'system' ? 'text-amber-500' :
                                        m.role === 'assistant' ? 'text-blue-400' :
                                            m.role === 'tool' ? 'text-emerald-400' : 'text-purple-400'
                                        }`}>
                                        <Icon name={
                                            m.role === 'system' ? 'shield-alt' :
                                                m.role === 'assistant' ? 'brain' :
                                                    m.role === 'tool' ? 'cog' : 'user'
                                        } />
                                        [{m.role}]
                                    </div>
                                    <div className="text-slate-400 leading-relaxed whitespace-pre-wrap break-all border-l-2 border-white/10 pl-4">
                                        {m.content || '[Empty Body]'}
                                        {m.tool_calls && (
                                            <div className="mt-2 p-2 bg-blue-500/10 rounded border border-blue-500/20 text-blue-300">
                                                <strong>Tool Calls:</strong> {JSON.stringify(m.tool_calls, null, 2)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ));
                        })()}

                        {(!agentStatus.rawMessages?.length && !messages.some(m => m.rawHistory)) && (
                            <div className="h-full flex flex-col items-center justify-center opacity-30 text-slate-500 italic">
                                <Icon name="ghost" className="text-4xl mb-4" />
                                <p>No raw neural data recorded yet for this session.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar chat-area-scroll" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-40">
                        <div className="w-20 h-20 rounded-full border-2 border-slate-700 flex items-center justify-center mb-4 text-3xl">
                            <Icon name="terminal" />
                        </div>
                        <p className="font-mono text-sm">System Ready. Context Loaded.</p>
                    </div>
                )}

                {messages.map((msg, index) => {
                    const isLast = msg.id === messages[messages.length - 1]?.id;
                    const isOld = index < messages.length - 3;
                    const hasToolCall = msg.blocks?.some(b => b.type === 'tool_call');
                    const isAgentResponse = msg.role === 'assistant' && (agentMode === 'agent' || msg.text === '');

                    // [FIX] Detect success flag in blocks to avoid coloring failures as green
                    const hasFailedTool = msg.blocks?.some(b => b.type === 'tool_call' && b.result && b.result.success === false);

                    // Show placeholder only for the last loading assistant message
                    const showPlaceholder = isLast && isLoading && isAgentResponse && !hasToolCall;

                    const MessageContent = (
                        <div key={msg.id} className={`flex group relative ${msg.role === 'user' ? 'justify-end'
                            : msg.role === 'system' ? 'justify-center'
                                : 'justify-start'
                            }`}>
                            {msg.role === 'system' ? (
                                <div className="max-w-[70%] rounded-md px-3 py-2 bg-amber-900/20 border border-amber-800/30 text-amber-300/80 text-[11px] font-mono">
                                    <MarkdownRenderer content={msg.text} />
                                </div>
                            ) : (
                                <div className={`relative w-auto max-w-[95%] sm:max-w-[85%] lg:max-w-[75%] rounded-2xl p-4 sm:px-5 sm:py-4 shadow-xl transition-all duration-300 break-words ${msg.role === 'user'
                                    ? 'bg-blue-600/20 border border-blue-500/30 text-blue-50'
                                    : 'bg-slate-800 border border-slate-700 text-slate-200'
                                    }`}>

                                    {/* --- Action Bar --- */}
                                    <div className={`absolute -top-3 ${msg.role === 'user' ? 'right-4' : 'left-4'} flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10`}>
                                        {msg.role === 'user' && (
                                            <button
                                                onClick={() => onRewind(index)}
                                                className="bg-slate-800 border border-slate-700 text-amber-400 hover:text-amber-300 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-2xl"
                                                title="Editar y reiniciar chat desde este punto"
                                            >
                                                <Icon name="history" /> Edit & Rewind
                                            </button>
                                        )}
                                        {msg.role === 'assistant' && (
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(msg.text);
                                                    const btn = document.activeElement as HTMLButtonElement;
                                                    const origText = btn.innerHTML;
                                                    btn.innerHTML = 'Copied!';
                                                    setTimeout(() => btn.innerHTML = origText, 2000);
                                                }}
                                                className="bg-slate-800 border border-slate-700 text-blue-400 hover:text-blue-300 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-2xl"
                                            >
                                                <Icon name="copy" /> Copy
                                            </button>
                                        )}
                                    </div>

                                    <div className="text-[10px] font-bold opacity-30 mb-3 flex items-center justify-between uppercase tracking-[0.2em]">
                                        <div className="flex items-center gap-2">
                                            {msg.role === 'user' ? (
                                                <Icon name="user-circle" />
                                            ) : (
                                                <img src="./mikuBotICON.png" alt="Miku Core Icon" className="w-3 h-3 rounded-sm object-cover brightness-110" />
                                            )}
                                            {msg.role === 'user' ? 'Transmisor' : 'Neural Core'}
                                        </div>
                                        {msg.source === 'telegram' && (
                                            <div className="flex items-center gap-1 text-[#0088cc] font-black lowercase tracking-tighter">
                                                <Icon name="paper-plane" /> telegram
                                            </div>
                                        )}
                                    </div>

                                    {showPlaceholder ? (
                                        <div className="flex items-center gap-3 py-2 text-blue-400">
                                            <div className="w-5 h-5 rounded-full border-2 border-blue-400/20 border-t-blue-400 animate-spin" />
                                            <span className="font-mono text-xs tracking-wider animate-pulse uppercase">Analizando Parámetros...</span>
                                        </div>
                                    ) : (
                                        <div className="text-[12px] sm:text-[13px] leading-relaxed space-y-4 overflow-hidden break-words max-w-full w-full">
                                            {msg.blocks && msg.blocks.length > 0 ? (
                                                <div className="space-y-4">
                                                    {msg.blocks.map((block, idx) => {
                                                        if (block.type === 'answer') {
                                                            return <MarkdownRenderer key={idx} content={block.content} />;
                                                        } else if (block.type === 'thought' || block.type === 'text') {
                                                            const hasTools = msg.blocks.some(b => b.type === 'tool_call');
                                                            if (hasTools && !debugMode) return null;
                                                            return <CollapsibleTextBlock key={idx} content={block.content} forceCollapsed={isOld} />;
                                                        } else if (block.type === 'tool_call') {
                                                            return <ToolBlock key={idx} block={block} isOld={isOld} />;
                                                        }
                                                        return null;
                                                    })}
                                                </div>
                                            ) : (
                                                msg.text && <MarkdownRenderer content={msg.text} />
                                            )}
                                        </div>
                                    )}

                                    {msg.isStreaming && !msg.text && !showPlaceholder && (
                                        <div className="flex items-center gap-2 mt-4">
                                            {[0, 200, 400].map(ms => (
                                                <div key={ms} className={`w-1.5 h-1.5 rounded-full bg-blue-500/50 animate-bounce delay-[${ms}ms]`} />
                                            ))}
                                        </div>
                                    )}

                                    {/* Operative Reality Metadata */}
                                    {msg.role === 'assistant' && msg.provider && (
                                        <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-[9px] font-mono text-slate-500">
                                                <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700/50 text-blue-400 font-bold uppercase">
                                                    {msg.provider}
                                                </span>
                                                <span className="opacity-60">{msg.model || 'Default Model'}</span>
                                            </div>
                                            {!msg.isStreaming && (
                                                <span className="text-[9px] font-mono text-slate-600">
                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );

                    // Wrap all user/assistant messages in a collapsible container to allow manual hiding + auto-collapse
                    if (msg.role !== 'system') {
                        return (
                            <CollapsibleMessage
                                key={msg.id}
                                message={msg}
                                initiallyCollapsed={isOld}
                            >
                                {MessageContent}
                            </CollapsibleMessage>
                        );
                    }

                    return MessageContent;
                })}
                <div className="h-4" /> {/* Bottom breathing room */}
            </div>

            {pendingApproval && (
                <ToolApprovalPanel
                    pending={pendingApproval}
                    onApprove={onApproveToolCall}
                    onReject={onRejectToolCall}
                />
            )}

            <div className={`agent-status-container ${isAgentActive ? 'active' : ''}`}>
                <AgentStatusPanel
                    status={agentStatus}
                    onAbort={onAbort}
                    onReprompt={onReprompt}
                />
            </div>

            <div className="p-4 bg-slate-900 border-t border-slate-800">
                <div className="max-w-5xl mx-auto flex items-center gap-2 mb-2 flex-wrap">
                    <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Mode:</label>
                    <select
                        value={agentMode}
                        onChange={(e) => onAgentModeChange(e.target.value as AgentMode)}
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                        title="Agent mode selector"
                    >
                        <option value="chat">💬 Chat</option>
                        <option value="agent">🤖 Agent</option>
                    </select>

                    {/* Agent-only toggles: Approval Mode + Safe Mode */}
                    {agentMode === 'agent' && (
                        <>
                            <div className="w-px h-4 bg-slate-700" />

                            {/* Approval Mode Toggle */}
                            <button
                                onClick={() => onApprovalModeChange(approvalMode === 'auto' ? 'manual' : 'auto')}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider border transition-all duration-200 ${approvalMode === 'manual'
                                    ? 'bg-red-500/15 border-red-500/30 text-red-400 shadow-sm shadow-red-500/10'
                                    : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-400 hover:border-slate-600'
                                    }`}
                                title={approvalMode === 'manual'
                                    ? 'Aprobación Manual: CADA herramienta necesita tu OK'
                                    : 'Auto-Aprobación: solo operaciones peligrosas piden permiso'
                                }
                            >
                                <Icon name={approvalMode === 'manual' ? 'lock' : 'unlock'} />
                                {approvalMode === 'manual' ? 'MANUAL' : 'AUTO'}
                            </button>

                            {/* Safe Mode Toggle */}
                            <button
                                onClick={() => onSafeModeChange(!safeMode)}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider border transition-all duration-200 ${safeMode
                                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 shadow-sm shadow-amber-500/10'
                                    : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-400 hover:border-slate-600'
                                    }`}
                                title={safeMode
                                    ? 'Modo Seguro ON: herramientas se ejecutan una a la vez, con output entre cada una'
                                    : 'Modo Seguro OFF: herramientas se ejecutan en batch (más rápido)'
                                }
                            >
                                <Icon name="shield-alt" />
                                {safeMode ? 'SAFE' : 'BATCH'}
                            </button>
                        </>
                    )}

                    <span className="text-[10px] text-slate-600 font-mono hidden sm:inline-block ml-2">
                        {agentMode === 'chat'
                            ? 'Conversación libre'
                            : `${approvalMode === 'manual' ? '🔒 Manual' : '⚡ Auto'} · ${safeMode ? '🛡️ Safe' : '📦 Batch'}`
                        }
                    </span>

                    <div className="ml-auto">
                        <button
                            onClick={() => onDebugModeChange(!debugMode)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider border transition-all duration-200 ${debugMode
                                ? 'bg-purple-500/15 border-purple-500/30 text-purple-400 shadow-sm shadow-purple-500/10'
                                : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:text-slate-400 hover:border-slate-600'
                                }`}
                            title={debugMode ? "Desactivar Modo Depuración" : "Activar Modo Depuración"}
                        >
                            <Icon name="terminal" />
                            {debugMode ? 'DEBUG' : 'DEBUG'}
                        </button>
                    </div>
                </div>
                <div className="relative max-w-5xl mx-auto flex gap-2">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={agentMode === 'agent' ? 'Instrucción para el agente...' : 'Escribe un mensaje...'}
                        className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg py-3 px-4 text-slate-200 font-mono text-sm placeholder-slate-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none min-h-[50px]"
                        rows={1}
                    />
                    {isLoading ? (
                        <button
                            onClick={onAbort}
                            className="h-[50px] px-3 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors flex items-center justify-center"
                            title="Abort"
                        >
                            <Icon name="stop" />
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={onSend}
                                disabled={!input.trim()}
                                className="h-[50px] px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Enviar"
                            >
                                <Icon name="arrow-right" />
                            </button>
                            <button
                                onClick={onSendAsInstruction}
                                disabled={!input.trim()}
                                className="h-[50px] px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-bold"
                                title="Enviar como instrucción: fuerza al modelo a responder con llamada a herramienta"
                            >
                                <Icon name="bolt" />
                            </button>
                        </>
                    )}
                    {!isLoading && agentStatus.iteration > 0 && agentStatus.phase !== 'idle' && (
                        <button
                            onClick={onReprompt}
                            className="h-[50px] px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors flex items-center justify-center"
                            title="Continuar"
                        >
                            <Icon name="redo" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
