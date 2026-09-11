import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MarkdownRenderer, Icon } from './Common';
import { useTranslation } from 'react-i18next';
import { cleanProviderReasoningSummary } from '../../services/core/agent/chat';
import { formatFinalResponse } from '../../services/formatters';
import { toHtml } from '../../utils';
import { sanitizeRichContent } from '../../utils/security/richContentPolicy';

interface CollapsibleTextBlockProps {
    content: string;
    forceCollapse?: boolean;
    isThought?: boolean;
    /** Public provider summary. It behaves like a thought block but uses its own tone and label. */
    isThoughtSummary?: boolean;
    isStreaming?: boolean;
    mode?: 'full' | 'minimal' | 'none';
    hasCustomBg?: boolean;
}

// ── Content Renderers (Polymorphic Logic) ──────────────────────────

interface ContentRendererProps {
    content: string;
    isStreaming?: boolean;
    mode?: 'full' | 'minimal' | 'none';
    onHeightChange?: (height: number) => void;
}

/**
 * During the post-stream typewriter pass a Markdown emphasis marker can be
 * visible for a few frames before its closing marker arrives. Those two
 * characters participate in line wrapping even though they disappear from
 * the final HTML, which makes the thought panel briefly grow and then shrink.
 * Hide only the unmatched pair while typing; complete pairs still go through
 * the normal formatter and render as emphasis.
 */
const hideUnmatchedBoldMarker = (value: string): string => {
    const marker = /(?<!\*)\*\*(?!\*)/g;
    let match: RegExpExecArray | null;
    let lastMarker = -1;
    let count = 0;

    while ((match = marker.exec(value)) !== null) {
        count += 1;
        lastMarker = match.index;
    }

    if (count % 2 === 0 || lastMarker < 0) return value;
    return `${value.slice(0, lastMarker)}${value.slice(lastMarker + 2)}`;
};

/**
 * Keep emphasis in the same DOM shape throughout the post-stream typewriter.
 *
 * The complete response is already available when a thought is opened after
 * streaming. If the visible prefix stops inside `**text**`, we add an
 * invisible-to-the-user synthetic closing marker so the formatter creates the
 * final `<strong>` node immediately. The marker is never displayed and is
 * replaced by the real closing marker as soon as it enters the prefix. This
 * prevents a line from changing its font metrics halfway through the reveal.
 */
const stabilizeEmphasisForTyping = (source: string, visibleLength: number): string => {
    const prefix = source.slice(0, visibleLength);
    if (!prefix) return prefix;

    // Match the same emphasis families supported by the inline formatter,
    // preferring triple markers so they are not mistaken for a bold pair.
    const ranges: Array<{ open: number; close: number; marker: string }> = [];
    const rangePattern = /(\*\*\*|___|\*\*|__)(?!\s)([\s\S]+?)\1/g;
    let match: RegExpExecArray | null;
    while ((match = rangePattern.exec(source)) !== null) {
        const marker = match[1];
        const open = match.index;
        const close = open + marker.length + match[2].length;
        // The inline formatter requires at least one non-whitespace character
        // after the opening marker; mirror that guard here.
        if (match[2].trim().length > 0) ranges.push({ open, close, marker });
    }

    const activeRanges = ranges.filter(({ open, close, marker }) => (
        visibleLength >= open + marker.length &&
        visibleLength < close + marker.length
    ));

    // If the prefix currently contains the first character of a real closing
    // delimiter, remove that incomplete delimiter before adding the synthetic
    // one. Otherwise `**text*` would be parsed as three trailing asterisks and
    // briefly lose the stable `<strong>` node for exactly one frame.
    const partialClosingRange = activeRanges.find(({ close }) => visibleLength > close);
    const stablePrefix = partialClosingRange
        ? prefix.slice(0, partialClosingRange.close)
        : prefix;

    const syntheticClosers = activeRanges
        // Closing nested spans in reverse order keeps the temporary Markdown
        // source balanced until the real delimiters arrive.
        .sort((a, b) => b.open - a.open)
        .map(({ marker }) => marker)
        .join('');

    return hideUnmatchedBoldMarker(stablePrefix + syntheticClosers);
};

