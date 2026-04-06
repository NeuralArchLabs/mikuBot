/**
 * Formatting Helpers
 * Data formatting and HTML conversion utilities
 */

/** Emoji shortcode map */
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

/**
 * Converts normalized Markdown to HTML with custom styling.
 *
 * IMPORTANT: This expects text to be already normalized by formatFinalResponse().
 * The DIVIDER marker should already be in place.
 */
export const toHtml = (md: string): string => {
    if (!md) return '';

    let html = md;
    const pieces: string[] = [];

    // 0. PRE-EXTRACTION: Protect math and code blocks first
    
    // 1a. Math block formulas ($$ ... $$) - Process FIRST to protect backslashes
    html = html.replace(/\$\$([\s\S]*?)\$\$/gs, (match, formula) => {
        const id = `__BLOCK_${pieces.length}__`;
        const renderedMath = convertMathToHtml(formula.trim());
        pieces.push(`<div class="my-6 p-6 bg-black/20 border border-white/5 rounded-xl text-center font-serif text-lg italic text-slate-100 overflow-x-auto shadow-inner math-container">${renderedMath}</div>`);
        return `\n${id}\n`;
    });

    // 1b. Inline math ($ ... $) - Multi-line support
    html = html.replace(/\$([\s\S]+?)\$/gs, (match, formula) => {
        const id = `__BLOCK_${pieces.length}__`;
        // Use inline-flex and padding to prevent fraction clipping
        pieces.push(`<span class="font-serif italic text-amber-200 bg-white/5 px-1.5 py-1 rounded-md mx-0.5 shadow-sm border-b border-white/10 math-inline inline-flex items-center align-middle flex-wrap">${convertMathToHtml(formula.trim())}</span>`);
        return id;
    });

    // 0. PRE-EXTRACTION: Protect inline and fenced code blocks
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
        const copyButton = `<button class="absolute top-5 right-5 text-slate-500/60 hover:text-cyan-400/90 p-1 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-90 cursor-pointer z-10" onclick="const btn=this; const icon=btn.querySelector('i'); const code=decodeURIComponent('${encodedCode}'); navigator.clipboard.writeText(code).then(() => { icon.className='fas fa-check text-emerald-400'; setTimeout(() => icon.className='fas fa-copy', 2000); })"><i class="fas fa-copy text-sm"></i></button>`;
        pieces.push(`<pre class="${containerClass}">${copyButton}<code class="text-sm shadow-none font-mono leading-relaxed">${highlighted}</code></pre>`);
        return `\n${id}\n`;
    });

    html = html.replace(/`([^`]+)`/g, (match, code) => {
        const id = `__BLOCK_${pieces.length}__`;
        // Escape < and > to prevent them from becoming pieces later
        const escapedCode = code.replace(/</g, '‹').replace(/>/g, '›');
        pieces.push(`<code class="bg-black/40 px-1.5 py-0.5 rounded text-amber-300 font-mono text-[0.9em] border border-white/10 mx-1">${escapedCode}</code>`);
        return id;
    });

    // 1. Protect HTML tags that should render as actual elements
    html = html.replace(/<details([^>]*)>([\s\S]*?)<\/details>/gi, (match, attrs, content) => {
        const id = `__BLOCK_${pieces.length}__`;
        let sMatch = content.match(/<summary>([\s\S]*?)<\/summary>/i);
        let summaryText = sMatch ? sMatch[1].replace(/^[▶►▸▼] ?/g, '').trim() : 'Details';
        let bodyRaw = sMatch ? content.replace(sMatch[0], '') : content;
        const isOpen = attrs.toLowerCase().includes('open');

        pieces.push(`<details ${isOpen ? 'open' : ''} class="bg-black/10 border border-white/5 rounded-xl my-6 overflow-hidden group/details shadow-2xl transition-all cursor-pointer">` +
            `<summary class="px-8 py-5 font-black text-cyan-400/90 uppercase tracking-widest text-[11px] hover:bg-white/5 transition-all outline-none list-none select-none flex items-center gap-3">` +
            `<span class="group-open/details:rotate-90 transition-transform">▶</span>${summaryText}</summary>` +
            `<div class="details-content-body px-12 py-8 text-slate-300 leading-loose bg-black/10 select-text border-t border-white/5">${toHtml(bodyRaw.trim())}</div></details>`);
        return `\n${id}\n`;
    });

    // Protect <div> with full content
    html = html.replace(/<div\s+([^>]*?)>([\s\S]*?)<\/div>/gi, (match, attrs, content) => {
        const id = `__BLOCK_${pieces.length}__`;
        pieces.push(`<div ${attrs}>${toHtml(content)}</div>`);
        return `\n${id}\n`;
    });

    // 1c. Universal Admonition Parser — Phase 1
    html = html.replace(/^(?:>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|DANGER|INFO|SUCCESS|FAILURE|BUG|EXAMPLE|QUOTE|QUESTION|FAQ)\]([\-\+])?(?:\s+(.*))?\s*?\n?)((?:(?!(?:>\s*\[!)).*\n?)*)/gim, (match, type, collapseSign, title, body) => {
        const id = `__BLOCK_${pieces.length}__`;
        const typeUp = type.toUpperCase();
        
        let bodyLines = body.split('\n');
        let actualBody = [];
        for (let line of bodyLines) {
            if (line.trim().startsWith('>') || (line.trim() === '' && actualBody.length > 0)) {
                actualBody.push(line.replace(/^\s*>\s?/, ''));
            } else {
                break;
            }
        }
        
        const content = actualBody.join('\n').trim();
        const styles: Record<string, { icon: string, color: string, border: string, bg: string, glow?: string }> = {
            'NOTE':      { icon: 'ℹ️', color: 'text-blue-400',    border: 'border-blue-500/40',    bg: 'bg-blue-500/5' },
            'TIP':       { icon: '💡', color: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-500/5' },
            'IMPORTANT': { icon: '❗', color: 'text-amber-400',   border: 'border-amber-500/40',   bg: 'bg-amber-500/5' },
            'WARNING':   { icon: '⚠️', color: 'text-orange-400',  border: 'border-orange-500/40',  bg: 'bg-orange-500/5' },
            'CAUTION':   { icon: '🔴', color: 'text-rose-400',    border: 'border-rose-500/40',    bg: 'bg-rose-500/5' },
            'DANGER':    { icon: '☠️', color: 'text-red-400',      border: 'border-red-500/50',      bg: 'bg-red-500/8',      glow: 'shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]' },
            'INFO':      { icon: '📋', color: 'text-sky-400',      border: 'border-sky-500/40',      bg: 'bg-sky-500/5',      glow: 'shadow-[inset_0_0_20px_rgba(14,165,233,0.04)]' },
            'SUCCESS':   { icon: '✅', color: 'text-green-400',    border: 'border-green-500/45',    bg: 'bg-green-500/7',    glow: 'shadow-[inset_0_0_20px_rgba(34,197,94,0.05)]' },
            'FAILURE':   { icon: '💥', color: 'text-rose-400',     border: 'border-rose-500/50',     bg: 'bg-rose-500/7',     glow: 'shadow-[inset_0_0_20px_rgba(244,63,94,0.05)]' },
            'BUG':       { icon: '🐛', color: 'text-fuchsia-400',  border: 'border-fuchsia-500/45',  bg: 'bg-fuchsia-500/6',  glow: 'shadow-[inset_0_0_20px_rgba(217,70,239,0.04)]' },
            'EXAMPLE':   { icon: '📎', color: 'text-violet-400',   border: 'border-violet-500/40',   bg: 'bg-violet-500/5',   glow: 'shadow-[inset_0_0_20px_rgba(139,92,246,0.04)]' },
            'QUOTE':     { icon: '💬', color: 'text-slate-400',    border: 'border-slate-500/40',    bg: 'bg-slate-800/40',   glow: 'shadow-[inset_0_0_20px_rgba(148,163,184,0.04)]' },
            'QUESTION':  { icon: '❓', color: 'text-cyan-400',     border: 'border-cyan-500/40',     bg: 'bg-cyan-500/5',     glow: 'shadow-[inset_0_0_20px_rgba(34,211,238,0.04)]' },
            'FAQ':       { icon: '❔', color: 'text-purple-400',   border: 'border-purple-500/40',   bg: 'bg-purple-500/5',   glow: 'shadow-[inset_0_0_20px_rgba(168,85,247,0.04)]' },
        };

        const s = styles[typeUp] || styles['INFO'];
        const displayTitle = title ? title.replace(/^[>\s]+/, '').trim() : typeUp;
        const isCollapsible = !!collapseSign;
        const isOpen = collapseSign === '+';

        const bodyHtml = content ? `<div class="text-sm text-slate-300 ${isCollapsible ? 'mt-3 pt-3 border-t border-white/5' : 'leading-relaxed'} child-content typing-content">${toHtml(content)}</div>` : '';
        
        if (isCollapsible) {
            pieces.push(`<details class="group/callout border-l-4 ${s.border} ${s.bg} ${s.glow || ''} pl-4 pr-3 py-3 my-4 rounded-none overflow-hidden transition-all duration-300 select-none cursor-pointer" ${isOpen ? 'open' : ''}>`
                + `<summary class="flex items-center gap-2 font-bold text-xs uppercase tracking-wider ${s.color} non-typing outline-none list-none text-left">`
                + `<span class="group-open/callout:rotate-90 transition-transform duration-200">▶</span> ${s.icon} ${displayTitle}</summary>${bodyHtml}</details>`);
        } else {
            pieces.push(`<blockquote class="border-l-4 ${s.border} ${s.bg} ${s.glow || ''} pl-4 pr-3 py-3 my-4 rounded-none overflow-hidden" data-type="admonition">`
                + `<div class="flex items-center gap-2 mb-1.5 font-bold text-xs uppercase tracking-wider ${s.color} non-typing">${s.icon} ${displayTitle}</div>${bodyHtml}</blockquote>`);
        }
        
        const remainder = bodyLines.slice(actualBody.length).join('\n');
        return `\n${id}\n${remainder}`;
    });

    // 1d. Standard Blockquote Parser (Phase 1)
    html = html.replace(/^((?:>.*\n?)+)/gm, (match) => {
        if (match.includes('__BLOCK_')) return match;
        const id = `__BLOCK_${pieces.length}__`;
        const content = match.replace(/^>\s?/gm, '').trim();
        pieces.push(`<blockquote class="border-l-4 border-cyan-500/20 pl-4 pr-3 py-3 my-4 bg-white/5 rounded-r-lg italic text-slate-300 leading-relaxed child-content typing-content">${toHtml(content)}</blockquote>`);
        return `\n${id}\n`;
    });

    // 1e. Image & Asset Protection (Phase 2)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, altText, urlRaw) => {
        const id = `__BLOCK_${pieces.length}__`;
        let width = '';
        let height = '';
        let cleanAlt = altText;

        const url = urlRaw
            .replace(/‹/g, '<').replace(/›/g, '>')
            .replace(/&amp;/g, '&');

        if (altText.includes('|')) {
            const parts = altText.split('|');
            cleanAlt = parts[0];
            const size = parts[1];
            if (size.includes('x')) {
                const sizes = size.split('x');
                width = `width="${sizes[0]}"`;
                height = `height="${sizes[1]}"`;
            } else {
                width = `width="${size}"`;
            }
        }

        pieces.push(`<div class="image-container flex flex-col items-center justify-center my-6 group/img">` +
            `<img src="${url}" alt="${cleanAlt}" ${width} ${height} class="max-w-full h-auto rounded-2xl border border-white/10 shadow-2xl transition-all group-hover/img:scale-[1.01] hover:shadow-cyan-500/10" />` +
            (cleanAlt ? `<span class="mt-2 text-[10px] text-slate-500 font-mono tracking-tight opacity-0 group-hover/img:opacity-100 transition-opacity italic">${cleanAlt}</span>` : '') +
            `</div>`);
        return `\n${id}\n`;
    });

    // 1f. Link Protection (Phase 2)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, urlRaw) => {
        const id = `__BLOCK_${pieces.length}__`;
        const url = urlRaw
            .replace(/‹/g, '<').replace(/›/g, '>')
            .replace(/&amp;/g, '&');
            
        const isExternal = url.startsWith('http');
        const icon = isExternal ? '<i class="fas fa-external-link-alt text-[10px] ml-1 opacity-50 group-hover:opacity-100"></i>' : '';
        pieces.push(`<a href="${url}" target="_blank" rel="noopener noreferrer" class="group inline-flex items-baseline text-cyan-400 hover:text-cyan-300 font-bold underline underline-offset-4 decoration-cyan-500/30 hover:decoration-cyan-400/60 transition-all mx-0.5">${text}${icon}</a>`);
        return id;
    });

    html = html
        .replace(/<span\s*([^>]*?)>/gi, '‹span $1›')
        .replace(/<\/span>/g, '‹/span›')
        .replace(/<p\s*([^>]*?)>/gi, '‹p $1›')
        .replace(/<\/p>/g, '‹/p›')
        .replace(/<br\s*\/?>/gi, '‹br›')
        .replace(/<h([1-6])\s*([^>]*?)>/gi, '‹h$1 $2›')
        .replace(/<\/h([1-6])>/gi, '‹/h$1›')
        .replace(/<strong>/g, '‹strong›')
        .replace(/<\/strong>/g, '‹/strong›')
        .replace(/<em>/g, '‹em›')
        .replace(/<\/em>/g, '‹/em›')
        .replace(/<small\s*([^>]*?)>/gi, '‹small $1›')
        .replace(/<\/small>/g, '‹/small›')
        .replace(/<code\s*([^>]*?)>/gi, '‹code $1›')
        .replace(/<\/code>/g, '‹/code›')
        .replace(/<kbd\s*([^>]*?)>/gi, '‹kbd $1›')
        .replace(/<\/kbd>/g, '‹/kbd›')
        .replace(/<mark\s*([^>]*?)>/gi, '‹mark $1›')
        .replace(/<\/mark>/g, '‹/mark›')
        .replace(/<abbr\s+([^>]+)>/gi, '‹abbr $1›')
        .replace(/<\/abbr>/g, '‹/abbr›')
        .replace(/<u>/g, '‹u›')
        .replace(/<\/u>/g, '‹/u›')
        .replace(/<center\s*([^>]*?)>/gi, '‹center $1›')
        .replace(/<\/center>/gi, '‹/center›');

    // 3. Restore protected HTML tags with styles
    html = html
        .replace(/‹span\s*([^›]*?)›/gi, '<span $1>')
        .replace(/‹\/span›/g, '</span>')
        .replace(/‹p\s*([^›]*?)›/gi, '<p $1>')
        .replace(/‹\/p›/g, '</p>')
        .replace(/‹br›/g, '<br/>')
        .replace(/‹h([1-6])\s*([^›]*?)›/gi, '<h$1 class="text-inherit font-black my-2" $2>')
        .replace(/‹\/h([1-6])›/g, '</h$1>')
        .replace(/‹strong›/g, '<strong class="text-amber-400 mx-0.5">')
        .replace(/‹\/strong›/g, '</strong>')
        .replace(/‹em›/g, '<em class="text-slate-300 mx-0.5">')
        .replace(/‹\/em›/g, '</em>')
        .replace(/‹small\s*([^›]*?)›/gi, '<small class="text-[0.85em] opacity-80 mx-1" $1>')
        .replace(/‹\/small›/g, '</small>')
        .replace(/‹code\s*([^›]*?)›/gi, '<code class="bg-black/40 px-1.5 py-0.5 rounded text-amber-300 font-mono text-[0.9em] border border-white/10 mx-1" $1>')
        .replace(/‹\/code›/g, '</code>')
        .replace(/‹kbd\s*([^›]*?)›/gi, '<kbd class="bg-black/50 border border-white/20 rounded px-1.5 py-0.5 text-xs font-mono text-slate-200 shadow-sm mx-1" $1>')
        .replace(/‹\/kbd›/g, '</kbd>')
        .replace(/‹mark\s*([^›]*?)›/gi, '<mark class="bg-amber-400/25 text-amber-200 px-1 py-0.5 rounded-sm border-b border-amber-400/30 mx-1" $1>')
        .replace(/‹\/mark›/g, '</mark>')
        .replace(/‹abbr\s+([^›]+)›/g, '<abbr $1 class="cursor-help border-b border-dotted border-cyan-400/50 decoration-cyan-400/30 text-cyan-200/90 font-bold mx-1">')
        .replace(/‹\/abbr›/g, '</abbr>')
        .replace(/‹u›/g, '<u class="underline underline-offset-2 decoration-cyan-500/40">')
        .replace(/‹\/u›/g, '</u>')
        .replace(/‹center\s*([^›]*?)›/gi, '<div class="text-center w-full" $1>')
        .replace(/‹\/center›/g, '</div>')
        .replace(/‹div-center›/g, '<div style="text-align:center">')
        .replace(/‹img\s+([^›]+)›/g, '<img $1 class="max-w-full h-auto rounded-xl border border-white/10 my-4" />');

    html = convertAbbreviationsToHtml(html);
    html = convertDefinitionListsToHtml(html);

    html = html.replace(/\\`/g, '‹esc-backtick›');
    html = html.replace(/`([^`\n]+)`/g, '<code class="bg-black/30 px-1.5 py-0.5 rounded text-amber-300 font-mono text-xs border border-white/10">$1</code>');
    html = html.replace(/‹esc-backtick›/g, '`');

    html = convertTablesToHtml(html);

    html = html.replace(/^###### (.+)$/gm, '<h6 class="text-xs font-bold text-slate-500 mt-3 mb-1">$1</h6>');
    html = html.replace(/^##### (.+)$/gm, '<h5 class="text-xs font-bold text-slate-400 mt-3 mb-1">$1</h5>');
    html = html.replace(/^#### (.+)$/gm, '<h4 class="text-sm font-bold text-slate-200 mt-4 mb-2">$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-slate-100 mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-md font-bold text-cyan-400 mt-5 mb-1">$1</h2><div class="h-px w-full" style="background: linear-gradient(to right, transparent 0%, rgba(255,255,255,0.15) 2%, rgba(255,255,255,0.15) 98%, transparent 100%); margin-bottom: 1rem;"></div>');
    html = html.replace(/^# (.+)$/gm, '<h1 class="text-lg font-extrabold text-white mt-6 mb-1">$1</h1><div class="h-px w-full" style="background: linear-gradient(to right, transparent 0%, rgba(34,211,238,0.3) 2%, rgba(34,211,238,0.3) 98%, transparent 100%); margin-bottom: 1.5rem;"></div>');

    html = html.replace(/^(?:\s*[\*\-_]){3,}\s*$/gm, '<div class="divider-container"><div class="divider-line bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent h-px my-8"></div></div>');

    html = html.replace(/\\\*/g, '‹esc-asterisk›');
    html = html.replace(/\\#/g, '‹esc-hash›');
    html = html.replace(/\\-/g, '‹esc-dash›');

    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="text-amber-300"><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-amber-400">$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em class="text-slate-300">$1</em>');
    html = html.replace(/~~(.+?)~~/g, '<del class="text-slate-500 line-through">$1</del>');

    html = html.replace(/‹esc-asterisk›/g, '*');
    html = html.replace(/‹esc-hash›/g, '#');
    html = html.replace(/‹esc-dash›/g, '-');

    html = html.replace(/==([^=\n]+)==/g, '<mark class="bg-amber-400/25 text-amber-200 px-1 py-0.5 rounded-sm border-b border-amber-400/30 mx-0.5">$1</mark>');

    html = html.replace(/~([^~\n]+)~/g, '<sub class="text-slate-400 text-[0.7em] leading-none">$1</sub>');

    html = html.replace(/\^([^\^\n]+)\^/g, '<sup class="text-slate-400 text-[0.7em] leading-none">$1</sup>');

    html = html.replace(/\$([^$\n]+)\$/g, (match, formula) => {
        return `<span class="font-serif italic text-amber-200 bg-white/5 px-1.5 py-0.5 rounded-md mx-0.5 shadow-sm border-b border-white/10 math-inline">${convertMathToHtml(formula)}</span>`;
    });

    // 10. Footnote definitions [^1]: 
    html = html.replace(/^\[\^([^\]]+)\]:\s+(.*)$/gm, (match, label, content) => {
        return `<div class="text-[11px] text-slate-400/80 mt-1.5 flex gap-2 items-baseline leading-relaxed italic group/fn">`
             + `<span class="bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono px-1 rounded-sm text-[9px] min-w-[20px] text-center shadow-sm h-fit">#${label}</span>`
             + `<span class="flex-1 text-slate-400/70 antialiased font-medium opacity-90">${content}</span></div>`;
    });

    // 13b. Footnote references [^1]
    html = html.replace(/\[\^([^\]]+)\](?!=:)/g, '<sup class="text-cyan-400/90 font-black ml-0.5 text-[9px] tracking-tight hover:text-cyan-300 transition-colors cursor-help" style="vertical-align: super;">$1</sup>');

    // 12. Blockquotes (must be AFTER admonitions to avoid stealing lines)
    // Supports nesting: &gt;&gt; ... &gt;&gt;&gt; ...
    html = convertBlockquotesToHtml(html);

    // 13. Structural normalization (Lists with task support, Dividers)
    html = convertListsToHtml(html);

    // 13d. Hide HTML comments <!-- ... -->
    html = html.replace(/&lt;!--[\s\S]*?--&gt;/g, '');

    // 13e. <p align="center|right|left"> or <center> tags
    html = html.replace(/&lt;p\s+align="(center|right|left)"&gt;(.*?)&lt;\/p&gt;/gi, (_, align, content) =>
        `<div class="text-slate-200" style="text-align:${align}">${content}</div>`
    );
    html = html.replace(/&lt;center&gt;(.*?)&lt;\/center&gt;/gi, '<div class="text-center text-slate-200">$1</div>');

    // 13f. Visual progress bars — Support for [====], [████], [▓▓▓▓]
    html = html.replace(/^([\w\s]+):\s*([\[\(])([=#\*\u2588\u2593\u2592\u2591\s]{3,})([\]\)])\s*(\d+%)\s*$/gm, (_, label, open, bar, close, pct) => {
        const percent = parseFloat(pct);
        const color = percent >= 80 ? 'bg-cyan-500' : percent >= 50 ? 'bg-blue-500' : percent >= 25 ? 'bg-amber-500' : 'bg-red-500';
        return `<div class="flex items-center gap-3 my-4 shadow-sm select-none">`
            + `<span class="text-slate-400 text-xs font-mono min-w-[90px]">${label.trim()}:</span>`
            + `<div class="flex-1 max-w-[200px] h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/10 ring-1 ring-white/5">`
            + `<div class="h-full ${color} rounded-full transition-all duration-1000 shadow-[0_0_10px_currentColor]/40" style="width:${percent}%"></div>`
            + `</div>`
            + `<span class="text-xs font-mono font-black text-slate-300 w-[45px] text-right">${pct}</span>`
            + `</div>`;
    });

    // 13g. Emoji shortcodes :smile:
    html = html.replace(/:([a-z_]+):/g, (match, code) => {
        return EMOJI_MAP[code] || match;
    });

    // 14. Restoration: inject protected blocks back
    // Use multi-pass for nested blocks (e.g., inline code inside details)
    let iterations = 0;
    while (html.includes('__BLOCK_') && iterations < 5) {
        html = html.replace(/__BLOCK_(\d+)__/g, (match, indexStr) => {
            const index = parseInt(indexStr);
            return pieces[index] !== undefined ? pieces[index] : match;
        });
        iterations++;
    }

    // 14b. Final Abbreviation pass: Apply to the fully assembled text
    // (excluding text inside HTML tags to avoid breaking attributes/classes)
    html = applyAbbreviationsToHtml(html);

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
                output.push(`<blockquote class="border-l-4 border-cyan-500/${opacity} pl-3 italic text-slate-300 my-4 bg-cyan-500/5 py-3 pr-2 rounded-none">`);
                openLevels++;
            }
            // Close excess levels
            while (openLevels > level) {
                output.push('</blockquote>');
                openLevels--;
            }
            // Add content directly to the current blockquote level
            output.push(content);
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
                    processed.push(`<${type} class="space-y-1 mt-0.5 ml-5 cursor-default">`);
                    listStack.push({ type, indent });
                } else if (indent < top.indent) {
                    closeListsToLevel(indent);

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
                const blockTags = ['<h1', '<h2', '<h3', '<h4', '<h5', '<h6', '<pre', '<table', '<blockquote', '<div', '<details', '<summary', '<section', '<p', '<br', '</h', '</pre', '</table', '</blockquote', '</div', '</details', '</summary', '</section', '</p'];
                const startsWithBlock = blockTags.some(tag => trimmed.toLowerCase().startsWith(tag));
                
                // Formatting tags should remain inline and NOT trigger a div wrapper if they are on a line alone
                const inlineTags = ['<strong', '<em', '<small', '<code', '<kbd', '<mark', '<abbr', '<sup', '<sub', '<link'];
                const startsWithInline = inlineTags.some(tag => trimmed.toLowerCase().startsWith(tag));

                if (!startsWithBlock && !startsWithInline) {
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
 * Converts markdown definition lists to HTML.
 * Format: Term line followed by ": Definition" line(s)
 */
function convertDefinitionListsToHtml(html: string): string {
    const lines = html.split('\n');
    const output: string[] = [];
    let inDl = false;
    let pendingTerm: string | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const defMatch = trimmed.match(/^:\s+(.+)$/);

        if (defMatch) {
            if (!inDl) {
                // Start dl — flush the pending term first
                output.push('<dl class="my-3 space-y-1.5">');
                inDl = true;
                if (pendingTerm !== null) {
                    output.push(`<dt class="text-slate-200 font-bold text-sm mt-2">${pendingTerm}</dt>`);
                    pendingTerm = null;
                }
            } else if (pendingTerm !== null) {
                output.push(`<dt class="text-slate-200 font-bold text-sm mt-2">${pendingTerm}</dt>`);
                pendingTerm = null;
            }
            output.push(`<dd class="text-slate-400 text-sm ml-4 pl-3 border-l-2 border-white/10 leading-relaxed">${defMatch[1]}</dd>`);
        } else {
            if (inDl) {
                output.push('</dl>');
                inDl = false;
            }
            // Check if next line is a definition (making this line a term)
            const nextLine = lines[i + 1]?.trim() || '';
            if (nextLine.match(/^:\s+/) && trimmed && !trimmed.startsWith('<')) {
                pendingTerm = trimmed;
            } else {
                if (pendingTerm !== null) {
                    // Orphan term (no definition followed), just output as plain text
                    output.push(pendingTerm);
                    pendingTerm = null;
                }
                output.push(line);
            }
        }
    }

    if (inDl) output.push('</dl>');
    if (pendingTerm !== null) output.push(pendingTerm);

    return output.join('\n');
}

let cachedAbbrMap: Record<string, string> = {};

/**
 * Extracts abbreviation definitions from text.
 */
function convertAbbreviationsToHtml(html: string): string {
    cachedAbbrMap = {};
    return html.replace(/^\*\[([^\]]+)\]:\s+(.*)$/gm, (match, abbr, desc) => {
        cachedAbbrMap[abbr] = desc;
        return '';
    });
}

/**
 * Applies cached abbreviations to the fully rendered HTML.
 * Uses a text-node-only replacement strategy via regex lookahead.
 */
function applyAbbreviationsToHtml(html: string): string {
    if (Object.keys(cachedAbbrMap).length === 0) return html;
    
    let result = html;
    Object.keys(cachedAbbrMap).forEach(abbr => {
        const desc = cachedAbbrMap[abbr];
        // Only replace abbreviations that are NOT inside HTML tags (e.g. within <...>)
        // This is a simplified regex-based approach for the node-less environment
        const regex = new RegExp(`\\b${abbr}\\b(?![^<]*>)`, 'g');
        result = result.replace(regex, `<abbr title="${desc}" class="cursor-help border-b border-dotted border-cyan-400/50 decoration-cyan-400/30">${abbr}</abbr>`);
    });

    return result;
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
/**
 * Converts basic LaTeX-like math syntax to styled HTML/Unicode.
 * Handles: Fractions, Greek letters, Operators, Matrices, and Brackets.
 */
function convertMathToHtml(math: string): string {
    let html = math;

    // 1. Basic cleaning and escaping
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // 2. Matrices: \begin{pmatrix} a & b \\ c & d \end{pmatrix}
    const matrixRegex = /\\begin\{(p|b|v|V|B)matrix\}([\s\S]*?)\\end\{\1matrix\}/g;
    html = html.replace(matrixRegex, (match, type, content) => {
        const rows = content.trim().split(/\\\\/);
        const bracketType: Record<string, [string, string]> = {
            'p': ['(', ')'], 'b': ['[', ']'], 'v': ['|', '|'], 'V': ['‖', '‖'], 'B': ['{', '}']
        };
        const [open, close] = bracketType[type] || ['(', ')'];
        
        let matrixHtml = `<span class="inline-flex items-center mx-1"><span class="text-2xl font-light scale-y-[1.5] mr-1">${open}</span>`;
        matrixHtml += `<span class="grid gap-x-3 gap-y-1 text-center" style="grid-template-columns: repeat(${rows[0].split(/[&]/).length}, auto)">`;
        
        rows.forEach(row => {
            const cells = row.split(/[&]/);
            cells.forEach(cell => {
                matrixHtml += `<span class="px-1">${convertMathToHtml(cell.trim())}</span>`;
            });
        });
        
        matrixHtml += `</span><span class="text-2xl font-light scale-y-[1.5] ml-1">${close}</span></span>`;
        return matrixHtml;
    });

    // 3. Fractions: \frac{num}{den}
    html = html.replace(/\\frac\{((?:[^{}]|\{[^{}]*\})*)\}\{((?:[^{}]|\{[^{}]*\})*)\}/g, (match, num, den) => {
        return `<span class="inline-flex flex-col items-center align-middle mx-1"><span class="border-b border-white/30 px-1 leading-tight">${convertMathToHtml(num)}</span><span class="leading-tight px-1">${convertMathToHtml(den)}</span></span>`;
    });

    // 3b. Binomial coefficients: \binom{n}{k}
    html = html.replace(/\\binom\{((?:[^{}]|\{[^{}]*\})*)\}\{((?:[^{}]|\{[^{}]*\})*)\}/g, (match, n, k) => {
        return `<span class="inline-flex items-center mx-1"><span class="text-2xl font-light scale-y-[1.2] mr-0.5">(</span>`
             + `<span class="inline-flex flex-col items-center align-middle"><span class="leading-tight">${convertMathToHtml(n)}</span><span class="leading-tight">${convertMathToHtml(k)}</span></span>`
             + `<span class="text-2xl font-light scale-y-[1.2] ml-0.5">)</span></span>`;
    });

    // 3c. Cases: \begin{cases} ... \end{cases}
    html = html.replace(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g, (match, content) => {
        const rows = content.trim().split(/\\\\/);
        let casesHtml = `<span class="inline-flex items-center mx-1"><span class="text-4xl font-extralight scale-y-[2.2] scale-x-[0.8] mr-2 text-cyan-400/40">{</span>`;
        casesHtml += `<span class="flex flex-col text-left text-sm gap-1">`;
        rows.forEach(row => {
            const parts = row.split(/&/);
            casesHtml += `<span class="flex gap-4"><span>${convertMathToHtml(parts[0].trim())}</span>${parts[1] ? `<span class="opacity-60">${convertMathToHtml(parts[1].trim())}</span>` : ''}</span>`;
        });
        casesHtml += `</span></span>`;
        return casesHtml;
    });

    // 4. Common Operators & Large Symbols
    const ops: Record<string, string> = {
        '\\int': '∫', '\\sum': 'Σ', '\\lim': 'lim', '\\prod': 'Π', '\\sqrt': '√', '\\partial': '∂', '\\nabla': '∇',
        '\\infty': '∞', '\\approx': '≈', '\\neq': '≠', '\\leq': '≤', '\\geq': '≥', '\\pm': '±', '\\mp': '∓',
        '\\propto': '∝', '\\sim': '∼', '\\equiv': '≡', '\\hbar': 'ℏ', '\\varepsilon_0': 'ε₀', '\\varepsilon': 'ε', 
        '\\mathbf': '', '\\cdot': '·', '\\times': '×', '\\div': '÷',
        '\\exists': '∃', '\\forall': '∀', '\\in': '∈', '\\notin': '∉', '\\subset': '⊂', '\\supset': '⊃', 
        '\\cup': '∪', '\\cap': '∩', '\\setminus': '∖', '\\emptyset': '∅', '\\oint': '∮',
        '\\rightarrow': '→', '\\leftarrow': '←', '\\leftrightarrow': '↔', '\\Rightarrow': '⇒', '\\Leftarrow': '⇐', '\\Leftrightarrow': '⇔',
        '\\cdots': '⋯', '\\vdots': '⋮', '\\ddots': '⋱', '\\quad': '&nbsp;&nbsp;&nbsp;&nbsp;'
    };
    Object.entries(ops).forEach(([latex, uni]) => {
        const escaped = latex.replace(/\\/g, '\\\\');
        html = html.replace(new RegExp(escaped, 'g'), uni);
    });

    // 5. Greek Letters
    const greek: Record<string, string> = {
        '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ', '\\epsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η', 
        '\\theta': 'θ', '\\iota': 'ι', '\\kappa': 'κ', '\\lambda': 'λ', '\\mu': 'μ', '\\nu': 'ν', '\\xi': 'ξ', 
        '\\pi': 'π', '\\rho': 'ρ', '\\sigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ', '\\phi': 'φ', '\\chi': 'χ', 
        '\\psi': 'ψ', '\\omega': 'ω',
        '\\Alpha': 'Α', '\\Beta': 'Β', '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ', 
        '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Phi': 'Φ', '\\Psi': 'Ψ', '\\Omega': 'Ω'
    };
    Object.entries(greek).forEach(([latex, uni]) => {
        const escaped = latex.replace(/\\/g, '\\\\');
        html = html.replace(new RegExp(escaped, 'g'), uni);
    });

    // 6. Subscripts and superscripts (Handle correctly to NOT break commands)
    // We use a negative lookahead to ensure we don't match the start of a LaTeX command e.g. \sum_{i=1}
    html = html.replace(/_\{((?:[^{}]|\{[^{}]*\})*)\}/g, '<sub class="text-[0.75em] leading-none">$1</sub>');
    html = html.replace(/\^\{((?:[^{}]|\{[^{}]*\})*)\}/g, '<sup class="text-[0.75em] leading-none">$1</sup>');
    
    // Single-char scripts (must not be at start of command)
    html = html.replace(/([^\\])_([a-zA-Z0-9])/g, '$1<sub class="text-[0.75em] leading-none">$2</sub>');
    html = html.replace(/([^\\])\^([a-zA-Z0-9])/g, '$1<sup class="text-[0.75em] leading-none">$2</sup>');

    // 7. Styling cleanups
    html = html.replace(/\\sin/g, 'sin').replace(/\\cos/g, 'cos').replace(/\\tan/g, 'tan').replace(/\\log/g, 'log').replace(/\\ln/g, 'ln');
    html = html.replace(/\\hat\{([^}]*)\}/g, '<span class="inline-flex flex-col items-center"><span>^</span><span class="mt-[-1em]">$1</span></span>');
    html = html.replace(/\\vec\{([^}]*)\}/g, '<span class="inline-flex flex-col items-center"><span>→</span><span class="mt-[-1em]">$1</span></span>');
    html = html.replace(/\\mathbf\{([^}]*)\}/g, '<span class="font-bold">$1</span>');
    html = html.replace(/\\text\{([^}]*)\}/g, '<span class="font-sans italic opacity-80">$1</span>');

    return html;
}
