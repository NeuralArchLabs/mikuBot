/**
 * Core Agent Logic
 * Path: src/services/core/agent.ts
 */
import { ToolCall, ToolResult, ToolDefinition, AppConfig, AgentStatus, AgentLogEntry, FileTarget, ApprovalMode, MessageBlock } from '../../types';
import { PROTECTED_CORE_FILES, CONSOLE_ALLOWED_COMMANDS, CONSOLE_BLOCKED_PATTERNS } from '../../constants';
import { validateToolArgs, safeFetch } from '../../utils';
import { recoverToolCallsFromText, normalizeRawToolCall, RecoveredCall } from '../formatters/toolCallNormalizer';
import { formatFinalResponse } from '../formatters/answerFormatter';
import { formatTelegramResponse } from '../formatters/telegramFormatter';
import { TOOL_NAME_ALIASES } from '../formatters/normalization/dictionaries';
import { ProviderFactory, ProviderOptions } from './ModelProviders';

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

function getRelativePath(target: FileTarget, filename: string): string {
    const map: Record<FileTarget, string> = {
        core: 'core',
        extra: 'library',
        workSpace: 'workspace',
        tools: 'commands'
    };
    // Ensure filename doesn't start with a slash
    const cleanFn = filename.startsWith('/') || filename.startsWith('\\') ? filename.slice(1) : filename;
    return `${map[target]}/${cleanFn}`;
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
                const staticPath = config.folderPaths?.[target];
                const relPath = getRelativePath(target, cleanFilename);
                const isElectron = !!(window as any).electron;
                const finalPath = (isElectron && staticPath) ? `${staticPath}/${cleanFilename}` : relPath;

                if (isElectron && (window as any).electron?.agentReadFile) {
                    const result = await (window as any).electron.agentReadFile({ path: finalPath });
                    if (result.ok) {
                        return { success: true, data: { filename: cleanFilename, content: result.content, source: target } };
                    }
                    return { success: false, error: `Error reading file natively: ${result.error}` };
                }

                const store = getFileStore(target, files, additionalFiles, workSpaceFiles, toolsFiles);
                const content = store[cleanFilename];
                if (content !== undefined) {
                    return { success: true, data: { filename: cleanFilename, content, source: target } };
                }
                return { success: false, error: `File "${cleanFilename}" not found in ${target} folder.` };
            }

            case 'update_file': {
                if (!args.filename) return { success: false, error: 'Missing required parameter: filename.' };
                const { target, cleanFilename } = resolvePathAndSource(args.filename, args.source);
                
                // Protection logic
                const isProtected = PROTECTED_CORE_FILES.some(p => {
                    const lowFile = cleanFilename.toLowerCase();
                    const lowP = p.toLowerCase();
                    return lowFile === lowP || lowFile.endsWith('/' + lowP);
                });
                if (target === 'core' && isProtected) {
                    return { success: false, error: `"${cleanFilename}" is a PROTECTED file.` };
                }

                if ((window as any).electron?.writeFile) {
                    const relPath = getRelativePath(target, cleanFilename);
                    // We stick to the saveFileFn passed as argument for now to maintain consistency with renderer state
                }

                const saved = await saveFileFn(cleanFilename, args.content, target);
                if (saved) {
                    const store = getFileStore(target, files, additionalFiles, workSpaceFiles, toolsFiles);
                    store[cleanFilename] = args.content;
                }
                if (saved) {
                    return { success: true, data: { filename: cleanFilename, message: `File "${cleanFilename}" saved.`, source: target } };
                }
                return { success: false, error: `Failed to save "${cleanFilename}".` };
            }

            case 'patch_file': {
                if (!args.filename || (!args.find && !args.search && !args.patches)) {
                    return { success: false, error: 'Missing parameters: must provide either (find/search + replace) OR a "patches" array.' };
                }
                const { target, cleanFilename } = resolvePathAndSource(args.filename, args.source);
                const staticPath = config.folderPaths?.[target];
                const relPath = getRelativePath(target, cleanFilename);
                const isElectron = !!(window as any).electron;
                
                // If in Electron and we have a static path, use absolute path to avoid workspace desync
                const finalPath = (isElectron && staticPath) ? `${staticPath}/${cleanFilename}` : relPath;

                if (isElectron && (window as any).electron?.patchFile) {
                    const result = await (window as any).electron.patchFile({
                        path: finalPath,
                        search: args.search || args.find,
                        replace: args.replace,
                        strategy: args.strategy || 'auto',
                        lineNumber: args.lineNumber,
                        patches: args.patches
                    });
                    if (result.ok) {
                        let finalMsg = result.result;
                        if (finalMsg === 'No changes applied.' && cleanFilename.toLowerCase().includes('tasks.md')) {
                            finalMsg = '✅ SINCRONIZADO: El archivo ya refleja los cambios (marcado automático detectado).';
                        }
                        return { success: true, data: { filename: cleanFilename, message: finalMsg, source: target } };
                    }
                    return { success: false, error: result.error };
                }

                // Fallback to basic patch if not in Electron
                const patchStore = getFileStore(target, files, additionalFiles, workSpaceFiles, toolsFiles);
                const existingContent = patchStore[cleanFilename];
                if (existingContent === undefined) return { success: false, error: `File not found.` };
                
                const findBlock = args.search || args.find;
                const findIdx = existingContent.indexOf(findBlock);
                if (findIdx === -1) return { success: false, error: `Could not find the exact text block.` };

                const patchedContent = existingContent.substring(0, findIdx) + args.replace + existingContent.substring(findIdx + findBlock.length);
                const patchSaved = await saveFileFn(cleanFilename, patchedContent, target);
                if (patchSaved) {
                    patchStore[cleanFilename] = patchedContent;
                }
                return patchSaved ? { success: true, data: { filename: cleanFilename, message: `Patched successfully.`, source: target } } : { success: false, error: `Failed to save.` };
            }

            case 'undo_patch': {
                const { target, cleanFilename } = resolvePathAndSource(args.filename, args.source);
                const staticPath = config.folderPaths?.[target];
                const relPath = getRelativePath(target, cleanFilename);
                const isElectron = !!(window as any).electron;
                const finalPath = (isElectron && staticPath) ? `${staticPath}/${cleanFilename}` : relPath;

                if (isElectron && (window as any).electron?.undoPatch) {
                    const result = await (window as any).electron.undoPatch({ path: finalPath });
                    if (result.ok) return { success: true, data: { message: result.result } };
                    return { success: false, error: result.error };
                }
                return { success: false, error: 'Undo not available in this mode.' };
            }

            case 'get_file_outline': {
                 const { target, cleanFilename } = resolvePathAndSource(args.filename, args.source);
                 const staticPath = config.folderPaths?.[target];
                 const relPath = getRelativePath(target, cleanFilename);
                 const isElectron = !!(window as any).electron;
                 const finalPath = (isElectron && staticPath) ? `${staticPath}/${cleanFilename}` : relPath;

                 if (isElectron && (window as any).electron?.getFileOutline) {
                     const result = await (window as any).electron.getFileOutline({ path: finalPath });
                     if (result.ok) return { success: true, data: { outline: result.outline } };
                     return { success: false, error: result.error };
                 }
                 return { success: false, error: 'Outline not available.' };
            }

            case 'batch_operation': {
                if ((window as any).electron?.batchOperation) {
                    const { target: srcTarget, cleanFilename: srcFn } = resolvePathAndSource(args.source_path || args.filename || '', args.source);
                    const { target: destTarget, cleanFilename: destFn } = resolvePathAndSource(args.destination_path || args.destination || '', args.source);
                    
                    const result = await (window as any).electron.batchOperation({
                        operation: args.operation,
                        source: getRelativePath(srcTarget, srcFn),
                        destination: args.destination ? getRelativePath(destTarget, destFn) : undefined,
                        pattern: args.pattern
                    });
                    if (result.ok) return { success: true, data: { message: result.result } };
                    return { success: false, error: result.error };
                }
                return { success: false, error: 'Batch not available.' };
            }

            case 'list_files': {
                const target = resolveSource(args.source);
                const subDir = args.directory || args.path || "";
                const store = getFileStore(target, files, additionalFiles, workSpaceFiles, toolsFiles);
                
                let fileList = Object.keys(store).map(f => ({
                    name: f,
                    size: (store[f] || '').length
                }));

                if (subDir) {
                    const normalizedSub = subDir.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
                    fileList = fileList.filter(f => 
                        f.name.startsWith(normalizedSub + '/') || 
                        f.name === normalizedSub
                    );
                }

                return { success: true, data: { files: fileList, count: fileList.length, source: target, filtered_by: subDir || 'all' } };
            }

            case 'search_files': {
                if ((window as any).electron?.searchFilesNative) {
                    const target = resolveSource(args.source);
                    const result = await (window as any).electron.searchFilesNative({
                        searchText: args.query,
                        caseSensitive: args.caseSensitive || false,
                        filePattern: args.filePattern,
                        searchPath: args.searchPath ? `${getRelativePath(target, '')}/${args.searchPath}` : getRelativePath(target, '')
                    });
                    if (result.ok) return { success: true, data: { query: args.query, matches: result.results, count: result.results.length, source: target } };
                }
                // Fallback
                const target = resolveSource(args.source);
                const store = getFileStore(target, files, additionalFiles, workSpaceFiles, toolsFiles);
                const query = args.query.toLowerCase();
                const matches: { filename: string; lines: string[] }[] = [];
                for (const [filename, content] of Object.entries(store)) {
                    const matchingLines = content.split('\n').filter(line => line.toLowerCase().includes(query)).slice(0, 5);
                    if (matchingLines.length > 0) matches.push({ filename, lines: matchingLines });
                }
                return { success: true, data: { query: args.query, matches, totalFiles: matches.length, source: target } };
            }

            case 'get_system_metrics': {
                if ((window as any).electron?.getSystemMetrics) {
                    const result = await (window as any).electron.getSystemMetrics();
                    if (result.ok) return { success: true, data: result.metrics };
                    return { success: false, error: result.error };
                }
                return { success: false, error: 'Metrics not available.' };
            }

            case 'get_git_info': {
                if ((window as any).electron?.getGitInfo) {
                    const result = await (window as any).electron.getGitInfo();
                    if (result.ok) return { success: true, data: result.info };
                    return { success: false, error: result.error };
                }
                return { success: false, error: 'Git info not available.' };
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
                        if (response.error?.includes('Engine not installed') || response.error?.includes('ECONNREFUSED')) {
                            return {
                                success: false,
                                error: `Native Search failed: ${response.error}. TIP: El motor searXena no parece estar activo. Puedes arrancarlo desde la Configuración.`
                            };
                        }
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
                    let finalArgs = cmdArgs;
                    const isWindows = navigator.userAgent.includes('Windows') || (window as any).electron?.platform === 'win32';

                    // Specialized fix for mkdir on Windows
                    if (cmd === 'mkdir' && isWindows) {
                        // Normalize slashes to backslashes for Windows mkdir
                        finalArgs = finalArgs.replace(/\//g, '\\');
                        // Remove -p flag (can be -p, --parents, etc. but Windows mkdir creates parents by default if single path, 
                        // or we just remove it to avoid syntax error in CMD)
                        finalArgs = finalArgs.replace(/\B-p\b/g, '').replace(/\B--parents\b/g, '').replace(/\s+/g, ' ').trim();
                    }

                    const result = await (window as any).electron.runConsole({
                        command: cmd,
                        args: finalArgs,
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
                    const store = getFileStore(target, files, additionalFiles, workSpaceFiles, toolsFiles);
                    delete store[cleanFilename];
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
/**
 * Cleans technical noise, protocol echoes, and JSON fragments from segments.
 */
function cleanTechnicalNoise(text: string, signatureRegex: RegExp): string {
    let s = (text || '').trim();
    if (!s) return '';

    // 1. ELIMINAR ETIQUETAS XML (Ghost tools) Y PENSAMIENTO FORZADO
    s = s.replace(/<\|?tool_call\|?>[\s\S]*?<\|?\/?tool_call\|?>/gi, '');
    s = s.replace(/<think>[\s\S]*?<\/think>/gi, '');

    // 2. ELIMINAR BLOQUES JSON COMPLETOS Y FRAGMENTADOS
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

    s = s.replace(/\{\s*"(?:name|action|function|tool_call|arguments|args)"\s*:.*$/gim, '');
    s = s.replace(/^\s*[\}\],]+\s*$/gm, '');
    s = s.replace(/[\}\],]+\s*$/g, '');

    // 3. ELIMINAR ECOS DEL PROTOCOLO Y LOGS TÉCNICOS
    const noisePatterns = [
        /^(?:I apologize|My apologies|You are right|You are correct)[\s\S]*?(?={|\[|{{)/i,
        /^(?:Thinking Process|Neural Flow|Neural Core|Proceso de Razonamiento|Active Reasoning|Razonamiento Activo|Flujo Neural|Core de Miku|Razonamiento)[\s\S]*?(?={|\[|{{)/i,
        /^\s*(?:Active Reasoning|Razonamiento Activo|Razonamiento|Neural Core|Miku Core|READY|SUCCESS|ERROR|FAILURE|WEB_SEARCH|SEARCHING|ANALYZING|DONE|COMPLETED)\s*$/gim,
        /\[[x\s]\]\s*@?(?:CORE|EXTRA|WORKSPACE|TOOLS|LIBRARY)\/[^\s]*/gi,
        /^(?:tool_call|web_search|read_file|update_file|patch_file|delete_file|run_console|add_scheduled_task|final_answer|list_files|search_files|read_url)[:\s]*/gim,
        /Tool Calls:\s*\[[\s\S]*?\]/gi, 
        /(?:^|\n)Tool Calls[:\s]*/gi,
        /\[\s*\{\s*"id":[\s\S]*?\}\s*\]/gi,
        /^(?:\[assistant\]|\[tool\]|\[user\]|\[system\])[:\s]*/gim,
        /^\s*[-*=_]{3,}\s*\n/i, // Strip leading separator line
        /\n\s*[-*=_]{3,}\s*$/i // Strip trailing separator line
    ];
    noisePatterns.forEach(p => s = s.replace(p, ''));

    // 4. LIMPIEZA DE CERCAS Y ESPACIOS SOBRANTES
    s = s.replace(/```(?:json|JSON)?/gi, '');
    s = s.replace(/```/g, '');

    return s.trim();
}

/**
 * Segments a text into thought and narrative blocks, preserving <think> content.
 */
function segmentThoughtsAndNarrative(text: string, signatureRegex: RegExp): MessageBlock[] {
    if (!text) return [];
    
    // Check for <think> tags
    const thinkRegex = /<think>([\s\S]*?)(?:<\/think>|$)/gi;
    const blocks: MessageBlock[] = [];
    let lastIdx = 0;
    let match;

    while ((match = thinkRegex.exec(text)) !== null) {
        // Text before the <think> tag
        const preamble = text.substring(lastIdx, match.index);
        if (preamble.trim()) {
            const cleaned = cleanTechnicalNoise(preamble, signatureRegex);
            if (cleaned) blocks.push({ type: 'answer', content: cleaned, isFromNarrative: true });
        }
        
        // The thought content itself
        if (match[1].trim()) {
            blocks.push({ type: 'thought', content: match[1].trim() });
        }
        lastIdx = thinkRegex.lastIndex;
    }

    // Remaining text after last <think> tag
    const remaining = text.substring(lastIdx);
    if (remaining.trim()) {
        const cleaned = cleanTechnicalNoise(remaining, signatureRegex);
        if (cleaned) blocks.push({ type: 'answer', content: cleaned, isFromNarrative: true });
    }

    return blocks;
}

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
    ): Promise<{ content: string; toolCalls: any[]; reasoning?: string }> {
        const provider = config.provider;
        const isElectronProxy = !!(window as any).electron?.apiStream;

        const options: ProviderOptions = {
            config,
            onStatus: customOnStatus || onStatus,
            onChunk: (chunk: string) => {
                // Provider internally calls this, but bridgedOnStatus 
                // in agent.ts will handle the actual UI bridging.
            },
            abortSignal: abortSignal!,
            useTools: useTools && modelSupportsNativeTools,
            tools,
            isElectronProxy
        };

        const providerInstance = ProviderFactory.create(provider, options);
        
        try {
            return await providerInstance.streamRequest(messages);
        } catch (err: any) {
            // Polimorfismo: El proveedor decide si el error amerita un fallback a texto
            if (useTools && modelSupportsNativeTools && providerInstance.shouldFallback(err)) {
                log('warn', `El modelo ${config.model} reportó un error con herramientas nativas. Activando fallback a extracción de texto.`);
                modelSupportsNativeTools = false;
                return streamModelRequest(messages, useTools, customOnStatus);
            }
            throw err;
        }
    }

    // OPTIMIZATION: Prepare historical context by summarizing past tool executions.
    // This reduces token usage and prevents "context pollution" while keeping the agent 
    // aware of its previous actions and their outcomes.
    const historicalContext = chatMessages.map(m => {
        const msg = { ...m } as any;
        
        // 1. Summarize heavy Assistant messages (plan turns with large arguments)
        if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
            try {
                const calls = msg.tool_calls;
                const totalArgsLen = JSON.stringify(calls).length;
                
                // If it's a "heavy" call (lots of code or data in arguments)
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
                    
                    // CRITICAL: For plain history, we remove tool metadata to treat it as text
                    delete msg.tool_calls;
                }
            } catch { /* ignore parsing errors */ }
        }

        // 2. Summarize Tool Responses (result turns)
        if (msg.role === 'tool' && msg.content) {
            try {
                // Ignore already summarized messages or very brief ones
                if (!msg.content.trim().startsWith('{') || msg.content.length < 150) return m;

                const parsed = JSON.parse(msg.content);
                const isSuccess = parsed.success !== false;
                const toolName = msg.tool_name || 'unknown_tool';
                
                let summary = `${isSuccess ? '✅' : '❌'} [HISTÓRICO] ${toolName}`;
                
                // Add contextual brief from arguments or results
                const args = msg.tool_args || {}; 
                const filename = parsed.data?.filename || args.filename;
                const query = parsed.data?.query || args.query;
                const cmd = parsed.data?.command || args.command;

                if (filename) summary += `: "${filename}"`;
                else if (query) summary += `: "${query}"`;
                else if (cmd) summary += `: "${cmd} ${args.args || ''}"`;
                else if (parsed.message) summary += `: ${parsed.message.substring(0, 80)}...`;
                
                if (isSuccess) {
                    summary += ` | Status: SUCCESS (Acción completada con éxito)`;
                } else {
                    summary += ` | Status: ERROR (${(parsed.error || parsed.data?.error || 'Falló').substring(0, 100)})`;
                }
                
                // Convert to plain user message for the model in history to optimize tokens
                return { 
                    role: 'user', 
                    content: `[LOG DE SISTEMA] ${summary}`
                };
            } catch {
                return m;
            }
        }
        return msg;
    });

    let activeContext = historicalContext;
    // Normalización: Tanto el modo Agente como el modo de Instrucción (Rayo) 
    // deben usar una ventana de contexto optimizada que preserve la misión inicial.
    if (isAgentMode || isInstructionMode) {
        const filtered = historicalContext.filter(m => !m.content.startsWith('⚡ Command Executed:'));
        
        // El Modo Instrucción (Rayo) es "Lite": 10 mensajes.
        // El Modo Agente es "Full": 30 mensajes.
        const windowSize = isInstructionMode ? 10 : 30;

        // Tomamos los últimos mensajes. La "Misión Original" se inyecta dinámicamente en el System Prompt.
        activeContext = filtered.slice(-windowSize);
    }

    const agentMessages: any[] = [
        { role: 'system', content: systemPrompt },
        ...activeContext,
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

    // Mission Anchoring: The "missionTrigger" is the last specific instruction from the user.
    // We search the historicalContext (already optimized) for the most recent user prompt.
    const missionTrigger = [...historicalContext].reverse().find(m => m.role === 'user')?.content || 'Sin objetivo definido.';
    let lastExecutionFeedback = 'Inicio de misión.';

    // Proxy onStatus to always include feedback for visual synchronization plus real-time streaming bridge
    const signatureRegex = /\{\{?[\s\S]*?≈̼\^\.┬\.̼\^≈‿⟆[\s\S]*?\}\}?/;
    const localOnStatus = (status: Partial<AgentStatus>) => {
        onStatus({ ...status, lastExecutionFeedback });
    };

    let lastStreamUpdate = 0;
    const bridgedOnStatus = (status: Partial<AgentStatus>) => {
        localOnStatus(status);
        
        // STREAMING BRIDGE: If we are in the streaming phase, update the message bubble in real-time
        if (status.phase === 'streaming' && (status.streamedText !== undefined || status.streamedReasoning !== undefined)) {
            const now = Date.now();
            if (now - lastStreamUpdate > 80) { // Throttled to ~12fps for UI performance
                lastStreamUpdate = now;
                
                // Construct temporary blocks for real-time visualization
                const tempIterationBlocks: MessageBlock[] = [];
                
                // 1. Handle Reasoning (Thought)
                if (status.streamedReasoning && status.streamedReasoning.trim()) {
                    tempIterationBlocks.push({ type: 'thought', content: status.streamedReasoning.trim() });
                }
                
                // 2. Handle Narrative Text
                if (status.streamedText) {
                    const segmented = segmentThoughtsAndNarrative(status.streamedText, signatureRegex) as MessageBlock[];
                    
                    // EARLY-DETECT: If we see final_answer in the stream, treat BEFORE-text as thoughts
                    const hasFinalInStream = status.streamedText.toLowerCase().includes('final_answer');
                    if (hasFinalInStream) {
                        segmented.forEach(b => {
                            if (b.type === 'answer' && b.isFromNarrative) {
                                // DE-DUPLICATION: If native reasoning already contains this text, skip converting it
                                // This prevents double "Active Reasoning" blocks when models echo thoughts in narrative.
                                const isDuplicate = status.streamedReasoning && 
                                    (status.streamedReasoning.trim().includes(b.content.trim()) || 
                                     b.content.trim().includes(status.streamedReasoning.trim()));

                                if (!isDuplicate) {
                                    b.type = 'thought';
                                } else {
                                    // If it is a duplicate, we mark it as empty/ignored to not show it twice
                                    b.content = ''; 
                                }
                            }
                        });
                    }
                    tempIterationBlocks.push(...segmented.filter(b => b.content.trim() !== ''));
                }
                
                // Emit to App.tsx callback immediately
                onChunk(status.streamedText || '', true, [...allBlocks, ...tempIterationBlocks]);
            }
        }
    };

    let memorySaved = false;

    // ── Main Agent Loop ──────────────────────────────────────────────
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

            tasksContent = findTaskContent() || '';

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
            const autoTaskInfo = turnAutoTasks.length > 0 ? `\n✨ AUTO-SINC: Tareas tachadas automáticamente: ${turnAutoTasks.join(', ')}` : "";
            
            // Check for unplanned actions to report to agent
            const unplannedInfo = (successfulCalls.length > 0 && turnAutoTasks.length === 0 && tasksContent.includes('[ ]')) 
                ? "\n⚠️ NOTA: Has realizado acciones que no parecen coincidir con ninguna tarea pendiente en tu plan. Asegúrate de que tus tareas mencionen la herramienta y el objetivo (ej: - [ ] Leer index.ts)."
                : "";

            const awarenessBlock = `[ESTADO_DEL_AGENTE]
Misión Original: "${missionTrigger}"
Turno Actual: ${iterations} de ${MAX_RETRIES}
(Nota: El bloque [PLAN_DE_TRABAJO_ACTUAL] de abajo es un reflejo EXACTO de @CORE/TASKS.md. No necesitas usar read_file para consultarlo).
[/ESTADO_DEL_AGENTE]
[FOCO_DE_OPERACIÓN]
Resultado Anterior: ${lastExecutionFeedback}${autoTaskInfo}${unplannedInfo}
Tarea Completada: ${lastDone}
Siguiente Acción: ${nextTodo}
${lastExecutionFeedback.includes('DATOS OBTENIDOS') ? '⚠️ RECOLECCIÓN: Usa los datos del "Resultado Anterior" para tu respuesta final. NUNCA inventes números.' : ''}
[/FOCO_DE_OPERACIÓN]`;

            // PLAN DE TRABAJO REFRESH
            // Sanitize tasksContent to avoid whitespace accumulation
            const sanitizedTasks = (tasksContent || '').trim();
            const workPlanBlock = `\n[PLAN_DE_TRABAJO_ACTUAL]\n${sanitizedTasks || 'No hay tareas activas.'}\n[/PLAN_DE_TRABAJO_ACTUAL]\n`;

            let systemPromptCurrent = agentMessages[0].content;

            // Update Working Memory (tasks.md content)
            const wpStart = systemPromptCurrent.indexOf("[PLAN_DE_TRABAJO_ACTUAL]");
            const wpEnd = systemPromptCurrent.indexOf("[/PLAN_DE_TRABAJO_ACTUAL]");
            if (wpStart !== -1 && wpEnd !== -1) {
                const beforeWP = systemPromptCurrent.substring(0, wpStart).trimEnd();
                const afterWP = systemPromptCurrent.substring(wpEnd + "[/PLAN_DE_TRABAJO_ACTUAL]".length).trimStart();
                systemPromptCurrent = beforeWP + "\n" + workPlanBlock + "\n" + afterWP;
            }

            // Simplified markers for better reliability (awareness & focus)
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
        let nativeReasoning: string | undefined;

        try {
            const messagesForModel = [...agentMessages];
            const result = await streamModelRequest(messagesForModel, useTextExtraction, bridgedOnStatus);
            content = result.content;
            nativeToolCalls = result.toolCalls;
            nativeReasoning = result.reasoning;
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            throw err;
        }

        let finalToolCalls: ToolCall[] = [];
        let positionalCalls: RecoveredCall[] = [];

        // 1. Extract tool calls (with positions if possible)
        if (content && useTextExtraction) {
            const { calls, warnings } = recoverToolCallsFromText(content, tools);
            if (calls.length > 0) {
                log('info', `📡 Herramientas detectadas en texto: ${calls.map(c => c.toolCall.function.name).join(', ')}`);
                console.log(`[Tool Recovery] Found ${calls.length} calls in text.`, warnings);
            }
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

        // Deduplicate and enforce single final_answer
        const uniqueToolCalls: ToolCall[] = [];
        const seenFpSet = new Set<string>();
        let bestFinalAnswer: ToolCall | null = null;
        
        // We iterate in REVERSE to favor native/later calls if they have same fingerprint
        const reversedCalls = [...finalToolCalls].reverse();

        for (const tc of reversedCalls) {
            const isFinal = tc.function.name === 'final_answer';
            if (isFinal) {
                if (!bestFinalAnswer) {
                    bestFinalAnswer = tc;
                } else {
                    // Preference: higher argument richness
                    const newLen = JSON.stringify(tc.function.arguments).length;
                    const bestLen = JSON.stringify(bestFinalAnswer.function.arguments).length;
                    const newHasSources = !!tc.function.arguments.sources;
                    const bestHasSources = !!bestFinalAnswer.function.arguments.sources;
                    
                    if ((newHasSources && !bestHasSources) || (newLen > bestLen && !bestHasSources)) {
                        bestFinalAnswer = tc;
                    }
                }
                continue;
            }

            const fp = getActionFingerprint(tc.function.name, tc.function.arguments);
            if (!seenFpSet.has(fp)) {
                seenFpSet.add(fp);
                uniqueToolCalls.push(tc);
            }
        }
        if (bestFinalAnswer) uniqueToolCalls.push(bestFinalAnswer);
        
        // Sync positionalCalls with unique ones
        positionalCalls = positionalCalls.filter(pc => 
            uniqueToolCalls.some(utc => utc.id === pc.toolCall.id)
        );

        // INTERLEAVED SEGMENTATION: Chronologically interleave text and tool blocks
        const iterationBlocks: MessageBlock[] = [];
        
        // A0. Add Native Reasoning if present
        if (nativeReasoning && nativeReasoning.trim()) {
            iterationBlocks.push({ type: 'thought', content: nativeReasoning.trim() });
        }

        let curIdx = 0;
        const seenFpForInterleaving = new Set<string>();

        const sortedPosCalls = [...positionalCalls].sort((a, b) => a.start - b.start);
        
        for (const rc of sortedPosCalls) {
            const rawSegment = (content || '').substring(curIdx, rc.start);
            const segmentBlocks = segmentThoughtsAndNarrative(rawSegment, signatureRegex) as MessageBlock[];
            
            segmentBlocks.forEach(b => iterationBlocks.push(b));

            // [DEDUPLICATION MASK]: Skip blocked/deduplicated calls so they don't echo in narrative
            const isKept = uniqueToolCalls.some(utc => utc.id === rc.toolCall.id);
            if (!isKept) {
                console.log(`[Agent] Masking shadow call: ${rc.toolCall.function.name}`);
                curIdx = rc.end;
                continue;
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
                    // Skip adding to iterationBlocks here. 
                    // We will handle the authoritative final_answer at the END of the turn
                    // to avoid duplicates and ensure full formatting.
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
        const finalBlocks = segmentThoughtsAndNarrative(finalRawSegment, signatureRegex) as MessageBlock[];
        
        if (finalBlocks.length > 0) {
            const isOnlyText = uniqueToolCalls.length === 0;
            if (isOnlyText) {
                // In purely narrative turns, treat the last segment of cleaned text as an answer if not already tagged
                finalBlocks.forEach(b => {
                    b.type = 'answer';
                    b.isFromNarrative = true;
                });
            } else {
                finalBlocks.forEach(b => {
                    if (b.type === 'answer') {
                        b.isFromNarrative = true;
                    }
                });
            }
            iterationBlocks.push(...finalBlocks);
        }

        // CONSOLIDATION: Merge consecutive thoughts and discard "Narrative Echoes"
        const mergedIterationBlocks: MessageBlock[] = [];
        const finalAnswerCallData = uniqueToolCalls.find(tc => tc.function.name === 'final_answer');
        const finalAnswerArgs = finalAnswerCallData?.function.arguments || {};
        const finalAnswerTextRaw = (finalAnswerArgs.text || finalAnswerArgs.respuesta || finalAnswerArgs.answer || finalAnswerArgs.content || '').trim();
        const turnHasFinalAnswer = uniqueToolCalls.some(tc => tc.function.name === 'final_answer') && finalAnswerTextRaw.length > 0;

        iterationBlocks.forEach(block => {
            // SMART REDIRECT: If we have a 'final_answer', we assume any text outside 
            // the tool block is actually "Reasoning/Transcription" (Pensamiento) 
            // rather than part of the actual final response. 
            // We convert these narrative blocks into 'thought' blocks for cleaner UI wrapping.
            if (turnHasFinalAnswer && block.type === 'answer' && block.isFromNarrative) {
                block.type = 'thought';
                block.isFromNarrative = false; // It's now a processed thought
            }

            const last = mergedIterationBlocks[mergedIterationBlocks.length - 1];
            if (last && last.type === 'thought' && block.type === 'thought') {
                last.content += `\n\n${block.content}`;
            } else {
                if (block.content && block.content.trim().length > 1) {
                    mergedIterationBlocks.push(block);
                }
            }
        });

        // HISTORY CLEANUP: If the model is using final_answer, the text outside the tool 
        // is usually a duplicate or noise. We clear it from history to keep context clean.
        let historyContent = content || ' ';
        if (turnHasFinalAnswer) {
            historyContent = ' '; // Only the tool_call content will represent the answer in history
        }

        agentMessages.push({
            role: 'assistant',
            content: (nativeReasoning ? `<think>\n${nativeReasoning}\n</think>\n` : '') + historyContent,
            tool_calls: uniqueToolCalls.length > 0 ? JSON.parse(JSON.stringify(uniqueToolCalls)) : undefined,
        });

        // DYNAMIC SYNC: Emit blocks using replace: true to ensure UI matches our current turn state exactly
        onChunk(content || '', true, [...allBlocks, ...mergedIterationBlocks]);
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

            // NEW: Count pending tasks to enforce completion
            const pendingTasks = (tasksContent || '').split('\n').filter(l => l.trim().startsWith('- [ ]'));
            const pendingTasksCount = pendingTasks.length;

            const isViolation = (hasTasksFile && !isDeletingTasks) || (isUpdatingTasks && !isDeletingTasks) || (hasTasksFile && pendingTasksCount > 0);

            if (isViolation && isAgentMode) {
                log('warn', `Protocol violation: pendingTasks=${pendingTasksCount}, hasTasksFile=${hasTasksFile}`);
                
                // CRITICAL: Clean up UI blocks to avoid "yellow" stuck tools
                const cleanedBlocks = mergedIterationBlocks.filter(b => b.type !== 'tool_call');
                onChunk(content || '', false, [...allBlocks, ...cleanedBlocks]);

                let protocolError = '⚠️ BLOQUEO DE PROTOCOLO: No puedes dar un "final_answer" mientras `@CORE/TASKS.md` exista o esté siendo actualizado. Debes completar TODAS las tareas, marcar los checks `[x]` y finalmente ELIMINAR el archivo con `delete_file` antes de responder.';
                if (pendingTasksCount > 0) {
                    const tasksList = pendingTasks.map(t => t.replace('- [ ]', '•')).join('\n');
                    protocolError = `⚠️ BLOQUEO DE PROTOCOLO: Aún tienes ${pendingTasksCount} tarea(s) pendientes en \`TASKS.md\`:\n${tasksList}\n\nDebes marcar estas tareas como \`[x]\` (manualmente o mediante acciones que el sistema pueda auto-detectar) antes de poder finalizar.`;
                }
                
                agentMessages.push({
                    role: 'tool',
                    tool_name: finalAnswerCall.function.name,
                    content: protocolError,
                    tool_call_id: finalAnswerCall.id,
                    tool_args: finalAnswerCall.function.arguments
                });
                
                uniqueToolCalls.length = 0;
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
            if (isAgentMode || isInstructionMode) {
                const hasSubstantialText = (content?.length || 0) > 15 || (nativeReasoning?.length || 0) > 15;

                if (isJustSignature || hasSubstantialText) {
                    onChunk(content || '', false, allBlocks);
                    if (onFinalRawHistory) {
                        onFinalRawHistory([...agentMessages]);
                        memorySaved = true;
                    }
                    localOnStatus({ phase: 'idle', elapsedMs: Date.now() - startTime, rawMessages: [...agentMessages] });
                    return;
                } else if (retries < MAX_RETRIES) {
                    retries++;

                    // Check if the previous message was already a technical error nudge to avoid redundancy
                    const lastMsg = agentMessages[agentMessages.length - 1];
                    if (lastMsg && lastMsg.role === 'user' && lastMsg.content.includes('⚠️ PROTOCOLO DE AGENTE INCOMPLETO')) {
                        localOnStatus({ phase: 'thinking', retries, rawMessages: [...agentMessages] });
                        continue; // Skip the redundant "Incomplete Protocol" nudge if we already nudged for a tool error
                    }

                    const protocolNudge = `⚠️ PROTOCOLO DE AGENTE INCOMPLETO:
Has proporcionado texto, pero ninguna herramienta (JSON). Si ya tienes la respuesta final para Armando, debes usar obligatoriamente la herramienta "final_answer".

**EJEMPLO DE CIERRE:**
{"name": "final_answer", "arguments": {
  "text": "Tu respuesta final aquí...",
  "reasoning": "Breve explicación de por qué esta es la respuesta."
}}

Si necesitas realizar más acciones, emite la llamada JSON correspondiente. NO respondas solo con texto.`;
                    
                    lastExecutionFeedback = '❌ FALLO: Falta llamada a herramienta (JSON).';
                    agentMessages.push({ role: 'user', content: protocolNudge });
                    onStatus({ phase: 'thinking', retries, rawMessages: [...agentMessages] });
                    continue;
                }
            } else {
                onChunk(content || '', false, allBlocks);
                if (onFinalRawHistory) onFinalRawHistory([...agentMessages]);
                localOnStatus({ phase: 'idle', elapsedMs: Date.now() - startTime });
                break;
            }
        }

        // --- Execute tool calls ---
        localOnStatus({ phase: 'tool_calling' });
        const READ_ONLY_TOOLS = new Set([
            'read_file', 'list_files', 'search_files', 'web_search', 'read_url', 
            'list_available_skills', 'get_system_metrics', 'get_git_info', 
            'instruction_booklet', 'get_file_outline'
        ]);

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

            // Chat Mode: Auto-approve safe operations to keep flow smooth. 
            // Risky ones (console) and protected files are still blocked by specific rules above.
            return !isAgentMode && !isInstructionMode; 
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
                agentMessages.push({ 
                    role: 'tool', 
                    tool_name: toolCall.function.name,
                    content: 'Rejected', 
                    tool_call_id: toolCall.id,
                    tool_args: toolCall.function.arguments
                });
                onStatus({ rawMessages: [...agentMessages] });
            }
            return approved;
        }

        async function executeAndProcess(toolCall: ToolCall, label: string): Promise<void> {
            localOnStatus({ phase: 'tool_executing', currentTool: label });

            const args = toolCall.function.arguments;
            // [WIN-FIX]: Handle Linux-style mkdir -p on Windows
            if (toolCall.function.name === 'run_console') {
                const cmd = args.command || '';
                const a = args.args || '';
                if (cmd === 'mkdir' && a.includes('-p')) {
                    args.args = a.replace('-p', '').trim();
                }
            }

            const result = await executeToolCall(toolCall, currentFiles, currentAdditional, currentWorkSpace, currentTools, saveFileFn, deleteFileFn, config, onAddTask);
            const b = allBlocks.find(x => x.toolCall?.id === toolCall.id);
            if (b) {
                b.result = result;
                // [SYNC-FIX]: Explicitly set the block status based on result to avoid "stuck" yellow blocks
                const isExitError = result?.data?.exitCode && result.data.exitCode !== 0;
                b.status = (result?.success && !isExitError) ? 'success' : 'error';
            }

            // DYNAMIC SYNC: Update UI after each tool execution
            onChunk("", false, allBlocks);

            const isSuccess = result?.success && result?.data?.success !== false;
            const hasError = result?.error || (result?.data?.success === false && result?.data?.error);

            if (!isSuccess) {
                retries++;
                const snippet = extractToolSnippet(toolCall.function.name);
                const snippetBlock = snippet ? `\n\nEJEMPLO DE USO CORRECTO:\n${snippet}` : "";
                const errorContent = `❌ FALLO EN LA HERRAMIENTA: ${hasError || 'Ejecución fallida.'}${snippetBlock}\n\nRECUERDA: Debes corregir esta llamada en tu siguiente turno.`;
                
                lastExecutionFeedback = `❌ FALLO: ${hasError || 'Herramienta falló'}`;
                agentMessages.push({ 
                    role: 'tool', 
                    tool_name: toolCall.function.name,
                    content: errorContent, 
                    tool_call_id: toolCall.id,
                    tool_args: toolCall.function.arguments
                });
                localOnStatus({ rawMessages: [...agentMessages] });
            } else {
                retries = 0;
                const resultData = result.data || {};
                const summary = JSON.stringify(resultData).substring(0, 200);
                lastExecutionFeedback = `✅ ÉXITO: "${toolCall.function.name}" completada. DATOS OBTENIDOS: ${summary}${summary.length >= 200 ? '...' : ''}`;

                const desc = `${toolCall.function.name}(${JSON.stringify(toolCall.function.arguments)})`;
                actionHistory.push(desc);

                // --- TOKEN OPTIMIZATION ---
                // Data-Rich tools need to return full content to the agent.
                // Action tools (write/delete/exec) only need success confirmation to avoid echoing inputs.
                const dataRichTools = [
                    'read_file', 'list_files', 'search_files', 'web_search', 'read_url', 
                    'get_file_outline', 'get_system_metrics', 'get_git_info', 
                    'run_console', 'list_available_skills', 
                    'web_research', 'deep_research', 'crypto_tracker', 'gmail_imap'
                ];
                // Allow dynamic skills to bypass token stripping if they explicitly return substantial extracted_sources or datasets
                const isDataRich = dataRichTools.includes(toolCall.function.name) || 
                                   (result.data && (result.data.extracted_sources || result.data.prices || result.data.emails));

                let chatResult = JSON.stringify(result);
                if (!isDataRich && result.success) {
                    const thinData: any = { status: 'success' };
                    if (result.data?.filename) thinData.filename = result.data.filename;
                    if (result.data?.message) thinData.message = result.data.message;
                    chatResult = JSON.stringify({ success: true, data: thinData });
                }

                agentMessages.push({ 
                    role: 'tool', 
                    tool_name: toolCall.function.name,
                    content: chatResult, 
                    tool_call_id: toolCall.id,
                    tool_args: toolCall.function.arguments
                });
                onStatus({ rawMessages: [...agentMessages] });

                // CRITICAL: Update local mutable stores so subsequent steps in this session see the changes
                if (toolCall.function.name === 'update_file' && result.data?.filename) {
                    const { target, cleanFilename } = resolvePathAndSource(toolCall.function.arguments.filename, toolCall.function.arguments.source);
                    let newContent = toolCall.function.arguments.content;
                    if (target === 'core') currentFiles[cleanFilename] = newContent;
                    else if (target === 'extra') currentAdditional[cleanFilename] = newContent;
                    else if (target === 'workSpace') currentWorkSpace[cleanFilename] = newContent;
                    else if (target === 'tools') currentTools[cleanFilename] = newContent;
                }

                if (toolCall.function.name === 'patch_file' && result.data?.filename) {
                    const { target, cleanFilename } = resolvePathAndSource(toolCall.function.arguments.filename, toolCall.function.arguments.source);
                    const store = getFileStore(target, currentFiles, currentAdditional, currentWorkSpace, currentTools);
                    const existing = store[cleanFilename] || '';
                    
                    let newContent = '';
                    if (toolCall.function.arguments.patches) {
                        // Multi-patch logic (Simplified for UI state sync)
                        newContent = existing;
                        for (const p of toolCall.function.arguments.patches) {
                            newContent = newContent.replace(p.search || p.find, p.replace);
                        }
                    } else {
                        const find = toolCall.function.arguments.find || toolCall.function.arguments.search;
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
                lastExecutionFeedback = `❌ ERROR TÉCNICO: Parámetros inválidos en "${tc.function.name}".`;
                const b = allBlocks.find(x => x.toolCall?.id === tc.id);
                if (b) b.result = { success: false, error: v.error };

                // Fetch JIT Snippet
                const snippet = extractToolSnippet(tc.function.name);
                const snippetBlock = snippet ? `\n\nEJEMPLO DE USO CORRECTO:\n${snippet}` : "";

                // Content for the tool response
                const toolErrorContent = `⚠️ ERROR DE VALIDACIÓN: Intentaste usar la herramienta "${tc.function.name}" pero los parámetros son incorrectos.\n\nDETALLE: ${v.error}${snippetBlock}\n\nPOR FAVOR, CORRIGE TU LLAMADA. No inventes datos.`;
                
                agentMessages.push({ 
                    role: 'tool', 
                    tool_name: tc.function.name,
                    content: toolErrorContent, 
                    tool_call_id: tc.id,
                    tool_args: tc.function.arguments
                });

                onStatus({ rawMessages: [...agentMessages] });
                // Update UI with the failure result in the block
                onChunk("", false, allBlocks);
                return false;
            }
            return true;
        }



        const findTaskStore = () => {
            const coreKey = Object.keys(currentFiles).find(k => k.toLowerCase() === 'tasks.md');
            if (coreKey) return { store: currentFiles, target: 'core' as FileTarget, key: coreKey };
            const wsKey = Object.keys(currentWorkSpace).find(k => k.toLowerCase() === 'tasks.md');
            if (wsKey) return { store: currentWorkSpace, target: 'workSpace' as FileTarget, key: wsKey };
            return null;
        };

        const applyBatchTaskTicking = async (toolCalls: ToolCall[]): Promise<void> => {
            if (toolCalls.length === 0) return;
            
            const taskInfo = findTaskStore();
            if (!taskInfo) return;

            const { store, target, key } = taskInfo;
            const content = store[key];
            if (!content || !content.trim()) return;

            let lines = content.split('\n');
            let modified = false;

                // Mapping tool names to natural language synonyms for better detection
                const toolSynonyms: Record<string, string[]> = {
                    'read_file': ['leer', 'consultar', 'revisar', 'analizar', 'ver'],
                    'update_file': ['escribir', 'crear', 'guardar', 'modificar', 'actualizar', 'generar'],
                    'patch_file': ['parchear', 'aplicar', 'arreglar', 'corregir', 'editar'],
                    'list_files': ['listar', 'explorar', 'ver archivos', 'inspeccionar'],
                    'search_files': ['buscar', 'encontrar', 'localizar'],
                    'web_search': ['investigar', 'noticias', 'google', 'buscar en internet', 'web_research', 'deep_research'],
                    'web_research': ['investigar', 'noticias', 'google', 'buscar en internet', 'web_search', 'deep_research'],
                    'deep_research': ['investigar', 'noticias', 'google', 'buscar en internet', 'web_search', 'web_research'],
                    'run_console': ['ejecutar', 'comando', 'terminal', 'consola', 'git'],
                    'get_system_metrics': ['métricas', 'cpu', 'ram', 'estado del sistema', 'salud'],
                    'list_available_skills': ['habilidades', 'skills', 'capacidades', 'funciones extra'],
                    'miku_clock': ['hora', 'reloj', 'tiempo', 'quién eres'],
                    'get_crypto_price': ['bitcoin', 'crypto', 'precio', 'cripto', 'cotización', 'moneda'],
                    'delete_file': ['borrar', 'eliminar', 'quitar', 'limpiar', 'suprimir'],
                    'final_answer': ['finalizar', 'terminar', 'concluir', 'respuesta', 'completar', 'reportar', 'informar', 'conclusión']
                };

                for (const toolCall of toolCalls) {
                    const toolName = toolCall.function.name;
                    const args = toolCall.function.arguments || {};
                    const mainArg = (args.filename || args.query || args.topic || args.url || args.command || args.path || '').toString();
                    
                    let markedInThisPass = false;
                    lines = lines.map(line => {
                        // Skip already done or empty
                        if (markedInThisPass || !line.trim().startsWith('- [ ]')) return line;

                        const lowerLine = line.toLowerCase();
                        const lowerTool = toolName.toLowerCase();
                        const lowerArg = mainArg.toLowerCase();
                        
                        // Rule 1: Direct name match (e.g., "- [ ] @web_search")
                        const directMatch = lowerLine.includes(lowerTool) || lowerLine.includes(`@${lowerTool}`);
                        
                        // Rule 2: Synonym match
                        const hasSynonym = (toolSynonyms[lowerTool] || []).some(s => lowerLine.includes(s));
                        const toolMatch = directMatch || hasSynonym;
                        
                        // Rule 3: Argument match (if applicable)
                        const argMatch = lowerArg.length > 2 && lowerLine.includes(lowerArg);
                        
                        // Exclude meta-updates to tasks.md
                        if (lowerTool === 'update_file' || lowerTool === 'patch_file') {
                            if (lowerArg.includes('tasks.md')) return line;
                        }

                        // COHERENCE POLICY: Match if tool concept matches target concept
                        if (toolMatch && (argMatch || lowerArg === "")) {
                            modified = true;
                            markedInThisPass = true;
                            const taskName = line.replace('- [ ]', '').trim();
                            if (!turnAutoTasks.includes(taskName)) turnAutoTasks.push(taskName);
                            return line.replace('- [ ]', '- [x]');
                        }
                        return line;
                    });
                }

            if (modified) {
                const newContent = lines.join('\n').trim();
                await saveFileFn(key, newContent, target);
                store[key] = newContent;
            }
        };

        // Tool Execution: Batch (Paralelo) vs Seguro (Secuencial)
        let hasFinalAnswer = false;
        let turnHasFailure = false;

        const processTool = async (tc: ToolCall) => {
            if (abortSignal.aborted) return;
            if (!validateAndReport(tc)) { turnHasFailure = true; return; }
            const approval = needsApproval(tc);
            console.log(`[Agent] Tool "${tc.function.name}": needsApproval=${approval}, isScheduled=${isScheduled}, isAgentMode=${isAgentMode}`);
            if (approval) {
                if (!await requestApproval(tc, tc.function.name)) { turnHasFailure = true; return; }
            }
            await executeAndProcess(tc, tc.function.name);
            
            const lastMsg = agentMessages[agentMessages.length - 1];
            const isFailure = lastMsg && lastMsg.role === 'tool' && (lastMsg.content.includes('❌ FALLO') || lastMsg.content.includes('⚠️ ERROR'));
            
            if (isFailure) {
                turnHasFailure = true;
            } else {
                successfulCalls.push(tc);
            }
        };

        const operativeCalls = activeToolCalls.filter(tc => tc.function.name !== 'final_answer');
        const finalCallToProcess = activeToolCalls.find(tc => tc.function.name === 'final_answer');

        const isAgentModifyingTasks = operativeCalls.some(tc => 
            (tc.function.name === 'update_file' || tc.function.name === 'patch_file') &&
            (tc.function.arguments.filename || '').toLowerCase().includes('tasks.md')
        );

        const isDeletingTasks = operativeCalls.some(tc => 
            tc.function.name === 'delete_file' && 
            (tc.function.arguments.filename || '').toLowerCase().includes('tasks.md')
        );

        // PRE-TICK: If we are about to delete the file, tick it BEFORE execution
        // so the user actually sees the completion mark in the UI before it vanishes.
        if (isDeletingTasks && !isAgentModifyingTasks) {
            // Include final_answer if present for a complete pre-deletion tick
            const allTurnCalls = [...operativeCalls];
            if (finalCallToProcess) allTurnCalls.push(finalCallToProcess);
            await applyBatchTaskTicking(allTurnCalls);
        }

        if (!safeMode) {
            // Batch Mode (Paralelo)
            await Promise.all(operativeCalls.map(processTool));
        } else {
            // Safe Mode (Secuencial)
            for (const tc of operativeCalls) {
                await processTool(tc);
            }
        }

        // Apply task ticks for successful calls (including final_answer)
        if (!isAgentModifyingTasks) {
            const callsToTick = [...successfulCalls];
            if (finalCallToProcess && !turnHasFailure) {
                // If it's a final_answer turn, we count it as successful
                callsToTick.push(finalCallToProcess);
            }
            await applyBatchTaskTicking(callsToTick);
        } else {
            log('info', '[AutoTask] Omitiendo auto-tachado porque el agente modificó TASKS.md manualmente.');
        }

        if (finalCallToProcess && !abortSignal.aborted && !turnHasFailure) {
            hasFinalAnswer = true;
            const args = finalCallToProcess.function.arguments;
            const textRaw = args.text || args.respuesta || args.answer || args.content || 'Tarea completada exitosamente.';
            const reasoning = args.reasoning || '';

            const text = formatFinalResponse(textRaw);
            let sources = args.sources || [];

            if (sources.length === 0) {
                sources = autoExtractSources(actionHistory, agentMessages);
            }

            // RENDERING: We reconstruct the turn blocks for the final answer
            // 1. Add reasoning as a clean THOUGHT block (avoiding blockquotes)
            if (reasoning && reasoning.trim()) {
                allBlocks.push({ type: 'thought', content: reasoning.trim() });
            }

            // 2. Add the authoritative answer block
            let finalContent = text;
            if (sources.length > 0) {
                const limitedSources = sources.slice(0, 10);
                const moreCount = sources.length - 10;
                finalContent += '\n\n---\n\n**🧠 Bibliografía y Contexto:**\n' + limitedSources.map((s: string) => `· ${s}`).join('\n');
                if (moreCount > 0) finalContent += `\n*... y ${moreCount} fuentes más.*`;
            }

            // DE-DUPLICATION: If the final answer is practically the same as the narrative 
            // that was converted to thoughts during streaming, we hide that thought block.
            const normalizedFinal = finalContent.trim().toLowerCase();
            allBlocks.forEach(b => {
                if (b.type === 'thought') {
                    const normB = b.content.trim().toLowerCase();
                    if (normB === normalizedFinal || normalizedFinal.includes(normB) || normB.includes(normalizedFinal)) {
                        b.content = ''; // This will be filtered out by onChunk emitters
                    }
                }
            });

            allBlocks.push({ type: 'answer', content: finalContent });

            // PERSISTENCE Update
            agentMessages.push({ 
                role: 'tool', 
                tool_name: 'final_answer',
                content: JSON.stringify({ success: true, data: { status: 'Answer delivered' } }), 
                tool_call_id: finalCallToProcess.id,
                tool_args: finalCallToProcess.function.arguments
            });

            const lastAssistant = [...agentMessages].reverse().find(m => m.role === 'assistant');
            if (lastAssistant) {
                // For persistence, we store the full content (text + bibliog)
                lastAssistant.content = finalContent;
            }

            onChunk(finalContent, true, allBlocks.filter(b => b.content.trim() !== ''));
        }

        // All feedbacks are now integrated into tool roles to minimize narrative overhead

        if (hasFinalAnswer) {
            if (onFinalRawHistory) {
                onFinalRawHistory([...agentMessages]);
                memorySaved = true;
            }
            localOnStatus({ phase: 'idle', elapsedMs: Date.now() - startTime, rawMessages: [...agentMessages] });
            return;
        }

        onChunk(content, true, allBlocks);
        onStatus({ rawMessages: [...agentMessages] });
        }
    } catch (err) {
        console.error("[Agent Loop Error]", err);
        log('error', `Agent Loop Error: ${err instanceof Error ? err.message : String(err)}`);
        throw err;
    } finally {
        if (!memorySaved && onFinalRawHistory) {
            onFinalRawHistory([...agentMessages]);
        }
    }
}
