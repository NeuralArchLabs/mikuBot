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

    // 1. Protect HTML tags that should render as actual elements
    html = html
        .replace(/<details/g, '‹details')
        .replace(/<\/details>/g, '‹/details›')
        .replace(/<summary>/g, '‹summary›')
        .replace(/<\/summary>/g, '‹/summary›')
        .replace(/<sub>/g, '‹sub›')
        .replace(/<\/sub>/g, '‹/sub›')
        .replace(/<sup>/g, '‹sup›')
        .replace(/<\/sup>/g, '‹/sup›')
        .replace(/<kbd>/g, '‹kbd›')
        .replace(/<\/kbd>/g, '‹/kbd›')
        .replace(/<mark>/g, '‹mark›')
        .replace(/<\/mark>/g, '‹/mark›')
        .replace(/<u>/g, '‹u›')
        .replace(/<\/u>/g, '‹/u›')
        .replace(/<div\s+align="center">/gi, '‹div-center›')
        .replace(/<\/div>/g, '‹/div›');

    // 2. HTML escape (after protecting inline tags)
    html = html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // 3. Restore protected HTML tags with styles
    html = html
        .replace(/‹details/g, '<details class="bg-slate-900/40 border border-white/5 rounded-xl my-4 py-1"')
        .replace(/‹\/details›/g, '</details>')
        .replace(/‹summary›/g, '<summary class="px-4 py-2 cursor-pointer font-bold text-cyan-400">')
        .replace(/‹\/summary›/g, '</summary>')
        .replace(/‹sub›/g, '<sub>')
        .replace(/‹\/sub›/g, '</sub>')
        .replace(/‹sup›/g, '<sup>')
        .replace(/‹\/sup›/g, '</sup>')
        .replace(/‹kbd›/g, '<kbd class="bg-black/40 border border-white/15 rounded px-1.5 py-0.5 text-xs font-mono text-slate-200 shadow-sm mx-0.5">')
        .replace(/‹\/kbd›/g, '</kbd>')
        .replace(/‹mark›/g, '<mark class="bg-amber-400/20 text-amber-200 px-0.5 rounded">')
        .replace(/‹\/mark›/g, '</mark>')
        .replace(/‹u›/g, '<u class="underline underline-offset-2 decoration-cyan-500/40">')
        .replace(/‹\/u›/g, '</u>')
        .replace(/‹div-center›/g, '<div style="text-align:center">')
        .replace(/‹\/div›/g, '</div>');

    // 4. PRE-EXTRACTION: Protect high-priority blocks from being broken by line parsers
    const pieces: string[] = [];

    // 4a. Code blocks (fenced)
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
        const id = `__BLOCK_${pieces.length}__`;
        const langClean = lang.toLowerCase();
        const codeTrimmed = code.trim();
        const highlighted = highlightCode(codeTrimmed, langClean);
        const encodedCode = encodeURIComponent(codeTrimmed);
        
        const isDiagram = ['mermaid', 'tree', 'flowchart', 'graph', 'statediagram', 'pie', 'gitgraph', 'erdiagram', 'mindmap', 'statediagram-v2'].includes(langClean);
        const containerClass = isDiagram 
            ? 'relative group bg-black/40 px-12 py-10 rounded-3xl my-8 border border-transparent hover:border-cyan-500/25 shadow-2xl transition-all max-w-fit mx-auto min-w-[55%]' 
            : 'relative group bg-black/30 px-6 py-5 rounded-2xl my-6 overflow-x-auto border border-transparent hover:border-cyan-500/20 transition-all';
            
        // Minimalist premium copy button
        const copyButton = `<button class="absolute top-5 right-5 text-slate-500/60 hover:text-cyan-400/90 p-1 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-90 cursor-pointer z-10" title="Copy code" onclick="const btn=this; const icon=btn.querySelector('i'); const code=decodeURIComponent('${encodedCode}'); navigator.clipboard.writeText(code).then(() => { icon.className='fas fa-check text-emerald-400'; setTimeout(() => icon.className='fas fa-copy', 2000); })"><i class="fas fa-copy text-sm"></i></button>`;

        pieces.push(`<pre class="${containerClass}">${copyButton}<code class="text-sm shadow-none font-mono leading-relaxed">${highlighted}</code></pre>`);
        return `\n${id}\n`;
    });

    // 4b. Math block formulas ($$ ... $$)
    html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
        const id = `__BLOCK_${pieces.length}__`;
        pieces.push(`<div class="my-4 p-4 bg-black/20 border border-white/5 rounded-lg text-center font-serif text-lg italic text-slate-200 overflow-x-auto">${formula.trim()}</div>`);
        return `\n${id}\n`;
    });

    // 4c. Admonitions / GFM Callouts (&gt; [!TYPE])
    html = html.replace(/^&gt;\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n?((?:&gt;.*\n?)*)/gim, (match, type, body) => {
        const id = `__BLOCK_${pieces.length}__`;
        const content = body.replace(/^&gt;\s?/gm, '').trim();
        const styles: Record<string, { icon: string, color: string, border: string, bg: string }> = {
            'NOTE':      { icon: 'ℹ️', color: 'text-blue-400',    border: 'border-blue-500/30',    bg: 'bg-blue-500/5' },
            'TIP':       { icon: '💡', color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/5' },
            'IMPORTANT': { icon: '❗', color: 'text-amber-400',   border: 'border-amber-500/30',   bg: 'bg-amber-500/5' },
            'WARNING':   { icon: '⚠️', color: 'text-orange-400',  border: 'border-orange-500/30',  bg: 'bg-orange-500/5' },
            'CAUTION':   { icon: '🔴', color: 'text-rose-400',    border: 'border-rose-500/30',    bg: 'bg-rose-500/5' }
        };
        const s = styles[type.toUpperCase()];
        pieces.push(`<div class="my-3 p-3 ${s.bg} border-l-3 ${s.border} rounded-r">`
            + `<div class="flex items-center gap-2 mb-1 font-bold text-xs uppercase tracking-wider ${s.color}">${s.icon} ${type}</div>`
            + `<div class="text-sm text-slate-300 leading-relaxed">${content}</div></div>`);
        return `\n${id}\n`;
    });

    // 4d. Inline code (must be after code blocks)
    html = html.replace(/`([^`\n]+)`/g, '<code class="bg-black/30 px-1.5 py-0.5 rounded text-amber-300 font-mono text-xs border border-white/10">$1</code>');

    // 5. Tables
    html = convertTablesToHtml(html);

    // 6. Headings H1-H6 (process H6 first to avoid partial matches)
    html = html.replace(/^###### (.+)$/gm, '<h6 class="text-xs font-bold text-slate-500 mt-3 mb-1">$1</h6>');
    html = html.replace(/^##### (.+)$/gm, '<h5 class="text-xs font-bold text-slate-400 mt-3 mb-1">$1</h5>');
    html = html.replace(/^#### (.+)$/gm, '<h4 class="text-sm font-bold text-slate-200 mt-4 mb-2">$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-slate-100 mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-md font-bold text-cyan-400 mt-5 mb-1">$1</h2><div class="h-px w-full" style="background: linear-gradient(to right, transparent 0%, rgba(255,255,255,0.15) 2%, rgba(255,255,255,0.15) 98%, transparent 100%); margin-bottom: 1rem;"></div>');
    html = html.replace(/^# (.+)$/gm, '<h1 class="text-lg font-extrabold text-white mt-6 mb-1">$1</h1><div class="h-px w-full" style="background: linear-gradient(to right, transparent 0%, rgba(34,211,238,0.3) 2%, rgba(34,211,238,0.3) 98%, transparent 100%); margin-bottom: 1.5rem;"></div>');

    // 7. Horizontal rules (--- / *** / ___ standalone)
    html = html.replace(/^(\*{3,}|-{3,}|_{3,})$/gm, '<div class="divider-container"><div class="divider-line bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent h-px my-8"></div></div>');

    // 8. Bold, italic, strikethrough
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="text-amber-300"><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-amber-400">$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em class="text-slate-300">$1</em>');
    html = html.replace(/~~(.+?)~~/g, '<del class="text-slate-500 line-through">$1</del>');

    // 9. Inline math ($ ... $) — single-line only
    html = html.replace(/\$([^$\n]+)\$/g, '<span class="font-serif italic text-amber-200 bg-white/5 px-1.5 py-0.5 rounded-md mx-0.5 shadow-sm border-b border-white/10">$1</span>');

    // 10. Images  ![alt](url)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<div class="my-4"><img src="$2" alt="$1" class="max-w-full h-auto rounded-lg border border-white/10" onerror="this.style.display=\'none\'" /></div>');

    // 11. Links
    html = convertLinksToHtml(html);

    // 13a. Footnote definitions [^1]: (Process first to avoid collision)
    html = html.replace(/^\[\^([^\]]+)\]:\s+(.*)$/gm, (match, label, content) => {
        return `<div class="text-[11px] text-slate-400/80 mt-1.5 flex gap-2 items-baseline leading-relaxed italic group/fn">`
             + `<span class="bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono px-1 rounded-sm text-[9px] min-w-[20px] text-center shadow-sm h-fit">#${label}</span>`
             + `<span class="flex-1 text-slate-400/70 antialiased font-medium opacity-90">${content}</span></div>`;
    });

    // 13b. Footnote references [^1]
    html = html.replace(/\[\^([^\]]+)\](?!=:)/g, '<sup class="text-cyan-400/90 font-black ml-0.5 text-[9px] tracking-tight hover:text-cyan-300 transition-colors cursor-help" style="vertical-align: super;">$1</sup>');

    // 12. Blockquotes (supports nesting: &gt;&gt; ... &gt;&gt;&gt; ...)
    html = convertBlockquotesToHtml(html);

    // 13. Structural normalization (Lists with task support, Dividers)
    html = convertListsToHtml(html);

    // 14. Restoration: inject protected blocks back
    pieces.forEach((content, i) => {
        html = html.replace(`__BLOCK_${i}__`, content);
    });

    // 15. Final DIVIDER marker replacement
    html = html.replace(/---DIVIDER---/g, '<div class="divider-container"><div class="divider-line bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent h-px my-8"></div></div>');

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
 * Converts blockquotes including nested levels (&gt;&gt; nested)
 */
