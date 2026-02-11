import React from 'react';
import { Message, AgentStatus, PendingToolApproval, AgentMode } from '../types';
import { Icon, MarkdownRenderer } from './Common';
import { ToolApprovalPanel } from './ToolApprovalPanel';
import { AgentStatusPanel } from './AgentStatusPanel';
import { ToolBlock } from './ToolBlock';
import { CollapsibleTextBlock } from './CollapsibleTextBlock';

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
}: ChatAreaProps) => {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };

    const isAgentActive = !['idle'].includes(agentStatus.phase) && isLoading;

    return (
        <div className="flex-1 flex flex-col h-full relative bg-slate-900">
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar" ref={scrollRef}>
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

                    // Show placeholder only for the last loading assistant message in agent mode if no tool has been seen yet
                    const showPlaceholder = isLast && isLoading && isAgentResponse && !hasToolCall;

                    return (
                        <div key={msg.id} className={`flex group relative ${msg.role === 'user' ? 'justify-end'
                            : msg.role === 'system' ? 'justify-center'
                                : 'justify-start'
                            }`}>
                            {msg.role === 'system' ? (
                                <div className="max-w-[70%] rounded-md px-3 py-2 bg-amber-900/20 border border-amber-800/30 text-amber-300/80 text-[11px] font-mono">
                                    <MarkdownRenderer content={msg.text} />
                                </div>
                            ) : (
                                <div className={`relative max-w-[85%] lg:max-w-[70%] rounded-2xl px-5 py-4 shadow-xl transition-all duration-300 ${msg.role === 'user'
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

                                    <div className="text-[10px] font-bold opacity-30 mb-3 flex items-center gap-2 uppercase tracking-[0.2em]">
                                        <Icon name={msg.role === 'user' ? 'user-circle' : 'brain'} />
                                        {msg.role === 'user' ? 'Transmisor' : 'Neural Core'}
                                    </div>

                                    {showPlaceholder ? (
                                        <div className="flex items-center gap-3 py-2 text-blue-400">
                                            <div className="w-5 h-5 rounded-full border-2 border-blue-400/20 border-t-blue-400 animate-spin" />
                                            <span className="font-mono text-xs tracking-wider animate-pulse uppercase">Analizando Parámetros...</span>
                                        </div>
                                    ) : (
                                        <div className="text-[13px] leading-relaxed">
                                            {msg.blocks && msg.blocks.length > 0 ? (
                                                <div className="space-y-4">
                                                    {msg.blocks.map((block, idx) => {
                                                        if (block.type === 'text') {
                                                            return <CollapsibleTextBlock key={idx} content={block.content} forceCollapsed={isOld} />;
                                                        } else {
                                                            return <ToolBlock key={idx} block={block} isOld={isOld} />;
                                                        }
                                                    })}
                                                </div>
                                            ) : (
                                                <CollapsibleTextBlock content={msg.text} forceCollapsed={isOld} />
                                            )}
                                        </div>
                                    )}

                                    {msg.isStreaming && !msg.text && !showPlaceholder && (
                                        <div className="flex items-center gap-2 mt-4">
                                            {[0, 2, 4].map(delay => (
                                                <div key={delay} className="w-1.5 h-1.5 rounded-full bg-blue-500/50 animate-bounce" style={{ animationDelay: `${delay / 10}s` }} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
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
                <div className="max-w-5xl mx-auto flex items-center gap-2 mb-2">
                    <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Mode:</label>
                    <select
                        value={agentMode}
                        onChange={(e) => onAgentModeChange(e.target.value as AgentMode)}
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                        <option value="chat">💬 Chat</option>
                        <option value="agent">🤖 Agent</option>
                    </select>
                    <span className="text-[10px] text-slate-600 font-mono">
                        {agentMode === 'chat' ? 'Conversación libre, sin herramientas' : 'Agente autónomo, ejecuta herramientas'}
                    </span>
                </div>
                <div className="relative max-w-5xl mx-auto flex gap-2">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={agentMode === 'agent' ? 'Instrucción para el agente...' : 'Escribe un mensaje...'}
                        className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg py-3 px-4 text-slate-200 font-mono text-sm placeholder-slate-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                        rows={1}
                        style={{ minHeight: '50px' }}
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
