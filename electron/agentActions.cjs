/**
 * agentActions.cjs - Advanced Agent Tools for MikuCentral
 * Upgraded with SmartPatch 2.0 and Native Search Engines
 */

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const SafePathResolver = require('./SafePathResolver.cjs');

const execPromise = util.promisify(exec);
const execFilePromise = util.promisify(require('child_process').execFile);

let bundledRgPath = null;
try {
    ({ rgPath: bundledRgPath } = require('@vscode/ripgrep'));
} catch (e) {
    // Optional during development; the OS fallback remains available.
}

// Keep a small, explicit reserve when zero-overhead mode is disabled.  Merely
// deleting OLLAMA_GPU_OVERHEAD is not a reliable "undo": Ollama's own default
// is zero and an already-running Electron process can still inherit an old 0.
const OLLAMA_SAFE_GPU_OVERHEAD_BYTES = 512 * 1024 * 1024;

// --- HELPERS ---

function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
}

/**
 * Detects the predominant line ending in content.
 */
function detectEOL(content) {
    const crlfCount = (content.match(/\r\n/g) || []).length;
    const lfCount = (content.split('\n').length - 1) - crlfCount;
    return crlfCount > lfCount ? '\r\n' : '\n';
}

/**
 * Robust comparison that ignores minor punctuation and whitespace differences.
 * Useful for Markdown tasks or quoted code.
 */
function flexibleIncludes(target, search) {
    if (target.includes(search)) return true;
    
    const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const tClean = normalize(target);
    const sClean = normalize(search);
    
    if (sClean.length > 5 && tClean.includes(sClean)) return true;
    
    // Also try line-by-line flex
    const tLines = target.split(/\r?\n/).map(l => normalize(l)).filter(l => l.length > 0);
    const sLines = search.split(/\r?\n/).map(l => normalize(l)).filter(l => l.length > 0);
    
    if (sLines.length > 0 && tLines.length >= sLines.length) {
        // Simple sequence check
        let matchCount = 0;
        let tIdx = 0;
        for (const sL of sLines) {
            let found = false;
            while (tIdx < tLines.length) {
                if (tLines[tIdx].includes(sL)) {
                    matchCount++;
                    found = true;
                    tIdx++;
                    break;
                }
                tIdx++;
            }
            if (!found) break;
        }
        return matchCount === sLines.length;
    }

    return false;
}

// --- FILE SYSTEM ACTIONS ---

/**
 * Extracts classes, functions, and interfaces from a file.
 * Regex improved for broader language support and assignment patterns.
 */
async function handleGetFileOutline(fullPath) {
    try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const outline = [];
        const lines = content.split(/\r?\n/);
        
        // Comprehensive regex for functions, classes, interfaces and high-level assignments
        const regex = /^\s*(?:export\s+)?(?:async\s+)?(?:class|function|interface|type)\s+[a-zA-Z0-9_$]+|^\s*(?:export\s+)?(?:const|let|var)\s+[a-zA-Z0-9_$]+\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>|\{)|^\s*(?!(?:if|for|while|switch|catch)\b)[a-zA-Z0-9_$]+\s*(?::\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>)|\([^)]*\)\s*\{)/;

        for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
                outline.push(`L${i + 1}: ${lines[i].trim()}`);
            }
        }
        return outline.length ? outline.join('\n') : 'No functions or classes found.';
    } catch (e) {
        throw new Error(`Outline failed: ${e.message}`);
    }
}

/**
 * Batch operations: copy, move, delete with glob patterns.
 */
async function handleBatchOperation(root, { operation, source, destination, pattern }) {
    if (!source) throw new Error('Source path required');

    // Support prefix resolution inside the action
    const sourcePath = SafePathResolver.resolvePath(source);
    let count = 0;

    if (pattern) {
        const stats = await fs.stat(sourcePath);
        const baseDir = stats.isDirectory() ? sourcePath : path.dirname(sourcePath);
        const files = await fs.readdir(baseDir);

        const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');

        for (const file of files) {
            if (regex.test(file)) {
                const filePath = path.join(baseDir, file);
                // Apply Zero Leak validation to destination if provided
                const resolvedDest = destination ? SafePathResolver.resolvePath(destination) : '';
                const finalDest = resolvedDest ? path.join(resolvedDest, file) : '';
                await applyBatchOp(operation, filePath, finalDest);
                count++;
            }
        }
    } else {
        // Apply Zero Leak validation to destination if provided
        const resolvedDest = destination ? SafePathResolver.resolvePath(destination) : '';
        await applyBatchOp(operation, sourcePath, resolvedDest);
        count = 1;
    }
    return `${operation} completed: ${count} item(s) processed`;
}

async function applyBatchOp(op, src, dest) {
    switch (op) {
        case 'copy':
            await fs.mkdir(path.dirname(dest), { recursive: true });
            const s = await fs.stat(src);
            if (s.isDirectory()) await fs.cp(src, dest, { recursive: true });
            else await fs.copyFile(src, dest);
            break;
        case 'move':
            await fs.mkdir(path.dirname(dest), { recursive: true });
            await fs.rename(src, dest);
            break;
        case 'delete':
            await fs.rm(src, { recursive: true, force: true });
            break;
    }
}

/**
 * Lists files and directories in a path.
 */
async function handleListFiles(root, { directory, recursive = false }) {
    // RESOLVE STRICTOR: No logic fallbacks allowed. Use Resolver or fail.
    const targetDir = directory ? SafePathResolver.resolvePath(directory) : root;
    console.log(`[agentActions] handleListFiles listing: "${targetDir}" (requested: "${directory}", root: "${root}")`);
    
    const stats = await fs.stat(targetDir);
    if (!stats.isDirectory()) {
        throw new Error('Path is not a directory.');
    }

    const results = [];
    const files = await fs.readdir(targetDir);
    console.log(`[agentActions] Found ${files.length} files in "${targetDir}"`);

    // Get normalized normalizedRoot for relative mapping
    // We use the root passed from main (which is the autorized prefix)
    const normalizedRoot = path.normalize(targetDir);

    for (const file of files) {
        const fullPath = path.join(targetDir, file);
        try {
            const stats = await fs.stat(fullPath);
            const isDir = stats.isDirectory();
            
            // Skip common ignore patterns
            if (['node_modules', '.git', 'dist', 'build', '.next', '.gemini'].includes(file)) continue;

            results.push({
                name: file, // Return only the basename for security and clarity
                size: isDir ? 0 : stats.size,
                isDirectory: isDir,
                path: path.relative(root, fullPath).replace(/\\/g, '/') // Relative to the effective root
            });

            if (recursive && isDir) {
                // Limit depth and ensure recursive calls also respect the sandbox
                if (results.length < 500) { // Safety cap
                   const subFiles = await handleListFiles(root, { directory: fullPath, recursive: false });
                   results.push(...subFiles);
                }
            }
        } catch (e) {}
    }

    return results;
}