function convertBlockquotesToHtml(html: string): string {
    const lines = html.split('\n');
    const output: string[] = [];
    let openLevels = 0;

    for (const line of lines) {
        // Count how many &gt; prefixes this line has
        const match = line.match(/^((?:&gt;\s*)+)(.*)$/);
        if (match) {
            const prefix = match[1];
            const content = match[2].trim();
            const level = (prefix.match(/&gt;/g) || []).length;

            // Open any new levels
            while (openLevels < level) {
                const opacity = Math.max(10, 50 - (openLevels * 15));
                output.push(`<blockquote class="border-l-3 border-cyan-500/${opacity} pl-3 italic text-slate-300 my-2 bg-cyan-500/5 py-1.5 pr-2 rounded-r">`);
                openLevels++;
            }
            // Close excess levels
            while (openLevels > level) {
                output.push('</blockquote>');
                openLevels--;
            }
            output.push(content ? `<div>${content}</div>` : '');
        } else {
            // Close all open blockquotes
            while (openLevels > 0) {
                output.push('</blockquote>');
                openLevels--;
            }
            output.push(line);
        }
    }
    // Close remaining
    while (openLevels > 0) {
        output.push('</blockquote>');
        openLevels--;
    }

    return output.join('\n');
}

/**
 * Converts markdown lists (ul/ol) with task list support to HTML.
 */
