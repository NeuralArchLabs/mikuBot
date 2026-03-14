import React, { useMemo } from 'react';
import { toHtml } from '../../utils';

export const Icon = ({ name, className = "" }: { name: string; className?: string }) => (
    <i className={`fas fa-${name} ${className}`} aria-hidden="true" />
);

const MarkdownRendererBase = ({ content }: { content: string }) => {
    const html = useMemo(() => toHtml(content), [content]);

    return (
        <div
            className="markdown-body whitespace-pre-wrap leading-relaxed text-sm"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
};

export const MarkdownRenderer = React.memo(MarkdownRendererBase);
