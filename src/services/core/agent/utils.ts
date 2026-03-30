/**
 * Agent Utility Functions
 * Path: src/services/core/agent/utils.ts
 * REWIRED: Literal copy from original agent.ts
 */
import { FileTarget, AppConfig } from '../../../types';

/**
 * Resolves the source and filename from a tool call.
 * Detects prefixes like @CORE/, @EXTRA/, @WORKSPACE/, @TOOLS/ in the filename.
 * Also handles absolute system paths by mapping them to configured folder paths.
 */
export function resolvePathAndSource(filename: string | undefined, sourceArg?: string, config?: AppConfig): { target: FileTarget, cleanFilename: string } {
    let f = (filename || '').trim();
    let target: FileTarget = 'workSpace';

    const normalizedF = f.replace(/\\/g, '/').toLowerCase();
    const isAbsolutePath = /^[a-zA-Z]:\//.test(normalizedF) || normalizedF.startsWith('/');

    // 1. Absolute Path Detection (via config folderPaths)
    // Moving this UP ensures absolute paths are handled before default prefix logic
    if (isAbsolutePath && config?.folderPaths) {
        const paths = config.folderPaths;
        // Priority order: core > tools > workSpace > extra > root
        const targets: FileTarget[] = ['core', 'tools', 'workSpace', 'extra', 'root'];
        for (const t of targets) {
            const p = paths[t];
            if (p) {
                const normalizedP = p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
                // Match exact root OR subpath
                if (normalizedF === normalizedP || normalizedF.startsWith(normalizedP + '/')) {
                    const clean = f.substring(p.length).replace(/^[/\\]+/, '');
                    return { target: t, cleanFilename: clean };
                }
            }
        }
    }

    // 2. Prefix Detection (@CORE/, etc.)
    const upperF = f.toUpperCase();
    if (upperF === '@CORE' || upperF.startsWith('@CORE/')) {
        target = 'core';
        f = upperF === '@CORE' ? '' : f.slice(6);
    } else if (upperF === '@EXTRA' || upperF.startsWith('@EXTRA/') || upperF === '@LIBRARY' || upperF.startsWith('@LIBRARY/')) {
        target = 'extra';
        if (upperF === '@EXTRA' || upperF === '@LIBRARY') f = '';
        else f = upperF.startsWith('@EXTRA/') ? f.slice(7) : f.slice(9);
    } else if (upperF === '@WORKSPACE' || upperF.startsWith('@WORKSPACE/') || upperF === '@SANDBOX' || upperF.startsWith('@SANDBOX/')) {
        target = 'workSpace';
        if (upperF === '@WORKSPACE') f = '';
        else if (upperF === '@SANDBOX') f = '';
        else f = upperF.startsWith('@WORKSPACE/') ? f.slice(11) : f.slice(9);
    } else if (upperF === '@TOOLS' || upperF.startsWith('@TOOLS/')) {
        target = 'tools';
        f = upperF === '@TOOLS' ? '' : f.slice(7);
    } else if (upperF === '@ROOT' || upperF.startsWith('@ROOT/')) {
        target = 'root';
        f = upperF === '@ROOT' ? '' : f.slice(6);
    } 
    // 3. Naked Subfolder Interception (legacy support for core/, library/, etc.)
    else if (!sourceArg) {
        const normalized = f.replace(/\\/g, '/').toLowerCase();
        
        const applyPrefixFix = (targetId: FileTarget, prefix: string, len: number) => {
            target = targetId;
            f = f.substring(len);
            if (config?.folderPaths?.[targetId]) {
                const staticP = config.folderPaths[targetId].replace(/\\/g, '/').toLowerCase();
                if (!staticP.endsWith(`/${prefix}`) && !staticP.endsWith(`\\${prefix}`)) {
                    f = `${prefix}/` + f;
                }
            }
        };

        if (normalized.startsWith('library/')) {
            applyPrefixFix('extra', 'library', 8);
        } else if (normalized === 'library') {
            target = 'extra';
            f = '';
        } else if (normalized.startsWith('core/')) {
            applyPrefixFix('core', 'core', 5);
        } else if (normalized === 'core') {
            target = 'core';
            f = '';
        } else if (normalized.startsWith('commands/')) {
            applyPrefixFix('tools', 'commands', 9);
        } else if (normalized === 'commands') {
            target = 'tools';
            f = '';
        } else if (normalized.startsWith('workspace/')) {
            applyPrefixFix('workSpace', 'workspace', 10);
        } else if (normalized === 'workspace') {
            target = 'workSpace';
            f = '';
        }
    } else if (sourceArg) {
        target = resolveSource(sourceArg);
    }

    return { target, cleanFilename: f };
}

export function resolveSource(source?: string): FileTarget {
    if (!source) return 'workSpace';
    const s = source.toLowerCase().trim();
    if (s === 'core' || s === 'nucleo' || s === 'núcleo' || s === 'identidad') return 'core';
    if (s === 'library' || s === 'extra' || s === 'biblioteca' || s === 'librería' || s === 'libreria' || s === 'adicional') return 'extra';
    if (s === 'tools' || s === 'herramientas' || s === 'scripts' || s === 'commands') return 'tools';
    if (s === 'root' || s === 'maestra' || s === 'principal' || s === 'base') return 'root';
    if (s === 'workspace' || s === 'trabajo' || s === 'local' || s === 'sandbox') return 'workSpace';
    return 'workSpace';
}

export function getFileStore(
    target: FileTarget,
    files: Record<string, string>,
    additionalFiles: Record<string, string>,
    workSpaceFiles: Record<string, string>,
    toolsFiles: Record<string, string>,
    rootFiles: Record<string, string>
): Record<string, string> {
    switch (target) {
        case 'core': return files;
        case 'extra': return additionalFiles;
        case 'workSpace': return workSpaceFiles;
        case 'tools': return toolsFiles;
        case 'root': return rootFiles;
    }
}

export function getRelativePath(target: FileTarget, filename: string): string {
    const map: Record<FileTarget, string> = {
        core: '@CORE',
        extra: '@LIBRARY',
        workSpace: '@WORKSPACE',
        tools: '@TOOLS',
        root: '@ROOT'
    };
    // Ensure filename doesn't start with a slash
    const cleanFn = filename.startsWith('/') || filename.startsWith('\\') ? filename.slice(1) : filename;
    return `${map[target]}/${cleanFn}`;
}

/**
 * Extracts specific tool instructions from TOOLS.md content.
 */
export function extractToolInstructions(tn: string, toolsContent: string): string {
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
