/**
 * Core Agent Orchestrator
 * Path: src/services/core/agent.ts
 * REWIRED: Literal assembly from original monolith logic
 */
import { 
    ToolCall, 
    ToolDefinition, 
    AppConfig, 
    AgentStatus, 
    AgentLogEntry, 
    FileTarget, 
    ApprovalMode, 
    Provider,
    MessageBlock 
} from '../../types';
import { useAgentStore } from '../../stores/useAgentStore';
import { 
    PROTECTED_CORE_FILES, 
    CONSOLE_ALLOWED_COMMANDS, 
    CONSOLE_BLOCKED_PATTERNS,
    HIGH_RISK_COMMANDS,
    SAFE_CONSOLE_COMMANDS,
    SAFE_COMMAND_SUBCOMMANDS,
    LAX_CONSOLE_ALLOWED_COMMANDS
} from '../../constants';
import { validateToolArgs, safeFetch, obfuscatePaths } from '../../utils';
import { recoverToolCallsFromText, normalizeRawToolCall, RecoveredCall } from '../formatters/toolCallNormalizer';
import { createFormatter } from '../formatters/formatterFactory';
import type { ProviderOptions } from './ModelProviders';


// Modular Imports (The Rewire)
import { 
    resolvePathAndSource, 
    getFileStore, 
} from './agent/utils';
import { executeToolCall } from './agent/tools';
import { 
    segmentThoughtsAndNarrative, 
    extractToolSnippet, 
    autoExtractSources, 
    applyBatchTaskTicking,
    getActionFingerprint
} from './agent/chat';

