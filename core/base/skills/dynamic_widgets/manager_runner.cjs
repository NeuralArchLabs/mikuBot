const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const widgetsDir = process.argv[2];
if (!widgetsDir) {
    console.error("Widgets directory required.");
    app.quit();
}

let mainWindow;

app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        frame: false,
        backgroundColor: '#0a0a0a',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    const uiPath = path.join(__dirname, 'manager_ui.html');
    mainWindow.loadFile(uiPath);

    // Provide widgetsDir to the UI along with filesystem actions
    ipcMain.handle('get-widgets-dir', () => widgetsDir);
    ipcMain.handle('get-widgets', () => {
        if (!fs.existsSync(widgetsDir)) return [];
        const widgets = [];
        const files = fs.readdirSync(widgetsDir).filter(f => f.endsWith('.html'));
        for (const file of files) {
            const id = file.replace('.html', '');
            const configPath = path.join(widgetsDir, id + '.json');
            let desc = "HTML Component";
            if (fs.existsSync(configPath)) {
                try {
                    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    if (config.description) desc = config.description;
                } catch(e) {}
            }
            widgets.push({ id, filename: file, description: desc });
        }
        return widgets;
    });
    
    // Commands to launch and delete
    ipcMain.on('launch-widget', (event, filename) => {
        const filepath = path.join(widgetsDir, filename);
        const { spawn } = require('child_process');
        
        // Spawn using the same hook flag that main.py uses, so packaged MikuCentral.exe can intercept it.
        const p = spawn(process.execPath, ['--dynamic-widget', filepath], {
            detached: true,
            stdio: 'ignore'
        });
        p.unref(); // allow manager to close without killing widgets
    });

    ipcMain.on('delete-widget', (event, filename) => {
        const filepath = path.join(widgetsDir, filename);
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        const configPath = path.join(widgetsDir, filename.replace('.html', '.json'));
        if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
        event.reply('widget-deleted');
    });

    ipcMain.on('close-manager', () => {
        app.quit();
    });
});

app.on('window-all-closed', () => {
    app.quit();
});
