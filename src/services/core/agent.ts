/**
 * Core Agent Logic
 * Path: src/services/core/agent.ts
 */
import { ToolCall, ToolResult, ToolDefinition, AppConfig, AgentStatus, AgentLogEntry, FileTarget, ApprovalMode } from '../../types';
import { PROTECTED_CORE_FILES, CONSOLE_ALLOWED_COMMANDS, CONSOLE_BLOCKED_PATTERNS } from '../../constants';
import { validateToolArgs, safeFetch } from '../../utils';
import { recoverToolCallsFromText, normalizeRawToolCall, RecoveredCall } from '../formatters/toolCallNormalizer';
import { formatFinalResponse } from '../formatters/answerFormatter';
import { formatTelegramResponse } from '../formatters/telegramFormatter';

/**
 * Resolves the source and filename from a tool call.
 * Detects prefixes like @CORE/, @EXTRA/, @WORKSPACE/, @TOOLS/ in the filename.
 */
function resolvePathAndSource(filename: string, sourceArg?: string): { target: FileTarget, cleanFilename: string } {
    let f = filename.trim();
    let target: FileTarget = 'workSpace';

    if (f.toUpperCase().startsWith('@CORE/')) {
        target = 'core';
        f = f.slice(6);
    } else if (f.toUpperCase().startsWith('@EXTRA/') || f.toUpperCase().startsWith('@LIBRARY/')) {
        target = 'extra';
        f = f.slice(7);
    } else if (f.toUpperCase().startsWith('@WORKSPACE/')) {
        target = 'workSpace';
        f = f.slice(11);
    } else if (f.toUpperCase().startsWith('@SANDBOX/')) { // Backwards compat for old prompts
        target = 'workSpace';
        f = f.slice(9);
    } else if (f.toUpperCase().startsWith('@TOOLS/')) {
        target = 'tools';
        f = f.slice(7);
    } else if (sourceArg) {
        if (sourceArg === 'core') target = 'core';
        else if (sourceArg === 'library' || sourceArg === 'extra') target = 'extra';
        else if (sourceArg === 'tools') target = 'tools';
        else target = 'workSpace';
    }

    return { target, cleanFilename: f };
}

function resolveSource(source?: string): FileTarget {
    if (source === 'core') return 'core';
    if (source === 'library' || source === 'extra') return 'extra';
    if (source === 'tools') return 'tools';
    return 'workSpace';
}

function getFileStore(
    target: FileTarget,
    files: Record<string, string>,
    additionalFiles: Record<string, string>,
    workSpaceFiles: Record<string, string>,
    toolsFiles?: Record<string, string>
): Record<string, string> {
    switch (target) {
        case 'core': return files;
        case 'extra': return additionalFiles;
        case 'workSpace': return workSpaceFiles;
        case 'tools': return toolsFiles || {};
    }
}

