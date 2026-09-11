const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const artifacts = process.argv[3];
if (artifacts) {
    fs.mkdirSync(path.join(artifacts, 'profile'), { recursive: true });
    app.setPath('userData', path.join(artifacts, 'profile'));
}
const report = (data) => artifacts && fs.writeFileSync(path.join(artifacts, 'result.json'), JSON.stringify(data, null, 2));
report({ stage: 'start' });

const timeout = setTimeout(() => {
    console.error('Reasoning cursor regression timed out');
    report({ failures: ['Electron test timed out'] });
    app.exit(1);
}, 60000);

app.whenReady().then(async () => {
    report({ stage: 'ready' });
    const window = new BrowserWindow({
        show: false,
        width: 1100,
        height: 900,
        webPreferences: { partition: 'reasoning-cursor-test', backgroundThrottling: false }
    });
    try {
        window.webContents.on('console-message', (_event, _level, message) => {
            if (artifacts) fs.appendFileSync(path.join(artifacts, 'console.log'), message + '\n');
        });
        await window.loadURL(process.argv[2]);
        report({ stage: 'loaded' });
        const result = await window.webContents.executeJavaScript('window.runCursorRegression()');
        report(result);
        console.log(JSON.stringify(result, null, 2));
        clearTimeout(timeout);
        app.exit(result.failures.length ? 1 : 0);
    } catch (error) {
        console.error(error);
        report({ failures: [String(error)] });
        clearTimeout(timeout);
        app.exit(1);
    }
});
