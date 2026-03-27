/**
 * Formatting Helpers
 * Data formatting and HTML conversion utilities
 */

/**
 * Converts normalized Markdown to HTML with custom styling.
 *
 * IMPORTANT: This expects text to be already normalized by formatFinalResponse().
 * The DIVIDER marker should already be in place.
 */
export const toHtml = (md: string): string => {
    if (!md) return '';

    let html = md;

    // 1. Protect details/summary tags during HTML escaping
    html = html
        .replace(/<details/g, '‹details')
        .replace(/<\/details>/g, '‹/details›')
        .replace(/<summary>/g, '‹summary›')
        .replace(/<\/summary>/g, '‹/summary›');

    // 2. HTML escape (after protecting details tags)
    html = html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // 3. Restore details/summary tags
    html = html
        .replace(/‹details/g, '<details')
        .replace(/‹\/details›/g, '</details>')
        .replace(/‹summary›/g, '<summary>')
        .replace(/‹\/summary›/g, '</summary>');

    // 4. Code blocks
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-black/30 p-3 rounded-lg my-2 overflow-x-auto border border-white/10"><code class="text-sm shadow-none">$2</code></pre>');
    html = html.replace(/`([^`\n]+)`/g, '<code class="bg-black/30 px-1.5 py-0.5 rounded text-amber-300 font-mono text-xs border border-white/10">$1</code>');

    // 5. Tables
    html = convertTablesToHtml(html);

    // 6. Headings
    html = html.replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-slate-100 mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-md font-bold text-cyan-400 mt-5 mb-3 border-b border-white/10 pb-1">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 class="text-lg font-extrabold text-white mt-6 mb-4 border-b border-cyan-500/20 pb-1.5 shadow-sm">$1</h1>');

    // 7. Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="text-amber-300"><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-amber-400">$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em class="text-slate-300">$1</em>');

    // 8. Links
    html = convertLinksToHtml(html);

    // 9. Blockquotes
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-3 border-cyan-500/50 pl-3 italic text-slate-300 my-2 bg-cyan-500/5 py-1.5 pr-2 rounded-r">$1</blockquote>');

    // 10. Lists (must be done before DIVIDER to avoid breaking it)
    html = convertListsToHtml(html);

    // 11. Replace DIVIDER marker with styled visual separator (after list processing)
    html = html.replace(/---DIVIDER---/g, '<div class="divider-container"><div class="divider-line"></div></div>');

    return html.trim();
};

// DO NOT MODIFY: Auto-healing logic for 2D table parser
/**
 * Converts markdown tables to HTML with styling.
 */
function convertTablesToHtml(html: string): string {
    const lines = html.split('\n');
    let inTable = false;
    let currentTable: string[][] = [];
    const outputLines: string[] = [];
    let inPre = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Guard flag to prevent parsing shell commands with pipes as tables inside code blocks
        if (line.includes('<pre')) inPre = true;

        const trimmed = line.trim();
        const isTableRow = !inPre && trimmed.includes('|') && (inTable || trimmed.startsWith('|'));

        if (isTableRow) {
            if (!inTable) {
                inTable = true;
                currentTable = [];
            }
            if (trimmed.match(/^[|:\-\s]+$/)) {
                if (line.includes('</pre>')) inPre = false;
                continue; 
            }
            
            const cleanLine = trimmed.replace(/^\|/, '').replace(/\|$/, '');
            const cells = cleanLine.split('|').map(c => c.trim());
            currentTable.push(cells);
        } else {
            if (inTable) {
                outputLines.push(renderTable(currentTable));
                inTable = false;
                currentTable = [];
            }
            outputLines.push(line);
        }

        if (line.includes('</pre>')) inPre = false;
    }

    if (inTable) outputLines.push(renderTable(currentTable));

    return outputLines.join('\n');
}

function renderTable(rows: string[][]): string {
    if (rows.length === 0) return '';
    
    // Auto-heal column count: find the maximum width used in either header or data rows
    let maxCols = 0;
    rows.forEach(r => { if (r.length > maxCols) maxCols = r.length; });

    let html = '<div class="overflow-x-auto my-4"><table class="min-w-full divide-y divide-white/10 border border-white/10 rounded-lg overflow-hidden">';
    
    // Auto-Grid Header
    html += '<thead class="bg-white/5"><tr>';
    const headerRow = rows[0];
    for (let i = 0; i < maxCols; i++) {
        const cellText = headerRow[i] || '&nbsp;';
        html += `<th class="px-4 py-2 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">${cellText}</th>`;
    }
    html += '</tr></thead><tbody class="divide-y divide-white/5">';

    // Auto-Grid Body
    for (let r = 1; r < rows.length; r++) {
        html += '<tr class="hover:bg-white/5 transition-colors">';
        const row = rows[r];
        for (let c = 0; c < maxCols; c++) {
            const cellText = row[c] || '&nbsp;';
            html += `<td class="px-4 py-2 text-sm text-slate-300 border-x border-white/5">${cellText}</td>`;
        }
        html += '</tr>';
    }

    html += '</tbody></table></div>';
    return html;
}

/**
 * Converts markdown links to HTML with URL sanitization.
 */
function convertLinksToHtml(html: string): string {
    const sanitizeUrl = (url: string): string => {
        const decoded = url.replace(/&amp;/g, '&');
        const trimmed = decoded.trim().toLowerCase();
        return (trimmed.startsWith('http:') || trimmed.startsWith('https:') || trimmed.startsWith('mailto:')) ? url : '';
    };

    return html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
        const safe = sanitizeUrl(url);
        return safe ? `<a href="${safe}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">${text}</a>` : text;
    });
}

/**
 * Converts markdown lists (ul/ol) to HTML with styling.
 */
function convertListsToHtml(html: string): string {
    const contentLines = html.split('\n');
    const processed: string[] = [];
    let currentList: 'ul' | 'ol' | null = null;

    for (let i = 0; i < contentLines.length; i++) {
        const line = contentLines[i];
        const trimmed = line.trim();

        // Match lists (allow indentation)
        // Supported markers: *, -, •, ·
        const ulMatch = line.match(/^(\s*)([\*\-\u2022\u00B7]) (.*)$/);
        const olMatch = line.match(/^(\s*)(\d+)\. (.*)$/);

        // Handle ---DIVIDER--- as a list-closer but also a standalone block
        const isDivider = trimmed === '---DIVIDER---';

        if (ulMatch || olMatch) {
            const isUl = !!ulMatch;
            const type = isUl ? 'ul' : 'ol';
            // Use correct match groups: 1=indent, 2=marker, 3=content
            const content = isUl ? ulMatch[3] : olMatch[3];
            const indent = (isUl ? ulMatch[1] : olMatch[1]).length;

            if (currentList !== type) {
                if (currentList) processed.push(`</${currentList}>`);
                processed.push(`<${type} class="space-y-1.5 my-3 ${indent > 0 ? 'ml-6' : ''}">`);
                currentList = type;
            }
            processed.push(`<li class="ml-6 list-${isUl ? 'disc' : 'decimal'} list-outside marker:text-cyan-400/60 pl-1">${content}</li>`);
        } else if (trimmed === "" && i < contentLines.length - 1 && (contentLines[i+1].match(/^(\s*)[\*\-] /) || contentLines[i+1].match(/^(\s*)\d+\. /))) {
            // Skip empty lines between list items
            continue;
        } else {
            // Found a non-list line, close any open list
            if (currentList) {
                processed.push(`</${currentList}>`);
                currentList = null;
            }

            if (isDivider) {
                // Preserve divider marker on its own line (no paragraph wrapper)
                processed.push('\n---DIVIDER---\n');
            } else if (trimmed) {
                // Wrap non-tag lines in paragraph-like div (except if they already start with a block tag)
                const blockTags = ['<h1', '<h2', '<h3', '<pre', '<table', '<blockquote', '<div', '<details'];
                const startsWithBlock = blockTags.some(tag => trimmed.startsWith(tag));

                if (!startsWithBlock) {
                    processed.push(`<div class="mb-3 leading-loose">${trimmed}</div>`);
                } else {
                    processed.push(line);
                }
            }
        }
    }

    if (currentList) processed.push(`</${currentList}>`);

    return processed.join('');
}

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
