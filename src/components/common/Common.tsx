import React, { useMemo, useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { toHtml, renderMermaidBlocks, renderSingleMermaidBlock } from '../../utils';
import { formatFinalResponse } from '../../services/formatters';

export const Icon = ({ name, className = "" }: { name: string; className?: string }) => {
    const isBrand = ['python', 'node-js', 'github', 'google', 'facebook', 'twitter', 'discord', 'telegram', 'npm', 'js'].includes(name.toLowerCase());
    const family = isBrand ? 'fab' : 'fas';
    return <i className={`${family} fa-${name} ${className}`} aria-hidden="true" />;
};

// ⚡ GLOBAL ANIMATION QUEUE MANAGER
// Serializes viewport interception animations to prevent simultaneous DOM thrashing.
class AnimationQueueManager {
    private queue: { el: HTMLElement; task: () => Promise<void> }[] = [];
    private isProcessing = false;
    private readonly TASK_TIMEOUT = 20000; // 20s failsafe timeout per task

    enqueue(el: HTMLElement, task: () => Promise<void>) {
        // Prevent duplicate entries for the same element
        if (this.queue.some(item => item.el === el)) return;
        
        this.queue.push({ el, task });
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    /**
     * Removes an element from the queue. 
     * Useful when an element leaves the viewport before its animation starts.
     */
    dequeue(el: HTMLElement) {
        this.queue = this.queue.filter(item => item.el !== el);
    }

    private async processQueue() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        
        while (this.queue.length > 0) {
            const item = this.queue.shift();
            if (item) {
                try {
                    // 🛡️ SHIELD: Race against timeout to prevent queue hangs
                    await Promise.race([
                        item.task(),
                        new Promise<void>((_, reject) => 
                            setTimeout(() => reject(new Error('Animation Task Timeout')), this.TASK_TIMEOUT)
                        )
                    ]);
                } catch (e) {
                    // 🩹 GRACEFUL RECOVERY: Snap timed-out elements to their final state
                    // so they don't remain invisible/broken
                    const el = item.el;
                    if ((el as any)._typeInterval) {
                        clearInterval((el as any)._typeInterval);
                        delete (el as any)._typeInterval;
                    }
                    if (el.tagName === 'BLOCKQUOTE') {
                        const original = el.getAttribute('data-original-html');
                        if (original) el.innerHTML = original;
                        el.classList.add('is-visible');
                        el.classList.remove('is-typing');
                        el.removeAttribute('data-queued-ui');
                    } else if (el.classList.contains('mermaid')) {
                        // Mermaid may still be rendering; leave it alone
                    } else {
                        el.classList.remove('opacity-0', 'scale-95', 'blur-sm');
                        el.classList.add('opacity-100', 'scale-100', 'blur-0', 'is-visible');
                    }
                    
                    // 🛡️ NESTED PROTECTION: If this element is a container, force all its nested 
                    // animated children to their final state to prevent them from staying invisible.
                    el.querySelectorAll('.code-block-anim, .mermaid, .divider-container, .signature-wrapper').forEach(child => {
                        const childEl = child as HTMLElement;
                        childEl.classList.remove('opacity-0', 'scale-95', 'blur-sm');
                        childEl.classList.add('opacity-100', 'scale-100', 'blur-0', 'is-visible');
                        childEl.setAttribute('data-animated', 'true');
                    });

                    el.setAttribute('data-animated', 'true');
                    el.removeAttribute('data-enqueued');
                    console.debug('[AnimationQueue] Task timed out, element and children snapped to final state.');
                }
            }
        }
        this.isProcessing = false;
    }
}
const globalAnimationQueue = new AnimationQueueManager();

// ⚡ ABSOLUTE PROTECTION: CORE MARKDOWN RENDERER ENGINE
// This component manages the final sanitization and HTML injection.
// DO NOT ALTER recursion logic or sanitizer settings.
const MarkdownRendererBase = ({ content, isStreaming, mode = 'full' }: { content: string, isStreaming?: boolean, mode?: 'full' | 'minimal' | 'none' }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    // Tracks how many characters of content have been committed to the DOM via append.
    // Existing DOM content is NEVER touched — only new paragraphs get appended.
    const committedLenRef = useRef(0);

    // Full HTML for non-streaming mode (final render + post-streaming animations)
    const html = useMemo(() => {
        if (isStreaming) return '';
        return toHtml(formatFinalResponse(content), false, mode);
    }, [content, isStreaming, mode]);

    // ⚡ APPEND-ONLY STREAMING: During streaming, detect new complete paragraphs and
    // append them to the DOM using insertAdjacentHTML. This is zero-flicker because
    // existing DOM nodes are never removed or replaced — only new ones are added.
    useLayoutEffect(() => {
        if (!isStreaming || !containerRef.current) {
            committedLenRef.current = 0;
            return;
        }

        const prevLen = committedLenRef.current;
        const newContent = content.substring(prevLen);
        if (!newContent) return;

        // Find the last paragraph break in the new (uncommitted) content
        const paraBreak = newContent.lastIndexOf('\n\n');
        if (paraBreak < 0) return; // No complete paragraph yet — keep buffering

        // Commit everything up to and including the paragraph break
        const commitUpTo = prevLen + paraBreak + 2;
        const newParagraphs = content.substring(prevLen, commitUpTo);
        const newHtml = toHtml(formatFinalResponse(newParagraphs), true, mode);

        containerRef.current.insertAdjacentHTML('beforeend',
            `<div class="stream-paragraph-enter">${newHtml}</div>`
        );
        committedLenRef.current = commitUpTo;
    }, [content, isStreaming, mode]);

    // ⚡ DEFER ANIMATIONS: Prevent intersection observer initialization during streaming
    // to avoid typewriter effects restarting on every incremental chunk.
    useEffect(() => {
        if (!containerRef.current || isStreaming) return;

        const containerNode = containerRef.current;
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const el = entry.target as HTMLElement;

                    if (el.hasAttribute('data-animated')) return;

                    if (entry.isIntersecting) {
                        if (el.hasAttribute('data-enqueued')) return;
                        el.setAttribute('data-enqueued', 'true');

                        if (el.tagName === 'BLOCKQUOTE') {
                            if (!el.hasAttribute('data-queued-ui')) {
                                el.setAttribute('data-queued-ui', 'true');
                                const fullHtml = el.getAttribute('data-original-html') || '';
                                const titleMatch = fullHtml.match(/^<div class="[^"]*non-typing[^"]*">.*?<\/div>/);
                                const idleTitleHtml = titleMatch ? titleMatch[0] : '';

                                el.innerHTML = `<div class="blockquote-anim-container relative">`
                                    + `<div class="blockquote-placeholder invisible select-none pointer-events-none">${fullHtml}</div>`
                                    + `<div class="blockquote-typing absolute inset-0">${idleTitleHtml}</div>`
                                    + `</div>`;
                            }
                        }

                        globalAnimationQueue.enqueue(el, () => {
                            return new Promise<void>((resolve) => {
                                const rect = el.getBoundingClientRect();
                                const isVisible = rect.top < window.innerHeight + 300 && rect.bottom > -300;

                                if (!isVisible) {
                                    if (el.tagName === 'BLOCKQUOTE') {
                                        el.innerHTML = el.getAttribute('data-original-html') || '';
                                        el.classList.add('is-visible');
                                        el.classList.remove('is-typing');
                                        el.removeAttribute('data-queued-ui');
                                    } else if (el.classList.contains('mermaid')) {
                                        renderSingleMermaidBlock(el);
                                    } else if (el.classList.contains('code-block-anim')) {
                                        el.classList.remove('opacity-0', 'scale-95', 'blur-sm');
                                        el.classList.add('opacity-100', 'scale-100', 'blur-0', 'is-visible');
                                    } else {
                                        el.classList.add('is-visible');
                                    }
                                    el.setAttribute('data-animated', 'true');
                                    el.removeAttribute('data-enqueued');
                                    resolve();
                                    return;
                                }

                                if (el.tagName === 'BLOCKQUOTE') {
                                    if (!el.classList.contains('is-typing')) {
                                        el.removeAttribute('data-queued-ui');
                                        el.classList.add('is-typing', 'is-visible');
                                        const fullHtml = el.getAttribute('data-original-html') || '';
                                        const typingEl = el.querySelector('.blockquote-typing') as HTMLElement;

                                        if (!typingEl) {
                                            el.setAttribute('data-animated', 'true');
                                            el.removeAttribute('data-enqueued');
                                            resolve();
                                            return;
                                        }

                                        const titleMatch = fullHtml.match(/^<div class="[^"]*non-typing[^"]*">.*?<\/div>/);
                                        const idleTitleHtml = titleMatch ? titleMatch[0] : '';

                                        let cursor = idleTitleHtml.length;
                                        let currentHtml = idleTitleHtml;

                                        const contentLength = fullHtml.length - cursor;
                                        const TICK_MS = 16;
                                        const MAX_DURATION_MS = Math.min(4000 + Math.max(0, contentLength - 600) * 2, 12000);
                                        const totalTicks = MAX_DURATION_MS / TICK_MS;
                                        const charsPerTick = contentLength < 200 ? 1
                                            : contentLength < 600 ? Math.max(2, Math.ceil(contentLength / totalTicks))
                                            : Math.max(4, Math.ceil(contentLength / totalTicks));

                                        let lastTime = 0;
                                        const tickLoop = (now: number) => {
                                            if (!lastTime) lastTime = now;
                                            if (now - lastTime < TICK_MS) {
                                                (el as any)._typeRaf = requestAnimationFrame(tickLoop);
                                                return;
                                            }
                                            lastTime = now;

                                            if (cursor >= fullHtml.length) {
                                                // To prevent the "flash" of hidden content after typing finishes,
                                                // we restore the HTML but keep the visible state for elements that were just typed.
                                                // This satisfies "manten el efecto typewriter" while ensuring everything stays visible.
                                                const finalHtml = fullHtml.replace(/\bopacity-0\b/g, 'opacity-100 is-visible')
                                                                          .replace(/\bscale-95\b/g, 'scale-100')
                                                                          .replace(/\bblur-sm\b/g, 'blur-0');
                                                el.innerHTML = finalHtml;
                                                el.classList.remove('is-typing');

                                                // Mark everything as animated so the observer doesn't try to re-animate them
                                                el.querySelectorAll('.code-block-anim, .mermaid, .divider-container, .signature-wrapper').forEach(child => {
                                                    child.setAttribute('data-animated', 'true');
                                                });

                                                el.setAttribute('data-animated', 'true');
                                                el.removeAttribute('data-enqueued');
                                                resolve();
                                                return;
                                            }

                                            for (let i = 0; i < charsPerTick && cursor < fullHtml.length; i++) {
                                                if (fullHtml[cursor] === '<') {
                                                    const remaining = fullHtml.substring(cursor);
                                                    const nonTypingMatch = remaining.match(/^<div class="[^"]*non-typing[^"]*">.*?<\/div>/);
                                                    if (nonTypingMatch) {
                                                        currentHtml += nonTypingMatch[0];
                                                        cursor += nonTypingMatch[0].length;
                                                        continue;
                                                    }
                                                    const tagMatch = remaining.match(/^<[^>]+>/);
                                                    if (tagMatch) {
                                                        let tag = tagMatch[0];
                                                        // ⚡ CROSS-ANIMATION SYNC:
                                                        // When we encounter a container that should animate (opacity-0), 
                                                        // we tag it with a timestamp. We will use this to calculate 
                                                        // a manual fade-in during the typewriter ticks.
                                                        if (tag.includes('opacity-0') && !tag.includes('data-anim-start')) {
                                                            tag = tag.replace('>', ` data-anim-start="${performance.now()}">`);
                                                        }
                                                        currentHtml += tag;
                                                        cursor += tagMatch[0].length;
                                                        continue;
                                                    }
                                                }
                                                currentHtml += fullHtml[cursor];
                                                cursor++;
                                            }

                                            if (typingEl) {
                                                const isTypingFinished = fullHtml.substring(cursor).replace(/<[^>]+>/g, '').trim() === '';
                                                
                                                // ⚡ MANUAL STAGGERED FADE-IN:
                                                // We process the current HTML to calculate and apply smooth fade/scale/blur 
                                                // transitions manually based on when each tag was first "typed".
                                                // This "crosses" the entry animation with the typewriter effect perfectly.
                                                const currentTime = performance.now();
                                                const animatedHtml = currentHtml.replace(/(<[^>]+data-anim-start="(\d+\.?\d*)"[^>]*>)/g, (match, fullTag, startTimeStr) => {
                                                    const startTime = parseFloat(startTimeStr);
                                                    const elapsed = currentTime - startTime;
                                                    const DURATION = 650; // ms (slightly slower for premium feel)
                                                    const progress = Math.min(elapsed / DURATION, 1);
                                                    
                                                    // Easing: ease-out cubic
                                                    const ease = 1 - Math.pow(1 - progress, 3);
                                                    
                                                    const opacity = ease;
                                                    const scale = 0.96 + (0.04 * ease);
                                                    const blur = 4 * (1 - ease);
                                                    
                                                    // Strip the classes and markers, apply as inline style
                                                    return fullTag.replace(/\bopacity-0\b/g, 'opacity-100')
                                                                  .replace(/\bscale-95\b/g, 'scale-100')
                                                                  .replace(/\bblur-sm\b/g, 'blur-0')
                                                                  .replace(/data-anim-start="[^"]*"/, '')
                                                                  .replace('>', ` style="opacity: ${opacity}; transform: scale(${scale}); filter: blur(${blur}px); transition: none !important;">`);
                                                });

                                                if (cursor < fullHtml.length && !isTypingFinished) {
                                                    typingEl.innerHTML = animatedHtml + '<span class="inline-block w-[4px] h-[13px] ml-0.5 bg-cyan-400/80 animate-pulse rounded-sm shadow-[0_0_8px_rgba(34,211,238,0.6)] translate-y-[1px]"></span>';
                                                } else {
                                                    typingEl.innerHTML = animatedHtml;
                                                }
                                            }
                                            (el as any)._typeRaf = requestAnimationFrame(tickLoop);
                                        };
                                        (el as any)._typeRaf = requestAnimationFrame(tickLoop);
                                    } else {
                                        resolve();
                                    }
                                } else if (el.classList.contains('mermaid')) {
                                    renderSingleMermaidBlock(el);
                                    el.setAttribute('data-animated', 'true');
                                    el.removeAttribute('data-enqueued');
                                    resolve();
                                } else if (el.classList.contains('code-block-anim')) {
                                    el.classList.remove('opacity-0', 'scale-95', 'blur-sm');
                                    el.classList.add('opacity-100', 'scale-100', 'blur-0', 'is-visible');
                                    setTimeout(() => {
                                        el.setAttribute('data-animated', 'true');
                                        el.removeAttribute('data-enqueued');
                                        resolve();
                                    }, 400);
                                } else if (el.classList.contains('signature-wrapper')) {
                                    el.classList.add('is-visible');
                                    setTimeout(() => {
                                        el.setAttribute('data-animated', 'true');
                                        el.removeAttribute('data-enqueued');
                                        resolve();
                                    }, 1800);
                                } else if (el.classList.contains('divider-container')) {
                                    el.classList.add('is-visible');
                                    setTimeout(() => {
                                        el.setAttribute('data-animated', 'true');
                                        el.removeAttribute('data-enqueued');
                                        resolve();
                                    }, 500);
                                } else {
                                    el.classList.add('is-visible');
                                    el.setAttribute('data-animated', 'true');
                                    el.removeAttribute('data-enqueued');
                                    resolve();
                                }
                            });
                        });
                    } else {
                        if (el.hasAttribute('data-enqueued') && !el.classList.contains('is-typing')) {
                            globalAnimationQueue.dequeue(el);
                            el.removeAttribute('data-enqueued');

                            if (el.tagName === 'BLOCKQUOTE' && el.hasAttribute('data-queued-ui')) {
                                el.innerHTML = el.getAttribute('data-original-html') || '';
                                el.removeAttribute('data-queued-ui');
                            }
                        }
                    }
                });
            },
            { threshold: 0.1, rootMargin: '100px' }
        );

        const animatedElements = containerNode.querySelectorAll('.divider-container, blockquote, .mermaid, .code-block-anim, .signature-wrapper');
        animatedElements.forEach((el) => {
            if (el.tagName === 'BLOCKQUOTE' && !el.hasAttribute('data-original-html')) {
                const htmlEl = el as HTMLElement;
                htmlEl.setAttribute('data-original-html', htmlEl.innerHTML);
            }
            observer.observe(el);
        });

        return () => {
            observer.disconnect();
            animatedElements.forEach(el => {
                if ((el as any)._typeInterval) clearInterval((el as any)._typeInterval);
            });
        };
    }, [html, isStreaming]);

    if (isStreaming) {
        // During streaming: container is empty initially. Paragraphs are appended
        // by the useLayoutEffect above as they complete. No React re-rendering of content.
        return (
            <div
                ref={containerRef}
                className={`${mode !== 'none' ? 'markdown-body' : ''} font-mono px-1 is-streaming`}
                lang="es"
            />
        );
    }

    return (
        <div
            ref={containerRef}
            className={`${mode !== 'none' ? 'markdown-body' : ''} font-mono px-1`}
            lang="es"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
};



