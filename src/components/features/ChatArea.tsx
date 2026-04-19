import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Message, AgentStatus, PendingToolApproval, AgentMode, ApprovalMode, Attachment, AppConfig, Provider, ModelInfo } from '../../types';
import { Icon, MarkdownRenderer } from '../common/Common';
import { ToolApprovalPanel } from '../panels/ToolApprovalPanel';
import { AgentStatusPanel } from '../panels/AgentStatusPanel';
import { ToolBlock, CORE_TOOLS } from '../common/ToolBlock';
import { CollapsibleMessage } from '../common/CollapsibleMessage';
import { CollapsibleTextBlock } from '../common/CollapsibleTextBlock';
import { TypewriterIdle } from '../common/TypewriterIdle';
import { useAgentStore, selectInput, selectMessages, selectAgentStatus, selectIsLoading, selectIsViewing, selectPendingToolApproval, selectExecutingSessionId } from '../../stores/useAgentStore';
import { persistence, VisionService } from '../../services';

interface ChatAreaProps {
    sessionId: string;
    onSend: (attachments: Attachment[]) => void;
    onSendAsInstruction: (attachments: Attachment[]) => void;
    onAbort: () => void;
    onReprompt: () => void;
    onRewind: (index: number) => void;
    scrollRef: React.RefObject<HTMLDivElement | null>;
    onApproveToolCall: (feedback?: string) => void;
    onRejectToolCall: (feedback?: string) => void;
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
    sessions?: any[];
    onSessionsUpdate?: (sessions: any[] | ((prev: any[]) => any[])) => void;
    config: AppConfig;
    models: Record<Provider, ModelInfo[]>;
}

