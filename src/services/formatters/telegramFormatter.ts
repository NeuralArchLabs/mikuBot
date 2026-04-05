/**
 * ──────────────────────────────────────────────────────────────────────
 *  Telegram Formatter — Markdown to HTML for Telegram API
 * ──────────────────────────────────────────────────────────────────────
 *
 *  This formatter:
 *  - Implements IFormatter strategy pattern
 *  - Converts markdown to Telegram-compatible HTML
 *  - Formats tables specially for Telegram mobile responsiveness
 *  - Replaces dividers with Telegram-friendly visual separators
 *  - Splits output into chunks respecting 4096 character limit
 * ──────────────────────────────────────────────────────────────────────
 */

import { IFormatter } from './IFormatter';
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

    // Wide table: use Vertical Cards
    let resultArr = data.map((row, rowIdx) => {
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

    return resultArr.join('\n\n');
}

/**
 * Telegram formatter implementing IFormatter.
 * Includes format() for standard use and formatAsChunks() for Telegram API.
 */
export class TelegramFormatter implements IFormatter {
    format(rawText: any): string {
        if (!rawText) return '';

        // 1. Normalize text (single source of truth for cleanup)
        let text = formatFinalResponse(rawText);

        // 2. Clear thinking blocks
        text = text.replace(/<thought>[\s\S]*?<\/think>/gi, '').trim();

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
                outputLines.push('━━━━━━━━━━━━━━━━━━━━━━━━');
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

        return text.trim();
    }

    /**
     * Telegram-specific method that splits output into chunks (max 4096 chars each).
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

            let splitIdx = currentText.lastIndexOf('\n', MAX_LIMIT);
            if (splitIdx === -1) splitIdx = MAX_LIMIT;

            let chunk = currentText.substring(0, splitIdx).trim();

            // Ensure no unclosed tags in the chunk
            const tags = [
                { open: '<b>', close: '</b>' },
                { open: '<i>', close: '</i>' },
                { open: '<code>', close: '</code>' },
                { open: '<pre>', close: '</pre>' },
                { open: '<a ', close: '</a>' }
            ];

            tags.forEach(t => {
                const openCount = (chunk.match(new RegExp(t.open, 'g')) || []).length;
                const closeCount = (chunk.match(new RegExp(t.close, 'g')) || []).length;
                if (openCount > closeCount) {
                    chunk += t.close;
                }
            });

            chunks.push(chunk);
            currentText = currentText.substring(splitIdx).trim();
        }

        return chunks;
    }
}

/**
 * Legacy function for backward compatibility.
 * Wraps TelegramFormatter class.
 */
export function formatTelegramResponse(rawText: string): string[] {
    const formatter = new TelegramFormatter();
    return formatter.formatAsChunks(rawText);
}
