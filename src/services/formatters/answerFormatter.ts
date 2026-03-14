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
export function formatFinalResponse(rawText: any): string {
    if (!rawText) return '';

    let formatted = typeof rawText === 'string' ? rawText : JSON.stringify(rawText, null, 2);

    // 1. Normalize line endings (Handle Windows \r\n and ensure they are just \n)
    formatted = formatted.replace(/\r\n/g, '\n');

    // 2. Unescape literal \n strings if they escaped double-parsing
    formatted = formatted.replace(/\\n/g, '\n');

    // 3. Fix double escaping of quotes and tabs
    formatted = formatted.replace(/\\t/g, '    ');
    formatted = formatted.replace(/\\"/g, '"');

    // 4. Clean up trailing whitespace on each line and handle stray spaces between newlines
    formatted = formatted.split('\n').map(line => line.trimEnd()).join('\n');

    // 5. Collapse excessive vertical space (more than 2 newlines -> 2 newlines)
    // This now handles cases with spaces between the newlines (e.g., \n  \n\n)
    formatted = formatted.replace(/\n\s*\n\s*\n+/g, '\n\n');

    // 6. Ensure exactly one blank line before lists or headers if they are preceded by text
    // Fixed: Avoid adding newlines if already present
    formatted = formatted.replace(/([^\n])\n(?=[-*+]\s|#|\d+\.)/g, '$1\n\n');

    // 7. Filter out noise artifacts (like trailing *** or ---) that some models add
    formatted = formatted.split('\n')
        .filter(line => {
            const trimmed = line.trim();
            if (trimmed === '***' || trimmed === '---' || (trimmed.length === 1 && (trimmed === '*' || trimmed === '-' || trimmed === '_'))) {
                return false;
            }
            return true;
        })
        .join('\n');

    return formatted.trim();
}
