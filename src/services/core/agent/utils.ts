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

    // 1. Prefix Detection (Highest Priority)
    if (f.toUpperCase().startsWith('@CORE/')) {
        target = 'core';
        f = f.slice(6);
    } else if (f.toUpperCase().startsWith('@EXTRA/')) {
        target = 'extra';
        f = f.slice(7);
    } else if (f.toUpperCase().startsWith('@LIBRARY/')) {
        target = 'extra';
        f = f.slice(9);
    } else if (f.toUpperCase().startsWith('@WORKSPACE/')) {
        target = 'workSpace';
        f = f.slice(11);
    } else if (f.toUpperCase().startsWith('@SANDBOX/')) { // Backwards compat
        target = 'workSpace';
        f = f.slice(9);
    } else if (f.toUpperCase().startsWith('@TOOLS/')) {
        target = 'tools';
        f = f.slice(7);
    } 
    // 1.5 Naked Prefix Interception (Fallback for when agents don't explicitly pass source or @)
    else if (!sourceArg) {
        const normalized = f.replace(/\\/g, '/').toLowerCase();
        
        const applyPrefixFix = (targetId: FileTarget, prefix: string, len: number) => {
            target = targetId;
            f = f.substring(len);
            // If the user's folderPaths configuration does not naturally end with this subfolder,
            // we must prepended it back to prevent files dumping into the root workspace!
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
    }
    
    // 2. Absolute Path Detection (via config)
    else if (config?.folderPaths) {
        const paths = config.folderPaths;
        const normalizedF = f.replace(/\\/g, '/').toLowerCase();
        
        let found = false;
        // Priority: core > tools > workSpace > extra
        const targets: FileTarget[] = ['core', 'tools', 'workSpace', 'extra'];
        for (const t of targets) {
            const p = paths[t];
            if (p) {
                const normalizedP = p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
                if (normalizedF.startsWith(normalizedP + '/')) {
                    target = t;
                    f = f.substring(p.length).replace(/^[/\\]+/, '');
                    found = true;
                    break;
                }
            }
        }

        // 3. Fallback to sourceArg if no absolute path found
        if (!found && sourceArg) {
            target = resolveSource(sourceArg);
        }
    }
    // 4. Minimal Fallback
    else if (sourceArg) {
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
    if (s === 'workspace' || s === 'trabajo' || s === 'local' || s === 'sandbox') return 'workSpace';
    return 'workSpace';
}

export function getFileStore(
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

export function getRelativePath(target: FileTarget, filename: string): string {
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
