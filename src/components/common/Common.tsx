import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { toHtml } from '../../utils';
import { formatFinalResponse } from '../../services/formatters';

export const Icon = ({ name, className = "" }: { name: string; className?: string }) => (
    <i className={`fas fa-${name} ${className}`} aria-hidden="true" />
);

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
