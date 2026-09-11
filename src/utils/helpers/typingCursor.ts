/** Attach a presentation-only caret to the final text in already sanitized HTML. */
export function appendMarkdownTypingCursor(markup: string): string {
    const template = document.createElement('template');
    template.innerHTML = markup;
    const cursor = document.createElement('span');
    cursor.className = 'markdown-typing-cursor';
    cursor.setAttribute('aria-hidden', 'true');

    // Walk from the end instead of matching closing tags: a parent's </li>
    // comes after its nested list, but the last text belongs to the child li.
    // The same applies to paragraphs and formatted spans inside list items.
    const lastText = (parent: Node): Text | null => {
        for (let child = parent.lastChild; child; child = child.previousSibling) {
            if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) return child as Text;
            if (child.nodeType !== Node.ELEMENT_NODE) continue;
            const element = child as Element;
            if (element.matches('script, style, svg, [aria-hidden="true"]')) continue;
            const text = lastText(child);
            if (text) return text;
        }
        return null;
    };

    const text = lastText(template.content);
    if (text) {
        // Split only trailing whitespace so the caret stays beside the last
        // revealed character, within its actual inline formatting context.
        const trailing = text.splitText(text.data.trimEnd().length);
        trailing.before(cursor);
    } else {
        template.content.append(cursor);
    }
    return template.innerHTML;
}
