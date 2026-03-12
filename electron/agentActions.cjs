/**
 * agentActions.cjs - Advanced Agent Tools for MikuCentral
 * Ported and adapted from mikuInterpreterAgent_V1.0
 */

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');

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

// --- FILE SYSTEM ACTIONS ---

/**
 * Extracts classes, functions, and interfaces from a file.
 */
async function handleGetFileOutline(fullPath) {
    try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const outline = [];
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Precise regex for common programming languages
            if (/^\s*(?:export\s+)?(?:async\s+)?(?:class|function|interface|type|const|let|var)\s+[a-zA-Z0-9_$]+|^\s*(?!(?:if|for|while|switch|catch)\b)[a-zA-Z0-9_$]+\s*(?::\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>)|\([^)]*\)\s*\{)/.test(line)) {
                outline.push(`L${i + 1}: ${line.trim()}`);
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
    const sourcePath = path.resolve(root, source);
    let count = 0;

    if (pattern) {
        const stats = await fs.stat(sourcePath);
        const baseDir = stats.isDirectory() ? sourcePath : path.dirname(sourcePath);
        const files = await fs.readdir(baseDir);
        
        // Simple glob to regex conversion
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
 * Native file search with better performance.
 */
async function handleSearchFilesNative(root, { searchText, filePattern, caseSensitive, searchPath }) {
    if (!searchText) throw new Error('Search text required');
    const results = [];
    const startPath = searchPath ? path.resolve(root, searchPath) : root;
    const regex = new RegExp(searchText, caseSensitive ? 'g' : 'gi');
    const fileRegex = filePattern ? new RegExp(filePattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.')) : null;

    async function searchDir(dirPath) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                if (['node_modules', '.git', '.next', 'dist', 'build'].includes(entry.name)) continue;
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    await searchDir(fullPath);
                } else {
                    if (fileRegex && !fileRegex.test(entry.name)) continue;
                    try {
                        const content = await fs.readFile(fullPath, 'utf-8');
                        if (regex.test(content)) {
                            const lines = content.split('\n');
                            const matchedLines = [];
                            lines.forEach((line, index) => {
                                if (new RegExp(searchText, caseSensitive ? '' : 'i').test(line)) {
                                    matchedLines.push({
                                        line: index + 1,
                                        content: line.trim()
                                    });
                                }
                            });
                            results.push({
                                file: path.relative(root, fullPath).replace(/\\/g, '/'),
                                matches: matchedLines
                            });
                        }
                    } catch (e) { }
                }
            }
        } catch (e) { }
    }
    await searchDir(startPath);
    return results;
}

// --- SMART PATCH ENGINE ---

function verifySyntax(str) {
    const stack = [];
    const pairs = { '}': '{', ']': '[', ')': '(' };
    let insideString = false, quoteChar = '', escaped = false, inLineComment = false, inBlockComment = false;

    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const nextChar = i + 1 < str.length ? str[i + 1] : '';

        if ((char === '/' && nextChar === '/') && !insideString && !inBlockComment) { inLineComment = true; i++; continue; }
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

async function handleSmartPatch(root, { path: relPath, search, replace, strategy = 'auto', lineNumber }) {
    const fullPath = path.resolve(root, relPath);
    try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const originalContent = content;
        const isInitialValid = verifySyntax(content);
        let newContent = content;
        let appliedStrategy = '';

        // Line Number Strategy
        if (lineNumber !== undefined && (strategy === 'lineNumber' || strategy === 'auto')) {
            const lines = content.split('\n');
            if (lineNumber >= 1 && lineNumber <= lines.length) {
                lines[lineNumber - 1] = replace;
                newContent = lines.join('\n');
                appliedStrategy = 'lineNumber';
            }
        }

        // Exact Match Strategy
        if (!appliedStrategy && (strategy === 'exact' || strategy === 'auto')) {
            if (content.includes(search)) {
                newContent = content.replace(search, replace);
                appliedStrategy = 'exact';
            }
        }

        // Normalized Strategy
        if (!appliedStrategy && strategy === 'auto') {
            const normalizedContent = content.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ');
            const normalizedSearch = search.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ');
            if (normalizedContent.includes(normalizedSearch)) {
                const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
                newContent = content.replace(new RegExp(escapedSearch, 'g'), replace);
                appliedStrategy = 'normalized';
            }
        }

        if (appliedStrategy) {
            if (isInitialValid && !verifySyntax(newContent)) {
                throw new Error(`Integrity Error: Patch breaks syntax (braces/brackets mismatch).`);
            }
            if (newContent !== originalContent) {
                await fs.writeFile(fullPath + '.bak', originalContent, 'utf-8');
                await fs.writeFile(fullPath, newContent, 'utf-8');
                return `Successfully patched using ${appliedStrategy} strategy.`;
            }
            return 'No changes applied.';
        }
        throw new Error('Pattern not found.');
    } catch (e) {
        throw new Error(`SmartPatch failed: ${e.message}`);
    }
}

async function handleUndoPatch(root, relPath) {
    const fullPath = path.resolve(root, relPath);
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
        const { stdout: gitRoot } = await execPromise('git rev-parse --show-toplevel', { cwd: root }).catch(() => ({ stdout: '' }));
        if (!gitRoot.trim()) return { isRepo: false };

        const r = gitRoot.trim();
        const [branch, status] = await Promise.all([
            execPromise('git rev-parse --abbrev-ref HEAD', { cwd: r }).then(res => res.stdout.trim()),
            execPromise('git status --short', { cwd: r }).then(res => res.stdout.trim())
        ]);

        const lines = status ? status.split('\n') : [];
        return {
            isRepo: true,
            root: r,
            branch,
            modified: lines.filter(l => l.startsWith(' M') || l.startsWith('M ')).length,
            added: lines.filter(l => l.startsWith(' A') || l.startsWith('A ') || l.startsWith('??')).length,
            deleted: lines.filter(l => l.startsWith(' D') || l.startsWith('D ')).length,
            statusRaw: status
        };
    } catch (e) {
        return { isRepo: false, error: e.message };
    }
}

module.exports = {
    handleGetFileOutline,
    handleBatchOperation,
    handleSearchFilesNative,
    handleSmartPatch,
    handleUndoPatch,
    handleSystemMetrics,
    handleGitInfo
};