export async function executeToolCall(
    toolCall: ToolCall,
    files: Record<string, string>,
    additionalFiles: Record<string, string>,
    workSpaceFiles: Record<string, string>,
    toolsFiles: Record<string, string>,
    saveFileFn: (name: string, content: string, target: FileTarget) => Promise<boolean>,
    config: AppConfig
): Promise<ToolResult> {
    const { name, arguments: args } = toolCall.function;

    try {
        switch (name) {
            case 'read_file': {
                const { target, cleanFilename } = resolvePathAndSource(args.filename, args.source);
                const store = getFileStore(target, files, additionalFiles, workSpaceFiles, toolsFiles);
                const content = store[cleanFilename];
                if (content !== undefined) {
                    return { success: true, data: { filename: cleanFilename, content, source: target } };
                }
                return { success: false, error: `File "${cleanFilename}" not found in ${target} folder. (Looked in: ${target})` };
            }

            case 'update_file': {
                if (!args.filename) {
                    return { success: false, error: 'Missing required parameter: filename.' };
                }

                const { target, cleanFilename } = resolvePathAndSource(args.filename, args.source);

                const isProtected = PROTECTED_CORE_FILES.some(p => {
                    const lowFile = cleanFilename.toLowerCase();
                    const lowP = p.toLowerCase();
                    return lowFile === lowP || lowFile.endsWith('/' + lowP);
                });

                if (target === 'core' && isProtected) {
                    return { success: false, error: `"${cleanFilename}" is a PROTECTED identity file and cannot be modified by tools. Only ACTIVE_CONTEXT.md and TASKS.md are writable in core.` };
                }

                const saved = await saveFileFn(cleanFilename, args.content, target);
                if (saved) {
                    return { success: true, data: { filename: cleanFilename, message: `File "${cleanFilename}" saved to ${target}.`, source: target } };
                }
                return { success: false, error: `Failed to save "${cleanFilename}". Ensure the ${target} folder is configured in Settings.` };
            }

            case 'patch_file': {
                if (!args.filename || !args.find || args.replace === undefined) {
                    return { success: false, error: 'Missing required parameters: filename, find, replace.' };
                }

                const { target: patchTarget, cleanFilename } = resolvePathAndSource(args.filename, args.source);
                const patchStore = getFileStore(patchTarget, files, additionalFiles, workSpaceFiles, toolsFiles);
                const existingContent = patchStore[cleanFilename];

                if (existingContent === undefined) {
                    return { success: false, error: `File "${cleanFilename}" not found in ${patchTarget} folder. Cannot patch a non-existent file.` };
                }

                const patchIsProtected = PROTECTED_CORE_FILES.some(p =>
                    cleanFilename === p || cleanFilename.endsWith('/' + p)
                );
                if (patchTarget === 'core' && patchIsProtected) {
                    return { success: false, error: `"${cleanFilename}" is a PROTECTED identity file and cannot be modified.` };
                }

                // Find the exact text block
                const findIdx = existingContent.indexOf(args.find);
                if (findIdx === -1) {
                    // Try a more lenient match (trim whitespace differences)
                    const normalizedContent = existingContent.replace(/\r\n/g, '\n');
                    const normalizedFind = args.find.replace(/\r\n/g, '\n');
                    const lenientIdx = normalizedContent.indexOf(normalizedFind);

                    if (lenientIdx === -1) {
                        return {
                            success: false,
                            error: `Could not find the exact text block in "${args.filename}". The "find" parameter must match the file content character-for-character. Try using read_file first to get the exact content.`
                        };
                    }

                    // Apply lenient patch
                    const patchedContent = normalizedContent.substring(0, lenientIdx) + args.replace + normalizedContent.substring(lenientIdx + normalizedFind.length);
                    const saved = await saveFileFn(cleanFilename, patchedContent, patchTarget);
                    if (saved) {
                        return { success: true, data: { filename: cleanFilename, message: `File "${cleanFilename}" patched successfully in ${patchTarget} (lenient match).`, source: patchTarget, bytesChanged: args.replace.length - args.find.length } };
                    }
                    return { success: false, error: `Failed to save patched file "${cleanFilename}".` };
                }

                // Apply exact patch
                const patchedContent = existingContent.substring(0, findIdx) + args.replace + existingContent.substring(findIdx + args.find.length);
                const patchSaved = await saveFileFn(cleanFilename, patchedContent, patchTarget);
                if (patchSaved) {
                    return { success: true, data: { filename: cleanFilename, message: `File "${cleanFilename}" patched successfully in ${patchTarget}.`, source: patchTarget, bytesChanged: args.replace.length - args.find.length } };
                }
                return { success: false, error: `Failed to save patched file "${cleanFilename}".` };
            }

            case 'list_files': {
                const target = resolveSource(args.source);
                const store = getFileStore(target, files, additionalFiles, workSpaceFiles, toolsFiles);
                const fileList = Object.keys(store).map(f => ({
                    name: f,
                    size: (store[f] || '').length
                }));
                return { success: true, data: { files: fileList, count: fileList.length, source: target } };
            }

            case 'search_files': {
                const target = resolveSource(args.source);
                const store = getFileStore(target, files, additionalFiles, workSpaceFiles, toolsFiles);
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
                // Prioritize Native Internal Search (Python bridge) if in Electron
                if (typeof window !== 'undefined' && (window as any).electron?.runSearch) {
                    try {
                        const response = await (window as any).electron.runSearch({ query: args.query });
                        if (response.ok) {
                            return { success: true, data: response.data };
                        }
                        console.warn("Native Search failed, falling back to APIs...", response.error);
                    } catch (e) {
                        console.error("Native Search error, falling back...", e);
                    }
                }

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

                return { success: false, error: 'No Search method available. Ensure the internal Python engine is ready or add an API Key (Tavily/Brave) in Settings.' };
            }

            case 'read_url': {
                // Prioritize Native Internal Extraction (Python trafilatura bridge)
                if (typeof window !== 'undefined' && (window as any).electron?.invoke) {
                    try {
                        const response = await (window as any).electron.invoke('run-extract', { url: args.url });
                        if (response.ok) {
                            return { success: true, data: response.data };
                        }
                        console.warn("Native Extraction failed, falling back to APIs...", response.error);
                    } catch (e) {
                        console.error("Native Extraction error, falling back...", e);
                    }
                }

                if (!config.tavilyApiKey) {
                    return { success: false, error: 'Tavily API Key not found. Please add it in Settings, or ensure the internal Python engine is ready.' };
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
                    const finalData = data.results?.[0] || data;
                    if (finalData.success === false) {
                        return { success: false, error: finalData.error || 'Failed to extract content from URL.' };
                    }
                    return { success: true, data: finalData };
                } catch (e) {
                    return { success: false, error: `Read URL Error: ${e instanceof Error ? e.message : String(e)}` };
                }
            }

            case 'send_telegram_message': {
                const token = config.telegramBotToken;
                const chatId = args.chat_id || config.telegramChatId;

                if (!token) {
                    return { success: false, error: 'Telegram Bot Token not configured in Settings.' };
                }
                if (!chatId) {
                    return { success: false, error: 'Telegram Chat ID not configured (and no chat_id provided in arguments).' };
                }

                try {
                    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: chatId,
                            text: formatTelegramResponse(args.text),
                            parse_mode: 'HTML' // Allow some basic formatting
                        })
                    });

                    const data = await response.json();

                    if (!data.ok) {
                        return { success: false, error: `Telegram API Error: ${data.description || 'Unknown error'}` };
                    }

                    return { success: true, data: { message: 'Message sent successfully to Telegram.', message_id: data.result.message_id } };
                } catch (e) {
                    return { success: false, error: `Failed to connect to Telegram API: ${e instanceof Error ? e.message : String(e)}` };
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

            case 'final_answer': {
                return {
                    success: true,
                    data: {
                        text: args.text,
                        sources: args.sources || [],
                        status: 'completed'
                    }
                };
            }

            default:
                return {
                    success: false,
                    error: `❌ Unknown tool: "${name}". Valid tools are: read_file, update_file, list_files, search_files, web_search, read_url, run_console, final_answer. If you have the data, use "final_answer".`
                };
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
    workSpaceFiles: Record<string, string>,
    toolsFiles: Record<string, string>,
    saveFileFn: (name: string, content: string, target: FileTarget) => Promise<boolean>,
    onChunk: (text: string, replace?: boolean, blocks?: any[]) => void,
    onStatus: (status: Partial<AgentStatus>) => void,
    onToolApproval: (toolCall: ToolCall) => Promise<boolean>,
    abortSignal: AbortSignal,
    onFinalRawHistory?: (history: any[]) => void,
    useTextExtraction: boolean = true,
    isAgentMode: boolean = false,
    safeMode: boolean = false,
    approvalMode: ApprovalMode = 'auto'
): Promise<void> {

    const log = (type: AgentLogEntry['type'], message: string, details?: any) => {
        onStatus({ log: [{ timestamp: Date.now(), type, message, details }] });
    };

    let modelSupportsNativeTools = true;
    let allBlocks: any[] = [];

    async function streamOllamaRequest(
        messages: any[],
        useTools: boolean,
    ): Promise<{ content: string; toolCalls: any[] }> {
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
            modelSupportsNativeTools = false;
            return streamOllamaRequest(messages, false);
        }

        if (!response.ok) {
            const errBody = await response.text().catch(() => '');
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

    let historicalContext = chatMessages;
    if (isAgentMode) {
        // En modo agente/instrucción, incluimos los últimos 3 turnos (6 mensajes) 
        // para dar contexto sin saturar el sistema.
        const filteredHistory = chatMessages.filter(m => !m.content.startsWith('⚡ Command Executed:'));
        historicalContext = filteredHistory.slice(-6);
    }

    const ollamaMessages: any[] = [
        { role: 'system', content: systemPrompt },
        ...historicalContext,
    ];

    const MAX_RETRIES = 10;
    let iterations = 0;
    let retries = 0;
    let actionHistory: string[] = [];
    const actionFingerprints: Map<string, number> = new Map();
    const REPETITION_THRESHOLD = 3;
    const toolConsecutiveFailures: Map<string, number> = new Map();
    const exhaustedTools: Set<string> = new Set();
    const startTime = Date.now();

    // Mutable stores to track changes across iterations in a single agent session
    const currentFiles = { ...files };
    const currentAdditional = { ...additionalFiles };
    const currentWorkSpace = { ...workSpaceFiles };
    const currentTools = { ...toolsFiles };

    function getActionFingerprint(toolName: string, args: Record<string, any>): string {
        const sortedArgs = Object.keys(args).sort().reduce((acc, key) => {
            acc[key] = args[key];
            return acc;
        }, {} as Record<string, any>);
        return `${toolName}|${JSON.stringify(sortedArgs)}`;
    }

    function extractToolInstructions(tn: string, toolsContent: string): string {
        if (!toolsContent) return '';
        // Look for headers like "## ... (run_console)" or "### run_console"
        const re = new RegExp(`## .*?\\(${tn}\\).*?\\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
        const match = toolsContent.match(re);
        if (match) return `[TOOL MANUAL: ${tn}]\n${match[1].trim()}`;

        // Fallback: try search for the name as a subheader or header keyword
        const reSub = new RegExp(`(?:##|###) .*?${tn}.*?\\n([\\s\\S]*?)(?=\\n##|###|$)`, 'i');
        const matchSub = toolsContent.match(reSub);
        if (matchSub) return `[TOOL MANUAL: ${tn}]\n${matchSub[1].trim()}`;

        return '';
    }

    // ── Main Agent Loop ──────────────────────────────────────────────
    while (!abortSignal.aborted) {
        if (retries >= MAX_RETRIES) {
            log('warn', `Max retries reached (${MAX_RETRIES}). Requesting final explanation...`);
            onStatus({ phase: 'error', retries, maxRetries: MAX_RETRIES, errorCount: retries, elapsedMs: Date.now() - startTime, rawMessages: [...ollamaMessages] });
            break;
        }

        iterations++;
        onStatus({ phase: 'thinking', iteration: iterations, retries, maxRetries: MAX_RETRIES, elapsedMs: Date.now() - startTime, rawMessages: [...ollamaMessages] });

        let content: string;
        let nativeToolCalls: any[];

        try {
            const messagesForModel = [...ollamaMessages];
            const result = await streamOllamaRequest(messagesForModel, useTextExtraction);
            content = result.content;
            nativeToolCalls = result.toolCalls;
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            throw err;
        }

        const signatureRegex = /\{\{?[\s\S]*?≈̼\^\.┬\.̼\^≈‿⟆[\s\S]*?\}\}?/;

        let finalToolCalls: ToolCall[] = [];
        let positionalCalls: RecoveredCall[] = [];

        // 1. Extract tool calls (with positions if possible)
        if (content && useTextExtraction) {
            const { calls } = recoverToolCallsFromText(content, tools);
            positionalCalls = calls;
            finalToolCalls = calls.map(c => c.toolCall);
        }

        // 2. Fallback to native calls if recovery missed anything OR use them to augment
        if (nativeToolCalls && nativeToolCalls.length > 0) {
            for (const tc of nativeToolCalls) {
                try {
                    const rawArgs = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments;
                    const normResult = normalizeRawToolCall({ name: tc.function.name, arguments: rawArgs }, tools);
                    if (normResult.toolCall) {
                        normResult.toolCall.id = tc.id || normResult.toolCall.id;
                        // Avoid adding duplicates if already recovered
                        const fp = getActionFingerprint(normResult.toolCall.function.name, normResult.toolCall.function.arguments);
                        if (!finalToolCalls.some(x => getActionFingerprint(x.function.name, x.function.arguments) === fp)) {
                            finalToolCalls.push(normResult.toolCall);
                            // For native calls without indices, we place them at the end of the text
                            positionalCalls.push({ toolCall: normResult.toolCall, start: content?.length || 0, end: content?.length || 0 });
                        }
                    }
                } catch { retries++; }
            }
        }

        // Deduplicate
        const uniqueToolCalls: ToolCall[] = [];
        const seenFpSet = new Set<string>();
        for (const tc of finalToolCalls) {
            const fp = getActionFingerprint(tc.function.name, tc.function.arguments);
            if (!seenFpSet.has(fp)) { seenFpSet.add(fp); uniqueToolCalls.push(tc); }
        }

        // INTERLEAVED SEGMENTATION: Chronologically interleave text and tool blocks
        const iterationBlocks: any[] = [];
        let curIdx = 0;

        // Ensure positionalCalls is sorted (includes duplicates to swallow repetitions)
        const sortedPosCalls = [...positionalCalls].sort((a, b) => a.start - b.start);
        const seenFpForInterleaving = new Set<string>();

        for (const rc of sortedPosCalls) {
            const rawSegment = (content || '').substring(curIdx, rc.start);
            if (rawSegment.trim()) {
                let cleanSeg = rawSegment.trim();

                // Aggressive Noise Stripper - Purge conversational shards and technical-garbage
                if (!signatureRegex.test(cleanSeg.slice(0, 100))) {
                    cleanSeg = cleanSeg.replace(/^(?:I apologize|My apologies|...|You are right|You are correct|My core programming|I will now proceed|¡Disculpa!|Disculpa|Tienes razón|He cometido un error|Aquí está|Perdón|Thinking Process|Neural Flow|Neural Core|Proceso de Razonamiento)[\s\S]*?(?={|\[)/i, '');
                    // Strip common technical repetitions that models often output around JSON
                    cleanSeg = cleanSeg.replace(/^(?:functionality of the|I have successfully|Now I will|Checking files|I will now)[\s\S]*?$/im, '');
                }

                // Aggressive Tool Call & JSON Snippet Stripper
                cleanSeg = cleanSeg.replace(/```(?:json|JSON)?\s*\{[\s\S]*?\}\s*```/g, '');

                // Regex for finding JSON blocks that look like tool calls to strip them from narrative
                cleanSeg = cleanSeg.replace(/\{[\s\S]*?\}/g, (match) => {
                    const lowerMatch = match.toLowerCase();
                    const looksLikeTool = lowerMatch.includes('"name":') || lowerMatch.includes('"action":') || lowerMatch.includes('"function":');
                    if (looksLikeTool) {
                        try {
                            JSON.parse(match); // verify it's validish JSON
                            return '';
                        } catch { return match; }
                    }
                    return match;
                });

                if (cleanSeg.trim() && cleanSeg.trim().length > 2) {
                    iterationBlocks.push({ type: 'thought', content: cleanSeg.trim() });
                }
            }

            // B. Extract thoughts embedded in tool arguments for separate display above the tool
            const args = rc.toolCall.function.arguments;
            const thoughtKey = Object.keys(args).find(k => ['thought', 'reasoning', 'think', 'reason', 'pensamiento', 'razonamiento'].includes(k.toLowerCase()));
            const internalThought = thoughtKey ? args[thoughtKey] : null;

            if (internalThought && typeof internalThought === 'string' && internalThought.trim()) {
                iterationBlocks.push({ type: 'thought', content: internalThought.trim() });
            }

            // C. The tool block (excluding duplicates and final_answer)
            const fp = getActionFingerprint(rc.toolCall.function.name, rc.toolCall.function.arguments);
            if (!seenFpForInterleaving.has(fp) && rc.toolCall.function.name !== 'final_answer') {
                seenFpForInterleaving.add(fp);
                iterationBlocks.push({
                    type: 'tool_call',
                    content: `Modo: ${rc.toolCall.function.name}`,
                    toolCall: {
                        ...rc.toolCall,
                        // Mask the thought in the display version to avoid DUPLICATES
                        function: {
                            ...rc.toolCall.function,
                            arguments: thoughtKey ? Object.fromEntries(Object.entries(args).filter(([k]) => k !== thoughtKey)) : args
                        }
                    }
                });
            }
            curIdx = rc.end;
        }

        const finalRawSegment = (content || '').substring(curIdx);
        if (finalRawSegment.trim()) {
            let cleanFinal = finalRawSegment.trim();
            cleanFinal = cleanFinal.replace(/```(?:json|JSON)?\s*\{[\s\S]*?\}\s*```/g, '').trim();
            if (cleanFinal && cleanFinal.length > 2) {
                const isOnlyText = uniqueToolCalls.length === 0;
                iterationBlocks.push({ type: isOnlyText ? 'answer' : 'thought', content: cleanFinal });
            }
        }

        ollamaMessages.push({
            role: 'assistant',
            content: content || '[Calling Tools...]',
            tool_calls: uniqueToolCalls.length > 0 ? uniqueToolCalls : undefined,
        });

        allBlocks = [...allBlocks, ...iterationBlocks];

        const activeToolCalls = uniqueToolCalls;

        if (activeToolCalls.length === 0) {
            const isJustSignature = signatureRegex.test(content || '') && (content?.length || 0) < 100;
            if (isAgentMode) {
                const hasSubstantialText = (content?.length || 0) > 20;

                if (isJustSignature || hasSubstantialText) {
                    onChunk(content || '', true, allBlocks);
                    if (onFinalRawHistory) onFinalRawHistory([...ollamaMessages]);
                    onStatus({ phase: 'idle', elapsedMs: Date.now() - startTime, rawMessages: [...ollamaMessages] });
                    return;
                } else if (retries < MAX_RETRIES) {
                    retries++;
                    const nudge = '⚠️ PROTOCOLO INCOMPLETO: No has realizado ninguna acción ni has dado una respuesta final. RECUERDA: Debes usar "final_answer" para terminar. RESPONDE ÚNICAMENTE EN JSON.';
                    ollamaMessages.push({
                        role: 'user', content: `⚠️ PROTOCOLO INCOMPLETO: No has realizado ninguna acción ni has dado una respuesta final. RECUERDA: Debes usar "final_answer" para terminar. RESPONDE ÚNICAMENTE EN JSON.

**EXAMPLE (FORMAT ONLY):**
{"name": "tool_name", "arguments": {"param": "value"}}
...
{"name": "final_answer", "arguments": {
  "text": "Final response summary.",
  "reasoning": "Internal logic.",
  "sources": ["SOURCE_1", "SOURCE_2"]
}}

**IMPORTANT:** Every final_answer must cite the actual files or URLs used.` });
                    onStatus({ phase: 'thinking', retries, rawMessages: [...ollamaMessages] });
                    continue;
                }
            } else {
                onChunk(content || '', true, allBlocks);
                if (onFinalRawHistory) onFinalRawHistory([...ollamaMessages]);
                onStatus({ phase: 'idle', elapsedMs: Date.now() - startTime });
                break;
            }
        }

        // --- Execute tool calls ---
        onStatus({ phase: 'tool_calling' });
        const READ_ONLY_TOOLS = new Set(['read_file', 'list_files', 'search_files', 'web_search', 'read_url']);

        function isAutoApproved(tc: ToolCall): boolean {
            const tn = tc.function.name;
            if (READ_ONLY_TOOLS.has(tn)) return true;
            if (tn === 'run_console') return false;
            const target = resolveSource(tc.function.arguments.source);
            if (target !== 'workSpace') return false;
            if (tn === 'update_file') return currentWorkSpace[tc.function.arguments.filename] === undefined;
            return false;
        }

        function needsApproval(tc: ToolCall): boolean {
            return approvalMode === 'manual' || !isAutoApproved(tc);
        }

        async function requestApproval(toolCall: ToolCall, label: string): Promise<boolean> {
            onStatus({ currentTool: label, phase: 'waiting_approval' });
            const approved = await onToolApproval(toolCall);
            if (!approved) {
                const b = allBlocks.find(x => x.toolCall?.id === toolCall.id);
                if (b) b.result = { success: false, error: 'Rechazado.' };
                ollamaMessages.push({ role: 'tool', content: 'Rejected', tool_call_id: toolCall.id });
            }
            return approved;
        }

        async function executeAndProcess(toolCall: ToolCall, label: string): Promise<void> {
            onStatus({ phase: 'tool_executing', currentTool: label });
            const result = await executeToolCall(toolCall, currentFiles, currentAdditional, currentWorkSpace, currentTools, saveFileFn, config);
            const b = allBlocks.find(x => x.toolCall?.id === toolCall.id);
            if (b) b.result = result;

            const isSuccess = result?.success && result?.data?.success !== false;
            const hasError = result?.error || (result?.data?.success === false && result?.data?.error);

            if (!isSuccess) {
                retries++;
                const errorContent = hasError ? `Error: ${hasError}` : 'Tool execution failed.';
                ollamaMessages.push({ role: 'tool', content: errorContent, tool_call_id: toolCall.id });

                const findInStore = (store: Record<string, string>, fileName: string) => {
                    const low = fileName.toLowerCase();
                    const key = Object.keys(store).find(k => k.toLowerCase() === low || k.toLowerCase().endsWith('/' + low));
                    return key ? store[key] : null;
                };

                const toolsMd = findInStore(currentFiles, 'base/tools.md') || findInStore(currentFiles, 'tools.md') || '';
                const toolSpecificManual = extractToolInstructions(toolCall.function.name, toolsMd);
                if (toolSpecificManual) {
                    ollamaMessages.push({
                        role: 'system',
                        content: `⚠️ INSTRUCCIÓN TÉCNICA DE RECUPERACIÓN:\nSe detectó un fallo o uso incorrecto en "${toolCall.function.name}". Siga estrictamente estas reglas extraídas de TOOLS.md:\n\n${toolSpecificManual}`
                    });
                }
            } else {
                retries = 0;
                const desc = `${toolCall.function.name}(${JSON.stringify(toolCall.function.arguments)})`;
                actionHistory.push(desc);
                ollamaMessages.push({ role: 'tool', content: JSON.stringify(result), tool_call_id: toolCall.id });

                // CRITICAL: Update local mutable stores so subsequent steps in this session see the changes
                if (['update_file', 'patch_file'].includes(toolCall.function.name) && result.data?.filename) {
                    const { target, cleanFilename } = resolvePathAndSource(toolCall.function.arguments.filename, toolCall.function.arguments.source);
                    let newContent = toolCall.function.arguments.content;
                    if (toolCall.function.name === 'patch_file') {
                        // For patch_file, we need to get the resulting content. 
                        // executeToolCall already saved it, but we need to update our LOCAL store.
                        const store = getFileStore(target, currentFiles, currentAdditional, currentWorkSpace, currentTools);
                        const existing = store[cleanFilename] || '';
                        const find = toolCall.function.arguments.find;
                        const replace = toolCall.function.arguments.replace;
                        newContent = existing.replace(find, replace);
                    }
                    if (target === 'core') currentFiles[cleanFilename] = newContent;
                    else if (target === 'extra') currentAdditional[cleanFilename] = newContent;
                    else if (target === 'workSpace') currentWorkSpace[cleanFilename] = newContent;
                    else if (target === 'tools') currentTools[cleanFilename] = newContent;
                }

                if (isAgentMode) {
                    const originalObjective = [...chatMessages].reverse().find(m => m.role === 'user')?.content || 'No objective found';
                    const guide = `
🧠 [MOTOR DE ESTADO — Iteración ${iterations}]
🎯 OBJETIVO ORIGINAL: "${originalObjective.slice(0, 300)}${originalObjective.length > 300 ? '...' : ''}"
🛠️ ÚLTIMA ACCIÓN: "${toolCall.function.name}" -> ${isSuccess ? '✅ ÉXITO' : '❌ FALLO'}
📊 DATOS OBTENIDOS: ${JSON.stringify(result.data).slice(0, 500)}

[AUDITORÍA DE PASO]
1. ¿Esta acción completó el 100% de lo solicitado? 
   - SI: Justifica en un <think> y usa "final_answer".
   - NO: Re-evalúa tu plan en "@CORE/TASKS.md" y ejecuta el SIGUIENTE PASO lógico.
2. Si fallaste: Busca una ruta alternativa. NO repitas el mismo error.`;
                    ollamaMessages.push({ role: 'user', content: guide });
                }
            }
        }

        function validateAndReport(tc: ToolCall): boolean {
            const v = validateToolArgs(tc);
            if (!v.valid) {
                const b = allBlocks.find(x => x.toolCall?.id === tc.id);
                if (b) b.result = { success: false, error: v.error };
                ollamaMessages.push({ role: 'tool', content: v.error, tool_call_id: tc.id });
                return false;
            }
            return true;
        }

        // Sequential execution
        let hasFinalAnswer = false;
        for (const tc of activeToolCalls) {
            if (abortSignal.aborted) return;
            if (tc.function.name === 'final_answer') {
                hasFinalAnswer = true;
                const textRaw = tc.function.arguments.text || tc.function.arguments.mensaje || 'Tarea completada exitosamente.';
                const text = formatFinalResponse(textRaw);
                const sources = tc.function.arguments.sources || [];

                let finalContent = text;
                if (sources.length > 0) {
                    finalContent += '\n\n**Fuentes Consultadas:**\n' + sources.map((s: string) => `- ${s}`).join('\n');
                }

                allBlocks.push({ type: 'answer', content: finalContent });
                onChunk(finalContent, true, allBlocks);
                break;
            }

            if (!validateAndReport(tc)) continue;
            if (needsApproval(tc)) {
                if (!await requestApproval(tc, tc.function.name)) continue;
            }
            await executeAndProcess(tc, tc.function.name);
        }

        if (hasFinalAnswer) {
            if (onFinalRawHistory) onFinalRawHistory([...ollamaMessages]);
            onStatus({ phase: 'idle', elapsedMs: Date.now() - startTime });
            return;
        }

        onChunk(content, true, allBlocks);
        onStatus({ rawMessages: [...ollamaMessages] });
    }
}