const ChatInputControls = React.memo(({
    isRecording, partialText, agentMode, isLoading, isViewing, executingSessionId, currentSessionId, agentIteration, agentPhase, agentIsInstructionMode, attachments, t,
    inputRef, fileInputRef,
    toggleRecording, onAbort, handleSend, handleSendAsInstruction, onReprompt, handleNativeFileSelect, handleRemoveAttachment, boltGlow, isSent, safeMode, approvalMode, debugMode, onDebugModeChange
}: any) => {
    // Character-level isolation: Use local state for typing to avoid global store overhead on every keystroke.
    const globalInput = useAgentStore(selectInput);
    const setGlobalInput = useAgentStore(state => state.setInput);
    const [localInput, setLocalInput] = useState(globalInput);

    // Sync local input with store when global input changes (e.g. session swap, clear)
    useEffect(() => {
        setLocalInput(globalInput);
    }, [globalInput]);

    // Debounced sync to store for "Draft" persistence
    useEffect(() => {
        const timer = setTimeout(() => {
            if (localInput !== globalInput) {
                setGlobalInput(localInput);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [localInput, globalInput, setGlobalInput]);

    // ✨ DYNAMIC HEIGHT ENGINE v1.1 - Premium Auto-Expansion with Viewing Guard
    useEffect(() => {
        const textarea = inputRef.current;
        if (textarea) {
            if (isViewing) {
                // Force minimum height during analysis to prevent UI takeover
                textarea.style.height = '50px';
                textarea.style.overflowY = 'auto';
            } else {
                // Reset height to calculate correctly
                textarea.style.height = 'auto';
                const newHeight = Math.max(Math.min(textarea.scrollHeight, 200), 50);
                textarea.style.height = `${newHeight}px`;
                
                // Toggle scrollbar only when reaching max height
                textarea.style.overflowY = textarea.scrollHeight > 200 ? 'auto' : 'hidden';
            }
        }
    }, [localInput, inputRef, isViewing]);

    const handleSendWithSync = () => {
        setGlobalInput(localInput); // Ensure store is up to date before sending
        setTimeout(handleSend, 0);
    };

    const handleSendAsInstructionWithSync = () => {
        setGlobalInput(localInput);
        setTimeout(handleSendAsInstruction, 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (e.altKey) {
                e.preventDefault();
                if (localInput.trim() || attachments.length > 0) {
                    handleSendAsInstructionWithSync();
                }
            } else if (!e.shiftKey) {
                e.preventDefault();

                const hasContent = localInput.trim() || attachments.length > 0;
                const canReprompt = !isLoading && agentIteration >= 0 && (agentPhase === 'aborted' || agentPhase === 'error');

                if (!hasContent && canReprompt) {
                    onReprompt();
                } else if (hasContent) {
                    handleSendWithSync();
                }
            }
        }
    };

    return (
        <div className="relative max-w-5xl mx-auto h-[50px]">
            {/* Absolute positioning wrapper to grow UPWARDS without pushing history */}
            <div className="absolute bottom-0 left-0 right-0 flex flex-col pointer-events-none z-50">
                {/* Attachments Preview (Left) - Non-interactive area should allow click-through if needed, but buttons inside should work */}
                <div className="flex items-end pointer-events-auto">
                {/* Attachments Preview (Left) */}
                {attachments.length > 0 && (
                    <div className="flex gap-2 pb-1">
                        {attachments.map((att: any) => (
                            <div key={att.id} className="relative group bg-slate-800 border border-slate-700 rounded-lg p-1 flex items-center justify-center w-10 h-10 shadow-sm">
                                {att.type.startsWith('image/') ? (
                                    <>
                                        <div className="relative w-full h-full rounded-md overflow-hidden">
                                            <img src={att.data} alt={att.name} className={`w-full h-full object-cover transition-all duration-500 ${att.isAnalyzing ? 'blur-[1px] brightness-50' : ''}`} />
                                            {att.isAnalyzing && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="absolute inset-0 bg-emerald-500/20 animate-pulse" />
                                                    <Icon name="eye" className="text-emerald-400 text-xs animate-bounce" />
                                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 shadow-[0_0_10px_#10b981] animate-scan-fast" />
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center gap-0.5">
                                        <Icon 
                                            name={
                                                att.name.endsWith('.pdf') ? "file-pdf" : 
                                                att.name.endsWith('.json') || att.name.endsWith('.yaml') || att.name.endsWith('.yml') ? "file-code" :
                                                "file-alt"
                                            } 
                                            className={`text-[16px] ${
                                                att.name.endsWith('.pdf') ? "text-rose-400" : 
                                                att.name.endsWith('.json') ? "text-amber-400" :
                                                "text-slate-400"
                                            }`} 
                                        />
                                        <span className="text-[6px] uppercase font-bold text-slate-500 truncate max-w-[32px]">{att.name.split('.').pop()}</span>
                                    </div>
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

                {/* File Selection Trigger (Left of textarea) */}
                <div className={`mode-transition-wrap mx-1 ${(!isLoading && !isViewing) ? 'visible-mode' : 'hidden-mode'}`}>
                    <button
                        onClick={async () => {
                            if (!(window as any).electron) return;
                            const result = await (window as any).electron.selectFiles();
                            if (result && !result.canceled && result.filePaths.length > 0) {
                                handleNativeFileSelect(result.filePaths);
                            }
                        }}
                        className="h-[50px] w-[50px] bg-slate-800/20 backdrop-blur-md border border-dashed border-slate-700/30 hover:text-slate-200 hover:bg-slate-700/40 hover:border-slate-500/50 rounded-xl flex items-center justify-center transition-all duration-300 shadow-lg shadow-black/10 text-slate-500 hover:text-slate-400 group-hover:border-slate-500/30"
                        title={t('chat.actions.attach')}
                    >
                        <Icon name="plus" className="text-lg" />
                    </button>
                </div>

                <div className="relative flex-1 group/input flex items-end mx-1 pointer-events-auto">
                    <textarea
                        ref={inputRef}
                        value={localInput}
                        onChange={(e) => setLocalInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isRecording ? (partialText || t('chat.placeholders.recording')) : (agentMode === 'agent' ? t('chat.placeholders.agent') : t('chat.placeholders.idle'))}
                        className={`w-full bg-slate-900/80 backdrop-blur-xl border rounded-xl py-3.5 px-4 text-slate-200 font-mono text-sm placeholder-slate-600 focus:ring-1 outline-none resize-none min-h-[50px] transition-[border-color,box-shadow,padding-right] duration-300 chat-input-scrollbar ${isRecording
                            ? 'border-emerald-500/50 ring-1 ring-emerald-500/20'
                            : 'border-slate-800/60 focus:ring-cyan-500/30 focus:border-cyan-500/40 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.5)]'
                            } pr-12`}
                        rows={1}
                        disabled={isViewing}
                        style={{ opacity: isViewing ? 0.4 : 1 }}
                    />
                    {isRecording && (
                        <div className="absolute right-12 top-[-16px] flex items-center gap-2.5 px-3 py-1.5 bg-emerald-950/80 backdrop-blur-xl rounded-full border border-emerald-500/40 pointer-events-none shadow-[0_-5px_20px_rgba(16,185,129,0.15)] transition-all duration-500 ease-out z-20">
                            <div className="relative flex items-center justify-center">
                                <div className="absolute w-2 h-2 rounded-full bg-emerald-500/40 animate-ping" />
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                            </div>
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em] leading-none drop-shadow-sm">
                                {t('chat.placeholders.live_rec')}
                            </span>
                        </div>
                    )}

                    {/* Voice Button Overlay (Right side of textarea) */}
                     <button
                        onClick={toggleRecording}
                        className={`absolute bottom-2.5 right-2 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${isRecording
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/40'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                            }`}
                        title={isRecording ? t('chat.actions.stop_record') : t('chat.actions.record')}
                    >
                        <Icon name={isRecording ? "stop" : "microphone"} className={isRecording ? 'text-[10px]' : 'text-lg'} />
                    </button>
                </div>

                {/* Abort Group (Active when Loading in THIS session) */}
                <div className={`mode-transition-wrap mx-1 ${isLoading && currentSessionId === executingSessionId ? 'visible-mode action-enter' : 'hidden-mode action-exit'} pointer-events-auto`}>
                    <button
                        onClick={onAbort}
                        className={`h-[50px] px-4 btn-abort-premium text-white rounded-xl flex items-center justify-center min-w-[50px] shadow-lg shadow-red-900/20 ${agentIsInstructionMode ? 'btn-halo-abort' : ''}`}
                        title={t('chat.actions.abort')}
                    >
                        <span key={isLoading ? 'loading' : 'idle'} className="inline-block">
                            <Icon name="stop" className={isLoading ? 'icon-stop-spin' : 'icon-spin-reverse'} />
                        </span>
                    </button>
                </div>

                {/* Send/Instruction Group (Active when Idle) */}
                <div className={`flex items-end ${agentMode !== 'agent' ? 'gap-2' : ''} mode-transition-wrap mx-1 ${!isLoading ? 'visible-mode action-enter' : 'hidden-mode action-exit'} pointer-events-auto`}>
                    <button
                        onClick={handleSendWithSync}
                        disabled={isViewing || (!localInput.trim() && attachments.length === 0)}
                        className={`h-[50px] px-4 text-white rounded-xl flex items-center justify-center min-w-[50px] disabled:opacity-30 disabled:cursor-not-allowed btn-send-morph shadow-lg ${agentMode === 'agent' ? 'is-agent shadow-purple-900/20' : 'is-chat shadow-blue-900/20'}`}
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

                        <div className={isSent ? 'send-icon-fly' : ''}>
                            <Icon name="paper-plane" className={`text-lg transition-transform duration-300 ${agentMode === 'agent' ? 'rainbow-icon' : ''} rotate-45 -ml-2 p-[2px] -m-[2px] icon-shadow-premium`} />
                        </div>
                    </button>

                    <div className={`transition-all duration-500 ${agentMode !== 'agent' ? 'w-[50px] opacity-100' : 'w-0 opacity-0 overflow-hidden'} mode-transition-wrap ${agentMode !== 'agent' ? 'visible-mode instruction-enter' : 'hidden-mode instruction-exit'} pointer-events-auto`}>
                        <button
                            onClick={handleSendAsInstructionWithSync}
                            disabled={isViewing || (!localInput.trim() && attachments.length === 0)}
                            className={`h-[50px] px-4 w-full btn-instruction-premium text-white rounded-xl flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed text-[10px] font-bold shadow-lg shadow-purple-900/20 ${boltGlow ? 'pulse-glow' : ''}`}
                            title={t('chat.actions.send_instruction_desc')}
                        >
                            <Icon name="bolt" className={`text-lg icon-shadow-premium ${boltGlow ? 'instruction-bolt-glow' : (isSent ? 'icon-pulse' : '')}`} />
                        </button>
                    </div>
                </div>

                {!isLoading && (agentIteration > 0 || agentPhase === 'aborted' || agentPhase === 'error') && agentPhase !== 'idle' && (
                    <button
                        onClick={onReprompt}
                        className="h-[50px] px-4 btn-continue-premium text-white rounded-xl flex items-center justify-center min-w-[50px] shadow-lg shadow-orange-900/20 mx-1 pointer-events-auto"
                        title={t('chat.actions.resume_task')}
                    >
                        <Icon name="redo" className="icon-spin-once text-lg icon-shadow-premium" />
                    </button>
                )}
                </div>
            </div>
        </div>
    );
});

export const ChatArea = ({
    sessionId,
    onSend,
    onSendAsInstruction,
    onAbort,
    onReprompt,
    scrollRef,
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
    assistantAlias,
    sessions,
    onSessionsUpdate,
    config,
    models
}: ChatAreaProps) => {
    const { t, i18n } = useTranslation();

    // High-frequency UI isolation: Subscribing locally to the store nodes.
    const messages = useAgentStore(selectMessages);
    const agentStatus = useAgentStore(selectAgentStatus);
    const isLoading = useAgentStore(selectIsLoading);
    const isViewing = useAgentStore(selectIsViewing);
    const pendingApproval = useAgentStore(selectPendingToolApproval);
    const executingSessionId = useAgentStore(selectExecutingSessionId);

    const isExecutingThisSession = !executingSessionId || executingSessionId === sessionId;

    // ── SESSION LOAD GUARD ──────────────────────────────────────────
    // Prevents auto-save from firing with mixed state during session switches.
    // When sessionId changes, there's a window where Zustand has updated messages
    // but React hasn't updated sessionId yet — saving in this window would
    // write the NEW session's messages to the OLD session's file (data corruption).
    const skipSaveRef = useRef(false);
    const prevSessionIdRef = useRef(sessionId);
    if (sessionId !== prevSessionIdRef.current) {
        prevSessionIdRef.current = sessionId;
        skipSaveRef.current = true;
    }

    // [Performance Fix] Session Auto-saver moved here from App.tsx.
    // ── SESSION SAVE GUARD ──
    // On session switch, there's a race: Zustand updates `messages` immediately but
    // React's `sessionId` prop updates in the next render. This creates a frame where
    // new messages are paired with the old sessionId. Without the guard, the cleanup
    // function would save new messages to the old session → data corruption.
    // skipSaveRef is set to true when sessionId changes, preventing the first save
    // after a switch. It's cleared in the cleanup so the next cycle can save normally.
    useEffect(() => {
        // Skip save during session loading (guard set by sessionId change detection above)
        if (skipSaveRef.current) {
            skipSaveRef.current = false;
            return;
        }

        if (sessionId && sessions && onSessionsUpdate) {
            const timer = setTimeout(() => {
                const currentSession = sessions.find(s => s.id === sessionId);
                const firstRealMsg = messages.find(m => !m.excludeFromContext && m.role === 'user');
                const candidateContent = firstRealMsg?.text?.slice(0, 30);

                const isDefaultTitle = !currentSession?.title ||
                    currentSession.title === t('common.new_neural_branch') ||
                    currentSession.title === t('common.active_session') ||
                    (candidateContent && currentSession.title === candidateContent);

                const title = isDefaultTitle
                    ? (candidateContent || currentSession?.title || t('common.new_neural_branch'))
                    : (currentSession?.title || t('common.new_neural_branch'));

                persistence.saveSession({
                    id: sessionId,
                    title,
                    messages,
                    timestamp: Date.now(),
                    agentMode,
                    safeMode,
                    approvalMode,
                    debugMode,
                    draft: useAgentStore.getState().input
                });

                onSessionsUpdate(prev => prev.map(s =>
                    s.id === sessionId
                        ? {
                            ...s,
                            title,
                            messageCount: messages.filter(m => !m.excludeFromContext).length,
                            lastModified: Date.now()
                        }
                        : s
                ));
            }, 1000);
            return () => {
                clearTimeout(timer);
                // Flush: save immediately on unmount or dependency change.
                // ⚡ CRITICAL FIX: Use closure-captured `messages` instead of reading from the
                // global store. During session switches, React processes the cleanup AFTER the
                // store has been replaced with the new session's messages. Reading from the store
                // would save Session B's messages to Session A's file → data corruption.
                // The closure's `messages` is guaranteed to be the value from when this effect
                // was set up, which belongs to the correct session.
                const msgs = messages;
                if (sessionId && msgs.length > 0) {
                    const sess = sessions?.find(s => s.id === sessionId);
                    const firstMsg = msgs.find(m => !m.excludeFromContext && m.role === 'user');
                    const cand = firstMsg?.text?.slice(0, 30);
                    const isDef = !sess?.title ||
                        sess.title === t('common.new_neural_branch') ||
                        sess.title === t('common.active_session') ||
                        (cand && sess.title === cand);
                    const ttl = isDef
                        ? (cand || sess?.title || t('common.new_neural_branch'))
                        : (sess?.title || t('common.new_neural_branch'));
                    persistence.saveSession({
                        id: sessionId, title: ttl, messages: msgs,
                        timestamp: Date.now(), agentMode, safeMode, approvalMode, debugMode,
                        draft: useAgentStore.getState().input,
                    });
                }
            };
        }
    }, [messages, sessionId, agentMode, safeMode, approvalMode, debugMode, sessions, onSessionsUpdate, t]);
    const inputRef = React.useRef<HTMLTextAreaElement>(null);
    const [isSent, setIsSent] = React.useState(false);

    // ⚡ STREAM BUFFER: Logic to prevent high-frequency re-renders (prevents whole app lag)
    const chunkBufferRef = useRef<string>('');
    const lastUpdateMsRef = useRef<number>(0);

    // ✨ SELECTIVE EXPANSION ENGINE v1.1
    // Prioritizes interaction focus by auto-collapsing legacy context.
    // Keeps only the last 2 interactions per role expanded by default.
    const priorityIndices = useMemo(() => {
        const userIndices = messages.map((m, i) => m.role === 'user' ? i : -1).filter(i => i !== -1).slice(-2);
        const assistantIndices = messages.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i !== -1).slice(-2);
        return [...userIndices, ...assistantIndices];
    }, [messages]);
    const [boltGlow, setBoltGlow] = React.useState(false);
    const [isRecording, setIsRecording] = React.useState(false);
    const [partialText, setPartialText] = React.useState('');

    const [attachments, setAttachments] = React.useState<Attachment[]>([]);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const pendingSendRef = React.useRef<{ type: 'send' | 'instruction' } | null>(null);

    const audioCtxRef = React.useRef<AudioContext | null>(null);
    const streamRef = React.useRef<MediaStream | null>(null);
    const processorRef = React.useRef<ScriptProcessorNode | null>(null);


    const handleSend = () => {
        if (isRecording) {
            toggleRecording();
        }
        // Deferred send: if any attachment is still being analyzed, queue the send
        if (attachments.some(a => a.isAnalyzing)) {
            pendingSendRef.current = { type: 'send' };
            useAgentStore.getState().setIsViewing(true);
            setIsSent(true);
            setTimeout(() => setIsSent(false), 700);
            return;
        }
        setIsSent(true);
        onSend(attachments);
        setAttachments([]);
        setTimeout(() => setIsSent(false), 700);
    };

    const handleSendAsInstruction = () => {
        if (isRecording) {
            toggleRecording();
        }
        // Deferred send: if any attachment is still being analyzed, queue the send
        if (attachments.some(a => a.isAnalyzing)) {
            pendingSendRef.current = { type: 'instruction' };
            useAgentStore.getState().setIsViewing(true);
            setBoltGlow(true);
            setIsSent(true);
            setTimeout(() => { setBoltGlow(false); setIsSent(false); }, 700);
            return;
        }
        setBoltGlow(true);
        setIsSent(true);
        setTimeout(() => {
            onSendAsInstruction(attachments);
            setAttachments([]);
            setBoltGlow(false);
            setTimeout(() => setIsSent(false), 700);
        }, 300);
    };

    const handleNativeFileSelect = async (filePaths: string[]) => {
        if (!(window as any).electron) return;
        
        for (const filePath of filePaths) {
            try {
                // 1. Get visual data (pre-loading preview)
                const fileInfo = await (window as any).electron.readFileData(filePath);
                if (!fileInfo.ok) {
                    console.error(`[Native Selection] Failed to read file data for ${filePath}:`, fileInfo.error);
                    continue;
                }

                let extractedContent: string | undefined = undefined;
                const attachmentId = Date.now().toString() + Math.random().toString();

                // 2. Vision Runtime Phase (Vortex Visual)
                // Determine the effective model that will handle this message
                const activeProvider = (agentMode === 'agent' && config.agentProvider && config.agentModel)
                    ? config.agentProvider
                    : (config.chatProvider && config.chatModel)
                        ? config.chatProvider
                        : config.provider;

                const activeModel = (agentMode === 'agent' && config.agentProvider && config.agentModel)
                    ? config.agentModel
                    : (config.chatProvider && config.chatModel)
                        ? config.chatModel
                        : config.model;

                // Vortex activates ONLY when configured with a DIFFERENT model than the active runtime.
                // If the vision model is the same as chat/agent, we skip the extra API call
                // and let the image flow natively through the main multimodal pipeline.
                const isVortexDistinct = config.visionProvider && config.visionModel
                    && !(config.visionProvider === activeProvider && config.visionModel === activeModel);

                const isImage = fileInfo.type.startsWith('image/');

                if (isImage && isVortexDistinct) {
                    // Create pending attachment with analyzing state
                    setAttachments(prev => [...prev, {
                        id: attachmentId,
                        name: fileInfo.name,
                        type: fileInfo.type,
                        data: fileInfo.data,
                        isAnalyzing: true
                    }]);

                    // Perform background analysis
                    VisionService.describeImage(config, fileInfo.data, fileInfo.type, models)
                        .then(description => {
                            setAttachments(prev => prev.map(a => 
                                a.id === attachmentId 
                                    ? { ...a, extractedContent: description, isAnalyzing: false } 
                                    : a
                            ));
                        })
                        .catch(err => {
                            console.error('[Vision Runtime] Analysis failed:', err);
                            setAttachments(prev => prev.map(a => 
                                a.id === attachmentId 
                                    ? { ...a, isAnalyzing: false } 
                                    : a
                            ));
                        });
                    
                    continue; // Skip the standard extractor phase for this image as we just handled it
                }

                // 3. Standard Extractor Phase (for non-images or native mode)
                if (!isImage) {
                    try {
                        const result = await (window as any).electron.extractFileContent({ path: filePath });
                        if (result.ok && result.data.success) {
                            extractedContent = result.data.content;
                            console.log(`[Universal Extraction] Success for ${fileInfo.name} (${result.data.type})`);
                        } else {
                            console.warn(`[Universal Extraction] Native extraction failed for ${fileInfo.name}:`, result.error || result.data?.error);
                            // Fallback for simple text files since we have the path now
                            if (fileInfo.type.startsWith('text/') || fileInfo.name.match(/\.(ts|tsx|js|jsx|json|md|py|c|cpp|h|rs|go|ps1)$/i)) {
                                // Already have the Base64 in fileInfo.data, but extraction is usually cleaner.
                                // If extraction failed, we use the original content if possible.
                            }
                        }
                    } catch (err) {
                        console.error(`[Universal Extraction] Critical error extracting ${fileInfo.name}:`, err);
                    }
                }

                setAttachments(prev => {
                    const newAttachment = {
                        id: attachmentId,
                        name: fileInfo.name,
                        type: fileInfo.type,
                        // Clear binary data for non-images after extraction to save RAM
                        data: fileInfo.type.startsWith('image/') ? fileInfo.data : undefined,
                        extractedContent: extractedContent
                    };
                    return [...prev, newAttachment];
                });

            } catch (err) {
                console.error(`[Native Selection] Error processing ${filePath}:`, err);
            }
        }
    };

    const handleRemoveAttachment = (id: string) => {
        setAttachments(prev => prev.filter(a => a.id !== id));
    };

    // ⚡ DEFERRED SEND: Fire the queued send when vision analysis completes
    React.useEffect(() => {
        if (!pendingSendRef.current) return;
        if (attachments.some(a => a.isAnalyzing)) return;

        // All attachments done analyzing — execute the queued send
        const pendingType = pendingSendRef.current.type;
        pendingSendRef.current = null;
        useAgentStore.getState().setIsViewing(false);

        if (pendingType === 'instruction') {
            onSendAsInstruction(attachments);
        } else {
            onSend(attachments);
        }
        setAttachments([]);
    }, [attachments, onSend, onSendAsInstruction]);

    // Auto-focus input when session changes or agent finishes
    React.useEffect(() => {
        if (!isLoading) {
            inputRef.current?.focus({ preventScroll: true });
        }
    }, [isLoading, sessionId]);

    // 👁️ Auto-scroll to viewing bubble when Vision Runtime activates
    React.useEffect(() => {
        if (isViewing) {
            setTimeout(() => {
                const bubble = document.getElementById('vision-viewing-bubble');
                bubble?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }, [isViewing]);

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

        const offStream = (window as any).electron.onApiStreamChunk((data: any) => {
            const { streamId, chunk, done } = data;
            const { messages, updateMessageContent, updateMessageStreaming } = useAgentStore.getState();
            
            // Check if this stream update belongs to the current session context
            if (streamId !== sessionId) return;

            const lastMsg = messages[messages.length - 1];
            if (!lastMsg || lastMsg.role !== 'assistant' || !lastMsg.isStreaming) return;

            if (done) {
                // ⚡ FINAL FLUSH: Commit remaining buffer before ending stream
                if (chunkBufferRef.current) {
                    updateMessageContent(lastMsg.id, lastMsg.text + chunkBufferRef.current);
                    chunkBufferRef.current = '';
                }
                updateMessageStreaming(lastMsg.id, false);
                lastUpdateMsRef.current = 0;
                return;
            }

            if (chunk) {
                // Accumulate in high-performance buffer
                chunkBufferRef.current += chunk;

                const now = Date.now();
                // 🎯 PARAGRAPH-LEVEL FLUSH: Only push to store when complete paragraphs arrive.
                // The renderer uses append-only DOM updates — it never re-renders existing content.
                // By flushing only at paragraph boundaries, each flush produces clean HTML blocks
                // that can be safely appended without any flicker.
                const buffer = chunkBufferRef.current;

                // Paragraph boundary: complete block-level unit, safe to flush
                const endsParagraph = /\n\s*\n\s*$/.test(buffer);
                // Safety timeout: push whatever we have after 1.5s to prevent UI feeling frozen
                // (handles single-paragraph responses that never hit \n\n)
                const elapsed = now - lastUpdateMsRef.current;

                if (endsParagraph || elapsed >= 1500) {
                    const latestContent = lastMsg.text + chunkBufferRef.current;
                    updateMessageContent(lastMsg.id, latestContent);
                    chunkBufferRef.current = '';
                    lastUpdateMsRef.current = now;
                }
            }
        });

        const cleanupResult = (window as any).electron.onVoiceRecognitionResult((data: any) => {
            if (data.final) {
                const currentInput = useAgentStore.getState().input || "";
                const separator = currentInput.trim() ? ' ' : '';
                useAgentStore.getState().setInput(currentInput.trim() + separator + data.text);
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
            offStream();
            cleanupResult();
            cleanupError();
            cleanupReady();
            stopCapture();
        };
    }, [sessionId, t, voskModelPath]);

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

    const isAgentActive = !['idle'].includes(agentStatus.phase) && isLoading && isExecutingThisSession;
    const lastMessageIdRef = React.useRef<string | null>(null);
    const [isAnchoring, setIsAnchoring] = React.useState(false);
    const lockedScrollTopRef = React.useRef<number | null>(null);

    // 🎯 LOCK TARGET: When set, syncScroll targets this element instead of the whole message.
    // Used after tool use to lock on the narrative block rather than the message wrapper.
    const lockTargetRef = React.useRef<string | null>(null);

    // 🔧 DYNAMIC BLOCK-AWARE LOCKING: Track blocks to reset lock on new text after tools
    const lastBlocksRef = React.useRef<any[]>([]);
    const lastBlockCountRef = React.useRef(0);
    const lastBlockTypeRef = React.useRef<string | null>(null);

    // [Performance Fix] Scroll Logic — Naive auto-scroll for non-streaming state changes.
    // GUARD: Skip during streaming or when lock is active — the lock engine handles those cases.
    useEffect(() => {
        if (!scrollRef.current || messages.length === 0) return;
        const lastMsg = messages[messages.length - 1];
        if (isAnchoring || lastMsg?.isStreaming) return;
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, isLoading, pendingApproval, agentStatus.phase, scrollRef]);

    // 🖱️ HUMAN INTERACTION SENSORS: Only break the lock on PHYSICAL input
    React.useEffect(() => {
        const container = scrollRef.current;
        if (!container || messages.length === 0) return;

        const breakLock = () => {
            const lastMsg = messages[messages.length - 1];
            // 🛡️ INDESTRUCTIBLE LOCK: Only allow manual release AFTER the stream ends
            if (isAnchoring && lastMsg && !lastMsg.isStreaming) {
                setIsAnchoring(false);
                lockedScrollTopRef.current = null;
            }
        };

        // Listen for actual human intent, ignoring programmatic scrolls
        container.addEventListener('wheel', breakLock, { passive: true });
        container.addEventListener('touchmove', breakLock, { passive: true });
        container.addEventListener('mousedown', breakLock, { passive: true });

        return () => {
            container.removeEventListener('wheel', breakLock);
            container.removeEventListener('touchmove', breakLock);
            container.removeEventListener('mousedown', breakLock);
        };
    }, [isAnchoring, messages]);

    // [SCROLL ENGINE] Physical Interaction Lock for Streaming
    React.useEffect(() => {
        if (!scrollRef.current || messages.length === 0) return;

        const lastMsg = messages[messages.length - 1];
        const scrollContainer = scrollRef.current;
        const LOCK_MARGIN = 28; // Standard spacing for icon/header visibility

        // 🔄 AUTO-UNLOCK ON NEW TURN: Release lock if it's a completely new message
        if (isAnchoring && lastMessageIdRef.current && lastMessageIdRef.current !== lastMsg.id) {
            setIsAnchoring(false);
            lockedScrollTopRef.current = null;
            lockTargetRef.current = null;
            lastMessageIdRef.current = lastMsg.id;
            return;
        }

        lastMessageIdRef.current = lastMsg.id;

        // --- PHASE 1: Detection & Precision Positioning ---
        const syncScroll = () => {
            if (!scrollRef.current) return;
            const container = scrollRef.current;
            const lastMsg = messages[messages.length - 1];
            if (!lastMsg) return;

            // 🎯 Use lock target if set (for block-aware locking after tools), otherwise use message element
            const targetEl = lockTargetRef.current
                ? document.getElementById(lockTargetRef.current)
                : document.getElementById(`msg-${lastMsg.id}`);
            if (!targetEl) return;

            const bannerEl = document.querySelector('.folder-permission-banner');
            const bannerHeight = bannerEl ? (bannerEl as HTMLElement).offsetHeight : 0;
            const containerRect = container.getBoundingClientRect();
            const boundaryTop = containerRect.top + bannerHeight + LOCK_MARGIN;

            // 🎯 BOUNDARY-AWARE CALCULATION: idealScrollTop places the target at boundaryTop
            const targetRect = targetEl.getBoundingClientRect();
            const idealScrollTop = container.scrollTop + (targetRect.top - boundaryTop);

            if (isAnchoring) {
                // 🔒 RECALCULATE FROM DOM: Handles layout shifts (status bar, resize) automatically.
                // No stored absolute value — we derive the correct position every tick.
                container.scrollTop = idealScrollTop;
            } else if (lastMsg.isStreaming) {
                const blocks = lastMsg.blocks || [];
                const lastBlock = blocks[blocks.length - 1];
                const isToolActive = lastBlock?.type === 'tool_call';

                if (isToolActive) {
                    // 🔧 TOOL MODE: Follow freely to bottom so user sees tool execution
                    const maxBottom = container.scrollHeight - container.clientHeight;
                    container.scrollTop = maxBottom;
                } else {
                    // 🚀 SOFT-BRAKE FOLLOW: Follow bottom, but never past the ideal lock point
                    const maxBottom = container.scrollHeight - container.clientHeight;
                    const nextScroll = Math.min(maxBottom, idealScrollTop);

                    container.scrollTop = nextScroll;

                    // Permanent Lock Engagement: Once we hit the ideal point, cement it
                    if (nextScroll >= idealScrollTop - 1) {
                        setIsAnchoring(true);
                    }
                }
            }
        };

        if (lastMsg.isStreaming || isAnchoring) {
            syncScroll();
            // 🔄 CONTINUOUS LOOP: Keeps correcting during CSS transitions (status bar 0.4s),
            // layout shifts, and DOM growth. Throttled to ~10fps when not streaming to save CPU.
            let active = true;
            let lastTick = 0;
            const tick = (time: number) => {
                if (!active) return;
                const interval = lastMsg.isStreaming ? 0 : 100; // Full speed during streaming, 10fps when locked
                if (time - lastTick >= interval) {
                    syncScroll();
                    lastTick = time;
                }
                requestAnimationFrame(tick);
            };
            const frameId = requestAnimationFrame(tick);
            return () => { active = false; cancelAnimationFrame(frameId); };
        }

        // --- PHASE 3: Standard Auto-scroll (Fallback for User/System) ---
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
        const isUserMsg = lastMsg.role === 'user';

        if ((isNearBottom || isUserMsg) && !lastMsg.isStreaming) {
            const timer = setTimeout(() => {
                if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [messages, agentStatus.phase, pendingApproval, isAnchoring, isAgentActive]);

    // 🔧 DYNAMIC BLOCK-AWARE LOCKING: Detect block transitions during streaming
    // - When tool_call blocks appear: release lock so user can see tools
    // - When narrative appears after tools: set lock target, let syncScroll handle lock engagement
    React.useEffect(() => {
        if (messages.length === 0 || !scrollRef.current) return;

        const lastMsg = messages[messages.length - 1];
        const currentBlocks = lastMsg.blocks || [];

        // Skip if no blocks or not an assistant message
        if (currentBlocks.length === 0 || lastMsg.role !== 'assistant') {
            lastBlocksRef.current = currentBlocks;
            lastBlockCountRef.current = currentBlocks.length;
            return;
        }

        const prevBlocks = lastBlocksRef.current;
        const prevBlockCount = lastBlockCountRef.current;

        // Update refs for next comparison
        lastBlocksRef.current = currentBlocks;
        lastBlockCountRef.current = currentBlocks.length;

        // 🔧 DETECT: New block added
        if (currentBlocks.length > prevBlockCount) {
            const newBlockIndex = currentBlocks.length - 1;
            const newBlock = currentBlocks[newBlockIndex];
            const prevLastBlockType = prevBlocks.length > 0 ? prevBlocks[prevBlocks.length - 1]?.type : null;

            const narrativeTypes = ['answer', 'thought', 'text'];

            if (newBlock.type === 'tool_call' && isAnchoring) {
                // 🔧 TOOL APPEARED: Release lock so user can see tool execution
                setIsAnchoring(false);
                lockedScrollTopRef.current = null;
                lockTargetRef.current = null;
            }

            if (prevLastBlockType === 'tool_call' && narrativeTypes.includes(newBlock.type)) {
                // 🔧 NARRATIVE AFTER TOOLS: Release lock, set target to the new narrative block.
                // syncScroll will follow it and engage lock naturally when it reaches the viewport top.
                setIsAnchoring(false);
                lockedScrollTopRef.current = null;
                lockTargetRef.current = `block-${lastMsg.id}-${newBlockIndex}`;
            }

            lastBlockTypeRef.current = newBlock.type;
        }

        // 🔧 DETECT: Content growth in last narrative block after tool_call
        if (currentBlocks.length === prevBlockCount && prevBlocks.length > 0 && !lockTargetRef.current) {
            const lastBlock = currentBlocks[currentBlocks.length - 1];
            const prevLastBlock = prevBlocks[prevBlocks.length - 1];

            const narrativeTypes = ['answer', 'thought', 'text'];
            const isNarrative = narrativeTypes.includes(lastBlock.type);
            const prevWasTool = prevBlocks.some(b => b.type === 'tool_call');

            if (isNarrative && prevWasTool && lastBlock.content !== prevLastBlock.content) {
                const hasSeenThisNarrativeBefore = prevBlocks.some(
                    (b, i) => i > 0 && prevBlocks[i - 1]?.type === 'tool_call' &&
                    narrativeTypes.includes(b.type)
                );

                if (!hasSeenThisNarrativeBefore) {
                    // Set lock target without engaging lock — syncScroll handles engagement
                    setIsAnchoring(false);
                    lockedScrollTopRef.current = null;
                    lockTargetRef.current = `block-${lastMsg.id}-${currentBlocks.length - 1}`;
                }
            }
        }
    }, [messages, isAnchoring]);

    return (
        <div className="flex-1 flex flex-col h-full relative contain-layout">
            {/* Connection Banner (Persistent Neural Link) */}
            {Object.entries(folderPermissions).some(([_, status]) => status !== 'granted') && (
                <div className="folder-permission-banner bg-amber-900/40 border-b border-amber-500/20 p-2 sm:p-3 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 animate-in slide-in-from-top duration-500 z-[110] w-full max-w-full shadow-lg">
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
                                    <div className={`text-slate-400 leading-relaxed font-mono border-l-2 border-white/10 pl-4 overflow-hidden ${m.role === 'tool' ? 'bg-black/30 rounded-r-lg py-2' : ''}`}>
                                        <div className="max-h-[450px] overflow-y-auto custom-scrollbar pr-2 whitespace-pre-wrap break-all text-[10px]">
                                            {(m.thought || m.reasoning_content || m.reasoning) && (
                                                <div className="mb-3 p-3 bg-fuchsia-500/5 rounded border border-fuchsia-500/20 text-fuchsia-300/80 italic text-[9px]">
                                                    <div className="flex items-center gap-2 mb-1 opacity-60">
                                                        <Icon name="brain" />
                                                        <strong>[{t('chat.labels.active_reasoning')?.toUpperCase() || 'ACTIVE REASONING'}]</strong>
                                                    </div>
                                                    {m.thought || m.reasoning_content || m.reasoning}
                                                </div>
                                            )}
                                            {Array.isArray(m.content) 
                                                ? m.content.map((c: any, ci: number) => (
                                                    <div key={ci} className="mb-2">
                                                        {c.type === 'text' && c.text}
                                                        {c.type === 'thinking' && (
                                                            <div className="mb-2 p-3 bg-fuchsia-500/5 rounded border border-fuchsia-500/20 text-fuchsia-300/80 italic text-[9px]">
                                                                <div className="flex items-center gap-2 mb-1 opacity-60">
                                                                    <Icon name="brain" />
                                                                    <strong>[{t('chat.labels.active_reasoning')?.toUpperCase() || 'ACTIVE REASONING'}]</strong>
                                                                </div>
                                                                {c.thinking}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                                : (m.content || (m.role === 'tool' && m.error ? m.error : t('chat.labels.empty_body')))
                                            }
                                        </div>
                                        {m.tool_calls && (
                                            <div className="mt-2 p-2 bg-blue-500/10 rounded border border-blue-500/20 text-blue-300/80 text-[10px]">
                                                <div className="flex items-center gap-2 mb-1 opacity-60">
                                                    <Icon name="cog" />
                                                    <strong>{t('chat.labels.tool_calls')?.toUpperCase()}:</strong>
                                                </div>
                                                <pre className="whitespace-pre-wrap break-all opacity-80">{JSON.stringify(m.tool_calls, null, 2)}</pre>
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

            {config.chatBackgroundImage && (
                <div className="absolute inset-0 pointer-events-none z-0 transition-opacity duration-500"
                    style={{
                        backgroundImage: (() => {
                            let url = config.chatBackgroundImage.replace(/\\/g, '/');
                            if (!url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('local://')) {
                                url = `local:///${url.replace(/^\//, '')}`;
                            }
                            return `url("${url}")`;
                        })(),
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundAttachment: 'fixed'
                    }}
                />
            )}

            <div
                key={sessionId}
                className="flex-1 overflow-y-auto p-4 custom-scrollbar chat-area-scroll chat-fade-mask relative animate-chat flex flex-col transform-gpu z-10"
                ref={scrollRef}
                style={{ 
                    fontFamily: 'var(--chat-font)'
                }}
            >
                <div className="flex-1" />
                <div className="space-y-6 w-full max-w-[98%] sm:max-w-[95%] lg:max-w-4xl mx-auto pb-4">
                    {messages.length === 0 && (
                        <div className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-20 ${config.chatBackgroundImage ? 'drop-shadow-[0_20px_50px_rgba(0,0,0,1)] mix-blend-difference' : ''}`}>
                            <div className={`w-20 h-20 rounded-full border-2 flex items-center justify-center mb-6 text-3xl transition-all ${config.chatBackgroundImage 
                                ? 'border-white/40 text-white/50 shadow-[0_0_60px_rgba(0,0,0,0.8)]' 
                                : 'border-blue-500/15 text-blue-500/20'}`}>
                                <Icon name="terminal" />
                            </div>
                            <TypewriterIdle hasCustomBg={!!config.chatBackgroundImage} />
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

                        const isPriority = index >= messages.length - 4 || priorityIndices.includes(index) || msg.isStreaming || isLast;

                        const MessageContent = (
                            <div id={`msg-${msg.id}`} className={`flex group relative w-full ${msg.role === 'user' ? 'justify-center lg:justify-end'
                                : msg.role === 'system' ? 'justify-center'
                                    : 'justify-center lg:justify-start'
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
                                    <div className={`relative w-auto max-w-[95%] lg:max-w-[90%] p-5 sm:px-8 sm:py-6 break-words message-pop-in rounded-[32px] ${msg.role === 'user' ? 'rounded-br-none' : 'rounded-bl-none lg:ml-6'}`}>
                                        
                                        {/* --- Layer 1: Shadow Isolation --- */}
                                        <div className={`absolute inset-0 z-0 rounded-[inherit] pointer-events-none ${msg.role === 'user' ? 'shadow-[0_15px_35px_-10px_rgba(0,0,0,0.6)]' : 'shadow-[0_10px_25px_-3px_rgba(0,0,0,0.9)]'}`} />

                                        {/* --- Layer 2: Glass Backdrop --- */}
                                        <div className={`absolute inset-0 z-0 rounded-[inherit] pointer-events-none backdrop-blur-md ${
                                            msg.role === 'user' 
                                                ? 'bg-blue-900/75' 
                                                : (config.theme === 'cloud' 
                                                    ? 'bg-slate-700/90 shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]' 
                                                    : (['cyberpunk', 'forest'].includes(config.theme) 
                                                        ? 'bg-[var(--surface-color)] shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]' 
                                                        : 'bg-slate-800/90'))
                                        }`} />

                                        {/* --- Layer 3: Interactive Border --- */}
                                        <div className={`absolute inset-0 z-0 rounded-[inherit] pointer-events-none border border-transparent transition-colors duration-300 ${msg.role === 'user' ? 'group-hover:border-blue-500/30' : 'group-hover:border-[var(--primary-color)]/30'}`} />

                                        {/* --- Action Bar --- */}
                                        <div className={`absolute -top-3 ${msg.role === 'user' ? 'right-4' : 'left-4'} flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50`}>
                                            {msg.role === 'user' && (
                                                <button
                                                    onClick={() => onRewind(index)}
                                                    className="bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 text-amber-400 hover:text-amber-300 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-md"
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
                                                    className="bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 text-blue-400 hover:text-blue-300 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-md"
                                                >
                                                    <Icon name="copy" /> {t('chat.actions.copy')}
                                                </button>
                                            )}
                                        </div>

                                        {/* --- Layer 4: Content --- */}
                                        <div className={`relative z-10 h-full flex flex-col ${
                                            msg.role === 'user' 
                                                ? 'text-blue-50' 
                                                : (config.theme === 'cloud' ? 'text-slate-50' : 'text-slate-50')
                                        }`}>
                                            
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
                                                        {(() => {
                                                            const d = new Date(msg.timestamp);
                                                            const month = d.toLocaleString(i18n.language, { month: 'short' }).toUpperCase().replace('.', '');
                                                            const day = d.toLocaleString(i18n.language, { day: '2-digit' });
                                                            const time = d.toLocaleString(i18n.language, { hour: '2-digit', minute: '2-digit', hour12: false });
                                                            return `${month}/${day} ${time}`;
                                                        })()}
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
                                            <div className="text-[13px] sm:text-[14px] leading-loose overflow-visible break-words max-w-full w-full px-2 sm:px-4 text-justify">
                                                {msg.attachments && msg.attachments.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mb-3">
                                                        {msg.attachments.map(att => (
                                                            <div key={att.id} className="relative group bg-slate-800/80 rounded-xl p-2.5 flex items-center gap-3 max-w-[220px] shadow-xl shadow-black/40 hover:bg-slate-700 transition-all duration-300">
                                                                {att.type.startsWith('image/') && att.data ? (
                                                                    <img src={att.data} alt={att.name} className="h-16 w-auto object-contain rounded" />
                                                                ) : att.type.startsWith('image/') ? (
                                                                    <div className="h-10 w-10 rounded bg-slate-700/60 flex items-center justify-center shrink-0">
                                                                        <Icon name="image" className="text-cyan-400/60 text-sm" />
                                                                    </div>
                                                                ) : (
                                                                    <Icon name="file-alt" className="text-slate-400 text-lg" />
                                                                )}
                                                                <span className="text-xs text-slate-300 truncate flex-1">{att.name}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {msg.blocks && msg.blocks.length > 0 ? (
                                                    <div className="mb-4">
                                                        {msg.blocks.map((block, idx) => {
                                                            const prevBlock = idx > 0 ? msg.blocks![idx - 1] : null;
                                                            const isTool = block.type === 'tool_call';
                                                            const isPrevTool = prevBlock?.type === 'tool_call';
                                                            const isNarrative = ['answer', 'text', 'thought'].includes(block.type);

                                                            // Spacing Logic:
                                                            // 1. Consecutive tools = compact (mt-2)
                                                            // 2. Narrative after tool = line jump (mt-8)
                                                            // 3. Narrative after narrative or tool after narrative = standard (mt-4)
                                                            let spacingClass = idx === 0 ? '' : 'mt-4';
                                                            if (isTool && isPrevTool) spacingClass = 'mt-2';
                                                            if (isNarrative && isPrevTool) spacingClass = 'mt-8';

                                                            return (
                                                                <div key={idx} id={`block-${msg.id}-${idx}`} className={spacingClass} data-block-type={block.type}>
                                                                    {block.type === 'answer' ? (
                                                                        <MarkdownRenderer content={block.content} isStreaming={msg.isStreaming} />
                                                                    ) : (block.type === 'thought' || block.type === 'text') ? (() => {
                                                                        const hasTools = msg.blocks!.some(b => b.type === 'tool_call');
                                                                        const forceCollapse = isOld || (hasTools && !debugMode) || block.type === 'thought';
                                                                        return <CollapsibleTextBlock content={block.content} forceCollapse={forceCollapse} isThought={block.type === 'thought'} isStreaming={msg.isStreaming} mode={block.type === 'thought' ? 'minimal' : 'full'} hasCustomBg={!!config.chatBackgroundImage} />;
                                                                    })() : block.type === 'tool_call' ? (
                                                                        <ToolBlock block={block} isOld={isOld} isStreaming={msg.isStreaming} invertRotation={idx % 2 !== 0} />
                                                                    ) : null}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    msg.text && (
                                                        <MarkdownRenderer content={msg.text} isStreaming={msg.isStreaming} mode={msg.role === 'user' ? 'none' : 'full'} />
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
                                    </div>
                                )}
                            </div>
                        );

                        // Wrap all user/assistant/scheduler messages in a collapsible container
                        if (msg.role !== 'system' || msg.isScheduler) {
                            return (
                                <CollapsibleMessage
                                    key={`msg-collapsible-${msg.id}-${index}`}
                                    message={msg}
                                    initiallyCollapsed={msg.isInitiallyCollapsed === true || !isPriority}
                                    hasCustomBg={!!config.chatBackgroundImage}
                                >
                                    {MessageContent}
                                </CollapsibleMessage>
                            );
                        }

                        return (
                            <React.Fragment key={`msg-system-${msg.id}-${index}`}>
                                {MessageContent}
                            </React.Fragment>
                        );
                    })}

                    {/* 👁️ VISION RUNTIME: Viewing Bubble — Shows while Vortex Visual is processing */}
                    {isViewing && (
                        <div id="vision-viewing-bubble" className="flex justify-center w-full animate-slide-up my-4">
                            <div className="max-w-[85%] sm:max-w-[75%] lg:max-w-[65%]">
                                <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl px-6 py-4 border vision-neon-pulse-border">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <Icon name="eye" className="text-xl text-emerald-400 animate-pulse" />
                                            <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-emerald-300 text-xs font-bold tracking-widest uppercase">
                                                Vortex Visual
                                            </span>
                                            <span className="text-slate-400 text-[10px] italic mt-0.5">
                                                {t('chat.labels.vision_analyzing', { defaultValue: 'Analyzing visual context...' })}
                                            </span>
                                        </div>
                                        <div className="flex gap-1 ml-4">
                                            {[0, 150, 300].map(ms => (
                                                <div key={ms} className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" style={{ animation: `pulse 1.4s ease-in-out ${ms}ms infinite` }} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="h-4" /> {/* Bottom breathing room */}
                </div>
            </div>

            {/* Sticky Overlay Area for Active Task / Background Status - Only visible while Miku is doing something */}
            <div className="z-20 w-full relative">
                
                {/* Elevated Tool Approval Panel - Full Edge-to-Edge Banner Attached to Dock */}
                {isExecutingThisSession && pendingApproval && (
                    <div className="absolute bottom-full left-0 w-full z-[100] animate-slide-up pointer-events-none">
                        <div className={`w-full shadow-[0_-15px_40px_-10px_rgba(0,0,0,0.6)] overflow-hidden border-t pointer-events-auto bg-slate-900/95 backdrop-blur-xl ${!CORE_TOOLS.has(pendingApproval.toolCall.function.name) ? 'border-blue-400/40' : 'border-amber-500/40'}`}>
                            <ToolApprovalPanel
                                key={pendingApproval.toolCall.id}
                                pending={pendingApproval}
                                onApprove={onApproveToolCall}
                                onReject={onRejectToolCall}
                            />
                        </div>
                    </div>
                )}

                <div className={`w-full agent-status-docked ${(isLoading || pendingApproval) ? 'active' : ''}`}>
                    <div 
                        className="w-full bg-slate-950/20 backdrop-blur-md agent-status-animate-in"
                        style={config.chatBackgroundImage ? { 
                            maskImage: "linear-gradient(to bottom, transparent 0%, black 12px, black calc(100% - 16px), transparent 100%)", 
                            WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 12px, black calc(100% - 16px), transparent 100%)" 
                        } : {}}
                    >
                    {isExecutingThisSession ? (
                        <div className="w-full">
                            <AgentStatusPanel
                                status={agentStatus}
                                onAbort={onAbort}
                                onReprompt={onReprompt}
                            />
                        </div>
                    ) : (
                        executingSessionId && (
                            <div className="flex justify-center p-4">
                                <div className="bg-indigo-500/10 backdrop-blur-md px-6 py-2.5 rounded-2xl border border-indigo-500/20 shadow-xl flex items-center gap-4 group animate-pulse">
                                    <div className="relative">
                                        <Icon name="brain" className="text-xl text-indigo-400 animate-pulse" />
                                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-0.5">
                                            {t('chat.labels.agent_busy')}
                                        </span>
                                        <span className="text-[9px] text-indigo-400/60 font-mono truncate max-w-[200px]">
                                            {t('chat.labels.processing_branch')} {sessions?.find(s => s.id === executingSessionId)?.title || t('chat.labels.another_branch')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>

        <div className={`px-4 pb-4 ${isLoading ? 'pt-0' : 'pt-4'} bg-slate-900/40 border-t ${isLoading ? 'border-transparent' : 'border-slate-800/50'} transition-all duration-500`}>
                <div className="max-w-5xl mx-auto flex items-center gap-2 mb-2 flex-wrap">
                    <button
                        onClick={() => onAgentModeChange(agentMode === 'chat' ? 'agent' : 'chat')}
                        className={config.chatBackgroundImage || config.theme === 'cloud' || config.theme === 'cyberpunk' || config.theme === 'forest'
                            ? `flex items-center justify-center gap-1.5 px-2 h-6 min-w-[70px] rounded text-[10px] font-mono font-bold uppercase tracking-wider border border-transparent transition-all duration-300 opacity-60 hover:opacity-100 active:opacity-100 ${
                                (config.theme === 'cloud' && !config.chatBackgroundImage)
                                ? 'bg-slate-200/30 hover:bg-slate-200/60 hover:border-slate-300/50 text-slate-600 hover:text-slate-800 shadow-sm' 
                                : 'bg-slate-900/40 backdrop-blur-md hover:bg-slate-900/80 hover:text-slate-100 hover:border-slate-700 text-slate-300 shadow-lg'
                              } active:scale-95 leading-normal`
                            : "flex items-center justify-center gap-1.5 px-2 h-6 min-w-[70px] rounded text-[10px] font-mono font-bold uppercase tracking-wider border border-transparent transition-all duration-300 bg-slate-800/80 hover:bg-slate-800 hover:text-slate-300 hover:border-slate-700 active:scale-95 text-slate-500 hover:text-slate-300 leading-normal opacity-80 hover:opacity-100"
                        }
                        title={t('chat.actions.toggle_mode')}
                    >
                        <Icon name="sliders-h" />
                        <span className="-mb-[1px]">{t('chat.labels.mode')}</span>
                    </button>
                    <div className="relative group/mode">
                        <select
                            value={agentMode}
                            onChange={(e) => onAgentModeChange(e.target.value as AgentMode)}
                            className={config.chatBackgroundImage || config.theme === 'cloud' || config.theme === 'cyberpunk' || config.theme === 'forest'
                                ? `backdrop-blur-md border border-transparent transition-all duration-300 appearance-none cursor-pointer shadow-sm hover:shadow-md rounded px-2.5 pr-9 py-1 text-xs font-mono outline-none opacity-60 hover:opacity-100 focus:opacity-100 ${
                                    (config.theme === 'cloud' && !config.chatBackgroundImage)
                                    ? 'bg-slate-100/30 hover:bg-slate-100/80 hover:border-slate-300/60 focus:bg-white text-slate-600 focus:text-slate-900 md:backdrop-blur-sm'
                                    : 'bg-slate-900/40 hover:bg-slate-900 focus:bg-slate-900 hover:border-slate-700 hover:text-slate-100 focus:text-slate-100 text-slate-300'
                                  }`
                                : "bg-slate-800/80 border border-transparent hover:border-slate-700 rounded px-2 pr-10 py-1 text-xs text-slate-300 hover:text-slate-200 font-mono focus:ring-1 focus:ring-blue-500 outline-none transition-all duration-300 appearance-none cursor-pointer opacity-80 hover:opacity-100 focus:opacity-100"
                            }
                            title={t('chat.actions.mode_selector')}
                        >
                            <option value="chat" className={(config.theme === 'cloud' && !config.chatBackgroundImage) ? "bg-white text-slate-900" : "bg-slate-900"}>💬 {t('chat.modes.chat')}</option>
                            <option value="agent" className={(config.theme === 'cloud' && !config.chatBackgroundImage) ? "bg-white text-slate-900" : "bg-slate-900"}>🤖 {t('chat.modes.agent')}</option>
                        </select>
                        <div className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-300 scale-75 ${
                            (config.theme === 'cloud' && !config.chatBackgroundImage) ? 'text-slate-400 group-hover/mode:text-slate-600' : 'text-slate-400 group-hover/mode:text-slate-200'
                        } opacity-40 group-hover/mode:opacity-100`}>
                            <Icon name="chevron-down" />
                        </div>
                    </div>

                    {/* Agent-only toggles: Approval Mode + Safe Mode */}
                    <div className={`mode-transition-wrap ${agentMode === 'agent' ? 'visible-mode agent-options-enter' : 'hidden-mode agent-options-exit'}`}>
                        <div className="flex items-center gap-2">
                            <div className={`w-px h-4 ${(config.theme === 'cloud' && !config.chatBackgroundImage) ? 'bg-slate-300/50' : 'bg-slate-700/50'}`} />

                            {/* Approval Mode Toggle */}
                            <button
                                onClick={() => onApprovalModeChange(approvalMode === 'auto' ? 'manual' : 'auto')}
                                className={`flex items-center justify-center gap-1.5 px-2 h-6 min-w-[75px] rounded text-[10px] font-mono font-bold uppercase tracking-wider border border-transparent transition-all duration-300 leading-normal opacity-70 hover:opacity-100 ${approvalMode === 'manual'
                                    ? 'bg-blue-500/10 hover:bg-blue-500/20 hover:border-blue-500/30 text-blue-400/80 hover:text-blue-400 shadow-sm shadow-blue-500/10'
                                    : 'bg-amber-500/10 hover:bg-amber-500/20 hover:border-amber-500/30 text-amber-400/80 hover:text-amber-400 shadow-sm shadow-amber-500/10'
                                    }`}
                                title={approvalMode === 'manual'
                                    ? t('chat.actions.manual_approval_desc')
                                    : t('chat.actions.auto_approval_desc')
                                }
                            >
                                <Icon name={approvalMode === 'manual' ? 'lock' : 'unlock'} className="icon-pulse" />
                                <span className="-mb-[1px]">{approvalMode === 'manual' ? t('chat.actions.manual') : t('chat.actions.auto')}</span>
                            </button>

                            {/* Safe Mode Toggle */}
                            <button
                                onClick={() => onSafeModeChange(!safeMode)}
                                className={`flex items-center justify-center gap-1.5 px-2 h-6 min-w-[75px] rounded text-[10px] font-mono font-bold uppercase tracking-wider border border-transparent transition-all duration-300 leading-normal opacity-70 hover:opacity-100 ${safeMode
                                    ? 'bg-blue-500/10 hover:bg-blue-500/20 hover:border-blue-500/30 text-blue-400/80 hover:text-blue-400 shadow-sm shadow-blue-500/10'
                                    : 'bg-amber-500/10 hover:bg-amber-500/20 hover:border-amber-500/30 text-amber-400/80 hover:text-amber-400 shadow-sm shadow-amber-500/10'
                                    }`}
                                title={safeMode
                                    ? t('chat.actions.safe_mode_on_desc')
                                    : t('chat.actions.safe_mode_off_desc')
                                }
                            >
                                {safeMode ? <Icon name="shield-alt" className="icon-pulse" /> : <span className="font-black tracking-tighter mr-0.5 animate-pulse">{'>>>'}</span>}
                                <span className="-mb-[1px]">{safeMode ? t('chat.actions.safe') : t('chat.actions.batch')}</span>
                            </button>
                        </div>
                    </div>

                    <span className={`text-[10px] font-mono hidden sm:inline-block ml-2 transition-opacity duration-300 ${
                        (config.theme === 'cloud' && !config.chatBackgroundImage) ? 'text-slate-500 opacity-60' : 'text-slate-400 opacity-40'
                    }`}>
                        {agentMode === 'chat'
                            ? t('chat.labels.free_conversation')
                            : `${approvalMode === 'manual' ? '🔒 ' + t('chat.labels.status_manual') : '⚡ ' + t('chat.labels.status_auto')} · ${safeMode ? '💠 ' + t('chat.labels.status_safe') : '📦 ' + t('chat.labels.status_batch')}`
                        }
                    </span>

                    <div className="ml-auto">
                        <button
                            onClick={() => onDebugModeChange(!debugMode)}
                            className={config.chatBackgroundImage || config.theme === 'cloud' || config.theme === 'cyberpunk' || config.theme === 'forest'
                                ? `flex items-center justify-center gap-1.5 px-2 h-6 min-w-[75px] rounded text-[10px] font-mono font-bold uppercase tracking-wider border border-transparent transition-all duration-300 leading-normal opacity-60 hover:opacity-100 ${debugMode
                                    ? 'bg-purple-500/20 hover:border-purple-500/40 text-purple-300 shadow-lg shadow-purple-500/10 backdrop-blur-md'
                                    : (config.theme === 'cloud' && !config.chatBackgroundImage)
                                      ? 'bg-slate-200/20 hover:bg-slate-100/80 hover:border-slate-300/60 text-slate-500 hover:text-slate-800 backdrop-blur-md'
                                      : 'bg-slate-900/30 hover:bg-slate-900 hover:border-slate-700 hover:text-slate-100 text-slate-300 backdrop-blur-md'
                                }`
                                : `flex items-center justify-center gap-1.5 px-2 h-6 min-w-[75px] rounded text-[10px] font-mono font-bold uppercase tracking-wider border border-transparent transition-all duration-300 leading-normal opacity-80 hover:opacity-100 ${debugMode
                                    ? 'bg-purple-500/15 hover:border-purple-500/30 text-purple-400 shadow-sm shadow-purple-500/10'
                                    : 'bg-slate-800/50 hover:text-slate-400 hover:border-slate-600 text-slate-500'
                                }`
                            }
                            title={debugMode ? t('chat.actions.disable_debug') : t('chat.actions.enable_debug')}
                        >
                            <Icon name="terminal" />
                            <span className="-mb-[1px]">{t('chat.actions.debug')}</span>
                        </button>
                    </div>
                </div>
                <ChatInputControls
                    isRecording={isRecording}
                    partialText={partialText}
                    agentMode={agentMode}
                    isLoading={isLoading}
                    isViewing={isViewing}
                    executingSessionId={executingSessionId}
                    currentSessionId={sessionId}
                    agentIteration={agentStatus.iteration}
                    agentPhase={agentStatus.phase}
                    agentIsInstructionMode={agentStatus.isInstructionMode}
                    attachments={attachments}
                    t={t}
                    inputRef={inputRef}
                    fileInputRef={fileInputRef}
                    toggleRecording={toggleRecording}
                    onAbort={onAbort}
                    handleSend={handleSend}
                    handleSendAsInstruction={handleSendAsInstruction}
                    onReprompt={onReprompt}
                    handleNativeFileSelect={handleNativeFileSelect}
                    handleRemoveAttachment={handleRemoveAttachment}
                    boltGlow={boltGlow}
                    isSent={isSent}
                    safeMode={safeMode}
                    approvalMode={approvalMode}
                    debugMode={debugMode}
                    onDebugModeChange={onDebugModeChange}
                />
            </div>
        </div>
    );
};