function convertListsToHtml(html: string): string {
    const contentLines = html.split('\n');
    const processed: string[] = [];

    // Stack tracks open list tags and their indentation levels
    const listStack: { type: 'ul' | 'ol'; indent: number }[] = [];

    const closeListsToLevel = (targetIndent: number) => {
        while (listStack.length > 0 && listStack[listStack.length - 1].indent >= targetIndent) {
            const popped = listStack.pop()!;
            processed.push(`</li></${popped.type}>`);
        }
    };

    const closeAllLists = () => {
        while (listStack.length > 0) {
            const popped = listStack.pop()!;
            processed.push(`</li></${popped.type}>`);
        }
    };

    for (let i = 0; i < contentLines.length; i++) {
        const line = contentLines[i];
        const trimmed = line.trim();

        // Task list: - [x] or - [ ]
        const taskMatch = line.match(/^(\s*)([\*\-\u2022\u00B7]) \[(x| )\] (.*)$/i);
        // Standard unordered list
        const ulMatch = !taskMatch ? line.match(/^(\s*)([\*\-\u2022\u00B7]) (.*)$/) : null;
        // Ordered list
        const olMatch = !taskMatch && !ulMatch ? line.match(/^(\s*)(\d+)\. (.*)$/) : null;

        const isDivider = trimmed === '---DIVIDER---';

        if (taskMatch || ulMatch || olMatch) {
            const isTask = !!taskMatch;
            const isUl = isTask || !!ulMatch;
            const type: 'ul' | 'ol' = isUl ? 'ul' : 'ol';
            const content = isTask ? taskMatch[4] : (ulMatch ? ulMatch[3] : olMatch![3]);
            const rawIndent = (taskMatch ? taskMatch[1] : (ulMatch ? ulMatch[1] : olMatch![1])).length;
            const indent = rawIndent;
            const depth = listStack.length;

            if (depth === 0) {
                // First list item ever — open a new list
                const marginClass = 'my-2';
                processed.push(`<${type} class="space-y-1 ${marginClass} ml-6 cursor-default">`);
                listStack.push({ type, indent });
            } else {
                const top = listStack[listStack.length - 1];

                if (indent > top.indent) {
                    // Deeper nesting — open a child list inside the current <li>
                    processed.push(`<${type} class="space-y-1 mt-0.5 ml-5 cursor-default">`);
                    listStack.push({ type, indent });
                } else if (indent < top.indent) {
                    // Going back up — close nested lists until we match
                    closeListsToLevel(indent);

                    // If we still have a list open and it matches, close the previous <li>
                    if (listStack.length > 0) {
                        processed.push('</li>');
                    } else {
                        // All lists were closed, start fresh
                        processed.push(`<${type} class="space-y-1 my-3 ${isUl ? 'list-disc' : 'list-decimal'} list-outside ml-6 marker:text-cyan-400/60">`);
                        listStack.push({ type, indent });
                    }
                } else {
                    // Same level — close previous <li>, stay in same list
                    processed.push('</li>');
                }
            }

            // Render the <li>
            if (isTask) {
                const checked = taskMatch[3].toLowerCase() === 'x';
                const checkIcon = checked ? '☑' : '☐';
                const textClass = checked ? 'text-slate-500 line-through' : 'text-slate-300';
                processed.push(`<li class="list-none pl-1 flex items-center gap-3">`
                    + `<span class="text-cyan-400/60 text-base mb-0.5 mr-0.5">${checkIcon}</span>`
                    + `<span class="${textClass}">${content}</span>`);
            } else {
                processed.push(`<li class="pl-1">${content}`);
            }
        } else if (trimmed === "" && i < contentLines.length - 1 && (contentLines[i+1].match(/^(\s*)[\*\-] /) || contentLines[i+1].match(/^(\s*)\d+\. /))) {
            // Skip empty lines between list groups (keep list context open)
            continue;
        } else {
            // Non-list line — close everything
            if (listStack.length > 0) {
                closeAllLists();
            }

            if (isDivider) {
                processed.push('\n---DIVIDER---\n');
            } else if (trimmed) {
                const blockTags = ['<h1', '<h2', '<h3', '<h4', '<h5', '<h6', '<pre', '<table', '<blockquote', '<div', '<details', '</h', '</pre', '</table', '</blockquote', '</div', '</details'];
                const startsWithBlock = blockTags.some(tag => trimmed.toLowerCase().startsWith(tag));

                if (!startsWithBlock) {
                    processed.push(`<div class="mb-3 leading-loose">${trimmed}</div>`);
                } else {
                    processed.push(line);
                }
            }
        }
    }

    // Close any remaining open lists
    if (listStack.length > 0) {
        closeAllLists();
    }

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


/**
 * Dependency-free minimal syntax highlighter for Mermaid and common languages.
 * Uses a two-pass placeholder system to prevent self-matching inside HTML tags.
 */
function highlightCode(code: string, lang: string): string {
    if (!code) return '';

    // Code is already escaped by toHtml at the start of the process
    let highlighted = code;
    const tokens: string[] = [];

    const addToken = (content: string, className: string) => {
        const id = `##TOKEN_${tokens.length}##`;
        tokens.push(`<span class="${className}">${content}</span>`);
        return id;
    };

    if (lang === 'mermaid' || lang === 'flowchart' || lang === 'graph' || lang === 'gitgraph' || lang === 'erdiagram' || lang === 'mindmap' || lang === 'pie' || lang.startsWith('statediagram')) {
        // 1. Labels (between pipes) - Process first to protect content
        highlighted = highlighted.replace(/\|([^|]+)\|/g, (_, label) => addToken(`|${label}|`, 'text-emerald-400/80 italic'));

        // 2. Connectors (Arrows and lines) - Must use escaped versions because input is already escaped
        highlighted = highlighted.replace(/(--&gt;|--|==&gt;|-&gt;|-\.-&gt;|-.-|==|\|o--o\{|\|--\|\{|--o\{|--\|\{)/g, (match) => addToken(match, 'text-cyan-500 font-black'));

        // 3. Brackets and shapes
        highlighted = highlighted.replace(/([\[\]\(\)\{\}])/g, (match) => addToken(match, 'text-slate-500'));

        // 4. Mermaid Keywords (root types)
        highlighted = highlighted.replace(/\b(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|stateDiagram-v2|erDiagram|journey|gantt|pie|requirementDiagram|gitGraph|mindmap|root)\b/g, (match) => addToken(match, 'text-cyan-400 font-bold italic'));

        // 5. Directions and Sub-keywords
        highlighted = highlighted.replace(/\b(TD|LR|BT|RL|TB|branch|checkout|commit|merge|tag|title|showData|int|string|date|float|PK|FK)\b/g, (match) => addToken(match, 'text-indigo-400 font-bold'));

        // 6. Keywords
        highlighted = highlighted.replace(/\b(participant|actor|as|box|subgraph|end|state|note|over|left of|right of|title|section)\b/g, (match) => addToken(match, 'text-blue-400 font-medium'));
    } else if (lang === 'tree' || highlighted.includes('├──') || highlighted.includes('└──')) {
        // High-end Tree rendering
        // 1. Convert Tree Lines (ASCII)
        highlighted = highlighted.replace(/([│├└]──|[│])/g, (match) => addToken(match, 'text-cyan-500/40 font-bold'));
        
        // 2. Folders (names ending with / or starting with emoji+space)
        highlighted = highlighted.replace(/([\w\-_]+\/)/g, (match) => 
            addToken(`<i class="fas fa-folder text-amber-500/90 mr-1.5"></i>${match}`, 'text-amber-200/90 font-bold')
        );

        // 3. Files (names with extensions)
        highlighted = highlighted.replace(/([\w\-_]+\.(?:ts|js|json|md|py|css|html|tsx|jsx|env|cjs|mjs|txt))/g, (match) => 
            addToken(`<i class="far fa-file-code text-blue-400/80 mr-1.5"></i>${match}`, 'text-slate-200')
        );
    } else if (lang === 'dockerfile' || lang === 'docker') {
        highlighted = highlighted.replace(/\b(FROM|WORKDIR|COPY|RUN|EXPOSE|CMD|ENV|ARG|ENTRYPOINT|ADD|USER|VOLUME|LABEL|STOPSIGNAL|HEALTHCHECK|SHELL|AS)\b/g, (match) => addToken(match, 'text-cyan-400 font-bold'));
    } else if (lang === 'json') {
        // Key highlighting for JSON
        highlighted = highlighted.replace(/"([^"]+)":/g, (_, key) => `"${addToken(key, 'text-cyan-300')}":`);
    }

    // Default basic highlighting for other languages (numbers, strings, and standard keywords)
    highlighted = highlighted.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, (match) => addToken(match, 'text-emerald-400/80'));
    highlighted = highlighted.replace(/\b(\d+)\b/g, (match) => addToken(match, 'text-amber-400/80'));
    highlighted = highlighted.replace(/\b(true|false|null|undefined)\b/g, (match) => addToken(match, 'text-rose-400'));
    highlighted = highlighted.replace(/\b(const|let|var|function|return|if|else|for|while|import|export|from|class|def|try|except|await|async|interface|type|enum|pub|mut|impl|match|use|mod|fn|String|Option|Some|None|Result|Ok|Err)\b/g, (match) => addToken(match, 'text-cyan-400'));
    highlighted = highlighted.replace(/([\{\}\(\)\[\]\.,;:\+\-\*\/=<>!&|?])/g, (match) => addToken(match, 'text-slate-500'));

    // Pass 2: Restore tokens
    tokens.forEach((html, i) => {
        highlighted = highlighted.replace(`##TOKEN_${i}##`, html);
    });

    return highlighted;
}