// --- NATIVE SEARCH ENGINE ---

const SEARCH_EXCLUDE_DIRS = [
    '.git', '.svn', '.hg', 'node_modules', 'dist', 'build', 'out',
    '.next', '.nuxt', '.miku', 'coverage', '.nyc_output',
    '__pycache__', '.pytest_cache', '.vscode', '.idea', 'public/assets'
];

const SEARCH_EXCLUDE_EXTENSIONS = [
    '*.map', '*.min.js', '*.min.css', '*.bundle.js', '*.chunk.js',
    '*.woff', '*.woff2', '*.ttf', '*.eot', '*.ico', '*.png', '*.jpg',
    '*.jpeg', '*.gif', '*.svg', '*.webp', '*.mp4', '*.mp3', '*.wav',
    '*.zip', '*.tar', '*.gz', '*.pdf', '*.doc', '*.docx', '*.lock', '*.lockb'
];

const SEARCH_DEFAULT_LIMIT = 250;
const SEARCH_BROAD_LIMIT = 50;
const SEARCH_MAX_MATCHES_PER_FILE = 1000;

function isPathWithin(parent, child) {
    const parentPath = path.resolve(parent).toLowerCase();
    const childPath = path.resolve(child).toLowerCase();
    return childPath === parentPath || childPath.startsWith(`${parentPath}${path.sep}`);
}

function resolveSearchRoot(root, searchPath) {
    if (!searchPath) return root;

    const requested = String(searchPath);
    let targetRoot;
    if (requested.startsWith('@') || path.isAbsolute(requested)) {
        targetRoot = SafePathResolver.resolvePath(requested);
    } else {
        targetRoot = path.resolve(root, requested);
    }

    if (!isPathWithin(root, targetRoot)) {
        throw new Error(`Search path must remain inside the selected root: ${requested}`);
    }
    return targetRoot;
}

function getBundledRipGrepPath() {
    if (!bundledRgPath) return null;
    const unpackedPath = bundledRgPath.includes('app.asar')
        ? bundledRgPath.replace('app.asar', 'app.asar.unpacked')
        : bundledRgPath;
    if (fsSync.existsSync(unpackedPath)) return unpackedPath;
    if (fsSync.existsSync(bundledRgPath)) return bundledRgPath;
    return null;
}

function buildSearchArgs(searchText, root, options) {
    const {
        caseSensitive = false,
        filePattern,
        context,
        maxMatchesPerFile = SEARCH_MAX_MATCHES_PER_FILE
    } = options;
    const args = ['--json', '--hidden', '--no-messages', '--max-columns', '500'];

    for (const directory of SEARCH_EXCLUDE_DIRS) {
        args.push('--glob', `!**/${directory}/*`);
    }
    for (const extension of SEARCH_EXCLUDE_EXTENSIONS) {
        args.push('--glob', `!${extension}`);
    }

    if (!caseSensitive) args.push('--ignore-case');
    if (context !== undefined && Number.isFinite(Number(context))) {
        args.push('--context', String(Math.max(0, Math.min(20, Number(context)))));
    }
    if (maxMatchesPerFile > 0) args.push('--max-count', String(maxMatchesPerFile));

    if (filePattern) {
        for (const pattern of String(filePattern).split(',')) {
            const cleanPattern = pattern.trim();
            if (cleanPattern) args.push('--glob', cleanPattern);
        }
    }

    args.push('--', searchText, root);
    return args;
}

function relativeSearchPath(root, filePath) {
    const relative = path.relative(root, filePath).replace(/\\/g, '/');
    return relative || path.basename(filePath);
}

function parseRipGrepResults(stdout, root, mode, limit, offset, isBroadSearch) {
    const fileResults = new Map();
    let totalMatches = 0;

    for (const line of String(stdout || '').split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
            const parsed = JSON.parse(line);
            if (parsed.type !== 'match' && parsed.type !== 'context') continue;

            const filePath = relativeSearchPath(root, parsed.data.path.text);
            if (!fileResults.has(filePath)) {
                fileResults.set(filePath, { file: filePath, matches: [] });
            }

            const isMatch = parsed.type === 'match';
            const matchEntry = {
                line: parsed.data.line_number,
                content: String(parsed.data.lines?.text || '').replace(/\r?\n$/, ''),
                isContext: !isMatch
            };

            if (isMatch) {
                totalMatches++;
                if (Array.isArray(parsed.data.submatches)) {
                    matchEntry.submatches = parsed.data.submatches.map(submatch => ({
                        match: submatch.match?.text || '',
                        start: submatch.start,
                        end: submatch.end
                    }));
                }
            }

            const fileResult = fileResults.get(filePath);
            if (fileResult.matches.length < SEARCH_MAX_MATCHES_PER_FILE || isMatch) {
                fileResult.matches.push(matchEntry);
            }
        } catch (e) {
            // RipGrep may emit diagnostic/non-JSON lines in unusual environments.
        }
    }

    const allFiles = Array.from(fileResults.values());
    const effectiveLimit = Math.max(0, Number(limit) || 0);
    const effectiveOffset = Math.max(0, Number(offset) || 0);
    const paginatedFiles = allFiles.slice(
        effectiveOffset,
        effectiveLimit === 0 ? undefined : effectiveOffset + effectiveLimit
    );
    const hasMore = effectiveLimit !== 0 && allFiles.length > effectiveOffset + effectiveLimit;

    let results;
    if (mode === 'files_with_matches') {
        results = paginatedFiles.map(file => ({
            file: file.file,
            matchCount: file.matches.filter(match => !match.isContext).length
        }));
    } else if (mode === 'count') {
        results = paginatedFiles.map(file => ({
            file: file.file,
            count: file.matches.filter(match => !match.isContext).length
        }));
    } else {
        results = paginatedFiles;
    }

    let message;
    if (allFiles.length === 0) {
        message = 'No matches found.';
    } else if (hasMore && isBroadSearch) {
        message = `Broad search truncated: showing ${paginatedFiles.length} of ${allFiles.length} files (${totalMatches} matches). Refine with searchPath/filePattern or use head_limit.`;
    } else if (hasMore) {
        message = `Showing ${paginatedFiles.length} of ${allFiles.length} files. Use offset ${effectiveOffset + effectiveLimit} for the next page.`;
    } else {
        message = 'Search completed successfully.';
    }

    return {
        status: 'success',
        data: {
            mode,
            results,
            totalFiles: allFiles.length,
            totalMatches,
            pagination: {
                limit: effectiveLimit,
                offset: effectiveOffset,
                totalAvailable: allFiles.length,
                hasMore
            },
            message
        }
    };
}