/**
 * A collapsed preview is an inline, single-line surface. Prefixing a leading
 * list marker with a zero-width character keeps the minimal formatter from
 * creating a block-level `<ol>`/`<ul>` inside the preview span. Unordered
 * markers are normalized to the same bullet glyph used by the full renderer;
 * ordered markers keep their number.
 */
const PREVIEW_BULLET_TOKEN = '\uE000';

const keepLeadingListInline = (value: string): string => value.replace(
    /^((?:[-+*])\s+|(?:\d+[.)])\s+)/u,
    (marker) => marker.match(/^[-+*]/u)
        ? `${PREVIEW_BULLET_TOKEN}${marker.slice(1)}`
        : `\u200B${marker}`
);

/**
 * `toHtml(..., 'minimal')` deliberately wraps plain lines in `<div>` blocks.
 * A collapsed preview is itself an inline, clipped span, so retaining those
 * blocks creates an invalid span→div tree and makes inline code in reasoning
 * previews drop below the text rail. Remove only the formatter's structural
 * wrappers after sanitization; inline Markdown elements remain intact.
 */
const flattenPreviewBlocks = (markup: string): string => markup
    .replace(/<div\b[^>]*>/giu, '')
    .replace(/<\/div>/giu, '')
    .replace(/<br\s*\/?\s*>/giu, ' ');

/**
 * Standard content display without animations.
 */
const StaticRenderer: React.FC<ContentRendererProps> = ({ content, isStreaming, mode, onHeightChange }) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (ref.current && onHeightChange) {
            const observer = new ResizeObserver(entries => {
                onHeightChange(entries[0].target.clientHeight);
            });
            observer.observe(ref.current);
            return () => observer.disconnect();
        }
    }, [onHeightChange]);

    return (
        <div ref={ref} className="animate-in fade-in duration-500">
            <MarkdownRenderer content={content} isStreaming={isStreaming} mode={mode} />
        </div>
    );
};

/**
 * Streaming content display that reveals text over time.
 * Optimized to NOT reset animation when content appends (streaming).
 */
