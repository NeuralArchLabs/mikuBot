/**
 * Error Helpers
 * Error handling and formatting utilities
 */

/**
 * Creates a custom error with additional context
 */
export function createError(message: string, code?: string, details?: any): Error {
    const error = new Error(message) as any;
    if (code) error.code = code;
    if (details) error.details = details;
    return error;
}

/**
 * Formats error for display
 */
export function formatError(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return String(error);
}

/**
 * Checks if value is an error
 */
export function isError(value: unknown): value is Error {
    return value instanceof Error;
}
