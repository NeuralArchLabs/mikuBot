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
    MessageBlock 
} from '../../types';
import { 
    PROTECTED_CORE_FILES, 
    CONSOLE_ALLOWED_COMMANDS, 
    CONSOLE_BLOCKED_PATTERNS 
} from '../../constants';
import { validateToolArgs, safeFetch } from '../../utils';
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
    onToolApproval: (toolCall: ToolCall) => Promise<boolean>,
    onAddTask: (task: any) => Promise<string>,
    abortSignal: AbortSignal,
    onFinalRawHistory?: (history: any[]) => void,
    useTextExtraction: boolean = true,
    isAgentMode: boolean = false,
    safeMode: boolean = false,
    approvalMode: ApprovalMode = 'auto',
    isInstructionMode: boolean = false,
    isScheduled: boolean = false
): Promise<void> {

    console.log(`[Agent] sendAgentMessage called: isScheduled=${isScheduled}, isAgentMode=${isAgentMode}, safeMode=${safeMode}, approvalMode=${approvalMode}, isInstructionMode=${isInstructionMode}`);

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
        if (msg.role === 'user' && m.timestamp) {
            const d = new Date(m.timestamp);
            const locale = config.language || 'en';
            const month = d.toLocaleString(locale, { month: 'short' }).toUpperCase().replace('.', '');
            const day = d.toLocaleString(locale, { day: '2-digit' });
            const time = d.toLocaleString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
            const ts = `${month}/${day} ${time}`;
            msg.content = `[${ts}] ${msg.content || ''}`;
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
                return { role: 'user', content: `[LOG DE SISTEMA] ${summary}` };
            } catch { return m; }
        }
        return msg;
    });

    let activeContext = historicalContext;
    if (isAgentMode || isInstructionMode) {
        const filtered = historicalContext.filter(m => !m.content.startsWith('⚠️ Command Executed:'));
        const windowSize = isInstructionMode ? 10 : 30;
        activeContext = filtered.slice(-windowSize);
    }

    const agentMessages: any[] = [
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
    let iterations = 0;
    let retries = 0;
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

    // --- Main Loop ---
    try {
        while (!abortSignal.aborted) {
            if (retries >= MAX_RETRIES) {
                log('warn', `Max retries reached (${MAX_RETRIES}). Stopping.`);
                localOnStatus({ phase: 'error', retries, maxRetries: MAX_RETRIES, errorCount: retries, elapsedMs: Date.now() - startTime, rawMessages: [...agentMessages] });
                break;
            }

            iterations++;
            let turnHasFailure = false;
            let turnAutoTasks: string[] = [];
            let tasksContent = '';
            let successfulCalls: ToolCall[] = [];

            // System Prompt Refresh (Strict Protocol: @CORE/tasks.md)
            if (isAgentMode || isInstructionMode) {
                const taskMatch = getSystemTasks();
                tasksContent = taskMatch?.content || '';

                
                const taskLines = tasksContent.trim() ? tasksContent.split('\n') : [];
                // Always show next action — guide the agent
                let nextAction = 'Analyze the mission and execute the most relevant action';
                if (taskLines.length > 0) {
                    const nextTodo = taskLines.find(l => l.includes('[ ]'))?.trim();
                    nextAction = nextTodo || 'All tasks completed — Prepare final answer';
                }
                const taskProgressBlock = `\nNext Action: ${nextAction}`;

                const autoTaskInfo = turnAutoTasks.length > 0 ? `\n✨ AUTO-SYNC: Tasks automatically completed: ${turnAutoTasks.join(', ')}` : "";
                const unplannedInfo = (successfulCalls.length > 0 && turnAutoTasks.length === 0 && tasksContent.includes('[ ]')) 
                    ? "\n⚠️ NOTE: You have performed actions that do not seem to match any pending task in your plan." : "";

                const awarenessBlock = `[AGENT_STATE]\nOriginal Mission: "${missionTrigger}"\nCurrent Turn: ${iterations} of ${MAX_RETRIES}\n[/AGENT_STATE]\n[OPERATION_FOCUS]\nPrevious Result: ${lastExecutionFeedback}${autoTaskInfo}${unplannedInfo}${taskProgressBlock}\n[/OPERATION_FOCUS]`;
                const workPlanBlock = `\n[CURRENT_WORK_PLAN]\n${(tasksContent || '').trim() || 'No active tasks.'}\n[/CURRENT_WORK_PLAN]\n`;
                let sCurrent = agentMessages[0].content;
                const wpStart = sCurrent.indexOf("[CURRENT_WORK_PLAN]");
                const wpEnd = sCurrent.indexOf("[/CURRENT_WORK_PLAN]");
                if (wpStart !== -1 && wpEnd !== -1) {
                    sCurrent = sCurrent.substring(0, wpStart).trimEnd() + "\n" + workPlanBlock + "\n" + sCurrent.substring(wpEnd + "[/CURRENT_WORK_PLAN]".length).trimStart();
                }
                const mStart = "[AGENT_STATE]";
                const mEnd = "[/OPERATION_FOCUS]";
                const si = sCurrent.indexOf(mStart);
                const ei = sCurrent.indexOf(mEnd);
                if (si !== -1 && ei !== -1) {
                    agentMessages[0].content = sCurrent.substring(0, si) + awarenessBlock + sCurrent.substring(ei + mEnd.length);
                } else {
                    agentMessages[0].content = awarenessBlock + "\n" + sCurrent;
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
                if (retries < MAX_RETRIES && (!content || content.trim() === '')) {
                    retries++;
                    const nudge = (turnHasFailure || lastExecutionFeedback.includes('⚠️')) 
                        ? "⚠️ TURN GENERATED NO ACTIONS: Blockers or errors detected. Do not stop, try a different approach."
                        : (isAgentMode || isInstructionMode) 
                            ? "⚠️ INCOMPLETE AGENT PROTOCOL: You must provide a response or execute tools to proceed."
                            : "⚠️ EMPTY RESPONSE: Please provide a response to continue the conversation.";
                    agentMessages.push({ role: 'user', content: nudge });
                    continue;
                }
                if (isAgentMode || isInstructionMode) {
                    if (retries < MAX_RETRIES && !allNarrative.trim()) {
                        retries++;
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


            // TOOL EXECUTION
            localOnStatus({ phase: 'tool_calling' });
            const READ_ONLY = new Set(['read_file', 'list_files', 'search_files', 'web_search', 'read_url', 'get_file_outline']);
            
            const isAuto = (tc: ToolCall) => {
                if (isScheduled) return true;
                const tn = tc.function.name;
                if (READ_ONLY.has(tn)) return true;
                const { target, cleanFilename: cf } = resolvePathAndSource(tc.function.arguments.filename || '', tc.function.arguments.source);
                if (target === 'core' && (cf.toLowerCase() === 'tasks.md' || cf.toLowerCase() === 'active_context.md')) return true;
                if (isAgentMode && tn !== 'run_console') return true;
                return false;
            };

            for (const tc of uniqueToolCalls) {
                const approval = approvalMode === 'manual' || !isAuto(tc);
                if (approval && !await onToolApproval(tc)) {
                    agentMessages.push({ 
                        role: 'tool', 
                        tool_name: tc.function.name, 
                        content: 'Rejected', 
                        tool_call_id: tc.id, 
                        tool_args: tc.function.arguments,
                        thought_signature: (tc as any).thought_signature
                    });
                    turnHasFailure = true;
                    continue;
                }
                const res = await executeToolCall(tc, currentFiles, currentAdditional, currentWorkSpace, currentTools, currentRoot, saveFileFn, deleteFileFn, config, onAddTask);
                const b = allBlocks.find(x => x.toolCall?.id === tc.id);
                if (b) { b.result = res; b.status = res.success ? 'success' : 'error'; }
                if (!res.success) {
                    retries++;
                    agentMessages.push({ 
                        role: 'tool', 
                        tool_name: tc.function.name, 
                        content: res.error, 
                        tool_call_id: tc.id, 
                        tool_args: tc.function.arguments,
                        thought_signature: (tc as any).thought_signature
                    });
                    turnHasFailure = true;
                } else {
                    retries = 0;
                    successfulCalls.push(tc);
                    actionHistory.push(`${tc.function.name}(${JSON.stringify(tc.function.arguments)})`);
                    agentMessages.push({ 
                        role: 'tool', 
                        tool_name: tc.function.name, 
                        content: JSON.stringify(res), 
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
            }

            // [State Awareness Refresh] Correctly update feedback for the NEXT loop iteration
            const lastCall = successfulCalls[successfulCalls.length - 1] || uniqueToolCalls[0];
            if (lastCall) {
                const actionDesc = `${lastCall.function.name}`;
                lastExecutionFeedback = `[Turn ${iterations}] Executed: ${actionDesc} -> ${turnHasFailure ? 'Errors occurred' : 'Success'}`;
            }

            const { turnAutoTasks: autoT } = await applyBatchTaskTicking([...successfulCalls], currentFiles, currentWorkSpace, saveFileFn, (m) => log('info', m));
            turnAutoTasks = autoT;
        }
    } catch (err) {
        hasFatalError = true;
        const errorMsg = `[CRITICAL_FAIL] ${err instanceof Error ? err.message : String(err)}`;
        log('error', errorMsg);
        onChunk(`\n\n❌ ERROR EN EL NÚCLEO:\n${errorMsg}`, false, [...allBlocks, { type: 'answer', content: `\n\n⚠️ ${errorMsg}` }]);
        throw err;
    } finally {
        if (!hasFatalError) onStatus({ phase: 'idle', elapsedMs: Date.now() - startTime });
        if (onFinalRawHistory) onFinalRawHistory([...agentMessages]);
    }
}
