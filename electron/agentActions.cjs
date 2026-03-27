/**
 * agentActions.cjs - Advanced Agent Tools for MikuCentral
 * Upgraded with SmartPatch 2.0 and Native Search Engines
 */

const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const SafePathResolver = require('./SafePathResolver.cjs');

const execPromise = util.promisify(exec);

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
                await applyBatchOp(operation, filePath, destination ? path.resolve(root, destination, file) : '');
                count++;
            }
        }
    } else {
        await applyBatchOp(operation, sourcePath, destination ? path.resolve(root, destination) : '');
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
    // Resolve using prefix if present, otherwise fallback to root/directory
    let targetDir;
    try {
        targetDir = directory ? SafePathResolver.resolvePath(directory) : root;
    } catch (e) {
        // Fallback for raw paths if resolver fails (e.g. no prefix match and no workspace root set)
        targetDir = directory ? path.resolve(root, directory) : root;
    }
    
    const stats = await fs.stat(targetDir);
    if (!stats.isDirectory()) {
        throw new Error('Path is not a directory.');
    }

    const results = [];
    const files = await fs.readdir(targetDir);

    for (const file of files) {
        const fullPath = path.join(targetDir, file);
        try {
            const stats = await fs.stat(fullPath);
            const isDir = stats.isDirectory();
            
            // Skip common ignore patterns
            if (['node_modules', '.git', 'dist', 'build', '.next'].includes(file)) continue;

            results.push({
                name: path.relative(root, fullPath).replace(/\\/g, '/'),
                size: isDir ? 0 : stats.size,
                isDirectory: isDir
            });

            if (recursive && isDir) {
                // Limit depth to 3 for safety
                const subFiles = await handleListFiles(root, { directory: path.relative(root, fullPath), recursive: false });
                results.push(...subFiles);
            }
        } catch (e) {}
    }

    return results;
}

// --- NATIVE SEARCH ENGINE ---

async function searchWithRipGrep(searchText, root, caseSensitive, filePattern) {
    try {
        let command = `rg --json ${caseSensitive ? '' : '-i'} "${searchText}" "${root}"`;
        if (filePattern) command += ` -g "${filePattern}"`;
        command += ' --max-count 50'; 

        const { stdout } = await execPromise(command, { maxBuffer: 1024 * 1024 * 10 });
        const lines = stdout.trim().split('\n');
        const fileResults = {};

        for (const line of lines) {
            try {
                const parsed = JSON.parse(line);
                if (parsed.type === 'match') {
                    const filePath = path.relative(root, parsed.data.path.text).replace(/\\/g, '/');
                    if (!fileResults[filePath]) {
                        fileResults[filePath] = { file: filePath, matches: [] };
                    }
                    fileResults[filePath].matches.push({
                        line: parsed.data.line_number,
                        content: parsed.data.lines.text.trim()
                    });
                }
            } catch (e) { }
        }
        return Object.values(fileResults);
    } catch (e) { return null; }
}

async function searchWithGrep(searchText, root, caseSensitive) {
    try {
        const command = `grep -rIn ${caseSensitive ? '' : '-i'} "${searchText}" "${root}" | head -n 300`;
        const { stdout } = await execPromise(command, { maxBuffer: 1024 * 1024 * 5 });
        const lines = stdout.trim().split('\n');
        const fileResults = {};

        for (const line of lines) {
            const match = line.match(/^(.+):(\d+):(.*)$/);
            if (match) {
                const filePath = path.relative(root, match[1]).replace(/\\/g, '/');
                if (!fileResults[filePath]) {
                    fileResults[filePath] = { file: filePath, matches: [] };
                }
                fileResults[filePath].matches.push({
                    line: parseInt(match[2]),
                    content: match[3].trim()
                });
            }
        }
        return Object.values(fileResults);
    } catch (e) { return null; }
}

async function searchWithFindstr(searchText, root, caseSensitive) {
    try {
        const command = `findstr /S /N ${caseSensitive ? '' : '/I'} "${searchText}" "${path.join(root, '*')}"`;
        const { stdout } = await execPromise(command, { maxBuffer: 1024 * 1024 * 5 });
        const lines = stdout.trim().split('\n');
        const fileResults = {};

        for (const line of lines) {
            const match = line.match(/^(.+):(\d+):(.*)$/);
            if (match) {
                const filePath = path.relative(root, match[1]).replace(/\\/g, '/');
                if (filePath.includes('node_modules') || filePath.includes('.git')) continue;
                if (!fileResults[filePath]) {
                    fileResults[filePath] = { file: filePath, matches: [] };
                }
                if (fileResults[filePath].matches.length < 15) {
                    fileResults[filePath].matches.push({
                        line: parseInt(match[2]),
                        content: match[3].trim()
                    });
                }
            }
        }
        return Object.values(fileResults);
    } catch (e) { return null; }
}

/**
 * Orchestrates native search based on available tools.
 * Prioritize RipGrep, then fallback to standard OS tools.
 */
async function handleSearchFilesNative(root, { searchText, filePattern, caseSensitive, searchPath }) {
    if (!searchText) throw new Error('Search text required');
    const targetRoot = searchPath ? SafePathResolver.resolvePath(searchPath) : root;

    // 1. Try RipGrep
    const rgResult = await searchWithRipGrep(searchText, targetRoot, !!caseSensitive, filePattern);
    if (rgResult) return rgResult;

    // 2. Try Grep (Unix)
    if (process.platform !== 'win32') {
        const grepResult = await searchWithGrep(searchText, targetRoot, !!caseSensitive);
        if (grepResult) return grepResult;
    }

    // 3. Try Findstr (Windows)
    if (process.platform === 'win32') {
        const findstrResult = await searchWithFindstr(searchText, targetRoot, !!caseSensitive);
        if (findstrResult) return findstrResult;
    }

    throw new Error('No native search tool found (rg, grep, findstr) or search failed.');
}