async function searchWithRipGrep(searchText, root, options) {
    const rgPath = getBundledRipGrepPath() || 'rg';
    const args = buildSearchArgs(searchText, root, options);
    try {
        const { stdout } = await execFilePromise(rgPath, args, {
            windowsHide: true,
            maxBuffer: 1024 * 1024 * 50
        });
        return parseRipGrepResults(
            stdout,
            root,
            options.mode,
            options.limit,
            options.offset,
            options.isBroadSearch
        );
    } catch (error) {
        // rg exits with code 1 when there are no matches. Return an empty
        // successful result for that case, but allow missing/broken binaries
        // to continue to the platform fallback.
        if (error && error.code === 1) {
            return parseRipGrepResults('', root, options.mode, options.limit, options.offset, options.isBroadSearch);
        }
        return null;
    }
}

async function searchWithGrep(searchText, root, options) {
    if (process.platform === 'win32') return null;
    try {
        const args = ['-rIn'];
        if (!options.caseSensitive) args.push('-i');
        args.push('--', searchText, root);
        const { stdout } = await execFilePromise('grep', args, {
            maxBuffer: 1024 * 1024 * 50
        });
        const lines = String(stdout || '').split(/\r?\n/);
        const jsonLines = lines.map(line => {
            const match = line.match(/^(.*):(\d+):(.*)$/);
            if (!match) return '';
            return JSON.stringify({
                type: 'match',
                data: {
                    path: { text: match[1] },
                    line_number: Number(match[2]),
                    lines: { text: `${match[3]}\n` },
                    submatches: []
                }
            });
        }).filter(Boolean).join('\n');
        return parseRipGrepResults(jsonLines, root, options.mode, options.limit, options.offset, options.isBroadSearch);
    } catch (error) {
        if (error && error.code === 1) return parseRipGrepResults('', root, options.mode, options.limit, options.offset, options.isBroadSearch);
        return null;
    }
}

async function searchWithFindstr(searchText, root, options) {
    if (process.platform !== 'win32') return null;
    try {
        const args = ['/S', '/N'];
        if (!options.caseSensitive) args.push('/I');
        args.push(searchText, path.join(root, '*'));
        const { stdout } = await execFilePromise('findstr', args, {
            windowsHide: true,
            maxBuffer: 1024 * 1024 * 50
        });
        const lines = String(stdout || '').split(/\r?\n/);
        const jsonLines = lines.map(line => {
            const match = line.match(/^(.*):(\d+):(.*)$/);
            if (!match) return '';
            const filePath = relativeSearchPath(root, match[1]);
            if (isExcludedSearchPath(filePath, options.filePattern)) return '';
            return JSON.stringify({
                type: 'match',
                data: {
                    path: { text: match[1] },
                    line_number: Number(match[2]),
                    lines: { text: `${match[3]}\n` },
                    submatches: []
                }
            });
        }).filter(Boolean).join('\n');
        return parseRipGrepResults(jsonLines, root, options.mode, options.limit, options.offset, options.isBroadSearch);
    } catch (error) {
        if (error && error.code === 1) return parseRipGrepResults('', root, options.mode, options.limit, options.offset, options.isBroadSearch);
        return null;
    }
}

function isExcludedSearchPath(filePath, filePattern) {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    if (SEARCH_EXCLUDE_DIRS.some(dir => normalized.includes(`/${dir.toLowerCase()}/`) || normalized.startsWith(`${dir.toLowerCase()}/`))) return true;
    if (SEARCH_EXCLUDE_EXTENSIONS.some(pattern => {
        const suffix = pattern.replace('*', '').toLowerCase();
        return suffix && normalized.endsWith(suffix);
    })) return true;
    if (filePattern) {
        const patterns = String(filePattern).split(',').map(value => value.trim()).filter(Boolean);
        const positivePatterns = patterns.filter(pattern => !pattern.startsWith('!'));
        const negativePatterns = patterns.filter(pattern => pattern.startsWith('!')).map(pattern => pattern.slice(1));
        const basename = path.basename(normalized);
        const globToRegex = pattern => new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i');
        if (negativePatterns.some(pattern => globToRegex(pattern).test(normalized) || globToRegex(pattern).test(basename))) return true;
        if (positivePatterns.length > 0 && !positivePatterns.some(pattern => globToRegex(pattern).test(normalized) || globToRegex(pattern).test(basename))) return true;
    }
    return false;
}