export async function sendAgentMessage(
    config: AppConfig,
    systemPrompt: string,
    chatMessages: any[],
    tools: ToolDefinition[],
    files: Record<string, string>,
    additionalFiles: Record<string, string>,
    workSpaceFiles: Record<string, string>,
    toolsFiles: Record<string, string>,
    rootFiles: Record<string, string>,
    saveFileFn: (name: string, content: string, target: FileTarget) => Promise<boolean>,
    deleteFileFn: (name: string, target: FileTarget) => Promise<boolean>,
    onChunk: (text: string, replace?: boolean, blocks?: any[]) => void,
    onStatus: (status: Partial<AgentStatus>) => void,
    onToolApproval: (toolCall: ToolCall) => Promise<{ approved: boolean, feedback?: string }>,
    onAddTask: (task: any) => Promise<string>,
    abortSignal: AbortSignal,
    onFinalRawHistory?: (history: any[]) => void,
    useTextExtraction: boolean = true,
    isAgentMode: boolean = false,
    safeMode: boolean = false,
    approvalMode: ApprovalMode = 'auto',
    isInstructionMode: boolean = false,
    isScheduled: boolean = false,
    isRemote: boolean = false,
    onRefreshContext?: () => Promise<{
        tools: ToolDefinition[];
        isAgentMode: boolean;
        isInstructionMode: boolean;
        systemPrompt: string;
    }>
): Promise<void> {

    // Start of turn

    const log = (type: AgentLogEntry['type'], message: string, details?: any) => {
        onStatus({ log: [{ timestamp: Date.now(), type, message, details }] });
    };

    let modelSupportsNativeTools = true;
    let allBlocks: MessageBlock[] = [];

    async function streamModelRequest(
        messages: any[],
        useTools: boolean,
        customOnStatus?: (status: Partial<AgentStatus>) => void
    ): Promise<{ content: string; toolCalls: any[]; reasoning?: string; finishReason?: string }> {
        const provider = config.provider;
        const isElectronProxy = !!(window as any).electron?.apiStream;

        const options: ProviderOptions = {
            config,
            onStatus: customOnStatus || onStatus,
            onChunk: (chunk: string) => {
                // Provider internally calls this
            },
            abortSignal: abortSignal!,
            useTools: useTools && modelSupportsNativeTools,
            tools,
            isElectronProxy
        };

        const { ProviderFactory } = await import('./ModelProviders');
        const providerInstance = ProviderFactory.create(provider, options);
        
        try {
            return await providerInstance.streamRequest(messages);
        } catch (err: any) {
            if (useTools && modelSupportsNativeTools && providerInstance.shouldFallback(err)) {
                log('warn', `⚠️ Este modelo está siendo optimizado para el llamado de herramientas nativas. Activando motor de extracción secundaria de respaldo.`);
                modelSupportsNativeTools = false;
                return streamModelRequest(messages, useTools, customOnStatus);
            }
            throw err;
        }
    }

    // --- TOKEN OPTIMIZATION / HISTORICAL CONTEXT ---
    const historicalContext = chatMessages.map(m => {
        const msg = { ...m } as any;
        // Inject timestamp ONLY for user messages for temporal reference
        // CRITICAL FIX: Do NOT prepend timestamp if message contains system tags like [SISTEMA:
        // This prevents corruption of Protocol Reinforcement tags injected by App.tsx
        if (msg.role === 'user' && m.timestamp) {
            const d = new Date(m.timestamp);
            const locale = config.language || 'en';
            const month = d.toLocaleString(locale, { month: 'short' }).toUpperCase().replace('.', '');
            const day = d.toLocaleString(locale, { day: '2-digit' });
            const time = d.toLocaleString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
            const ts = `${month}/${day} ${time}`;
            const content = msg.content || '';
            // Check if message contains system-level tags that should not be prepended
            const hasSystemTags = content.match(/^\[SISTEMA:|^\[AGENT_|^\[CHAT_/);
            if (hasSystemTags) {
                // Append timestamp at the END to preserve tag structure
                msg.content = `${content}\n[Timestamp: ${ts}]`;
            } else {
                // Normal case: prepend timestamp
                msg.content = `[${ts}] ${content}`;
            }
        }
        if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
            try {
                const calls = msg.tool_calls;
                const totalArgsLen = JSON.stringify(calls).length;
                if (totalArgsLen > 300) {
                    const callSummaries = calls.map((tc: any) => {
                        const name = tc.function?.name || tc.tool_name || 'unknown';
                        const args = tc.function?.arguments || tc.tool_args || {};
                        let desc = `${name}`;
                        if (args.filename) desc += `("${args.filename}")`;
                        else if (args.query) desc += `("${args.query}")`;
                        else if (args.command) desc += `("${args.command}")`;
                        return desc;
                    }).join(', ');
                    msg.content = (msg.content || '') + `\n\n🤖 [HISTORIAL OPTIMIZADO] Se ejecutaron: ${callSummaries}. (Detalles técnicos comprimidos para ahorrar memoria).`;
                    delete msg.tool_calls;
                }
            } catch { }
        }
        if (msg.role === 'tool' && msg.content) {
            try {
                if (!msg.content.trim().startsWith('{') || msg.content.length < 150) return m;
                const parsed = JSON.parse(msg.content);
                const isSuccess = parsed.success !== false;
                const toolName = msg.tool_name || 'unknown_tool';
                let summary = `${isSuccess ? '✅' : '❌'} [HISTÓRICO] ${toolName}`;
                const args = msg.tool_args || {}; 
                const filename = parsed.data?.filename || args.filename;
                const query = parsed.data?.query || args.query;
                const cmd = parsed.data?.command || args.command;
                if (filename) summary += `: "${filename}"`;
                else if (query) summary += `: "${query}"`;
                else if (cmd) summary += `: "${cmd} ${args.args || ''}"`;
                else if (parsed.message) summary += `: ${parsed.message.substring(0, 80)}...`;
                if (isSuccess) summary += ` | Status: SUCCESS`;
                else summary += ` | Status: ERROR (${(parsed.error || parsed.data?.error || 'Falló').substring(0, 100)})`;
                // IMPROVED: Preserve tool metadata for future tool-aware processing
                // Convert to user role for model compatibility, but keep original tool context
                return { role: 'user', content: `[LOG DE SISTEMA] ${summary}`, tool_name: toolName, original_role: 'tool' };
            } catch { return m; }
        }
        return msg;
    });

    let activeContext = historicalContext;
    if (isAgentMode || isInstructionMode) {
        const filtered = historicalContext.filter(m => !m.content.startsWith('⚠️ Command Executed:'));
        // INCREASED CONTEXT WINDOW: Changed from 10/30 to 40/60 to preserve reinforcement injections
        // Larger window ensures Protocol Reinforcement messages are retained longer
        const windowSize = isInstructionMode ? 40 : 60;
        activeContext = filtered.slice(-windowSize);
    }

    let agentMessages: any[] = [
        { role: 'system', content: systemPrompt },
        ...activeContext,
    ];

    const startTime = Date.now();
    const currentFiles = { ...files };
    const currentAdditional = { ...additionalFiles };
    const currentWorkSpace = { ...workSpaceFiles };
    const currentTools = { ...toolsFiles };
    const currentRoot = { ...rootFiles };

    const MAX_RETRIES = 10;
    const NUDGE_DELAY_MS = 3000; // 3 seconds delay before sending nudge
    const MAX_CONSECUTIVE_NUDGES = 3; // Maximum nudges before stopping
    let iterations = 0;
    let retries = 0;
    let consecutiveNudges = 0; // Track consecutive nudges to prevent infinite loops
    let actionHistory: string[] = [];
    const missionTrigger = [...historicalContext].reverse().find(m => m.role === 'user')?.content || 'Sin objetivo definido.';
    let lastExecutionFeedback = 'Inicio de misión.';
    const signatureRegex = /\{\{?[\s\S]*?⫪╠╝\^\.⫫\.╠╝\^⫪┐⌵[\s\S]*?\}\}?/;

    // Strict System Task Discovery (Predefined Route: @CORE/tasks.md)
    const getSystemTasks = () => {
        // Find TASKS.md strictly in the CORE store
        const keys = Object.keys(currentFiles);
        const taskKey = keys.find(k => k.toLowerCase() === 'tasks.md');
        if (taskKey) return { content: currentFiles[taskKey], filename: taskKey };
        return null;
    };


    const localOnStatus = (status: Partial<AgentStatus>) => {
        onStatus({ ...status, lastExecutionFeedback });
    };

    let lastStreamUpdate = 0;
    const bridgedOnStatus = (status: Partial<AgentStatus>) => {
        localOnStatus(status);
        if (status.phase === 'streaming' && (status.streamedText !== undefined || status.streamedReasoning !== undefined)) {
            const now = Date.now();
            if (now - lastStreamUpdate > 80) {
                lastStreamUpdate = now;
                const tempIterationBlocks: MessageBlock[] = [];
                if (status.streamedReasoning && status.streamedReasoning.trim()) {
                    tempIterationBlocks.push({ type: 'thought', content: status.streamedReasoning.trim() });
                }
                if (status.streamedText) {
                    const segmented = segmentThoughtsAndNarrative(status.streamedText, signatureRegex);
                    tempIterationBlocks.push(...segmented);
                }
                const elapsedMs = Date.now() - startTime;
                if (tempIterationBlocks.length > 0) {
                    tempIterationBlocks[0].loopDurationMs = elapsedMs;
                    tempIterationBlocks[0].startTime = startTime;
                }

                // Call with chunk text as empty or already summarized to avoid App.tsx re-concatenating
                // app.tsx does: finalAssistantText = replace ? chunk : finalAssistantText + chunk;
                // Since streamedText is the TOTAL accumulated, we MUST use replace=true to avoid internal duplication
                onChunk(status.streamedText || '', true, [...allBlocks, ...tempIterationBlocks.filter(b => b.content.trim() !== '')]);
            }
        }
    };


    let memorySaved = false;
    let hasFatalError = false;
    let allNarrative = '';

    // Helper function to remove previous nudge messages from history to prevent loops
    const cleanNudgesFromHistory = () => {
        const nudgeMarkers = [
            '⚠️ TURN GENERATED NO ACTIONS:',
            '⚠️ INCOMPLETE AGENT PROTOCOL:',
            '⚠️ EMPTY RESPONSE:',
            '⚠️ PROTOCOLO DE AGENTE INCOMPLETO:'
        ];
        agentMessages = agentMessages.filter(msg => {
            if (msg.role === 'user' && msg.content) {
                return !nudgeMarkers.some(marker => msg.content.includes(marker));
            }
            return true;
        });
    };

    // ─── EPHEMERAL AWARENESS: Inline cleaner ───
    const cleanAwareness = () => {
        agentMessages = agentMessages.map(m => {
            if (m.content) {
                // Deep cleaning of all operational blocks to prevent history pollution
                m.content = m.content
                    .replace(/--- ON DUTY REPORT ---/g, '')
                    .replace(/\[AGENT_STATE\][\s\S]*?\[\/AGENT_STATE\]/g, '')
                    .replace(/\[OPERATION_FOCUS\][\s\S]*?\[\/OPERATION_FOCUS\]/g, '')
                    .replace(/\[CURRENT_WORK_PLAN\][\s\S]*?\[\/CURRENT_WORK_PLAN\]/g, '')
                    .trim();
                
                // Ensure content never stays purely empty for tool roles
                if (!m.content && m.role === 'tool') m.content = ' ';
            }
            return m;
        }).filter(m => {
            // Remove legacy takeaway messages or messages that became completely empty and aren't tools
            if (m.role === 'user' && !m.content.trim()) return false;
            return true;
        });
    };

    // --- Main Loop ---
    try {
        while (!abortSignal.aborted) {
            // ⚡ ON-THE-FLY MODE REFRESH: Support mid-execution mode switching (Chat <-> Agent)
            if (onRefreshContext) {
                try {
                    const fresh = await onRefreshContext();
                    const oldAgentMode = isAgentMode;
                    const oldInstructionMode = isInstructionMode;
                    
                    isAgentMode = fresh.isAgentMode;
                    isInstructionMode = fresh.isInstructionMode;
                    tools = fresh.tools;
                    
                    // Update system instruction in-place to reflect new identity/protocol
                    if (agentMessages[0] && agentMessages[0].role === 'system') {
                        if (agentMessages[0].content !== fresh.systemPrompt) {
                            agentMessages[0].content = fresh.systemPrompt;
                        }
                    }

                    if (oldAgentMode !== isAgentMode || oldInstructionMode !== isInstructionMode) {
                        console.log(`[Agent] Mode switched on the fly: Agent=${isAgentMode}, Instruction=${isInstructionMode}`);
                        localOnStatus({ isInstructionMode: fresh.isInstructionMode });
                    }
                } catch (e) {
                    console.error('[Agent] Refresh context failed:', e);
                }
            }

            if (retries >= MAX_RETRIES) {
                log('warn', `Max retries reached (${MAX_RETRIES}). Stopping.`);
                localOnStatus({ phase: 'error', retries, maxRetries: MAX_RETRIES, errorCount: retries, elapsedMs: Date.now() - startTime, rawMessages: [...agentMessages] });
                break;
            }

            iterations++;
            let turnHasFailure = false;
            let turnHasDenial = false;
            let turnAutoTasks: string[] = [];
            let tasksContent = '';
            let successfulCalls: ToolCall[] = [];

            if (isAgentMode || isInstructionMode) {
                const taskMatch = getSystemTasks();
                tasksContent = taskMatch?.content || '';
            }

            // --- Pre-turn Check: Background console tasks ---
            if ((window as any).electron?.pollConsoleNotifications) {
                try {
                    const notifications = await (window as any).electron.pollConsoleNotifications();
                    for (const note of notifications) {
                        // DEDUPLICATION: Prevent duplicate notifications if the tool already reported its result 
                        // in the current turn or history.
                        const isAlreadyReported = agentMessages.some(m => m.tool_call_id === note.id);
                        if (isAlreadyReported) continue;

                        const content = JSON.stringify({
                            success: note.exitCode === 0,
                            data: {
                                message: `🔔 BACKGROUND TASK FINISHED: ${note.command}`,
                                id: note.id,
                                stdout: obfuscatePaths(note.stdout.slice(-15000), config.folderPaths?.root),
                                stderr: obfuscatePaths(note.stderr.slice(-5000), config.folderPaths?.root),
                                exitCode: note.exitCode,
                                error: note.error,
                                startTime: note.startTime,
                                endTime: note.endTime,
                                durationMs: note.durationMs
                            }
                        });
                        
                        agentMessages.push({
                            role: 'tool',
                            tool_name: 'run_console',
                            content: content,
                            tool_call_id: note.id
                        });
                        log('info', `Background task finished: ${note.command} (ID: ${note.id})`);
                    }
                } catch (e) {
                    console.error('[Agent] Failed to poll console notifications:', e);
                }
            }


            localOnStatus({
                phase: 'thinking',
                iteration: iterations,
                retries,
                maxRetries: MAX_RETRIES,
                elapsedMs: Date.now() - startTime,
                rawMessages: JSON.parse(JSON.stringify(agentMessages)),
                currentSystemPrompt: agentMessages[0].content
            });

            let content: string;
            let nativeToolCalls: any[];
            let nativeReasoning: string | undefined;
            try {
                // TAG VALIDATION: Ensure Protocol Reinforcement tags survive to API call
                // This is critical for verifying the injection pipeline works end-to-end
                const userMessages = agentMessages.filter(m => m.role === 'user');
                if (userMessages.length > 0) {
                    const lastUserMsg = userMessages[userMessages.length - 1].content;
                    const hasProtocolTags = lastUserMsg.match(/\[SISTEMA: REFUERZO DE PROTOCOLO\]|\[AGENT_TIPS\]|\[CHAT_MODE_TIPS\]|\[SCHEDULED_TASK_AUTO-PILOT\]/);
                    if (hasProtocolTags) {
                        onStatus({
                            phase: 'thinking',
                            debug: `✅ Protocol Reinforcement tags validated in user message. Tags found: ${hasProtocolTags.join(', ')}`
                        });
                    }
                }
                const res = await streamModelRequest([...agentMessages], useTextExtraction, bridgedOnStatus);
                content = res.content;
                nativeToolCalls = res.toolCalls;
                nativeReasoning = res.reasoning;

                // DETECT TRUNCATION (Loop Protection & Continuity)
                if (res.finishReason === 'length' || res.finishReason === 'MAX_TOKENS') {
                    lastExecutionFeedback = "⚠️ LÍMITE DE SALIDA: Has alcanzado el número máximo de tokens por respuesta. No has podido terminar de emitir tu mensaje. Por favor, continúa desde donde te quedaste y simplifica si es necesario.";
                }
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                throw err;
            }

            let finalToolCalls: ToolCall[] = [];
            let positionalCalls: RecoveredCall[] = [];
            if (content && useTextExtraction) {
                const { calls } = recoverToolCallsFromText(content, tools);
                positionalCalls = calls;
                finalToolCalls = calls.map(c => c.toolCall);
            }
            if (nativeToolCalls && nativeToolCalls.length > 0) {
                for (const tc of nativeToolCalls) {
                    try {
                        const rawArgs = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments;
                        const norm = normalizeRawToolCall({ name: tc.function.name, arguments: rawArgs }, tools);
                        if (norm.toolCall) {
                            norm.toolCall.id = tc.id || norm.toolCall.id;
                            const fp = getActionFingerprint(norm.toolCall.function.name, norm.toolCall.function.arguments);
                            if (!finalToolCalls.some(x => getActionFingerprint(x.function.name, x.function.arguments) === fp)) {
                                (norm.toolCall as any).thought_signature = tc.thought_signature || tc.thoughtSignature;
                                finalToolCalls.push(norm.toolCall);
                                positionalCalls.push({ toolCall: norm.toolCall, start: content?.length || 0, end: content?.length || 0 });
                            }
                        }
                    } catch { retries++; }
                }
            }

            const uniqueToolCalls: ToolCall[] = [];
            const seenFpSet = new Set<string>();
            for (const tc of [...finalToolCalls].reverse()) {
                const fp = getActionFingerprint(tc.function.name, tc.function.arguments);
                if (!seenFpSet.has(fp)) {
                    seenFpSet.add(fp);
                    uniqueToolCalls.push(tc);
                }
            }
            uniqueToolCalls.reverse(); // Maintain original model execution order (Top-to-Bottom)
            positionalCalls = positionalCalls.filter(pc => uniqueToolCalls.some(utc => utc.id === pc.toolCall.id));

            const iterationBlocks: MessageBlock[] = [];
            if (nativeReasoning && nativeReasoning.trim()) iterationBlocks.push({ type: 'thought', content: nativeReasoning.trim() });
            let curIdx = 0;
            const seenFpForInterleaving = new Set<string>();
            for (const rc of [...positionalCalls].sort((a, b) => a.start - b.start)) {
                const segmentBlocks = segmentThoughtsAndNarrative((content || '').substring(curIdx, rc.start), signatureRegex);
                segmentBlocks.forEach(b => iterationBlocks.push(b));
                if (uniqueToolCalls.some(utc => utc.id === rc.toolCall.id)) {
                    const args = rc.toolCall.function.arguments;
                    const thoughtKey = Object.keys(args).find(k => ['thought', 'reasoning', 'think'].includes(k.toLowerCase()));
                    if (thoughtKey && typeof args[thoughtKey] === 'string' && args[thoughtKey].trim()) {
                        iterationBlocks.push({ type: 'thought', content: args[thoughtKey].trim() });
                    }
                    const fp = getActionFingerprint(rc.toolCall.function.name, rc.toolCall.function.arguments);
                    if (!seenFpForInterleaving.has(fp)) {
                        seenFpForInterleaving.add(fp);
                        iterationBlocks.push({ type: 'tool_call', content: `Modo: ${rc.toolCall.function.name}`, toolCall: rc.toolCall });
                    }
                }
                curIdx = rc.end;
            }
            const finalBlocks = segmentThoughtsAndNarrative((content || '').substring(curIdx), signatureRegex);
            iterationBlocks.push(...finalBlocks);

            const mergedBlocks: MessageBlock[] = [];
            iterationBlocks.forEach(block => {
                const last = mergedBlocks[mergedBlocks.length - 1];
                if (last && last.type === 'thought' && block.type === 'thought') last.content += `\n\n${block.content}`;
                else if (block.content?.trim()) mergedBlocks.push(block);
            });
            
            const currentElapsed = Date.now() - startTime;
            if (mergedBlocks.length > 0) {
                // Attach duration to the first block of this iteration's set
                mergedBlocks[0].loopDurationMs = currentElapsed;
                mergedBlocks[0].startTime = startTime;
            }

            // 10. RECONSTRUCT CLEAN NARRATIVE
            const cleanTurnNarrative = mergedBlocks
                .filter(b => b.type === 'answer')
                .map(b => b.content)
                .join('\n\n');
            if (cleanTurnNarrative.trim()) {
                allNarrative += (allNarrative ? '\n\n' : '') + cleanTurnNarrative;
            }

            agentMessages.push({
                role: 'assistant',
                content: cleanTurnNarrative || ' ',
                reasoning: nativeReasoning || undefined,
                tool_calls: uniqueToolCalls.length > 0 ? JSON.parse(JSON.stringify(uniqueToolCalls)) : undefined,
            });

            // Update UI with FULL cumulative narrative
            onChunk(allNarrative || ' ', true, [...allBlocks, ...mergedBlocks]);

            allBlocks = [...allBlocks, ...mergedBlocks];
            if (uniqueToolCalls.length === 0) {
                // Check for consecutive nudges limit to prevent infinite loops
                if (consecutiveNudges >= MAX_CONSECUTIVE_NUDGES) {
                    log('warn', `Max consecutive nudges reached (${MAX_CONSECUTIVE_NUDGES}). Stopping to prevent loop.`);
                    localOnStatus({ phase: 'error', errorCount: retries, elapsedMs: Date.now() - startTime, rawMessages: [...agentMessages] });
                    onChunk('\n\n⚠️ El asistente ha generado múltiples respuestas vacías. Deteniendo para evitar bucle infinito.', true, []);
                    break;
                }

                if (retries < MAX_RETRIES && (!content || content.trim() === '')) {
                    // Wait before sending nudge to give model time
                    await new Promise(resolve => setTimeout(resolve, NUDGE_DELAY_MS));

                    // Clean previous nudges from history to prevent loops
                    cleanNudgesFromHistory();

                    retries++;
                    consecutiveNudges++;
                    const nudge = (turnHasFailure || lastExecutionFeedback.includes('⚠️'))
                        ? "⚠️ TURN GENERATED NO ACTIONS: Blockers or errors detected. Do not stop, try a different approach."
                        : (isAgentMode || isInstructionMode)
                            ? "⚠️ INCOMPLETE AGENT PROTOCOL: You must provide a response or execute tools to proceed."
                            : "⚠️ EMPTY RESPONSE: Please provide a response to continue the conversation.";
                    agentMessages.push({ role: 'user', content: nudge });
                    continue;
                }

                // Reset consecutive nudges counter if we have valid content
                if (content && content.trim()) {
                    consecutiveNudges = 0;
                }

                if (isAgentMode || isInstructionMode) {
                    if (retries < MAX_RETRIES && !allNarrative.trim()) {
                        // Wait before sending nudge to give model time
                        await new Promise(resolve => setTimeout(resolve, NUDGE_DELAY_MS));

                        // Clean previous nudges from history to prevent loops
                        cleanNudgesFromHistory();

                        retries++;
                        consecutiveNudges++;
                        agentMessages.push({ role: 'user', content: "⚠️ PROTOCOLO DE AGENTE INCOMPLETO: Debes proporcionar una respuesta para concluir tu misión." });
                        continue;
                    }
                }

                // === SOURCE ATTRIBUTION (replaces old final_answer sources logic) ===
                if ((isAgentMode || isInstructionMode) && allNarrative.trim()) {
                    const sources = autoExtractSources(actionHistory, agentMessages, tools);
                    if (sources.length > 0) {
                        allNarrative += '\n\n---DIVIDER---\n\n**🔍 Bibliografía:**\n' + sources.slice(0, 10).map((s: string) => `• ${s}`).join('\n');
                    }
                }

                // Refresh UI with final narrative (including sources)
                onChunk(allNarrative || '', true, allBlocks);
                break;
            }

            // ─── TOOL EXECUTION ENGINE (SAFE vs BATCH) ───
            localOnStatus({ phase: 'tool_calling' });
            const READ_ONLY = new Set([
                'read_file', 'list_files', 'search_files', 'web_search', 'read_url', 'get_file_outline',
                'get_console_status', 'get_system_metrics', 'list_available_skills', 'instruction_booklet'
            ]);

            const isAuto = (tc: ToolCall) => {
                const tn = tc.function.name;
                const args = tc.function.arguments;

                // 1. DANGEROUS OPERATIONS: ALWAYS REQUIRE MANUAL APPROVAL
                if (tn === 'run_console') {
                    const commandPart = (args.command || '').trim();
                    const argsPart = (args.args || '').trim();
                    const fullCmd = (commandPart + ' ' + argsPart).trim();
                    const lowFullCmd = fullCmd.toLowerCase();

                    // --- HELPER: Quote-aware Shell Operator Detection ---
                    const hasShellOperators = (cmd: string) => {
                        let inQuote = false;
                        let quoteChar = '';
                        for (let i = 0; i < cmd.length; i++) {
                            const char = cmd[i];
                            if ((char === "'" || char === '"') && (i === 0 || cmd[i-1] !== '\\')) {
                                if (!inQuote) { inQuote = true; quoteChar = char; }
                                else if (char === quoteChar) { inQuote = false; }
                            }
                            if (!inQuote) {
                                if (char === ';' || char === '|') return true;
                                if (char === '&') {
                                    // Chaining: && or just & (in CMD & is an operator)
                                    return true;
                                }
                            }
                        }
                        return false;
                    };

                    // --- HELPER: Quote-aware Tokenizer ---
                    const tokenize = (cmd: string) => {
                        const tokens = [];
                        let current = '';
                        let inQuote = false;
                        let quoteChar = '';
                        for (let i = 0; i < cmd.length; i++) {
                            const char = cmd[i];
                            if ((char === "'" || char === '"') && (i === 0 || cmd[i-1] !== '\\')) {
                                if (!inQuote) { inQuote = true; quoteChar = char; }
                                else if (char === quoteChar) { inQuote = false; }
                            } else if (char === ' ' && !inQuote) {
                                if (current) tokens.push(current);
                                current = '';
                            } else {
                                current += char;
                            }
                        }
                        if (current) tokens.push(current);
                        return tokens;
                    };

                    // 1. CHAINING & OPERATOR DETECTION
                    if (hasShellOperators(fullCmd)) {
                        const containsHighRisk = HIGH_RISK_COMMANDS.some(risk => lowFullCmd.includes(risk));
                        if (containsHighRisk) return false;
                        
                        // In Agent Mode, always auto-approve non-high-risk chains
                        if (isAgentMode) return true;
                        
                        // In Chat Mode (Lax), allow chains if the primary binary is in the allowed list
                        const tokens = tokenize(commandPart);
                        const rawBinary = (tokens[0] || '').replace(/^["']|["']$/g, '');
                        const binaryBasename = rawBinary.split(/[\\/]/).pop()?.toLowerCase() || '';
                        const cmd = binaryBasename.replace(/\.exe$/i, '');
                        
                        return LAX_CONSOLE_ALLOWED_COMMANDS.includes(cmd);
                    }

                    // 2. PRIMARY BINARY EXTRACTION (Support Quoted Paths)
                    const tokens = tokenize(commandPart);
                    let rawBinary = tokens[0] || '';
                    // Clean quotes from binary path for comparison
                    rawBinary = rawBinary.replace(/^["']|["']$/g, '');
                    
                    // Extract basename if it's a path
                    const binaryBasename = rawBinary.split(/[\\/]/).pop()?.toLowerCase() || '';
                    const cmd = binaryBasename.replace(/\.exe$/i, ''); // Normalize Windows binaries
                    
                    // Reconstruct arguments for whitelist matching
                    const cmdArgs = (tokens.slice(1).join(' ') + ' ' + argsPart).trim().toLowerCase();
                    
                    // 3. RISK & WHITELIST CHECK
                    if (HIGH_RISK_COMMANDS.includes(cmd)) return false;

                    // AUTO-APPROVE SAFE COMMANDS (Basic info retrieval)
                    if (SAFE_CONSOLE_COMMANDS.includes(cmd)) return true;

                    // AUTO-APPROVE SAFE SUBCOMMANDS (Project init/test/run)
                    if (SAFE_COMMAND_SUBCOMMANDS[cmd]) {
                        const isSafeSub = SAFE_COMMAND_SUBCOMMANDS[cmd].some(sub => cmdArgs.startsWith(sub.toLowerCase()));
                        if (isSafeSub) return true;
                    }
                    
                    if (isAgentMode) return true;

                    // 4. CHAT MODE (LAX): Allow any command in the lax whitelist if not high risk
                    return LAX_CONSOLE_ALLOWED_COMMANDS.includes(cmd);
                }
                if (tn === 'request_agent_mode') return false;
                if (tn === 'batch_operation' && args.operation === 'delete') return false;
                
                // Sensitive Files Protection (SOUL, USER, IDENTITY)
                if (['update_file', 'patch_file', 'delete_file'].includes(tn)) {
                    const { target, cleanFilename: cf } = resolvePathAndSource(args.filename || '', args.source);
                    const lowCf = (cf || '').toLowerCase();
                    const isSensitive = target === 'core' && ['soul.md', 'user.md', 'identity.md'].includes(lowCf);
                    
                    if (isSensitive) return false; // Always manual for identity/core files
                    
                    if (tn === 'delete_file') {
                        // Allow auto-deletion of internal agent temp files ONLY
                        if (lowCf !== 'tasks.md' && lowCf !== 'active_context.md') return false;
                    }
                }

                // 2. CONTEXTUAL OVERRIDE (Remote/Scheduled usually auto-approve non-dangerous things)
                if (isScheduled || isRemote || !isInstructionMode) return true;

                // 3. READ-ONLY OPERATIONS
                if (READ_ONLY.has(tn)) return true;

                // 4. STRATEGIC AGENT FILES (Internal state)
                const { target, cleanFilename: cf } = resolvePathAndSource(args.filename || '', args.source);
                if (target === 'core' && (cf.toLowerCase() === 'tasks.md' || cf.toLowerCase() === 'active_context.md')) return true;

                // 5. AGENT MODE: Broad autonomy for development tools (except dangerous ones)
                if (isAgentMode) return true;

                return false;
            };

            const toolsToExecute: ToolCall[] = [];
            const toolFeedbackMap = new Map<string, string>();

            // 1. APPROVAL PHASE (Always Sequential to prevent UI collisions)
            for (const tc of uniqueToolCalls) {
                const approval = approvalMode === 'manual' || !isAuto(tc);
                
                let isApproved = true;
                let feedback = undefined;

                if (approval) {
                    const approvalResult = await onToolApproval(tc);
                    isApproved = typeof approvalResult === 'boolean' ? approvalResult : (approvalResult?.approved ?? true);
                    feedback = typeof approvalResult === 'object' ? approvalResult?.feedback : undefined;
                }

                if (feedback) toolFeedbackMap.set(tc.id!, feedback);

                if (approval && !isApproved) {
                    const content = feedback 
                        ? `manual mode error: user denied tool excecution. Feedback: ${feedback}`
                        : 'manual mode error: user denied tool excecution';
                    
                    const b = allBlocks.find(x => x.toolCall?.id === tc.id);
                    if (b) { b.status = 'denied'; }

                    agentMessages.push({
                        role: 'tool',
                        tool_name: tc.function.name || 'unknown_tool',
                        content: content,
                        tool_call_id: tc.id,
                        tool_args: tc.function.arguments,
                        thought_signature: (tc as any).thought_signature
                    });
                    turnHasDenial = true;
                    continue;
                }
                toolsToExecute.push(tc);
            }

            // 2. EXECUTION PHASE
            const executeAndLog = async (tc: ToolCall) => {
                const res = await executeToolCall(
                    tc, 
                    currentFiles, 
                    currentAdditional, 
                    currentWorkSpace, 
                    currentTools, 
                    currentRoot, 
                    saveFileFn, 
                    deleteFileFn, 
                    config, 
                    onAddTask,
                    isAgentMode,
                    isInstructionMode
                );
                const b = allBlocks.find(x => x.toolCall?.id === tc.id);
                if (b) { b.result = res; b.status = res.success ? 'success' : 'error'; }

                if (!res.success) {
                    turnHasFailure = true;
                    agentMessages.push({
                        role: 'tool',
                        tool_name: tc.function.name || 'unknown_tool',
                        content: res.error,
                        tool_call_id: tc.id,
                        tool_args: tc.function.arguments,
                        thought_signature: (tc as any).thought_signature
                    });
                } else {
                    successfulCalls.push(tc);
                    actionHistory.push(`${tc.function.name}(${JSON.stringify(tc.function.arguments)})`);
                    const feedback = toolFeedbackMap.get(tc.id!);
                    const content = feedback 
                        ? `[User Note: ${feedback}]\n\n${JSON.stringify(res)}`
                        : JSON.stringify(res);

                    agentMessages.push({
                        role: 'tool',
                        tool_name: tc.function.name || 'unknown_tool',
                        content: content,
                        tool_call_id: tc.id,
                        tool_args: tc.function.arguments,
                        thought_signature: (tc as any).thought_signature
                    });

                    // Update Local State (Only for persistent file operations)
                    if (tc.function.name === 'update_file' || tc.function.name === 'delete_file') {
                        const { target, cleanFilename: cf } = resolvePathAndSource(tc.function.arguments.filename || '', tc.function.arguments.source);
                        const store = getFileStore(target, currentFiles, currentAdditional, currentWorkSpace, currentTools, currentRoot);
                        if (tc.function.name === 'update_file') store[cf] = tc.function.arguments.content;
                        if (tc.function.name === 'delete_file') delete store[cf];
                    }
                }
            };

            // ─── EXECUTION STRATEGY (SAFE vs BATCH) ───
            // Sequential: One by one. Preferred for UX consistency and safety.
            // Parallel: Simultaneous. Allowed for high-performance agentic batches.
            const useSequential = safeMode || !isAgentMode;

            if (useSequential) {
                // SAFE/CHAT MODE: Strict sequential execution
                for (const tc of toolsToExecute) {
                    if (useAgentStore.getState().agentStatus.phase === 'aborted') break;
                    await executeAndLog(tc);
                }
            } else {
                // BATCH MODE: High-performance parallel execution (Agent Mode only)
                if (useAgentStore.getState().agentStatus.phase !== 'aborted') {
                    await Promise.all(toolsToExecute.map(tc => executeAndLog(tc)));
                }
            }

            if (turnHasFailure) {
                retries++;
            } else {
                retries = 0;
                consecutiveNudges = 0; // Reset nudge counter on success or intentional denial
            }

            // [State Awareness Refresh] Correctly update feedback for the NEXT loop iteration
            const lastCall = successfulCalls[successfulCalls.length - 1] || uniqueToolCalls[0];
            if (lastCall) {
                const actionDesc = `${lastCall.function.name}`;
                lastExecutionFeedback = `[Turn ${iterations}] Executed: ${actionDesc} -> ${turnHasFailure ? 'Errors occurred' : 'Success'}`;
            }

            const { turnAutoTasks: autoT } = await applyBatchTaskTicking([...successfulCalls], currentFiles, currentWorkSpace, saveFileFn, (m) => log('info', m));
            turnAutoTasks = autoT;

            // ─── POST-TOOL: Clean old awareness, inject fresh one (A2;A3) ───
            // Per MODES.md: ephemeral — only the LATEST awareness exists at any time
            if (isAgentMode || isInstructionMode) {
                // 1. Purge the previous awareness (genuine removal from array)
                cleanAwareness();

                // 2. Re-read tasks for freshest state
                const freshTasks = getSystemTasks();
                const freshTasksContent = freshTasks?.content || tasksContent;

                const taskLines = freshTasksContent.trim() ? freshTasksContent.split('\n') : [];
                let nextAction = 'Analyze the mission and execute the most relevant action';
                if (taskLines.length > 0) {
                    const nextTodo = taskLines.find(l => l.includes('[ ]'))?.trim();
                    nextAction = nextTodo || 'All tasks completed — Prepare final answer';
                }
                const taskProgressBlock = `\nNext Action: ${nextAction}`;
                const autoTaskInfo = turnAutoTasks.length > 0 ? `\n✨ AUTO-SYNC: Tasks automatically completed: ${turnAutoTasks.join(', ')}` : '';
                const significantCalls = successfulCalls.filter(tc => 
                    !['read_file', 'list_files', 'search_files', 'get_file_outline', 'get_system_metrics', 'read_url', 'add_scheduled_task'].includes(tc.function.name)
                );
                const unplannedInfo = (significantCalls.length > 0 && turnAutoTasks.length === 0 && freshTasksContent.includes('[ ]'))
                    ? '\n⚠️ NOTE: You have performed actions that do not seem to match any pending task in your plan.' : '';

                // 3. Inject fresh awareness into the LAST message (usually a tool response)
                const workPlan = `[CURRENT_WORK_PLAN]\n${freshTasksContent.trim() || 'No active tasks.'}\n[/CURRENT_WORK_PLAN]`;
                const awarenessBlock = `\n\n--- ON DUTY REPORT ---\n[AGENT_STATE]\nCurrent Turn: ${iterations}\n[/AGENT_STATE]\n[OPERATION_FOCUS]\nPrevious Result: ${lastExecutionFeedback}${autoTaskInfo}${unplannedInfo}${taskProgressBlock}\n[/OPERATION_FOCUS]\n${workPlan}`;
                
                const lastMsg = agentMessages[agentMessages.length - 1];
                if (lastMsg) {
                    lastMsg.content = (lastMsg.content || '').trim() + awarenessBlock;
                } else {
                    // Fallback if history is empty
                    agentMessages.push({ role: 'user', content: awarenessBlock });
                }
            }
        }
    } catch (err) {
        hasFatalError = true;
        const errorMsg = `[CRITICAL_FAIL] ${err instanceof Error ? err.message : String(err)}`;
        log('error', errorMsg);
        // Only provide a minimal chunk to avoid visual clutter during fallback transitions
        onChunk(`\n\n${errorMsg}`, false, []);
        throw err;
    } finally {
        if (!hasFatalError) {
            onStatus({ 
                phase: abortSignal.aborted ? 'aborted' : 'idle', 
                elapsedMs: Date.now() - startTime 
            });
        }
        // ─── FINAL SWEEP: Remove all ephemeral awareness from saved history ───
        cleanAwareness();
        if (onFinalRawHistory) onFinalRawHistory([...agentMessages]);
    }
}
