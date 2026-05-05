/**
 * Path Helpers
 * Path manipulation utilities
 */

/**
 * Joins path segments
 */
export function joinPaths(...segments: string[]): string {
    return segments
        .join('/')
        .replace(/\/+/g, '/');
}

/**
 * Normalizes path by removing redundant segments
 */
export function normalizePath(path: string): string {
    return path
        .replace(/\/+/g, '/')
        .replace(/\/\.\//g, '/')
        .replace(/\/\.$/, '');
}

/**
 * Gets file extension from path
 */
export function getExtension(path: string): string {
    const ext = path.split('.').pop();
    return ext ? `.${ext}` : '';
}

/**
 * Gets filename without extension
 */
export function getBaseName(path: string): string {
    return path.split('/').pop()?.split('.')[0] || '';
}

/**
 * Obfuscates system paths with symbolic markers like @ROOT
 */
export function obfuscatePaths(text: string, rootPath?: string): string {
    if (!text || !rootPath) return text;
    const escapedRoot = rootPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rootRegex = new RegExp(escapedRoot, 'gi');
    return text.replace(rootRegex, '@ROOT');
}
