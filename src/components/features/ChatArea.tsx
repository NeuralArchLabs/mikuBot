import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Message, AgentStatus, PendingToolApproval, AgentMode, ApprovalMode, Attachment } from '../../types';
import { Icon, MarkdownRenderer } from '../common/Common';
import { ToolApprovalPanel } from '../panels/ToolApprovalPanel';
import { AgentStatusPanel } from '../panels/AgentStatusPanel';
import { ToolBlock } from '../common/ToolBlock';
import { CollapsibleTextBlock } from '../common/CollapsibleTextBlock';
import { CollapsibleMessage } from '../common/CollapsibleMessage';
import { TypewriterIdle } from '../common/TypewriterIdle';

interface ChatAreaProps {
    sessionId: string;
    messages: Message[];
    isLoading: boolean;
    input: string;
    setInput: (s: string) => void;
    onSend: (attachments: Attachment[]) => void;
    onSendAsInstruction: (attachments: Attachment[]) => void;
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
    onWakeUpAll: () => void;
    askAlert: (message: string, position?: 'left' | 'right' | 'center') => Promise<void>;
    voskModelPath?: string;
    userName?: string;
    assistantAlias?: string;
}

export const ChatArea = ({
    sessionId,
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
    onWakeUpAll,
    askAlert,
    voskModelPath,
    userName,
    assistantAlias
}: ChatAreaProps) => {
    const { t } = useTranslation();
    const inputRef = React.useRef<HTMLTextAreaElement>(null);
    const [isSent, setIsSent] = React.useState(false);
    const [boltGlow, setBoltGlow] = React.useState(false);
    const [isRecording, setIsRecording] = React.useState(false);
    const [partialText, setPartialText] = React.useState('');

    const [attachments, setAttachments] = React.useState<Attachment[]>([]);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const audioCtxRef = React.useRef<AudioContext | null>(null);
    const streamRef = React.useRef<MediaStream | null>(null);
    const processorRef = React.useRef<ScriptProcessorNode | null>(null);


    const handleSend = () => {
        if (isRecording) {
            toggleRecording(); // Detener grabación al enviar
        }
        setIsSent(true);
        onSend(attachments);
        setAttachments([]);
        setTimeout(() => setIsSent(false), 700);
    };

    const handleSendAsInstruction = () => {
        if (isRecording) {
            toggleRecording(); // Detener grabación al enviar
        }
        setBoltGlow(true);
        setIsSent(true);
        // Delay slightly to show the glow before sending (and triggering isLoading)
        setTimeout(() => {
            onSendAsInstruction(attachments);
            setAttachments([]);
            setBoltGlow(false);
            setTimeout(() => setIsSent(false), 700);
        }, 300);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const files = Array.from(e.target.files) as File[];
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64Content = event.target?.result as string;
                // Remove data:image/png;base64, prefix if you want raw base64, but keeping it is fine for preview
                setAttachments(prev => [...prev, {
                    id: Date.now().toString() + Math.random().toString(),
                    name: file.name,
                    type: file.type,
                    data: base64Content
                }]);
            };
            // Read as data URL to easily preview and send
            reader.readAsDataURL(file);
        });
        e.target.value = ''; // Reset input
    };

    const handleRemoveAttachment = (id: string) => {
        setAttachments(prev => prev.filter(a => a.id !== id));
    };

    // Auto-focus input when agent finishes
    React.useEffect(() => {
        if (!isLoading) {
            inputRef.current?.focus({ preventScroll: true });
        }
    }, [isLoading]);

    React.useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !e.altKey && !e.shiftKey && !e.ctrlKey) {
                if (isLoading) {
                    onAbort();
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [isLoading, onAbort]);

    React.useEffect(() => {
        if (!(window as any).electron) return;

        const cleanupResult = (window as any).electron.onVoiceRecognitionResult((data: any) => {
            if (data.final) {
                const currentInput = (inputRef.current as any)?.value || "";
                const separator = currentInput.trim() ? ' ' : '';
                setInput(currentInput.trim() + separator + data.text);
                setPartialText('');
            } else {
                setPartialText(data.text);
            }
        });

        const cleanupError = (window as any).electron.onVoiceRecognitionError((data: any) => {
            askAlert(t('chat.alerts.voice_error', { error: data.error }));
            setIsRecording(false);
            setPartialText('');
            stopCapture();
        });

        const cleanupReady = (window as any).electron.onVoiceEngineReady(() => {
            console.log('[Voice] Engine ready event received. Starting capture.');
            startCapture();
        });

        return () => {
            cleanupResult();
            cleanupError();
            cleanupReady();
            stopCapture();
        };
    }, []);

    const stopCapture = () => {
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (audioCtxRef.current) {
            audioCtxRef.current.close().catch(() => { });
            audioCtxRef.current = null;
        }
    };

    const startCapture = async () => {
        try {
            stopCapture();
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            streamRef.current = stream;

            // Vosk espera 16000Hz PCM 16bit mono
            const context = new AudioContext({ sampleRate: 16000 });
            audioCtxRef.current = context;

            const source = context.createMediaStreamSource(stream);
            // ScriptProcessor es más compatible que AudioWorklet para un fix rápido
            const processor = context.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
                const input = e.inputBuffer.getChannelData(0);
                const pcm16 = new Int16Array(input.length);
                for (let i = 0; i < input.length; i++) {
                    pcm16[i] = Math.max(-1, Math.min(1, input[i])) * 0x7FFF;
                }
                (window as any).electron.sendAudioChunk(pcm16.buffer);
            };

            source.connect(processor);
            processor.connect(context.destination);
        } catch (err: any) {
            console.error('[Voice] Capture Error:', err);
            askAlert(t('chat.alerts.mic_error', { error: err.message }));
            setIsRecording(false);
        }
    };

    const toggleRecording = async () => {
        if (!(window as any).electron) return;

        if (isRecording) {
            await (window as any).electron.stopVoiceRecognition();
            setIsRecording(false);
            setPartialText('');
            stopCapture();
        } else {
            if (!voskModelPath) {
                await askAlert(t('chat.alerts.no_voice_model'));
                return;
            }
            const res = await (window as any).electron.startVoiceRecognition({ modelName: voskModelPath });
            if (res.ok) {
                setIsRecording(true);
            } else {
                await askAlert(t('chat.alerts.voice_start_error', { error: res.error }));
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (e.altKey) {
                e.preventDefault();
                if (input.trim() || attachments.length > 0) {
                    handleSendAsInstruction();
                }
            } else if (!e.shiftKey) {
                e.preventDefault();

                const hasContent = input.trim() || attachments.length > 0;
                const canReprompt = !isLoading && agentStatus.iteration > 0 && agentStatus.phase !== 'idle';

                if (!hasContent && canReprompt) {
                    onReprompt();
                } else if (hasContent) {
                    handleSend();
                }
            }
        }
    };

    const handleCopyAllLogs = () => {
        const lastHistoryMsg = [...messages].reverse().find(m => m.rawHistory);
        const displayHistory = (isLoading || !lastHistoryMsg) ? agentStatus.rawMessages : lastHistoryMsg.rawHistory;

        if (!displayHistory) return;

        const text = displayHistory.map((m: any) => {
            let content = `[${t(`chat.labels.role_${m.role}`).toUpperCase()}]\n${m.content || ''}`;
            if (m.tool_calls) content += `\n[${t('chat.labels.tool_calls').toUpperCase()}]\n${JSON.stringify(m.tool_calls, null, 2)}`;
            if (m.tool_call_id) content += `\n[${t('chat.labels.tool_call_id').toUpperCase()}]: ${m.tool_call_id}`;
            return content;
        }).join('\n\n' + '='.repeat(60) + '\n\n');

        navigator.clipboard.writeText(text);
        askAlert(t('chat.alerts.logs_copied'), 'right');
    };

    const isAgentActive = !['idle'].includes(agentStatus.phase) && isLoading;

    // Responsive Auto-scroll logic: ensures the view stays at bottom during streaming or phase changes
    React.useEffect(() => {
        if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            // Detect if user is near bottom or if it's a new user message
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 250;
            const isNewMessage = messages.length > 0 && messages[messages.length - 1].isStreaming === false;

            if (isNearBottom || isNewMessage) {
                // Large timeout or requestAnimationFrame to ensure DOM is ready
                const timer = setTimeout(() => {
                    if (scrollRef.current) {
                        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                    }
                }, 50);
                return () => clearTimeout(timer);
            }
        }
    }, [messages, agentStatus.phase, pendingApproval]);

    return (
        <div className="flex-1 flex flex-col h-full relative">
            {/* Connection Banner (Persistent Neural Link) */}
            {Object.entries(folderPermissions).some(([_, status]) => status !== 'granted') && (
                <div className="bg-amber-900/40 border-b border-amber-500/20 p-2 sm:p-3 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 animate-in slide-in-from-top duration-500 z-[110] w-full max-w-full shadow-lg">
                    <span className="text-[9px] sm:text-[11px] font-mono text-amber-200 uppercase tracking-widest flex items-center justify-center text-center gap-1.5 sm:gap-2 leading-tight w-full sm:w-auto">
                        <Icon name="exclamation-triangle" className="animate-pulse flex-shrink-0 text-[14px]" />
                        <span className="truncate whitespace-normal">{t('chat.labels.link_intermittent')}</span>
                    </span>
                    <button
                        title={t('chat.labels.wake_up')}
                        onClick={onWakeUpAll}
                        className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 px-4 py-1.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-tighter transition-all whitespace-nowrap flex-shrink-0 shadow-lg shadow-amber-900/20"
                    >
                        {t('chat.labels.wake_up')}
                    </button>
                </div>
            )}



            {/* Neural Raw Viewer (Debug Overlay) */}
            {debugMode && (
                <div className="absolute inset-0 z-[90] bg-slate-950/95 backdrop-blur-md flex flex-col p-6 animate-in fade-in zoom-in-95 duration-300 transform-gpu">
                    <div className="flex items-center justify-between mb-4 border-b border-purple-500/20 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center text-purple-400 border border-purple-500/30">
                                <Icon name="vial" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-widest">{t('chat.labels.debug_interface')}</h3>
                                <p className="text-[10px] text-purple-400/60 font-mono">{t('chat.labels.debug_desc')}</p>
                            </div>
                        </div>
                        <div className="ml-auto flex items-center gap-3">
                            <button
                                onClick={handleCopyAllLogs}
                                className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 px-3 py-1.5 rounded-lg border border-purple-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-all"
                                title={t('chat.actions.copy_logs')}
                            >
                                <Icon name="copy" /> {t('chat.actions.copy_logs')}
                            </button>
                            <button
                                onClick={() => onDebugModeChange(false)}
                                className="text-slate-500 hover:text-white transition-colors p-2"
                                title={t('chat.actions.close_debug')}
                            >
                                <Icon name="times" />
                            </button>
                        </div>
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
                                        [{t(`chat.labels.role_${m.role}`)}]
                                        {m.timestamp && (
                                            <span className="ml-auto opacity-30 font-normal text-[9px] tabular-nums">
                                                {new Date(m.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-slate-400 leading-relaxed whitespace-pre-wrap break-all border-l-2 border-white/10 pl-4">
                                        {m.content || t('chat.labels.empty_body')}
                                        {m.tool_calls && (
                                            <div className="mt-2 p-2 bg-blue-500/10 rounded border border-blue-500/20 text-blue-300">
                                                <strong>{t('chat.labels.tool_calls')}:</strong> {JSON.stringify(m.tool_calls, null, 2)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ));
                        })()}

                        {(!agentStatus.rawMessages?.length && !messages.some(m => m.rawHistory)) && (
                            <div className="h-full flex flex-col items-center justify-center opacity-30 text-slate-500 italic">
                                <Icon name="ghost" className="text-4xl mb-4" />
                                <p>{t('chat.labels.no_data')}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div
                key={sessionId}
                className="flex-1 overflow-y-auto p-4 custom-scrollbar chat-area-scroll chat-fade-mask relative animate-chat flex flex-col transform-gpu"
                ref={scrollRef}
            >
                <div className="flex-1" />
                <div className="space-y-6 w-full">
                    {messages.length === 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-20">
                            <div className="w-20 h-20 rounded-full border-2 border-blue-500/15 flex items-center justify-center mb-6 text-3xl text-blue-500/20">
                                <Icon name="terminal" />
                            </div>
                            <TypewriterIdle />
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
                                    <div className={`max-w-[70%] rounded-md px-3 py-2 text-[11px] font-mono border ${msg.isScheduler
                                        ? (msg.isScheduledResponse
                                            ? 'bg-indigo-900/20 border-indigo-500/30 text-indigo-300'
                                            : 'bg-orange-900/20 border-orange-500/30 text-orange-300')
                                        : 'bg-amber-900/20 border-amber-800/30 text-amber-300/80'
                                        }`}>
                                        <MarkdownRenderer content={msg.text} />
                                    </div>
                                ) : (
                                    <div className={`relative w-auto max-w-[98%] sm:max-w-[90%] lg:max-w-[80%] p-5 sm:px-8 sm:py-6 shadow-xl transition-all duration-300 break-words message-pop-in transform-gpu rounded-2xl ${msg.role === 'user'
                                        ? 'bg-blue-600/20 border border-transparent group-hover:border-blue-500/30 text-blue-50 rounded-br-none'
                                        : 'bg-slate-800 border border-transparent group-hover:border-slate-700 text-slate-200 rounded-bl-none'
                                        }`}>

                                        {/* --- Action Bar --- */}
                                        <div className={`absolute -top-3 ${msg.role === 'user' ? 'right-4' : 'left-4'} flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10`}>
                                            {msg.role === 'user' && (
                                                <button
                                                    onClick={() => onRewind(index)}
                                                    className="bg-slate-800 border border-slate-700 text-amber-400 hover:text-amber-300 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-2xl"
                                                    title={t('chat.actions.rewind')}
                                                >
                                                    <Icon name="history" /> {t('chat.actions.rewind')}
                                                </button>
                                            )}
                                            {msg.role === 'assistant' && (
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(msg.text);
                                                        const btn = document.activeElement as HTMLButtonElement;
                                                        const origText = btn.innerHTML;
                                                        btn.innerHTML = t('chat.actions.copied');
                                                        setTimeout(() => btn.innerHTML = origText, 2000);
                                                    }}
                                                    className="bg-slate-800 border border-slate-700 text-blue-400 hover:text-blue-300 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-2xl"
                                                >
                                                    <Icon name="copy" /> {t('chat.actions.copy')}
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
                                                {msg.role === 'user' ? (userName || 'User') : (assistantAlias || 'Miku Core')}
                                                
                                                {!msg.isStreaming && (
                                                    <span className="opacity-60 lowercase tracking-tighter flex items-center gap-1 ml-1 border-l border-white/10 pl-2">
                                                        <Icon name="clock" className="text-[8px]" />
                                                        {new Date(msg.timestamp).toLocaleString(undefined, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '')}
                                                    </span>
                                                )}
                                            </div>
                                            {msg.source === 'telegram' && (
                                                <div className="flex items-center gap-1 text-[#0088cc] font-black lowercase tracking-tighter">
                                                    <Icon name="paper-plane" /> {t('chat.labels.telegram')}
                                                </div>
                                            )}
                                        </div>

                                        {showPlaceholder ? (
                                            <div className="flex items-center gap-3 py-2 text-blue-400">
                                                <div className="w-5 h-5 rounded-full border-2 border-blue-400/20 border-t-blue-400 animate-spin" />
                                                <span className="font-mono text-xs tracking-wider animate-pulse uppercase">{t('chat.placeholders.analyzing')}</span>
                                            </div>
                                        ) : (
                                            <div className="text-[13px] sm:text-[14px] leading-loose space-y-5 overflow-hidden break-words max-w-full w-full px-2 sm:px-4 py-2">
                                                {msg.attachments && msg.attachments.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mb-3">
                                                        {msg.attachments.map(att => (
                                                            <div key={att.id} className="relative group bg-slate-800 border border-slate-700 rounded-lg p-2 flex items-center gap-2 max-w-[200px]">
                                                                {att.type.startsWith('image/') ? (
                                                                    <img src={att.data} alt={att.name} className="h-16 w-auto object-contain rounded" />
                                                                ) : (
                                                                    <Icon name="file-alt" className="text-slate-400 text-lg" />
                                                                )}
                                                                <span className="text-xs text-slate-300 truncate flex-1">{att.name}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {msg.blocks && msg.blocks.length > 0 ? (
                                                    <div className="space-y-4 mb-4">
                                                        {msg.blocks.map((block, idx) => {
                                                            if (block.type === 'answer') {
                                                                return <MarkdownRenderer key={idx} content={block.content} />;
                                                            } else if (block.type === 'thought' || block.type === 'text') {
                                                                const hasTools = msg.blocks!.some(b => b.type === 'tool_call');
                                                                const forceCollapse = isOld || (hasTools && !debugMode) || block.type === 'thought';
                                                                return <CollapsibleTextBlock key={idx} content={block.content} forceCollapse={forceCollapse} isThought={block.type === 'thought'} />;
                                                            } else if (block.type === 'tool_call') {
                                                                return <ToolBlock key={idx} block={block} isOld={isOld} />;
                                                            }
                                                            return null;
                                                        })}
                                                    </div>
                                                ) : (
                                                    msg.text && (
                                                        <MarkdownRenderer content={msg.text} />
                                                    )
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
                                                    <span className="opacity-60">{msg.model || t('chat.labels.default_model')}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );

                        // Wrap all user/assistant/scheduler messages in a collapsible container
                        if (msg.role !== 'system' || msg.isScheduler) {
                            return (
                                <CollapsibleMessage
                                    key={msg.id}
                                    message={msg}
                                    initiallyCollapsed={msg.isInitiallyCollapsed ?? isOld}
                                >
                                    {MessageContent}
                                </CollapsibleMessage>
                            );
                        }

                        return MessageContent;
                    })}
                    <div className="h-4" /> {/* Bottom breathing room */}
                </div>
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

            <div className="p-4 bg-slate-900/40 border-t border-slate-800/50">
                <div className="max-w-5xl mx-auto flex items-center gap-2 mb-2 flex-wrap">
                    <button
                        onClick={() => onAgentModeChange(agentMode === 'chat' ? 'agent' : 'chat')}
                        className="flex items-center justify-center gap-1.5 px-2 h-6 min-w-[70px] rounded text-[10px] font-mono font-bold uppercase tracking-wider border transition-all duration-200 bg-slate-800/50 border-transparent hover:text-slate-300 hover:border-slate-600 active:scale-95 text-slate-500"
                        title={t('chat.actions.toggle_mode')}
                    >
                        <Icon name="sliders-h" />
                        {t('chat.labels.mode')}
                    </button>
                    <div className="relative">
                        <select
                            value={agentMode}
                            onChange={(e) => onAgentModeChange(e.target.value as AgentMode)}
                            className="bg-slate-800 border border-transparent hover:border-slate-700 rounded px-2 pr-10 py-1 text-xs text-slate-300 font-mono focus:ring-1 focus:ring-blue-500 outline-none transition-all duration-200 appearance-none"
                            title={t('chat.actions.mode_selector')}
                        >
                            <option value="chat">💬 {t('chat.modes.chat')}</option>
                            <option value="agent">🤖 {t('chat.modes.agent')}</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 scale-75">
                            <Icon name="chevron-down" />
                        </div>
                    </div>

                    {/* Agent-only toggles: Approval Mode + Safe Mode */}
                    <div className={`mode-transition-wrap ${agentMode === 'agent' ? 'visible-mode agent-options-enter' : 'hidden-mode agent-options-exit'}`}>
                        <div className="flex items-center gap-2">
                            <div className="w-px h-4 bg-slate-700" />

                            {/* Approval Mode Toggle */}
                            <button
                                onClick={() => onApprovalModeChange(approvalMode === 'auto' ? 'manual' : 'auto')}
                                className={`flex items-center justify-center gap-1.5 px-2 h-6 min-w-[75px] rounded text-[10px] font-mono font-bold uppercase tracking-wider border transition-all duration-200 ${approvalMode === 'manual'
                                    ? 'bg-blue-500/15 border-transparent hover:border-blue-500/30 text-blue-400 shadow-sm shadow-blue-500/10'
                                    : 'bg-amber-500/15 border-transparent hover:border-amber-500/30 text-amber-400 shadow-sm shadow-amber-500/10'
                                    }`}
                                title={approvalMode === 'manual'
                                    ? t('chat.actions.manual_approval_desc')
                                    : t('chat.actions.auto_approval_desc')
                                }
                            >
                                <Icon name={approvalMode === 'manual' ? 'lock' : 'unlock'} className="icon-pulse" />
                                {approvalMode === 'manual' ? t('chat.actions.manual') : t('chat.actions.auto')}
                            </button>

                            {/* Safe Mode Toggle */}
                            <button
                                onClick={() => onSafeModeChange(!safeMode)}
                                className={`flex items-center justify-center gap-1.5 px-2 h-6 min-w-[75px] rounded text-[10px] font-mono font-bold uppercase tracking-wider border transition-all duration-200 ${safeMode
                                    ? 'bg-blue-500/15 border-transparent hover:border-blue-500/30 text-blue-400 shadow-sm shadow-blue-500/10'
                                    : 'bg-amber-500/15 border-transparent hover:border-amber-500/30 text-amber-400 shadow-sm shadow-amber-500/10'
                                    }`}
                                title={safeMode
                                    ? t('chat.actions.safe_mode_on_desc')
                                    : t('chat.actions.safe_mode_off_desc')
                                }
                            >
                                {safeMode ? <Icon name="shield-alt" className="icon-pulse" /> : <span className="font-black tracking-tighter mr-0.5 animate-pulse">{'>>>'}</span>}
                                {safeMode ? t('chat.actions.safe') : t('chat.actions.batch')}
                            </button>
                        </div>
                    </div>

                    <span className="text-[10px] text-slate-600 font-mono hidden sm:inline-block ml-2">
                        {agentMode === 'chat'
                            ? t('chat.labels.free_conversation')
                            : `${approvalMode === 'manual' ? '🔒 ' + t('chat.actions.manual') : '⚡ ' + t('chat.actions.auto')} · ${safeMode ? '💠 ' + t('chat.actions.safe') : '📦 ' + t('chat.actions.batch')}`
                        }
                    </span>

                    <div className="ml-auto">
                        <button
                            onClick={() => onDebugModeChange(!debugMode)}
                            className={`flex items-center justify-center gap-1.5 px-2 h-6 min-w-[75px] rounded text-[10px] font-mono font-bold uppercase tracking-wider border transition-all duration-200 ${debugMode
                                ? 'bg-purple-500/15 border-transparent hover:border-purple-500/30 text-purple-400 shadow-sm shadow-purple-500/10'
                                : 'bg-slate-800/50 border-transparent hover:text-slate-400 hover:border-slate-600 text-slate-500'
                                }`}
                            title={debugMode ? t('chat.actions.disable_debug') : t('chat.actions.enable_debug')}
                        >
                            <Icon name="terminal" />
                            {t('chat.actions.debug')}
                        </button>
                    </div>
                </div>
                <div className="relative max-w-5xl mx-auto flex flex-col gap-2">
                <div className="flex items-center"> {/* Removed gap-2 to handle spacing via mx-1 and fix phantom gaps from hidden elements */}
                        {/* Attachments Preview (Left) */}
                        {attachments.length > 0 && (
                            <div className="flex gap-2 pb-1">
                                {attachments.map(att => (
                                    <div key={att.id} className="relative group bg-slate-800 border border-slate-700 rounded-lg p-1 flex items-center justify-center w-10 h-10 shadow-sm">
                                        {att.type.startsWith('image/') ? (
                                            <img src={att.data} alt={att.name} className="w-full h-full object-cover rounded-md" />
                                        ) : (
                                            <Icon name="file-alt" className="text-slate-400 text-[16px]" />
                                        )}
                                        <button
                                            onClick={() => handleRemoveAttachment(att.id)}
                                            className="absolute -top-1.5 -right-1.5 bg-red-500/90 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center w-4 h-4 shadow-sm"
                                            title={t('chat.actions.remove_attachment')}
                                            aria-label={t('chat.actions.remove_attachment')}
                                        >
                                            <Icon name="times" className="text-[8px]" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* File Input (Hidden) & Trigger (Left of textarea) */}
                        <div className={`mode-transition-wrap mx-1 ${!isLoading ? 'visible-mode' : 'hidden-mode'}`}>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                multiple
                                accept="image/png, image/jpeg, image/webp"
                                title={t('chat.actions.select_files')}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="h-[50px] w-[50px] bg-slate-800/40 border border-transparent hover:text-slate-200 hover:bg-slate-700/60 hover:border-slate-700/50 rounded-xl flex items-center justify-center transition-all duration-300 shadow-lg shadow-black/20 text-slate-400"
                                title={t('chat.actions.attach')}
                            >
                                <Icon name="plus" className="text-lg" />
                            </button>
                        </div>

                        <div className="relative flex-1 group/input flex items-center mx-1">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={isRecording ? (partialText || t('chat.placeholders.recording')) : (agentMode === 'agent' ? t('chat.placeholders.agent') : t('chat.placeholders.idle'))}
                                className={`w-full bg-slate-900/60 backdrop-blur-sm border rounded-xl py-3.5 px-4 text-slate-200 font-mono text-sm placeholder-slate-600 focus:ring-1 outline-none resize-none min-h-[50px] transition-all duration-300 ${isRecording
                                    ? 'border-emerald-500/50 ring-1 ring-emerald-500/20 pr-32'
                                    : 'border-slate-800/60 focus:ring-cyan-500/30 focus:border-cyan-500/40 pr-16'
                                    }`}
                                rows={1}
                            />
                            {isRecording && (
                                <div className="absolute right-12 flex items-center gap-2 px-2.5 py-1 bg-slate-950/80 backdrop-blur-md rounded-full border border-emerald-500/30 animate-pulse pointer-events-none shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-[0.15em]">{t('chat.placeholders.live_rec')}</span>
                                </div>
                            )}

                            {/* Voice Button Overlay (Right side of textarea) */}
                            <button
                                onClick={toggleRecording}
                                className={`absolute right-2 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${isRecording
                                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/40'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                    }`}
                                title={isRecording ? t('chat.actions.stop_record') : t('chat.actions.record')}
                            >
                                <Icon name={isRecording ? "stop" : "microphone"} className={isRecording ? 'text-[10px]' : 'text-lg'} />
                            </button>
                        </div>

                        {/* Abort Group (Active when Loading) */}
                        <div className={`mode-transition-wrap mx-1 ${isLoading ? 'visible-mode action-enter' : 'hidden-mode action-exit'}`}>
                            <button
                                onClick={onAbort}
                                className={`h-[50px] px-4 btn-abort-premium text-white rounded-xl flex items-center justify-center min-w-[50px] shadow-lg shadow-red-900/20 ${agentStatus.isInstructionMode ? 'btn-halo-abort' : ''}`}
                                title={t('chat.actions.abort')}
                            >
                                <span key={isLoading ? 'loading' : 'idle'} className="inline-block">
                                    <Icon name="stop" className={isLoading ? 'icon-stop-spin' : 'icon-spin-reverse'} />
                                </span>
                            </button>
                        </div>

                        {/* Send/Instruction Group (Active when Idle) */}
                        <div className={`flex items-center ${agentMode !== 'agent' ? 'gap-2' : ''} mode-transition-wrap mx-1 ${!isLoading ? 'visible-mode action-enter' : 'hidden-mode action-exit'}`}>
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() && attachments.length === 0}
                                className={`h-[50px] px-4 rounded-xl flex items-center justify-center min-w-[50px] disabled:opacity-30 disabled:cursor-not-allowed btn-send-morph shadow-lg ${agentMode === 'agent' ? 'is-agent shadow-purple-900/20' : 'is-chat shadow-blue-900/20'}`}
                                title={t('chat.actions.send')}
                            >
                                {/* Background Clipping Layer */}
                                <div className="btn-send-morph-bg">
                                    {/* Base Layer: Standard Chat Color (Blue) */}
                                    <div className="btn-send-morph-blue" />

                                    {/* Ripple Layer: Instruction Color (Purple) - Grows or Shrinks */}
                                    <div
                                        key={agentMode}
                                        className="btn-send-morph-purple"
                                    />
                                </div>

                                {/* Rainbow Aura (Expanding wave) */}
                                <div
                                    key={`aura-${agentMode}`}
                                    className={`btn-morph-aura ${agentMode !== 'agent' ? 'reverse' : ''}`}
                                />

                                <Icon name="arrow-right" className={`text-lg ${isSent ? 'send-icon-fly' : ''} ${agentMode === 'agent' ? 'rainbow-icon' : ''}`} />
                            </button>

                            <div className={`transition-all duration-500 ${agentMode !== 'agent' ? 'w-[50px] opacity-100' : 'w-0 opacity-0 overflow-hidden'} mode-transition-wrap ${agentMode !== 'agent' ? 'visible-mode instruction-enter' : 'hidden-mode instruction-exit'}`}>
                                <button
                                    onClick={handleSendAsInstruction}
                                    disabled={!input.trim() && attachments.length === 0}
                                    className={`h-[50px] px-4 w-full btn-instruction-premium text-white rounded-xl flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed text-[10px] font-bold shadow-lg shadow-purple-900/20 ${boltGlow ? 'pulse-glow' : ''}`}
                                    title={t('chat.actions.send_instruction_desc')}
                                >
                                    <Icon name="bolt" className={`text-lg ${boltGlow ? 'instruction-bolt-glow' : (isSent ? 'icon-pulse' : '')}`} />
                                </button>
                            </div>
                        </div>

                        {!isLoading && agentStatus.iteration > 0 && agentStatus.phase !== 'idle' && (
                            <button
                                onClick={onReprompt}
                                className="h-[50px] px-4 btn-continue-premium text-white rounded-xl flex items-center justify-center min-w-[50px] shadow-lg shadow-orange-900/20 mx-1"
                                title={t('chat.actions.resume_task')}
                            >
                                <Icon name="redo" className="icon-spin-once text-lg" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
