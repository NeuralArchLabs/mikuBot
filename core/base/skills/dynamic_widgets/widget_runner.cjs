const { app, BrowserWindow, ipcMain, Menu, MenuItem } = require('electron');
const path = require('path');
const fs = require('fs');

const htmlFile = process.argv[2];
if (!htmlFile) {
    console.error("Widget HTML file required.");
    app.quit();
}

let widgetId = path.basename(htmlFile, '.html');
let configPath = path.join(path.dirname(htmlFile), widgetId + '.json');
let config = { width: 300, height: 300, alwaysOnTop: true };

try {
    if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
} catch (e) {}

let mainWindow;

app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
        width: config.width || 300,
        height: config.height || 300,
        transparent: true,
        frame: false,
        resizable: true,
        show: false,
        alwaysOnTop: config.alwaysOnTop !== false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile(htmlFile);

    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.executeJavaScript(`
            new Promise(resolve => {
                // Capture original backgrounds BEFORE altering anything
                const htmlCS = window.getComputedStyle(document.documentElement);
                const bodyCS = window.getComputedStyle(document.body);
                
                const origHtmlBg = htmlCS.backgroundColor;
                const origHtmlImg = htmlCS.backgroundImage;
                const origBodyBg = bodyCS.backgroundColor;
                const origBodyImg = bodyCS.backgroundImage;

                const finalBg = (origBodyBg && origBodyBg !== 'rgba(0, 0, 0, 0)') ? origBodyBg : 
                                ((origHtmlBg && origHtmlBg !== 'rgba(0, 0, 0, 0)') ? origHtmlBg : null);
                const finalImg = (origBodyImg && origBodyImg !== 'none') ? origBodyImg : 
                                 ((origHtmlImg && origHtmlImg !== 'none') ? origHtmlImg : null);

                // Make html transparent so desktop shows through rounded corners
                document.documentElement.style.setProperty('background', 'transparent', 'important');
                document.documentElement.style.setProperty('margin', '0', 'important');

                // Find the main visible element (the one taking up the most space) to determine if widget has its own wrapper
                let mainContainer = null;
                let maxArea = 0;
                [...document.body.children].forEach(el => {
                    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
                    const cs = window.getComputedStyle(el);
                    if (cs.display === 'none') return;
                    const rect = el.getBoundingClientRect();
                    const area = rect.width * rect.height;
                    // Provide a slight fallback for elements that might not be rendered yet if body is 0
                    const fallbackArea = (el.offsetWidth || 0) * (el.offsetHeight || 0);
                    const finalArea = Math.max(area, fallbackArea);
                    if (finalArea > maxArea) { maxArea = finalArea; mainContainer = el; }
                });

                // Check if the main container already defines its own border-radius
                const childRadius = mainContainer ? window.getComputedStyle(mainContainer).borderRadius : '0px';
                const hasOwnRadius = childRadius && childRadius !== '0px' && !childRadius.startsWith('0px 0px');

                // Aggressive no-drag for interactive elements and their children to prevent clicks from becoming window drags
                const noDragTags = 'button, input, textarea, select, a, label, [role="button"], [onclick], fieldset, legend, details, summary, .btn, .button, .clickable, [class*="btn"], [class*="item"], [class*="card"], [class*="link"]';
                const s = document.createElement('style');
                s.textContent = noDragTags + ', ' + noDragTags.split(',').map(t => t.trim() + ' *').join(',') + '{ -webkit-app-region: no-drag !important; }';
                document.head.appendChild(s);

                if (hasOwnRadius) {
                    if (mainContainer) {
                        const childCS = window.getComputedStyle(mainContainer);
                        const childBg = childCS.backgroundColor;
                        if (!childBg || childBg === 'rgba(0, 0, 0, 0)' || childBg === 'transparent') {
                            if (finalBg) mainContainer.style.setProperty('background-color', finalBg, 'important');
                        }
                        if (!childCS.backgroundImage || childCS.backgroundImage === 'none') {
                            if (finalImg) mainContainer.style.setProperty('background-image', finalImg, 'important');
                        }
                    }

                    // Widget has its own radius — just make body transparent so corners expose the desktop
                    document.body.style.setProperty('background', 'transparent', 'important');
                    document.body.style.setProperty('margin', '0', 'important');
                    document.body.style.setProperty('-webkit-app-region', 'drag', 'important');
                } else {
                    // Widget has no radius — inject wrapper with forced border-radius
                    const wrapper = document.createElement('div');
                    wrapper.id = '__miku_widget_frame__';
                    wrapper.style.borderRadius = '12px';
                    wrapper.style.overflow = 'hidden';
                    wrapper.style.transform = 'translateZ(0)';
                    wrapper.style.width = '100%';
                    wrapper.style.minHeight = document.body.offsetHeight + 'px';
                    wrapper.style.position = 'relative';
                    wrapper.style.boxSizing = 'border-box';

                    // Copy body layout properties to preserve widget positioning
                    wrapper.style.display = bodyCS.display;
                    if (bodyCS.display === 'flex' || bodyCS.display === 'inline-flex') {
                        wrapper.style.flexDirection = bodyCS.flexDirection;
                        wrapper.style.alignItems = bodyCS.alignItems;
                        wrapper.style.justifyContent = bodyCS.justifyContent;
                        wrapper.style.flexWrap = bodyCS.flexWrap;
                    }

                    // Transfer captured background to wrapper
                    if (finalBg) wrapper.style.backgroundColor = finalBg;
                    if (finalImg) wrapper.style.backgroundImage = finalImg;

                    while (document.body.firstChild) wrapper.appendChild(document.body.firstChild);
                    document.body.appendChild(wrapper);

                    document.body.style.setProperty('background', 'transparent', 'important');
                    document.body.style.setProperty('margin', '0', 'important');
                    document.body.style.setProperty('padding', '0', 'important');
                    document.body.style.setProperty('-webkit-app-region', 'drag', 'important');
                }

                // Measure all elements including absolute/fixed positioned
                setTimeout(() => {
                    let maxRight = 0, maxBottom = 0;
                    document.querySelectorAll('*').forEach(el => {
                        const r = el.getBoundingClientRect();
                        if (r.bottom > maxBottom) maxBottom = r.bottom;
                        if (r.right > maxRight) maxRight = r.right;
                    });
                    resolve([maxRight, maxBottom + 20]);
                }, 400);
            })
        `).then(([contentW, contentH]) => {
            if (!mainWindow || mainWindow.isDestroyed()) return;
            const finalW = Math.max(config.width || 300, contentW);
            const finalH = Math.max(config.height || 300, contentH);
            mainWindow.setContentSize(finalW, finalH);
            mainWindow.setResizable(false);
            mainWindow.show();
        }).catch(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.setResizable(false);
                mainWindow.show();
            }
        });
    });

    mainWindow.webContents.on('context-menu', () => {
        const menu = new Menu();
        menu.append(new MenuItem({ label: widgetId, enabled: false }));
        menu.append(new MenuItem({ type: 'separator' }));
        menu.append(new MenuItem({ label: 'Close Widget', click: () => app.quit() }));
        menu.popup();
    });

    ipcMain.on('close-widget', () => app.quit());
    mainWindow.on('closed', () => { mainWindow = null; });
});

app.on('window-all-closed', () => app.quit());
