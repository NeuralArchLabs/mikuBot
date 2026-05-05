/**
 * ──────────────────────────────────────────────────────────────────────
 *  Telegram Formatter — Markdown/HTML to Telegram-compatible HTML
 * ──────────────────────────────────────────────────────────────────────
 *
 *  8-phase pipeline that handles ALL elements the UI formatter manages,
 *  converting them to safe Telegram HTML.
 *
 *  Telegram supports ONLY these tags (no nesting of different types):
 *  <b>, <i>, <u>, <s>, <code>, <pre>, <a href="...">,
 *  <blockquote>, <tg-spoiler>, <tg-emoji emoji-id="...">
 *
 *  Pipeline order:
 *  0. Normalization (formatFinalResponse)
 *  1. Pre-protection block extraction (code, math, images, etc.)
 *  2. Raw HTML tag processing (map to TG tags or strip)
 *  3. Table processing (ASCII grid or vertical cards)
 *  4. Markdown → Telegram HTML conversion (all elements)
 *  5. HTML escaping + restore Telegram tags
 *  6. Placeholder restoration
 *  7. Nesting flattening safety net
 *  8. Restore escaped characters
 * ──────────────────────────────────────────────────────────────────────
 */

import { IFormatter } from './IFormatter';
import { formatFinalResponse } from './answerFormatter';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

/** Emoji shortcode map — mirrors formatting.ts EMOJI_MAP */
const EMOJI_MAP: Record<string, string> = {
    smile: '😊', grin: '😁', joy: '😂', heart: '❤️', fire: '🔥',
    rocket: '🚀', thumbsup: '👍', thumbsdown: '👎', star: '⭐', eyes: '👀',
    warning: '⚠️', check: '✅', cross: '❌', tada: '🎉', clap: '👏',
    bulb: '💡', gear: '⚙️', bug: '🐛', zap: '⚡', lock: '🔒',
    unlock: '🔓', key: '🔑', globe: '🌍', wave: '👋', muscle: '💪',
    brain: '🧠', robot: '🤖', sparkles: '✨', rainbow: '🌈', moon: '🌙',
    sun: '☀️', snowflake: '❄️', crown: '👑', diamond: '💎', sword: '⚔️',
    shield: '🛡️', target: '🎯', chart: '📊', code: '💻', book: '📚',
    pencil: '✏️', bell: '🔔', mail: '📧', phone: '📱', camera: '📷',
    clock: '🕐', calendar: '📅', pin: '📌', link: '🔗', search: '🔍',
    arrow_right: '→', arrow_left: '←', arrow_up: '↑', arrow_down: '↓',
    info: 'ℹ️', question: '❓', exclamation: '❗', red_circle: '🔴',
    yellow_circle: '🟡', green_circle: '🟢', blue_circle: '🔵',
};

/** Callout type → emoji for Telegram */
const CALLOUT_EMOJI: Record<string, string> = {
    'NOTE': 'ℹ️', 'TIP': '💡', 'IMPORTANT': '❗', 'WARNING': '⚠️',
    'CAUTION': '⚠️', 'DANGER': '🚨', 'INFO': 'ℹ️', 'SUCCESS': '✅',
    'FAILURE': '❌', 'BUG': '🐛', 'EXAMPLE': '📖', 'QUOTE': '💬',
    'QUESTION': '❓', 'FAQ': '❓', 'SECURITY': '🔒', 'TODO': '📋',
    'REMEMBER': '📌', 'CHECK': '✅', 'ABSTRACT': '📄',
};

/** Spanish callout type normalization */
const SPANISH_CALLOUT_MAP: Record<string, string> = {
    'ÉXITO': 'SUCCESS', 'EXITO': 'SUCCESS', 'EJEMPLO': 'EXAMPLE',
    'ERROR': 'FAILURE', 'PREGUNTA': 'QUESTION', 'PREGUNTAS': 'QUESTION',
    'SEGURIDAD': 'SECURITY', 'NOTA': 'NOTE', 'CONSEJO': 'TIP',
    'SUGERENCIA': 'TIP', 'AVISO': 'WARNING', 'ADVERTENCIA': 'WARNING',
    'PELIGRO': 'DANGER', 'ALERTA': 'DANGER', 'IMPORTANTE': 'IMPORTANT',
    'PRECAUCIÓN': 'CAUTION', 'PRECAUCION': 'CAUTION',
    'INFORMACIÓN': 'INFO', 'INFORMACION': 'INFO',
    'RECUERDA': 'REMEMBER', 'RECORDATORIO': 'REMEMBER',
    'PENDIENTE': 'TODO', 'TAREA': 'TODO', 'FRECUENTES': 'FAQ',
};

/** Emoji → callout type detection (for emoji-prefixed callouts) */
const EMOJI_CALLOUT_MAP: Record<string, string> = {
    '💡': 'TIP', '⚠️': 'WARNING', '📝': 'NOTE', '🔧': 'INFO', '🚨': 'DANGER',
    '✅': 'SUCCESS', '❌': 'FAILURE', '❓': 'QUESTION', '📖': 'EXAMPLE', '🔒': 'SECURITY',
    '⏳': 'TODO', '📌': 'REMEMBER', 'ℹ️': 'INFO', '🛡️': 'SECURITY', '🐛': 'BUG',
    '🔥': 'DANGER', '📢': 'IMPORTANT', '🎯': 'IMPORTANT', '✏️': 'NOTE',
    '🟢': 'SUCCESS', '🔴': 'DANGER', '🟡': 'WARNING', '🔵': 'INFO',
};

