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

    // 1. Unescape literal \n strings if they escaped double-parsing
    // Sometimes local models output "\\n" or "\n" as literal text inside the JSON string
    formatted = formatted.replace(/\\n/g, '\n');

    // 2. Fix literal \t or other common escapes that might leak
    formatted = formatted.replace(/\\t/g, '    ');
    formatted = formatted.replace(/\\"/g, '"');

    // 3. Ensure double newlines for markdown paragraphs if they are smashed
    // (Only if they aren't already followed by a newline)
    // formatted = formatted.replace(/([^\n])\n([^\n])/g, '$1\n\n$2'); 
    // ^ This might be too aggressive, let's stick to cleaning artifacts for now.

    // 4. Remove extra surrounding quotes that might have been captured by sloppy regex
    formatted = formatted.trim();
    if (formatted.startsWith('"') && formatted.endsWith('"')) {
        formatted = formatted.slice(1, -1);
    }

    return formatted;
}
