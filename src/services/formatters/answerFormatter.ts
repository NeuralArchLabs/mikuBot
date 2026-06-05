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
/**
 * Extracts and protects fenced code blocks while respecting nested code blocks of the same fence.
 */
function protectFencedCodeBlocks(text: string, pieces: string[]): string {
    const lines = text.split('\n');
    const processedLines: string[] = [];

    let inBlock = false;
    let fenceChar = '';
    let fenceLen = 0;
    let blockLang = '';
    let blockLines: string[] = [];
    let innerDepth = 0; // Only used for markdown blocks

    // Markdown blocks can contain nested ```lang...``` examples as content.
    // We track them with innerDepth instead of treating them as block boundaries.
    const isMdBlock = (lang: string) =>
        lang === 'markdown' || lang === 'md' || lang === 'mdx';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(/^([ \t]*)(`{3,}|~{3,})([^\s`~]*)(.*)$/);

        if (match) {
            const char = match[2][0];
            const len  = match[2].length;
            const lang = match[3].trim();
            const rest = match[4].trim();

            if (!inBlock) {
                // ── Open outer block ──────────────────────────────────────
                inBlock    = true;
                fenceChar  = char;
                fenceLen   = len;
                blockLang  = lang.toLowerCase();
                innerDepth = 0;
                blockLines = [line];

            } else if (isMdBlock(blockLang)) {
                // ── Inside a markdown block ───────────────────────────────
                // Backticks + language → open inner block
                if (lang !== '' || rest !== '') {
                    innerDepth++;
                    blockLines.push(line);
                } else if (char === fenceChar && len >= fenceLen) {
                    // Bare fence
                    blockLines.push(line);
                    if (innerDepth > 0) {
                        innerDepth--; // closes an inner block
                    } else {
                        // closes the outer markdown block
                        const id = `___PROTECTED_BLOCK_${pieces.length}___`;
                        pieces.push(blockLines.join('\n'));
                        processedLines.push(`\n${id}\n`);
                        inBlock = false;
                    }
                } else {
                    blockLines.push(line);
                }

            } else {
                // ── Inside a regular (non-markdown) block ─────────────────
                blockLines.push(line);
                if (char === fenceChar && len >= fenceLen && lang === '' && rest === '') {
                    const id = `___PROTECTED_BLOCK_${pieces.length}___`;
                    pieces.push(blockLines.join('\n'));
                    processedLines.push(`\n${id}\n`);
                    inBlock = false;
                }
            }

        } else {
            if (inBlock) {
                // For regular blocks only: force-close on a bare heading/divider.
                // This heals responses where the AI forgot the closing fence.
                // Markdown blocks intentionally contain headings → never force-close them.
                if (!isMdBlock(blockLang) && innerDepth === 0) {
                    const t = line.trim();
                    if (/^#{1,3}\s/.test(t) || /^---$/.test(t)) {
                        const id = `___PROTECTED_BLOCK_${pieces.length}___`;
                        pieces.push(blockLines.join('\n'));
                        processedLines.push(`\n${id}\n`);
                        inBlock = false;
                        processedLines.push(line);
                        continue;
                    }
                }
                blockLines.push(line);
            } else {
                processedLines.push(line);
            }
        }
    }

    // Catch any block that reached end-of-text without a closing fence
    if (inBlock) {
        const id = `___PROTECTED_BLOCK_${pieces.length}___`;
        pieces.push(blockLines.join('\n'));
        processedLines.push(`\n${id}\n`);
    }

    return processedLines.join('\n');
}

export function formatFinalResponse(rawText: any): string {
    if (!rawText) return '';

    let formatted = typeof rawText === 'string' ? rawText : JSON.stringify(rawText, null, 2);

    // 1. Normalize line endings
    formatted = formatted.replace(/\r\n/g, '\n');
    formatted = formatted.replace(/\r/g, '\n'); // Standalone \r safety

    // --- PHASE 1: ASSET PROTECTION (BLOCKS) ---
    // Extract and protect blocks that should NEVER be affected by generic unescaping logic (\n, \t)
    const pieces: string[] = [];
    
    // 2a. Fenced Code Blocks (nested-aware)
    formatted = protectFencedCodeBlocks(formatted, pieces);

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

    // 2c. Iframe Protection (Prevents attribute corruption during JSON unescaping)
    formatted = formatted.replace(/<iframe[\s\S]*?<\/iframe>/gi, (match) => {
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
    // This handles edge cases where the loop might miss some placeholders due to
    // text mutations between protection and restoration phases.
    formatted = formatted.replace(/___PROTECTED_BLOCK_(\d+)___/g, (match, idxStr) => {
        const idx = parseInt(idxStr, 10);
        if (idx >= 0 && idx < pieces.length) {
            return pieces[idx];
        }
        return ''; // Remove orphaned placeholders
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

    // 7. Standardize horizontal rules to a consistent format (---)
    formatted = formatted.replace(/^\s*[-*_]{3,}\s*$/gm, '---');

    // 8. Filter leading/trailing dividers (cleaner UI)
    formatted = formatted.replace(/^\s*---\s*\n/i, '');
    formatted = formatted.replace(/\n\s*---\s*$/i, '');

    // 9. Standardize bibliography spacing if the marker was detected
    formatted = formatted.replace(/---\s*\n+\*\*🧠 Bibliografía y Contexto:\*\*/g, '---\n\n**🧠 Bibliografía y Contexto:**');

    // 10. Defensive Deduplication: Fix massive duplication from AI stream/filtering bugs
    const linesArr = formatted.split('\n');
    const uniqueLines: string[] = [];
    for (let i = 0; i < linesArr.length; i++) {
        const line = linesArr[i];
        if (line.trim() && line === linesArr[i+1]) {
            // Do NOT deduplicate lines that consist only of HTML tags (e.g. nested </div>) or code fences (e.g. nested ```)
            const isHtmlTag = /^\s*<\/?([a-zA-Z0-9-]+)(?:\s[^>]*)?>\s*$/.test(line);
            const isCodeFence = /^\s*(`{3,}|~{3,})\s*$/.test(line);
            if (!isHtmlTag && !isCodeFence) {
                // Skip if next line is exactly the same
                continue;
            }
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