/** HTML tags that map directly to Telegram equivalents */
const HTML_TO_TG: Record<string, { tgTag: string; keepAttrs: string[] }> = {
    'strong':   { tgTag: 'b', keepAttrs: [] },
    'em':       { tgTag: 'i', keepAttrs: [] },
    'b':        { tgTag: 'b', keepAttrs: [] },
    'i':        { tgTag: 'i', keepAttrs: [] },
    'u':        { tgTag: 'u', keepAttrs: [] },
    'ins':      { tgTag: 'u', keepAttrs: [] },
    's':        { tgTag: 's', keepAttrs: [] },
    'strike':   { tgTag: 's', keepAttrs: [] },
    'del':      { tgTag: 's', keepAttrs: [] },
    'code':     { tgTag: 'code', keepAttrs: [] },
    'pre':      { tgTag: 'pre', keepAttrs: [] },
    'a':        { tgTag: 'a', keepAttrs: ['href'] },
    'blockquote': { tgTag: 'blockquote', keepAttrs: [] },
};

/** Tags that become bold in Telegram (headers, etc.) */
const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

/** All known HTML tag names (for detection) */
const ALL_HTML_TAGS = [
    'figcaption', 'blockquote', 'fieldset', 'progress', 'textarea', 'summary',
    'datalist', 'colgroup', 'optgroup', 'noscript', 'template',
    'details', 'section', 'article', 'caption', 'dialog', 'figure', 'footer',
    'header', 'legend', 'center', 'button', 'canvas', 'iframe', 'output',
    'select', 'source', 'strong', 'address', 'picture', 'acronym',
    'aside', 'embed', 'input', 'label', 'meter', 'option', 'strike',
    'param', 'small', 'tbody', 'tfoot', 'thead', 'track', 'video', 'audio',
    'table', 'form', 'main', 'mark', 'math', 'time', 'data', 'ruby', 'slot',
    'code', 'cite', 'abbr', 'samp', 'span', 'area', 'base', 'link',
    'meta', 'nav', 'pre', 'div', 'del', 'dfn', 'ins', 'kbd', 'sub', 'sup',
    'var', 'wbr', 'col', 'img', 'bdo', 'big', 'map', 'svg', 'dd', 'dl',
    'dt', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'br', 'li',
    'ol', 'td', 'th', 'tr', 'ul', 'rt', 'rp', 'a', 'b', 'i', 'p', 'q', 's', 'u',
];

/** Valid Telegram HTML tags for the final restore step */
const TG_VALID_TAGS = ['b', 'i', 'u', 's', 'code', 'pre', 'blockquote', 'a', 'tg-spoiler', 'tg-emoji'];

// ═══════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Escapes HTML special characters for Telegram HTML context.
 */
function escapeTelegramHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Converts LaTeX math to readable plain-text for Telegram.
 */
function convertMathToTelegram(formula: string): string {
    let math = formula.trim();

    // Operators (sorted by key length, longest first)
    const ops: [string, string][] = [
        ['\\Leftrightarrow', '⇔'], ['\\leftrightarrow', '↔'],
        ['\\Rightarrow', '⇒'], ['\\Leftarrow', '⇐'],
        ['\\rightarrow', '→'], ['\\leftarrow', '←'],
        ['\\varepsilon_0', 'ε₀'], ['\\varepsilon', 'ε'],
        ['\\setminus', '∖'], ['\\emptyset', '∅'],
        ['\\partial', '∂'], ['\\approx', '≈'],
        ['\\propto', '∝'], ['\\equiv', '≡'],
        ['\\infty', '∞'], ['\\nabla', '∇'],
        ['\\notin', '∉'], ['\\subset', '⊂'], ['\\supset', '⊃'],
        ['\\times', '×'], ['\\cdots', '⋯'], ['\\vdots', '⋮'], ['\\ddots', '⋱'],
        ['\\cdot', '·'], ['\\sqrt', '√'], ['\\hbar', 'ℏ'],
        ['\\prod', 'Π'], ['\\oint', '∮'],
        ['\\neq', '≠'], ['\\leq', '≤'], ['\\geq', '≥'],
        ['\\cup', '∪'], ['\\cap', '∩'],
        ['\\sum', 'Σ'], ['\\int', '∫'],
        ['\\lim', 'lim'], ['\\det', 'det'], ['\\max', 'max'], ['\\min', 'min'],
        ['\\sup', 'sup'], ['\\inf', 'inf'], ['\\dim', 'dim'], ['\\ker', 'ker'],
        ['\\div', '÷'], ['\\pm', '±'], ['\\mp', '∓'],
        ['\\sim', '∼'], ['\\in', '∈'],
        ['\\exists', '∃'], ['\\forall', '∀'],
        ['\\quad', '    '], ['\\qquad', '        '],
    ];

    // Greek letters
    const greek: [string, string][] = [
        ['\\varphi', 'φ'], ['\\vartheta', 'ϑ'], ['\\varrho', 'ϱ'], ['\\varsigma', 'ς'],
        ['\\alpha', 'α'], ['\\beta', 'β'], ['\\gamma', 'γ'], ['\\delta', 'δ'],
        ['\\epsilon', 'ε'], ['\\zeta', 'ζ'], ['\\eta', 'η'], ['\\theta', 'θ'],
        ['\\iota', 'ι'], ['\\kappa', 'κ'], ['\\lambda', 'λ'], ['\\mu', 'μ'],
        ['\\nu', 'ν'], ['\\xi', 'ξ'], ['\\pi', 'π'], ['\\rho', 'ρ'],
        ['\\sigma', 'σ'], ['\\tau', 'τ'], ['\\upsilon', 'υ'], ['\\phi', 'φ'],
        ['\\chi', 'χ'], ['\\psi', 'ψ'], ['\\omega', 'ω'],
        ['\\Alpha', 'Α'], ['\\Beta', 'Β'], ['\\Gamma', 'Γ'], ['\\Delta', 'Δ'],
        ['\\Theta', 'Θ'], ['\\Lambda', 'Λ'], ['\\Pi', 'Π'], ['\\Sigma', 'Σ'],
        ['\\Phi', 'Φ'], ['\\Psi', 'Ψ'], ['\\Omega', 'Ω'],
    ];

    // Apply substitutions (longest first to prevent prefix collisions)
    for (const [latex, uni] of [...ops, ...greek]) {
        const escaped = latex.replace(/\\/g, '\\\\');
        math = math.replace(new RegExp(escaped, 'g'), uni);
    }

    // \text{...} → plain text
    math = math.replace(/\\text\{([^}]*)\}/g, '$1');
    math = math.replace(/\\mathrm\{([^}]*)\}/g, '$1');
    math = math.replace(/\\mathbf\{([^}]*)\}/g, '$1');
    math = math.replace(/\\operatorname\{([^}]*)\}/g, '$1');

    // Trig/log functions
    math = math.replace(/\\sin/g, 'sin').replace(/\\cos/g, 'cos')
        .replace(/\\tan/g, 'tan').replace(/\\log/g, 'log').replace(/\\ln/g, 'ln');

    // Subscripts and superscripts (simplified)
    math = math.replace(/_\{((?:[^{}]|\{[^{}]*\})*)\}/g, '_($1)');
    math = math.replace(/\^\{((?:[^{}]|\{[^{}]*\})*)\}/g, '^($1)');

    // Fractions: \frac{a}{b} → a/b
    math = math.replace(/\\frac\{((?:[^{}]|\{[^{}]*\})*)\}\{((?:[^{}]|\{[^{}]*\})*)\}/g, '($1)/($2)');

    // \left \right delimiters
    math = math.replace(/\\left[([|{.]/g, '').replace(/\\right[)\]|}.]/g, '');

    // Clean remaining LaTeX commands
    math = math.replace(/\\[a-zA-Z]+/g, ' ').replace(/\s{2,}/g, ' ');

    // Remove stray braces
    math = math.replace(/[{}]/g, '');

    return math.trim();
}

