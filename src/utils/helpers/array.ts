/**
 * Array Helpers
 * Array manipulation utilities
 */

/**
 * Deep merges two objects
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
    const output = { ...target };
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key as keyof T])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key as keyof T] });
                } else {
                    output[key as keyof T] = deepMerge(target[key as keyof T] as any, source[key as keyof T] as any);
                }
            } else {
                Object.assign(output, { [key]: source[key as keyof T] });
            }
        });
    }
    return output;
}

/**
 * Flattens nested object to dot notation
 */
export function flattenObject(obj: Record<string, any>, prefix = '', result: Record<string, any> = {}): Record<string, any> {
    Object.keys(obj).forEach(key => {
        const newKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            flattenObject(value, newKey, result);
        } else {
            result[newKey] = value;
        }
    });
    return result;
}

/**
 * Returns unique values from array
 */
export function unique<T>(arr: T[]): T[] {
    return Array.from(new Set(arr));
}

/**
 * Groups array items by key
 */
export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
    return arr.reduce((result, item) => {
        (result[item[key] as string] = result[item[key] as string] || []).push(item);
        return result;
    }, {} as Record<string, T[]>);
}

/**
 * Checks if value is an object
 */
function isObject(item: any): item is Record<string, any> {
    return item && typeof item === 'object' && !Array.isArray(item);
}
