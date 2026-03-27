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
                log('warn', `El modelo ${config.model} reportó un error con herramientas nativas. Activando fallback a extracción de texto.`);
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
            const ts = new Date(m.timestamp).toLocaleString('es-ES', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '');
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

    // --- Main Loop ---
    try {
        while (!abortSignal.aborted) {
            if (retries >= MAX_RETRIES) {
                log('warn', `Max retries reached (${MAX_RETRIES}). Stopping.`);
                localOnStatus({ phase: 'error', retries, maxRetries: MAX_RETRIES, errorCount: retries, elapsedMs: Date.now() - startTime, rawMessages: [...agentMessages] });
                break;
            }

            iterations++;
            let turnAutoTasks: string[] = [];
            let tasksContent = '';
            let successfulCalls: ToolCall[] = [];

            // System Prompt Refresh (Strict Protocol: @CORE/tasks.md)
            if (isAgentMode || isInstructionMode) {
                const taskMatch = getSystemTasks();
                tasksContent = taskMatch?.content || '';

                
                const taskLines = tasksContent.trim() ? tasksContent.split('\n') : [];
                const lastDone = taskLines.filter(l => l.includes('[x]')).pop()?.trim() || 'Ninguna (Inicio)';
                let nextTodo = 'Analizar y ejecutar (Tarea Simple) o Planificar (Tarea Compleja)';
                if (taskLines.length > 0) {
                    const foundTodo = taskLines.find(l => l.includes('[ ]'))?.trim();
                    if (foundTodo) nextTodo = foundTodo;
                    else nextTodo = 'Finalización / Limpieza';
                }

                const autoTaskInfo = turnAutoTasks.length > 0 ? `\n✨ AUTO-SINC: Tareas tachadas automáticamente: ${turnAutoTasks.join(', ')}` : "";
                const unplannedInfo = (successfulCalls.length > 0 && turnAutoTasks.length === 0 && tasksContent.includes('[ ]')) 
                    ? "\n⚠️ NOTA: Has realizado acciones que no parecen coincidir con ninguna tarea pendiente en tu plan." : "";

                const awarenessBlock = `[ESTADO_DEL_AGENTE]\nMisión Original: "${missionTrigger}"\nTurno Actual: ${iterations} de ${MAX_RETRIES}\n[/ESTADO_DEL_AGENTE]\n[FOCO_DE_OPERACIÓN]\nResultado Anterior: ${lastExecutionFeedback}${autoTaskInfo}${unplannedInfo}\nTarea Completada: ${lastDone}\nSiguiente Acción: ${nextTodo}\n[/FOCO_DE_OPERACIÓN]`;
                const workPlanBlock = `\n[PLAN_DE_TRABAJO_ACTUAL]\n${(tasksContent || '').trim() || 'No hay tareas activas.'}\n[/PLAN_DE_TRABAJO_ACTUAL]\n`;
                let sCurrent = agentMessages[0].content;
                const wpStart = sCurrent.indexOf("[PLAN_DE_TRABAJO_ACTUAL]");
                const wpEnd = sCurrent.indexOf("[/PLAN_DE_TRABAJO_ACTUAL]");
                if (wpStart !== -1 && wpEnd !== -1) {
                    sCurrent = sCurrent.substring(0, wpStart).trimEnd() + "\n" + workPlanBlock + "\n" + sCurrent.substring(wpEnd + "[/PLAN_DE_TRABAJO_ACTUAL]".length).trimStart();
                }
                const mStart = "[ESTADO_DEL_AGENTE]";
                const mEnd = "[/FOCO_DE_OPERACIÓN]";
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
                    lastExecutionFeedback = "⚠️ LÍMITE DE SALIDA: Has alcanzado el número máximo de tokens por respuesta. No has podido terminar de emitir tu mensaje. Por favor, continúa desde donde te quedaste, simplifica si es necesario y cierra con final_answer cuando tu misión esté completa.";
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
                                finalToolCalls.push(norm.toolCall);
                                positionalCalls.push({ toolCall: norm.toolCall, start: content?.length || 0, end: content?.length || 0 });
                            }
                        }
                    } catch { retries++; }
                }
            }

            const uniqueToolCalls: ToolCall[] = [];
            const seenFpSet = new Set<string>();
            let bestFinalAnswer: ToolCall | null = null;
            for (const tc of [...finalToolCalls].reverse()) {
                if (tc.function.name === 'final_answer') {
                    if (!bestFinalAnswer) bestFinalAnswer = tc;
                    continue;
                }
                const fp = getActionFingerprint(tc.function.name, tc.function.arguments);
                if (!seenFpSet.has(fp)) {
                    seenFpSet.add(fp);
                    uniqueToolCalls.push(tc);
                }
            }
            if (bestFinalAnswer) uniqueToolCalls.push(bestFinalAnswer);
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
                    if (!seenFpForInterleaving.has(fp) && rc.toolCall.function.name !== 'final_answer') {
                        seenFpForInterleaving.add(fp);
                        iterationBlocks.push({ type: 'tool_call', content: `Modo: ${rc.toolCall.function.name}`, toolCall: rc.toolCall });
                    }
                }
                curIdx = rc.end;
            }
            const finalBlocks = segmentThoughtsAndNarrative((content || '').substring(curIdx), signatureRegex);
            iterationBlocks.push(...finalBlocks);

            const turnHasFinal = uniqueToolCalls.some(tc => tc.function.name === 'final_answer');
            const mergedBlocks: MessageBlock[] = [];
            iterationBlocks.forEach(block => {
                const last = mergedBlocks[mergedBlocks.length - 1];
                if (last && last.type === 'thought' && block.type === 'thought') last.content += `\n\n${block.content}`;
                else if (block.content?.trim()) mergedBlocks.push(block);
            });

            agentMessages.push({
                role: 'assistant',
                content: (nativeReasoning ? `<think>\n${nativeReasoning}\n</think>\n` : '') + (turnHasFinal ? ' ' : (content || ' ')),
                tool_calls: uniqueToolCalls.length > 0 ? JSON.parse(JSON.stringify(uniqueToolCalls)) : undefined,
            });

            onChunk(content || '', true, [...allBlocks, ...mergedBlocks]);

            const finalAnswerCall = uniqueToolCalls.find(tc => tc.function.name === 'final_answer');
            if (finalAnswerCall && isAgentMode) {
                // Protocol check MUST be strict: @CORE/tasks.md
                const taskMatch = getSystemTasks();
                const pending = (taskMatch?.content || '').split('\n').filter(l => l.trim().startsWith('- [ ]')).length;

                
                // Deadlock protection: If there's a delete_file for tasks.md in this TURN, allow final_answer
                const willDeleteTasks = uniqueToolCalls.some(tc => 
                    tc.function.name === 'delete_file' && 
                    (tc.function.arguments.filename || '').toLowerCase().includes('tasks.md')
                );

                if (taskMatch && pending > 0 && !willDeleteTasks) {
                    const nudge = `⚠️ BLOQUEO DE PROTOCOLO: Aún tienes ${pending} tareas pendientes en TASKS.md. Debes tachar todas las tareas con [x] antes de finalizar, o borrar el archivo si ya no es necesario.`;
                    agentMessages.push({ role: 'tool', tool_name: 'final_answer', content: nudge, tool_call_id: finalAnswerCall.id, tool_args: finalAnswerCall.function.arguments });
                    uniqueToolCalls.length = 0;
                    lastExecutionFeedback = nudge;
                    continue;
                }
            }


            allBlocks = [...allBlocks, ...mergedBlocks];
            if (uniqueToolCalls.length === 0) {
                if (isAgentMode || isInstructionMode) {
                    if (retries < MAX_RETRIES) {
                        retries++;
                        agentMessages.push({ role: 'user', content: '⚠️ PROTOCOLO DE AGENTE INCOMPLETO: Use final_answer to finish.' });
                        continue;
                    }
                }
                // Refresh blocks without appending more text
                onChunk('', false, allBlocks);
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

            let turnHasFailure = false;
            for (const tc of uniqueToolCalls.filter(x => x.function.name !== 'final_answer')) {
                const approval = approvalMode === 'manual' || !isAuto(tc);
                if (approval && !await onToolApproval(tc)) {
                    agentMessages.push({ role: 'tool', tool_name: tc.function.name, content: 'Rejected', tool_call_id: tc.id, tool_args: tc.function.arguments });
                    turnHasFailure = true;
                    continue;
                }
                const res = await executeToolCall(tc, currentFiles, currentAdditional, currentWorkSpace, currentTools, saveFileFn, deleteFileFn, config, onAddTask);
                const b = allBlocks.find(x => x.toolCall?.id === tc.id);
                if (b) { b.result = res; b.status = res.success ? 'success' : 'error'; }
                if (!res.success) {
                    retries++;
                    agentMessages.push({ role: 'tool', tool_name: tc.function.name, content: res.error, tool_call_id: tc.id, tool_args: tc.function.arguments });
                    turnHasFailure = true;
                } else {
                    retries = 0;
                    successfulCalls.push(tc);
                    actionHistory.push(`${tc.function.name}(${JSON.stringify(tc.function.arguments)})`);
                    agentMessages.push({ role: 'tool', tool_name: tc.function.name, content: JSON.stringify(res), tool_call_id: tc.id, tool_args: tc.function.arguments });
                    
                    // Update Local State (Only for persistent file operations)
                    if (tc.function.name === 'update_file' || tc.function.name === 'delete_file') {
                        const { target, cleanFilename: cf } = resolvePathAndSource(tc.function.arguments.filename || '', tc.function.arguments.source);
                        const store = getFileStore(target, currentFiles, currentAdditional, currentWorkSpace, currentTools);
                        if (tc.function.name === 'update_file') store[cf] = tc.function.arguments.content;
                        if (tc.function.name === 'delete_file') delete store[cf];
                    }
                }
            }

            // [State Awareness Refresh] Correctly update feedback for the NEXT loop iteration
            const lastCall = successfulCalls[successfulCalls.length - 1] || uniqueToolCalls[0];
            if (lastCall) {
                const actionDesc = `${lastCall.function.name}`;
                lastExecutionFeedback = `[Turno ${iterations}] Ejecutado: ${actionDesc} -> ${turnHasFailure ? 'Hubo errores' : 'Éxito'}`;
            }

            const { turnAutoTasks: autoT } = await applyBatchTaskTicking([...successfulCalls, ...(finalAnswerCall ? [finalAnswerCall] : [])], currentFiles, currentWorkSpace, saveFileFn, (m) => log('info', m));
            turnAutoTasks = autoT;



            if (finalAnswerCall && !turnHasFailure) {
                const args = finalAnswerCall.function.arguments;
                // Use dynamic formatter based on model type
                const formatter = createFormatter({ modelName: config.model });
                const text = formatter.format(args.text || args.respuesta || args.answer || 'Completado');
                let sources = args.sources || autoExtractSources(actionHistory, agentMessages, tools);
                let finalContent = text;
                if (sources.length > 0) finalContent += '\n\n---DIVIDER---\n\n**🔍 Bibliografía:**\n' + sources.slice(0, 10).map((s: string) => `• ${s}`).join('\n');
                
                allBlocks.push({ type: 'answer', content: finalContent });
                agentMessages.push({ role: 'tool', tool_name: 'final_answer', content: JSON.stringify({ success: true }), tool_call_id: finalAnswerCall.id, tool_args: args });
                
                const lastA = [...agentMessages].reverse().find(m => m.role === 'assistant');
                if (lastA) lastA.content = finalContent;
                onChunk(finalContent, true, allBlocks.filter(b => b.content.trim() !== ''));
                break;
            }
        }
    } catch (err) {
        log('error', `Agent Loop Error: ${err instanceof Error ? err.message : String(err)}`);
        throw err;
    } finally {
        onStatus({ phase: 'idle' });
        if (onFinalRawHistory) onFinalRawHistory([...agentMessages]);
    }
}
