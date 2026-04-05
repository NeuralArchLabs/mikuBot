/**
 * String Helpers
 * String manipulation utilities
 */

/**
 * Truncates string to max length
 */
export function truncate(str: string, maxLength: number, suffix = '...'): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Converts string to slug
 */
export function slugify(str: string): string {
    return str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Capitalizes first letter
 */
export function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Converts string to camelCase
 */
export function camelCase(str: string): string {
    return str
        .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
        .replace(/^(.)/, c => c.toLowerCase());
}

/**
 * Escapes special regex characters
 */
export function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