function globPatternToRegex(pattern) {
    const escaped = String(pattern)
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`, 'i');
}

function matchesRequestedFilePattern(filePath, filePattern) {
    if (!filePattern) return true;
    const normalizedPath = filePath.replace(/\\/g, '/');
    const basename = path.basename(normalizedPath);
    const patterns = String(filePattern).split(',').map(value => value.trim()).filter(Boolean);
    const positives = patterns.filter(pattern => !pattern.startsWith('!'));
    const negatives = patterns.filter(pattern => pattern.startsWith('!')).map(pattern => pattern.slice(1));
    if (negatives.some(pattern => globPatternToRegex(pattern).test(normalizedPath) || globPatternToRegex(pattern).test(basename))) return false;
    return positives.length === 0 || positives.some(pattern => globPatternToRegex(pattern).test(normalizedPath) || globPatternToRegex(pattern).test(basename));
}

async function handleSearchFilesByName(root, params = {}) {
    const query = String(params.searchText ?? params.query ?? '').trim();
    if (!query) throw new Error('File name search requires a query.');

    const searchPath = params.searchPath ?? params.path;
    const targetRoot = resolveSearchRoot(root, searchPath);
    const caseSensitive = params.caseSensitive ?? params.case_sensitive ?? false;
    const filePattern = params.filePattern ?? params.glob;
    const normalizedQuery = caseSensitive ? query : query.toLowerCase();
    const isBroadSearch = !searchPath && !filePattern;
    const requestedLimit = params.head_limit === undefined
        ? (isBroadSearch ? SEARCH_BROAD_LIMIT : SEARCH_DEFAULT_LIMIT)
        : Number(params.head_limit);
    const limit = Number.isFinite(requestedLimit) && requestedLimit >= 0 ? Math.floor(requestedLimit) : SEARCH_DEFAULT_LIMIT;
    const offset = Number.isFinite(Number(params.offset)) && Number(params.offset) >= 0 ? Math.floor(Number(params.offset)) : 0;
    const results = [];

    async function walk(directory) {
        const entries = await fs.readdir(directory, { withFileTypes: true });
        entries.sort((a, b) => a.name.localeCompare(b.name));
        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);
            const relativePath = relativeSearchPath(root, fullPath);
            if (isExcludedSearchPath(relativePath, null)) continue;

            if (entry.isDirectory()) {
                await walk(fullPath);
                continue;
            }
            if (!entry.isFile() || !matchesRequestedFilePattern(relativePath, filePattern)) continue;

            const candidate = caseSensitive ? relativePath : relativePath.toLowerCase();
            if (!candidate.includes(normalizedQuery)) continue;

            const stats = await fs.stat(fullPath);
            results.push({ file: relativePath, name: entry.name, path: relativePath, size: stats.size });
        }
    }

    await walk(targetRoot);
    const paginated = results.slice(offset, limit === 0 ? undefined : offset + limit);
    const hasMore = limit !== 0 && results.length > offset + limit;
    const looksLikeContent = /\s|[{}()[\];=<>]/.test(query);
    let message;
    if (results.length === 0 && looksLikeContent) {
        message = 'No file names matched. If you intended to search inside file contents, use search_pattern.';
    } else if (results.length === 0) {
        message = 'No file names matched.';
    } else if (hasMore) {
        message = `Showing ${paginated.length} of ${results.length} file names. Use offset ${offset + limit} for the next page.`;
    } else {
        message = 'File name search completed successfully.';
    }

    return {
        status: 'success',
        data: {
            mode: 'files',
            results: paginated,
            matches: paginated,
            totalFiles: results.length,
            totalMatches: results.length,
            pagination: { limit, offset, totalAvailable: results.length, hasMore },
            message
        }
    };
}

/**
 * Routes the two specialized search interfaces. `search_files` uses the
 * filename walker above; `search_pattern` uses the content engine below.
 * The content engine accepts the IDE-compatible aliases pattern/path/glob/
 * output_mode/context/head_limit/offset.
 */
async function handleSearchFilesNative(root, params = {}) {
    if (params.searchMode === 'filename') {
        return handleSearchFilesByName(root, params);
    }

    const searchText = params.searchText ?? params.query ?? params.pattern;
    if (typeof searchText !== 'string' || searchText.trim() === '') {
        throw new Error('Search text required');
    }

    const filePattern = params.filePattern ?? params.glob;
    const searchPath = params.searchPath ?? params.path;
    const caseSensitive = params.caseSensitive ?? params.case_sensitive ?? false;
    const context = params.context === undefined ? undefined : Number(params.context);
    const mode = params.output_mode || (context !== undefined ? 'content' : 'content');
    const isBroadSearch = !searchPath && !filePattern;
    const requestedLimit = params.head_limit === undefined
        ? (isBroadSearch ? SEARCH_BROAD_LIMIT : SEARCH_DEFAULT_LIMIT)
        : Number(params.head_limit);
    const limit = Number.isFinite(requestedLimit) && requestedLimit >= 0 ? Math.floor(requestedLimit) : SEARCH_DEFAULT_LIMIT;
    const offset = Number.isFinite(Number(params.offset)) && Number(params.offset) >= 0 ? Math.floor(Number(params.offset)) : 0;
    const targetRoot = resolveSearchRoot(root, searchPath);
    const options = { caseSensitive: !!caseSensitive, filePattern, context, mode, limit, offset, isBroadSearch };
    const addToolSuggestion = result => {
        if (result?.data?.totalFiles === 0 && !/[\s{}()[\];=<>]/.test(searchText) && /\.[a-z0-9]{1,8}$/i.test(searchText)) {
            result.data.message = 'No content matches found. If you intended to locate a file by name, use search_files.';
        }
        return result;
    };

    const rgResult = await searchWithRipGrep(searchText, targetRoot, options);
    if (rgResult) return addToolSuggestion(rgResult);

    const fallbackResult = process.platform === 'win32'
        ? await searchWithFindstr(searchText, targetRoot, options)
        : await searchWithGrep(searchText, targetRoot, options);
    if (fallbackResult) return addToolSuggestion(fallbackResult);

    throw new Error('No native search tool found (bundled RipGrep, rg, grep or findstr) or the search failed.');
}

// --- SMART PATCH ENGINE 2.1 ---

function isBinaryFile(buffer) {
    const checkLength = Math.min(buffer.length, 8192);
    let nullCount = 0;
    let controlCount = 0;
    for (let i = 0; i < checkLength; i++) {
        const byte = buffer[i];
        if (byte === 0 && ++nullCount > 2) return true;
        if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13 && ++controlCount > 5) return true;
    }
    return false;
}

function verifySizeSanity(original, patched, filePath) {
    const originalSize = Buffer.byteLength(original, 'utf8');
    const patchedSize = Buffer.byteLength(patched, 'utf8');
    if (originalSize === 0 || (originalSize === 0 && patchedSize === 0)) return null;

    const ratio = patchedSize / originalSize;
    if (ratio > 3) {
        return `Integrity warning: patched file is ${ratio.toFixed(1)}x larger than the original (${formatBytes(patchedSize)} vs ${formatBytes(originalSize)}). Patch blocked for ${path.basename(filePath)}.`;
    }
    if (ratio < 0.1 && originalSize > 100) {
        return `Integrity warning: patched file is only ${(ratio * 100).toFixed(1)}% of the original size (${formatBytes(patchedSize)} vs ${formatBytes(originalSize)}). Patch blocked for ${path.basename(filePath)}.`;
    }
    return null;
}

function detectDuplicateBlocks(content, eol, minBlockLines = 3) {
    const lines = content.split(eol);
    if (lines.length < minBlockLines * 2) return null;

    for (let blockSize = minBlockLines; blockSize <= Math.min(20, Math.floor(lines.length / 2)); blockSize++) {
        for (let i = 0; i <= lines.length - blockSize * 2; i++) {
            let duplicate = true;
            for (let j = 0; j < blockSize; j++) {
                if (lines[i + j].trim() !== lines[i + blockSize + j].trim()) {
                    duplicate = false;
                    break;
                }
            }
            if (duplicate) {
                const preview = lines.slice(i, i + blockSize).map(line => line.trim()).filter(Boolean).slice(0, 3).join(' / ');
                return `Duplicate block detected at line ${i + 1}: ${blockSize} consecutive lines appear twice. Patch blocked. Re-read the file and use exact or lineNumber strategy. Preview: "${preview}"`;
            }
        }
    }
    return null;
}

function escapeReplacement(value) {
    return String(value).replace(/\$/g, '$$$$');
}

function lineFromCharIndex(text, index, eol) {
    return text.substring(0, index).split(eol).length;
}

function generateDiffPreview(original, patched, eol) {
    const oldLines = original.split(eol);
    const newLines = patched.split(eol);
    let start = 0;
    while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) start++;

    let oldEnd = oldLines.length - 1;
    let newEnd = newLines.length - 1;
    while (oldEnd >= start && newEnd >= start && oldLines[oldEnd] === newLines[newEnd]) {
        oldEnd--;
        newEnd--;
    }

    const diffLines = [`--- Lines ${start + 1}-${Math.max(start + 1, newEnd + 1)} ---`];
    for (const line of oldLines.slice(start, oldEnd + 1).slice(0, 15)) diffLines.push(`- ${line.trim().slice(0, 120)}`);
    for (const line of newLines.slice(start, newEnd + 1).slice(0, 15)) diffLines.push(`+ ${line.trim().slice(0, 120)}`);
    if (oldEnd - start + 1 > 15 || newEnd - start + 1 > 15) diffLines.push('... (diff truncated)');
    return diffLines.join('\n');
}

function verifySyntax(str) {
    const stack = [];
    const pairs = { '}': '{', ']': '[', ')': '(' };
    let insideString = false, quoteChar = '', escaped = false, inLineComment = false, inBlockComment = false;

    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const nextChar = i + 1 < str.length ? str[i + 1] : '';

        // Comments (handles // and #)
        if (((char === '/' && nextChar === '/') || char === '#') && !insideString && !inBlockComment) { 
            inLineComment = true; 
            if (char === '/') i++; 
            continue; 
        }
        if (char === '\n' && inLineComment) { inLineComment = false; continue; }
        if (inLineComment) continue;

        if ((char === '/' && nextChar === '*') && !insideString) { inBlockComment = true; i++; continue; }
        if ((char === '*' && nextChar === '/') && inBlockComment) { inBlockComment = false; i++; continue; }
        if (inBlockComment) continue;

        if (escaped) { escaped = false; continue; }
        if (char === '\\' && insideString) { escaped = true; continue; }

        if ((char === '"' || char === "'" || char === '`')) {
            if (!insideString) { insideString = true; quoteChar = char; } 
            else if (char === quoteChar) { insideString = false; }
            continue;
        }

        if (!insideString) {
            if (['{', '[', '('].includes(char)) { stack.push(char); } 
            else if (['}', ']', ')'].includes(char)) {
                if (stack.length === 0 || stack.pop() !== pairs[char]) return false;
            }
        }
    }
    return stack.length === 0 && !insideString && !inBlockComment;
}

