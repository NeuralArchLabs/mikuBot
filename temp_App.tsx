import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AgentStatus, Message, PendingToolApproval, AgentMode, ModelInfo, FileSystemDirectoryHandle, FileSystemFileHandle, FileTarget, Session } from './types';
import { DEFAULT_CONFIG, DEFAULT_FILES, AGENT_TOOLS } from './constants';
import { createDefaultAgentStatus } from './utils';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { FileEditor } from './components/FileEditor';
import { LibraryManager } from './components/LibraryManager';
import { SettingsPanel } from './components/SettingsPanel';
import { fetchModels, sendStreamingMessage } from './services/api';
import { sendAgentMessage } from './services/agent';
import { db } from './services/fileSystem';
import { persistence } from './services/persistence';

export const App = () => {
    const [state, setState] = useState<AppState>({
        config: DEFAULT_CONFIG,
        files: DEFAULT_FILES,
        additionalFiles: {},
        sandboxFiles: {},
        selectedLibraryFiles: [],
        activeTab: 'chat' as const,
        selectedFile: 'SOUL.md',
        isLibraryExpanded: false,
        unsavedChanges: {},
        agentMode: 'chat' as AgentMode,
        sessionId: null
    });

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle');

    const [agentStatus, setAgentStatus] = useState<AgentStatus>(createDefaultAgentStatus());
    const [pendingToolApproval, setPendingToolApproval] = useState<PendingToolApproval | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const lastUserTextRef = useRef<string>('');

    const [coreHandle, setCoreHandle] = useState<FileSystemDirectoryHandle | null>(null);
    const [extraHandle, setExtraHandle] = useState<FileSystemDirectoryHandle | null>(null);
    const [sandboxHandle, setSandboxHandle] = useState<FileSystemDirectoryHandle | null>(null);
    const [syncing, setSyncing] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);

    // ÔöÇÔöÇ Persistence Handlers ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

    const loadGlobalSettings = useCallback(async () => {
        const saved = await persistence.loadSettings();
        if (saved) {
            setState(prev => ({
                ...prev,
                config: { ...DEFAULT_CONFIG, ...saved.config },
                agentMode: (saved.agentMode || 'chat') as AgentMode
            }));
        }
    }, []);

    const onSaveGlobal = useCallback(async () => {
        if (!(window as any).electron) {
            alert("ÔÜá´©Å Desktop Engine Not Detected: Settings can only be saved to config.json when running MikuCentral as a desktop application.");
            return;
        }

        try {
            const result = await (window as any).electron.saveSettings({
                config: state.config,
                agentMode: state.agentMode
            });

            if (result.ok) {
                alert("Ô£¿ Neural Engine: Configuration saved successfully to config.json");
            } else {
                alert(`ÔØî Configuration Error: ${result.error || 'Unknown error occurred in main process.'}`);
            }
        } catch (e) {
            console.error("Critical failure during save:", e);
            alert("­ƒÆÑ Fatal Error: The connection to the Neural Engine was lost. Check terminal for details.");
        }
    }, [state.config, state.agentMode]);

    const onResetGlobal = useCallback(async () => {
        if (confirm("Reset all settings to defaults? This will overwrite your config.json.")) {
            await persistence.saveSettings(DEFAULT_CONFIG, 'chat');
            setState(prev => ({ ...prev, config: DEFAULT_CONFIG, agentMode: 'chat' }));
        }
    }, [state.config]);

    // ÔöÇÔöÇ Session Management ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

    const onNewSession = useCallback(async () => {
        const id = `session_${Date.now()}`;
        const newSession: Session = {
            id,
            title: 'New Neural Branch',
            messages: [],
            timestamp: Date.now()
        };
        await persistence.saveSession(newSession);
        setMessages([]);
        setState(prev => ({ ...prev, sessionId: id }));
    }, []);

    const onSelectSession = useCallback(async (id: string) => {
        const session = await persistence.loadSession(id);
        if (session) {
            setMessages(session.messages);
            setState(prev => ({ ...prev, sessionId: id }));
        }
    }, []);

    const onDeleteSession = useCallback(async (id: string) => {
        await persistence.deleteSession(id);
        if (state.sessionId === id) {
            setMessages([]);
            setState(prev => ({ ...prev, sessionId: null }));
        }
    }, [state.sessionId]);

    const onRewind = useCallback((index: number) => {
        const msg = messages[index];
        if (msg.role !== 'user') return;

        if (confirm("Rewind conversation to this point? All subsequent messages will be lost.")) {
            const newHistory = messages.slice(0, index);
            setMessages(newHistory);
            setInput(msg.text); // Put the message back in input for editing
        }
    }, [messages]);

    // Auto-save current session
    useEffect(() => {
        if (state.sessionId && messages.length > 0) {
            const timer = setTimeout(() => {
                const title = messages[0]?.text?.slice(0, 30) || 'Active Session';
                persistence.saveSession({
                    id: state.sessionId!,
                    title,
                    messages,
                    timestamp: Date.now()
                });
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [messages, state.sessionId]);

    // Initial load
    useEffect(() => {
        loadGlobalSettings();
    }, [loadGlobalSettings]);

    // ÔöÇÔöÇ File System Handlers ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

    const syncFiles = useCallback(async (
        target: 'core' | 'extra' | 'sandbox',
        handle: FileSystemDirectoryHandle
    ) => {
        setSyncing(true);
        try {
            const newFiles: Record<string, string> = {};

            const readDir = async (dirHandle: FileSystemDirectoryHandle, path = '') => {
                for await (const entry of (dirHandle as any).values()) {
                    if (entry.kind === 'file' && /\.(md|txt|json|js|jsx|ts|tsx|html|css)$/i.test(entry.name)) {
                        const fileHandle = entry as FileSystemFileHandle;
                        const file = await fileHandle.getFile();
                        const text = await file.text();
                        newFiles[path + entry.name] = text;
                    } else if (entry.kind === 'directory') {
                        // EXCLUDE large/binary directories to prevent crash
                        if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) continue;

                        const newPath = path + entry.name + '/';
                        await readDir(entry as FileSystemDirectoryHandle, newPath);
                    }
                }
            };

            await readDir(handle);

            setState(prev => {
                switch (target) {
                    case 'core': return { ...prev, files: newFiles };
                    case 'extra': return { ...prev, additionalFiles: newFiles };
                    case 'sandbox': return { ...prev, sandboxFiles: newFiles };
                }
            });
        } catch (e) {
            console.error(`Error syncing ${target}`, e);
        } finally {
            setSyncing(false);
        }
    }, []);

    const saveFile = async (name: string, content: string, target: FileTarget) => {
        if (!name) return false;

        try {
            let handle: FileSystemDirectoryHandle | null;
            switch (target) {
                case 'core': handle = coreHandle; break;
                case 'extra': handle = extraHandle; break;
                case 'sandbox': handle = sandboxHandle; break;
            }
            if (!handle) throw new Error(`No folder configured for "${target}". Select one in Settings.`);

            if ((handle as any).queryPermission) {
                const status = await (handle as any).queryPermission({ mode: 'readwrite' });
                if (status !== 'granted') {
                    const request = await (handle as any).requestPermission({ mode: 'readwrite' });
                    if (request !== 'granted') throw new Error("Write permission denied by user");
                }
            }

            const parts = name.split('/').filter(p => p && p !== '.');
            const fileName = parts.pop();
            if (!fileName) throw new Error("Invalid filename");

            let dirHandle = handle;
            for (const folder of parts) {
                dirHandle = await dirHandle.getDirectoryHandle(folder, { create: true });
            }

            const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();

            setState(prev => {
                const nextUnsaved = { ...prev.unsavedChanges };
                delete nextUnsaved[name];

                switch (target) {
                    case 'core':
                        return { ...prev, files: { ...prev.files, [name]: content }, unsavedChanges: nextUnsaved };
                    case 'extra':
                        return { ...prev, additionalFiles: { ...prev.additionalFiles, [name]: content }, unsavedChanges: nextUnsaved };
                    case 'sandbox':
                        return { ...prev, sandboxFiles: { ...prev.sandboxFiles, [name]: content }, unsavedChanges: nextUnsaved };
                }
            });

            return true;
        } catch (e) {
            console.error("Save failed", e);
            return false;
        }
    };

    const createFile = async (name: string, type: 'core' | 'extra') => {
        if (!name.endsWith('.md')) name += '.md';
        await saveFile(name, '# New File', type);
    };

    const handleSelectFolder = async (type: 'core' | 'extra' | 'sandbox') => {
        try {
            const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
            switch (type) {
                case 'core':
                    setCoreHandle(handle);
                    await db.set('coreHandle', handle);
                    await syncFiles('core', handle);
                    break;
                case 'extra':
                    setExtraHandle(handle);
                    await db.set('extraHandle', handle);
                    await syncFiles('extra', handle);
                    break;
                case 'sandbox':
                    setSandboxHandle(handle);
                    await db.set('sandboxHandle', handle);
                    await syncFiles('sandbox', handle);
                    break;
            }
        } catch (e) {
            console.log("Folder select cancelled", e);
        }
    };

    // Initial handles restoration
    useEffect(() => {
        const restoreHandles = async () => {
            try {
                const core = await db.get('coreHandle');
                if (core) {
                    setCoreHandle(core);
                    const perm = await (core as any).queryPermission({ mode: 'read' });
                    if (perm === 'granted') syncFiles('core', core);
                }

                const extra = await db.get('extraHandle');
                if (extra) {
                    setExtraHandle(extra);
                    const perm = await (extra as any).queryPermission({ mode: 'read' });
                    if (perm === 'granted') syncFiles('extra', extra);
                }

                const sandbox = await db.get('sandboxHandle');
                if (sandbox) {
                    setSandboxHandle(sandbox);
                    const perm = await (sandbox as any).queryPermission({ mode: 'read' });
                    if (perm === 'granted') syncFiles('sandbox', sandbox);
                }
            } catch (e) { console.error("Restore failed", e); }
        };
        restoreHandles();
    }, [syncFiles]);

    // ÔöÇÔöÇ Chat Logic ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const updateConfig = useCallback((key: string, value: any) => {
        setState(prev => ({
            ...prev,
            config: { ...prev.config, [key]: value }
        }));
    }, []);

    const handleTestConnection = useCallback(async () => {
        setLoadingModels(true);
        setConnectionStatus('testing');
        try {
            const fetchedModels = await fetchModels(state.config.provider, state.config);
            setModels(fetchedModels);
            setConnectionStatus('connected');
            if (fetchedModels.length > 0 && !state.config.model) {
                updateConfig('model', fetchedModels[0].id);
            }
        } catch (error) {
            setConnectionStatus('error');
            setModels([]);
        } finally {
            setLoadingModels(false);
        }
    }, [state.config, updateConfig]);

    const constructSystemInstruction = () => {
        const files = state.files || {};
        const additionalFiles = state.additionalFiles || {};
        const selectedFiles = state.selectedLibraryFiles || [];
        const segments: string[] = [];

        if (state.agentMode === 'agent') {
            const modesFile = files['base/AGENT_MODES.md'] || files['AGENT_MODES.md'] || '';
            const match = modesFile.match(/## \[INSTRUCTION MODE.*?\]\n([\s\S]*?)(?=\n##|$)/);

            segments.push(match ? match[1].trim() : `[TOOL PROTOCOL]
You are an autonomous agent. Output ONLY raw JSON tool calls when needed.
Available: read_file, update_file, list_files, search_files, web_search, read_url.`);

            const toolsContent = files['base/TOOLS.md'] || files['TOOLS.md'];
            if (toolsContent) {
                segments.push(`[SYSTEM PATHS]\n${toolsContent}`);
            }
        }

        // Context Injection: Identify personality files in both old and new locations
        // We only inject personality/context files in CHAT mode, per user preference for a "clean" agent prompt
        if (state.agentMode !== 'agent') {
            ['SOUL.md', 'USER.md', 'ACTIVE_CONTEXT.md'].forEach(baseName => {
                const nestedPath = `core/${baseName}`;
                const content = files[nestedPath] || files[baseName]; // Check both new and old paths

                if (content) {
                    segments.push(`[${baseName.replace('.md', '')}]\n${content}`);
                }
            });
        }

        // Other base files if any
        const modesContent = files['base/AGENT_MODES.md'] || files['AGENT_MODES.md'];
        if (modesContent && state.agentMode !== 'agent') {
            segments.push(`[AGENT MODES]\n${modesContent}`);
        }

        const selectedEntries = Object.entries(additionalFiles).filter(([n]) => selectedFiles.includes(n));
        // Only include library context in Chat mode to keep Agent mode dedicated to instructions
        if (selectedEntries.length > 0 && state.agentMode !== 'agent') {
            segments.push(`[LIBRARY]\n${selectedEntries.map(([n, c]) => `--- ${n} ---\n${c}`).join('\n')}`);
        }

        return segments.join('\n\n') || 'You are mikuBot, a helpful AI assistant.';
    };

    const handleAbortAgent = useCallback(() => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        setIsLoading(false);
        setAgentStatus(prev => ({ ...prev, phase: 'aborted' }));
        setPendingToolApproval(null);
    }, []);

    const handleApproveToolCall = useCallback(() => {
        if (pendingToolApproval) {
            pendingToolApproval.resolve(true);
            setPendingToolApproval(null);
        }
    }, [pendingToolApproval]);

    const handleRejectToolCall = useCallback(() => {
        if (pendingToolApproval) {
            pendingToolApproval.resolve(false);
            setPendingToolApproval(null);
        }
    }, [pendingToolApproval]);

    const processMessage = async (text: string, forceToolMode: boolean = false) => {
        if (!text.trim() || isLoading) return;
        if (!state.config.model) return alert('Select a model first.');

        lastUserTextRef.current = text;
        const userMsg: Message = { id: Date.now().toString(), role: 'user', text, timestamp: Date.now() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);
        setAgentStatus(createDefaultAgentStatus());

        const modelMsgId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, { id: modelMsgId, role: 'assistant', text: '', timestamp: Date.now(), isStreaming: true }]);

        const ac = new AbortController();
        abortControllerRef.current = ac;

        try {
            const chatHistory = messages.map(m => ({ role: m.role, content: m.text }));
            chatHistory.push({ role: 'user', content: text });

            if (state.config.provider === 'ollama') {
                const isToolCapable = state.agentMode === 'agent' || forceToolMode;
                await sendAgentMessage(
                    state.config, constructSystemInstruction(), chatHistory, AGENT_TOOLS,
                    { ...state.files }, { ...state.additionalFiles }, { ...state.sandboxFiles },
                    saveFile,
                    (chunk, replace, blocks) => {
                        setMessages(prev => prev.map(m => m.id === modelMsgId ? { ...m, text: replace ? chunk : m.text + chunk, blocks: blocks || m.blocks } : m));
                    },
                    (p) => setAgentStatus(prev => ({ ...prev, ...p })),
                    (toolCall) => new Promise(resolve => setPendingToolApproval({ toolCall, resolve })),
                    ac.signal,
                    isToolCapable, // useTextExtraction: only when using tools
                    isToolCapable  // isAgentMode: only when using tools
                );
            } else {
                let fullText = '';
                await sendStreamingMessage(
                    state.config.provider as 'groq' | 'gemini', state.config, constructSystemInstruction(), chatHistory,
                    (chunk) => {
                        fullText += chunk;
                        setMessages(prev => prev.map(m => m.id === modelMsgId ? { ...m, text: fullText } : m));
                    }
                );
            }
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') return;
            setMessages(prev => prev.map(m => m.id === modelMsgId ? { ...m, text: `ÔÜá´©Å Error: ${error instanceof Error ? error.message : 'Unknown'}` } : m));
        } finally {
            setIsLoading(false);
            setMessages(prev => prev.map(m => m.id === modelMsgId ? { ...m, isStreaming: false } : m));
        }
    };

    const handleReprompt = useCallback(() => {
        if (lastUserTextRef.current && !isLoading) processMessage('Continue from where you stopped.', false);
    }, [isLoading, processMessage]);

    const handleClear = useCallback(() => {
        setMessages([]);
        setAgentStatus(createDefaultAgentStatus());
    }, []);

    return (
        <div className="flex h-screen w-full bg-[#0f172a] text-slate-200 overflow-hidden font-sans">
            <Sidebar
                state={{ ...state, onSelectSession, onDeleteSession, onNewSession } as any}
                setState={setState}
                onClear={handleClear}
            />

            {state.activeTab === 'chat' && (
                <ChatArea
                    messages={messages} isLoading={isLoading} input={input} setInput={setInput}
                    onSend={() => processMessage(input)} onSendAsInstruction={() => processMessage(input, true)}
                    onAbort={handleAbortAgent} onReprompt={handleReprompt} onRewind={onRewind} scrollRef={scrollRef}
                    agentStatus={agentStatus} pendingApproval={pendingToolApproval}
                    onApproveToolCall={handleApproveToolCall} onRejectToolCall={handleRejectToolCall}
                    agentMode={state.agentMode} onAgentModeChange={(m) => setState(p => ({ ...p, agentMode: m }))}
                />
            )}

            {state.activeTab === 'cortex' && (
                <FileEditor
                    files={state.files} selectedFile={state.selectedFile}
                    setSelectedFile={(f) => setState(p => ({ ...p, selectedFile: f }))}
                    onSave={(n, c) => saveFile(n, c, 'core')} unsavedChanges={state.unsavedChanges}
                    setUnsavedChanges={(u) => setState(p => ({ ...p, unsavedChanges: typeof u === 'function' ? u(p.unsavedChanges) : u }))}
                    onAddFile={() => createFile(`New_Core_${Date.now()}`, 'core')}
                />
            )}

            <LibraryManager
                isOpen={state.isLibraryExpanded} onClose={() => setState(p => ({ ...p, isLibraryExpanded: false }))}
                files={state.additionalFiles} selectedFiles={state.selectedLibraryFiles}
                onToggleSelect={(n) => setState(p => ({ ...p, selectedLibraryFiles: p.selectedLibraryFiles.includes(n) ? p.selectedLibraryFiles.filter(f => f !== n) : [...p.selectedLibraryFiles, n] }))}
                onSave={(n, c) => saveFile(n, c, 'extra')} onAdd={() => createFile(`Library_${Date.now()}`, 'extra')}
            />

            {state.activeTab === 'settings' && (
                <SettingsPanel
                    config={state.config} updateConfig={updateConfig} models={models} loadingModels={loadingModels}
                    connectionStatus={connectionStatus} onTestConnection={handleTestConnection}
                    onCoreSelect={() => handleSelectFolder('core')} onExtraSelect={() => handleSelectFolder('extra')} onSandboxSelect={() => handleSelectFolder('sandbox')}
                    onSaveGlobal={onSaveGlobal} onResetGlobal={onResetGlobal}
                    corePathName={coreHandle?.name || ''} extraPathName={extraHandle?.name || ''} sandboxPathName={sandboxHandle?.name || ''} syncing={syncing}
                />
            )}
        </div>
    );
};

export default App;
