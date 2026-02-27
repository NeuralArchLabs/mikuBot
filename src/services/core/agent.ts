/**
 * Core Agent Logic
 * Path: src/services/core/agent.ts
 */
import { ToolCall, ToolResult, ToolDefinition, AppConfig, AgentStatus, AgentLogEntry, FileTarget, ApprovalMode } from '../../types';
import { PROTECTED_CORE_FILES, CONSOLE_ALLOWED_COMMANDS, CONSOLE_BLOCKED_PATTERNS } from '../../constants';
import { validateToolArgs, safeFetch, streamViaProxy } from '../../utils';
import { recoverToolCallsFromText, normalizeRawToolCall, RecoveredCall } from '../formatters/toolCallNormalizer';
import { formatFinalResponse } from '../formatters/answerFormatter';
import { formatTelegramResponse } from '../formatters/telegramFormatter';
import { TOOL_NAME_ALIASES } from '../formatters/normalization/dictionaries';

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

/**
 * Extracts specific tool instructions from TOOLS.md content.
 */
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

export async function executeToolCall(
    toolCall: ToolCall,
    files: Record<string, string>,
    additionalFiles: Record<string, string>,
    workSpaceFiles: Record<string, string>,
    toolsFiles: Record<string, string>,
    saveFileFn: (name: string, content: string, target: FileTarget) => Promise<boolean>,
    deleteFileFn: (name: string, target: FileTarget) => Promise<boolean>,
    config: AppConfig,
    onAddTask?: (task: any) => Promise<string>
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
                if (typeof window !== 'undefined' && (window as any).electron?.runExtract) {
                    try {
                        const response = await (window as any).electron.runExtract({ url: args.url });
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
                const isElectron = !!(window as any).electron?.runConsole;
                if (!isElectron) {
                    return {
                        success: false,
                        error: 'Console execution requires the Electron desktop app. Not available in browser mode.'
                    };
                }

                try {
                    const result = await (window as any).electron.runConsole({
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

            case 'delete_file': {
                if (!args.filename) {
                    return { success: false, error: 'Missing required parameter: filename.' };
                }
                const { target, cleanFilename } = resolvePathAndSource(args.filename, args.source);
                const deleted = await deleteFileFn(cleanFilename, target);
                if (deleted) {
                    return { success: true, data: { filename: cleanFilename, message: `File "${cleanFilename}" deleted from ${target}.`, source: target } };
                }
                return { success: false, error: `Failed to delete "${cleanFilename}" from ${target}.` };
            }

            case 'add_scheduled_task': {
                if (!onAddTask) return { success: false, error: 'Agent Scheduler service not available in this context.' };
                try {
                    const taskId = await onAddTask({
                        name: args.name,
                        prompt: args.prompt,
                        scheduleType: args.scheduleType,
                        schedule: args.schedule,
                        channel: args.channel || 'both',
                        mode: args.mode || 'agent',
                        enabled: args.enabled !== undefined ? args.enabled : true,
                        maxExecutionsPerDay: args.maxExecutionsPerDay || 0
                    });
                    return { success: true, data: { taskId, message: `Task "${args.name}" scheduled successfully with ID: ${taskId}` } };
                } catch (err: any) {
                    return { success: false, error: `Failed to schedule task: ${err.message}` };
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

            default: {
                // Dynamic Skills Integration
                const isElectron = typeof window !== 'undefined' && (window as any).electron?.listSkills;
                if (isElectron && config.folderPaths?.tools) {
                    try {
                        // We check if this tool exists in the skills library
                        const skillsResponse = await (window as any).electron.listSkills({ toolsPath: config.folderPaths.tools });
                        if (skillsResponse.ok && Array.isArray(skillsResponse.skills)) {
                            const skill = skillsResponse.skills.find((s: any) => s.name === name);
                            if (skill) {
                                const execution = await (window as any).electron.executeSkill({
                                    toolsPath: config.folderPaths.tools,
                                    skillName: name,
                                    args: args
                                });
                                if (execution.ok) {
                                    return { success: true, data: execution.data };
                                }
                                return { success: false, error: execution.error || `Error executing skill ${name}` };
                            }
                        }
                    } catch (err) {
                        console.error(`[Agent] Failed to check/execute dynamic skill ${name}:`, err);
                    }
                }

                let availableSkillsMsg = "";
                if (isElectron && config.folderPaths?.tools) {
                    try {
                        const skillsResponse = await (window as any).electron.listSkills({ toolsPath: config.folderPaths.tools });
                        if (skillsResponse.ok && Array.isArray(skillsResponse.skills)) {
                            availableSkillsMsg = ` (Skills detectadas: ${skillsResponse.skills.map((s: any) => s.name).join(', ')})`;
                        }
                    } catch { }
                }

                return {
                    success: false,
                    error: `❌ Unknown tool: "${name}".${availableSkillsMsg} Ensure its manifest.json is correct and use the exact name defined there.`
                };
            }
        }
    } catch (e) {
        return { success: false, error: `Tool execution error: ${e instanceof Error ? e.message : String(e)}` };
    }
}

/**
 * Cleans narrative segments to remove technical noise, protocol echoes, and JSON fragments.
 */
function cleanThoughtContent(text: string, signatureRegex: RegExp): string {
    let s = (text || '').trim();
    if (!s) return '';

    // 1. PRESERVAR FIRMA DEL BOT (El usuario prefiere que aparezca si el modelo la genera)
    // No aplicamos replace al signatureRegex.

    // 2. ELIMINAR ETIQUETAS XML (Think/Tool Call de modelos como R1 o Gemma)
    s = s.replace(/<think>[\s\S]*?<\/think>/gi, '');
    s = s.replace(/<\|?tool_call\|?>[\s\S]*?<\|?\/?tool_call\|?>/gi, '');

    // 3. ELIMINAR BLOQUES JSON COMPLETOS Y FRAGMENTADOS
    s = s.replace(/```(?:json|JSON)?\s*\{[\s\S]*?\}\s*```/gi, '');

    // Objetos JSON técnicos por marcadores
    s = s.replace(/\{[\s\S]*?\}/g, (match) => {
        const lowerMatch = match.toLowerCase();
        const toolMarkers = [
            '"name":', '"action":', '"function":', '"filename":',
            '"content":', '"url":', '"query":', '"coin_id":',
            '"text":', '"args":', '"arguments":'
        ];
        return toolMarkers.some(m => lowerMatch.includes(m.toLowerCase())) ? '' : match;
    });

    // Limpieza de basura técnica residual (braces o inicios de objetos)
    s = s.replace(/\{\s*"(?:name|action|function|tool_call|arguments|args)"\s*:.*$/gim, '');
    s = s.replace(/^\s*[\}\],]+\s*$/gm, '');
    s = s.replace(/[\}\],]+\s*$/g, '');

    // 4. ELIMINAR ECOS DEL PROTOCOLO Y LOGS TÉCNICOS
    const noisePatterns = [
        /^(?:I apologize|My apologies|You are right|You are correct)[\s\S]*?(?={|\[|{{)/i,
        /^(?:Thinking Process|Neural Flow|Neural Core|Proceso de Razonamiento|Active Reasoning|Razonamiento Activo|Flujo Neural|Core de Miku|Razonamiento)[\s\S]*?(?={|\[|{{)/i,
        /^\s*(?:Active Reasoning|Razonamiento Activo|Razonamiento|Neural Core|Miku Core|READY|SUCCESS|ERROR|FAILURE|WEB_SEARCH|SEARCHING|ANALYZING|DONE|COMPLETED)\s*$/gim,
        /\[[x\s]\]\s*@?(?:CORE|EXTRA|WORKSPACE|TOOLS|LIBRARY)\/[^\s]*/gi,
        /^(?:tool_call|web_search|read_file|update_file|patch_file|delete_file|run_console|add_scheduled_task|final_answer|list_files|search_files|read_url)[:\s]*/gim
    ];
    noisePatterns.forEach(p => s = s.replace(p, ''));

    // 5. LIMPIEZA DE CERCAS Y ESPACIOS SOBRANTES
    s = s.replace(/```(?:json|JSON)?/gi, '');
    s = s.replace(/```/g, '');

    return s.trim();
}

function mapToolsToGemini(tools: ToolDefinition[]): any[] {
    return [{
        function_declarations: tools.map(t => ({
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters
        }))
    }];
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
    let allBlocks: any[] = [];

    async function streamModelRequest(
        messages: any[],
        useTools: boolean,
    ): Promise<{ content: string; toolCalls: any[] }> {
        const provider = config.provider;
        const isElectronProxy = !!(window as any).electron?.apiStream;

        if (provider === 'ollama') {
            const body: any = {
                model: config.model,
                messages: messages.filter(m => m.content || (m.tool_calls && m.tool_calls.length > 0)).map(m => {
                    const imageAttachments = m.attachments?.filter((a: any) => a.type.startsWith('image/')) || [];
                    return {
                        role: m.role,
                        content: m.content,
                        tool_calls: m.tool_calls,
                        images: imageAttachments.length > 0 ? imageAttachments.map((img: any) => img.data.split(',')[1]) : undefined
                    };
                }),
                stream: true,
                options: { temperature: config.temperature },
            };
            if (useTools && modelSupportsNativeTools) body.tools = tools;

            if (isElectronProxy) {
                let fullContent = '';
                let toolCalls: any[] = [];
                let buffer = '';

                try {
                    await streamViaProxy({
                        provider: 'ollama',
                        model: config.model,
                        body,
                        ollamaUrl: config.ollamaUrl,
                        abortSignal,
                        onChunk: (raw) => {
                            buffer += raw;
                            const lines = buffer.split('\n');
                            buffer = lines.pop() || '';
                            for (const line of lines) {
                                if (!line.trim()) continue;
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
                    });
                } catch (err: any) {
                    // Handle HTTP 400 for tool fallback (match original behavior)
                    if (err.message?.includes('HTTP 400') && useTools && modelSupportsNativeTools) {
                        log('warn', 'Este modelo está siendo optimizado para el llamado y uso de herramientas');
                        modelSupportsNativeTools = false;
                        return streamModelRequest(messages, false);
                    }
                    throw err;
                }
                return { content: fullContent, toolCalls };
            } else {
                // Direct fetch fallback (browser dev & local Ollama)
                // Add explicit timeout to prevent hanging indefinitely
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

                // Allow user abort to also cancel this fetch
                abortSignal.addEventListener('abort', () => controller.abort());

                try {
                    const response = await fetch(`${config.ollamaUrl}/api/chat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                        signal: controller.signal,
                    });

                    clearTimeout(timeoutId);

                    if (response.status === 400 && useTools && modelSupportsNativeTools) {
                        log('warn', 'Este modelo está siendo optimizado para el llamado y uso de herramientas');
                        modelSupportsNativeTools = false;
                        return streamModelRequest(messages, false);
                    }

                    if (!response.ok) {
                        const errBody = await response.text().catch(() => '');
                        throw new Error(`Ollama HTTP ${response.status}: ${errBody}`);
                    }

                    const reader = response.body?.getReader();
                    const decoder = new TextDecoder();
                    let fullContent = '';
                    let toolCalls: any[] = [];
                    let buffer = '';

                    if (reader) {
                        while (true) {
                            if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');
                            const { done, value } = await reader.read();
                            if (done) break;

                            buffer += decoder.decode(value, { stream: true });
                            const lines = buffer.split('\n');
                            buffer = lines.pop() || '';

                            for (const line of lines) {
                                const cleanLine = line.trim();
                                if (!cleanLine) continue;
                                try {
                                    const parsed = JSON.parse(cleanLine);
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
                } catch (error: any) {
                    clearTimeout(timeoutId);
                    if (error.name === 'AbortError') {
                        // Check if it was our timeout or user abort
                        if (!abortSignal.aborted) {
                            throw new Error("Ollama request timed out after 30s");
                        }
                    }
                    throw error;
                }
            }
        } else if (provider === 'groq') {
            const body: any = {
                model: config.model,
                messages: messages.map(m => {
                    const imageAttachments = m.attachments?.filter((a: any) => a.type.startsWith('image/')) || [];
                    if (imageAttachments.length > 0) {
                        const contentBlocks: any[] = [{ type: 'text', text: m.content || '' }];
                        imageAttachments.forEach((img: any) => {
                            contentBlocks.push({
                                type: 'image_url',
                                image_url: { url: img.data }
                            });
                        });
                        return { role: m.role, content: contentBlocks };
                    }
                    return { role: m.role, content: m.content || '' };
                }),
                stream: true,
                temperature: config.temperature,
            };

            if (useTools && modelSupportsNativeTools) {
                body.tools = tools;
                body.tool_choice = 'auto';
            }

            // Accumulate tool calls for Groq (OpenAI style)
            const toolCallsMap = new Map<number, any>();
            const processGroqChunk = (data: string, fullContentRef: { val: string }) => {
                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta;

                    if (delta?.content) {
                        fullContentRef.val += delta.content;
                        onStatus({ streamedText: fullContentRef.val, phase: 'streaming' });
                    }

                    if (delta?.tool_calls) {
                        for (const tc of delta.tool_calls) {
                            if (!toolCallsMap.has(tc.index)) {
                                toolCallsMap.set(tc.index, {
                                    id: tc.id,
                                    function: { name: '', arguments: '' },
                                    type: 'function'
                                });
                            }
                            const current = toolCallsMap.get(tc.index);
                            if (tc.id) current.id = tc.id;
                            if (tc.function?.name) current.function.name += tc.function.name;
                            if (tc.function?.arguments) current.function.arguments += tc.function.arguments;
                        }
                    }
                } catch { }
            };

            if (isElectronProxy) {
                // ── Secure Path: Route through main process
                let fullContentVal = { val: '' };
                let buffer = '';

                try {
                    await streamViaProxy({
                        provider: 'groq',
                        model: config.model,
                        body,
                        abortSignal,
                        onChunk: (raw) => {
                            buffer += raw;
                            const lines = buffer.split('\n');
                            buffer = lines.pop() || '';
                            for (const line of lines) {
                                const cleanLine = line.trim();
                                if (!cleanLine || !cleanLine.startsWith('data: ')) continue;
                                const data = cleanLine.slice(6);
                                if (data === '[DONE]') continue;
                                processGroqChunk(data, fullContentVal);
                            }
                        }
                    });
                } catch (err: any) {
                    if (err.message?.includes('HTTP 400') && useTools && modelSupportsNativeTools) {
                        log('warn', 'Este modelo está siendo optimizado para el llamado y uso de herramientas');
                        modelSupportsNativeTools = false;
                        return streamModelRequest(messages, false);
                    }
                    throw err;
                }
                return { content: fullContentVal.val, toolCalls: Array.from(toolCallsMap.values()) };
            } else {
                // ── Fallback: direct fetch (browser dev mode only)
                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${config.apiKeys.groq}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body),
                    signal: abortSignal,
                });

                if (response.status === 400 && useTools && modelSupportsNativeTools) {
                    log('warn', 'Este modelo está siendo optimizado para el llamado y uso de herramientas');
                    modelSupportsNativeTools = false;
                    return streamModelRequest(messages, false);
                }

                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    throw new Error(err.error?.message || `Groq HTTP ${response.status}`);
                }

                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                let fullContentVal = { val: '' };
                let buffer = '';

                if (reader) {
                    while (true) {
                        if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            const cleanLine = line.trim();
                            if (!cleanLine || !cleanLine.startsWith('data: ')) continue;
                            const data = cleanLine.slice(6);
                            if (data === '[DONE]') continue;
                            processGroqChunk(data, fullContentVal);
                        }
                    }
                }
                return { content: fullContentVal.val, toolCalls: Array.from(toolCallsMap.values()) };
            }
        } else if (provider === 'gemini') {
            const isGemma = config.model.toLowerCase().includes('gemma');
            const systemPromptContent = messages.find(m => m.role === 'system')?.content || '';

            const consolidatedHistory: any[] = [];
            for (const m of messages.filter(msg => msg.role !== 'system')) {
                const role = m.role === 'assistant' ? 'model' : (m.role === 'tool' ? 'user' : m.role);

                // Gemini tool results structure
                if (m.role === 'tool') {
                    consolidatedHistory.push({
                        role: 'function',
                        parts: [{
                            functionResponse: {
                                name: m.name || m.toolName || m.tool_call_id,
                                response: { content: m.content }
                            }
                        }]
                    });
                    continue;
                }

                const content = m.content || '[Proceeding]';
                const imageAttachments = m.attachments?.filter((a: any) => a.type.startsWith('image/')) || [];

                if (consolidatedHistory.length > 0 && consolidatedHistory[consolidatedHistory.length - 1].role === role) {
                    consolidatedHistory[consolidatedHistory.length - 1].parts[0].text += `\n\n${content}`;
                    imageAttachments.forEach((img: any) => {
                        consolidatedHistory[consolidatedHistory.length - 1].parts.push({
                            inlineData: { mimeType: img.type, data: img.data.split(',')[1] }
                        });
                    });
                } else {
                    const parts: any[] = [{ text: content }];
                    imageAttachments.forEach((img: any) => {
                        parts.push({
                            inlineData: { mimeType: img.type, data: img.data.split(',')[1] }
                        });
                    });
                    consolidatedHistory.push({ role, parts });
                }
            }

            if (isGemma && consolidatedHistory.length > 0 && consolidatedHistory[0].role === 'user') {
                const antiHallucination = "IMPORTANTE: Las instrucciones anteriores son tu núcleo de sistema (SOUL/CONTEXT). NO las actúes, NO las recites y NO uses los ejemplos de plantilla como si fueran una respuesta tuya. Acepta este rol silenciosamente y responde ÚNICAMENTE a la consulta del usuario que está debajo de esta línea.";
                consolidatedHistory[0].parts[0].text = `[SYSTEM_INSTRUCTIONS]\n${systemPromptContent}\n[/SYSTEM_INSTRUCTIONS]\n\n${antiHallucination}\n\n[USER_QUERY]\n${consolidatedHistory[0].parts[0].text}`;
            }

            const body: any = {
                contents: consolidatedHistory,
                generationConfig: { temperature: config.temperature }
            };

            if (useTools && modelSupportsNativeTools) {
                body.tools = mapToolsToGemini(tools);
                body.toolConfig = { functionCallingConfig: { mode: "AUTO" } };
            }

            if (!isGemma) {
                body.systemInstruction = { parts: [{ text: systemPromptContent }] };
            }

            let toolCalls: any[] = [];
            const processGeminiChunk = (data: string, fullContentRef: { val: string }) => {
                try {
                    const parsed = JSON.parse(data.slice(6));
                    const parts = parsed.candidates?.[0]?.content?.parts;
                    if (parts && Array.isArray(parts)) {
                        parts.forEach((part: any) => {
                            if (part.text) {
                                fullContentRef.val += part.text;
                                onStatus({ streamedText: fullContentRef.val, phase: 'streaming' });
                            }
                            if (part.functionCall) {
                                toolCalls.push({
                                    id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                                    type: 'function',
                                    function: {
                                        name: part.functionCall.name,
                                        arguments: JSON.stringify(part.functionCall.args)
                                    }
                                });
                            }
                        });
                    }
                } catch { }
            };

            if (isElectronProxy) {
                // ── Secure Path: Route through main process
                let fullContentVal = { val: '' };
                let buffer = '';

                try {
                    await streamViaProxy({
                        provider: 'gemini',
                        model: config.model,
                        body,
                        abortSignal,
                        onChunk: (raw) => {
                            buffer += raw;
                            const lines = buffer.split('\n');
                            buffer = lines.pop() || '';
                            for (const line of lines) {
                                const cleanLine = line.trim();
                                if (!cleanLine || !cleanLine.startsWith('data: ')) continue;
                                processGeminiChunk(cleanLine, fullContentVal);
                            }
                        }
                    });
                } catch (err: any) {
                    if (err.message?.includes('HTTP 400') && useTools && modelSupportsNativeTools) {
                        log('warn', 'Este modelo está siendo optimizado para el llamado y uso de herramientas');
                        modelSupportsNativeTools = false;
                        return streamModelRequest(messages, false);
                    }
                    throw err;
                }
                return { content: fullContentVal.val, toolCalls };
            } else {
                // ── Fallback: direct fetch (browser dev mode)
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:streamGenerateContent?alt=sse&key=${config.apiKeys.gemini}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                        signal: abortSignal,
                    }
                );

                if (response.status === 400 && useTools && modelSupportsNativeTools) {
                    log('warn', 'Este modelo está siendo optimizado para el llamado y uso de herramientas');
                    modelSupportsNativeTools = false;
                    return streamModelRequest(messages, false);
                }

                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    throw new Error(err.error?.message || `Gemini HTTP ${response.status}`);
                }

                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                let fullContentVal = { val: '' };
                let buffer = '';

                if (reader) {
                    while (true) {
                        if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            const cleanLine = line.trim();
                            if (!cleanLine || !cleanLine.startsWith('data: ')) continue;
                            processGeminiChunk(cleanLine, fullContentVal);
                        }
                    }
                }
                return { content: fullContentVal.val, toolCalls };
            }
        }

        throw new Error(`Unsupported provider for Agent Loop: ${provider}`);
    }

    let historicalContext = chatMessages;
    if (isAgentMode) {
        // En modo agente/instrucción, incluimos los últimos 3 turnos (6 mensajes) 
        // para dar contexto sin saturar el sistema.
        const filteredHistory = chatMessages.filter(m => !m.content.startsWith('⚡ Command Executed:'));
        historicalContext = filteredHistory.slice(-6);
    }

    const agentMessages: any[] = [
        { role: 'system', content: systemPrompt },
        ...historicalContext,
    ];

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

    const MAX_RETRIES = 10;
    let iterations = 0;
    let retries = 0;
    let actionHistory: string[] = [];

    // Capture original trigger request for Mission Anchoring
    const missionTrigger = historicalContext.filter(m => m.role === 'user' || m.role === 'system').slice(-1)[0]?.content || 'Sin objetivo definido.';
    let lastExecutionFeedback = 'Inicio de misión.';

    // Proxy onStatus to always include feedback for visual synchronization
    const localOnStatus = (status: Partial<AgentStatus>) => {
        onStatus({ ...status, lastExecutionFeedback });
    };

    // ── Main Agent Loop ──────────────────────────────────────────────
    while (!abortSignal.aborted) {
        if (retries >= MAX_RETRIES) {
            log('warn', `Max retries reached (${MAX_RETRIES}). Stopping.`);
            localOnStatus({ phase: 'error', retries, maxRetries: MAX_RETRIES, errorCount: retries, elapsedMs: Date.now() - startTime, rawMessages: [...agentMessages] });
            break;
        }

        iterations++;

        // DYNAMIC SYSTEM PROMPT REFRESH (Awareness & Working Memory)
        if (isAgentMode || isInstructionMode) {
            const findTaskContent = () => {
                const stores = [currentFiles, currentWorkSpace];
                for (const store of stores) {
                    const keys = Object.keys(store);
                    const taskKey = keys.find(k => k.toLowerCase() === 'tasks.md');
                    if (taskKey) return store[taskKey];
                }
                return null;
            };

            const tasksContent = findTaskContent() || '';

            // Focus Mode Extraction
            const taskLines = tasksContent.trim() ? tasksContent.split('\n') : [];
            const lastDone = taskLines.filter(l => l.includes('[x]')).pop()?.trim() || 'Ninguna (Inicio)';

            // If the file is empty or only has the header, give a smart suggestion
            let nextTodo = 'Analizar y ejecutar (Tarea Simple) o Planificar (Tarea Compleja)';
            if (taskLines.length > 0) {
                const foundTodo = taskLines.find(l => l.includes('[ ]'))?.trim();
                if (foundTodo) nextTodo = foundTodo;
                else nextTodo = 'Finalización / Limpieza';
            }

            // Build Mission Anchor & Operation Focus
            const awarenessBlock = `[ESTADO_DEL_AGENTE]
Misión Original: "${missionTrigger}"
Turno Actual: ${iterations} de ${MAX_RETRIES}
[/ESTADO_DEL_AGENTE]
[FOCO_DE_OPERACIÓN]
Resultado Anterior: ${lastExecutionFeedback}
Tarea Completada: ${lastDone}
Siguiente Acción: ${nextTodo}
${lastExecutionFeedback.includes('DATOS OBTENIDOS') ? '⚠️ RECOLECCIÓN: Usa los datos del "Resultado Anterior" para tu respuesta final. NUNCA inventes números.' : ''}
[/FOCO_DE_OPERACIÓN]`;

            let systemPromptCurrent = agentMessages[0].content;

            // Simplified markers for better reliability
            const markerStart = "[ESTADO_DEL_AGENTE]";
            const markerEnd = "[/FOCO_DE_OPERACIÓN]";
            const sIdx = systemPromptCurrent.indexOf(markerStart);
            const eIdx = systemPromptCurrent.indexOf(markerEnd);

            if (sIdx !== -1 && eIdx !== -1) {
                const before = systemPromptCurrent.substring(0, sIdx);
                const after = systemPromptCurrent.substring(eIdx + markerEnd.length);
                agentMessages[0].content = before + awarenessBlock + after;
            } else {
                // Initial injection
                const tasksSection = `\n${awarenessBlock}\n`;
                if (systemPromptCurrent.includes('[IDIOMA — OBLIGATORIO]')) {
                    agentMessages[0].content = systemPromptCurrent.replace(/(\[IDIOMA — OBLIGATORIO\].*?\n)/, `$1${tasksSection}`);
                } else {
                    agentMessages[0].content = tasksSection + systemPromptCurrent;
                }
            }
        }

        localOnStatus({
            phase: 'thinking',
            iteration: iterations,
            retries,
            maxRetries: MAX_RETRIES,
            elapsedMs: Date.now() - startTime,
            rawMessages: JSON.parse(JSON.stringify(agentMessages)), // Deep copy to ensure UI sees current state
            currentSystemPrompt: agentMessages[0].content
        });

        let content: string;
        let nativeToolCalls: any[];

        try {
            const messagesForModel = [...agentMessages];
            const result = await streamModelRequest(messagesForModel, useTextExtraction);
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
            const cleanSeg = cleanThoughtContent(rawSegment, signatureRegex);

            if (cleanSeg && cleanSeg.length > 2) {
                iterationBlocks.push({ type: 'thought', content: cleanSeg });
            }

            // B. Extract thoughts embedded in tool arguments for separate display above the tool
            const args = rc.toolCall.function.arguments;
            const thoughtKey = Object.keys(args).find(k => ['thought', 'reasoning', 'think', 'reason', 'pensamiento', 'razonamiento'].includes(k.toLowerCase()));
            const internalThought = thoughtKey ? args[thoughtKey] : null;

            if (internalThought && typeof internalThought === 'string' && internalThought.trim()) {
                iterationBlocks.push({ type: 'thought', content: internalThought.trim() });
            }

            // C. The tool block (excluding duplicates)
            const fp = getActionFingerprint(rc.toolCall.function.name, rc.toolCall.function.arguments);
            if (!seenFpForInterleaving.has(fp)) {
                seenFpForInterleaving.add(fp);
                if (rc.toolCall.function.name === 'final_answer') {
                    const finalTxt = args.text || args.respuesta || args.answer || args.content || '';
                    if (finalTxt) {
                        iterationBlocks.push({ type: 'answer', content: finalTxt });
                    }
                } else {
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
            }
            curIdx = rc.end;
        }

        const finalRawSegment = (content || '').substring(curIdx);
        const cleanFinal = cleanThoughtContent(finalRawSegment, signatureRegex);
        if (cleanFinal && cleanFinal.length > 2) {
            const isOnlyText = uniqueToolCalls.length === 0;
            iterationBlocks.push({ type: isOnlyText ? 'answer' : 'thought', content: cleanFinal });
        }

        // CONSOLIDATION: Merge consecutive thoughts to avoid fragmented UI
        const mergedIterationBlocks: any[] = [];
        iterationBlocks.forEach(block => {
            const last = mergedIterationBlocks[mergedIterationBlocks.length - 1];
            if (last && last.type === 'thought' && block.type === 'thought') {
                last.content += `\n\n${block.content}`;
            } else {
                // Final validation: only push non-empty blocks
                if (block.content && block.content.trim().length > 1) {
                    mergedIterationBlocks.push(block);
                }
            }
        });

        agentMessages.push({
            role: 'assistant',
            content: content || '',
            tool_calls: uniqueToolCalls.length > 0 ? uniqueToolCalls : undefined,
        });

        // DYNAMIC SYNC: Emit blocks early so thoughts & tools appear before execution
        onChunk(content || '', false, [...allBlocks, ...mergedIterationBlocks]);
        localOnStatus({ rawMessages: [...agentMessages] });

        // [ANTI-INTERFERENCE FIX]: If final_answer is detected, ensure protocol compliance
        const finalAnswerCall = uniqueToolCalls.find(tc => tc.function.name === 'final_answer');
        if (finalAnswerCall) {
            // Task Protocol Enforcement: Do not allow final_answer if TASKS.md exists
            const hasTasksFile = Object.keys(currentFiles).some(k => k.toLowerCase() === 'tasks.md') ||
                Object.keys(currentWorkSpace).some(k => k.toLowerCase() === 'tasks.md');

            // NEW: If the model is CREATING/UPDATING tasks.md and also answering, that's a protocol violation
            const isUpdatingTasks = uniqueToolCalls.some(tc =>
                tc.function.name === 'update_file' &&
                (tc.function.arguments.filename || '').toLowerCase().includes('tasks.md')
            );

            // Exception: If the model is DELIVERING and ALSO DELETING tasks.md in this turn, allow it.
            const isDeletingTasks = uniqueToolCalls.some(tc =>
                tc.function.name === 'delete_file' &&
                (tc.function.arguments.filename || '').toLowerCase().includes('tasks.md')
            );

            const isViolation = (hasTasksFile && !isDeletingTasks) || (isUpdatingTasks && !isDeletingTasks);

            if (isViolation && isAgentMode) {
                log('warn', 'Agent tried to answer while TASKS.md is active or being updated. Force rejection.');
                uniqueToolCalls.length = 0;
                agentMessages.push({
                    role: 'user',
                    content: '⚠️ BLOQUEO DE PROTOCOLO: No puedes dar un "final_answer" mientras `@CORE/TASKS.md` exista o esté siendo actualizado. Debes completar TODAS las tareas, marcar los checks `[x]` y finalmente ELIMINAR el archivo con `delete_file` antes de responder.'
                });
                localOnStatus({ phase: 'thinking', rawMessages: [...agentMessages] });
                continue;
            }

            // Optimization: Remove ONLY redundant completion tools, keep the real work (file ops, etc)
            const forbiddenWithFinal = ['talk', 'say', 'respond', 'conclude', 'finish', 'summary', 'final_summary'];
            const cleanedCalls = uniqueToolCalls.filter(tc => !forbiddenWithFinal.includes(tc.function.name));

            // Re-order so final_answer is ALWAYS last in the execution loop
            const withoutFinal = cleanedCalls.filter(tc => tc.function.name !== 'final_answer');
            uniqueToolCalls.length = 0;
            uniqueToolCalls.push(...withoutFinal, finalAnswerCall);
        }

        allBlocks = [...allBlocks, ...mergedIterationBlocks];

        const activeToolCalls = uniqueToolCalls;

        if (activeToolCalls.length === 0) {
            const isJustSignature = signatureRegex.test(content || '') && (content?.length || 0) < 100;
            if (isAgentMode) {
                const hasSubstantialText = (content?.length || 0) > 15;

                if (isJustSignature || hasSubstantialText) {
                    onChunk(content || '', true, allBlocks);
                    if (onFinalRawHistory) onFinalRawHistory([...agentMessages]);
                    localOnStatus({ phase: 'idle', elapsedMs: Date.now() - startTime, rawMessages: [...agentMessages] });
                    return;
                } else if (retries < MAX_RETRIES) {
                    retries++;

                    // Check if the previous message was already a technical error nudge to avoid redundancy
                    const lastMsg = agentMessages[agentMessages.length - 1];
                    if (lastMsg && lastMsg.role === 'user' && lastMsg.content.includes('⚠️ ERROR TÉCNICO')) {
                        localOnStatus({ phase: 'thinking', retries, rawMessages: [...agentMessages] });
                        continue; // Skip the redundant "Incomplete Protocol" nudge if we already nudged for a tool error
                    }

                    agentMessages.push({
                        role: 'user', content: `⚠️ PROTOCOLO DE AGENTE INCOMPLETO:
Has proporcionado texto, pero ninguna herramienta (JSON). Si ya tienes la respuesta final para Armando, debes usar obligatoriamente la herramienta "final_answer".

**EJEMPLO DE CIERRE:**
{"name": "final_answer", "arguments": {
  "text": "Tu respuesta final aquí...",
  "reasoning": "Breve explicación de por qué esta es la respuesta.",
  "sources": ["fuente1.md", "url_sitio"]
}}

Si necesitas realizar más acciones, emite la llamada JSON correspondiente. NO respondas solo con texto.` });
                    onStatus({ phase: 'thinking', retries, rawMessages: [...agentMessages] });
                    continue;
                }
            } else {
                onChunk(content || '', true, allBlocks);
                if (onFinalRawHistory) onFinalRawHistory([...agentMessages]);
                localOnStatus({ phase: 'idle', elapsedMs: Date.now() - startTime });
                break;
            }
        }

        // --- Execute tool calls ---
        localOnStatus({ phase: 'tool_calling' });
        const READ_ONLY_TOOLS = new Set(['read_file', 'list_files', 'search_files', 'web_search', 'read_url', 'list_available_skills']);

        function isAutoApproved(tc: ToolCall): boolean {
            // 0. Auto-Scheduled Background Tasks (Unsupervised Full autonomy)
            if (isScheduled) return true;

            const tn = tc.function.name;
            const args = tc.function.arguments;
            const { target, cleanFilename } = resolvePathAndSource(args.filename || '', args.source);

            // 1. Siempre permitir herramientas de lectura e investigación
            if (READ_ONLY_TOOLS.has(tn)) return true;

            // 2. Archivos especiales de memoria en CORE siempre permitidos (TASKS y ACTIVE_CONTEXT)
            const isMemoryFile = target === 'core' && (
                cleanFilename.toLowerCase() === 'tasks.md' ||
                cleanFilename.toLowerCase() === 'active_context.md'
            );

            if (isMemoryFile && ['update_file', 'patch_file', 'delete_file'].includes(tn)) {
                return true;
            }

            // 3. Acciones de alto riesgo SIEMPRE requieren aprobación (consola)
            if (tn === 'run_console') return false;

            // 4. Lógica por modo
            if (isInstructionMode) {
                // Modo Instrucción (Rayo): Conservador. Solo auto-aprueba creación de archivos nuevos en workspace.
                if (target !== 'workSpace') return false;
                if (tn === 'update_file') return currentWorkSpace[cleanFilename] === undefined;
                return false;
            }

            if (isAgentMode) {
                // Modo Agente: Autónomo. Permite todo lo que no sea consola o archivos protegidos (protección manejada en executeToolCall)
                return true;
            }

            // Chat Mode u otros: Auto-aprobar todo lo que no sea consola o archivos protegidos
            // (Ya que el usuario es consciente de los riesgos y las herramientas son seguras)
            return true;
        }

        function needsApproval(tc: ToolCall): boolean {
            // NEVER block if this is an unsupervised background scheduled task
            if (isScheduled) return false;

            return approvalMode === 'manual' || !isAutoApproved(tc);
        }

        async function requestApproval(toolCall: ToolCall, label: string): Promise<boolean> {
            localOnStatus({ currentTool: label, phase: 'waiting_approval' });
            const approved = await onToolApproval(toolCall);
            if (!approved) {
                lastExecutionFeedback = `⚠️ RECHAZADO: El usuario no permitió ejecutar "${toolCall.function.name}".`;
                const b = allBlocks.find(x => x.toolCall?.id === toolCall.id);
                if (b) b.result = { success: false, error: 'Rechazado.' };
                agentMessages.push({ role: 'tool', content: 'Rejected', tool_call_id: toolCall.id });
                onStatus({ rawMessages: [...agentMessages] });
            }
            return approved;
        }

        async function executeAndProcess(toolCall: ToolCall, label: string): Promise<void> {
            localOnStatus({ phase: 'tool_executing', currentTool: label });
            const result = await executeToolCall(toolCall, currentFiles, currentAdditional, currentWorkSpace, currentTools, saveFileFn, deleteFileFn, config, onAddTask);
            const b = allBlocks.find(x => x.toolCall?.id === toolCall.id);
            if (b) b.result = result;

            // DYNAMIC SYNC: Update UI after each tool execution
            onChunk("", false, allBlocks);

            const isSuccess = result?.success && result?.data?.success !== false;
            const hasError = result?.error || (result?.data?.success === false && result?.data?.error);

            if (!isSuccess) {
                retries++;
                const errorContent = hasError ? `Error: ${hasError}` : 'Tool execution failed.';
                lastExecutionFeedback = `❌ FALLO: ${errorContent}`;
                agentMessages.push({ role: 'tool', content: errorContent, tool_call_id: toolCall.id });

                // Fetch JIT Snippet for recovery
                const snippet = extractToolSnippet(toolCall.function.name);
                if (snippet) {
                    const snippetBlock = `\n\nEJEMPLO DE USO CORRECTO:\n${snippet}`;
                    unifiedUserFeedback.push(`⚠️ INSTRUCCIÓN DE RECUPERACIÓN: Se detectó un fallo en "${toolCall.function.name}". Utiliza este formato exacto para corregirlo:${snippetBlock}`);
                    localOnStatus({ rawMessages: [...agentMessages] });
                }
            } else {
                retries = 0;
                const resultData = result.data || {};
                const summary = JSON.stringify(resultData).substring(0, 200);
                lastExecutionFeedback = `✅ ÉXITO: "${toolCall.function.name}" completada. DATOS OBTENIDOS: ${summary}${summary.length >= 200 ? '...' : ''}`;

                const desc = `${toolCall.function.name}(${JSON.stringify(toolCall.function.arguments)})`;
                actionHistory.push(desc);
                agentMessages.push({ role: 'tool', content: JSON.stringify(result), tool_call_id: toolCall.id, name: toolCall.function.name });

                // Add to unified feedback array
                unifiedUserFeedback.push(`📌 DATOS OBTENIDOS: La herramienta "${toolCall.function.name}" devolvió:\n${summary}`);

                onStatus({ rawMessages: [...agentMessages] });

                // CRITICAL: Update local mutable stores so subsequent steps in this session see the changes
                if (['update_file', 'patch_file'].includes(toolCall.function.name) && result.data?.filename) {
                    const { target, cleanFilename } = resolvePathAndSource(toolCall.function.arguments.filename, toolCall.function.arguments.source);
                    let newContent = toolCall.function.arguments.content;
                    if (toolCall.function.name === 'patch_file') {
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

                if (toolCall.function.name === 'delete_file' && result.data?.filename) {
                    const { target, cleanFilename } = resolvePathAndSource(toolCall.function.arguments.filename, toolCall.function.arguments.source);
                    if (target === 'core') delete currentFiles[cleanFilename];
                    else if (target === 'extra') delete currentAdditional[cleanFilename];
                    else if (target === 'workSpace') delete currentWorkSpace[cleanFilename];
                    else if (target === 'tools') delete currentTools[cleanFilename];
                }
            }
        }

        function extractToolSnippet(toolName: string): string {
            // 1. Try to find in CORE Library
            const libraryFile = Object.keys(currentFiles).find(k => k.toLowerCase().endsWith('tool_usage_library.md'));
            const libraryContent = libraryFile ? currentFiles[libraryFile] : '';

            if (libraryContent) {
                const escapedName = toolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`## \\[${escapedName}\\]\\s*\\r?\\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
                const match = libraryContent.match(regex);
                if (match) return match[1].trim();
            }

            // 2. Try to find in Skill Folder (usage.md)
            const skillUsageFile = Object.keys(currentTools).find(k =>
                k.toLowerCase().includes(toolName.toLowerCase()) && k.toLowerCase().endsWith('usage.md')
            );
            if (skillUsageFile) return currentTools[skillUsageFile];

            return "";
        }

        function autoExtractSources(actions: string[], history: any[]): string[] {
            const found: Set<string> = new Set();

            // 1. Scan for filenames (exclude internal protocol files)
            actions.forEach(a => {
                const fileMatch = a.match(/"filename"\s*:\s*"(.*?)"/i);
                if (fileMatch) {
                    const fn = fileMatch[1];
                    const isInternal = fn.startsWith('@CORE/') || fn.toLowerCase() === 'tasks.md' || fn.toLowerCase() === 'active_context.md';
                    if (!isInternal) found.add(fn);
                }
            });

            // 2. Cross-reference actions with dynamic tool metadata
            actions.forEach(a => {
                tools.forEach(t => {
                    const toolName = t.function.name;
                    // Check if toolName is present in the action string (e.g. "tool_name(...)")
                    const nameRegex = new RegExp(`(^|[^a-zA-Z0-9_])${toolName}([^a-zA-Z0-9_]|$)`, 'i');
                    if (nameRegex.test(a)) {
                        const canonical = TOOL_NAME_ALIASES[toolName.toLowerCase()] || toolName;
                        if (['web_search', 'read_url'].includes(canonical)) {
                            found.add("Investigación Web");
                        } else if (canonical !== 'final_answer' && !['read_file', 'update_file', 'patch_file', 'delete_file', 'list_files', 'search_files'].includes(canonical)) {
                            // Use the first part of the description as the source name
                            const desc = t.function.description.split('.')[0].split('|')[0].trim();
                            found.add(`Neural Skill: ${desc || toolName}`);
                        }
                    }
                });
            });

            // 3. Scan for URLs in tool responses
            history.forEach(m => {
                if (m.role === 'tool' && typeof m.content === 'string' && m.content.length < 5000) {
                    const urls = m.content.match(/https?:\/\/[a-z0-9.-]+\.[a-z]{2,}/gi);
                    if (urls) urls.slice(0, 2).forEach(u => found.add(u));
                }
            });
            return Array.from(found);
        }

        function validateAndReport(tc: ToolCall): boolean {
            const v = validateToolArgs(tc, tools);
            if (!v.valid) {
                lastExecutionFeedback = `❌ ERROR TÉCNICO: Parámetros inválidos en "${tc.function.name}". Detalle: ${v.error}`;
                const b = allBlocks.find(x => x.toolCall?.id === tc.id);
                if (b) b.result = { success: false, error: v.error };

                // Fetch JIT Snippet
                const snippet = extractToolSnippet(tc.function.name);
                const snippetBlock = snippet ? `\n\nEJEMPLO DE USO CORRECTO:\n${snippet}` : "";

                // Content for the tool response
                agentMessages.push({ role: 'tool', content: `ERROR DE VALIDACIÓN: ${v.error}${snippetBlock}`, tool_call_id: tc.id });

                // Add to unified feedback
                unifiedUserFeedback.push(`⚠️ ERROR TÉCNICO: Intentaste usar la herramienta "${tc.function.name}" pero los parámetros son incorrectos.\n\nDETALLE: ${v.error}${snippetBlock}\n\nPOR FAVOR, CORRIGE TU LLAMADA EN LA SIGUIENTE ITERACIÓN. No inventes datos.`);

                onStatus({ rawMessages: [...agentMessages] });
                // Update UI with the failure result in the block
                onChunk("", false, allBlocks);
                return false;
            }
            return true;
        }

        // Tool Execution: Batch (Paralelo) vs Seguro (Secuencial)
        let hasFinalAnswer = false;
        const unifiedUserFeedback: string[] = [];

        const processTool = async (tc: ToolCall) => {
            if (abortSignal.aborted) return;
            if (!validateAndReport(tc)) return;
            const approval = needsApproval(tc);
            console.log(`[Agent] Tool "${tc.function.name}": needsApproval=${approval}, isScheduled=${isScheduled}, isAgentMode=${isAgentMode}`);
            if (approval) {
                if (!await requestApproval(tc, tc.function.name)) return;
            }
            await executeAndProcess(tc, tc.function.name);
        };

        const operativeCalls = activeToolCalls.filter(tc => tc.function.name !== 'final_answer');
        const finalCallToProcess = activeToolCalls.find(tc => tc.function.name === 'final_answer');

        if (!safeMode) {
            // Batch Mode (Paralelo)
            await Promise.all(operativeCalls.map(processTool));
        } else {
            // Safe Mode (Secuencial)
            for (const tc of operativeCalls) {
                await processTool(tc);
            }
        }

        if (finalCallToProcess && !abortSignal.aborted) {
            hasFinalAnswer = true;
            const args = finalCallToProcess.function.arguments;
            // Canonical keys handled by normalizeArgKeys in toolCallNormalizer
            const textRaw = args.text || 'Tarea completada exitosamente.';
            const reasoning = args.reasoning || '';

            // REDUNDANCY CHECK: If we have a thought block exactly matches textRaw, remove it
            const redundantIdx = mergedIterationBlocks.findIndex(b =>
                b.type === 'thought' &&
                (b.content.trim() === textRaw.trim() || textRaw.trim().includes(b.content.trim()))
            );
            if (redundantIdx !== -1 && textRaw.length > 20) {
                mergedIterationBlocks.splice(redundantIdx, 1);
            }

            const text = formatFinalResponse(textRaw);
            let sources = args.sources || [];

            // AUTO-SYNERGY: If the model didn't provide sources, we find them
            if (sources.length === 0) {
                sources = autoExtractSources(actionHistory, agentMessages);
            }

            let finalContent = text;

            // Add reasoning if provided as a discrete parameter
            if (reasoning) {
                finalContent = `> **Conclusión:** ${reasoning}\n\n${finalContent}`;
            }

            if (sources.length > 0) {
                finalContent += '\n\n---\n**🧠 Bibliografía y Contexto:**\n' + sources.map((s: string) => `· ${s}`).join('\n');
            }

            // RENDERING: Update blocks for immediate UI display
            allBlocks.push({ type: 'answer', content: finalContent });

            // PERSISTENCE: Overwrite content in the message history so it's not "empty"
            const lastAssistant = [...agentMessages].reverse().find(m => m.role === 'assistant');
            if (lastAssistant) {
                lastAssistant.content = finalContent;
            }

            onChunk(finalContent, true, allBlocks);
        }

        // Apply unified feedback AFTER all tool responses to keep tool messages contiguous
        if (unifiedUserFeedback.length > 0 && !hasFinalAnswer) {
            agentMessages.push({
                role: 'user',
                content: unifiedUserFeedback.join('\n\n---\n\n') + '\n\nREGLA: Usa esta información como base para tu respuesta, pero mantén siempre tu sentido común técnico. Si los resultados parecen irrelevantes, admítelo honestamente y no intentes forzar una conexión falsa. Prioriza la precisión.'
            });
            onStatus({ rawMessages: [...agentMessages] });
        }

        if (hasFinalAnswer) {
            if (onFinalRawHistory) onFinalRawHistory([...agentMessages]);
            localOnStatus({ phase: 'idle', elapsedMs: Date.now() - startTime, rawMessages: [...agentMessages] });
            return;
        }

        onChunk(content, true, allBlocks);
        onStatus({ rawMessages: [...agentMessages] });
    }
}