export const MarkdownRenderer = React.memo(MarkdownRendererBase);

// Checkbox item component for interactive lists
interface CheckboxItemProps {
    key?: string;
    id: string;
    checked: boolean;
    onChange: (id: string, checked: boolean) => void;
    children: React.ReactNode;
}

const CheckboxItem = ({ id, checked, onChange, children }: CheckboxItemProps) => {
    const handleToggle = () => {
        onChange(id, !checked);
    };

    return (
        <div className="flex items-start gap-2 mb-1.5 ml-6">
            <button
                type="button"
                onClick={handleToggle}
                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all duration-200 ${
                    checked
                        ? 'bg-cyan-500/80 border-cyan-400 text-white'
                        : 'border-cyan-400/40 bg-transparent hover:border-cyan-400/70'
                }`}
                aria-label={checked ? "Completado" : "Pendiente"}
            >
                {checked && <span className="text-xs font-bold">✓</span>}
            </button>
            <span className={`flex-1 ${checked ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                {children}
            </span>
        </div>
    );
};

// Interactive Markdown renderer with checkboxes and copy functionality
interface InteractiveMarkdownRendererProps {
    content: string;
    isStreaming?: boolean;
}

// ⚡ ABSOLUTE PROTECTION: INTERACTIVE ENGINE & UI HOOKS
// Manages the mutation of DOM elements for copy-buttons and checkboxes.
const InteractiveMarkdownRendererBase = ({ content, isStreaming }: InteractiveMarkdownRendererProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [checkboxes, setCheckboxes] = useState<Record<string, boolean>>({});

    // Separate checkbox lines from plain markdown
    const { checkboxElements, plainMarkdown } = useMemo(() => {
        const lines = content.split('\n');
        const checkboxItems: { id: string; checked: boolean; content: string }[] = [];
        const plainLines: string[] = [];

        lines.forEach((line, index) => {
            const uncheckedMatch = line.match(/^(\s*)(?:-|\*)\s+\[ \]\s+(.*)$/i);
            const checkedMatch = line.match(/^(\s*)(?:-|\*)\s+\[(x|X|\/)\]\s+(.*)$/i);

            if (uncheckedMatch) {
                const id = `checkbox-${index}`;
                checkboxItems.push({ id, checked: false, content: uncheckedMatch[2] });
            } else if (checkedMatch) {
                const id = `checkbox-${index}`;
                checkboxItems.push({ id, checked: true, content: checkedMatch[2] });
            } else {
                plainLines.push(line);
            }
        });

        return { checkboxElements: checkboxItems, plainMarkdown: plainLines.join('\n') };
    }, [content]);

    // Initialize checkbox states from content
    useEffect(() => {
        const newCheckboxes: Record<string, boolean> = {};
        checkboxElements.forEach(item => {
            newCheckboxes[item.id] = item.checked;
        });
        setCheckboxes(prev => ({ ...prev, ...newCheckboxes }));
    }, [checkboxElements]);

    const handleCheckboxChange = useCallback((id: string, checked: boolean) => {
        setCheckboxes(prev => ({ ...prev, [id]: checked }));
    }, []);

    // Copy buttons and syntax highlighting are now handled globally by the toHtml engine in formatting.ts
    // to ensure a consistent, premium aesthetic across all renderers.


    return (
        <div ref={containerRef} className="markdown-body font-mono px-1" lang="es">
            {/* Render interactive checkboxes */}
            {checkboxElements.map(item => (
                <CheckboxItem
                    key={item.id}
                    id={item.id}
                    checked={checkboxes[item.id] ?? item.checked}
                    onChange={handleCheckboxChange}
                >
                    {item.content}
                </CheckboxItem>
            ))}

            {/* Render plain markdown with original renderer (includes typewriter, tables, etc.) */}
            {plainMarkdown.trim() && <MarkdownRendererBase content={plainMarkdown} isStreaming={isStreaming} />}
        </div>
    );
};

export const InteractiveMarkdownRenderer = React.memo(InteractiveMarkdownRendererBase);

export interface SelectOption {
    value: string;
    label: string;
    isCustom?: boolean;
    style?: React.CSSProperties;
    className?: string;
}

export const ModernSelect = ({ 
    value, 
    onChange, 
    options, 
    placeholder = "Select...", 
    className = "",
    title = "",
    dropDirection = 'down',
    iconVariant = 'chevron'
}: { 
    value: string; 
    onChange: (val: string) => void; 
    options: SelectOption[]; 
    placeholder?: string;
    className?: string;
    title?: string;
    dropDirection?: 'up' | 'down';
    iconVariant?: 'chevron' | 'plus';
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const portalRef = useRef<HTMLDivElement>(null);

    const activeOption = options.find(o => o.value === value);

    useEffect(() => {
        if (!isOpen) return;
        const handleScroll = (e: Event) => {
            const target = e.target as HTMLElement;
            // Ignore scrolls from within the button container or the portal/dropdown itself
            if (containerRef.current?.contains(target) || portalRef.current?.contains(target)) return;
            
            // Only close if the scroll happens in the body or a parent scrollable container
            if (target === document.body || target === document.documentElement || (target.scrollHeight > target.clientHeight)) {
                setIsOpen(false);
            }
        };
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node) && 
                portalRef.current && !portalRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('mousedown', handleClickOutside);
        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div ref={containerRef} className={`relative ${className}`} title={title}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full bg-[var(--surface-color)] border border-[var(--border-color)] hover:border-[var(--primary-color)]/30 rounded-2xl px-8 py-4 text-xs text-[var(--text-primary)] outline-none transition-all font-black flex items-center justify-between shadow-inner group backdrop-blur-md`}
            >
                <span className="flex-grow text-center truncate px-2 group-hover:text-[var(--primary-color)] transition-colors">{activeOption ? activeOption.label : placeholder}</span>
                <Icon 
                    name={isOpen ? 'times' : (iconVariant === 'plus' ? 'plus' : 'chevron-down')} 
                    className={`text-slate-600 text-[10px] ml-2 transition-all ${isOpen ? 'duration-500 transform rotate-90 scale-125 text-[var(--primary-color)] opacity-100' : 'duration-200 rotate-0 scale-100 opacity-60'}`} 
                />
            </button>
            {isOpen && createPortal(
                <div 
                    className="fixed inset-0 z-[9998] pointer-events-none"
                    onClick={() => setIsOpen(false)}
                >
                    <div 
                        ref={portalRef}
                        onClick={(e) => e.stopPropagation()}
                        style={{ 
                            position: 'fixed',
                            top: dropDirection === 'up' ? 'auto' : `${containerRef.current?.getBoundingClientRect().bottom ? containerRef.current.getBoundingClientRect().bottom + 8 : 0}px`,
                            bottom: dropDirection === 'up' ? `${window.innerHeight - (containerRef.current?.getBoundingClientRect().top || 0) + 8}px` : 'auto',
                            left: `${containerRef.current?.getBoundingClientRect().left || 0}px`,
                            width: `${containerRef.current?.getBoundingClientRect().width || 0}px`,
                            pointerEvents: 'auto'
                        }}
                        className={`bg-[var(--surface-color)] backdrop-blur-3xl border border-[var(--border-color)] rounded-2xl shadow-xl shadow-black/80 z-[9999] py-2 overflow-hidden animate-premium`}
                    >
                        <div className="max-h-[220px] overflow-y-auto custom-scrollbar mr-2 ml-1 py-1">
                            {options.length === 0 && (
                                <div className="px-6 py-4 text-[10px] text-slate-500 font-bold text-center italic">{placeholder}</div>
                            )}
                            {options.map((opt, idx) => {
                                const isCustom = opt.value === 'CUSTOM' || opt.isCustom;
                                return (
                                    <React.Fragment key={opt.value}>
                                        {isCustom && idx > 0 && <div className="h-px bg-[var(--border-color)] mx-6 my-2 mb-3 opacity-30" />}
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onChange(opt.value);
                                                setIsOpen(false);
                                            }}
                                            className={`px-6 py-2.5 mx-1 rounded-xl text-[10px] font-black tracking-widest cursor-pointer transition-all ${
                                                value === opt.value 
                                                    ? 'bg-[var(--primary-color)]/20 text-[var(--primary-color)] shadow-lg' 
                                                    : isCustom 
                                                        ? 'text-[var(--text-secondary)] hover:bg-[var(--hover-color)] hover:text-[var(--text-primary)]' 
                                                        : 'text-[var(--text-secondary)] hover:bg-[var(--hover-color)] hover:text-[var(--text-primary)]'
                                            } ${isCustom ? 'italic opacity-60' : ''} ${opt.className || (opt.style?.fontFamily ? '' : 'uppercase')}`}
                                            style={opt.style}
                                        >
                                            {isCustom && !opt.label.toLowerCase().includes('personal') ? `✨ ${opt.label}` : opt.label}
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
