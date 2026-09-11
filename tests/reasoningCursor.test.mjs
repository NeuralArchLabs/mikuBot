import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import electron from 'electron';

// Run the real chat component and stylesheet in the project's Electron version.
// A separate in-memory browser session never touches the user's chat history.
// For headless Chromium, set CURSOR_TEST_PLAYWRIGHT to a Playwright module URL
// and optionally CURSOR_TEST_BROWSER to the installed browser executable.
const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({
    root,
    configFile: false,
    plugins: [react(), tailwindcss()],
    server: { host: '127.0.0.1', port: 0 },
    logLevel: 'error'
});

try {
    await server.listen();
    const address = server.httpServer.address();
    const url = `http://127.0.0.1:${address.port}/tests/fixtures/reasoningCursor.html`;
    if (process.env.CURSOR_TEST_PLAYWRIGHT) {
        const { chromium } = await import(process.env.CURSOR_TEST_PLAYWRIGHT);
        const browser = await chromium.launch({ headless: true, executablePath: process.env.CURSOR_TEST_BROWSER });
        try {
            const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
            page.on('pageerror', error => console.error(error));
            await page.goto(url);
            const result = await page.evaluate(() => window.runCursorRegression());
            if (process.env.CURSOR_TEST_SCREENSHOT) await page.screenshot({ path: process.env.CURSOR_TEST_SCREENSHOT, animations: 'disabled' });
            console.log(JSON.stringify(result, null, 2));
            process.exitCode = result.failures.length ? 1 : 0;
        } finally { await browser.close(); }
    } else {
        const artifacts = await mkdtemp(path.join(tmpdir(), 'miku-cursor-test-'));
        const env = { ...process.env };
        delete env.ELECTRON_RUN_AS_NODE;
        console.log(`Electron regression: ${url}\nArtifacts: ${artifacts}`);
        const child = spawn(electron, [fileURLToPath(new URL('./fixtures/reasoningCursor.electron.cjs', import.meta.url)), url, artifacts], {
            cwd: root, env, stdio: 'inherit', windowsHide: true
        });
        process.exitCode = await new Promise((resolve, reject) => {
            child.once('error', reject);
            child.once('exit', code => resolve(code ?? 1));
        });
        console.log(await readFile(path.join(artifacts, 'result.json'), 'utf8').catch(() => `Electron exited with code ${process.exitCode} before writing a report`));
        if (!process.exitCode) await rm(artifacts, { recursive: true, force: true });
    }
} finally {
    await server.close();
}
