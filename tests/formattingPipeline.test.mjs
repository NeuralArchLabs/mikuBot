import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { formatFinalResponse } from '../src/services/formatters/answerFormatter.ts';
import { hasUnsafeSvgStyle, isTrustedLocalMediaUrl, normalizeMarkdownUrlAttribute, stripIframeAutoplayParameters } from '../src/utils/security/richContentPolicy.ts';

test('final response normalization is lossless for model-authored semantics', () => {
    const input = [
        '<section class="custom"><button data-action="demo">Open</button></section>',
        'repeat me',
        'repeat me',
        '{"name":"web_search","arguments":{"query":"AI"}}',
        '<tool_call>call:web_search{"query":"AI"}</tool_call>',
        String.raw`escaped \n sequence and \${template}`
    ].join('\r\n');

    assert.equal(formatFinalResponse(`  ${input}  `), input.replaceAll('\r\n', '\n'));
});

test('normalization removes only structural edge and trailing whitespace', () => {
    assert.equal(formatFinalResponse('  alpha  \r\n beta\t\r\n\r\n'), 'alpha\n beta');
});

test('obsolete model-name formatters and embedded event handlers stay removed', async () => {
    const [providers, formatting, formatterIndex, serializer, chat, agent, chatArea] = await Promise.all([
        readFile(new URL('../src/services/core/ModelProviders.ts', import.meta.url), 'utf8'),
        readFile(new URL('../src/utils/helpers/formatting.ts', import.meta.url), 'utf8'),
        readFile(new URL('../src/services/formatters/index.ts', import.meta.url), 'utf8'),
        readFile(new URL('../src/services/core/conversationSerializer.ts', import.meta.url), 'utf8'),
        readFile(new URL('../src/services/core/agent/chat.ts', import.meta.url), 'utf8'),
        readFile(new URL('../src/services/core/agent.ts', import.meta.url), 'utf8'),
        readFile(new URL('../src/components/features/ChatArea.tsx', import.meta.url), 'utf8')
    ]);

    assert.doesNotMatch(providers, /NATIVE_REASONING_PROTOCOL|antiHallucination|isGemma\b/);
    assert.doesNotMatch(formatting, /onclick=|data-code=/);
    assert.doesNotMatch(formatterIndex, /GemmaFormatter|StandardFormatter|formatterFactory|IFormatter/);
    assert.match(serializer, /\.reasoning\s*=/);
    assert.doesNotMatch(serializer, /<thinking>/);
    assert.doesNotMatch(chat, /TOOL_NAME_ALIASES|noisePatterns|replace\(\/\\\{"/);
    assert.doesNotMatch(agent, /contentForHistory|`<thinking>/);
    assert.doesNotMatch(agent, /Imagen generada correctamente/);
    assert.match(chatArea, /trustedLocalMediaUrls/);
});

test('external media iframes keep the identity required by their providers', async () => {
    const policy = await readFile(new URL('../src/utils/security/richContentPolicy.ts', import.meta.url), 'utf8');

    assert.match(policy, /const isInlineDocument = iframe\.hasAttribute\('srcdoc'\)/);
    assert.match(policy, /iframe\.removeAttribute\('sandbox'\)/);
    assert.match(policy, /allow-scripts allow-forms allow-popups allow-presentation/);
    assert.match(policy, /strict-origin-when-cross-origin/);
    assert.match(policy, /encrypted-media/);
    assert.match(policy, /isInlineDocument \? 'no-referrer' : 'strict-origin-when-cross-origin'/);
});

test('Mermaid SVG labels are preserved while active SVG content remains blocked', async () => {
    const [policy, mermaid] = await Promise.all([
        readFile(new URL('../src/utils/security/richContentPolicy.ts', import.meta.url), 'utf8'),
        readFile(new URL('../src/utils/helpers/mermaid.ts', import.meta.url), 'utf8')
    ]);

    assert.match(mermaid, /foreignObject span, foreignObject div, foreignObject p/);
    assert.match(policy, /Mermaid uses foreignObject for labels and node content/);
    assert.match(policy, /querySelectorAll\('script, iframe, object, embed'\)/);
    assert.doesNotMatch(policy, /script, foreignObject, iframe, object, embed/);
});

test('Mermaid internal SVG references retain their stylesheet without allowing external URLs', () => {
    assert.equal(hasUnsafeSvgStyle('.edge { marker-end: url(#arrowhead); }'), false);
    assert.equal(hasUnsafeSvgStyle('.node { fill: url("#gradient"); }'), false);
    assert.equal(hasUnsafeSvgStyle('.node { fill: url(https://example.test/fill.svg); }'), true);
    assert.equal(hasUnsafeSvgStyle('.node { fill: url(javascript:alert(1)); }'), true);
    assert.equal(hasUnsafeSvgStyle('@import url(https://example.test/style.css);'), true);
});

test('embedded media never receives autoplay query parameters', () => {
    assert.equal(
        stripIframeAutoplayParameters('https://www.youtube.com/embed/demo?autoplay=1&rel=0'),
        'https://www.youtube.com/embed/demo?rel=0'
    );
    assert.equal(
        stripIframeAutoplayParameters('https://player.vimeo.com/video/123?background=1&AUTOSTART=true'),
        'https://player.vimeo.com/video/123'
    );
    assert.equal(stripIframeAutoplayParameters('not a URL'), 'not a URL');
});

test('Markdown link syntax inside an HTML URL attribute is canonicalized', () => {
    assert.equal(
        normalizeMarkdownUrlAttribute('[YouTube](https://www.youtube.com/embed/IZg4rz3cIDc)'),
        'https://www.youtube.com/embed/IZg4rz3cIDc'
    );
    assert.equal(
        normalizeMarkdownUrlAttribute('<https://player.vimeo.com/video/123>'),
        'https://player.vimeo.com/video/123'
    );
    assert.equal(normalizeMarkdownUrlAttribute('https://www.youtube.com/embed/IZg4rz3cIDc'), 'https://www.youtube.com/embed/IZg4rz3cIDc');
});

test('model HTML can use only the exact local media URL returned by its tool', () => {
    const generated = 'local:///C:/workspace/generated_images/portrait.png';
    assert.equal(isTrustedLocalMediaUrl(generated, [generated]), true);
    assert.equal(isTrustedLocalMediaUrl('local:///C:/workspace/generated_images/other.png', [generated]), false);
    assert.equal(isTrustedLocalMediaUrl('file:///C:/workspace/generated_images/portrait.png', [generated]), false);
});
