import React, { useMemo, useEffect, useRef } from 'react';
import { toHtml } from '../../utils';
import { formatFinalResponse } from '../../services/formatters';

export const Icon = ({ name, className = "" }: { name: string; className?: string }) => (
    <i className={`fas fa-${name} ${className}`} aria-hidden="true" />
);

const MarkdownRendererBase = ({ content }: { content: string }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const html = useMemo(() => {
        // First normalize text (single source of truth for cleanup)
        const normalized = formatFinalResponse(content);
        // Then convert to HTML
        return toHtml(normalized);
    }, [content]);

    useEffect(() => {
        if (!containerRef.current) return;

        const containerNode = containerRef.current;
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                    } else {
                        // Allow resetting the animation when out of view
                        entry.target.classList.remove('is-visible');
                    }
                });
            },
            { threshold: 0.1 }
        );

        // Re-attach observer strictly to any newly formed divider blocks
        const dividers = containerNode.querySelectorAll('.divider-container');
        dividers.forEach((d) => observer.observe(d));

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