// --- SMART PATCH ENGINE 2.0 ---

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

    const normalizedSearch = (search || '').replace(/\r\n|\r|\n/g, eol);
    const normalizedReplace = (replace || '').replace(/\r\n|\r|\n/g, eol);

    // 1. Line Number
    if (strategy === 'lineNumber' || (strategy === 'auto' && lineNumber !== undefined)) {
        if (lineNumber !== undefined) {
            const lines = content.split(eol);
            if (lineNumber >= 1 && lineNumber <= lines.length) {
                lines[lineNumber - 1] = normalizedReplace;
                newContent = lines.join(eol);
                appliedStrategy = 'lineNumber';
            }
        }
    }

    // 2. Exact Match
    if (!appliedStrategy && (strategy === 'exact' || strategy === 'auto')) {
        if (content.includes(normalizedSearch)) {
            const occurrences = content.split(normalizedSearch).length - 1;
            if (occurrences > 1 && normalizedSearch.length < 30) {
                throw new Error(`Ambiguity: ${occurrences} matches found. Provide more context or use lineNumber.`);
            }
            newContent = content.replace(normalizedSearch, normalizedReplace);
            appliedStrategy = 'exact';
        }
    }

    // 3. Normalized Match (Whitespace flexible)
    if (!appliedStrategy && strategy === 'auto') {
        const normalizedContent = content.replace(/\r\n|\r|\n/g, '\n').replace(/[ \t]+/g, ' ');
        const normalizedSearchInt = normalizedSearch.replace(/\r\n|\r|\n/g, '\n').replace(/[ \t]+/g, ' ');

        if (normalizedContent.includes(normalizedSearchInt) || flexibleIncludes(normalizedContent, normalizedSearchInt)) {
            const escapedSearch = normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = new RegExp(escapedSearch.replace(/\s+/g, '\\s+'), 'g');
            newContent = content.replace(pattern, normalizedReplace);
            appliedStrategy = 'normalized';
        }
    }

    // 4. Fuzzy Match (Multi-line resilient)
    if (!appliedStrategy && (strategy === 'fuzzy' || strategy === 'auto')) {
        const lines = content.split(eol);
        const searchLines = normalizedSearch.trim().split(eol).map(l => l.trim()).filter(l => l.length > 0);
        
        if (searchLines.length > 0) {
            // Find a sequence of lines that contains all search lines in order
            for (let i = 0; i <= lines.length - searchLines.length; i++) {
                let match = true;
                for (let j = 0; j < searchLines.length; j++) {
                    const tLine = lines[i + j].trim();
                    const sLine = searchLines[j];
                    if (!tLine.includes(sLine) && !flexibleIncludes(tLine, sLine)) {
                        match = false;
                        break;
                    }
                }

                if (match) {
                    // We found a block. Replace the whole range.
                    const before = lines.slice(0, i);
                    const after = lines.slice(i + searchLines.length);
                    newContent = [...before, normalizedReplace, ...after].join(eol);
                    appliedStrategy = 'fuzzy';
                    break;
                }
            }
        }
    }

    return { newContent, appliedStrategy };
}

/**
 * Patch File logic with multi-patch support and EOL detection.
 */
async function handlePatchFile(root, { path: relPath, search, replace, strategy = 'auto', lineNumber, patches }) {
    // Support prefix inside patch
    const fullPath = SafePathResolver.resolvePath(relPath);
    try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const originalContent = content;
        const eol = detectEOL(content);
        const isInitialValid = verifySyntax(content);

        let workingContent = content;
        const applied = [];

        const queue = (patches && patches.length) ? patches : [{ search, replace, lineNumber }];

        for (const patch of queue) {
            const { newContent, appliedStrategy } = applySinglePatch(
                workingContent,
                patch.search,
                patch.replace,
                strategy,
                eol,
                patch.lineNumber
            );

            if (!appliedStrategy) {
                const faultMsg = patch.search ? `Pattern not found: "${patch.search.substring(0, 40)}..."` : "Empty search pattern";
                throw new Error(`${faultMsg}. Tip: verifica que el texto a buscar sea idéntico al del archivo (incluyendo espacios y signos de puntuación) o usa menos líneas.`);
            }
            workingContent = newContent;
            applied.push(appliedStrategy);
        }

        if (applied.length > 0) {
            if (isInitialValid && !verifySyntax(workingContent)) {
                throw new Error("Integrity Check: Patch breaks structure (unbalanced brackets).");
            }
            if (workingContent !== originalContent) {
                await fs.writeFile(fullPath + '.bak', originalContent, 'utf-8');
                await fs.writeFile(fullPath, workingContent, 'utf-8');
                return `Patched successfully using [${applied.join(', ')}] strategies.`;
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
    const backupPath = fullPath + '.bak';
    try {
        const backup = await fs.readFile(backupPath, 'utf-8');
        await fs.writeFile(fullPath, backup, 'utf-8');
        return `Reverted ${relPath} successfully.`;
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
    handleGitInfo
};
