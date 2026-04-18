const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src', 'index.css');
let css = fs.readFileSync(cssPath, 'utf8');

const anchor = '.animate-sig-pop {';
const index = css.indexOf(anchor);

if (index === -1) {
  console.log('Anchor not found');
  process.exit(1);
}

const correctCss = `.animate-sig-pop {
    opacity: 0;
    transform: scale(0.5);
    padding: 0 10px;
}
.signature-wrapper.is-visible .animate-sig-pop {
    animation: sig-pop 1.8s cubic-bezier(0.19, 1, 0.22, 1) forwards;
}

/* ======================================================== */
/* ⚡ STREAMING PLACEHOLDER OVERRIDES                      */
/* Intercepts the animation block during active LLM streams */
/* ======================================================== */

@property --sig-scan-pos {
    syntax: '<percentage>';
    inherits: true;
    initial-value: -150%;
}

@keyframes global-sig-scan {
    0% { --sig-scan-pos: -150%; }
    100% { --sig-scan-pos: 150%; }
}

.markdown-body.is-streaming {
    animation: global-sig-scan 1.2s infinite alternate ease-in-out;
}

.markdown-body.is-streaming .signature-wrapper .animate-sig-pop {
    opacity: 1 !important;
    transform: scale(1) !important;
    padding: 0 12px !important;
    animation: none !important;
}

.markdown-body.is-streaming .signature-wrapper .animate-sig-bg-walk::before {
    left: 0 !important;
    width: 150% !important;
    transform: translateX(var(--sig-scan-pos)) !important;
    background: linear-gradient(90deg, 
        transparent, 
        rgba(168, 85, 247, 0.8) 30%, 
        rgba(6, 182, 212, 1) 50%, 
        rgba(168, 85, 247, 0.8) 70%, 
        transparent
    ) !important;
    animation: none !important;
}

.markdown-body.is-streaming .signature-wrapper .animate-sig-bracket-spread {
    max-width: 0 !important;
    opacity: 0 !important;
}
.signature-wrapper.is-visible .animate-sig-bracket-spread {
    animation: sig-bracket-spread 1.8s cubic-bezier(0.19, 1, 0.22, 1) forwards;
}

.animate-sig-text-glow {
    opacity: 0;
    filter: blur(4px);
}
.signature-wrapper.is-visible .animate-sig-text-glow {
    animation: sig-text-glow 1.8s cubic-bezier(0.19, 1, 0.22, 1) forwards;
}

/* Studio Elite Spoiler Styles */
.studio-spoiler {
  background-color: rgba(2, 6, 23, 0.95);
  border-radius: 0.375rem;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
  padding-top: 0.125rem;
  padding-bottom: 0.125rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  cursor: pointer;
  user-select: none;
  color: transparent !important;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.studio-spoiler:hover {
  color: #f1f5f9 !important;
  background-color: rgba(0, 0, 0, 0.4);
  -webkit-backdrop-filter: blur(0);
  backdrop-filter: blur(0);
  user-select: text;
  box-shadow: 0 0 15px rgba(34, 211, 238, 0.1);
  border-color: rgba(34, 211, 238, 0.2);
}

.studio-spoiler::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.05), transparent);
  transform: translateX(-100%);
  transition: transform 0.6s ease;
}

.studio-spoiler:hover::after {
  transform: translateX(100%);
}

/* Iframe Styling */
.markdown-body iframe:not(.markdown-body div iframe):not([style]) {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  border-radius: 8px;
}

/* ── Streaming Paragraph Fade-In ──────────────────────────── */
@keyframes stream-paragraph-enter {
  0% { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}
.stream-paragraph-enter {
  animation: stream-paragraph-enter 0.35s ease-out forwards;
}

/* ── Freeze Renderer Animations During Streaming ─────────── */
.markdown-body.is-streaming blockquote,
.markdown-body.is-streaming .code-block-anim,
.markdown-body.is-streaming .divider-container,
.markdown-body.is-streaming .mermaid {
  animation: none !important;
  opacity: 0;
}

/* ══════════════════════════════════════════════════════════════════
   THEME-AWARE FORMATTING OVERRIDES
   These override the hardcoded Tailwind classes emitted by the
   formatting engine so ALL colors adapt to the active theme.
   ══════════════════════════════════════════════════════════════════ */

/* ── Inline code pills ── */
.markdown-body code {
  color: var(--md-code-color) !important;
  background: var(--md-code-bg) !important;
  border-color: var(--md-code-border) !important;
}
.markdown-body [class*="bg-indigo-5"],
.markdown-body [class*="bg-indigo-4"],
.markdown-body [class*="bg-indigo-3"] {
  background: var(--md-code-bg) !important;
}
.markdown-body [class*="text-indigo-3"],
.markdown-body [class*="text-indigo-4"] {
  color: var(--md-code-color) !important;
}
.markdown-body [class*="border-indigo-4"] {
  border-color: var(--md-code-border) !important;
}

/* ── Bold / Strong ── */
.markdown-body strong,
.markdown-body strong[class*="text-indigo-"] {
  color: var(--md-strong-color) !important;
}

/* ── Italic / Em ── */
.markdown-body em,
.markdown-body em[class*="text-slate-"] {
  color: var(--text-secondary) !important;
  opacity: 0.9;
}

/* ── Headings emitted inline by engine ── */
.markdown-body h1[class*="text-transparent"] {
  background-image: linear-gradient(to right, var(--md-h1-color), var(--md-h2-color)) !important;
  color: transparent !important;
  -webkit-background-clip: text !important;
  background-clip: text !important;
}
.markdown-body h1[class*="from-cyan"] {
  background-image: linear-gradient(to right, var(--md-h1-color), var(--md-h2-color)) !important;
}
.markdown-body h2[class*="text-cyan"],
.markdown-body h2[class*="text-sky"],
.markdown-body h2[class*="text-blue"] {
  color: var(--md-h2-color) !important;
}
.markdown-body h3,
.markdown-body h3[class*="text-[#"] {
  color: var(--md-h3-color) !important;
}
.markdown-body h4[class*="text-[#"] {
  color: var(--md-h3-color) !important;
  opacity: 0.85;
}
.markdown-body h5,
.markdown-body h5[class*="text-indigo-"] {
  color: var(--md-code-color) !important;
  opacity: 0.75;
}
.markdown-body h6 {
  color: var(--text-secondary) !important;
  opacity: 0.7;
}

/* ── Blockquotes ── */
.markdown-body blockquote[data-type="blockquote"] {
  border-color: var(--md-blockquote-border) !important;
}
.markdown-body blockquote[data-type="blockquote"][class*="border-cyan"] {
  border-color: var(--md-blockquote-border) !important;
}

/* ── List items ── */
.markdown-body li,
.markdown-body li[class*="text-slate-2"] {
  color: var(--text-primary) !important;
}
.markdown-body li[class*="text-slate-3"],
.markdown-body li[class*="text-slate-4"],
.markdown-body li[class*="text-slate-5"] {
  color: var(--text-secondary) !important;
}
.markdown-body li::marker {
  color: var(--md-marker-color) !important;
}
.markdown-body ul ul li::marker,
.markdown-body ol ol li::marker {
  color: var(--md-marker-l2-color) !important;
}
.markdown-body ul ul ul li::marker,
.markdown-body ol ol ol li::marker {
  color: var(--md-marker-l3-color) !important;
}

/* ── Divider lines ── */
.markdown-body .divider-line {
  background: linear-gradient(to right, transparent, var(--md-marker-color), transparent) !important;
  opacity: 0.4;
}

/* ── Links / Footnotes / Abbr ── */
.markdown-body a,
.markdown-body sup[class*="text-cyan-"],
.markdown-body abbr {
  color: var(--primary-color) !important;
}
.markdown-body abbr {
  border-color: var(--primary-color) !important;
  opacity: 0.9;
}

/* ── Del / Strikethrough ── */
.markdown-body del {
  color: var(--text-secondary) !important;
  opacity: 0.55;
}

/* ══════════════════════════════════════════════════════════════════
   CLOUD THEME — light background
   All generated text must be dark to stay readable on white
   ══════════════════════════════════════════════════════════════════ */
[data-theme="cloud"] .markdown-body {
  color: var(--text-primary);
}
[data-theme="cloud"] .markdown-body p,
[data-theme="cloud"] .markdown-body li,
[data-theme="cloud"] .markdown-body td,
[data-theme="cloud"] .markdown-body th,
[data-theme="cloud"] .markdown-body blockquote {
  color: var(--text-primary) !important;
}
[data-theme="cloud"] .markdown-body em {
  color: var(--text-secondary) !important;
  opacity: 1;
}
[data-theme="cloud"] .markdown-body del {
  color: var(--text-secondary) !important;
  opacity: 0.7;
}
[data-theme="cloud"] .markdown-body code {
  background: rgba(29, 78, 216, 0.08) !important;
  color: #5b21b6 !important;
  border-color: rgba(124, 58, 237, 0.25) !important;
}
[data-theme="cloud"] .markdown-body table td,
[data-theme="cloud"] .markdown-body table th {
  color: #0f172a !important;
}
[data-theme="cloud"] .markdown-body blockquote[data-type="blockquote"] {
  background: rgba(29, 78, 216, 0.04) !important;
  color: var(--text-primary) !important;
}

/* ══════════════════════════════════════════════════════════════════
   SCROLLBAR THEMING
   ══════════════════════════════════════════════════════════════════ */
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb) !important;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover) !important;
}
`;

const newCss = css.substring(0, index) + correctCss;
fs.writeFileSync(cssPath, newCss);
console.log('Fixed index.css');
