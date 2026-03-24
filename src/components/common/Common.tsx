import React, { useMemo, useEffect, useRef } from 'react';
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
                                        el.innerHTML = currentHtml + '<span class="inline-block w-[6px] h-[14px] ml-1 bg-cyan-400/80 animate-pulse align-middle rounded-sm shadow-[0_0_8px_rgba(34,211,238,0.6)]"></span>';
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
                htmlEl.style.minHeight = `${htmlEl.clientHeight}px`;
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
