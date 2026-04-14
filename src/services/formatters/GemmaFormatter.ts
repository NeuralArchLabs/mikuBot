/**
 * ──────────────────────────────────────────────────────────────────────
 *  Gemma Formatter — Specialized for Gemma Models
 * ──────────────────────────────────────────────────────────────────────
 *
 *  This formatter:
 *  - Applies standard text normalization
 *  - Suppresses duplicate responses (Gemma-specific behavior)
 *  - Cleans up artifacts common in Gemma outputs
 * ──────────────────────────────────────────────────────────────────────
 */

import { IFormatter } from './IFormatter';

/**
 * Heals malformed tables that start with a separator line.
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

/**
 * Gemma-specific formatter with double response suppression.
 */
export class GemmaFormatter implements IFormatter {
    format(rawText: any): string {
        if (!rawText) return '';

        let formatted = typeof rawText === 'string' ? rawText : JSON.stringify(rawText, null, 2);

        // 1. Normalize line endings
        formatted = formatted.replace(/\r\n/g, '\n');
        formatted = formatted.replace(/\r/g, '\n'); // Standalone \r safety

        // --- PHASE 1: ASSET PROTECTION (BLOCKS) ---
        // Extract and protect blocks that should NEVER be affected by generic unescaping logic (\n, \t)
        const pieces: string[] = [];
        
        // 2a. Fenced Code Blocks
        formatted = formatted.replace(/^(`{3,}|~{3,})([\w./+#-]*)[\t ]*\n([\s\S]*?)\n\s*\1/gm, (match) => {
            const id = `___PROTECTED_BLOCK_${pieces.length}___`;
            pieces.push(match);
            return `\n${id}\n`;
        });

        // 2b. Math Blocks ($$, \[, \()
        formatted = formatted.replace(/\$\$[\s\S]*?\$\$/g, (match) => {
            const id = `___PROTECTED_BLOCK_${pieces.length}___`;
            pieces.push(match);
            return id;
        });
        formatted = formatted.replace(/\\\[[\s\S]*?\\\]/g, (match) => {
            const id = `___PROTECTED_BLOCK_${pieces.length}___`;
            pieces.push(match);
            return id;
        });
        formatted = formatted.replace(/\\\([\s\S]*?\\\)/g, (match) => {
            const id = `___PROTECTED_BLOCK_${pieces.length}___`;
            pieces.push(match);
            return id;
        });

        // --- PHASE 2: NORMALIZATION (TEXT ONLY) ---
        // 2. Unescape literal \n strings (standard result of JSON-based streaming)
        formatted = formatted.replace(/\\n/g, '\n');

        // 3. Selective unescaping (ONLY if not part of a technical command)
        // We only unescape \t if it's NOT likely a LaTeX command or part of a path
        formatted = formatted.replace(/\\t/g, '    ');
        formatted = formatted.replace(/\\"/g, '"');

        // --- PHASE 3: RE-INJECTION ---
        for (let i = 0; i < pieces.length; i++) {
            // Fix: Use replacer function to prevent String.prototype.replace from eating $ signs
            formatted = formatted.replace(`___PROTECTED_BLOCK_${i}___`, () => pieces[i]);
        }

        // --- PHASE 3.5: SAFETY NET ---
        // Regex-based catch-all for any placeholders that survived the sequential loop.
        formatted = formatted.replace(/___PROTECTED_BLOCK_(\d+)___/g, (match, idxStr) => {
            const idx = parseInt(idxStr, 10);
            if (idx >= 0 && idx < pieces.length) {
                return pieces[idx];
            }
            return '';
        });

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

        // 10. Gemma-Specific: Defensive Deduplication
        // Suppresses duplicate responses (common Gemma behavior)
        const linesArr = formatted.split('\n');
        const uniqueLines: string[] = [];
        for (let i = 0; i < linesArr.length; i++) {
            const line = linesArr[i];
            if (line.trim() && line === linesArr[i+1]) {
                // Skip if next line is exactly the same (double response suppression)
                continue;
            }
            uniqueLines.push(line);
        }
        formatted = uniqueLines.join('\n');

        return formatted.trim();
    }
}
