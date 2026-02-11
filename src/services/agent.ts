import { ToolCall, ToolResult, ToolDefinition, AppConfig, AgentStatus, AgentLogEntry, FileTarget } from '../types';
import { PROTECTED_CORE_FILES, CONSOLE_ALLOWED_COMMANDS, CONSOLE_BLOCKED_PATTERNS } from '../constants';
import { validateToolArgs, extractToolCallsFromText, safeFetch } from '../utils';
import { recoverToolCallsFromText, normalizeRawToolCall } from './toolCallNormalizer';

/**
 * Resolves the source argument from a tool call into a FileTarget.
 * Defaults to 'sandbox' when source is omitted or unrecognized.
 */
function resolveSource(source?: string): FileTarget {
    if (source === 'core') return 'core';
    if (source === 'library' || source === 'extra') return 'extra';
    return 'sandbox';
}

function getFileStore(
    target: FileTarget,
    files: Record<string, string>,
    additionalFiles: Record<string, string>,
    sandboxFiles: Record<string, string>,
): Record<string, string> {
    switch (target) {
        case 'core': return files;
        case 'extra': return additionalFiles;
        case 'sandbox': return sandboxFiles;
    }
}

export async function executeToolCall(
    toolCall: ToolCall,
    files: Record<string, string>,
    additionalFiles: Record<string, string>,
    sandboxFiles: Record<string, string>,
    saveFileFn: (name: string, content: string, target: FileTarget) => Promise<boolean>,
    config: AppConfig
): Promise<ToolResult> {
    const { name, arguments: args } = toolCall.function;

    try {
        switch (name) {
            case 'read_file': {
                const target = resolveSource(args.source);
                const store = getFileStore(target, files, additionalFiles, sandboxFiles);
                const content = store[args.filename];
                if (content !== undefined) {
                    return { success: true, data: { filename: args.filename, content, source: target } };
                }
                return { success: false, error: `File "${args.filename}" not found in ${target} folder.` };
            }

            case 'update_file': {
                if (!args.filename) {
                    return { success: false, error: 'Missing required parameter: filename.' };
                }

                const target = resolveSource(args.source);

                const isProtected = PROTECTED_CORE_FILES.some(p =>
                    args.filename === p || args.filename.endsWith('/' + p)
                );

                if (target === 'core' && isProtected) {
                    return { success: false, error: `"${args.filename}" is a PROTECTED identity file and cannot be modified by tools. Only ACTIVE_CONTEXT.md and TASKS.md are writable in core.` };
                }

                const saved = await saveFileFn(args.filename, args.content, target);
                if (saved) {
                    return { success: true, data: { filename: args.filename, message: `File "${args.filename}" saved to ${target}.`, source: target } };
                }
                return { success: false, error: `Failed to save "${args.filename}". Ensure the ${target} folder is configured in Settings.` };
            }

            case 'list_files': {
                const target = resolveSource(args.source);
                const store = getFileStore(target, files, additionalFiles, sandboxFiles);
                const fileList = Object.keys(store).map(f => ({
                    name: f,
                    size: store[f].length
                }));
                return { success: true, data: { files: fileList, count: fileList.length, source: target } };
            }

            case 'search_files': {
                const target = resolveSource(args.source);
                const store = getFileStore(target, files, additionalFiles, sandboxFiles);
                const query = args.query.toLowerCase();
                const matches: { filename: string; lines: string[] }[] = [];
                for (const [filename, content] of Object.entries(store)) {
                    const matchingLines = content.split('\n')
                        .filter(line => line.toLowerCase().includes(query))
                        .slice(0, 5);
                    if (matchingLines.length > 0) {
                        matches.push({ filename, lines: matchingLines });
                    }
                }
                return { success: true, data: { query: args.query, matches, totalFiles: matches.length, source: target } };
            }

            case 'web_search': {
                // Try Tavily first
                if (config.tavilyApiKey) {
                    try {
                        const data = await safeFetch('https://api.tavily.com/search', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                api_key: config.tavilyApiKey,
                                query: args.query,
                                search_depth: args.search_depth || 'basic',
                                include_answer: true,
                            })
                        });
                        return { success: true, data };
                    } catch (e) {
                        console.error("Tavily failed, trying Brave...", e);
                    }
                }

                // Fallback to Brave Search
                if (config.braveApiKey) {
                    try {
                        const data = await safeFetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(args.query)}`, {
                            headers: {
                                'Accept': 'application/json',
                                'X-Subscription-Token': config.braveApiKey
                            }
                        });
                        return { success: true, data };
                    } catch (e) {
                        return { success: false, error: `Brave Search Error: ${e instanceof Error ? e.message : String(e)}` };
                    }
                }

                return { success: false, error: 'No Search API Key configured (Tavily or Brave). Please add one in Settings.' };
            }

            case 'read_url': {
                if (!config.tavilyApiKey) {
                    return { success: false, error: 'Tavily API Key not found. Please add it in Settings.' };
                }
                try {
                    const data = await safeFetch('https://api.tavily.com/extract', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            api_key: config.tavilyApiKey,
                            urls: [args.url]
                        })
                    });
                    return { success: true, data: data.results?.[0] || data };
                } catch (e) {
                    return { success: false, error: `Read URL Error: ${e instanceof Error ? e.message : String(e)}` };
                }
            }

            case 'run_console': {
                const cmd = (args.command || '').trim().toLowerCase();

                // Security Layer 1: Command whitelist
                if (!CONSOLE_ALLOWED_COMMANDS.includes(cmd)) {
                    return {
                        success: false,
                        error: `⛔ BLOCKED: "${cmd}" is not in the allowed commands list. Allowed: ${CONSOLE_ALLOWED_COMMANDS.join(', ')}`
                    };
                }

                // Security Layer 2: Blocked patterns in args
                const cmdArgs = args.args || '';
                for (const pattern of CONSOLE_BLOCKED_PATTERNS) {
                    if (pattern.test(cmdArgs)) {
                        return {
                            success: false,
                            error: `⛔ BLOCKED: Arguments contain a forbidden pattern (${pattern.source}). Shell metacharacters and path traversal are not allowed.`
                        };
                    }
                }

                // Security Layer 3: This runs in the browser, so we delegate to Electron
                const isElectron = !!(window as any).electron?.invoke;
                if (!isElectron) {
                    return {
                        success: false,
                        error: 'Console execution requires the Electron desktop app. Not available in browser mode.'
                    };
                }

                try {
                    const result = await (window as any).electron.invoke('run-console', {
                        command: cmd,
                        args: cmdArgs,
                        cwd: args.cwd || '',
                    });
                    return {
                        success: result.code === 0,
                        data: {
                            stdout: (result.stdout || '').slice(0, 2000),
                            stderr: (result.stderr || '').slice(0, 500),
                            exitCode: result.code,
                            command: `${cmd} ${cmdArgs}`.trim(),
                        }
                    };
                } catch (e) {
                    return { success: false, error: `Console Error: ${e instanceof Error ? e.message : String(e)}` };
                }
            }

            default:
                return { success: false, error: `Unknown tool: ${name}` };
        }
    } catch (e) {
        return { success: false, error: `Tool execution error: ${e instanceof Error ? e.message : String(e)}` };
    }
}

export async function sendAgentMessage(
    config: AppConfig,
    systemPrompt: string,
    chatMessages: { role: string; content: string }[],
    tools: ToolDefinition[],
    files: Record<string, string>,
    additionalFiles: Record<string, string>,
    sandboxFiles: Record<string, string>,
    saveFileFn: (name: string, content: string, target: FileTarget) => Promise<boolean>,
    onChunk: (text: string, replace?: boolean, blocks?: any[]) => void,
    onStatus: (status: Partial<AgentStatus>) => void,
    onToolApproval: (toolCall: ToolCall) => Promise<boolean>,
    abortSignal: AbortSignal,
    useTextExtraction: boolean = true,
    isAgentMode: boolean = false
): Promise<void> {

    const log = (type: AgentLogEntry['type'], message: string, details?: any) => {
        onStatus({ log: [{ timestamp: Date.now(), type, message, details }] });
    };

    // Track whether this model supports native tools for the duration of this specific task
    let modelSupportsNativeTools = true;

    // Accumulated blocks across all iterations for the current message
    let allBlocks: any[] = [];

    async function streamOllamaRequest(
        messages: any[],
        useTools: boolean,
    ): Promise<{ content: string; toolCalls: any[] }> {
        // Filter out empty messages to prevent 400 Bad Request
        const filteredMessages = messages.filter(m => m.content || (m.tool_calls && m.tool_calls.length > 0));

        const body: any = {
            model: config.model,
            messages: filteredMessages,
            stream: true,
            options: { temperature: config.temperature },
        };
        if (useTools && modelSupportsNativeTools) body.tools = tools;

        const response = await fetch(`${config.ollamaUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: abortSignal,
        });

        if (response.status === 400 && useTools && modelSupportsNativeTools) {
            log('warn', 'Este modelo está siendo optimizado para el llamado y uso de herramientas');
            // Remember that this model doesn't support native tool calling
            modelSupportsNativeTools = false;
            return streamOllamaRequest(messages, false);
        }

        if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            console.error(`Ollama Error [${response.status}]:`, errBody);
            throw new Error(`Ollama HTTP ${response.status}: ${errBody}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let toolCalls: any[] = [];

        if (reader) {
            while (true) {
                if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(Boolean);
                for (const line of lines) {
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.message?.content) {
                            fullContent += parsed.message.content;
                            // During streaming, just update the status — DON'T build blocks yet
                            onStatus({ streamedText: fullContent, phase: 'streaming' });
                        }
                        if (parsed.message?.tool_calls) {
                            toolCalls = [...toolCalls, ...parsed.message.tool_calls];
                        }
                    } catch { }
                }
            }
        }

        return { content: fullContent, toolCalls };
    }

    const ollamaMessages: any[] = [
        { role: 'system', content: systemPrompt },
        ...chatMessages,
    ];

    // ── Counters ──────────────────────────────────────────────────────
    // iterations: purely informational, never caps the loop
    // retries:    counts consecutive failures/nudges; resets to 0 on ANY successful tool execution
    const MAX_RETRIES = 10;
    let iterations = 0;
    let retries = 0;
    let actionHistory: string[] = [];

    // ── Repetition Detection ─────────────────────────────────────────
    // Tracks how many times the exact same action (tool+args fingerprint) has been called.
    // If any action reaches 3 occurrences, we inject a special nudge to break the loop.
    const actionFingerprints: Map<string, number> = new Map();
    const REPETITION_THRESHOLD = 3;

    // ── Per-Tool Failure Tracking ────────────────────────────────────
    // Tracks consecutive failures PER TOOL NAME (regardless of arguments).
    // If a tool fails 5+ times in a row, we nudge the agent to stop using it.
    const toolConsecutiveFailures: Map<string, number> = new Map();
    const TOOL_FAILURE_THRESHOLD = 5;
    // Set of tools the agent has been told to stop using
    const exhaustedTools: Set<string> = new Set();

    // ── Timer ────────────────────────────────────────────────────────
    const startTime = Date.now();

    /**
     * Generates a deterministic fingerprint for a tool call
     * so we can detect when the agent is calling the same action repeatedly.
     */
    function getActionFingerprint(toolName: string, args: Record<string, any>): string {
        // Sort keys for deterministic comparison
        const sortedArgs = Object.keys(args).sort().reduce((acc, key) => {
            acc[key] = args[key];
            return acc;
        }, {} as Record<string, any>);
        return `${toolName}|${JSON.stringify(sortedArgs)}`;
    }

    // ── Main Agent Loop ──────────────────────────────────────────────
    // Runs indefinitely until: user aborts, agent concludes, or retries exhaust.
    while (!abortSignal.aborted) {
        if (retries >= MAX_RETRIES) {
            // ── Graceful Shutdown ────────────────────────────────────
            // Instead of just stopping, give the agent ONE final turn to explain
            // what went wrong so the user gets a meaningful message.
            log('warn', `Max retries reached (${MAX_RETRIES}). Requesting final explanation from model...`);
            onStatus({ phase: 'error', retries, maxRetries: MAX_RETRIES, errorCount: retries, elapsedMs: Date.now() - startTime });

            try {
                const failedToolsList = Array.from(toolConsecutiveFailures.entries())
                    .filter(([, count]) => count > 0)
                    .map(([name, count]) => `- ${name}: failed ${count} time(s)`)
                    .join('\n');

                const historyText = actionHistory.length > 0
                    ? actionHistory.map((a, i) => `${i + 1}. ${a}`).join('\n')
                    : '(no successful actions were completed)';

                ollamaMessages.push({
                    role: 'user',
                    content: `⛔ TASK HALTED: You have reached the maximum error limit (${MAX_RETRIES} consecutive failures).\n\nTool failure summary:\n${failedToolsList}\n\nActions completed before failure:\n${historyText}\n\nINSTRUCTION: Do NOT attempt any more tool calls. Instead, respond with a clear text explanation for the user:\n1. What you were trying to accomplish\n2. What went wrong and why you couldn't complete it\n3. What the user can do to resolve the issue (e.g., check API keys, network, etc.)`
                });

                const finalResult = await streamOllamaRequest([...ollamaMessages], false);
                if (finalResult.content) {
                    allBlocks.push({ type: 'text', content: finalResult.content });
                    onChunk(finalResult.content, true, allBlocks);
                }
            } catch (e) {
                log('error', `Failed to get final explanation: ${e instanceof Error ? e.message : String(e)}`);
            }

            onStatus({ phase: 'error', retries, maxRetries: MAX_RETRIES, errorCount: retries, elapsedMs: Date.now() - startTime });
            break;
        }

        iterations++;
        const elapsed = Date.now() - startTime;
        onStatus({ phase: 'thinking', iteration: iterations, retries, maxRetries: MAX_RETRIES, elapsedMs: elapsed });
        log('info', `Step ${iterations} (${(elapsed / 1000).toFixed(1)}s): Neural Engine processing...`);

        let content: string;
        let nativeToolCalls: any[];

        try {
            // ── CONTEXT & STATUS INJECTION ───────────────────────────────────
            const messagesForModel = [...ollamaMessages];

            if (isAgentMode && actionHistory.length > 0) {
                const historyText = actionHistory.map((a, i) => `🔹 ${a}`).join('\n');
                const lastMsg = messagesForModel[messagesForModel.length - 1];

                const statusUpdate = `[SYSTEM STATUS UPDATE]
NEURAL CORTEX HISTORY:
${historyText}

INSTRUCTIONS FOR NEXT STEP:
1. Review the history. Do NOT repeat actions already completed.
2. If tasks remain, output the NEXT JSON tool call (new action).
3. If the objective is met, provide a text summary and STOP.
4. IMPORTANT: Do NOT read/write the same file twice in a row.`;

                // If the last message was also a USER message (nudge), merge them to avoid consecutive user blocks
                if (lastMsg?.role === 'user') {
                    lastMsg.content = `${lastMsg.content}\n\n${statusUpdate}`;
                } else {
                    messagesForModel.push({ role: 'user', content: statusUpdate });
                }
            }

            const result = await streamOllamaRequest(messagesForModel, useTextExtraction);
            content = result.content;
            nativeToolCalls = result.toolCalls;
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                onStatus({ phase: 'aborted' });
                log('warn', 'Neural Core: Aborted by user signal');
                return;
            }
            throw err;
        }

        // --- Build tool calls to process ---
        let toolCallsToProcess: ToolCall[] = [];

        // 1) Native tool calls from Ollama (apply normalization dictionary even to native calls)
        if (nativeToolCalls && nativeToolCalls.length > 0) {
            log('info', `Model returned ${nativeToolCalls.length} native tool call(s). Normalizing...`);
            for (const tc of nativeToolCalls) {
                try {
                    const rawArgs = typeof tc.function.arguments === 'string'
                        ? JSON.parse(tc.function.arguments)
                        : tc.function.arguments;

                    const normResult = normalizeRawToolCall({
                        name: tc.function.name,
                        arguments: rawArgs
                    }, tools);

                    if (normResult.toolCall) {
                        // Keep the original ID if possible
                        normResult.toolCall.id = tc.id || normResult.toolCall.id;
                        toolCallsToProcess.push(normResult.toolCall);
                        for (const w of normResult.warnings) log('warn', `  ↳ ${w}`);
                    } else if (normResult.blocked) {
                        log('error', `🚫 SEC-BLOCK: ${normResult.warnings[0]}`);
                    } else {
                        log('warn', `Native tool call "${tc.function.name}" could not be normalized.`);
                    }
                } catch {
                    log('error', `Failed to parse tool call arguments for "${tc.function.name}"`);
                    retries++;
                }
            }
        }

        // 2) Text extraction fallback — use full "Hallucination Dictionary" recovery pipeline
        if (toolCallsToProcess.length === 0 && content && useTextExtraction) {
            log('info', 'Searching for deformed or hidden tool calls in text response...');
            const { calls: recovered, warnings } = recoverToolCallsFromText(content, tools);

            if (recovered.length > 0) {
                log('info', `✨ Neural Recovery: Capturados ${recovered.length} llamados ruidosos/deformes`);
                for (const w of warnings) log('warn', `  ↳ ${w}`);
                toolCallsToProcess = recovered;
            } else {
                // Last resort: simpler regex (may catch things recovery missed)
                const extracted = extractToolCallsFromText(content);
                if (extracted.length > 0) {
                    log('info', `Extracted ${extracted.length} tool call(s) via legacy regex fallback`);
                    toolCallsToProcess = extracted;
                }
            }
        }

        // Push assistant message into history
        ollamaMessages.push({
            role: 'assistant',
            content: content || '',
            ...(nativeToolCalls && nativeToolCalls.length > 0 ? { tool_calls: nativeToolCalls } : {}),
        });

        // --- NOW build blocks from the COMPLETE response ---
        // Separate any conversational text from tool call JSON artifacts
        let cleanText = content || '';
        if (toolCallsToProcess.length > 0 && !modelSupportsNativeTools) {
            // Remove code blocks first
            cleanText = cleanText.replace(/```json\s*\{[\s\S]*?\}\s*```/g, '');
            cleanText = cleanText.replace(/```\s*\{[\s\S]*?\}\s*```/g, '');

            // Remove any JSON-like objects that were identified as tool calls
            const toolNames = tools.map(t => t.function.name);
            toolNames.forEach(tn => {
                // Remove style: fn_name({...})
                const fnRegex = new RegExp(`${tn}\\s*\\(\\s*\\{[\\s\\S]*?\\}\\s*\\)`, 'g');
                cleanText = cleanText.replace(fnRegex, '');
            });

            // Remove style: { "name": "...", "arguments": {...} }
            cleanText = cleanText.replace(/\{[\s\S]*?"name"\s*:\s*"(read_file|update_file|list_files|search_files|web_search|read_url|run_console)"[\s\S]*?\}/g, '');
            cleanText = cleanText.trim();
        }

        // Build blocks for this iteration
        const iterationBlocks: any[] = [];
        if (cleanText.trim()) {
            iterationBlocks.push({ type: 'text', content: cleanText });
        }
        for (const tc of toolCallsToProcess) {
            iterationBlocks.push({
                type: 'tool_call',
                content: `Llamando a: ${tc.function.name}`,
                toolCall: tc
            });
        }

        // If no tool calls found, this is a pure text response
        if (toolCallsToProcess.length === 0) {
            if (isAgentMode) {
                if (actionHistory.length > 0) {
                    // Agent completed actions and is now summarizing → accept as completion
                    log('info', 'Agent provided text summary after actions. Task complete.');
                    allBlocks = [...allBlocks, ...iterationBlocks];
                    onChunk(content, true, allBlocks);
                    onStatus({ phase: 'idle', elapsedMs: Date.now() - startTime });
                    break;
                } else {
                    // No actions yet, but provided text? Nudge for tool call.
                    if (retries < MAX_RETRIES) {
                        log('warn', `Step ${iterations}: No tool call detected. Nudging model... (retry ${retries + 1}/${MAX_RETRIES})`);
                        retries++;

                        allBlocks = [...allBlocks, ...iterationBlocks];
                        onChunk(content, true, allBlocks);

                        ollamaMessages.push({
                            role: 'user',
                            content: '⚠️ ATTENTION: Your response did not contain a valid JSON tool call. In Agent/Instruction mode, you MUST start by calling a tool. Output specific JSON: {"name": "tool_name", "arguments": {...}}'
                        });
                        onStatus({ retries, maxRetries: MAX_RETRIES, elapsedMs: Date.now() - startTime });
                        continue;
                    }
                }
            } else {
                // Chat mode -> text is fine.
                allBlocks = [...allBlocks, ...iterationBlocks];
                onChunk(content, true, allBlocks);
                onStatus({ phase: 'idle', elapsedMs: Date.now() - startTime });
                break;
            }
        }

        // ── REPETITION DETECTION ─────────────────────────────────────
        // Before executing, check if ANY tool call is a repeat of a previous action.
        let repetitionDetected = false;
        for (const toolCall of toolCallsToProcess) {
            const fingerprint = getActionFingerprint(toolCall.function.name, toolCall.function.arguments);
            const count = (actionFingerprints.get(fingerprint) || 0) + 1;
            actionFingerprints.set(fingerprint, count);

            if (count >= REPETITION_THRESHOLD) {
                repetitionDetected = true;
                log('warn', `🔄 Repetition detected: "${toolCall.function.name}" with identical arguments has been called ${count} times.`);
            }
        }

        if (repetitionDetected) {
            // Instead of executing the repeated action, inject a correction nudge
            log('warn', 'Breaking repetition loop — nudging model to advance or conclude.');

            const historyText = actionHistory.map((a, i) => `${i + 1}. ${a}`).join('\n');
            ollamaMessages.push({
                role: 'user',
                content: `⚠️ LOOP DETECTED: You are repeating the exact same action with the same arguments. This is NOT productive.\n\nYou have already completed:\n${historyText}\n\nYou MUST do one of the following:\n1. Call a DIFFERENT tool or use DIFFERENT arguments to make progress.\n2. If the task is complete, output a final text summary of what you accomplished.\n\nDo NOT repeat the same action again.`
            });

            retries++;
            allBlocks = [...allBlocks, ...iterationBlocks];
            onChunk(content, true, allBlocks);
            onStatus({ retries, maxRetries: MAX_RETRIES, elapsedMs: Date.now() - startTime });
            continue;
        }

        // --- Execute tool calls sequentially ---
        onStatus({ phase: 'tool_calling' });

        for (const toolCall of toolCallsToProcess) {
            if (abortSignal.aborted) {
                onStatus({ phase: 'aborted' });
                return;
            }

            const toolName = toolCall.function.name;
            onStatus({ currentTool: toolName, phase: 'waiting_approval' });
            log('tool_call', `Tool: ${toolName}`, toolCall.function.arguments);

            const validation = validateToolArgs(toolCall);
            if (!validation.valid) {
                log('error', `Validation failed: ${validation.error}`);
                retries++;

                // Update this tool's block with error
                const block = iterationBlocks.find(b => b.type === 'tool_call' && b.toolCall?.function.name === toolName && !b.result);
                if (block) block.result = { success: false, error: validation.error };

                ollamaMessages.push({
                    role: 'tool',
                    content: JSON.stringify({ success: false, error: validation.error }),
                    tool_call_id: toolCall.id
                });
                continue;
            }

            let approved: boolean;
            try {
                approved = await onToolApproval(toolCall);
            } catch {
                approved = false;
            }

            if (!approved) {
                log('warn', `Tool "${toolName}" rejected by user`);

                const block = iterationBlocks.find(b => b.type === 'tool_call' && b.toolCall?.function.name === toolName && !b.result);
                if (block) block.result = { success: false, error: 'Ejecución rechazada por el usuario.' };

                ollamaMessages.push({
                    role: 'tool',
                    content: JSON.stringify({ success: false, error: 'Tool execution rejected by user.' }),
                    tool_call_id: toolCall.id
                });
                continue;
            }

            onStatus({ phase: 'tool_executing', currentTool: toolName });
            log('info', `Executing: ${toolName}...`);

            const result = await executeToolCall(toolCall, files, additionalFiles, sandboxFiles, saveFileFn, config);
            log(result.success ? 'tool_result' : 'error',
                result.success
                    ? `✅ ${toolName}: ${result.data?.message || 'OK'}`
                    : `❌ ${toolName}: ${result.error}`,
                result
            );

            // Update this tool's block with the real result
            const block = iterationBlocks.find(b => b.type === 'tool_call' && b.toolCall?.function.name === toolName && !b.result);
            if (block) block.result = result;

            // ── Counter Logic ────────────────────────────────────────
            // Success → reset retries AND tool failure count
            // Failure → increment retries AND per-tool failure count
            if (!result.success) {
                retries++;
                const prevFails = toolConsecutiveFailures.get(toolName) || 0;
                toolConsecutiveFailures.set(toolName, prevFails + 1);
            } else {
                retries = 0; // ← KEY: successful action resets the retry counter
                toolConsecutiveFailures.set(toolName, 0); // Reset this tool's failure count
                exhaustedTools.delete(toolName); // Allow retry if it works again later
            }

            if (toolCall.function.name === 'update_file' && result.success) {
                const args = toolCall.function.arguments;
                const target = resolveSource(args.source);
                if (target === 'extra') {
                    additionalFiles = { ...additionalFiles, [args.filename]: args.content };
                } else if (target === 'core') {
                    files = { ...files, [args.filename]: args.content };
                } else {
                    sandboxFiles = { ...sandboxFiles, [args.filename]: args.content };
                }
            }

            // Build action description for both successes AND failures
            let actionDesc = '';
            const args = toolCall.function.arguments;
            switch (toolName) {
                case 'update_file': actionDesc = `Created/Updated file: "${args.filename}"`; break;
                case 'read_file': actionDesc = `Read file: "${args.filename}"`; break;
                case 'list_files': actionDesc = `Listed files in: "${args.source || 'sandbox'}"`; break;
                case 'run_console': actionDesc = `Executed command: "${args.command} ${args.args || ''}"`; break;
                case 'search_files': actionDesc = `Searched for "${args.query}" in ${args.source || 'sandbox'}`; break;
                case 'web_search': actionDesc = `Searched web for "${args.query}"`; break;
                case 'read_url': actionDesc = `Read URL: "${args.url}"`; break;
                default: actionDesc = `Executed tool: ${toolName}`;
            }
            // Mark failed actions clearly in history so the model sees its own failures
            if (result.success) {
                actionHistory.push(actionDesc);
            } else {
                actionHistory.push(`❌ FAILED: ${actionDesc} — ${result.error || 'unknown error'}`);
            }

            ollamaMessages.push({
                role: 'tool',
                content: JSON.stringify(result),
                tool_call_id: toolCall.id
            });

            // ── Per-Tool Failure Nudge ───────────────────────────────
            // If the same tool has failed TOOL_FAILURE_THRESHOLD times in a row
            // (regardless of arguments), tell the agent to stop using it.
            const currentToolFails = toolConsecutiveFailures.get(toolName) || 0;
            if (currentToolFails >= TOOL_FAILURE_THRESHOLD && !exhaustedTools.has(toolName)) {
                exhaustedTools.add(toolName);
                log('warn', `🚫 Tool "${toolName}" has failed ${currentToolFails} consecutive times. Nudging agent to use alternatives.`);

                ollamaMessages.push({
                    role: 'user',
                    content: `⚠️ TOOL UNAVAILABLE: "${toolName}" has failed ${currentToolFails} times consecutively and appears to be non-functional at this time.\n\nDo NOT call "${toolName}" again. Instead:\n1. Try a DIFFERENT tool or approach to accomplish your goal.\n2. If no alternative exists, explain to the user what you were trying to do and why "${toolName}" is failing, so they can troubleshoot.\n\nAvailable tools (excluding ${toolName}): ${tools.map(t => t.function.name).filter(n => n !== toolName).join(', ')}`
                });
            }
        }

        // After all tools in this iteration are done, push blocks and render
        allBlocks = [...allBlocks, ...iterationBlocks];
        onChunk(content, true, allBlocks);

        onStatus({ currentTool: null, retries, maxRetries: MAX_RETRIES, errorCount: retries, elapsedMs: Date.now() - startTime });

        if (retries >= 3) {
            log('warn', `${retries} consecutive retries — model may be struggling`);
        }
    }
}
