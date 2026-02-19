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

export function formatTelegramResponse(rawText: string): string {
    if (!rawText) return '';

    // 1. Initial cleanup (unescape \n, remove surrounding quotes)
    // We reuse the logic from the main formatter
    let text = formatFinalResponse(rawText);

    // 2. Escape HTML special characters EXCEPT for the ones we will add
    // Telegram requires escaping <, > and & if not part of a tag
    text = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // 3. Convert Markdown to Telegram HTML

    // Headers: ### Header -> <b>HEADER</b>
    text = text.replace(/^(?:#{1,6})\s*(.*)$/gm, '<b>$1</b>');

    // Bold: **text** -> <b>text</b>
    text = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

    // Italic: *text* -> <i>text</i>
    text = text.replace(/(?<!\*)\*(?!\*)(.*?)\*/g, '<i>$1</i>');

    // Inline Code: `text` -> <code>text</code>
    text = text.replace(/`(.*?)`/g, '<code>$1</code>');

    // Code blocks: ```text``` -> <pre>text</pre>
    text = text.replace(/```(?:[a-z]*\n)?([\s\S]*?)```/g, '<pre>$1</pre>');

    // Links: [text](url) -> <a href="$2">$1</a>
    text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

    // 4. Final Verification: Ensure double newlines aren't collapsed by any regex
    // (They shouldn't be, as we use /m flag for headers only and others are inline)

    return text.trim();
}