const StreamingRenderer: React.FC<ContentRendererProps> = ({ content, isStreaming, mode, onHeightChange }) => {
    const [visibleContent, setVisibleContent] = useState('');
    const [isFinished, setIsFinished] = useState(false);
    const [firstLineHeight, setFirstLineHeight] = useState<number | null>(null);
    const ref = useRef<HTMLDivElement>(null);
    const typedLengthRef = useRef(0);
    const firstLineHeightRef = useRef<number | null>(null);

    useEffect(() => {
        if (ref.current && onHeightChange) {
            const observer = new ResizeObserver(entries => {
                const target = entries[0].target as HTMLElement;
                const height = target.clientHeight;

                // Establish the shell from the first real line. This baseline
                // is deliberately kept for the lifetime of the typewriter;
                // later lines may grow the panel, but formatting a line can
                // never make the panel smaller than that first line.
                if (height > 0 && firstLineHeightRef.current === null) {
                    const markdownRoot = target.querySelector('.markdown-body') as HTMLElement | null;
                    const firstBlock = markdownRoot?.firstElementChild as HTMLElement | null;
                    const rootStyle = markdownRoot ? getComputedStyle(markdownRoot) : null;
                    const blockStyle = firstBlock ? getComputedStyle(firstBlock) : null;
                    const lineHeight = rootStyle ? parseFloat(rootStyle.lineHeight) : NaN;
                    const fontSize = rootStyle ? parseFloat(rootStyle.fontSize) : NaN;
                    const fallbackLineHeight = Number.isFinite(fontSize) ? fontSize * 1.55 : 24;
                    const marginBottom = blockStyle ? parseFloat(blockStyle.marginBottom) : 0;
                    const baseline = Math.max(
                        1,
                        (Number.isFinite(lineHeight) ? lineHeight : fallbackLineHeight) +
                            (Number.isFinite(marginBottom) ? marginBottom : 0)
                    );
                    firstLineHeightRef.current = baseline;
                    setFirstLineHeight(baseline);
                }

                onHeightChange(Math.max(height, firstLineHeightRef.current || 0));
            });
            observer.observe(ref.current);
            return () => observer.disconnect();
        }
    }, [onHeightChange]);

    useEffect(() => {
        // 🎯 ADAPTIVE CHUNK SIZING: Scales chars-per-tick based on content length
        //   - Short (<200): 1 char/tick → classic typewriter feel
        //   - Medium (<800): ~3 chars/tick → smooth flow
        //   - Long (800+): batch to finish in ~3.5s max → no flicker
        const remaining = content.length - typedLengthRef.current;
        if (remaining <= 0) { setIsFinished(true); return; }

        const TICK_MS = 16; // ~60fps aligned
        const MAX_DURATION_MS = Math.min(3500 + Math.max(0, content.length - 800) * 2, 12000);
        const totalTicks = MAX_DURATION_MS / TICK_MS;
        const charsPerTick = remaining < 200 ? 1
            : remaining < 800 ? Math.max(2, Math.ceil(remaining / totalTicks))
            : Math.max(4, Math.ceil(remaining / totalTicks));

        let rafId: number;
        let lastTime = 0;

        const tick = (now: number) => {
            if (!lastTime) lastTime = now;
            if (now - lastTime >= TICK_MS) {
                lastTime = now;
                if (typedLengthRef.current < content.length) {
                    typedLengthRef.current = Math.min(typedLengthRef.current + charsPerTick, content.length);
                    setVisibleContent(content.substring(0, typedLengthRef.current));
                    setIsFinished(false);
                } else {
                    setIsFinished(true);
                    return; // Stop loop
                }
            }
            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(rafId);
    }, [content]);

    // When a block is opened after the provider stream has ended, keep an
    // emphasis range formatted from its opening marker onward. That prevents
    // the completed `**` pair from replacing a normal inline box with a bold
    // one and moving every line below it.
    const renderedContent = !isStreaming
        ? stabilizeEmphasisForTyping(content, typedLengthRef.current)
        : visibleContent;

    return (
        <div
            ref={ref}
            className="relative animate-in fade-in duration-300"
            style={firstLineHeight ? { minHeight: `${firstLineHeight}px` } : undefined}
        >
            {/* Once the typewriter has caught up, render the complete Markdown
                tree instead of keeping the append-only stream DOM alive. This
                is important for inline boundaries such as `**A** **B**`: the
                final render must preserve the separator that was inserted by
                the provider-summary normalizer. */}
            <MarkdownRenderer
                content={renderedContent}
                isStreaming={!!isStreaming && !isFinished}
                mode={mode}
                showTypingCursor={!isFinished}
            />
        </div>
    );
};

// ── Main Component ──────────────────────────────────────────────────

export const CollapsibleTextBlock: React.FC<CollapsibleTextBlockProps> = ({ content, forceCollapse, isThought, isThoughtSummary, isStreaming, mode, hasCustomBg }) => {
    const { t } = useTranslation();
    const thoughtLike = !!isThought || !!isThoughtSummary;
    const [isCollapsed, setIsCollapsed] = useState(forceCollapse !== undefined ? forceCollapse : thoughtLike);
    const hasInteractedRef = React.useRef(false);

    // Auto-collapse logic: Only force if user hasn't manually toggled it
    React.useEffect(() => {
        if (forceCollapse !== undefined && !hasInteractedRef.current) {
            setIsCollapsed(forceCollapse);
        }
    }, [forceCollapse]);

    // PRE-PROCESSING: Remove <think> tags if they exist to avoid NESTED collapsibles from MarkdownRenderer
    const cleanContent = React.useMemo(() => {
        if (isThoughtSummary) return cleanProviderReasoningSummary(content);
        if (!thoughtLike) return content;
        return content.replace(/<\/?think>/gi, '').trim();
    }, [content, thoughtLike, isThoughtSummary]);

    const handleToggle = () => {
        hasInteractedRef.current = true;
        setIsCollapsed(!isCollapsed);
    };

    // Keep the preview on one line, but run it through the minimal formatter so
    // emphasis is rendered instead of exposing the model's `**` delimiters.
    // Rendering the complete source and clipping it in CSS avoids cutting a
    // Markdown pair in half at the 80-character boundary.
    const previewContent = React.useMemo(
        () => keepLeadingListInline(cleanContent.replace(/[\s\r\n]+/g, ' ').trim()),
        [cleanContent]
    );
    const previewHtml = React.useMemo(() => {
        const sanitized = sanitizeRichContent(
            toHtml(formatFinalResponse(previewContent), false, 'minimal'),
            { source: 'agent' }
        );
        return flattenPreviewBlocks(sanitized).replaceAll(
            PREVIEW_BULLET_TOKEN,
            '<span class="thought-preview-marker" aria-hidden="true">•</span>'
        );
    }, [previewContent]);

    const [dotOffset, setDotOffset] = useState(0);

    const handleHeightUpdate = useCallback((h: number) => {
        setDotOffset(h + 12);
    }, []);

    return (
        <div className={`relative group/text-block mb-3 pl-6 transition-all duration-300 w-full ${isStreaming ? 'animate-in fade-in slide-in-from-top-2 duration-500' : ''} ${isCollapsed ? '' : 'h-auto'}`}>
            {/* Neural connector line (Thread trace) */}
            <div 
                className={`absolute left-[5px] top-0 bottom-[-15px] w-0.5 transition-all duration-700 ${isCollapsed ? '' : isThoughtSummary ? 'shadow-[0_0_8px_rgba(251,191,36,0.2)]' : 'shadow-[0_0_8px_rgba(59,130,246,0.2)]'}`}
                style={{
                    background: isCollapsed 
                        ? `linear-gradient(to bottom, transparent, ${isThoughtSummary ? 'rgba(120, 92, 40, 0.28)' : 'rgba(51, 65, 85, 0.2)'} 20%, ${isThoughtSummary ? 'rgba(120, 92, 40, 0.28)' : 'rgba(51, 65, 85, 0.2)'} 80%, transparent)`
                        : isThoughtSummary
                            ? 'linear-gradient(to bottom, transparent 0%, rgba(251, 191, 36, 0.8) 15%, rgba(245, 158, 11, 0.4) 50%, transparent 100%)'
                            : 'linear-gradient(to bottom, transparent 0%, rgba(59, 130, 246, 0.8) 15%, rgba(139, 92, 246, 0.4) 50%, transparent 100%)'
                }}
            ></div>

            {/* Neural focal point (Node) with dynamic positioning */}
            <div 
                className={`absolute left-[2.5px] top-[14px] w-1.5 h-1.5 rounded-full z-20 transition-all duration-300 ease-out ${isCollapsed ? (isThoughtSummary ? 'bg-amber-900 border border-amber-600' : 'bg-slate-700 border border-slate-600') : (isThoughtSummary ? 'bg-amber-300 border border-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.8)] animate-pulse' : 'bg-blue-400 border border-blue-200 shadow-[0_0_12px_rgba(96,165,250,0.8)] animate-pulse')}`}
                style={{ 
                    transform: isCollapsed ? 'none' : `translateY(${dotOffset}px)`
                }}
            ></div>

            {isCollapsed ? (
                /* COLLAPSED ... */
                <button
                    onClick={handleToggle}
                    className={`w-full text-left cursor-pointer group/inner relative rounded-xl p-3 py-2 text-[11px] transition-all flex items-center gap-3 shadow-xl focus:outline-none overflow-hidden ${
                        hasCustomBg 
                        ? 'bg-slate-900/60 border border-transparent backdrop-blur-2xl text-slate-200 shadow-black/80' 
                        : 'bg-slate-900/20 hover:bg-slate-800/40 border border-transparent text-slate-400 shadow-black/60'
                    }`}
                >
                    <div className="flex-shrink-0 flex items-center gap-2">
                        <Icon name={isThoughtSummary ? 'lightbulb' : 'brain'} className={`relative -top-px text-[11px] leading-none ${isThoughtSummary ? 'text-amber-300' : isThought ? 'text-blue-400' : 'text-slate-500'}`} />
                        <span className={`text-[9px] uppercase tracking-[0.2em] font-black ${isThoughtSummary ? 'text-amber-300' : hasCustomBg ? 'text-blue-400' : 'text-blue-500/70'}`}>{t(isThoughtSummary ? 'chat.labels.thought_summary' : 'chat.labels.reasoning')}</span>
                    </div>
                    <div className="w-px h-3 bg-white/10 flex-shrink-0" />
                    
                    {/* Zero-Intrinsic-Width Flex Wrapper */}
                    <div className="thought-preview flex-1 relative h-6 min-w-0 overflow-hidden">
                        <span
                            className={`absolute inset-0 block truncate font-mono tracking-tight transition-opacity leading-4 ${hasCustomBg ? 'opacity-100' : 'opacity-50 group-hover/inner:opacity-100'}`}
                            dangerouslySetInnerHTML={{ __html: previewHtml }}
                        />
                    </div>

                    <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 ml-auto">
                        <Icon name="chevron-down" className="text-[10px] opacity-40 group-hover/inner:opacity-100 transition-all transform group-hover/inner:translate-y-0.5" />
                    </div>
                </button>
            ) : (
                /* EXPANDED: Full view with integrated header */
                <div className="animate-in fade-in duration-500 relative">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <div className="flex items-center gap-2">
                            <Icon name={isThoughtSummary ? 'lightbulb' : 'brain'} className={`relative -top-px text-[10px] leading-none animate-pulse ${isThoughtSummary ? 'text-amber-300' : 'text-blue-400'}`} />
                            <span className={`text-[9px] uppercase tracking-[0.25em] font-black ${isThoughtSummary ? 'text-amber-300/90' : 'text-blue-400/80'}`}>{t(isThoughtSummary ? 'chat.labels.thought_summary' : 'chat.labels.active_reasoning')}</span>
                        </div>
                        <button
                            onClick={handleToggle}
                            className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors flex items-center gap-1.5 focus:outline-none"
                        >
                            {t('chat.actions.hide')} <Icon name="chevron-up" className="text-[8px]" />
                        </button>
                    </div>
                    <div className={`thought-content text-[13px] sm:text-[14px] leading-relaxed text-slate-300 rounded-2xl p-4 overflow-hidden transition-[background-color,transform] duration-500 ${isThoughtSummary ? 'bg-amber-400/[0.05] border border-amber-300/20 shadow-[inner_0_0_20px_rgba(251,191,36,0.03)]' : isThought ? 'bg-blue-500/[0.03] border border-blue-500/10 shadow-[inner_0_0_20px_rgba(59,130,246,0.01)]' : 'bg-white/[0.01] border border-white/5'} ${hasCustomBg ? 'backdrop-blur-xl bg-slate-900/40' : ''}`}>
                        {thoughtLike ? (
                            <StreamingRenderer content={cleanContent} isStreaming={isStreaming} mode={mode || 'minimal'} onHeightChange={handleHeightUpdate} />
                        ) : (
                            <StaticRenderer content={cleanContent} isStreaming={isStreaming} mode={mode} onHeightChange={handleHeightUpdate} />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
