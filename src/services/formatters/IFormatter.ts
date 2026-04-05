/**
 * ──────────────────────────────────────────────────────────────────────
 *  IFormatter — Strategy Pattern Interface
 * ──────────────────────────────────────────────────────────────────────
 *
 *  Base interface for response formatters.
 *  Each formatter implements specific logic for different models or outputs.
 * ──────────────────────────────────────────────────────────────────────
 */

export interface IFormatter {
    /**
     * Formats raw text from the model for rendering.
     * @param rawText - The raw text from the model (can be string or object)
     * @returns The formatted text ready for display
     */
    format(rawText: any): string;
}

/**
 * Formatter type enum for runtime selection
 */
export enum FormatterType {
    GEMMA = 'gemma',
    TELEGRAM = 'telegram',
    STANDARD = 'standard',
}
