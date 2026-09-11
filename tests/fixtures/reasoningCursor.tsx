import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import '../../src/i18n';
import '../../src/index.css';
import { CollapsibleTextBlock } from '../../src/components/common/CollapsibleTextBlock';

const root = createRoot(document.getElementById('root')!);
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
let screenshotHtml = '';

function cursorMeasurement() {
    const surface = document.querySelector('.thought-content .markdown-body');
    const cursor = surface?.querySelector('.markdown-typing-cursor');
    if (!surface || !cursor) return null;
    const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
    let last: Text | null = null;
    while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        if (node.textContent?.trim() && !node.parentElement?.closest('.markdown-typing-cursor')) last = node;
    }
    if (!last) return null;
    const end = last.data.trimEnd().length;
    const range = document.createRange();
    range.setStart(last, Math.max(0, end - 1));
    range.setEnd(last, end);
    const textRect = range.getBoundingClientRect();
    const cursorRect = cursor.getBoundingClientRect();
    const caretStyle = getComputedStyle(cursor, '::after');
    const caretPainted = parseFloat(caretStyle.width) > 0 && parseFloat(caretStyle.height) > 0;
    const heightWithCursor = surface.getBoundingClientRect().height;
    const parent = cursor.parentNode!;
    const next = cursor.nextSibling;
    cursor.remove();
    const heightWithoutCursor = surface.getBoundingClientRect().height;
    parent.insertBefore(cursor, next);
    const lineHeight = parseFloat(getComputedStyle(last.parentElement!).lineHeight);
    return {
        text: surface.textContent?.slice(-100),
        inList: !!last.parentElement?.closest('li'),
        sameItem: cursor.closest('li') === last.parentElement?.closest('li'),
        verticalGap: Math.round(cursorRect.top - textRect.bottom),
        horizontalGap: Math.round(cursorRect.left - textRect.right),
        addedHeight: heightWithCursor - heightWithoutCursor,
        caretPainted,
        lineHeight,
        html: surface.innerHTML
    };
}

async function checkReveal(name: string, content: string, streaming: boolean, summary = false, width = 720) {
    flushSync(() => root.render(
        <div key={name} style={{ width, padding: 24 }} className="text-justify">
            <CollapsibleTextBlock content={content} isThought={!summary} isThoughtSummary={summary}
                isStreaming={streaming} forceCollapse mode="minimal" hasCustomBg />
        </div>
    ));
    await nextFrame();
    // Opening a completed chat block triggers its real replay typewriter.
    flushSync(() => document.querySelector<HTMLButtonElement>('#root button')!.click());
    const failures: unknown[] = [];
    let samples = 0;
    let listSamples = 0;
    let sawCursor = false;
    let badFrames = 0;
    for (let i = 0; i < 600; i++) {
        await nextFrame();
        const m = cursorMeasurement();
        if (m) {
            sawCursor = true;
            samples++;
            if (m.inList) listSamples++;
            if (name === 'nested list replay' && m.text?.includes('My mo')) screenshotHtml = document.getElementById('root')!.innerHTML;
            if (!m.sameItem || m.verticalGap >= 0 || Math.abs(m.horizontalGap) > 3 || m.addedHeight > 0.1 || !m.caretPainted) {
                badFrames++;
                if (failures.length < 2) failures.push({ name, ...m });
            }
        } else if (sawCursor) break;
    }
    if (!sawCursor) failures.push({ name, error: 'No typewriter cursor sampled' });
    return { name, samples, listSamples, badFrames, failures };
}

async function checkIncrementalStream() {
    const content = '- Parent\n  - Search with `web_search`\n  - Read **results**';
    const failures: unknown[] = [];
    let samples = 0;
    const render = (length: number) => flushSync(() => root.render(
        <div key="incremental" style={{ width: 720, padding: 24 }}>
            <CollapsibleTextBlock content={content.slice(0, length)} isThought
                isStreaming={length < content.length} forceCollapse={false} mode="minimal" />
        </div>
    ));
    render(1);
    for (let i = 0; i < 220; i++) {
        // Include pauses long enough for the typewriter to catch up before
        // more tokens arrive, and the transition to the completed response.
        if (i % 10 === 0) render(Math.min(content.length, 1 + (i / 10) * 5));
        await nextFrame();
        const m = cursorMeasurement();
        if (m) {
            samples++;
            if ((!m.sameItem || m.verticalGap >= 0 || Math.abs(m.horizontalGap) > 3 || m.addedHeight > 0.1 || !m.caretPainted) && failures.length < 2) {
                failures.push({ name: 'incremental tokens', ...m });
            }
        }
    }
    if (!document.querySelector('.thought-content')?.textContent?.replace(/\u00ad/g, '').includes('results')) failures.push({ error: 'Final text missing after stream' });
    if (document.querySelector('.thought-content .markdown-typing-cursor')) failures.push({ error: 'Cursor persists after completion' });
    return { name: 'incremental tokens', samples, failures };
}

(window as any).runCursorRegression = async () => {
    await document.fonts.ready;
    const nested = '- Analysis\n  - Structure\n    1. Context (Who is speaking?).\n    2. Breakdown of the two parts.\n  - *Signature*.\n  - *Context*: Wisdom is personified.\n  - **Part 1 (My mouth)**';
    const cases = [
        await checkReveal('nested list replay', nested, false),
        await checkReveal('nested list live', nested, true),
        await checkReveal('ordered nested replay', '1. Plan\n   1. Check the first item\n   2. Examine **evidence** and `web_search`\n      1. Final detail', false),
        await checkReveal('list paragraph continuation', '- First point\n\n  Additional text inside this item\n  - Nested item with **bold**', false),
        await checkReveal('task list replay', '- [x] First task\n- [ ] Second task with `code`\n- [ ] Last task', false),
        await checkReveal('plain bullets replay', '- First item\n+ Second item\n* Third item', false),
        await checkReveal('plain thought summary replay', '**Preparing the answer** **Checking context**', false, true),
        await checkReveal('narrow wrapped list', '- A longer sentence that wraps across multiple lines\n  - Another detailed item with **bold words**', false, false, 350),
        await checkIncrementalStream()
    ];
    flushSync(() => root.render(null));
    document.getElementById('root')!.innerHTML = screenshotHtml;
    return { cases: cases.map(({ failures, ...summary }) => summary), failures: cases.flatMap(c => c.failures) };
};
