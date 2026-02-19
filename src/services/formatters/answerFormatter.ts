/**
 * ──────────────────────────────────────────────────────────────────────
 *  Final Answer Formatter — Context Injection & Cleanup Script
 * ──────────────────────────────────────────────────────────────────────
 * 
 *  This script is independent of the main agent logic. It is specifically
 *  designed to catch and format the "final_answer" response from the model,
 *  ensuring that newlines (\n), markdown artifacts, and escaped characters
 *  are rendered correctly in the UI.
 * ──────────────────────────────────────────────────────────────────────
 */

/**
 * Formats the final response text to ensure proper rendering of newlines and markdown.
 * Specifically targets artifacts common in local LLM tool outputs.
 */
export function formatFinalResponse(rawText: string): string {
    if (!rawText) return '';

    let formatted = rawText;

    // 1. Normalize line endings (Handle Windows \r\n and ensure they are just \n)
    formatted = formatted.replace(/\r\n/g, '\n');

    // 2. Unescape literal \n strings if they escaped double-parsing
    // Handle both \\n and literal \n artifacts from some local models
    formatted = formatted.replace(/\\n/g, '\n');

    // 3. Fix double escaping of quotes and tabs
    formatted = formatted.replace(/\\t/g, '    ');
    formatted = formatted.replace(/\\"/g, '"');

    // 4. Ensure clear separation before lists or headers if missing
    // If we see a line ending in text immediately followed by a list or header, add a newline
    formatted = formatted.replace(/([^\n])\n(?=[-*+]\s|#|\d+\.)/g, '$1\n\n');

    // 5. Remove extra surrounding quotes and trim
    formatted = formatted.trim();
    if (formatted.startsWith('"') && formatted.endsWith('"')) {
        formatted = formatted.slice(1, -1);
        formatted = formatted.trim();
    }

    return formatted;
}
