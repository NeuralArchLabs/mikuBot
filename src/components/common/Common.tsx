import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { toHtml } from '../../utils';
import { formatFinalResponse } from '../../services/formatters';

export const Icon = ({ name, className = "" }: { name: string; className?: string }) => {
    const isBrand = ['python', 'node-js', 'github', 'google', 'facebook', 'twitter', 'discord', 'telegram', 'npm', 'js'].includes(name.toLowerCase());
    const family = isBrand ? 'fab' : 'fas';
    return <i className={`${family} fa-${name} ${className}`} aria-hidden="true" />;
};

// ⚡ ABSOLUTE PROTECTION: CORE MARKDOWN RENDERER ENGINE
// This component manages the final sanitization and HTML injection.
// DO NOT ALTER recursion logic or sanitizer settings.
const MarkdownRendererBase = ({ content }: { content: string }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const html = useMemo(() => {
        const normalized = formatFinalResponse(content);
        return toHtml(normalized);
    }, [content]);

    // DO NOT MODIFY: Auto-healing logic for IntersectionObserver typewriter animation
    useEffect(() => {
        if (!containerRef.current) return;

        const containerNode = containerRef.current;
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const el = entry.target as HTMLElement;
                    if (entry.isIntersecting) {
                        if (el.tagName === 'BLOCKQUOTE') {
                            if (!el.classList.contains('is-visible')) {
                                el.classList.add('is-visible');
                                const fullHtml = el.getAttribute('data-original-html') || '';
                                el.innerHTML = '';
                                
                                let cursor = 0;
                                let currentHtml = '';
                                let inTag = false;
                                
                                if ((el as any)._typeInterval) clearInterval((el as any)._typeInterval);
                                
                                (el as any)._typeInterval = setInterval(() => {
                                    if (cursor >= fullHtml.length) {
                                        el.innerHTML = fullHtml;
                                        clearInterval((el as any)._typeInterval);
                                        return;
                                    }
                                    currentHtml += fullHtml[cursor];
                                    if (fullHtml[cursor] === '<') inTag = true;
                                    if (fullHtml[cursor] === '>') inTag = false;
                                    cursor++;
                                    if (!inTag) {
                                        el.innerHTML = currentHtml + '<span class="inline-block w-[4px] h-[13px] ml-0.5 bg-cyan-400/80 animate-pulse rounded-sm shadow-[0_0_8px_rgba(34,211,238,0.6)] translate-y-[1px]"></span>';
                                    }
                                }, 8);
                            }
                        } else {
                            el.classList.add('is-visible');
                        }
                    } else {
                        el.classList.remove('is-visible');
                        if (el.tagName === 'BLOCKQUOTE') {
                            if ((el as any)._typeInterval) clearInterval((el as any)._typeInterval);
                            el.innerHTML = ''; 
                        }
                    }
                });
            },
            { threshold: 0.1 }
        );

        const animatedElements = containerNode.querySelectorAll('.divider-container, blockquote');
        animatedElements.forEach((el) => {
            if (el.tagName === 'BLOCKQUOTE' && !el.hasAttribute('data-original-html')) {
                const htmlEl = el as HTMLElement;
                htmlEl.setAttribute('data-original-html', htmlEl.innerHTML);
                htmlEl.innerHTML = ''; 
            }
            observer.observe(el);
        });

        return () => {
            observer.disconnect();
        };
    }, [html]);

    return (
        <div
            ref={containerRef}
            className="markdown-body font-mono px-1"
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
}