function applySinglePatch(content, search, replace, strategy, eol, lineNumber) {
    let newContent = content;
    let appliedStrategy = '';
    let startLine;
    let endLine;

    const normalizedSearch = String(search ?? '').replace(/\r\n|\r|\n/g, eol);
    const normalizedReplace = String(replace ?? '').replace(/\r\n|\r|\n/g, eol);
    const replaceLineCount = normalizedReplace.split(eol).length;

    if (!['auto', 'exact', 'fuzzy', 'regex', 'lineNumber'].includes(strategy)) {
        throw new Error(`Unknown patch strategy: ${strategy}`);
    }

    // 1. Line number strategy
    if (strategy === 'lineNumber' || (strategy === 'auto' && lineNumber !== undefined)) {
        if (lineNumber !== undefined) {
            const lines = content.split(eol);
            if (lineNumber >= 1 && lineNumber <= lines.length) {
                lines[lineNumber - 1] = normalizedReplace;
                newContent = lines.join(eol);
                appliedStrategy = 'lineNumber';
                startLine = lineNumber;
                endLine = lineNumber + replaceLineCount - 1;
            } else if (strategy === 'lineNumber') {
                throw new Error(`Line number ${lineNumber} out of range`);
            }
        }
    }

    // 2. Exact match. Short repeated anchors are rejected; longer blocks are
    // replaced globally, matching the IDE behavior.
    if (!appliedStrategy && (strategy === 'exact' || strategy === 'auto') && normalizedSearch.length > 0) {
        if (content.includes(normalizedSearch)) {
            const occurrences = content.split(normalizedSearch).length - 1;
            if (occurrences > 1 && normalizedSearch.length < 30) {
                throw new Error(`Ambiguous: found ${occurrences} exact matches for pattern. Provide more context or use lineNumber.`);
            }
            const index = content.indexOf(normalizedSearch);
            startLine = lineFromCharIndex(content, index, eol);
            endLine = startLine + replaceLineCount - 1;
            const escapedSearch = normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            newContent = content.replace(new RegExp(escapedSearch, 'g'), escapeReplacement(normalizedReplace));
            appliedStrategy = 'exact';
        } else if (strategy === 'exact') {
            throw new Error(`Exact match not found for pattern: "${normalizedSearch.slice(0, 80)}"`);
        }
    }

    // 3. Whitespace-normalized match
    if (!appliedStrategy && strategy === 'auto' && normalizedSearch.length > 0) {
        const normalizedContent = content.replace(/\r\n|\r|\n/g, '\n').replace(/[ \t]+/g, ' ');
        const normalizedSearchInt = normalizedSearch.replace(/\r\n|\r|\n/g, '\n').replace(/[ \t]+/g, ' ');

        if (normalizedContent.includes(normalizedSearchInt)) {
            const escapedSearch = normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = new RegExp(escapedSearch.replace(/\s+/g, '\\s+'), 'g');
            const match = pattern.exec(content);
            if (match) {
                startLine = lineFromCharIndex(content, match.index, eol);
                endLine = startLine + replaceLineCount - 1;
            }
            pattern.lastIndex = 0;
            newContent = content.replace(pattern, escapeReplacement(normalizedReplace));
            appliedStrategy = 'normalized';
        }
    }

    // 4. Fuzzy match with a confidence threshold
    if (!appliedStrategy && (strategy === 'fuzzy' || strategy === 'auto')) {
        const lines = content.split(eol);
        const searchLines = normalizedSearch.trim().split(eol).map(line => line.trim()).filter(Boolean);
        const threshold = 0.6;

        if (searchLines.length > 0) {
            let bestIndex = -1;
            let bestScore = 0;
            for (let i = 0; i <= lines.length - searchLines.length; i++) {
                let matchingLines = 0;
                let similarity = 0;
                for (let j = 0; j < searchLines.length; j++) {
                    const searchLine = searchLines[j];
                    const contentLine = lines[i + j].trim();
                    if (contentLine.includes(searchLine)) {
                        matchingLines++;
                        similarity += searchLine.length > 0 ? Math.min(searchLine.length / Math.max(contentLine.length, 1), 1) : 0;
                    }
                }
                const lineScore = matchingLines / searchLines.length;
                const contentScore = similarity / searchLines.length;
                const score = Math.min(lineScore, contentScore);
                if (lineScore >= threshold && contentScore >= threshold && score > bestScore) {
                    bestScore = score;
                    bestIndex = i;
                }
            }

            if (bestIndex !== -1) {
                const before = lines.slice(0, bestIndex);
                const after = lines.slice(bestIndex + searchLines.length);
                newContent = [...before, normalizedReplace, ...after].join(eol);
                appliedStrategy = 'fuzzy';
                startLine = bestIndex + 1;
                endLine = startLine + replaceLineCount - 1;
            } else if (strategy === 'fuzzy') {
                throw new Error(`Fuzzy match not found. No match reached the ${(threshold * 100).toFixed(0)}% confidence threshold.`);
            }
        }
    }

    // 5. Explicit regular-expression strategy
    if (!appliedStrategy && strategy === 'regex') {
        let regex;
        try {
            regex = new RegExp(normalizedSearch, 'g');
        } catch (error) {
            throw new Error(`Invalid regex pattern: ${error.message}`);
        }
        const match = regex.exec(content);
        if (!match) throw new Error('Regex pattern not found');
        startLine = lineFromCharIndex(content, match.index, eol);
        endLine = startLine + replaceLineCount - 1;
        regex.lastIndex = 0;
        newContent = content.replace(regex, normalizedReplace);
        appliedStrategy = 'regex';
    }

    return { newContent, appliedStrategy, startLine, endLine };
}

