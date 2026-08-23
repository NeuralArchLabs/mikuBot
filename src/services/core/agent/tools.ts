/**
 * Agent Tool Execution
 * Path: src/services/core/agent/tools.ts
 * REWIRED: Literal copy from original agent.ts
 */
import { ToolCall, ToolResult, AppConfig, FileTarget } from '../../../types';
import { 
    PROTECTED_CORE_FILES, 
    CONSOLE_ALLOWED_COMMANDS, 
    CONSOLE_BLOCKED_PATTERNS,
    LAX_CONSOLE_ALLOWED_COMMANDS,
    LAX_CONSOLE_BLOCKED_PATTERNS
} from '../../../constants';
import { validateToolArgs, safeFetch, obfuscatePaths } from '../../../utils';
import { TelegramFormatter } from '../../formatters/telegramFormatter';
import { resolvePathAndSource, resolveSource, getFileStore, getRelativePath } from './utils';

export async function executeToolCall(
    toolCall: ToolCall,
    files: Record<string, string>,
    additionalFiles: Record<string, string>,
    workSpaceFiles: Record<string, string>,
    toolsFiles: Record<string, string>,
    rootFiles: Record<string, string>,
    saveFileFn: (name: string, content: string, target: FileTarget) => Promise<boolean>,
    deleteFileFn: (name: string, target: FileTarget) => Promise<boolean>,
    config: AppConfig,
    onAddTask?: (task: any) => Promise<string>,
    isAgentMode: boolean = false,
    isInstructionMode: boolean = false,
    sessionId?: string
): Promise<ToolResult> {
    const { name, arguments: args } = toolCall.function;

    try {
        switch (name) {
            case 'read_file': {
                const { target, cleanFilename } = resolvePathAndSource(args.filename, args.source, config);
                const staticPath = config.folderPaths?.[target];
                const relPath = getRelativePath(target, cleanFilename);
                const isElectron = !!(window as any).electron;
                const finalPath = (isElectron && staticPath) 
                    ? (cleanFilename ? `${staticPath}/${cleanFilename}` : staticPath) 
                    : relPath;

                let nativeError = '';
                if (isElectron && (window as any).electron?.agentReadFile) {
                    const result = await (window as any).electron.agentReadFile({ path: finalPath });
                    if (result.ok) {
                        return { success: true, data: { filename: cleanFilename, content: result.content, source: target } };
                    }
                    return { success: false, error: `Error reading file natively: ${result.error}` };
                }

                const store = getFileStore(target, files, additionalFiles, workSpaceFiles, toolsFiles, rootFiles);
                const content = store[cleanFilename];
                if (content !== undefined) {
                    return { success: true, data: { filename: cleanFilename, content, source: target } };
                }
                return { success: false, error: `File "${cleanFilename}" not found in ${target} folder.` };
            }

            case 'update_file': {
                if (!args.filename) return { success: false, error: 'Missing required parameter: filename.' };
                const { target, cleanFilename } = resolvePathAndSource(args.filename, args.source, config);

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
                    const store = getFileStore(target, files, additionalFiles, workSpaceFiles, toolsFiles, rootFiles);
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
                const { target, cleanFilename } = resolvePathAndSource(args.filename, args.source, config);
                const staticPath = config.folderPaths?.[target];
                const relPath = getRelativePath(target, cleanFilename);
                const isElectron = !!(window as any).electron;

                // If in Electron and we have a static path, use absolute path to avoid workspace desync
                const finalPath = (isElectron && staticPath) 
                    ? (cleanFilename ? `${staticPath}/${cleanFilename}` : staticPath) 
                    : relPath;

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
                const patchStore = getFileStore(target, files, additionalFiles, workSpaceFiles, toolsFiles, rootFiles);
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
                const { target, cleanFilename } = resolvePathAndSource(args.filename, args.source, config);
                const staticPath = config.folderPaths?.[target];
                const relPath = getRelativePath(target, cleanFilename);
                const isElectron = !!(window as any).electron;
                const finalPath = (isElectron && staticPath) 
                    ? (cleanFilename ? `${staticPath}/${cleanFilename}` : staticPath) 
                    : relPath;

                if (isElectron && (window as any).electron?.undoPatch) {
                    const result = await (window as any).electron.undoPatch({ path: finalPath });
                    if (result.ok) return { success: true, data: { message: result.result } };
                    return { success: false, error: result.error };
                }
                return { success: false, error: 'Undo not available in this mode.' };
            }

            case 'get_file_outline': {
                const { target, cleanFilename } = resolvePathAndSource(args.filename, args.source, config);
                const staticPath = config.folderPaths?.[target];
                const relPath = getRelativePath(target, cleanFilename);
                const isElectron = !!(window as any).electron;
                const finalPath = (isElectron && staticPath) 
                    ? (cleanFilename ? `${staticPath}/${cleanFilename}` : staticPath) 
                    : relPath;

                if (isElectron && (window as any).electron?.getFileOutline) {
                    const result = await (window as any).electron.getFileOutline({ path: finalPath });
                    if (result.ok) return { success: true, data: { outline: result.outline } };
                    return { success: false, error: result.error };
                }
                return { success: false, error: 'Outline not available.' };
            }

            case 'batch_operation': {
                if ((window as any).electron?.batchOperation) {
                    const { target: srcTarget, cleanFilename: srcFn } = resolvePathAndSource(args.source_path || args.filename || '', args.source, config);
                    const { target: destTarget, cleanFilename: destFn } = resolvePathAndSource(args.destination_path || args.destination || '', args.source, config);
                    const srcStaticPath = config.folderPaths?.[srcTarget];
                    const destStaticPath = config.folderPaths?.[destTarget];
                    const isElectron = !!(window as any).electron;

                    // Build absolute paths for backend (consistent with patch_file, read_file pattern)
                    // This prevents path duplication like "workspace/workspace/test_patch.txt"
                    const absoluteSource = (isElectron && srcStaticPath) 
                        ? (srcFn ? `${srcStaticPath}/${srcFn}` : srcStaticPath) 
                        : getRelativePath(srcTarget, srcFn);
                    
                    let absoluteDestination = undefined;
                    if (args.destination_path || args.destination) {
                        absoluteDestination = (isElectron && destStaticPath) 
                            ? (destFn ? `${destStaticPath}/${destFn}` : destStaticPath) 
                            : getRelativePath(destTarget, destFn);
                    }

                    const result = await (window as any).electron.batchOperation({
                        operation: args.operation,
                        source: absoluteSource,
                        destination: absoluteDestination,
                        pattern: args.pattern
                    });
                    if (result.ok) return { success: true, data: { message: result.result } };
                    return { success: false, error: result.error };
                }
                return { success: false, error: 'Batch not available.' };
            }

            case 'list_files': {
                let target = resolveSource(args.source);
                let subDir = args.directory || args.path || "";

                // Smart naked prefix remap (if source not specified)
                if (!args.source && subDir) {
                    const normalizedSub = subDir.replace(/\\/g, '/').toLowerCase();
                    if (normalizedSub === 'library' || normalizedSub.startsWith('library/')) {
                        target = 'extra';
                        subDir = subDir.substring(7).replace(/^[/\\]+/, '');
                    } else if (normalizedSub === 'core' || normalizedSub.startsWith('core/')) {
                        target = 'core';
                        subDir = subDir.substring(4).replace(/^[/\\]+/, '');
                    } else if (normalizedSub === 'commands' || normalizedSub.startsWith('commands/')) {
                        target = 'tools';
                        subDir = subDir.substring(8).replace(/^[/\\]+/, '');
                    } else if (normalizedSub === 'workspace' || normalizedSub.startsWith('workspace/')) {
                        target = 'workSpace';
                        subDir = subDir.substring(9).replace(/^[/\\]+/, '');
                    }
                }

                // Native Branch (Electron)
                const isElectron = !!(window as any).electron;
                const staticPath = config.folderPaths?.[target];

                if (isElectron && staticPath && (window as any).electron?.listFilesNative) {
                    const result = await (window as any).electron.listFilesNative({ rootPath: staticPath, directory: subDir, recursive: !!args.recursive });
                    if (result.ok) {
                        return { success: true, data: { files: result.results, count: result.results.length, source: target, filtered_by: subDir || 'all' } };
                    }
                }

                // Memory Fallback
                const store = getFileStore(target, files, additionalFiles, workSpaceFiles, toolsFiles, rootFiles);
                let fileList = Object.keys(store).map(f => ({
                    name: f,
                    size: (store[f] || '').length
                }));

                if (subDir) {
                    // Fix: strip '.' or './' prefixes which prevent matching workspace files stored as simple relative paths
                    const normalizedSub = subDir.replace(/\\/g, '/').replace(/^\.[/\\]*/, '').replace(/^\/+|\/+$/g, '');

                    if (normalizedSub) {
                        fileList = fileList.filter(f =>
                            f.name.startsWith(normalizedSub + '/') ||
                            f.name === normalizedSub
                        );
                    }
                }

                return { success: true, data: { files: fileList, count: fileList.length, source: target, filtered_by: subDir || 'all' } };
            }

            case 'search_files':
            case 'search_pattern': {
                const isPatternSearch = name === 'search_pattern';
                const searchValue = isPatternSearch ? args.pattern : args.query;
                let searchPath = isPatternSearch ? (args.path || '') : (args.searchPath || args.path || '');
                const filePattern = isPatternSearch ? (args.glob || '') : (args.filePattern || args.glob || '');
                const caseSensitive = isPatternSearch ? args.case_sensitive : args.caseSensitive;
                let target = resolveSource(args.source);

                if (!args.source && searchPath) {
                    const normalizedSub = searchPath.replace(/\\/g, '/').toLowerCase();
                    if (normalizedSub === 'library' || normalizedSub.startsWith('library/')) {
                        target = 'extra';
                        searchPath = searchPath.substring(7).replace(/^[/\\]+/, '');
                    } else if (normalizedSub === 'core' || normalizedSub.startsWith('core/')) {
                        target = 'core';
                        searchPath = searchPath.substring(4).replace(/^[/\\]+/, '');
                    } else if (normalizedSub === 'commands' || normalizedSub.startsWith('commands/')) {
                        target = 'tools';
                        searchPath = searchPath.substring(8).replace(/^[/\\]+/, '');
                    } else if (normalizedSub === 'workspace' || normalizedSub.startsWith('workspace/')) {
                        target = 'workSpace';
                        searchPath = searchPath.substring(9).replace(/^[/\\]+/, '');
                    }
                }

                const isElectron = !!(window as any).electron;
                const staticPath = config.folderPaths?.[target];

                if (isElectron && staticPath && (window as any).electron?.searchFilesNative) {
                    const result = await (window as any).electron.searchFilesNative({
                        rootPath: staticPath,
                        searchText: searchValue,
                        pattern: searchValue,
                        caseSensitive: caseSensitive ?? false,
                        case_sensitive: caseSensitive ?? false,
                        filePattern,
                        glob: filePattern,
                        searchPath,
                        path: searchPath,
                        searchMode: isPatternSearch ? 'content' : 'filename',
                        output_mode: args.output_mode,
                        context: args.context,
                        head_limit: args.head_limit,
                        offset: args.offset
                    });
                    if (result.ok) {
                        const engineResult = result.results;
                        const nativeData = engineResult?.data || (Array.isArray(engineResult) ? { results: engineResult } : { results: engineResult?.results || [] });
                        const matches = nativeData.results || [];
                        return {
                            success: true,
                            data: {
                                query: searchValue,
                                pattern: searchValue,
                                matches,
                                results: matches,
                                count: matches.length,
                                totalFiles: nativeData.totalFiles ?? matches.length,
                                totalMatches: nativeData.totalMatches ?? matches.length,
                                pagination: nativeData.pagination,
                                mode: nativeData.mode,
                                message: nativeData.message,
                                source: target
                            }
                        };
                    }
                }
                // Fallback
                const store = getFileStore(target, files, additionalFiles, workSpaceFiles, toolsFiles, rootFiles);
                const query = String(searchValue || '');
                if (!query) return { success: false, error: isPatternSearch ? 'Missing search pattern.' : 'Missing file name query.' };

                if (!isPatternSearch) {
                    const normalizedQuery = caseSensitive ? query : query.toLowerCase();
                    const filePatternMatches = (filename: string) => {
                        if (!filePattern) return true;
                        const patterns = String(filePattern).split(',').map((value: string) => value.trim()).filter(Boolean);
                        const positives = patterns.filter((pattern: string) => !pattern.startsWith('!'));
                        const negatives = patterns.filter((pattern: string) => pattern.startsWith('!')).map((pattern: string) => pattern.slice(1));
                        const toRegex = (pattern: string) => new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i');
                        return !negatives.some((pattern: string) => toRegex(pattern).test(filename)) && (positives.length === 0 || positives.some((pattern: string) => toRegex(pattern).test(filename)));
                    };
                    const filenameMatches = Object.keys(store)
                        .filter(filename => !searchPath || filename === searchPath || filename.startsWith(searchPath.replace(/\\/g, '/') + '/'))
                        .filter(filename => filePatternMatches(filename))
                        .filter(filename => (caseSensitive ? filename : filename.toLowerCase()).includes(normalizedQuery))
                        .map(filename => ({ file: filename, name: filename.split('/').pop() || filename, path: filename, size: (store[filename] || '').length }));
                    const offset = Math.max(0, Number(args.offset) || 0);
                    const limit = args.head_limit === undefined ? 250 : Math.max(0, Number(args.head_limit) || 0);
                    const page = filenameMatches.slice(offset, limit === 0 ? undefined : offset + limit);
                    return {
                        success: true,
                        data: {
                            query,
                            matches: page,
                            results: page,
                            totalFiles: filenameMatches.length,
                            totalMatches: filenameMatches.length,
                            pagination: { limit, offset, totalAvailable: filenameMatches.length, hasMore: limit !== 0 && filenameMatches.length > offset + limit },
                            message: filenameMatches.length === 0 && /\s|[{}()[\];=<>]/.test(query)
                                ? 'No file names matched. If you intended to search inside file contents, use search_pattern.'
                                : 'File name search completed successfully.',
                            source: target
                        }
                    };
                }

                const flags = caseSensitive ? 'g' : 'gi';
                let expression;
                try {
                    expression = new RegExp(query, flags);
                } catch {
                    expression = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
                }
                const matches: { file: string; matches: any[] }[] = [];
                for (const [filename, content] of Object.entries(store)) {
                    if (searchPath && !(filename === searchPath || filename.startsWith(searchPath.replace(/\\/g, '/') + '/'))) continue;
                    const lines = content.split(/\r?\n/);
                    const lineMatches: any[] = [];
                    for (let i = 0; i < lines.length; i++) {
                        expression.lastIndex = 0;
                        const match = expression.exec(lines[i]);
                        if (!match) continue;
                        lineMatches.push({
                            line: i + 1,
                            content: lines[i],
                            submatches: [{ match: match[0], start: match.index, end: match.index + match[0].length }],
                            isContext: false
                        });
                    }
                    if (lineMatches.length > 0) matches.push({ file: filename, matches: lineMatches });
                }
                const offset = Math.max(0, Number(args.offset) || 0);
                const limit = args.head_limit === undefined ? 250 : Math.max(0, Number(args.head_limit) || 0);
                const page = matches.slice(offset, limit === 0 ? undefined : offset + limit);
                const outputMode = args.output_mode || 'content';
                const results = outputMode === 'count'
                    ? page.map(file => ({ file: file.file, count: file.matches.length }))
                    : outputMode === 'files_with_matches'
                        ? page.map(file => ({ file: file.file, matchCount: file.matches.length }))
                        : page;
                return {
                    success: true,
                    data: {
                        query,
                        pattern: query,
                        matches: results,
                        results,
                        totalFiles: matches.length,
                        totalMatches: matches.reduce((total, file) => total + file.matches.length, 0),
                        pagination: { limit, offset, totalAvailable: matches.length, hasMore: limit !== 0 && matches.length > offset + limit },
                        source: target
                    }
                };
            }

            case 'get_system_metrics': {
                if ((window as any).electron?.getSystemMetrics) {
                    const result = await (window as any).electron.getSystemMetrics();
                    if (result.ok) return { success: true, data: result.metrics };
                    return { success: false, error: result.error };
                }
                return { success: false, error: 'Metrics not available.' };
            }



            case 'web_search': {
                if (!args.query) {
                    return { success: false, error: 'The "query" parameter is required for web_search. Please provide a search query.' };
                }
                // Prioritize Native Internal Search (SearXena Python bridge) if in Electron
                if (typeof window !== 'undefined' && (window as any).electron?.runSearch) {
                    const maxRetries = 2;
                    let lastError = '';
                    for (let attempt = 0; attempt < maxRetries; attempt++) {
                        try {
                            const response = await (window as any).electron.runSearch({
                                query: args.query,
                                category: args.category || 'general'
                            });
                            if (response.ok) {
                                return { success: true, data: response.data };
                            }
                            lastError = response.error || 'Unknown error';
                            console.warn(`[Search] SearXena attempt ${attempt + 1} failed:`, response.error);
                            // Known fatal errors — don't retry, report immediately
                            if (response.error?.includes('Engine not installed')) {
                                return { success: false, error: `SearXena: El motor no está instalado. Ejecuta la instalación desde Ajustes → SearXena.` };
                            }
                        } catch (e) {
                            lastError = e instanceof Error ? e.message : String(e);
                            console.error(`[Search] SearXena attempt ${attempt + 1} error:`, e);
                        }
                    }
                    // SearXena exhausted retries — return its error, don't silently fall through
                    return {
                        success: false,
                        error: `SearXena: ${lastError}. El motor no responde después de ${maxRetries} intentos. Verifica que esté arrancado y no esté saturado.`
                    };
                }

                return { success: false, error: `No Search API available. Ensure SearXena is installed and running.` };
            }

            case 'web_search_more': {
                if (!args.search_id) {
                    return { success: false, error: 'The "search_id" parameter is required for web_search_more. Use the search_id returned by web_search.' };
                }
                if (typeof window !== 'undefined' && (window as any).electron?.runWebSearchMore) {
                    try {
                        const response = await (window as any).electron.runWebSearchMore({
                            searchId: args.search_id,
                            offset: args.offset,
                            limit: args.limit
                        });
                        if (response.ok) return { success: true, data: response.data };
                        return { success: false, error: response.error || 'Unable to retrieve more search results.' };
                    } catch (e) {
                        return { success: false, error: e instanceof Error ? e.message : String(e) };
                    }
                }
                return { success: false, error: 'No Search API available for web_search_more. Ensure SearXena is installed and running.' };
            }


            case 'read_url': {
                if (!args.url) {
                    return { success: false, error: 'The "url" parameter is required for read_url.' };
                }
                // Prioritize Native Internal Extraction (SearXena O-ZEN Engine extract API)
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

                return { success: false, error: 'Internal Python engine is ready, but native extraction failed. No external fallback available.' };
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
                    const token = config.telegramBotToken;
                    const formatter = new TelegramFormatter();
                    const chunks = formatter.formatAsChunks(args.text);

                    if (chunks.length === 0) return { success: false, error: 'Empty message content.' };

                    let lastMessageId = 0;
                    for (const [i, chunk] of chunks.entries()) {
                        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chat_id: chatId,
                                text: chunk,
                                parse_mode: 'HTML'
                            })
                        });

                        const data = await response.json();
                        if (!data.ok) {
                            return { success: false, error: `Telegram API Error [Part ${i + 1}]: ${data.description || 'Unknown error'}` };
                        }
                        lastMessageId = data.result.message_id;

                        // Small delay between chunks if multiple
                        if (chunks.length > 1 && i < chunks.length - 1) {
                            await new Promise(r => setTimeout(r, 300));
                        }
                    }

                    return {
                        success: true,
                        data: {
                            message: chunks.length > 1 ? `Message sent in ${chunks.length} parts.` : 'Message sent successfully.',
                            message_id: lastMessageId
                        }
                    };
                } catch (e) {
                    return { success: false, error: `Failed to connect to Telegram API: ${e instanceof Error ? e.message : String(e)}` };
                }
            }

            case 'run_console': {
                const rawCmd = (args.command || '').trim();
                const cmdTokens = rawCmd.split(/\s+/);
                const cmd = cmdTokens[0] || '';
                const extraArgs = rawCmd.substring(cmd.length).trim();
                const cmdArgs = (extraArgs + ' ' + (args.args || '').trim()).trim();
                
                // Security Layer: In Chat Mode, we allow any command as long as it has been manually approved 
                // by the user in the UI (enforced by Agent.ts isAuto logic).
                // We only perform basic path obfuscation and platform fixes here.

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
                        finalArgs = finalArgs.replace(/\//g, '\\');
                        finalArgs = finalArgs.replace(/\B-p\b/g, '').replace(/\B--parents\b/g, '').replace(/\s+/g, ' ').trim();
                    }

                    const result = await (window as any).electron.runConsole({
                        command: cmd,
                        args: finalArgs,
                        cwd: args.cwd || '',
                        WaitMsBeforeAsync: args.WaitMsBeforeAsync || 0,
                        commandId: args.commandId,
                        timeout_ms: args.timeout_ms
                    });


                    const root = config.folderPaths?.root;

                    if (result.status === 'running') {
                        return {
                            success: true,
                            data: {
                                status: 'running',
                                message: `Command started in background. Use get_console_status with ID: ${result.commandId} to check progress.`,
                                commandId: result.commandId,
                                stdout: obfuscatePaths(result.stdout, root),
                                stderr: obfuscatePaths(result.stderr, root)
                            }
                        };
                    }

                    // Logic change: The tool ALWAYS succeeds if it executed without throwing an Electron IPC error.
                    // Even if the command returns code 1 or 127, the terminal tool successfully executed the process.
                    // The LLM will read the `exitCode`, `stdout`, and `stderr` to determine what happened.
                    
                    return {
                        success: true,
                        data: {
                            stdout: obfuscatePaths((result.stdout || '').slice(-15000)),
                            stderr: obfuscatePaths((result.stderr || '').slice(-5000)),
                            exitCode: result.code,
                            command: `${cmd} ${cmdArgs}`.trim(),
                            commandId: result.commandId
                        }
                    };
                } catch (e) {
                    return { success: false, error: `Console Error: ${e instanceof Error ? e.message : String(e)}` };
                }
            }

            case 'get_console_status': {
                if (!(window as any).electron?.runConsoleStatus) {
                    return { success: false, error: 'Console status not available.' };
                }
                const result = await (window as any).electron.runConsoleStatus({ commandId: args.commandId });
                if (!result.success) return { success: false, error: result.error };

                const root = config.folderPaths?.root;

                return {
                    success: true,
                    data: {
                        id: result.id,
                        status: result.status,
                        stdout: obfuscatePaths(result.stdout.slice(-5000), root),
                        stderr: obfuscatePaths(result.stderr.slice(-2000), root),
                        exitCode: result.exitCode,
                        command: result.command
                    }
                };
            }

            case 'delete_file': {
                if (!args.filename) {
                    return { success: false, error: 'Missing required parameter: filename.' };
                }
                const { target, cleanFilename } = resolvePathAndSource(args.filename, args.source, config);
                const deleted = await deleteFileFn(cleanFilename, target);
                if (deleted) {
                    const store = getFileStore(target, files, additionalFiles, workSpaceFiles, toolsFiles, rootFiles);
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

            case 'request_agent_mode': {
                return { 
                    success: true, 
                    data: { 
                        message: `✅ AGENT MODE ACTIVATED. The user approved the transition. You are now operating in full Agent Mode with broad autonomy. Reason: ${args.reason}. Proceed with your plan immediately — no further authorization is needed for standard operations.`
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
                                let finalArgs = { ...args };
                                if (name === 'deep_research') {
                                    // A model-generated tool call can never approve its own
                                    // Deep Research plan. This route is only allowed to
                                    // produce (or revise) the proposal; the lateral panel is
                                    // the sole UI allowed to start the long-running research
                                    // after the user explicitly approves it.
                                    //
                                    // The panel invokes Electron directly, so this guard does
                                    // not interfere with its approved/resume executions.
                                    const baseSessionId = String(sessionId || 'session')
                                        .replace(/[^A-Za-z0-9_-]/g, '')
                                        .slice(0, 72) || 'session';
                                    const callId = String(toolCall.id || `call_${Date.now()}`)
                                        .replace(/[^A-Za-z0-9_-]/g, '')
                                        .slice(0, 40);
                                    // Do not infer this from config.provider/model: those
                                    // fields may represent the master conversational fallback.
                                    const runtimeProvider = config.activeModeProvider;
                                    const runtimeModel = config.activeModeModel;
                                    finalArgs = {
                                        ...finalArgs,
                                        approved: false,
                                        resume: false,
                                        plan: undefined,
                                        // A research run must never share the chat session's
                                        // progress file. Reusing it was how an old completed
                                        // report appeared while a new plan was being reviewed.
                                        _session_id: `${baseSessionId}_${callId}`.slice(0, 120),
                                        _runtime: { provider: runtimeProvider, model: runtimeModel },
                                        _config: {
                                            ...config,
                                            provider: runtimeProvider,
                                            model: runtimeModel,
                                            apiKeys: {}
                                        }
                                    };
                                }
                                const execution = await (window as any).electron.executeSkill({
                                    toolsPath: config.folderPaths.tools,
                                    skillName: name,
                                    args: finalArgs,
                                    lang: config.language
                                });
                                if (execution.ok) {
                                    if (execution.data && typeof execution.data === 'object' && execution.data.success === false) {
                                        return {
                                            success: false,
                                            error: execution.data.error || `Error executing skill ${name}`,
                                            data: execution.data
                                        };
                                    }
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
                    error: `🚫 Unknown tool: "${name}".${availableSkillsMsg} Ensure its manifest.json is correct and use the exact name defined there.`
                };
            }
        }
    } catch (err) {
        return { success: false, error: `Tool execution error: ${err instanceof Error ? err.message : String(err)}` };
    }
}
