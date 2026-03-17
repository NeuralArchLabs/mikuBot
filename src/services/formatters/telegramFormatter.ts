/**
 * ──────────────────────────────────────────────────────────────────────
 *  Telegram Formatter — Markdown to HTML Converter for Telegram API
 * ──────────────────────────────────────────────────────────────────────
 * 
 *  Telegram's HTML parse mode is strict. This script converts basic
 *  Markdown (bold, italic, code) to Telegram-compatible HTML tags
 *  and ensures special characters like <, > and & are escaped.
 * ──────────────────────────────────────────────────────────────────────
 */

import { formatFinalResponse } from './answerFormatter';

/**
 * Formats a markdown table into a perfectly aligned ASCII table for Telegram
 */
/**
 * Detects if a table is too wide for Telegram mobile and chooses the best format
 */
/**
 * Detects if a table is too wide for Telegram mobile and chooses the best format
 */
function formatTelegramTable(lines: string[]): string {
    const rows = lines.map(line => 
        line.split('|')
            .filter((cell, idx, arr) => idx > 0 && idx < arr.length - 1)
            .map(cell => cell.trim())
    );

    if (rows.length < 2) return '';

    const headers = rows[0];
    const data = rows.slice(1);
    const colWidths = headers.map((h, i) => Math.max(h.length, ...data.map(r => (r[i] || '').length)));
    const totalWidth = colWidths.reduce((a, b) => a + b, 0) + (colWidths.length * 3) + 1;

    // IF table is narrow (less than 35 chars approx), use ASCII Grid
    if (totalWidth < 35 && headers.length <= 3) {
        const formattedRows = rows.map(row => {
            return '|' + row.map((cell, i) => (cell || '').padEnd(colWidths[i])).join('|') + '|';
        });
        const sep = '+' + colWidths.map(w => '-'.repeat(w)).join('+') + '+';
        return '<pre>' + [sep, formattedRows[0], sep, ...formattedRows.slice(1), sep].join('\n') + '</pre>';
    }

    // IF table is wide, use a structured List (Vertical Cards)
    // Limit to top 5 results to avoid exceeding Telegram's 4096 char limit
    const truncatedData = data.slice(0, 5);
    const hasMore = data.length > 5;

    let resultArr = truncatedData.map((row, rowIdx) => {
        const title = row[0] ? `<b>📌 ${row[0].toUpperCase()}</b>` : `<b>🔹 ELEMENTO ${rowIdx + 1}</b>`;
        const details = headers.map((h, i) => {
            if (i === 0) return null; // Skip first col as it's the title
            const isLast = i === headers.length - 1;
            const branch = isLast ? '└──' : '├──';
            // Truncate individual cell content if too long
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

export function formatTelegramResponse(rawText: string): string {
    if (!rawText) return '';

    let text = formatFinalResponse(rawText);

    // 1. Process Tables with Responsive Logic and Filter Noise
    const lines = text.split('\n');
    let inTable = false;
    let tableLines: string[] = [];
    const outputLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Filter out horizontal rules (*** or ---) and stray markers that clutter the view
        const trimmedLine = line.trim();
        if (trimmedLine === '***' || trimmedLine === '---' || trimmedLine === '*' || trimmedLine === '-') {
            continue;
        }

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
    if (inTable && tableLines.length > 0) outputLines.push(formatTelegramTable(tableLines));
    text = outputLines.join('\n');

    // 2. Clear thinking blocks for Telegram (prevents "hidden" length issues)
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // 3. Escape HTML special characters but keep allowed tags
    text = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/&lt;(\/)?(b|i|code|pre|a)(.*?)&gt;/g, '<$1$2$3>');

    // 3. Convert Markdown to Telegram HTML
    text = text.replace(/^(?:#{1,6})\s*(.*)$/gm, '<b>$1</b>');
    text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<b><i>$1</i></b>');
    text = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    text = text.replace(/(?<!\*)\*(?!\*)(.*?)\*/g, '<i>$1</i>');
    text = text.replace(/```(?:[a-z]*\n)?([\s\S]*?)```/g, '<pre>$1</pre>');
    text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

    // Bullet points (Standardize)
    text = text.replace(/^[\*\-] (.*)$/gm, '• $1');
    text = text.replace(/^(\d+)\. (.*)$/gm, '$1. $2');

    // 4. Hard Limit Check (Telegram limit is 4096 chars)
    // We target 4000 to be safe with HTML overhead
    if (text.length > 4000) {
        // Find a safe spot to truncate (avoiding breaking HTML tags if possible)
        let truncated = text.substring(0, 3950);
        
        // Ensure we don't leave an unclosed tag at the very end
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