/**
 * Patch File logic with multi-patch support and EOL detection.
 */
async function handlePatchFile(root, params = {}) {
    const { path: relPath, strategy = 'auto', lineNumber } = params;
    const search = params.search ?? params.find ?? params.old_string ?? '';
    const replace = params.replace ?? params.new_string ?? '';
    const fullPath = SafePathResolver.resolvePath(relPath);
    try {
        const fileBuffer = await fs.readFile(fullPath);
        if (isBinaryFile(fileBuffer)) {
            throw new Error(`Binary file detected: refusing to patch ${relPath}.`);
        }

        let content = fileBuffer.toString('utf8');
        const originalContent = content;
        const eol = detectEOL(content);
        const isInitialValid = verifySyntax(content);

        let workingContent = content;
        const applied = [];

        const rawQueue = Array.isArray(params.patches) && params.patches.length > 0
            ? params.patches
            : [{ search, replace, lineNumber }];
        const queue = rawQueue.map(patch => ({
            search: patch.search ?? patch.find ?? patch.old_string ?? '',
            replace: patch.replace ?? patch.new_string ?? '',
            lineNumber: patch.lineNumber
        }));

        if (queue.length === 0 || queue.every(patch => !patch.search && patch.replace === '' && patch.lineNumber === undefined)) {
            throw new Error('No patch content supplied. Provide search/replace, lineNumber, or patches.');
        }
        if (queue.some(patch => patch.lineNumber !== undefined)) {
            queue.sort((a, b) => (b.lineNumber ?? 0) - (a.lineNumber ?? 0));
        }

        for (const patch of queue) {
            let patchResult;
            let retriesLeft = 1;
            while (true) {
                try {
                    patchResult = applySinglePatch(workingContent, patch.search, patch.replace, strategy, eol, patch.lineNumber);
                    break;
                } catch (error) {
                    if (retriesLeft > 0 && (error.message?.includes('Exact match not found') || error.message?.includes('Ambiguous'))) {
                        try {
                            const freshContent = (await fs.readFile(fullPath)).toString('utf8');
                            if (freshContent !== workingContent) {
                                workingContent = freshContent;
                                retriesLeft--;
                                continue;
                            }
                        } catch (readError) {
                            // Preserve the original patch error below.
                        }
                    }
                    throw error;
                }
            }

            const { newContent, appliedStrategy, startLine, endLine } = patchResult;

            if (!appliedStrategy) {
                const preview = patch.search ? String(patch.search).substring(0, 80) : '(empty)';
                throw new Error(`Pattern not found after trying ${strategy} strategy: "${preview}". Re-read the file, use lineNumber, or provide a more specific anchor.`);
            }
            workingContent = newContent;
            applied.push(appliedStrategy);

            if (appliedStrategy === 'fuzzy' || appliedStrategy === 'normalized') {
                const fingerprint = String(patch.search).trim().split(/\r\n|\r|\n/).map(line => line.trim()).filter(Boolean).slice(0, 3).join('\n');
                if (fingerprint.length > 20) {
                    const expression = new RegExp(fingerprint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'g');
                    const resultOccurrences = (workingContent.match(expression) || []).length;
                    const originalOccurrences = (originalContent.match(expression) || []).length;
                    if (resultOccurrences > originalOccurrences) {
                        throw new Error(`Incomplete replacement detected: the search fingerprint occurs ${resultOccurrences} times after patching versus ${originalOccurrences} before. Use exact or lineNumber strategy.`);
                    }
                }
            }
        }

        if (applied.length > 0) {
            if (isInitialValid && !verifySyntax(workingContent)) {
                throw new Error("Integrity Check: Patch breaks structure (unbalanced brackets).");
            }
            const riskyStrategy = applied.some(value => value === 'fuzzy' || value === 'normalized');
            if (riskyStrategy) {
                const sizeWarning = verifySizeSanity(originalContent, workingContent, fullPath);
                if (sizeWarning) throw new Error(sizeWarning);
                const originalLines = originalContent.split(/\r\n|\r|\n/).length;
                const patchedLines = workingContent.split(/\r\n|\r|\n/).length;
                if (Math.abs(patchedLines - originalLines) > 5) {
                    const duplicateWarning = detectDuplicateBlocks(workingContent, eol);
                    if (duplicateWarning) throw new Error(duplicateWarning);
                }
            }
            if (workingContent !== originalContent) {
                await fs.writeFile(fullPath + '.bak', originalContent, 'utf8');
                await fs.writeFile(fullPath, workingContent, 'utf-8');
                return `Patched successfully using [${applied.join(', ')}] strategies.\n\n--- Diff preview ---\n${generateDiffPreview(originalContent, workingContent, eol)}`;
            }
            return 'No changes applied.';
        }
        throw new Error('No patches could be applied.');
    } catch (e) {
        throw new Error(`Patch File Engine failed: ${e.message}`);
    }
}