/**
 * Formats a table for Telegram mobile responsiveness.
 */
function formatTelegramTable(lines: string[]): string {
    const rows = lines.map(line =>
        line.split('|')
            .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
            .map(cell => cell.trim())
    );

    if (rows.length < 2) return '';

    const headers = rows[0];
    const data = rows.slice(1).slice(0, 10); // Limit 10 rows for Telegram
    const colWidths = headers.map((h, i) => Math.max(h.length, ...data.map(r => (r[i] || '').length)));
    const totalWidth = colWidths.reduce((a, b) => a + b, 0) + (colWidths.length * 3) + 1;

    // Narrow table: ASCII grid
    if (totalWidth < 35 && headers.length <= 3) {
        const formattedRows = rows.map(row =>
            '|' + row.map((cell, i) => (cell || '').padEnd(colWidths[i])).join('|') + '|'
        );
        const sep = '+' + colWidths.map(w => '-'.repeat(w)).join('+') + '+';
        return '<pre>' + escapeTelegramHtml([sep, formattedRows[0], sep, ...formattedRows.slice(1), sep].join('\n')) + '</pre>';
    }

    // Wide table: vertical cards
    const resultArr = data.map((row, rowIdx) => {
        const title = row[0] ? `<b>${escapeTelegramHtml(row[0].toUpperCase())}</b>` : `<b>Item ${rowIdx + 1}</b>`;
        const details = headers.map((h, i) => {
            if (i === 0) return null;
            const isLast = i === headers.length - 1;
            const branch = isLast ? '└──' : '├──';
            const content = row[i] || 'N/A';
            
            // 1. Escape content to prevent Telegram HTML parse errors
            const escaped = escapeTelegramHtml(content);

            // 2. Apply limited Telegram-supported HTML tags from markdown
            let formattedContent = escaped
                .replace(/\*\*([\s\S]*?)\*\*/g, '<b>$1</b>')
                .replace(/\*([\s\S]*?)\*/g, '<i>$1</i>')
                .replace(/~~([\s\S]*?)~~/g, '<s>$1</s>')
                .replace(/`([^`\n]+)`/g, '<code>$1</code>');

            const cleanContent = formattedContent.length > 600 ? formattedContent.substring(0, 597) + '...' : formattedContent;
            return `${branch} <i>${escapeTelegramHtml(h)}:</i> ${cleanContent}`;
        }).filter(Boolean).join('\n');

        return `${title}\n${details}`;
    });

    return resultArr.join('\n\n');
}

/**
 * Processes raw HTML tags in text: maps known to TG equivalents, strips unknown to text content.
 */
function processRawHtmlTags(text: string): string {
    let result = text;
    let safetyLimit = 5000;

    // Build regex pattern matching all known HTML tags
    const tagPattern = new RegExp(`<(${ALL_HTML_TAGS.join('|')})(?=\\s|>|/>)((?:[^>"']|"[^"]*"|'[^']*')*)?>`, 'gi');
    let searchCursor = 0;

    while (safetyLimit-- > 0) {
        tagPattern.lastIndex = searchCursor;
        const openMatch = tagPattern.exec(result);
        if (!openMatch) break;

        const startIdx = openMatch.index;
        const tagName = openMatch[1].toLowerCase();
        const attrs = openMatch[2] || '';
        const afterOpen = startIdx + openMatch[0].length;

        // Self-closing tags
        const selfClosing = ['img', 'br', 'hr', 'source', 'track', 'embed', 'param', 'area', 'base', 'col', 'link', 'meta', 'wbr', 'input'];
        if (selfClosing.includes(tagName) || openMatch[0].endsWith('/>')) {
            const replacement = tagName === 'br' ? '\n'
                : tagName === 'hr' ? '\n━━━━━━━━━━\n'
                : tagName === 'img' ? extractImgAlt(attrs)
                : '';
            result = result.substring(0, startIdx) + replacement + result.substring(afterOpen);
            searchCursor = startIdx + replacement.length;
            continue;
        }

        // Find closing tag
        const closeRe = new RegExp(`</${tagName}\\s*>`, 'gi');
        const openRe = new RegExp(`<${tagName}[\\s>]`, 'gi');
        let depth = 1;
        let cursor = afterOpen;
        let matchEnd = -1;

        while (depth > 0 && cursor < result.length) {
            openRe.lastIndex = cursor;
            closeRe.lastIndex = cursor;
            const nextOpen = openRe.exec(result);
            const nextClose = closeRe.exec(result);

            if (!nextClose) { matchEnd = afterOpen; break; }
            if (nextOpen && nextOpen.index < nextClose.index) {
                depth++;
                cursor = nextOpen.index + nextOpen[0].length;
            } else {
                depth--;
                if (depth === 0) {
                    matchEnd = nextClose.index + nextClose[0].length;
                } else {
                    cursor = nextClose.index + nextClose[0].length;
                }
            }
        }

        if (matchEnd === -1 || matchEnd === afterOpen) {
            // No closing tag found — strip the opening tag
            result = result.substring(0, startIdx) + result.substring(afterOpen);
            searchCursor = startIdx;
            continue;
        }

        // Find the actual closing tag length to be precise (it could have spaces like </div >)
        const closingTagMatch = result.substring(cursor).match(closeRe);
        const closingTagLength = closingTagMatch ? closingTagMatch[0].length : `</${tagName}>`.length;
        let innerContent = result.substring(afterOpen, matchEnd - closingTagLength);

        // Map to Telegram equivalent
        const mapping = HTML_TO_TG[tagName];
        const isHeading = HEADING_TAGS.includes(tagName);
        const isBlock = ['div', 'p', 'section', 'article', 'header', 'footer', 'main', 'aside', 'blockquote', 'details'].includes(tagName);

        if (isBlock || isHeading) {
            innerContent = innerContent.trim();
        }

        if (mapping) {
            const tgTag = mapping.tgTag;
            const keepAttrs = mapping.keepAttrs;
            let tgAttrs = '';
            let keepTag = true;
            if (keepAttrs.includes('href')) {
                const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
                if (hrefMatch) {
                    tgAttrs = ` href="${hrefMatch[1]}"`;
                } else {
                    // <a> without href — strip to text
                    keepTag = false;
                }
            }
            if (keepTag) {
                const openReplacement = `<${tgTag}${tgAttrs}>`;
                const replacement = `${openReplacement}${innerContent}</${tgTag}>`;
                result = result.substring(0, startIdx) + replacement + result.substring(matchEnd);
                searchCursor = startIdx + openReplacement.length;
            } else {
                result = result.substring(0, startIdx) + innerContent + result.substring(matchEnd);
                searchCursor = startIdx;
            }
        } else if (isHeading) {
            // Headers → bold
            const openReplacement = `<b>`;
            const replacement = `${openReplacement}${innerContent}</b>`;
            result = result.substring(0, startIdx) + replacement + result.substring(matchEnd);
            searchCursor = startIdx + openReplacement.length;
        } else if (tagName === 'br') {
            result = result.substring(0, startIdx) + '\n' + result.substring(matchEnd);
            searchCursor = startIdx + 1;
        } else if (tagName === 'p' || tagName === 'div' || tagName === 'section' || tagName === 'article' || tagName === 'main' || tagName === 'center') {
            // Block containers → keep inner text with newlines
            const replacement = '\n' + innerContent + '\n';
            result = result.substring(0, startIdx) + replacement + result.substring(matchEnd);
            searchCursor = startIdx + 1;
        } else if (tagName === 'li') {
            const openReplacement = '• ';
            result = result.substring(0, startIdx) + openReplacement + innerContent + result.substring(matchEnd);
            searchCursor = startIdx + openReplacement.length;
        } else if (tagName === 'ul' || tagName === 'ol') {
            result = result.substring(0, startIdx) + innerContent + result.substring(matchEnd);
            searchCursor = startIdx;
        } else {
            // All other tags: strip tag, keep inner text
            result = result.substring(0, startIdx) + innerContent + result.substring(matchEnd);
            searchCursor = startIdx;
        }
    }

    return result;
}

/** Extract alt text from img tag attributes */
function extractImgAlt(attrs: string): string {
    const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    const alt = altMatch ? altMatch[1] : '';
    const src = srcMatch ? srcMatch[1] : '';
    if (alt && src) return `🖼 ${alt}: ${src}`;
    if (src) return `🖼 ${src}`;
    if (alt) return `🖼 ${alt}`;
    return '';
}

/**
 * Repairs HTML hierarchy for Telegram:
 * 1. Ensures strict LIFO (Last In, First Out) tag closing.
 * 2. Prevents illegal nesting (Telegram doesn't allow any tags inside <code> or <pre>).
 * 3. Removes identical nested tags (<b><b>text</b></b> -> <b>text</b>).
 * 4. Ensures all tags are valid Telegram tags.
 */
function flattenNestedFormatting(html: string): string {
    const validTags = ['b', 'i', 'u', 's', 'code', 'pre', 'blockquote', 'a', 'tg-spoiler'];
    const stack: string[] = [];
    let result = '';
    
    // Tag regex including attributes for <a> tags
    const tagRegex = /<\/?([a-z0-9-]+)(?:\s+[^>]*?)?>/gi;
    let lastIdx = 0;
    let match;
    
    while ((match = tagRegex.exec(html)) !== null) {
        const fullTag = match[0];
        const tagName = match[1].toLowerCase();
        const isClosing = fullTag.startsWith('</');
        
        // Add text before the tag
        result += html.substring(lastIdx, match.index);
        lastIdx = tagRegex.lastIndex;
        
        if (!validTags.includes(tagName)) {
            continue; // Skip invalid tags
        }
        
        if (isClosing) {
            // Find matching tag in stack
            const stackIdx = stack.lastIndexOf(tagName);
            if (stackIdx !== -1) {
                // Close everything on top of the matching tag in reverse order
                while (stack.length > stackIdx) {
                    const topTag = stack.pop()!;
                    result += `</${topTag}>`;
                }
            }
        } else {
            // Opening tag
            
            // Telegram Rule: No nesting allowed inside <code> or <pre>
            if (stack.includes('code') || stack.includes('pre')) {
                continue; 
            }
            
            // Avoid identical nesting: <b><b>...</b></b> -> <b>...</b>
            if (stack.length > 0 && stack[stack.length - 1] === tagName) {
                continue;
            }
            
            stack.push(tagName);
            result += fullTag;
        }
    }
    
    // Add remaining text
    result += html.substring(lastIdx);
    
    // Close any tags left on the stack
    while (stack.length > 0) {
        const tag = stack.pop();
        result += `</${tag}>`;
    }
    
    return result;
}

/**
 * Converts blockquote lines (>) to Telegram <blockquote> blocks.
 * Accumulates consecutive > lines into a single block.
 */
function convertTelegramBlockquotes(text: string): string {
    const lines = text.split('\n');
    const output: string[] = [];
    let inQuote = false;
    let quoteLines: string[] = [];

    const flushQuote = () => {
        if (quoteLines.length > 0) {
            const content = quoteLines.join('\n');
            output.push(`<blockquote>${content}</blockquote>`);
            quoteLines = [];
        }
        inQuote = false;
    };

    for (const line of lines) {
        const quoteMatch = line.match(/^[ \t]*>\s?(.*)$/);
        if (quoteMatch) {
            inQuote = true;
            quoteLines.push(quoteMatch[1]);
        } else {
            if (inQuote) flushQuote();
            output.push(line);
        }
    }
    if (inQuote) flushQuote();

    return output.join('\n');
}

/**
 * Converts callout/admonition patterns to emoji + bold text for Telegram.
 * Handles: [!TYPE], > [!TYPE], emoji-based, keyword-based, and Spanish variants.
 */
function convertTelegramCallouts(text: string): string {
    // Normalize Spanish callout types first
    const spanishTypes = Object.keys(SPANISH_CALLOUT_MAP).join('|');
    const spanishRegex = new RegExp(`\\[!(${spanishTypes})\\]`, 'gi');
    text = text.replace(spanishRegex, (_match, type: string) => {
        const normalized = SPANISH_CALLOUT_MAP[type.toUpperCase()];
        return normalized ? `[!${normalized}]` : _match;
    });

    // Emoji-based callout detection: > 💡 **Tip:** text
    const emojiAlt = Object.keys(EMOJI_CALLOUT_MAP).join('|');
    const emojiCalloutRegex = new RegExp(`^>\\s*(${emojiAlt})\\s*(.*)$`, 'gm');
    text = text.replace(emojiCalloutRegex, (_match, emoji: string, rest: string) => {
        const type = EMOJI_CALLOUT_MAP[emoji];
        if (!type) return _match;
        const title = rest.replace(/\*+/g, '').replace(/[:：]\s*$/, '').trim();
        const displayEmoji = CALLOUT_EMOJI[type] || '📌';
        return `${displayEmoji} <b>${type}${title ? ': ' + title : ''}</b>`;
    });


    // [!TYPE] format (possibly inside blockquotes)
    const calloutTypes = Object.keys(CALLOUT_EMOJI).join('|');
    const calloutRegex = new RegExp(
        `^(?:>[ \\t]*)?\\[!(${calloutTypes})\\]([\\-\\+])?(?:[ \\t]+([^\\n]*))?[ \\t]*$`, 'gim'
    );
    text = text.replace(calloutRegex, (_match, type: string, _collapse: string, title: string) => {
        const typeUp = type.toUpperCase();
        const emoji = CALLOUT_EMOJI[typeUp] || '📌';
        const cleanTitle = title ? title.replace(/^[>\s]+/, '').trim() : '';

        return `${emoji} <b>${typeUp}${cleanTitle ? ': ' + cleanTitle : ''}</b>`;
    });

    // Final dedup: Remove cases where the model repeats the callout header immediately after the [!TYPE] conversion
    // e.g., ⚠️ WARNING \n ⚠️ WARNING: Content -> ⚠️ WARNING \n Content
    const emojiList = Object.values(CALLOUT_EMOJI).join('|');
    const typesList = Object.keys(CALLOUT_EMOJI).join('|');
    const dedupRegex = new RegExp(`(${emojiList})\\s*<b>(${typesList})</b>\\n+(${emojiList})\\s*\\2[:：]?\\s*`, 'gi');
    text = text.replace(dedupRegex, '$1 <b>$2</b>\n');

    return text;
}

/**
 * Converts task list items to checkbox emoji for Telegram.
 */
function convertTelegramTaskLists(text: string): string {
    // - [x] completed, - [ ] pending, - [/] partial
    text = text.replace(/^(\s*)[*\-•·]\s+\[x\]\s+(.*)$/gim, '$1☑ $2');
    text = text.replace(/^(\s*)[*\-•·]\s+\[ \]\s+(.*)$/gim, '$1☐ $2');
    text = text.replace(/^(\s*)[*\-•·]\s+\[\/\]\s+(.*)$/gim, '$1▣ $2');
    return text;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN FORMATTER CLASS
// ═══════════════════════════════════════════════════════════════════════

export class TelegramFormatter implements IFormatter {
    format(rawText: any): string {
        if (!rawText) return '';

        // ── PHASE 0: Normalization ─────────────────────────────────
        let text = formatFinalResponse(rawText);

        // Strip UI-specific formatting remnants
        text = text.replace(/^\*\[([^\]]+)\]:\s+(.*)$/gm, '');
        text = text.replace(/‹DOLLAR›/g, '$');
        text = text.replace(/‹esc-(\d+)›/g, (match, code) => String.fromCharCode(parseInt(code)));

        // ── PHASE 1: Pre-Protection Block Extraction ───────────────
        const placeholders: string[] = [];
        const protect = (content: string) => {
            const id = `\x00TG_${placeholders.length}\x00`;
            placeholders.push(content);
            return id;
        };

        // 1a. Remove <thought> / <thinkIng> blocks
        text = text.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
        text = text.replace(/<think[\s\S]*?<\/think>/gi, '').trim();

        // 1b. Signature shield — clean and protect
        text = text.replace(/"?\{\{\s*([^\}]+?)\s*\}\}"?/g, (match, signContent) => {
            if (signContent.includes('≈') || signContent.includes('∫') || signContent.includes('~') || signContent.includes('┬')) {
                let clean = signContent.trim();
                clean = clean.replace(/`([^`\n]+?)`/g, '$1');
                clean = clean.replace(/"([^"\n]+?)"/g, '$1');
                clean = clean.replace(/'([^'\n]+?)'/g, '$1');
                clean = clean.replace(/\s{2,}/g, ' ').trim();
                
                // Remove combining seagulls below (U+033C) that render poorly in Telegram
                clean = clean.replace(/\u033C/g, '');
                
                return protect(`{{ ${clean} }}`);
            }
            return match;
        });

        // Tier 3: Core pattern without {{ }}
        // Reinforced: stops at double newlines to avoid eating following code blocks.
        // Backtick/quote cleaning limited to 2 chars to protect triple-backtick blocks.
        text = text.replace(
            /[`"']{0,2}(?:\{\{)?(?:(?!\n\n)\s)*[`"']{0,2}(?:(?!\n\n)\s)*((?:\p{Emoji_Presentation}|\p{Extended_Pictographic}|\uFE0F|\u200D|\uFE0E)*)(?:(?!\n\n)\s)*[`"']{0,2}(?:(?!\n\n)\s)*(≈̼\^\.┬\.̼\^≈‿⟆)(?:(?!\n\n)\s)*[`"']{0,2}(?:(?!\n\n)\s)*((?:\p{Emoji_Presentation}|\p{Extended_Pictographic}|\uFE0F|\u200D|\uFE0E)*)(?:(?!\n\n)\s)*(?:\}\})?[ \t]*[`"']{0,2}/gu,
            (fullMatch, leadEmojis, core, trailEmojis) => {
                if (!core || !core.includes('┬')) return fullMatch;
                let lead = (leadEmojis || '').replace(/[\uFE0E\uFE0F]/g, '').trim();
                let trail = (trailEmojis || '').replace(/[\uFE0E\uFE0F]/g, '').trim();
                if (!lead) lead = '✨';
                if (!trail) trail = '🌸';
                
                // Remove combining seagulls below (U+033C) from the core
                const cleanCore = core.replace(/\u033C/g, '');
                
                return protect(`{{ ${lead} ${escapeTelegramHtml(cleanCore)} ${trail} }}`);
            }
        );

        // 1c. Fenced code blocks (must protect before bold/italic conversion)
        text = text.replace(/^[ \t]*(`{3,}|~{3,})([\w./+#-]*)[\t ]*\n([\s\S]*?)\n[ \t]*\1/gm, (match, _fence, lang, code) => {
            const langLabel = lang ? `${lang}\n` : '';
            const escapedCode = escapeTelegramHtml(code.trim());
            // Removed Mermaid replacement to preserve diagram code
            return protect(`\n<pre>${langLabel}${escapedCode}</pre>\n`);
        });

        // 1d. Inline code (double backticks first, then single)
        text = text.replace(/``([^`\n]+?)``/g, (match, code) => {
            return protect(`<code>${escapeTelegramHtml(code.replace(/^ | $/g, ''))}</code>`);
        });
        text = text.replace(/`([^`\n]+)`/g, (match, code) => {
            return protect(`<code>${escapeTelegramHtml(code)}</code>`);
        });

        // 1e. Block math $$...$$ and \[...\]
        text = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
            const safeMath = convertMathToTelegram(formula);
            return protect(`\n<pre>${escapeTelegramHtml(safeMath)}</pre>\n`);
        });
        text = text.replace(/\\\[([\s\S]*?)\\\]/g, (match, formula) => {
            const safeMath = convertMathToTelegram(formula);
            return protect(`\n<pre>${escapeTelegramHtml(safeMath)}</pre>\n`);
        });

        // 1f. Inline math $...$ and \(...\)
        text = text.replace(/\$((?:[^\$]|\\\$)+?)\$/g, (match, formula) => {
            const f = formula.trim();
            if (!f || f.length > 350 || f.includes('\n\n')) return match;
            // Currency guard
            if (/^[\d,.\s]+(billones|millones|trillones|M|k|m|b|t)?$/i.test(f)) return match;
            const safeMath = convertMathToTelegram(formula);
            return protect(`<code>${escapeTelegramHtml(safeMath)}</code>`);
        });
        text = text.replace(/\\\(([\s\S]*?)\\\)/g, (match, formula) => {
            const safeMath = convertMathToTelegram(formula);
            return protect(`<code>${escapeTelegramHtml(safeMath)}</code>`);
        });

        // 1g. Iframes → links
        text = text.replace(/<iframe[^>]+src=["']([^"']+)["'][^>]*>.*?<\/iframe>/gi, (match, url) => {
            return protect(`\n🔗 <b>[Link: ${escapeTelegramHtml(url)}]</b>\n`);
        });

        // 1h. Images ![alt](url) → text link
        text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
            return protect(alt ? `🖼 ${escapeTelegramHtml(alt)}: ${escapeTelegramHtml(url)}` : `🖼 ${escapeTelegramHtml(url)}`);
        });

        // ── PHASE 2: Raw HTML Tag Processing ───────────────────────
        text = processRawHtmlTags(text);

        // ── PHASE 3: Table Processing ──────────────────────────────
        const lines = text.split('\n');
        let inTable = false;
        let tableLines: string[] = [];
        const outputLines: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            // Replace DIVIDER marker
            if (trimmedLine === '---DIVIDER---') {
                if (inTable && tableLines.length > 0) {
                    outputLines.push(protect(formatTelegramTable(tableLines)));
                    inTable = false;
                    tableLines = [];
                }
                outputLines.push(protect('━━━━━━━━━━━━━━━━━━━━━━━━'));
                continue;
            }

            // Table processing
            if (line.startsWith('|') && line.includes('|')) {
                inTable = true;
                if (!line.match(/^[|:\-\s]+$/)) tableLines.push(line);
            } else {
                if (inTable && tableLines.length > 0) {
                    outputLines.push(protect(formatTelegramTable(tableLines)));
                    inTable = false;
                    tableLines = [];
                }
                outputLines.push(lines[i]);
            }
        }

        if (inTable && tableLines.length > 0) {
            outputLines.push(protect(formatTelegramTable(tableLines)));
        }

        text = outputLines.join('\n');

        // ── PHASE 4: Markdown → Telegram HTML Conversion ───────────

        // 4a. Escape protection — backslash-escaped chars
        const escapedChars: string[] = [];
        text = text.replace(/\\([\\`*_{}\[\]()#+\-.!|~$])/g, (match, char) => {
            const id = `\x00ESC${escapedChars.length}\x00`;
            escapedChars.push(char);
            return id;
        });

        // 4b. Headers (# → <b>) — process longest first
        text = text.replace(/^######\s+(.*)$/gm, '<b>$1</b>');
        text = text.replace(/^#####\s+(.*)$/gm, '<b>$1</b>');
        text = text.replace(/^####\s+(.*)$/gm, '<b>$1</b>');
        text = text.replace(/^###\s+(.*)$/gm, '<b>$1</b>');
        text = text.replace(/^##\s+(.*)$/gm, '<b>$1</b>');
        text = text.replace(/^#\s+(.*)$/gm, '<b>$1</b>');

        // 4c. Dividers (horizontal rules)
        text = text.replace(/^\s*([*\-_]){3,}\s*$/gm, '━━━━━━━━━━━━━━━━━━━━━━━━');

        // 4d. Bold+italic ***text*** → <b>text</b> (NO nesting!)
        text = text.replace(/\*\*\*([\s\S]+?)\*\*\*/g, '<b>$1</b>');

        // 4e. Bold **text** and __text__
        text = text.replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>');
        text = text.replace(/(?<!\w)__([\s\S]+?)__(?!\w)/g, '<b>$1</b>');

        // 4f. Italic *text* and _text_
        text = text.replace(/(?<!\*)\*(?!\*)([\s\S]+?)\*/g, '<i>$1</i>');
        text = text.replace(/(?<!\w)_([\s\S]+?)_(?!\w)/g, '<i>$1</i>');

        // 4g. Strikethrough ~~text~~
        text = text.replace(/~~(.+?)~~/g, '<s>$1</s>');

        // 4h. Spoilers ||text|| (after tables are protected)
        text = text.replace(/\|\|(.+?)\|\|/g, '<tg-spoiler>$1</tg-spoiler>');

        // 4i. Highlight ==text== → bold (Telegram has no highlight)
        text = text.replace(/==([^=\n]+)==/g, '<b>$1</b>');

        // 4j. Superscript ^text^ → plain text
        text = text.replace(/\^([^\^\n]+)\^/g, '$1');

        // 4k. Subscript ~text~ → plain text (after strikethrough ~~)
        text = text.replace(/~([^~\n]+)~/g, '$1');

        // 4l. Links [text](url)
        text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

        // 4m. Blockquotes > text (after callout detection)
        text = convertTelegramCallouts(text);
        text = convertTelegramBlockquotes(text);

        // 4n. Definition lists Term \n : Definition
        text = text.replace(/^([^\n<]+)\n:\s+(.+)$/gm, '<b>$1</b>\n  • $2');

        // 4o. Footnotes
        // References [^1] → [1]
        text = text.replace(/\[\^([^\]\n]+?)\]/g, '[$1]');
        // Definitions [^1]: text → [1] text
        text = text.replace(/^\[\^([^\]]+)\]:\s+(.*)$/gm, '[$1] $2');

        // 4p. Task lists
        text = convertTelegramTaskLists(text);

        // 4r. Progress bars → label: XX%
        text = text.replace(/^([\w\s]+):\s*[\[\(][=#\*\u2588\u2593\u2592\u2591\s]{3,}[\]\)]\s*(\d+%)\s*$/gm, '$1: $2');

        // 4s. Emoji shortcodes
        text = text.replace(/:([a-z_]+):/g, (match, code) => {
            return EMOJI_MAP[code] || match;
        });

        // 4t. Bullet points (last)
        text = text.replace(/^([ \t]*)[\*\-•·]\s+(.*)$/gm, '$1• $2');
        text = text.replace(/^([ \t]*)(\d+)\.\s+(.*)$/gm, '$1$2. $3');

        // ── PHASE 5: HTML Escaping + Restore Telegram Tags ─────────
        // Escape ALL special chars first
        text = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Restore ONLY valid Telegram tags with proper attribute validation
        text = text.replace(
            new RegExp(`&lt;(\\/)?(${TG_VALID_TAGS.join('|')})((?:(?!&gt;).)*?)&gt;`, 'gi'),
            (match, slash, tag, attrsRaw) => {
                const tagLower = tag.toLowerCase();
                const attrs = attrsRaw.replace(/&quot;/g, '"');
                if (tagLower === 'a') {
                    if (slash) return `</a>`;
                    // <a> must have valid href attribute
                    const hrefMatch = attrs.match(/^\s*href=["']([^"']+)["']\s*$/i);
                    if (hrefMatch) {
                        return `<a href="${hrefMatch[1]}">`;
                    }
                    // Invalid <a> — strip it but keep inner text (handled by nesting logic)
                    return '';
                }
                if (tagLower === 'tg-emoji') {
                    if (slash) return `</tg-emoji>`;
                    // <tg-emoji emoji-id="...">
                    const emojiMatch = attrs.match(/^\s*emoji-id=["']([^"']+)["']\s*$/i);
                    if (emojiMatch) {
                        return `<tg-emoji emoji-id="${emojiMatch[1]}">`;
                    }
                    return '';
                }
                // All other tags: strip attributes
                return `<${slash ? '/' : ''}${tagLower}>`;
            }
        );

        // ── PHASE 6: Placeholder Restoration ───────────────────────
        // Protected content already has valid Telegram HTML — don't re-escape
        // Must iterate backwards so outer containers (higher index) are restored
        // before inner items (lower index) they might contain.
        for (let i = placeholders.length - 1; i >= 0; i--) {
            text = text.replace(`\x00TG_${i}\x00`, placeholders[i]);
        }

        // ── PHASE 7: Nesting Flattening Safety Net ─────────────────
        text = flattenNestedFormatting(text);

        // ── PHASE 8: Restore Escaped Characters ────────────────────
        escapedChars.forEach((char, i) => {
            text = text.replace(`\x00ESC${i}\x00`, char);
        });

        // Clean up excessive blank lines from HTML block stripping
        text = text.replace(/\n{3,}/g, '\n\n');
        text = text.replace(/^[ \t]*\n+/gm, '\n'); // Remove lines that only contain spaces
        text = text.replace(/\n{3,}/g, '\n\n'); // Second pass for safety

        return text.trim();
    }

    /**
     * Telegram-specific method that splits output into chunks (max 4000 chars each).
     * Returns an array of formatted strings suitable for Telegram API.
     */
    formatAsChunks(rawText: any): string[] {
        const text = this.format(rawText);
        const MAX_LIMIT = 4000;

        if (text.length <= MAX_LIMIT) return [text];

        const chunks: string[] = [];
        let currentText = text;

        while (currentText.length > 0) {
            if (currentText.length <= MAX_LIMIT) {
                chunks.push(currentText.trim());
                break;
            }

            // Find split point at newline, avoiding mid-tag splits
            let splitIdx = currentText.lastIndexOf('\n', MAX_LIMIT);
            if (splitIdx === -1) splitIdx = MAX_LIMIT;

            // Ensure we're not splitting inside an HTML tag
            const beforeSplit = currentText.substring(0, splitIdx);
            const lastOpenTag = beforeSplit.lastIndexOf('<');
            const lastCloseTag = beforeSplit.lastIndexOf('>');
            if (lastOpenTag > lastCloseTag) {
                // We're inside a tag — find the next '>' after lastOpenTag
                const nextClose = currentText.indexOf('>', lastOpenTag);
                if (nextClose !== -1 && nextClose < MAX_LIMIT + 100) {
                    splitIdx = nextClose + 1;
                }
            }

            let chunk = currentText.substring(0, splitIdx).trim();

            // Ensure no unclosed tags in the chunk using a strict stack
            const openTagsStack: string[] = [];
            const tagRe = /<\/?(b|i|u|s|code|pre|blockquote|tg-spoiler|a)(?:\s+[^>]*?)?>/gi;
            let match;
            while ((match = tagRe.exec(chunk)) !== null) {
                const fullTag = match[0];
                const tagName = match[1].toLowerCase();
                const isClose = fullTag.startsWith('</');

                if (isClose) {
                    // LIFO closing: find matching tag
                    const lastIdx = openTagsStack.map(t => t.match(/<([a-z0-9-]+)/i)![1].toLowerCase()).lastIndexOf(tagName);
                    if (lastIdx !== -1) {
                        // Close this tag and any tags opened after it (they were malformed anyway if this happens)
                        openTagsStack.splice(lastIdx); 
                    }
                } else {
                    // Don't stack self-closing or tags already handled
                    openTagsStack.push(fullTag);
                }
            }

            // Close tags in Chunk 1 (Reverse order)
            for (let i = openTagsStack.length - 1; i >= 0; i--) {
                const openTag = openTagsStack[i];
                const tagName = openTag.match(/<([a-z0-9-]+)/i)![1];
                chunk += `</${tagName}>`;
            }

            // Re-open tags in Chunk 2 (Original order)
            const reOpenPrefix = openTagsStack.join('');
            
            chunks.push(chunk);
            currentText = reOpenPrefix + currentText.substring(splitIdx).trim();
        }

        return chunks;
    }
}

/**
 * Legacy function for backward compatibility.
 */
export function formatTelegramResponse(rawText: string): string[] {
    const formatter = new TelegramFormatter();
    return formatter.formatAsChunks(rawText);
}
