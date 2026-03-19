/**
 * Formatting Helpers
 * Data formatting and HTML conversion utilities
 */

/**
 * Converts Markdown to HTML with custom styling
 */
export const toHtml = (md: string): string => {
    if (!md) return '';

    let html = md;

    // Code blocks (process first to avoid conflicts)

    html = html
        .replace(/<details/g, '‹details')
        .replace(/<\/details>/g, '‹/details›')
        .replace(/<summary>/g, '‹summary›')
        .replace(/<\/summary>/g, '‹/summary›');

    html = html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    html = html
        .replace(/‹details/g, '<details')
        .replace(/‹\/details›/g, '</details>')
        .replace(/‹summary›/g, '<summary>')
        .replace(/‹\/summary›/g, '</summary>');

    // Code blocks
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-black/30 p-3 rounded-lg my-2 overflow-x-auto border border-white/10"><code class="text-sm shadow-none">$2</code></pre>');
    html = html.replace(/`([^`\n]+)`/g, '<code class="bg-black/30 px-1.5 py-0.5 rounded text-amber-300 font-mono text-xs border border-white/10">$1</code>');

    // Tables
    const lines = html.split('\n');
    let inTable = false;
    let tableHtml = '';
    const outputLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('|') && line.includes('|')) {
            if (!inTable) {
                inTable = true;
                tableHtml = '<div class="overflow-x-auto my-4"><table class="min-w-full divide-y divide-white/10 border border-white/10 rounded-lg overflow-hidden">';
            }

            const cells = line.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
            if (line.match(/^[|:\-\s]+$/)) continue; // Skip separator line

            if (!tableHtml.includes('<thead>')) {
                tableHtml += '<thead class="bg-white/5"><tr>';
                cells.forEach(c => tableHtml += `<th class="px-4 py-2 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">${c.trim()}</th>`);
                tableHtml += '</tr></thead><tbody class="divide-y divide-white/5">';
            } else {
                tableHtml += '<tr class="hover:bg-white/5 transition-colors">';
                cells.forEach(c => tableHtml += `<td class="px-4 py-2 text-sm text-slate-300 border-x border-white/5">${c.trim()}</td>`);
                tableHtml += '</tr>';
            }
        } else {
            if (inTable) {
                tableHtml += '</tbody></table></div>';
                outputLines.push(tableHtml);
                inTable = false;
                tableHtml = '';
            }
            outputLines.push(lines[i]);
        }
    }
    if (inTable) outputLines.push(tableHtml + '</tbody></table></div>');
    html = outputLines.join('\n');

    // Headlines (comfort margins + vibrant colors)
    html = html.replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-slate-100 mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-md font-bold text-cyan-400 mt-5 mb-3 border-b border-white/10 pb-1">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 class="text-lg font-extrabold text-white mt-6 mb-4 border-b border-cyan-500/20 pb-1.5 shadow-sm">$1</h1>');

    // Bold/Italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="text-amber-300"><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-amber-400">$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em class="text-slate-300">$1</em>');

    // Links and blockquotes
    const sanitizeUrl = (url: string): string => {
        const decoded = url.replace(/&amp;/g, '&');
        const trimmed = decoded.trim().toLowerCase();
        return (trimmed.startsWith('http:') || trimmed.startsWith('https:') || trimmed.startsWith('mailto:')) ? url : '';
    };

    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
        const safe = sanitizeUrl(url);
        return safe ? `<a href="${safe}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">${text}</a>` : text;
    });

    html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-3 border-cyan-500/50 pl-3 italic text-slate-300 my-2 bg-cyan-500/5 py-1.5 pr-2 rounded-r">$1</blockquote>');

    // Horizontal rules (thematic breaks) - Replace "---" and "---DIVIDER---" with styled visual separator
    // First replace the DIVIDER marker (for consistency with formatter)
    html = html.replace(/---DIVIDER---/g, '<div class="divider-gradient"></div>');
    // Then replace any remaining standalone --- (in case it didn't go through formatFinalResponse)
    // Must match lines that ONLY contain the separator (not list items or other text)
    html = html.replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, '<div class="divider-gradient"></div>');

    const contentLines = html.split('\n');
    const processed = [];
    let currentList: 'ul' | 'ol' | null = null;

    for (let i = 0; i < contentLines.length; i++) {
        const line = contentLines[i];
        const trimmed = line.trim();

        // Match lists (allow indentation)
        const ulMatch = line.match(/^(\s*)[\*\-] (.*)$/);
        const olMatch = line.match(/^(\s*)(\d+)\. (.*)$/);

        if (ulMatch || olMatch) {
            const isUl = !!ulMatch;
            const type = isUl ? 'ul' : 'ol';
            const content = isUl ? ulMatch[2] : olMatch[3];
            const indent = (isUl ? ulMatch[1] : olMatch[1]).length;

            if (currentList !== type) {
                if (currentList) processed.push(`</${currentList}>`);
                processed.push(`<${type} class="space-y-1.5 my-2 ${indent > 0 ? 'ml-6' : ''}">`);
                currentList = type;
            }
            processed.push(`<li class="ml-6 list-${isUl ? 'disc' : 'decimal'} list-outside marker:text-cyan-400/60 pl-1">${content}</li>`);
        } else if (trimmed === "" && i < contentLines.length - 1 && (contentLines[i+1].match(/^(\s*)[\*\-] /) || contentLines[i+1].match(/^(\s*)\d+\. /))) {
            // Skip empty lines between list items to keep them together
            continue;
        } else {
            if (currentList) {
                processed.push(`</${currentList}>`);
                currentList = null;
            }
            if (trimmed) {
                // If it's not a tag already, wrap in paragraph-like div for better spacing control
                if (!trimmed.startsWith('<') || trimmed.startsWith('<code') || trimmed.startsWith('<strong') || trimmed.startsWith('<em')) {
                    processed.push(`<div class="mb-3 leading-loose">${trimmed}</div>`);
                } else {
                    processed.push(line);
                }
            }
        }
    }
    if (currentList) processed.push(`</${currentList}>`);

    return processed.join('').trim();
};

/**
 * Formats date to locale string
 */
export function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
}

/**
 * Formats file size in human readable format
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Formats duration in milliseconds to human readable format
 */
export function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

/**
 * Formats number with locale specific formatting
 */
export function formatNumber(num: number, decimals: number = 0): string {
    return num.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}