async function handleUndoPatch(root, relPath) {
    const fullPath = SafePathResolver.resolvePath(relPath);
    try {
        for (const extension of ['.bak', '.backup', '_bak']) {
            const backupPath = fullPath + extension;
            try {
                const backup = await fs.readFile(backupPath, 'utf8');
                await fs.writeFile(fullPath, backup, 'utf8');
                return `Reverted ${relPath} successfully using ${extension} backup.`;
            } catch (error) {
                // Try the next compatible backup convention.
            }
        }
        throw new Error(`No backup found for ${relPath}.`);
    } catch (e) {
        throw new Error(`Undo failed: ${e.message}`);
    }
}

// --- SYSTEM ACTIONS ---

let prevCpuTimes = null;
let lastCpuUsage = '0%';

async function handleSystemMetrics() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpus = os.cpus();

    if (prevCpuTimes && prevCpuTimes.length === cpus.length) {
        let totalDiff = 0, idleDiff = 0;
        for (let i = 0; i < cpus.length; i++) {
            const current = cpus[i].times;
            const prev = prevCpuTimes[i].times;
            const currentTotal = current.user + current.nice + current.sys + current.idle + current.irq;
            const prevTotal = prev.user + prev.nice + prev.sys + prev.idle + prev.irq;
            totalDiff += (currentTotal - prevTotal);
            idleDiff += (current.idle - prev.idle);
        }
        if (totalDiff > 0) {
            lastCpuUsage = `${100 - Math.floor((idleDiff / totalDiff) * 100)}%`;
        }
    }
    prevCpuTimes = cpus;

    return {
        hostname: os.hostname(),
        platform: os.platform(),
        uptime: formatUptime(os.uptime()),
        cpu: { model: cpus[0].model, cores: cpus.length, usage: lastCpuUsage },
        memory: {
            total: formatBytes(totalMem),
            free: formatBytes(freeMem),
            usage: `${Math.round((usedMem / totalMem) * 100)}%`
        }
    };
}

async function handleRestartOllama(opts) {
    if (process.platform !== 'win32') {
        throw new Error("El reinicio automático de Ollama solo está soportado en Windows por ahora.");
    }

    // Support both legacy (boolean) and new (object) call signatures
    const zeroOverhead = typeof opts === 'boolean' ? opts : (opts?.zeroOverhead ?? false);
    const mainGpu = typeof opts === 'object' ? opts?.mainGpu : undefined;

    // ── OLLAMA_GPU_OVERHEAD ──────────────────────────────────────────
    // Use an explicit value in both states.  This makes the setting genuinely
    // reversible instead of relying on Ollama's zero-byte default.
    const gpuOverheadBytes = zeroOverhead ? 0 : OLLAMA_SAFE_GPU_OVERHEAD_BYTES;
    await execPromise(`setx OLLAMA_GPU_OVERHEAD ${gpuOverheadBytes}`);

    // ── CUDA_VISIBLE_DEVICES — GPU Isolation ────────────────────────
    // When the user selects a specific GPU index, we isolate it so Ollama
    // (and llama-server) only sees that device. This prevents multi-GPU
    // layer splitting which causes PTX crashes on incompatible architectures
    // (e.g. Maxwell compute 5.x + CUDA 12.x PTX toolchain).
    // Passing null/undefined restores default (all GPUs visible).
    if (mainGpu !== undefined && mainGpu !== null) {
        await execPromise(`setx CUDA_VISIBLE_DEVICES ${mainGpu}`);
    } else {
        try {
            await execPromise('REG delete HKCU\\Environment /F /V CUDA_VISIBLE_DEVICES');
        } catch(e) {} // Ignorar si no existe
    }

    // Matar procesos
    try { await execPromise('taskkill /F /IM "ollama app.exe"'); } catch(e) {}
    try { await execPromise('taskkill /F /IM "ollama.exe"'); } catch(e) {}

    await new Promise(r => setTimeout(r, 1500));

    const appData = process.env.LOCALAPPDATA;
    const ollamaPath = `${appData}\\Programs\\Ollama\\ollama app.exe`;

    // ── CRITICAL: Inject env explicitly into the spawned process ─────
    // `setx` writes to the registry, but the parent process (Electron)
    // inherited its environment at launch time — before CUDA_VISIBLE_DEVICES
    // existed. If we spawn without `env`, the child inherits the STALE
    // parent environment and never sees the GPU isolation variable.
    // We build the env object explicitly so Ollama picks it up immediately.
    const childEnv = { ...process.env };
    if (mainGpu !== undefined && mainGpu !== null) {
        childEnv.CUDA_VISIBLE_DEVICES = String(mainGpu);
    } else {
        delete childEnv.CUDA_VISIBLE_DEVICES;
    }
    // Do not inherit a stale OLLAMA_GPU_OVERHEAD from Electron.  The spawned
    // Ollama process must always receive the exact state selected above.
    childEnv.OLLAMA_GPU_OVERHEAD = String(gpuOverheadBytes);

    const { spawn } = require('child_process');
    const child = spawn(ollamaPath, [], {
        detached: true,
        stdio: 'ignore',
        env: childEnv
    });
    child.unref();

    return { zeroOverhead, gpuOverheadBytes };
}

async function readFileTail(filePath, maxBytes = 1024 * 1024) {
    const handle = await fs.open(filePath, 'r');
    try {
        const { size } = await handle.stat();
        const start = Math.max(0, size - maxBytes);
        const buffer = Buffer.alloc(size - start);
        await handle.read(buffer, 0, buffer.length, start);
        return buffer.toString('utf8');
    } finally {
        await handle.close();
    }
}

/**
 * Reads the value used by the running Ollama server from its latest startup
 * record.  The renderer uses this instead of trusting its saved preference.
 */
