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
