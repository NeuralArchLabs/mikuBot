import React, { useMemo } from 'react';
import { toHtml } from '../../utils';
import { formatFinalResponse } from '../../services/formatters';

export const Icon = ({ name, className = "" }: { name: string; className?: string }) => (
    <i className={`fas fa-${name} ${className}`} aria-hidden="true" />
);

const MarkdownRendererBase = ({ content }: { content: string }) => {
    const html = useMemo(() => {
        // First normalize text (single source of truth for cleanup)
        const normalized = formatFinalResponse(content);
        // Then convert to HTML
        return toHtml(normalized);
    }, [content]);

    return (
        <div
            className="markdown-body font-mono px-1"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
};

export const MarkdownRenderer = React.memo(MarkdownRendererBase);