async function handleGetOllamaRuntimeConfig() {
    const serverLog = path.join(process.env.LOCALAPPDATA || '', 'Ollama', 'server.log');

    try {
        const logTail = await readFileTail(serverLog);
        const values = [...logTail.matchAll(/OLLAMA_GPU_OVERHEAD:(\d+)/g)];
        const lastValue = values.at(-1)?.[1];
        if (lastValue !== undefined) {
            const gpuOverheadBytes = Number(lastValue);
            return {
                detected: true,
                source: 'server-log',
                gpuOverheadBytes,
                zeroOverhead: gpuOverheadBytes === 0
            };
        }
    } catch (error) {
        // Ollama may not have started yet. Fall through to the persisted value.
    }

    try {
        const { stdout } = await execPromise('REG QUERY HKCU\\Environment /V OLLAMA_GPU_OVERHEAD');
        const match = stdout.match(/OLLAMA_GPU_OVERHEAD\s+REG_\w+\s+(\d+)/i);
        if (match) {
            const gpuOverheadBytes = Number(match[1]);
            return {
                detected: true,
                source: 'registry',
                gpuOverheadBytes,
                zeroOverhead: gpuOverheadBytes === 0
            };
        }
    } catch (error) {
        // No persisted override and no server record to inspect.
    }

    return { detected: false, source: 'unavailable' };
}

async function handleGpuInfo() {
    const results = [];
    
    // 1. Try NVIDIA-SMI (Highest accuracy for AI indexes)
    //    Query compute_cap to detect incompatible architectures (Maxwell ≤5.2)
    try {
        const { stdout } = await execPromise('nvidia-smi --query-gpu=index,name,memory.total,compute_cap --format=csv,noheader,nounits');
        if (stdout) {
            const lines = stdout.trim().split('\n');
            lines.forEach(line => {
                const [index, name, mem, computeCap] = line.split(',').map(s => s.trim());
                const cc = computeCap ? parseFloat(computeCap) : null;
                results.push({
                    index: parseInt(index),
                    name,
                    memory: `${mem} MB`,
                    type: 'NVIDIA',
                    computeCap: cc,
                    // CUDA 12.x PTX kernels crash on Maxwell (5.x) and older.
                    // compute ≥6.0 (Pascal+) is safe for modern Ollama builds.
                    cudaCompatible: cc === null ? null : cc >= 6.0
                });
            });
            return results;
        }
    } catch (e) {
        // nvidia-smi not available or no NVIDIA GPU — fall back to basic query
        try {
            const { stdout } = await execPromise('nvidia-smi --query-gpu=index,name,memory.total --format=csv,noheader,nounits');
            if (stdout) {
                const lines = stdout.trim().split('\n');
                lines.forEach(line => {
                    const [index, name, mem] = line.split(',').map(s => s.trim());
                    results.push({
                        index: parseInt(index),
                        name,
                        memory: `${mem} MB`,
                        type: 'NVIDIA',
                        computeCap: null,
                        cudaCompatible: null
                    });
                });
                return results;
            }
        } catch (e2) { }
    }

    // 2. Try Windows WMIC (Fallback for general GPUs)
    if (process.platform === 'win32') {
        try {
            // Get Name and AdapterRAM (in bytes)
            const { stdout } = await execPromise('wmic path win32_VideoController get name,AdapterRAM /format:list');
            if (stdout) {
                const devices = stdout.trim().split(/\r?\n\r?\n/);
                devices.forEach((device, i) => {
                    const lines = device.split('\n');
                    let name = '', ram = 0;
                    lines.forEach(l => {
                        if (l.startsWith('Name=')) name = l.split('=')[1].trim();
                        if (l.startsWith('AdapterRAM=')) ram = parseInt(l.split('=')[1].trim());
                    });
                    if (name) {
                        results.push({
                            index: i,
                            name,
                            memory: ram ? `${Math.round(ram / 1024 / 1024)} MB` : 'Unknown',
                            type: 'Windows'
                        });
                    }
                });
            }
        } catch (e) { }
    }

    // 3. Linux Fallback (lspci)
    if (process.platform !== 'win32' && results.length === 0) {
        try {
            const { stdout } = await execPromise('lspci | grep -i vga');
            if (stdout) {
                const lines = stdout.trim().split('\n');
                lines.forEach((line, i) => {
                    results.push({
                        index: i,
                        name: line.split(': ')[1] || line,
                        memory: 'Unknown',
                        type: 'Linux'
                    });
                });
            }
        } catch (e) { }
    }

    return results;
}

async function handleGitInfo(root) {
    try {
        const { stdout: gitRootRaw } = await execPromise('git rev-parse --show-toplevel', { cwd: root }).catch(() => ({ stdout: '' }));
        if (!gitRootRaw.trim()) return { isRepo: false };

        const r = gitRootRaw.trim();
        const [branchRes, statusRes, countsRes] = await Promise.all([
            execPromise('git rev-parse --abbrev-ref HEAD', { cwd: r }),
            execPromise('git status --short', { cwd: r }),
            execPromise('git rev-list --left-right --count HEAD...@{u}', { cwd: r }).catch(() => ({ stdout: '0\t0' }))
        ]);

        const branch = branchRes.stdout.trim();
        const statusRaw = statusRes.stdout.trim();
        const statusLines = statusRaw ? statusRaw.split('\n') : [];

        const modified = statusLines.filter(l => l.startsWith(' M') || l.startsWith('M ') || l.startsWith('R ') || l.startsWith(' R')).length;
        const added = statusLines.filter(l => l.startsWith(' A') || l.startsWith('A ') || l.startsWith('??')).length;
        const deleted = statusLines.filter(l => l.startsWith(' D') || l.startsWith('D ')).length;

        const fileStatus = {};
        statusLines.forEach(line => {
            const match = line.match(/^(.{2})\s(.+)$/);
            if (!match) return;
            const code = match[1].trim();
            let relPath = match[2].trim();
            if (code.startsWith('R')) {
                const parts = relPath.split(' -> ');
                if (parts.length === 2) relPath = parts[1].trim();
            }
            if (relPath.startsWith('"') && relPath.endsWith('"')) relPath = relPath.slice(1, -1);
            fileStatus[relPath] = code;
        });

        const countsOutput = (countsRes.stdout || '0\t0').trim();
        const [ahead, behind] = countsOutput.includes('\t') ? countsOutput.split('\t').map(Number) : [0, 0];

        return {
            isRepo: true,
            root: r,
            branch,
            modified,
            added,
            deleted,
            ahead: ahead || 0,
            behind: behind || 0,
            statusRaw,
            fileStatus
        };
    } catch (e) {
        return { isRepo: false, error: e.message };
    }
}

module.exports = {
    handleGetFileOutline,
    handleBatchOperation,
    handleListFiles,
    handleSearchFilesNative,
    handlePatchFile,
    handleUndoPatch,
    handleSystemMetrics,
    handleGpuInfo,
    handleGetOllamaRuntimeConfig,
    handleRestartOllama,
    handleGitInfo
};