// ⚡ ABSOLUTE PROTECTION: INTERACTIVE ENGINE & UI HOOKS
// Manages the mutation of DOM elements for copy-buttons and checkboxes.
const InteractiveMarkdownRendererBase = ({ content }: InteractiveMarkdownRendererProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [checkboxes, setCheckboxes] = useState<Record<string, boolean>>({});

    // Separate checkbox lines from plain markdown
    const { checkboxElements, plainMarkdown } = useMemo(() => {
        const lines = content.split('\n');
        const checkboxItems: { id: string; checked: boolean; content: string }[] = [];
        const plainLines: string[] = [];

        lines.forEach((line, index) => {
            const uncheckedMatch = line.match(/^(\s*)- \[ \] (.*)$/);
            const checkedMatch = line.match(/^(\s*)- \[x\] (.*)$/);

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

    // Add copy buttons to code blocks after rendering (post-processing)
    useEffect(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        const codeBlocks = container.querySelectorAll('pre');

        codeBlocks.forEach((pre) => {
            // Skip if copy button already exists
            if (pre.querySelector('.copy-button')) return;

            // Get code content
            const codeElement = pre.querySelector('code');
            if (!codeElement) return;

            const codeText = codeElement.textContent || '';

            // Create copy button
            const copyButton = document.createElement('button');
            copyButton.className = 'copy-button absolute top-2 right-2 px-2 py-1 text-xs bg-black/50 hover:bg-cyan-500/30 border border-cyan-400/30 rounded text-cyan-300 transition-all duration-200 flex items-center gap-1';
            copyButton.innerHTML = '<i class="fas fa-copy text-xs"></i> Copiar';

            // Add click handler
            copyButton.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(codeText);
                    copyButton.innerHTML = '<i class="fas fa-check text-xs"></i> Copiado!';
                    setTimeout(() => {
                        copyButton.innerHTML = '<i class="fas fa-copy text-xs"></i> Copiar';
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy:', err);
                }
            });

            // Make pre relative for absolute positioning
            pre.style.position = 'relative';
            pre.appendChild(copyButton);
        });

        return () => {
            // Cleanup copy buttons when unmounting
            const buttons = container.querySelectorAll('.copy-button');
            buttons.forEach(btn => btn.remove());
        };
    }, [plainMarkdown]);

    return (
        <div ref={containerRef} className="markdown-body font-mono px-1">
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
            {plainMarkdown.trim() && <MarkdownRendererBase content={plainMarkdown} />}
        </div>
    );
};

export const InteractiveMarkdownRenderer = React.memo(InteractiveMarkdownRendererBase);

export interface SelectOption {
    value: string;
    label: string;
    isCustom?: boolean;
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
                className={`w-full bg-slate-950/70 border border-transparent hover:border-white/10 rounded-2xl px-8 py-4 text-xs text-white outline-none transition-all font-black flex items-center justify-between shadow-inner group`}
            >
                <span className="flex-grow text-center truncate px-2 group-hover:text-blue-400 transition-colors">{activeOption ? activeOption.label : placeholder}</span>
                <Icon 
                    name={isOpen ? 'times' : (iconVariant === 'plus' ? 'plus' : 'chevron-down')} 
                    className={`text-slate-600 text-[10px] ml-2 transition-all ${isOpen ? 'duration-500 transform rotate-90 scale-125 text-blue-500 opacity-100' : 'duration-200 rotate-0 scale-100 opacity-60'}`} 
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
                        className={`bg-slate-900/98 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-xl shadow-black/80 z-[9999] py-2 overflow-hidden animate-premium`}
                    >
                        <div className="max-h-[220px] overflow-y-auto custom-scrollbar mr-2 ml-1 py-1">
                            {options.length === 0 && (
                                <div className="px-6 py-4 text-[10px] text-slate-500 font-bold text-center italic">{placeholder}</div>
                            )}
                            {options.map((opt, idx) => {
                                const isCustom = opt.value === 'CUSTOM' || opt.isCustom;
                                return (
                                    <React.Fragment key={opt.value}>
                                        {isCustom && idx > 0 && <div className="h-px bg-white/5 mx-6 my-2 mb-3" />}
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onChange(opt.value);
                                                setIsOpen(false);
                                            }}
                                            className={`px-6 py-2.5 mx-1 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all ${
                                                value === opt.value 
                                                    ? 'bg-blue-600/20 text-blue-400 shadow-lg' 
                                                    : isCustom 
                                                        ? 'text-slate-600 hover:bg-white/5 hover:text-slate-300' 
                                                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                            } ${isCustom ? 'italic bg-white/5' : ''}`}
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
