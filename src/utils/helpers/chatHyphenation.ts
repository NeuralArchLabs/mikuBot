import { hyphenateSync as hyphenateSpanish } from 'hyphen/es';
import { hyphenateSync as hyphenateEnglish } from 'hyphen/en-us';

const hyphenators = { es: hyphenateSpanish, en: hyphenateEnglish };
const excludedContent = 'pre, code, kbd, samp, a, abbr, button, textarea, script, style, svg, math, iframe, .mermaid, [contenteditable]';

/** Add optional line breaks only to rendered prose, never to message/history data. */
export function hyphenateChatHtml(html: string, language = 'en'): string {
    if (!html || typeof document === 'undefined') return html;

    // The caller supplies sanitized HTML. A detached template keeps attributes,
    // entities and protected code separate from the text we want to typeset.
    const template = document.createElement('template');
    template.innerHTML = html;
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
    let node: Node | null;

    while ((node = walker.nextNode())) {
        const parent = node.parentElement;
        if (parent?.closest(excludedContent)) continue;

        const locale = (parent?.closest('[lang]')?.getAttribute('lang') || language)
            .toLowerCase().split('-')[0];
        const hyphenate = hyphenators[locale as keyof typeof hyphenators];
        if (!hyphenate) continue;

        node.nodeValue = (node.nodeValue || '').replace(/\S+/gu, token => {
            // Preserve bare URLs, paths, emails and identifiers as well as words
            // that already contain discretionary hyphens.
            if (/[\/\\@_\d\u00ad]|[.:][\p{L}\p{N}]/u.test(token)) return token;
            return token.replace(/[\p{L}\p{M}]{7,}/gu, word =>
                hyphenate(word, { minWordLength: 7 })
            );
        });
    }

    return template.innerHTML;
}

/** Native selection copying must not export the presentation-only soft hyphens. */
export function copyWithoutSoftHyphens(event: {
    clipboardData: DataTransfer;
    preventDefault(): void;
}): void {
    const selection = window.getSelection();
    if (!selection || !selection.toString().includes('\u00ad')) return;

    const fragment = document.createElement('div');
    for (let index = 0; index < selection.rangeCount; index++) {
        fragment.append(selection.getRangeAt(index).cloneContents());
    }
    event.clipboardData.setData('text/plain', selection.toString().replace(/\u00ad/g, ''));
    event.clipboardData.setData('text/html', fragment.innerHTML.replace(/\u00ad|&shy;|&#173;|&#x0*ad;/gi, ''));
    event.preventDefault();
}
