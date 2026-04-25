/**
 * Formatting Helpers
 * Data formatting and HTML conversion utilities
 */

/** Emoji shortcode map */
import { getEmojiAnimationClass } from '../animations/emojiAnimations';
import i18n from '../../i18n';
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
export const toHtml = (md: string, isStreaming: boolean = false, mode: 'full' | 'minimal' | 'none' = 'full'): string => {
    if (!md) return '';

    // Standard HTML Escaping for security
    const escape = (text: string) => text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    // MODE: NONE - Absolute raw text protection for user messages
    if (mode === 'none') {
        return escape(md).replace(/\n/g, '<br/>');
    }

    let html = md;
    
    // MODE: MINIMAL - Restricted formatting for thoughts (lists only)
    if (mode === 'minimal') {
        html = escape(html);
        html = convertListsToHtml(html);
        return html.replace(/\n/g, '<br/>');
    }

    // MODE: FULL - Premium experience
    const pieces: string[] = [];

    // 0. SIGNATURE SHIELD: Protect the assistant's visual signature
    // Pattern: {{ ... }} with typical signature content
    html = html.replace(/"?\{\{\s*([^\}]+?)\s*\}\}"?/g, (match, signContent) => {
        if (signContent.includes('≈') || signContent.includes('∫') || signContent.includes('~')) {
            const id = `__BLOCK_${pieces.length}__`;
            let styledInner = signContent.trim();

            // TIER 2: Strip inline backticks/quotes wrapping individual tokens inside the signature.
            // Handles: `🌸`, `≈̼^.┬.̼^≈‿⟆`, "token", 'token' — removes the wrappers, keeps the content.
            // SAFE: Only strips matched pairs of backticks/quotes immediately around a token (no spaces inside pair).
            styledInner = styledInner.replace(/`([^`\n]+?)`/g, '$1');   // `token` → token
            styledInner = styledInner.replace(/"([^"\n]+?)"/g, '$1');   // "token" → token
            styledInner = styledInner.replace(/'([^'\n]+?)'/g, '$1');   // 'token' → token
            // Multi-tone typography logic
            styledInner = styledInner.replace(/([≈_∫~⟆\u033c.]+)/g, '<span class="text-cyan-300 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)] font-bold">$1</span>');
            styledInner = styledInner.replace(/([\^‿])/g, '<span class="text-blue-400">$1</span>');
            styledInner = styledInner.replace(/(┬)/g, '<span class="text-blue-400">$1</span>');

            // Dynamic Emoji Animations
            // Matches modern multi-codepoint emojis securely using Unicode properties
            styledInner = styledInner.replace(/(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu, (emojiMatch) => {
                const animClass = getEmojiAnimationClass(emojiMatch);
                // Strip existing variation selectors and force Variation Selector-16 (color emoji)
                const forcedEmoji = emojiMatch.replace(/[\uFE0E\uFE0F]/g, '') + '\uFE0F';
                // Force a color-emoji specific font stack to prevent OS from rendering text variants
                return `<span class="${animClass}" style="font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Segoe UI Symbol', emoji; display: inline-block; vertical-align: middle;">${forcedEmoji}</span>`;
            });
            
            pieces.push(`<div class="signature-wrapper mb-8 mt-4 flex items-center">`
                + `<span class="inline-flex items-center h-9 font-mono font-black select-none overflow-visible relative `
                + `animate-sig-pop">`
                + `<div class="animate-sig-bg-walk mask-edge-fade"></div>`
                + `<span class="relative z-10 flex items-center h-full -translate-y-[1.5px]">`
                + `<span class="text-[18px] text-indigo-400 opacity-80 leading-none">{{</span>`
                // Directional clip-path replaces overflow-hidden to allow vertical glow bleed while clipping horizontal bounds for the spread animation
                + `<span class="inline-flex items-center justify-center h-full animate-sig-bracket-spread whitespace-nowrap" style="clip-path: inset(-25px -20px);">`
                + `<span class="text-[14px] text-indigo-200 uppercase animate-sig-text-glow px-2 leading-none">${styledInner}</span>`
                + `</span>`
                + `<span class="text-[18px] text-indigo-400 opacity-80 leading-none">}}</span>`
                + `</span></span></div>`);
            return id;
        }
        return match;
    });

    // 0b. SIGNATURE SHIELD — TIER 3: Core Pattern Detector
    // Catches the inner DNA pattern ≈̼^.┬.̼^≈‿⟆ even without {{ }} wrapper.
    // Handles: backtick-wrapped, quote-wrapped, emoji-preceded/followed, broken outer brackets.
    // SAFE: The pattern is unique enough (Unicode combining chars + box-drawing) to never
    //       false-positive on code, math, tables, or any other markdown construct.
    html = html.replace(
        // Match optional leading junk (backticks, quotes, `{{`) + optional emojis
        // + the core pattern + optional emojis + optional trailing junk (`}}`, quotes, backticks)
        /[`"']*(?:\{\{)?\s*[`"']*\s*((?:\p{Emoji_Presentation}|\p{Extended_Pictographic}|\uFE0F|\u200D|\uFE0E)*)\s*[`"']*\s*(≈̼\^\.┬\.̼\^≈‿⟆)\s*[`"']*\s*((?:\p{Emoji_Presentation}|\p{Extended_Pictographic}|\uFE0F|\u200D|\uFE0E)*)\s*[`"']*\s*(?:\}\})?[`"']*/gu,
        (fullMatch, leadEmojis, core, trailEmojis) => {
            // Safety: only act if the core unicode pattern is genuinely present
            if (!core || !core.includes('┬')) return fullMatch;

            // Already handled by Tier 1 (full {{ }}) → skip to avoid double render
            if (fullMatch.includes('__BLOCK_')) return fullMatch;

            // Normalize emojis — strip variation selectors for clean detection
            const normalizeEmoji = (s: string) => s.replace(/[\uFE0E\uFE0F]/g, '').trim();
            let lead = normalizeEmoji(leadEmojis);
            let trail = normalizeEmoji(trailEmojis);

            // Fill missing emojis with generics
            const DEFAULT_LEAD = '✨';
            const DEFAULT_TRAIL = '🌸';
            if (!lead) lead = DEFAULT_LEAD;
            if (!trail) trail = DEFAULT_TRAIL;

            // Build a canonical signature string to pass through the Tier 1 render path
            const canonical = `${lead} ${core} ${trail}`;

            // Render same pipeline as Tier 1
            let styledInner = canonical;
            styledInner = styledInner.replace(/([≈_∫~⟆\u033c.]+)/g, '<span class="text-cyan-300 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)] font-bold">$1</span>');
            styledInner = styledInner.replace(/([\^‿])/g, '<span class="text-blue-400">$1</span>');
            styledInner = styledInner.replace(/(┬)/g, '<span class="text-blue-400">$1</span>');
            styledInner = styledInner.replace(/(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu, (emojiMatch) => {
                const animClass = getEmojiAnimationClass(emojiMatch);
                const forcedEmoji = emojiMatch.replace(/[\uFE0E\uFE0F]/g, '') + '\uFE0F';
                return `<span class="${animClass}" style="font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Segoe UI Symbol', emoji; display: inline-block; vertical-align: middle;">${forcedEmoji}</span>`;
            });

            const id = `__BLOCK_${pieces.length}__`;
            pieces.push(`<div class="signature-wrapper mb-8 mt-4 flex items-center">`
                + `<span class="inline-flex items-center h-9 font-mono font-black select-none overflow-visible relative `
                + `animate-sig-pop">`
                + `<div class="animate-sig-bg-walk mask-edge-fade"></div>`
                + `<span class="relative z-10 flex items-center h-full -translate-y-[1.5px]">`
                + `<span class="text-[18px] text-indigo-400 opacity-80 leading-none">{{</span>`
                + `<span class="inline-flex items-center justify-center h-full animate-sig-bracket-spread whitespace-nowrap" style="clip-path: inset(-25px -20px);">`
                + `<span class="text-[14px] text-indigo-200 uppercase animate-sig-text-glow px-2 leading-none">${styledInner}</span>`
                + `</span>`
                + `<span class="text-[18px] text-indigo-400 opacity-80 leading-none">}}</span>`
                + `</span></span></div>`);
            return id;
        }
    );


    
    // 0. PRE-EXTRACTION: Protect inline and fenced code blocks
    // Multi-fence support (3+ backticks or tildes) for nested code blocks
    // Updated: relax ^ to ^[ \t]* to handle indented code blocks
    html = html.replace(/^[ \t]*(`{3,}|~{3,})([\w./+#-]*)[\t ]*\n([\s\S]*?)\n[ \t]*\1/gm, (match, fence, lang, code) => {
        const id = `__BLOCK_${pieces.length}__`;
        const langClean = lang.toLowerCase().trim();
        const codeTrimmed = code; // Preserve exact content for nested blocks
        const highlighted = highlightCode(codeTrimmed.trim(), langClean);
        const encodedCode = encodeURIComponent(codeTrimmed.trim());
        const isDiagram = ['mermaid', 'flowchart', 'graph', 'sequenceDiagram', 'gantt', 'pie', 'gitGraph', 'stateDiagram', 'stateDiagram-v2', 'mindmap', 'erDiagram'].some(d => langClean.includes(d));
        
        // Premium Code Studio: Language-specific accent colors
        const codeColors: Record<string, string> = {
            python: 'text-blue-400',
            javascript: 'text-yellow-400',
            typescript: 'text-blue-500',
            json: 'text-cyan-400',
            html: 'text-orange-500',
            css: 'text-indigo-400',
            rust: 'text-orange-600',
            go: 'text-sky-400',
            bash: 'text-emerald-400',
            yaml: 'text-rose-400'
        };
        const accent = codeColors[langClean] || 'text-slate-400';
        const displayLang = langClean || 'code';

        const containerClass = isDiagram 
            ? 'relative group bg-black/35 pt-12 pb-12 px-8 rounded-2xl my-10 border border-transparent hover:border-cyan-500/10 shadow-[0_15px_45px_rgba(0,0,0,0.65)] transition max-w-full selection:bg-cyan-500/30' 
            : 'relative group bg-black/35 pt-12 pb-12 px-6 rounded-2xl my-10 border border-transparent hover:border-cyan-500/10 shadow-[0_15px_45px_rgba(0,0,0,0.65)] backdrop-blur-md transition md:mx-2';
        
        // Studio Elite Header: Minimal Floating Language Badge
        const studioHeader = `
            <div class="absolute top-3 left-6 flex items-center gap-2 non-typing select-none pointer-events-none">
                <i class="fas fa-terminal text-[9px] ${accent} opacity-60"></i>
                <span class="text-[9px] font-black uppercase tracking-[0.25em] ${accent} opacity-80">${displayLang}</span>
            </div>`;

        // Minimal Action: Icon-only Copy Button
        // NOTE: encoded content lives in data-code to avoid breaking onclick attribute parsing
        // on large or quote-heavy blocks (e.g. SOUL.md). encodeURIComponent guarantees
        // no ", <, >, or & in the value, making data-code="..." structurally safe.
        const copyButton = `<button class="absolute top-3 right-5 text-slate-500/50 hover:text-cyan-400 p-1 opacity-0 group-hover:opacity-100 transition hover:scale-110 active:scale-90 cursor-pointer z-20" title="Copiar Código" data-code="${encodedCode}" onclick="var btn=this,icon=btn.querySelector('i'),code=decodeURIComponent(btn.dataset.code);navigator.clipboard.writeText(code).then(function(){icon.className='fas fa-check text-emerald-400';setTimeout(function(){icon.className='fas fa-clone'},2000)})"><i class="fas fa-clone text-[13px]"></i></button>`;
        
        if (isDiagram) {
            const finalClass = isStreaming ? `${containerClass} isolate overflow-visible is-visible` : `${containerClass} isolate overflow-visible`;
            const extraAttrs = isStreaming ? 'data-animated="true"' : '';
            pieces.push(`<div class="${finalClass}" ${extraAttrs}>${studioHeader}${copyButton}<div class="overflow-x-auto w-full px-2 pb-6"><div class="mermaid opacity-0 scale-95 blur-sm transition duration-1000 min-h-[100px] flex items-center justify-center transform-gpu" data-mermaid-src="${encodedCode}"><code class="text-sm shadow-none font-mono leading-relaxed">${highlighted}</code></div></div></div>`);
        } else {
            const finalClass = isStreaming ? `${containerClass} isolate overflow-visible is-visible` : `${containerClass} isolate overflow-visible code-block-anim opacity-0 scale-95 blur-sm transition duration-1000 transform-gpu`;
            const extraAttrs = isStreaming ? 'data-animated="true"' : '';
            pieces.push(`<div class="${finalClass}" ${extraAttrs}>${studioHeader}${copyButton}<div class="overflow-x-auto w-full bg-black/10 rounded-xl p-5 pb-10 border border-transparent"><pre class="bg-transparent border-none p-0 m-0"><code class="text-sm shadow-none font-mono leading-relaxed block">${highlighted}</code></pre></div></div>`);
        }
        return `\n${id}\n`;
    });

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 0a: INLINE CODE PROTECTION
    // MUST run BEFORE the HTML protector so that backtick-wrapped tags
    // like `<h1>` in table cells become code pills, not real HTML.
    // ═══════════════════════════════════════════════════════════════════
    // 0a. Double inline code block protection (supports internal single backticks)
    html = html.replace(/``([^`\n]+?)``/g, (match, code) => {
        const id = `__BLOCK_${pieces.length}__`;
        const codeTrimmed = code.replace(/^ | $/g, '');
        const escapedCode = codeTrimmed.replace(/</g, '‹').replace(/>/g, '›').replace(/\$/g, '‹DOLLAR›');
        pieces.push(`<code class="bg-indigo-500/10 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-[0.9em] border border-indigo-400/20 mx-1 shadow-[0_0_8px_rgba(99,102,241,0.1)]">${escapedCode}</code>`);
        return id;
    });

    // 0b. Single inline code protection
    html = html.replace(/`([^`\n]+)`/g, (match, code) => {
        const id = `__BLOCK_${pieces.length}__`;
        const escapedCode = code.replace(/</g, '‹').replace(/>/g, '›').replace(/\$/g, '‹DOLLAR›');
        pieces.push(`<code class="bg-indigo-500/10 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-[0.9em] border border-indigo-400/20 mx-1 shadow-[0_0_8px_rgba(99,102,241,0.1)]">${escapedCode}</code>`);
        return id;
    });

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 0.5: UNIVERSAL HTML PROTECTION — "Passthrough Sovereignty"
    // Runs AFTER backtick handlers so `<tag>` in backticks stays as code.
    // Captures all remaining RAW HTML tags and shields them from Markdown.
    // ═══════════════════════════════════════════════════════════════════

    html = (function protectHtmlTags(input: string): string {
        let result = input;
        let safetyLimit = 500;
        
        // Tags sorted longest-first to prevent regex prefix collisions (e.g., 'b' matching 'br')
        const allTags = [
            'figcaption', 'blockquote', 'fieldset', 'progress', 'textarea', 'summary',
            'datalist', 'colgroup', 'optgroup', 'noscript', 'template',
            'details', 'section', 'article', 'caption', 'dialog', 'figure', 'footer',
            'header', 'legend', 'center', 'button', 'canvas', 'iframe', 'output',
            'select', 'source', 'strong', 'address', 'picture', 'acronym',
            'aside', 'embed', 'input', 'label', 'meter', 'option', 'strike',
            'param', 'small', 'tbody', 'tfoot', 'thead', 'track', 'video', 'audio',
            'table', 'form', 'main', 'mark', 'math', 'time', 'data', 'ruby', 'slot',
            'code', 'cite', 'abbr', 'samp',
            'span', 'area', 'base', 'link', 'meta', 'nav', 'pre', 'div', 'del', 'dfn',
            'ins', 'kbd', 'sub', 'sup', 'var', 'wbr', 'col', 'img',
            'bdo', 'big', 'map', 'svg', 'dd', 'dl', 'dt', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'hr', 'br', 'li', 'ol', 'td', 'th', 'tr', 'ul',
            'rt', 'rp',
            'a', 'b', 'i', 'p', 'q', 's', 'u'
        ];
        const selfClosing = ['img', 'br', 'hr', 'source', 'track', 'embed', 'param', 'area', 'base', 'col', 'link', 'meta', 'wbr', 'input'];

        while (safetyLimit-- > 0) {
            const tagPattern = new RegExp(`<(${allTags.join('|')})(?=\\s|>|/>)(\\s[^>]*)?>`, 'i');
            const openMatch = result.match(tagPattern);
            if (!openMatch || openMatch.index === undefined) break;

            const startIdx = openMatch.index;
            const tagName = openMatch[1].toLowerCase();
            const afterOpen = startIdx + openMatch[0].length;

            let matchEnd = -1;
            let fullTagContent = '';

            if (selfClosing.includes(tagName) || openMatch[0].endsWith('/>')) {
                matchEnd = afterOpen;
                fullTagContent = result.substring(startIdx, matchEnd);
            } else {
                const openRe = new RegExp(`<${tagName}[\\s>]`, 'gi');
                const closeRe = new RegExp(`<\\/${tagName}>`, 'gi');
                let depth = 1;
                let cursor = afterOpen;

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
                if (matchEnd !== -1) fullTagContent = result.substring(startIdx, matchEnd);
                else { fullTagContent = openMatch[0]; matchEnd = afterOpen; }
            }

            const id = `__BLOCK_${pieces.length}__`;
            // Auto-center <img> and <iframe> when the model doesn't specify alignment
            if (tagName === 'img' || tagName === 'iframe') {
                const hasAlign = /\balign\s*=|float\s*:\s*(?!none)|margin-left\s*:\s*auto|margin-right\s*:\s*auto|margin\s*:[^;]*auto|text-align\s*:\s*(?:left|right|center)|justify-content\s*:/.test(fullTagContent);
                if (!hasAlign) {
                    fullTagContent = `<div style="text-align:center;display:flex;justify-content:center;">${fullTagContent}</div>`;
                }
            }
            // Allow markdown headers and tables inside container HTML tags.
            // The model sometimes places markdown inside <div>, <section>, etc.
            // We pre-convert only the safe markdown patterns (lines without HTML tags)
            // before storing the block, so they render correctly.
            if ((tagName === 'div' || tagName === 'section' || tagName === 'article' || tagName === 'aside' || tagName === 'main' || tagName === 'figure' || tagName === 'details' || tagName === 'summary') && fullTagContent.includes('\n')) {
                const openTagEnd = fullTagContent.indexOf('>') + 1;
                const closeTagIdx = fullTagContent.lastIndexOf('</');
                if (closeTagIdx > openTagEnd) {
                    const openTag = fullTagContent.substring(0, openTagEnd);
                    let inner = fullTagContent.substring(openTagEnd, closeTagIdx);
                    const closeTag = fullTagContent.substring(closeTagIdx);

                    // Convert markdown headers — only on lines without any '<' (avoids breaking nested HTML)
                    inner = inner.replace(/^(#{1,6})\s+(.+)$/gm, (m, hashes, text) => {
                        if (text.includes('<')) return m;
                        const lvl = hashes.length;
                        if (lvl === 1) return `<h1 class="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-indigo-300 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.8)] mt-6 mb-1">${text}</h1><div class="h-px w-full" style="background: linear-gradient(to right, transparent 0%, rgba(34,211,238,0.15) 2%, rgba(34,211,238,0.15) 98%, transparent 100%); margin-bottom: 1.5rem;"></div>`;
                        if (lvl === 2) return `<h2 class="text-md font-bold text-cyan-400 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.8)] mt-5 mb-1">${text}</h2><div class="h-px w-full" style="background: linear-gradient(to right, transparent 0%, rgba(255,255,255,0.08) 2%, rgba(255,255,255,0.08) 98%, transparent 100%); margin-bottom: 1rem;"></div>`;
                        if (lvl === 3) return `<h3 class="text-sm font-bold text-[#FC8F35] drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.8)] mt-4 mb-2">${text}</h3>`;
                        if (lvl === 4) return `<h4 class="text-sm font-bold text-[#fca865] drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.8)] mt-4 mb-2">${text}</h4>`;
                        if (lvl === 5) return `<h5 class="text-xs font-bold text-indigo-400/70 mt-3 mb-1">${text}</h5>`;
                        return `<h6 class="text-xs font-bold text-slate-500 mt-3 mb-1">${text}</h6>`;
                    });

                    // Convert markdown tables using existing converter
                    inner = convertTablesToHtml(inner);

                    // Convert inline markdown (bold, italic, code, links) on plain text lines
                    inner = inner.split('\n').map(line => {
                        // Skip lines with HTML tags or __BLOCK_X__ placeholders (avoids destroying them)
                        if (/<[a-z]/i.test(line) || /__BLOCK_\d+__/.test(line)) return line;
                        return processInlineMarkdown(line);
                    }).join('\n');

                    // Convert markdown lists (including task lists) — must run AFTER inline markdown
                    // so that bold/italic inside list items are already rendered before list wrapping.
                    inner = convertListsToHtml(inner);

                    fullTagContent = openTag + inner + closeTag;
                }
            }
            // Inline tags must not break text flow (critical for table cells, paragraphs)
            const inlineTags = new Set(['strong', 'em', 'b', 'i', 'u', 'span', 'a', 'code', 'kbd', 'mark', 'small', 'abbr', 'sub', 'sup', 'var', 'dfn', 'cite', 'q', 's', 'strike', 'del', 'ins', 'samp', 'bdo', 'big', 'time', 'data', 'ruby', 'rt', 'rp', 'wbr']);

            // Inject CSS classes for inline formatting tags captured by the protector
            if (tagName === 'strong' || tagName === 'b') {
                fullTagContent = fullTagContent.replace(/<(strong|b)(\s[^>]*)?>/i, '<$1 class="text-indigo-300 drop-shadow-[1px_1.5px_0px_rgba(0,0,0,1)] mx-0.5">');
            } else if (tagName === 'em' || tagName === 'i') {
                fullTagContent = fullTagContent.replace(/<(em|i)(\s[^>]*)?>/i, '<$1 class="text-slate-300 mx-0.5">');
            }

            pieces.push(fullTagContent);
            const sep = inlineTags.has(tagName) ? '' : '\n';
            result = result.substring(0, startIdx) + `${sep}${id}${sep}` + result.substring(matchEnd);
        }
        return result;
    })(html);

    // 1a. Math block formulas ($$ ... $$) - Process after code blocks to protect code $
    html = html.replace(/\$\$([\s\S]*?)\$\$/gs, (match, formula) => {
        const id = `__BLOCK_${pieces.length}__`;
        const renderedMath = convertMathToHtml(formula.trim());
        pieces.push(`<div class="my-6 p-6 bg-black/10 border border-white/5 rounded-xl text-center font-serif text-lg italic text-slate-100 overflow-x-auto shadow-inner math-container">${renderedMath}</div>`);
        return `\n${id}\n`;
    });

    // 1c. LaTeX-style math delimiters \( ... \) and \[ ... \]
    // HEURISTIC PROTECTION: Only treat as math if it contains math signals or is very short (variable)
    // to avoid breaking standard Markdown escapes like \[literal-bracket\] or currency.
    const isMathHeuristic = (formula: string, isDollar = false) => {
        const f = formula.trim();
        if (!f) return false;

        // 🛡️ EMOJI SHIELD: Math formulas rarely contain emojis
        // If we find an emoji, it's almost certainly social/formatted text
        if (/(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu.test(f)) return false;

        // 🛡️ TABLE GUARD: Pipes (|) are common in tables but rare in inline math 
        // unless they are paired $|x|$ or part of a set $\{x | x > 0\}$.
        // If there's only one pipe and it's not part of a known LaTeX set notation
        if (f.includes('|') && !/\\(?:vert|mid|bra|ket|{)/.test(f)) {
            const pipes = (f.match(/\|/g) || []).length;
            if (pipes === 1) return false; // Single pipe is usually a table separator
        }

        // ─────────────────────────────────────────────────────────────────────
        // 🛡️ DOLLAR-SPECIFIC PRE-SIGNAL GUARDS (run before signal check)
        // These must fire BEFORE math signal detection because expressions like
        // "$0.12 USD/minuto = ~$7.20 USD/hr" contain "=" which is a math signal,
        // but are clearly price comparisons — not LaTeX formulas.
        // ─────────────────────────────────────────────────────────────────────
        if (isDollar) {
            // Guard 1: Known currency codes anywhere in the expression
            if (/\b(USD|MXN|EUR|GBP|JPY|CAD|AUD|CHF|CNY|BTC|ETH|BRL|COP|ARS|PEN)\b/i.test(f)) return false;

            // Guard 2: Rate/unit patterns (price per unit of time or quantity)
            if (/\/(?:hr|hora|h\b|min|minuto|mes|month|day|d[ií]a|week|semana|a[ñn]o|year|kg|km|mi)\b/i.test(f)) return false;

            // Guard 3: Markdown bold/italic markers inside — it's formatted text, not math
            if (/\*\*/.test(f) || /\*[^*]/.test(f) || /~~/.test(f)) return false;

            // Guard 4: Multiple natural-language words (≥2 consecutive letter-only words)
            // Real math uses symbols; price copy uses words like "promedio", "extras", "servicios"
            const wordMatches = f.match(/\b[a-záéíóúüñA-ZÁÉÍÓÚÜÑ]{3,}\b/g) || [];
            if (wordMatches.length >= 2) return false;

            // Guard 5: Tilde (~) used as approximation prefix directly before a number/dollar
            // ($0.12 = ~$7.20 — this is prose, not LaTeX \approx)
            if (/~\$?\d/.test(f)) return false;

            // Guard 6: Pure currency amount — $digits[, digits][.digits][unit suffix]
            if (/^[\d,.\s]+(billones|millones|trillones|M|k|m|b|t)?$/i.test(f)) return false;
        }

        // 🛡️ Strong signals: LaTeX commands, common operators, or typical math symbols
        const signals = isDollar 
            ? /[\^\\_=+<>∑∫∏√{}[\]]/.test(f) // Added _ for subscript patterns like k_B
            : /[\^\\_=+*\/<>|∑∫∏√]/.test(f);

        if (signals) {
            // 🛡️ STRUCTURAL BLACKLIST: Abort if it looks like Markdown structure is being swallowed
            // Patterns: List markers, Blockquotes, or Headers
            if (/^[\s]*[\*\-+•·] /m.test(f) || /^[\s]*\d+\. /m.test(f) || /^[\s]*[>#]/m.test(f)) return false;
            return true;
        }
        
        // Multi-line content is likely math, but must not cross paragraph boundaries (already handled in regex)
        if (f.includes('\n')) return true;
        
        // Variable check: Single letters like $x$ or $i$
        if (f.length === 1 && /[a-zA-Z\u0370-\u03ff]/.test(f)) return true;

        // Fallback for more complex expressions
        return f.length <= 2 && !/^[\d,.]+$/.test(f);
    };

    // 1b. Inline math ($ ... $) - Steel-Mesh Hardening v2
    // Restricted to not cross double newlines and structural markers
    html = html.replace(/\$((?:[^\$]|\\\$)+?)\$/g, (match, formula) => {
        const f = formula.trim();
        // 🛡️ SECURITY CAPS: Empty or way too long captures are probably not inline math
        if (!f || f.length > 350 || f.includes('\n\n')) return match;
        
        // 🛡️ MULTILINE PROTECTION: Allow crossing a line ONLY if it contains high-signal LaTeX commands
        if (f.includes('\n') && !/\\/.test(f)) return match;

        if (!isMathHeuristic(f, true)) return match;
        
        const id = `__BLOCK_${pieces.length}__`;
        // Convert to HTML but keep it inline
        const rendered = convertMathToHtml(f);
        pieces.push(`<span class="font-serif italic text-orange-200 bg-white/5 px-1.5 py-1 rounded-md mx-0.5 shadow-sm border-b border-white/10 math-inline inline-flex items-center align-middle flex-wrap">${rendered}</span>`);
        return id;
    });

    html = html.replace(/\\\[([\s\S]*?)\\\]/gs, (match, formula) => {
        if (!isMathHeuristic(formula)) return match;
        const id = `__BLOCK_${pieces.length}__`;
        const renderedMath = convertMathToHtml(formula.trim());
        pieces.push(`<div class="my-6 p-6 bg-black/10 border border-white/5 rounded-xl text-center font-serif text-lg italic text-slate-100 overflow-x-auto shadow-inner math-container">${renderedMath}</div>`);
        return `\n${id}\n`;
    });

    html = html.replace(/\\\(([\s\S]*?)\\\)/gs, (match, formula) => {
        if (!isMathHeuristic(formula)) return match;
        const id = `__BLOCK_${pieces.length}__`;
        pieces.push(`<span class="font-serif italic text-orange-200 bg-white/5 px-1.5 py-1 rounded-md mx-0.5 shadow-sm border-b border-white/10 math-inline inline-flex items-center align-middle flex-wrap">${convertMathToHtml(formula.trim())}</span>`);
        return id;
    });

    // Protect raw dollars remaining (not part of math) to prevent recursive parsing
    html = html.replace(/\$/g, '‹DOLLAR›');

    // 0.7 ESCAPE PROTECTION: Handle standard Markdown backslash escapes
    // Characters: \ ` * _ { } [ ] ( ) # + - . ! | $
    html = html.replace(/\\([\\`*_{}\[\]()#+\-.!|$])/g, (match, char) => {
        return `‹esc-${char.charCodeAt(0)}›`;
    });

    // 1. HTML PROTECTION — Already handled in Phase 0.5 (before backtick handlers).

    // 1b. Form/Media/Block Element Protection is now handled by the Universal Protector (Phase 1).
    // The specialized iframe hardening is now integrated or follows below.

    // 1b-2. Emoji Callout Normalization — Convert emoji-based callout headers to [!TYPE] format
    // Handles AI-generated callouts like: > 💡 **Tip (Sugerencia):** → > [!TIP] Sugerencia
    const EMOJI_CALLOUT_MAP: Record<string, string> = {
        '💡': 'TIP', '⚠️': 'WARNING', '📝': 'NOTE', '🔧': 'INFO', '🚨': 'DANGER',
        '✅': 'SUCCESS', '❌': 'FAILURE', '❓': 'QUESTION', '📖': 'EXAMPLE', '🔒': 'SECURITY',
        '⏳': 'TODO', '📌': 'REMEMBER', 'ℹ️': 'INFO', '🛡️': 'SECURITY', '🐛': 'BUG',
        '🔥': 'DANGER', '📢': 'IMPORTANT', '🎯': 'IMPORTANT', '✏️': 'NOTE',
        '🟢': 'SUCCESS', '🔴': 'DANGER', '🟡': 'WARNING', '🔵': 'INFO',
        '✓': 'CHECK', '✔': 'CHECK', '☑': 'CHECK', '📋': 'CHECK',
        '📄': 'ABSTRACT',
    };

    // Fase A: Emoji-based detection
    const emojiAlt = Object.keys(EMOJI_CALLOUT_MAP).join('|');
    const emojiCalloutRegex = new RegExp(`^[ \\t]*>\\s*(${emojiAlt})\\s*(.*)$`, 'gm');
    html = html.replace(emojiCalloutRegex, (_match, emoji: string, rest: string) => {
        const type = EMOJI_CALLOUT_MAP[emoji];
        if (!type) return _match;
        const title = rest.replace(/[:：]\s*$/, '').trim();
        return `> [!${type}]${title ? ' ' + title : ''}`;
    });


    // Fase B: Keyword-based detection (English + Chinese, no emoji required)
    const KEYWORD_CALLOUT_MAP: Record<string, string> = {
        // English
        'tip': 'TIP', 'tips': 'TIP', 'suggestion': 'TIP',
        'warning': 'WARNING', 'warn': 'WARNING', 'attention': 'WARNING',
        'note': 'NOTE', 'notes': 'NOTE',
        'info': 'INFO', 'information': 'INFO',
        'danger': 'DANGER', 'alert': 'DANGER',
        'success': 'SUCCESS', 'done': 'SUCCESS',
        'error': 'FAILURE', 'failure': 'FAILURE', 'fail': 'FAILURE',
        'question': 'QUESTION', 'ask': 'QUESTION',
        'example': 'EXAMPLE', 'demo': 'EXAMPLE',
        'security': 'SECURITY', 'secure': 'SECURITY',
        'todo': 'TODO', 'pending': 'TODO', 'task': 'TODO',
        'remember': 'REMEMBER',
        'important': 'IMPORTANT',
        'caution': 'CAUTION', 'careful': 'CAUTION',
        'bug': 'BUG', 'issue': 'BUG',
        'check': 'CHECK', 'checklist': 'CHECK', 'verification': 'CHECK', 'verify': 'CHECK',
        'abstract': 'ABSTRACT', 'summary': 'ABSTRACT', 'overview': 'ABSTRACT', 'synopsis': 'ABSTRACT',
        // Chinese
        '提示': 'TIP', '建议': 'TIP', '小贴士': 'TIP',
        '警告': 'WARNING', '注意': 'WARNING',
        '备注': 'NOTE', '笔记': 'NOTE', '注': 'NOTE',
        '信息': 'INFO', '说明': 'INFO',
        '危险': 'DANGER', '警报': 'DANGER',
        '成功': 'SUCCESS', '完成': 'SUCCESS',
        '错误': 'FAILURE', '失败': 'FAILURE', '报错': 'FAILURE',
        '问题': 'QUESTION', '疑问': 'QUESTION',
        '示例': 'EXAMPLE', '例子': 'EXAMPLE', '案例': 'EXAMPLE',
        '安全': 'SECURITY', '安全提示': 'SECURITY',
        '待办': 'TODO', '待处理': 'TODO', '待完成': 'TODO',
        '记住': 'REMEMBER', '牢记': 'REMEMBER', '提醒': 'REMEMBER',
        '重要': 'IMPORTANT', '关键': 'IMPORTANT',
        '当心': 'CAUTION', '小心': 'CAUTION',
        '缺陷': 'BUG', '漏洞': 'BUG',
    };

    html = html.replace(/^>\s*\*{1,2}\s*([^*\n:：]+?)\s*\*{1,2}\s*[:：]?\s*$/gm, (_match, rawKeyword: string) => {
        const keyword = rawKeyword.trim().toLowerCase();
        const type = KEYWORD_CALLOUT_MAP[keyword];
        if (!type) return _match;
        return `> [!${type}]`;
    });

    // Fase C: Spanish [!TYPE] normalization — converts Spanish callout types to English
    const SPANISH_CALLOUT_MAP: Record<string, string> = {
        'ÉXITO': 'SUCCESS',      'EXITO': 'SUCCESS',
        'EJEMPLO': 'EXAMPLE',
        'ERROR': 'FAILURE',
        'PREGUNTA': 'QUESTION',  'PREGUNTAS': 'QUESTION',
        'SEGURIDAD': 'SECURITY',
        'NOTA': 'NOTE',
        'CONSEJO': 'TIP',        'SUGERENCIA': 'TIP',
        'AVISO': 'WARNING',      'ADVERTENCIA': 'WARNING',
        'PELIGRO': 'DANGER',     'ALERTA': 'DANGER',
        'IMPORTANTE': 'IMPORTANT',
        'PRECAUCIÓN': 'CAUTION', 'PRECAUCION': 'CAUTION',
        'INFORMACIÓN': 'INFO',   'INFORMACION': 'INFO',
        'RECUERDA': 'REMEMBER',  'RECORDATORIO': 'REMEMBER',
        'PENDIENTE': 'TODO',     'TAREA': 'TODO',
        'FRECUENTES': 'FAQ',
        'VERIFICACIÓN': 'CHECK', 'VERIFICACION': 'CHECK', 'COMPROBACIÓN': 'CHECK', 'COMPROBACION': 'CHECK', 'REVISIÓN': 'CHECK', 'REVISION': 'CHECK', 'LISTA': 'CHECK',
        'RESUMEN': 'ABSTRACT', 'SÍNTESIS': 'ABSTRACT', 'SINTESIS': 'ABSTRACT', 'ABSTRACTO': 'ABSTRACT', 'VISIÓN GENERAL': 'ABSTRACT', 'VISION GENERAL': 'ABSTRACT',
    };
    const spanishTypes = Object.keys(SPANISH_CALLOUT_MAP).join('|');
    const spanishCalloutRegex = new RegExp(`\\[!(${spanishTypes})\\]`, 'gi');
    html = html.replace(spanishCalloutRegex, (_match, type: string) => {
        const normalized = SPANISH_CALLOUT_MAP[type.toUpperCase()];
        return normalized ? `[!${normalized}]` : _match;
    });

    // 1c. Universal Admonition Parser — Phase 1
    html = html.replace(/^[ \t]*(?:>\s*)?\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|DANGER|INFO|SUCCESS|FAILURE|BUG|EXAMPLE|QUOTE|QUESTION|FAQ|SECURITY|TODO|REMEMBER|CHECK|ABSTRACT)\]([\-\+])?(?:[ \t]+(.*))?\s*?\n?((?:(?!(?:[ \t]*>\s*\[!)).*\n?)*)/gim, (match, type, collapseSign, title, body) => {
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
            'NOTE':      { icon: '<i class="fas fa-info-circle"></i>',      color: 'text-blue-400',    border: 'border-blue-500/70',    bg: 'bg-blue-500/10' },
            'TIP':       { icon: '<i class="fas fa-lightbulb"></i>',        color: 'text-emerald-400', border: 'border-emerald-500/70', bg: 'bg-emerald-500/10' },
            'IMPORTANT': { icon: '<i class="fas fa-exclamation-circle"></i>', color: 'text-amber-400',   border: 'border-amber-500/70',   bg: 'bg-amber-500/10' },
            'WARNING':   { icon: '<i class="fas fa-exclamation-triangle"></i>', color: 'text-orange-400',  border: 'border-orange-500/70',  bg: 'bg-orange-500/10' },
            'CAUTION':   { icon: '<i class="fas fa-hand-paper"></i>',       color: 'text-rose-400',    border: 'border-rose-500/70',    bg: 'bg-rose-500/10' },
            'DANGER':    { icon: '<i class="fas fa-skull-crossbones"></i>', color: 'text-red-400',      border: 'border-red-500/80',      bg: 'bg-red-500/15',      glow: 'shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]' },
            'INFO':      { icon: '<i class="fas fa-info"></i>',             color: 'text-sky-400',      border: 'border-sky-500/70',      bg: 'bg-sky-500/10',      glow: 'shadow-[inset_0_0_20px_rgba(14,165,233,0.04)]' },
            'SUCCESS':   { icon: '<i class="fas fa-check-circle"></i>',     color: 'text-green-400',    border: 'border-green-500/70',    bg: 'bg-green-500/15',    glow: 'shadow-[inset_0_0_20px_rgba(34,197,94,0.05)]' },
            'FAILURE':   { icon: '<i class="fas fa-times-circle"></i>',     color: 'text-rose-400',     border: 'border-rose-500/80',     bg: 'bg-rose-500/15',     glow: 'shadow-[inset_0_0_20px_rgba(244,63,94,0.05)]' },
            'BUG':       { icon: '<i class="fas fa-bug"></i>',              color: 'text-fuchsia-400',  border: 'border-fuchsia-500/75',  bg: 'bg-fuchsia-500/12',  glow: 'shadow-[inset_0_0_20px_rgba(217,70,239,0.04)]' },
            'EXAMPLE':   { icon: '<i class="fas fa-vial"></i>',             color: 'text-violet-400',   border: 'border-violet-500/70',   bg: 'bg-violet-500/10',   glow: 'shadow-[inset_0_0_20px_rgba(139,92,246,0.04)]' },
            'QUOTE':     { icon: '<i class="fas fa-quote-left"></i>',       color: 'text-slate-400',    border: 'border-slate-500/70',    bg: 'bg-slate-800/25',   glow: 'shadow-[inset_0_0_20px_rgba(148,163,184,0.04)]' },
            'QUESTION':  { icon: '<i class="fas fa-question-circle"></i>',  color: 'text-cyan-400',     border: 'border-cyan-500/70',     bg: 'bg-cyan-500/10',     glow: 'shadow-[inset_0_0_20px_rgba(34,211,238,0.04)]' },
            'FAQ':       { icon: '<i class="fas fa-comments"></i>',         color: 'text-purple-400',   border: 'border-purple-500/70',   bg: 'bg-purple-500/10',   glow: 'shadow-[inset_0_0_20px_rgba(168,85,247,0.04)]' },
            'SECURITY':  { icon: '<i class="fas fa-shield-alt"></i>',       color: 'text-teal-400',     border: 'border-teal-500/70',     bg: 'bg-teal-500/10',     glow: 'shadow-[inset_0_0_20px_rgba(20,184,166,0.04)]' },
            'TODO':      { icon: '<i class="fas fa-tasks"></i>',             color: 'text-amber-300',    border: 'border-amber-400/70',    bg: 'bg-amber-500/10',    glow: 'shadow-[inset_0_0_20px_rgba(252,211,77,0.04)]' },
            'REMEMBER':  { icon: '<i class="fas fa-thumbtack"></i>',         color: 'text-pink-400',     border: 'border-pink-500/70',     bg: 'bg-pink-500/10',     glow: 'shadow-[inset_0_0_20px_rgba(236,72,153,0.04)]' },
            'CHECK':     { icon: '<i class="fas fa-clipboard-check"></i>',   color: 'text-emerald-300',  border: 'border-emerald-400/70',  bg: 'bg-emerald-500/10',  glow: 'shadow-[inset_0_0_20px_rgba(52,211,153,0.04)]' },
            'ABSTRACT':  { icon: '<i class="fas fa-file-alt"></i>',          color: 'text-indigo-400',   border: 'border-indigo-500/70',   bg: 'bg-indigo-500/10',   glow: 'shadow-[inset_0_0_20px_rgba(99,102,241,0.04)]' },
        };

        const s = styles[typeUp] || styles['INFO'];

        // Localized display title: uses i18n if available, falls back to English type name
        const CALLOUT_I18N_KEYS: Record<string, string> = {
            'NOTE': 'callout_note', 'TIP': 'callout_tip', 'IMPORTANT': 'callout_important',
            'WARNING': 'callout_warning', 'CAUTION': 'callout_caution', 'DANGER': 'callout_danger',
            'INFO': 'callout_info', 'SUCCESS': 'callout_success', 'FAILURE': 'callout_failure',
            'BUG': 'callout_bug', 'EXAMPLE': 'callout_example', 'QUOTE': 'callout_quote',
            'QUESTION': 'callout_question', 'FAQ': 'callout_faq', 'SECURITY': 'callout_security',
            'TODO': 'callout_todo', 'REMEMBER': 'callout_remember',
            'CHECK': 'callout_check', 'ABSTRACT': 'callout_abstract',
        };
        const localizedDefault = CALLOUT_I18N_KEYS[typeUp] ? i18n.t(`common.${CALLOUT_I18N_KEYS[typeUp]}`) : typeUp;
        // The type badge is ALWAYS the localized type name (short, uppercase, tracked)
        const typeBadgeLabel = (localizedDefault !== `common.${CALLOUT_I18N_KEYS[typeUp]}`) ? localizedDefault : typeUp;
        // 🛡️ PARENT-SCOPE TOKEN RESTORATION (defined first — used for both title and body):
        // The title (group 3) and body can contain __BLOCK_N__ placeholders created by
        // earlier phases (inline code `...`, HTML protector, etc.) in the PARENT toHtml()
        // context. Recursive toHtml() calls have their own separate pieces[] and won't
        // know about parent tokens — they render as literal "BLOCK_N" text.
        // Restoring here gives child calls clean, original markdown/HTML.
        const restoreParentTokens = (text: string): string => {
            return text.replace(/__BLOCK_(\d+)__/g, (m, idxStr) => {
                const idx = parseInt(idxStr, 10);
                return (idx >= 0 && idx < pieces.length) ? pieces[idx] : m;
            });
        };

        // User title is what the model added after the [!TYPE] — can be a whole sentence.
        // Restore parent tokens BEFORE processInlineMarkdown so code pills etc. render correctly.
        const rawUserTitle = restoreParentTokens(title ? title.replace(/^[>\s]+/, '').trim() : '');
        const displayTitle = rawUserTitle ? processInlineMarkdown(rawUserTitle) : '';

        const isCollapsible = !!collapseSign;
        const isOpen = collapseSign === '+';

        // If no body but model crammed a long sentence into the title, move it to body
        const longTitleAsBody = !content && rawUserTitle.length > 40 ? rawUserTitle : '';
        const effectiveBody = longTitleAsBody || content;
        const effectiveTitle = longTitleAsBody ? '' : displayTitle;

        // Restore parent tokens in body too before passing to recursive toHtml()
        const restoredBody = restoreParentTokens(effectiveBody);

        const bodyHtml = restoredBody ? `<div class="text-md font-medium text-slate-300 ${isCollapsible ? 'mt-3 pt-3 border-t border-white/5' : 'leading-relaxed'} child-content typing-content">${toHtml(restoredBody, isStreaming)}</div>` : '';
        // Short user title (≤40 chars) shown inline with badge; longer text always goes to body
        const userTitleSpan = effectiveTitle ? ` <span class="text-sm font-semibold normal-case tracking-normal leading-snug">${effectiveTitle}</span>` : '';
        
        if (isCollapsible) {
            const extra = isStreaming ? 'data-animated="true"' : '';
            pieces.push(`<details ${extra} class="group/callout border-l-[3px] ${s.border} bg-black/8 backdrop-blur-md ${s.glow || ''} shadow-xl pl-6 pr-4 py-3.5 my-5 rounded-r-xl overflow-hidden transition duration-300 select-none cursor-pointer border-y border-y-transparent border-r border-r-transparent hover:border-y-white/10 hover:border-r-white/10" ${isOpen ? 'open' : ''}>`
                + `<summary class="flex items-center gap-3 ${s.color} non-typing outline-none list-none text-left">`
                + `<span class="group-open/callout:rotate-90 transition-transform duration-300 font-black text-[11px]">▶</span>`
                + `<span class="text-lg">${s.icon}</span>`
                + `<span class="font-black text-[11px] uppercase tracking-[0.2em] opacity-80">${typeBadgeLabel}</span>`
                + `${userTitleSpan}`
                + `</summary>${bodyHtml}</details>`);
        } else {
            const extra = isStreaming ? 'data-animated="true"' : '';
            pieces.push(`<blockquote ${extra} class="border-l-[3px] ${s.border} bg-black/8 backdrop-blur-md ${s.glow || ''} shadow-xl pl-6 pr-4 py-3.5 my-5 rounded-r-xl overflow-hidden border-y border-y-transparent border-r border-r-transparent" data-type="admonition">`
                + `<div class="flex items-center gap-3 mb-3 ${s.color} non-typing">`
                + `<span class="text-lg flex-shrink-0">${s.icon}</span>`
                + `<span class="font-black text-[11px] uppercase tracking-[0.2em] opacity-80 flex-shrink-0">${typeBadgeLabel}</span>`
                + `${userTitleSpan}`
                + `</div>${bodyHtml}</blockquote>`);
        }
        
        const remainder = bodyLines.slice(actualBody.length).join('\n');
        return `\n${id}\n${remainder}`;
    });

    // 1d. Standard Blockquote Parser (Phase 1) — Nesting-aware with recursive rendering
    // Captures consecutive lines starting with > (supports > on its own line for paragraph breaks)
    html = html.replace(/(^[ \t]*>.*(?:\n[ \t]*>.*)*)/gm, (match) => {
        // Verify at least one real > line exists (not just whitespace)
        if (!/^[ \t]*>/m.test(match)) return match;
        const id = `__BLOCK_${pieces.length}__`;
        // Restore parent-scope __BLOCK_N__ tokens before passing to blockquote renderer,
        // since convertBlockquotesToHtml calls toHtml() recursively with its own pieces[].
        const matchRestored = match.replace(/__BLOCK_(\d+)__/g, (m, idxStr) => {
            const idx = parseInt(idxStr, 10);
            return (idx >= 0 && idx < pieces.length) ? pieces[idx] : m;
        });
        pieces.push(convertBlockquotesToHtml(matchRestored, isStreaming));
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

        const extra = isStreaming ? 'data-animated="true" is-visible' : '';
        pieces.push(`<div ${extra} class="image-container w-full flex flex-col items-center justify-center my-6 group/img" style="text-align:center;">` +
            `<img src="${url}" alt="${cleanAlt}" ${width} ${height} class="max-w-full h-auto rounded-2xl border border-white/10 shadow-2xl transition group-hover/img:scale-[1.01] hover:shadow-cyan-500/10" />` +
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
        const processedText = processInlineMarkdown(text);
        pieces.push(`<a href="${url}" target="_blank" rel="noopener noreferrer" class="group inline-flex items-baseline text-cyan-400 hover:text-cyan-300 font-bold underline underline-offset-4 decoration-cyan-500/30 hover:decoration-cyan-400/60 transition mx-0.5">${processedText}${icon}</a>`);
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
        .replace(/‹h([1-4])\s*([^›]*?)›/gi, '<h$1 class="text-inherit font-black drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.8)] my-2" $2>')
        .replace(/‹h([5-6])\s*([^›]*?)›/gi, '<h$1 class="text-inherit font-black my-2" $2>')
        .replace(/‹\/h([1-6])›/g, '</h$1>')
        .replace(/‹strong›/g, '<strong class="text-indigo-300 drop-shadow-[1px_1.5px_0px_rgba(0,0,0,1)] mx-0.5">')
        .replace(/‹\/strong›/g, '</strong>')
        .replace(/‹em›/g, '<em class="text-slate-300 mx-0.5">')
        .replace(/‹\/em›/g, '</em>')
        .replace(/‹small\s*([^›]*?)›/gi, '<small class="text-[0.85em] opacity-80 mx-1" $1>')
        .replace(/‹\/small›/g, '</small>')
        .replace(/‹code\s*([^›]*?)›/gi, '<code class="bg-indigo-500/10 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-[0.9em] border border-indigo-400/20 mx-1 shadow-[0_0_8px_rgba(99,102,241,0.1)]" $1>')
        .replace(/‹\/code›/g, '</code>')
        .replace(/‹kbd\s*([^›]*?)›/gi, '<kbd class="bg-black/10 border border-white/20 rounded px-1.5 py-0.5 text-xs font-mono text-slate-200 shadow-sm mx-1" $1>')
        .replace(/‹\/kbd›/g, '</kbd>')
        .replace(/‹mark\s*([^›]*?)›/gi, '<mark class="bg-[#FC8F35]/15 text-[#fcc18d] px-1 py-0.5 rounded-sm border-b border-[#FC8F35]/30 mx-1 shadow-sm" $1>')
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
    html = html.replace(/`([^`\n]+)`/g, '<code class="bg-indigo-500/10 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-xs border border-indigo-400/20 shadow-[0_0_8px_rgba(99,102,241,0.1)]">$1</code>');
    html = html.replace(/‹esc-backtick›/g, '`');

    // 13c. Spoiler Support (||text||) - Process before tables to prevent | collision
    html = html.replace(/\|\|(.*?)\|\|/g, (match, content) => {
        const id = `__BLOCK_${pieces.length}__`;
        // Use simplified inline formatting to avoid block-level <div> wrappers
        const innerHtml = content
            .trim()
            .replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="text-indigo-400"><em>$1</em></strong>')
            .replace(/\*\*(.+?)\*\*/g, '<strong class="text-indigo-300">$1</strong>')
            .replace(/\*(.+?)\*/g, '<em class="text-slate-300">$1</em>')
            .replace(/`([^`\n]+)`/g, '<code class="bg-indigo-500/10 px-1 py-0.5 rounded text-indigo-300 font-mono text-xs border border-indigo-400/20">$1</code>');
            
        pieces.push(`<span class="studio-spoiler" title="Revelar spoiler">${innerHtml}</span>`);
        return id;
    });

    html = convertTablesToHtml(html);

    html = html.replace(/^###### (.+)$/gm, '<h6 class="text-xs font-bold text-slate-500 mt-3 mb-1">$1</h6>');
    html = html.replace(/^##### (.+)$/gm, '<h5 class="text-xs font-bold text-indigo-400/70 mt-3 mb-1">$1</h5>');
    html = html.replace(/^#### (.+)$/gm, '<h4 class="text-sm font-bold text-[#fca865] drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.8)] mt-4 mb-2">$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-[#FC8F35] drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.8)] mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-md font-bold text-cyan-400 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.8)] mt-5 mb-1">$1</h2><div class="h-px w-full" style="background: linear-gradient(to right, transparent 0%, rgba(255,255,255,0.08) 2%, rgba(255,255,255,0.08) 98%, transparent 100%); margin-bottom: 1rem;"></div>');
    html = html.replace(/^# (.+)$/gm, '<h1 class="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-indigo-300 drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.8)] mt-6 mb-1">$1</h1><div class="h-px w-full" style="background: linear-gradient(to right, transparent 0%, rgba(34,211,238,0.15) 2%, rgba(34,211,238,0.15) 98%, transparent 100%); margin-bottom: 1.5rem;"></div>');

    const divExtra = isStreaming ? 'data-animated="true" is-visible' : '';
    html = html.replace(/^(?:\s*[\*\-_]){3,}\s*$/gm, `<div ${divExtra} class="divider-container"><div class="divider-line bg-gradient-to-r from-transparent via-cyan-500/15 to-transparent h-px my-8"></div></div>`);

    html = html.replace(/\*\*\*(?!\s)(.+?)\*\*\*/g, '<strong class="text-indigo-400 drop-shadow-[1px_1.5px_0px_rgba(0,0,0,1)]"><em>$1</em></strong>');
    html = html.replace(/\*\*(?!\s)(.+?)\*\*/g, '<strong class="text-indigo-300 drop-shadow-[1px_1.5px_0px_rgba(0,0,0,1)]">$1</strong>');
    html = html.replace(/\*(?!\s)(.+?)\*/g, '<em class="text-slate-300">$1</em>');

    // Protect __BLOCK_N__ placeholders from underscore patterns before processing
    html = html.replace(/__BLOCK_(\d+)__/g, '‹BLOCK_$1›');
    html = html.replace(/(?<!\w)___(?!\s)(.+?)___(?!\w)/g, '<strong class="text-indigo-400 drop-shadow-[1px_1.5px_0px_rgba(0,0,0,1)]"><em>$1</em></strong>');
    html = html.replace(/(?<!\w)__(?!\s)(.+?)__(?!\w)/g, '<strong class="text-indigo-300 drop-shadow-[1px_1.5px_0px_rgba(0,0,0,1)]">$1</strong>');
    html = html.replace(/(?<!\w)_(?!\s)(.+?)_(?!\w)/g, '<em class="text-slate-300">$1</em>');
    // Restore __BLOCK_N__ placeholders
    html = html.replace(/‹BLOCK_(\d+)›/g, '__BLOCK_$1__');
    html = html.replace(/~~(?!\s)(.+?)~~/g, '<del class="text-slate-500 line-through">$1</del>');

    html = html.replace(/‹esc-asterisk›/g, '*');
    html = html.replace(/‹esc-hash›/g, '#');
    html = html.replace(/‹esc-dash›/g, '-');

    html = html.replace(/==([^=\n]+)==/g, '<mark class="bg-[#FC8F35]/15 text-[#fcc18d] px-1 py-0.5 rounded-sm border-b border-[#FC8F35]/30 mx-0.5">$1</mark>');

    html = html.replace(/~([^~\n<]+)~/g, (match, content) => {
        // 🛡️ SUBSCRIPT GUARD: Real subscripts (H~2~O, CO~2~, x~n~) are short, space-free, and dollar-free.
        // Long content or content with $ / spaces is prose (e.g. "= ~$7.20 USD/hr (~$128")
        if (content.includes('$') || content.includes(' ') || content.length > 15) return match;
        return `<sub class="text-slate-400 text-[0.7em] leading-none">${content}</sub>`;
    });

    // 13a. Footnote definitions [^1]: 
    html = html.replace(/^\[\^([^\]]+)\]:\s+(.*)$/gm, (match, label, content) => {
        const id = `__BLOCK_${pieces.length}__`;
        const processedContent = processInlineMarkdown(content);
        pieces.push(`<div class="text-[11px] text-slate-400/80 mt-1.5 flex gap-2 items-baseline leading-relaxed italic group/fn">`
             + `<span class="text-cyan-400 font-mono text-[10px] min-w-[15px] text-left opacity-70">${label}</span>`
             + `<span class="flex-1 text-slate-400/70 antialiased font-medium opacity-90">${processedContent}</span></div>`);
        return `\n${id}\n`;
    });


    // 13b. Footnote references [^1] (Must be before generic superscript)
    html = html.replace(/\[\^([^\]\n]+?)\]/g, (match, label) => {
        const id = `__BLOCK_${pieces.length}__`;
        pieces.push(`<sup class="text-cyan-400/90 font-black ml-0.5 text-[9px] tracking-tight hover:text-cyan-300 transition-colors cursor-help" style="vertical-align: super;">${label}</sup>`);
        return id;
    });

    html = html.replace(/\^([^\^\n<]+)\^/g, '<sup class="text-slate-400 text-[0.7em] leading-none">$1</sup>');

    // 12. Blockquotes — now handled in Phase 1 (section 1d) with nesting support

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
            + `<div class="flex-1 max-w-[200px] h-2.5 bg-black/8 rounded-full overflow-hidden border border-white/10 ring-1 ring-white/5">`
            + `<div class="h-full ${color} rounded-full transition duration-1000 shadow-[0_0_10px_currentColor]/40" style="width:${percent}%"></div>`
            + `</div>`
            + `<span class="text-xs font-mono font-black text-slate-300 w-[45px] text-right">${pct}</span>`
            + `</div>`;
    });

    // 13g. Emoji shortcodes :smile:
    html = html.replace(/:([a-z_]+):/g, (match, code) => {
        return EMOJI_MAP[code] || match;
    });

    // 13h. Apply cached abbreviations to text
    html = applyAbbreviationsToHtml(html);

    // 14. Restoration: inject protected blocks back
    // Use multi-pass for nested blocks (e.g., inline code inside details)
    // 14. Restoration: inject protected blocks back (REVERSE ORDER to handle nested indices)
    // We use a regex and a function to replace each match exactly once.
    for (let i = pieces.length - 1; i >= 0; i--) {
        const placeholder = `__BLOCK_${i}__`;
        if (html.includes(placeholder)) {
            html = html.split(placeholder).join(pieces[i]);
        }
    }

    // 14c. Clean up escaped characters
    // 14c. Clean up escaped characters
    html = html
        .replace(/‹DOLLAR›/g, '$')
        .replace(/‹esc-(\d+)›/g, (match, code) => String.fromCharCode(parseInt(code)));

    // 15. Final DIVIDER marker replacement
    const finalDivExtra = isStreaming ? 'data-animated="true" is-visible' : '';
    html = html.replace(/---DIVIDER---/g, `<div ${finalDivExtra} class="divider-container"><div class="divider-line bg-gradient-to-r from-transparent via-cyan-500/15 to-transparent h-px my-8"></div></div>`);

    if (isStreaming) {
        html = applyStreamingAnimations(html);
    }

    return html.trim();
};

/**
 * Wraps text nodes in animated spans for word-by-word reveal.
 * Carefully avoids splitting HTML tags and preserves non-typing blocks.
 */
function applyStreamingAnimations(html: string): string {
    // 🛡️ NO-REVEAL PROTECTION: Don't wrap words inside specific tags that have their own animations
    // or need to remain as raw blocks (pre, code, iframe, canvas, etc.)
    
    // We first split the HTML into tags and text chunks
    const parts = html.split(/(<[^>]+>)/g);
    
    // We count total words to identify the "leading edge" (last ~25 words)
    let totalWords = 0;
    parts.forEach(p => {
        if (p && !p.startsWith('<')) {
            totalWords += p.split(/\s+/).filter(w => w.length > 0).length;
        }
    });

    const ANIMATION_THRESHOLD = 25; // Only animate the last 25 words
    let currentWordIndex = 0;

    return parts.map(part => {
        if (!part) return '';
        if (part.startsWith('<')) return part;
        
        // It's a text node
        const words = part.split(/(\s+)/);
        return words.map(word => {
            if (word.trim() === '') return word;
            
            currentWordIndex++;
            // Only apply the animation class to words near the end of the current stream
            const isLeadingEdge = currentWordIndex > (totalWords - ANIMATION_THRESHOLD);
            
            if (isLeadingEdge) {
                return `<span class="text-reveal-chunk">${word}</span>`;
            }
            return word;
        }).join('');
    }).join('');
}


/**
 * Converts markdown tables to HTML with styling and alignment support.
 */
function convertTablesToHtml(html: string): string {
    const lines = html.split('\n');
    let inTable = false;
    let currentTable: string[][] = [];
    let alignments: ('left' | 'center' | 'right')[] = [];
    const outputLines: string[] = [];
    let inPre = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('<pre')) inPre = true;

        const trimmed = line.trim();
        const isTableRow = !inPre && trimmed.includes('|') && (inTable || trimmed.startsWith('|'));

        if (isTableRow) {
            if (!inTable) {
                inTable = true;
                currentTable = [];
                alignments = [];
            }
            
            const sepMatch = trimmed.match(/^[|:\-\+ ]+$/);
            if (sepMatch) {
                const parts = trimmed.split('|').filter(p => p.trim() !== '');
                alignments = parts.map(p => {
                    const t = p.trim();
                    const left = t.startsWith(':');
                    const right = t.endsWith(':');
                    if (left && right) return 'center';
                    if (right) return 'right';
                    return 'left';
                });
                continue; 
            }
            
            const cleanLine = trimmed.replace(/^\|/, '').replace(/\|$/, '');
            const cells = cleanLine.split('|').map(c => c.trim());
            currentTable.push(cells);
        } else {
            if (inTable) {
                outputLines.push(renderTable(currentTable, alignments));
                inTable = false;
                currentTable = [];
                alignments = [];
            }
            outputLines.push(line);
        }

        if (line.includes('</pre>')) inPre = false;
    }

    if (inTable) outputLines.push(renderTable(currentTable, alignments));
    return outputLines.join('\n');
}

function renderTable(rows: string[][], alignments: ('left' | 'center' | 'right')[] = []): string {
    if (rows.length === 0) return '';
    
    let maxCols = 0;
    rows.forEach(r => { if (r.length > maxCols) maxCols = r.length; });

    const headerRow = rows[0];
    const bodyRows = rows.slice(1);

    let html = '<div class="table-container my-10 group/table">';
    html += '<div class="relative overflow-hidden rounded-xl bg-black/8 backdrop-blur-3xl shadow-[0_15px_40px_rgba(0,0,0,0.4)] transition duration-500">';
    html += '<div class="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none z-20"></div>';
    html += '<div class="overflow-x-auto relative z-10"><table class="min-w-full border-collapse m-0 p-0" style="margin: 0 !important; border: none;">';
    
    // 1. HEADER
    html += '<thead class="bg-white/[0.05] relative z-20"><tr>';
    for (let i = 0; i < maxCols; i++) {
        const cellText = headerRow[i] || '&nbsp;';
        const isLastHeader = i === maxCols - 1;
        const borderX = !isLastHeader ? 'border-r border-white/[0.06]' : '';
        const align = alignments[i] || 'left';
        
        html += `<th class="px-4.5 py-3 text-${align} text-[12px] font-black text-white uppercase tracking-[0.15em] whitespace-nowrap relative ${borderX} break-normal min-w-[100px]">`
             + `<span class="relative z-10">${cellText}</span>`
             + `<div class="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>`
             + `</th>`;
    }
    html += '</tr></thead>';

    // 2. BODY
    html += '<tbody class="relative z-10">';
    for (let r = 0; r < bodyRows.length; r++) {
        const row = bodyRows[r];
        const isLastRow = r === bodyRows.length - 1;
        const zebraClass = r % 2 === 1 ? 'bg-white/[0.015]' : '';
        html += `<tr class="${zebraClass} hover:bg-white/[0.025] transition duration-300 group/row relative">`;
        for (let c = 0; c < maxCols; c++) {
            const cellText = row[c] || '&nbsp;';
            const isLastCol = c === maxCols - 1;
            const align = alignments[c] || 'left';
            
            const textClass = 'text-slate-200 font-normal';
            const borderX = !isLastCol ? 'border-r border-white/[0.04]' : '';
            
            html += `<td class="px-4.5 py-2.5 text-[13px] text-${align} ${textClass} ${borderX} group-hover/row:text-white transition-colors antialiased relative break-normal min-w-[100px]">`
                 + `<span class="relative z-10">${cellText}</span>`
                 + (!isLastRow ? `<div class="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r ${c===0 ? 'from-transparent' : (c===maxCols-1 ? '' : 'via-white/[0.05]')} ${c===maxCols-1 ? 'to-transparent via-white/[0.05]' : ''} pointer-events-none"></div>` : '')
                 + `</td>`;
        }
        html += '</tr>';
    }
    html += '</tbody></table></div></div></div>';
    return html;
}

/**
 * Processes inline markdown elements (bold, italic, code, links, etc.)
 * Used for blockquote content which is protected from main pipeline processing.
 */
function processInlineMarkdown(text: string): string {
    let result = text;

    // Links [text](url) - must be processed first to avoid conflicts
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
        const cleanUrl = url.replace(/‹/g, '<').replace(/›/g, '>').replace(/&amp;/g, '&');
        const isExternal = cleanUrl.startsWith('http');
        const icon = isExternal ? '<i class="fas fa-external-link-alt text-[10px] ml-1 opacity-50"></i>' : '';
        return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="group inline-flex items-baseline text-cyan-400 hover:text-cyan-300 font-bold underline underline-offset-4 decoration-cyan-500/30 hover:decoration-cyan-400/60 transition mx-0.5">${linkText}${icon}</a>`;
    });

    // Escaped backticks
    result = result.replace(/\\`/g, '‹esc-backtick›');
    // Inline code `text`
    result = result.replace(/`([^`\n]+)`/g, '<code class="bg-indigo-500/10 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-xs border border-indigo-400/20 shadow-[0_0_8px_rgba(99,102,241,0.1)]">$1</code>');
    result = result.replace(/‹esc-backtick›/g, '`');

    // Bold and italic combos ***text***
    result = result.replace(/\*\*\*(?!\s)(.+?)\*\*\*/g, '<strong class="text-indigo-400 drop-shadow-[1px_1.5px_0px_rgba(0,0,0,1)]"><em>$1</em></strong>');
    // Bold **text**
    result = result.replace(/\*\*(?!\s)(.+?)\*\*/g, '<strong class="text-indigo-300 drop-shadow-[1px_1.5px_0px_rgba(0,0,0,1)]">$1</strong>');
    // Italic *text*
    result = result.replace(/\*(?!\s)(.+?)\*/g, '<em class="text-slate-300">$1</em>');
    // Underscore emphasis variants (word-boundary aware per CommonMark)
    result = result.replace(/(?<!\w)___(?!\s)(.+?)___(?!\w)/g, '<strong class="text-indigo-400 drop-shadow-[1px_1.5px_0px_rgba(0,0,0,1)]"><em>$1</em></strong>');
    result = result.replace(/(?<!\w)__(?!\s)(.+?)__(?!\w)/g, '<strong class="text-indigo-300 drop-shadow-[1px_1.5px_0px_rgba(0,0,0,1)]">$1</strong>');
    result = result.replace(/(?<!\w)_(?!\s)(.+?)_(?!\w)/g, '<em class="text-slate-300">$1</em>');
    // Strikethrough ~~text~~
    result = result.replace(/~~(?!\s)(.+?)~~/g, '<del class="text-slate-500 line-through">$1</del>');
    // Highlight ==text==
    result = result.replace(/==([^=\n]+)==/g, '<mark class="bg-[#FC8F35]/15 text-[#fcc18d] px-1 py-0.5 rounded-sm border-b border-[#FC8F35]/30 mx-0.5">$1</mark>');
    // Superscript ^text^
    result = result.replace(/\^([^\^\n]+)\^/g, '<sup class="text-slate-400 text-[0.7em] leading-none">$1</sup>');
    // Subscript ~text~ — only short scientific subscripts (no spaces, no $, max 15 chars)
    result = result.replace(/~([^~\n]+)~/g, (match, content) => {
        if (content.includes('$') || content.includes(' ') || content.length > 15) return match;
        return `<sub class="text-slate-400 text-[0.7em] leading-none">${content}</sub>`;
    });

    return result;
}

/**
 * Converts blockquotes including nested levels (>> nested, >>> deep)
 * Operates on RAW `>` prefixes (not HTML-escaped &gt;).
 * Produces depth-aware premium styled blockquotes with RECURSIVE inner rendering.
 */
function convertBlockquotesToHtml(block: string, isStreaming: boolean = false): string {
    const lines = block.split('\n');

    // Depth-based styling: each nesting level gets progressively dimmer border
    const depthStyles = [
        // Level 1 — Primary
        'border-l-4 border-cyan-500/30 pl-6 pr-4 py-3 my-4 bg-black/8 backdrop-blur-md rounded-r-xl text-slate-300 leading-snug shadow-xl text-md font-medium',
        // Level 2 — Secondary
        'border-l-[3px] border-indigo-400/25 pl-5 pr-3 py-2 my-2 bg-indigo-500/5 rounded-r-lg text-slate-400 leading-snug text-sm',
        // Level 3+ — Tertiary
        'border-l-2 border-slate-500/20 pl-4 pr-2 py-1.5 my-1 bg-white/[0.02] rounded-r-md text-slate-500 leading-snug text-sm',
    ];

    // Group consecutive lines by their minimum shared depth
    // Then recursively render inner content through toHtml
    const processAtDepth = (inputLines: string[], targetDepth: number): string => {
        const output: string[] = [];
        let i = 0;

        while (i < inputLines.length) {
            const line = inputLines[i];
            const match = line.match(/^[ \t]*((?:>\s*)+)(.*)$/);

            if (!match) {
                // Non-quote line at this depth — just push it
                if (line.trim()) output.push(line);
                i++;
                continue;
            }

            const level = (match[1].match(/>/g) || []).length;

            if (level < targetDepth) {
                // This line belongs to a parent level — stop processing
                break;
            }

            if (level === targetDepth) {
                // Content at exactly this depth — strip one level of `>` prefix
                output.push(match[2]);
                i++;
            } else {
                // Deeper nesting — collect all consecutive deeper lines and recurse
                const nestedLines: string[] = [];
                while (i < inputLines.length) {
                    const nestedMatch = inputLines[i].match(/^((?:>\s*)+)(.*)$/);
                    if (!nestedMatch) break;
                    const nestedLevel = (nestedMatch[1].match(/>/g) || []).length;
                    if (nestedLevel < level) break;
                    nestedLines.push(inputLines[i]);
                    i++;
                }
                const nestedHtml = processAtDepth(nestedLines, level);
                const styleIdx = Math.min(level - 1, depthStyles.length - 1);
                output.push(`<blockquote class="${depthStyles[styleIdx]}" data-type="blockquote">${nestedHtml}</blockquote>`);
            }
        }

        // Join the stripped lines and render them through the main pipeline
        // This enables full support for code blocks, tables, lists, etc. inside blockquotes
        const innerContent = output.join('\n');

        // Check if output already contains rendered HTML (from nested blockquotes)
        // If so, we need to be careful not to double-process it
        if (innerContent.includes('<blockquote')) {
            // Split into segments: rendered blockquotes vs raw markdown
            const segments = innerContent.split(/(<blockquote[\s\S]*?<\/blockquote>)/g);
            return segments.map(seg => {
                if (seg.startsWith('<blockquote')) return seg;
                if (!seg.trim()) return '';
                return toHtml(seg, isStreaming);
            }).join('');
        }

        return toHtml(innerContent, isStreaming);
    };

    // Start processing from depth 1
    const styleIdx = 0;
    const innerHtml = processAtDepth(lines, 1);
    const extra = isStreaming ? 'data-animated="true" is-visible' : '';
    return `<blockquote ${extra} class="${depthStyles[styleIdx]}" data-type="blockquote">${innerHtml}</blockquote>`;
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
        while (listStack.length > 0 && listStack[listStack.length - 1].indent > targetIndent) {
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

    // Depth-aware style profiles for <li> items (indexed by effectiveDepth)
    const liDepthStyles = [
        'pl-1 text-slate-200 leading-relaxed',           // Level 0 — primary items
        'pl-1 text-sm text-slate-300/90 leading-relaxed', // Level 1 — first nesting
        'pl-1 text-sm text-slate-400/80 leading-snug',    // Level 2 — deep nesting
        'pl-1 text-xs text-slate-500/70 leading-snug',    // Level 3+ — very deep
    ];
    const getLiStyle = (d: number) => liDepthStyles[Math.min(d, liDepthStyles.length - 1)];

    for (let i = 0; i < contentLines.length; i++) {
        const line = contentLines[i];
        const trimmed = line.trim();

        // Task list: - [x], - [ ], or - [/] — \s+ to tolerate variable spacing from LLMs
        const taskMatch = line.match(/^(\s*)([\*\-\u2022\u00B7])\s+\[(x| |\/)\]\s+(.*)$/i);
        // Standard unordered list
        const ulMatch = !taskMatch ? line.match(/^(\s*)([\*\-\u2022\u00B7])\s+(.*)$/) : null;
        // Ordered list
        const olMatch = !taskMatch && !ulMatch ? line.match(/^(\s*)(\d+)\.\s+(.*)$/) : null;

        const isDivider = trimmed === '---DIVIDER---';

        if (taskMatch || ulMatch || olMatch) {
            const isTask = !!taskMatch;
            const isUl = isTask || !!ulMatch;
            const type: 'ul' | 'ol' = isUl ? 'ul' : 'ol';
            const content = isTask ? taskMatch[4] : (ulMatch ? ulMatch[3] : olMatch![3]);
            const rawIndent = (taskMatch ? taskMatch[1] : (ulMatch ? ulMatch[1] : olMatch![1])).length;
            const indent = rawIndent;

            // ── PHASE 1: Stack manipulation (open/close lists) ──
            if (listStack.length === 0) {
                // First list item ever — open a new list
                const marginClass = 'my-2';
                processed.push(`<${type} class="space-y-1 ${marginClass} ml-6 cursor-default marker:text-indigo-400/60">`);
                listStack.push({ type, indent });
            } else {
                const top = listStack[listStack.length - 1];

                if (indent > top.indent) {
                    // Deeper nesting — open new nested list
                    processed.push(`<${type} class="space-y-0.5 mt-1 ml-4 cursor-default marker:text-cyan-400/50">`);
                    listStack.push({ type, indent });
                } else if (indent < top.indent) {
                    // Returning to a higher level — close deeper lists
                    closeListsToLevel(indent);

                    if (listStack.length > 0) {
                        processed.push('</li>');
                    } else {
                        // All lists were closed, start fresh
                        processed.push(`<${type} class="space-y-1 my-3 ${isUl ? 'list-disc' : 'list-decimal'} list-outside ml-6 marker:text-indigo-400/60">`);
                        listStack.push({ type, indent });
                    }
                } else {
                    // Same level — close previous <li>, stay in same list
                    processed.push('</li>');
                }
            }

            // ── PHASE 2: Compute EFFECTIVE depth AFTER stack changes ──
            // This is the nesting level of this item: 0 = root, 1 = first child, etc.
            const effectiveDepth = listStack.length - 1;

            // ── PHASE 3: Render <li> with correct depth-aware styling ──
            if (isTask) {
                const marker = taskMatch[3].toLowerCase();
                const isChecked = marker === 'x';
                const isPartial = marker === '/';

                let checkIcon = '☐';
                let textClass = 'text-slate-300';

                if (isChecked) {
                    checkIcon = '☑';
                    textClass = 'text-slate-500 line-through decoration-white/10';
                } else if (isPartial) {
                    checkIcon = '▣';
                    textClass = 'text-indigo-200 font-medium';
                }

                // Task items also get smaller at deeper nesting
                const taskSizeClass = effectiveDepth === 0 ? '' : effectiveDepth === 1 ? 'text-sm' : 'text-xs';

                processed.push(`<li class="list-none pl-1 flex items-center gap-3 ${taskSizeClass}">`
                    + `<span class="${isPartial ? 'text-[#fca865]' : 'text-indigo-400/60'} text-base mb-0.5 mr-0.5">${checkIcon}</span>`
                    + `<span class="${textClass}">${content}</span>`);
            } else {
                processed.push(`<li class="${getLiStyle(effectiveDepth)}">${content}`);
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
                const blockTags = [
                    '<h1', '<h2', '<h3', '<h4', '<h5', '<h6', 
                    '<pre', '<table', '<blockquote', '<div', '<details', '<summary', 
                    '<section', '<article', '<aside', '<nav', '<header', '<footer', '<main', 
                    '<figure', '<figcaption', '<p', '<br', '<blockquote', 
                    '</h', '</pre', '</table', '</blockquote', '</div', '</details', '</summary', 
                    '</section', '</article', '</aside', '</nav', '</header', '</footer', '</main', 
                    '</figure', '</figcaption', '</p',
                    '__BLOCK_' // Placeholder immunity
                ];
                const startsWithBlock = blockTags.some(tag => trimmed.toLowerCase().startsWith(tag));
                
                // Formatting tags should remain inline and NOT trigger a div wrapper if they are on a line alone
                const inlineTags = ['<strong', '<em', '<small', '<code', '<kbd', '<mark', '<abbr', '<sup', '<sub', '<link'];
                const startsWithInline = inlineTags.some(tag => trimmed.toLowerCase().startsWith(tag));

                if (!startsWithBlock && !startsWithInline) {
                    processed.push(`<div class="mb-3 leading-loose">${trimmed}</div>`);
                } else {
                    // Check if the block is a table or blockquote and ensure it's not wrapped with extra bottom space
                    if (trimmed.toLowerCase().startsWith('<div class="overflow-hidden') || trimmed.toLowerCase().startsWith('<blockquote')) {
                        processed.push(trimmed);
                    } else {
                        processed.push(line);
                    }
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

    // Step 0: Escape literal $ to avoid misinterpretation
    let highlighted = code.replace(/\$/g, '‹DOLLAR›');
    const tokens: string[] = [];

    const addToken = (content: string, className: string) => {
        const id = `##TOKEN_${tokens.length}##`;
        tokens.push(`<span class="${className}">${content}</span>`);
        return id;
    };

    // 0. Basic Comments (Single line // or #)
    // At start of line
    highlighted = highlighted.replace(/^(\s*)(\/\/|#)(.*)$/gm, (match, space, prefix, content) => 
        space + addToken(prefix + content, 'text-slate-600 italic font-medium')
    );
    // Inline (preceded by space)
    highlighted = highlighted.replace(/([ \t]+)(\/\/|#)(.*)$/gm, (match, space, prefix, content) => 
        space + addToken(prefix + content, 'text-slate-600 italic font-medium')
    );

    if (lang === 'mermaid' || lang === 'flowchart' || lang === 'graph' || lang === 'gitgraph' || lang === 'erdiagram' || lang === 'mindmap' || lang === 'pie' || lang.startsWith('statediagram') || lang === 'gantt' || lang === 'sequencediagram') {
        // 1. Strings in quotes - (e.g., "Label")
        highlighted = highlighted.replace(/"([^"]+)"/g, (_, str) => addToken(`"${str}"`, 'text-emerald-400 font-medium'));

        // 2. Specialized Values (e.g., : 45 in Pie charts or dates in Gantt)
        highlighted = highlighted.replace(/(:\s*)(\d+(\.\d+)?|[\d\-]{4,})/g, 
            (_, colon, val) => `${colon}${addToken(val, 'text-amber-400 font-black')}`
        );

        // 3. Labels in brackets - (e.g., [Text] or {Text})
        highlighted = highlighted.replace(/([\[\(\{])([^\]\)\}]*)([\]\)\}])/g, 
            (_, open, content, close) => `${addToken(open, 'text-slate-500')}${addToken(content, 'text-slate-200 font-semibold')}${addToken(close, 'text-slate-500')}`
        );

        // 4. Connectors (Arrows and lines) - Must use escaped versions
        highlighted = highlighted.replace(/(--&gt;|--|==&gt;|-&gt;|-\.-&gt;|-.-|==|\|o--o\{|\|--\|\{|--o\{|--\|\{|&gt;&gt;)/g, (match) => addToken(match, 'text-cyan-500 font-black drop-shadow-[0_0_5px_rgba(6,182,212,0.4)]'));

        // 5. Aliases - (e.g., participant U as User)
        highlighted = highlighted.replace(/\b(as)\b/g, (match) => addToken(match, 'text-sky-500 italic'));

        // 6. Keywords
        // 6a. Main structure types with Icons
        highlighted = highlighted.replace(/\b(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|stateDiagram-v2|erDiagram|journey|gantt|pie|requirementDiagram|gitGraph|mindmap|root)\b/gi, (match) => {
            const m = match.toLowerCase();
            let icon = 'fa-project-diagram';
            if (m.includes('sequence')) icon = 'fa-stream';
            if (m.includes('gantt')) icon = 'fa-tasks';
            if (m.includes('pie')) icon = 'fa-chart-pie';
            if (m.includes('git')) icon = 'fa-code-branch';
            if (m.includes('mindmap')) icon = 'fa-brain';
            if (m.includes('er')) icon = 'fa-database';

            return addToken(`<i class="fas ${icon} text-[0.8em] opacity-80 mr-2"></i>${m}`, 'text-cyan-400 font-black uppercase tracking-widest italic text-[0.85em] border-b border-cyan-500/20 pb-0.5');
        });
        
        // 6b. Block elements & Entities
        highlighted = highlighted.replace(/\b(participant|actor|subgraph|end|state|note|over|left of|right of|section|title)\b/g, (match) => addToken(match, 'text-indigo-400 font-bold'));

        // 6c. GitGraph & Specialized actions
        highlighted = highlighted.replace(/\b(branch|checkout|commit|merge|tag|done|active|crit|after|dateFormat|accTitle|accDescr)\b/g, (match) => addToken(match, 'text-fuchsia-400/90 font-semibold'));

        // 7. General identifiers (if not already tokenized)
        highlighted = highlighted.replace(/\b(TD|LR|BT|RL|TB|int|string|date|float|PK|FK)\b/g, (match) => addToken(match, 'text-slate-400 font-mono text-[0.9em]'));
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

    // Pass 2: Restore tokens and characters
    tokens.forEach((html, i) => {
        highlighted = highlighted.replace(`##TOKEN_${i}##`, html);
    });

    highlighted = highlighted.replace(/‹DOLLAR›/g, '$');

    return highlighted;
}
/**
 * Converts basic LaTeX-like math syntax to styled HTML/Unicode.
 * Handles: Fractions, Greek letters, Operators, Matrices, Aligned, and Brackets.
 *
 * ⚠️ ARCHITECTURE: HTML entity escaping MUST happen AFTER structural block parsers
 * (aligned, cases, matrix) that split on LaTeX '&'. Escaping '&' first breaks those splits.
 * Instead we protect existing HTML tags with tokens and escape residual plain chars at the end.
 */
function convertMathToHtml(math: string): string {
    let html = math;

    // NOTE: No early HTML escaping here — see comment above.

    // 2. Matrices: \begin{pmatrix} a & b \\ c & d \end{pmatrix}
    const matrixRegex = /\\begin\{(p|b|v|V|B)matrix\}([\s\S]*?)\\end\{\1matrix\}/g;
    html = html.replace(matrixRegex, (match, type, content) => {
        const rows = content.trim().split(/\\\\(?:\[[^\]]+\])?/g);
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
        const rows = content.trim().split(/\\\\(?:\[[^\]]+\])?/g);
        let casesHtml = `<span class="inline-flex items-center mx-1"><span class="text-4xl font-extralight scale-y-[2.2] scale-x-[0.8] mr-2 text-cyan-400/40">{</span>`;
        casesHtml += `<span class="flex flex-col text-left text-sm gap-1">`;
        rows.forEach(row => {
            if (!row.trim()) return;
            const parts = row.split(/&/);
            casesHtml += `<span class="flex gap-4"><span>${convertMathToHtml(parts[0].trim())}</span>${parts[1] ? `<span class="opacity-60">${convertMathToHtml(parts[1].trim())}</span>` : ''}</span>`;
        });
        casesHtml += `</span></span>`;
        return casesHtml;
    });

    // 3d. Aligned / Align: \begin{aligned} ... \end{aligned} or \begin{align} ... \end{align}
    html = html.replace(/\\begin\{(aligned|align\*?)\}([\s\S]*?)\\end\{\1\}/g, (match, type, content) => {
        const rows = content.trim().split(/\\\\(?:\[[^\]]+\])?/g).filter(r => r.trim());
        let maxCols = 0;
        const processedRows = rows.map(row => {
            const parts = row.split(/&/);
            maxCols = Math.max(maxCols, parts.length);
            return parts;
        });

        let alignedHtml = `<span class="grid gap-x-2 gap-y-1.5 items-center my-2 w-full justify-center overflow-x-auto" style="grid-template-columns: repeat(${maxCols}, max-content)">`;
        
        processedRows.forEach(parts => {
            for (let i = 0; i < maxCols; i++) {
                const part = parts[i] || '';
                const alignClass = i % 2 === 0 ? 'text-right justify-self-end' : 'text-left justify-self-start';
                alignedHtml += `<span class="${alignClass}">${convertMathToHtml(part.trim())}</span>`;
            }
        });
        alignedHtml += `</span>`;
        return alignedHtml;
    });

    // ✅ HTML ESCAPE (post-block): Protect <span> tags generated by block parsers above,
    // escape bare & < > in residual LaTeX text, then restore the protected span tags.
    const _tagTokens: string[] = [];
    html = html.replace(/<[^>]+>/g, (tag) => {
        const id = `\x00T${_tagTokens.length}\x00`;
        _tagTokens.push(tag);
        return id;
    });
    // Now only raw math text remains — safe to escape
    html = html.replace(/&(?!amp;|lt;|gt;|nbsp;|#)/g, '&amp;');
    html = html.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Restore HTML tag tokens
    _tagTokens.forEach((tag, i) => {
        html = html.replace(`\x00T${i}\x00`, tag);
    });

    // 3e. Delimiters: \left and \right — convert to styled brackets
    html = html.replace(/\\left\\{/g, '{');
    html = html.replace(/\\right\\}/g, '}');
    html = html.replace(/\\left([([|])/g, '$1');
    html = html.replace(/\\right([)\]|])/g, '$1');
    html = html.replace(/\\left\./g, '');
    html = html.replace(/\\right\./g, '');

    // 3f. Grouping commas {,} → , (used for number formatting like 299{,}792)
    html = html.replace(/\{,\}/g, ',');

    // 3g. \text{} and formatting commands (must run before operator substitution)
    html = html.replace(/\\text\{([^}]*)\}/g, '<span class="font-sans not-italic opacity-80">$1</span>');
    html = html.replace(/\\mathcal\{([^}]*)\}/g, '<span class="font-serif" style="font-family: cursive">$1</span>');
    html = html.replace(/\\mathbb\{([^}]*)\}/g, '<span class="font-bold font-serif">$1</span>');
    html = html.replace(/\\mathrm\{([^}]*)\}/g, '<span class="not-italic">$1</span>');
    html = html.replace(/\\operatorname\{([^}]*)\}/g, '<span class="not-italic">$1</span>');

    // 4. Common Operators & Large Symbols
    // IMPORTANT: Sorted by key length (longest first) to prevent substring collisions (e.g. \cdot eating \cdots)
    const ops: Record<string, string> = {
        '\\Leftrightarrow': '⇔', '\\leftrightarrow': '↔',
        '\\Rightarrow': '⇒', '\\Leftarrow': '⇐',
        '\\rightarrow': '→', '\\leftarrow': '←',
        '\\varepsilon_0': 'ε₀', '\\varepsilon': 'ε',
        '\\setminus': '∖', '\\emptyset': '∅',
        '\\partial': '∂', '\\approx': '≈',
        '\\propto': '∝', '\\equiv': '≡',
        '\\infty': '∞', '\\nabla': '∇',
        '\\notin': '∉', '\\subset': '⊂', '\\supset': '⊃',
        '\\times': '×', '\\cdots': '⋯', '\\vdots': '⋮', '\\ddots': '⋱',
        '\\cdot': '·',
        '\\sqrt': '√', '\\hbar': 'ℏ',
        '\\prod': 'Π', '\\oint': '∮',
        '\\neq': '≠', '\\leq': '≤', '\\geq': '≥',
        '\\cup': '∪', '\\cap': '∩',
        '\\sum': 'Σ', '\\int': '∫',
        '\\lim': 'lim', '\\det': 'det', '\\max': 'max', '\\min': 'min',
        '\\sup': 'sup', '\\inf': 'inf', '\\dim': 'dim', '\\ker': 'ker',
        '\\div': '÷', '\\pm': '±', '\\mp': '∓',
        '\\sim': '∼', '\\in': '∈',
        '\\exists': '∃', '\\forall': '∀',
        '\\mathbf': '',
        '\\quad': '&nbsp;&nbsp;&nbsp;&nbsp;', '\\qquad': '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;',
        '\\,': '&thinsp;', '\\;': '&nbsp;', '\\!': '',
    };
    // Process in key-length order (longest first) to prevent prefix collisions
    Object.entries(ops)
        .sort((a, b) => b[0].length - a[0].length)
        .forEach(([latex, uni]) => {
            const escaped = latex.replace(/\\/g, '\\\\');
            html = html.replace(new RegExp(escaped, 'g'), uni);
        });

    // 5. Greek Letters
    const greek: Record<string, string> = {
        '\\varphi': 'φ', '\\vartheta': 'ϑ', '\\varrho': 'ϱ', '\\varsigma': 'ς',
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
    html = html.replace(/\\textbf\{([^}]*)\}/g, '<span class="font-bold">$1</span>');
    html = html.replace(/\\textit\{([^}]*)\}/g, '<span class="italic">$1</span>');
    html = html.replace(/\\underline\{([^}]*)\}/g, '<span class="underline">$1</span>');
    html = html.replace(/\\overline\{([^}]*)\}/g, '<span class="border-t border-current">$1</span>');
    
    // Catch any remaining \text{} that weren't handled in 3g (e.g. nested contexts)
    html = html.replace(/\\text\{([^}]*)\}/g, '<span class="font-sans not-italic opacity-80">$1</span>');

    // Remove sizing, spacing, and layout commands that are either unsupported or handled implicitly by our wrapper
    html = html.replace(/\\(displaystyle|textstyle|scriptstyle|scriptscriptstyle|normalsize|Large|large|LARGE|huge|Huge|small|tiny)/g, '');
    html = html.replace(/\\([hv]space|rule)\{[^}]*\}/g, '');

    // 8. Final cleanup: remove stray braces that were used for LaTeX grouping
    html = html.replace(/(?<!\\)[{}]/g, '');

    return html;
}
