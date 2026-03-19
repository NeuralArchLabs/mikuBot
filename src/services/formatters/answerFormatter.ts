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

    // 5. Suppress literal "Tool Calls", role tags, and technical noise
    formatted = formatted.replace(/Tool Calls:\s*\[[\s\S]*?\]/gi, '');
    formatted = formatted.replace(/(?:^|\n)Tool Calls[:\s]*/gi, '\n');
    formatted = formatted.replace(/\[\s*\{\s*"id":[\s\S]*?\}\s*\]/gi, '');
    formatted = formatted.replace(/^(?:\[assistant\]|\[tool\]|\[user\]|\[system\])[:\s]*/gim, '');
    formatted = formatted.replace(/^(?:\{"success":true,"data":.*\}|\[tool\].*)$/gim, '');

    // 6. TABLE HEALING: If a table starts with a separator line (---|---), prepend a generic header
    // to ensure valid markdown rendering.
    const lines = formatted.split('\n');
    const healedLines: string[] = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Detects common table separator patterns (e.g. ---|---|--- or :---|---:)
        const isSeparator = line.includes('|') && /^[|\s\-:]{3,}$/.test(line);
        
        if (isSeparator) {
            const prev = healedLines[healedLines.length - 1]?.trim() || '';
            const isPrevTableRow = prev.includes('|') && !/^[|\s\-:]{3,}$/.test(prev);
            
            if (!isPrevTableRow) {
                healedLines.push('| Descripción | Estado | Resultado |'); // Prepend Header
            }
        }
        healedLines.push(lines[i]);
    }
    formatted = healedLines.join('\n');

    // 9. Replace thematic breaks (---) with styled visual separators
    // Replace standalone --- with a styled div marker that will be processed by the renderer
    formatted = formatted.replace(/^\s*[-*_]{3,}\s*$/gm, '---DIVIDER---');

    // 10. Filter out thematic noise (strip leading/trailing separators)
    formatted = formatted.replace(/^\s*---DIVIDER---\s*\n/i, '');
    formatted = formatted.replace(/\n\s*---DIVIDER---\s*$/i, '');

    // 11. Refine bibliography spacing
    formatted = formatted.replace(/\n*\n---\n\n\*\*🧠 Bibliografía y Contexto:\*\*/g, '\n\n---DIVIDER---\n\n**🧠 Bibliografía y Contexto:**');

    return formatted.trim();
}
