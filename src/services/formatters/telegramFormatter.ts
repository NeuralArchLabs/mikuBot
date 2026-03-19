/**
 * ──────────────────────────────────────────────────────────────────────
 *  Telegram Formatter — Markdown to HTML for Telegram API
 * ──────────────────────────────────────────────────────────────────────
 *
 *  This formatter:
 *  - Calls formatFinalResponse() for text normalization
 *  - Converts markdown to Telegram-compatible HTML
 *  - Formats tables specially for Telegram mobile responsiveness
 *  - Replaces dividers with Telegram-friendly visual separators
 *  - Enforces 4096 character limit
 * ──────────────────────────────────────────────────────────────────────
 */

import { formatFinalResponse } from './answerFormatter';

/**
 * Formats a table for Telegram mobile responsiveness.
 * For narrow tables: ASCII grid with borders
 * For wide tables: Vertical cards with truncated content (max 5 rows)
 */
function formatTelegramTable(lines: string[]): string {
    const rows = lines.map(line =>
        line.split('|')
            .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
            .map(cell => cell.trim())
    );

    if (rows.length < 2) return '';

    const headers = rows[0];
    const data = rows.slice(1);
    const colWidths = headers.map((h, i) => Math.max(h.length, ...data.map(r => (r[i] || '').length)));
    const totalWidth = colWidths.reduce((a, b) => a + b, 0) + (colWidths.length * 3) + 1;

    // Narrow table: use ASCII Grid
    if (totalWidth < 35 && headers.length <= 3) {
        const formattedRows = rows.map(row => {
            return '|' + row.map((cell, i) => (cell || '').padEnd(colWidths[i])).join('|') + '|';
        });
        const sep = '+' + colWidths.map(w => '-'.repeat(w)).join('+') + '+';
        return '<pre>' + [sep, formattedRows[0], sep, ...formattedRows.slice(1), sep].join('\n') + '</pre>';
    }

    // Wide table: use Vertical Cards (limit to 5 results)
    const truncatedData = data.slice(0, 5);
    const hasMore = data.length > 5;

    let resultArr = truncatedData.map((row, rowIdx) => {
        const title = row[0] ? `<b>📌 ${row[0].toUpperCase()}</b>` : `<b>🔹 ELEMENTO ${rowIdx + 1}</b>`;
        const details = headers.map((h, i) => {
            if (i === 0) return null;
            const isLast = i === headers.length - 1;
            const branch = isLast ? '└──' : '├──';
            const content = row[i] || 'N/A';
            const cleanContent = content.length > 300 ? content.substring(0, 297) + '...' : content;
            return `${branch} <i>${h}:</i> ${cleanContent}`;
        }).filter(Boolean).join('\n');

        return `${title}\n${details}`;
    });

    if (hasMore) {
        resultArr.push(`<i>... y ${data.length - 5} resultados más (demasiado largo para Telegram).</i>`);
    }

    return resultArr.join('\n\n');
}

/**
 * Formats text for Telegram output.
 * Calls formatFinalResponse() first, then applies Telegram-specific formatting.
 */
export function formatTelegramResponse(rawText: string): string {
    if (!rawText) return '';

    // 1. Normalize text (single source of truth for cleanup)
    let text = formatFinalResponse(rawText);

    // 2. Clear thinking blocks
    text = text.replace(/

[\s\S]*?<\/think>/gi, '').trim();

    // 3. Process tables and replace dividers
    const lines = text.split('\n');
    let inTable = false;
    let tableLines: string[] = [];
    const outputLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Replace DIVIDER marker with Telegram separator
        if (trimmedLine === '---DIVIDER---') {
            outputLines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            continue;
        }

        // Skip empty standalone markers
        if (trimmedLine === '***' || trimmedLine === '*' || trimmedLine === '-') {
            continue;
        }

        // Table processing
        if (line.startsWith('|') && line.includes('|')) {
            inTable = true;
            if (!line.match(/^[|:\-\s]+$/)) tableLines.push(line);
        } else {
            if (inTable && tableLines.length > 0) {
                outputLines.push(formatTelegramTable(tableLines));
                inTable = false;
                tableLines = [];
            }
            outputLines.push(lines[i]);
        }
    }

    if (inTable && tableLines.length > 0) {
        outputLines.push(formatTelegramTable(tableLines));
    }

    text = outputLines.join('\n');

    // 4. Escape HTML special characters
    text = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/&lt;(\/)?(b|i|code|pre|a)(.*?)&gt;/g, '<$1$2$3>');

    // 5. Convert Markdown to Telegram HTML
    text = text.replace(/^(?:#{1,6})\s*(.*)$/gm, '<b>$1</b>');
    text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<b><i>$1</i></b>');
    text = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    text = text.replace(/(?<!\*)\*(?!\*)(.*?)\*/g, '<i>$1</i>');
    text = text.replace(/```(?:[a-z]*\n)?([\s\S]*?)```/g, '<pre>$1</pre>');
    text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

    // Bullet points
    text = text.replace(/^[\*\-] (.*)$/gm, '• $1');
    text = text.replace(/^(\d+)\. (.*)$/gm, '$1. $2');

    // 6. Enforce Telegram 4096 character limit (target 4000 for safety)
    if (text.length > 4000) {
        let truncated = text.substring(0, 3950);

        // Ensure no unclosed tags
        const tags = ['</b>', '</i>', '</code>', '</pre>', '</a>'];
        tags.forEach(tag => {
            const openTag = tag.replace('/', '');
            const openCount = (truncated.match(new RegExp(openTag, 'g')) || []).length;
            const closeCount = (truncated.match(new RegExp(tag, 'g')) || []).length;
            if (openCount > closeCount) {
                truncated += tag;
            }
        });

        text = truncated + '\n\n<i>[Mensaje truncado por límite de Telegram...]</i>';
    }

    return text.trim();
}
