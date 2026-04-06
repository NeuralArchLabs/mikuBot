/**
 * ──────────────────────────────────────────────────────────────────────
 *  Text Normalizer — Cleanup and Preprocessing
 * ──────────────────────────────────────────────────────────────────────
 *
 *  This module normalizes raw text from the model by:
 *  - Fixing line endings and escaped characters
 *  - Cleaning technical noise (Tool Calls, role tags, JSON artifacts)
 *  - Replacing markdown horizontal rules with markers
 *  - Healing malformed tables (missing headers)
 * ──────────────────────────────────────────────────────────────────────
 */

/**
 * Normalizes raw text from the model for rendering.
 * This is the SINGLE SOURCE for text normalization.
 */
export function formatFinalResponse(rawText: any): string {
    if (!rawText) return '';

    let formatted = typeof rawText === 'string' ? rawText : JSON.stringify(rawText, null, 2);

    // 1. Normalize line endings
    formatted = formatted.replace(/\r\n/g, '\n');

    // 2. Unescape literal \n strings
    formatted = formatted.replace(/\\n/g, '\n');

    // 3. Fix double escaping
    formatted = formatted.replace(/\\t/g, '    ');
    formatted = formatted.replace(/\\"/g, '"');

    // 4. Trim trailing whitespace
    formatted = formatted.split('\n').map(line => line.trimEnd()).join('\n');

    // 5. Clean technical noise (Tool Calls, role tags, JSON artifacts)
    formatted = formatted.replace(/^(?:Tool Calls|Llamadas a Herramientas)[:\s]*\[[\s\S]*?\]/gim, '');
    formatted = formatted.replace(/^(?:Tool Calls|Llamadas a Herramientas)[:\s]*/gim, '\n');
    formatted = formatted.replace(/^\[\s*\{\s*"id":\s*"[^"]+",\s*"function":\s*\{[\s\S]*?\}\s*\}\s*\]/gim, '');
    formatted = formatted.replace(/^(?:\[assistant\]|\[tool\]|\[user\]|\[system\])[:\s]*/gim, '');
    formatted = formatted.replace(/^(?:\{"success":true,"data":.*\}|\[tool\].*)$/gim, '');

    // 6. Heal malformed tables (add generic header if missing)
    formatted = healMalformedTables(formatted);

    // 7. Replace horizontal rules with marker (---, ***, ___)
    formatted = formatted.replace(/^\s*[-*_]{3,}\s*$/gm, '---DIVIDER---');

    // 8. Filter leading/trailing dividers (cleaner UI)
    formatted = formatted.replace(/^\s*---DIVIDER---\s*\n/i, '');
    formatted = formatted.replace(/\n\s*---DIVIDER---\s*$/i, '');

    // 9. Standardize bibliography spacing if the marker was detected
    formatted = formatted.replace(/---DIVIDER---\s*\n+\*\*🧠 Bibliografía y Contexto:\*\*/g, '---DIVIDER---\n\n**🧠 Bibliografía y Contexto:**');

    // 10. Defensive Deduplication: Fix massive duplication from AI stream/filtering bugs
    const linesArr = formatted.split('\n');
    const uniqueLines: string[] = [];
    for (let i = 0; i < linesArr.length; i++) {
        const line = linesArr[i];
        if (line.trim() && line === linesArr[i+1]) {
            // Skip if next line is exactly the same
            continue;
        }
        uniqueLines.push(line);
    }
    formatted = uniqueLines.join('\n');

    return formatted.trim();

}

/**
 * Detects and heals malformed tables that start with a separator line.
 * Adds a generic header if the table starts directly with the separator.
 */
function healMalformedTables(text: string): string {
    const lines = text.split('\n');
    const healedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Detect table separator pattern (e.g., ---|---|---)
        const isSeparator = line.includes('|') && /^[|\s\-:]{3,}$/.test(line);

        if (isSeparator) {
            const prev = healedLines[healedLines.length - 1]?.trim() || '';
            const isPrevTableRow = prev.includes('|') && !/^[|\s\-:]{3,}$/.test(prev);

            if (!isPrevTableRow) {
                // Prepend generic header before the separator
                healedLines.push('| Descripción | Estado | Resultado |');
            }
        }
        healedLines.push(lines[i]);
    }

    return healedLines.join('\n');
}
