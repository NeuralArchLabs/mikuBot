const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
};

function getAppIcon() {
    var iconPath = app.isPackaged
        ? path.join(process.resourcesPath, 'app.asar', 'dist', 'mikuBotICON.png')
        : path.join(__dirname, '..', '..', '..', '..', 'public', 'mikuBotICON.png');
    if (!fs.existsSync(iconPath)) return null;
    var icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) return null;
    return icon.resize({ width: 256, height: 256, quality: 'best' });
}

function startWidgetServer(widgetHtmlPath) {
    const widgetDir = path.dirname(widgetHtmlPath);
    const widgetBaseName = path.basename(widgetHtmlPath);

    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            let urlPath = req.url.split('?')[0].split('#')[0];
            if (urlPath === '/') urlPath = '/' + widgetBaseName;

            if (urlPath === '/favicon.ico') {
                res.writeHead(204);
                res.end();
                return;
            }

            urlPath = decodeURIComponent(urlPath);
            const filePath = path.join(widgetDir, urlPath);

            const normalizedDir = path.resolve(widgetDir);
            const normalizedFile = path.resolve(filePath);
            if (!normalizedFile.startsWith(normalizedDir)) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }

            if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }

            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';

            try {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(fs.readFileSync(filePath));
            } catch (e) {
                res.writeHead(500);
                res.end('Internal Server Error');
            }
        });

        server.listen(0, 'localhost', () => {
            resolve(server.address().port);
        });
        server.on('error', reject);
    });
}

function buildControlsHtml() {
    return '<!DOCTYPE html><html><head><link rel="icon" href="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"><style>' +
    '*{margin:0;padding:0;box-sizing:border-box}' +
    'html,body{background:transparent;overflow:hidden;height:100%;user-select:none}' +
    '#c{display:flex;flex-direction:column;gap:3px;padding:4px 5px;border-radius:10px;background:rgba(15,15,15,0.55);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);opacity:0;transition:opacity .25s}' +
    'body:hover #c{opacity:1}' +
    'button{width:22px;height:22px;border:none;background:transparent;color:rgba(255,255,255,0.8);border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:background .15s,color .15s}' +
    'button:hover{background:rgba(255,255,255,0.2);color:#fff}' +
    'button[data-act=close]:hover{background:rgba(255,55,55,0.8);color:#fff}' +
    'button[data-act=move]{cursor:grab}' +
    'button[data-act=move]:active{cursor:grabbing}' +
    '</style></head><body>' +
    '<div id="c">' +
    '<button data-act="move" title="Move"><svg width="16" height="16" viewBox="0 0 16 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"><line x1="8" y1="1" x2="8" y2="5"/><line x1="8" y1="11" x2="8" y2="15"/><line x1="1" y1="8" x2="5" y2="8"/><line x1="11" y1="8" x2="15" y2="8"/><polyline points="5,3 8,1 11,3"/><polyline points="5,13 8,15 11,13"/><polyline points="3,5 1,8 3,11"/><polyline points="13,5 15,8 13,11"/></svg></button>' +
    '<button data-act="minimize" title="Minimize"><svg width="14" height="14" viewBox="0 0 14 14"><line x1="3" y1="7" x2="11" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>' +
    '<button data-act="close" title="Close"><svg width="14" height="14" viewBox="0 0 14 14"><line x1="3" y1="3" x2="11" y2="11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="11" y1="3" x2="3" y2="11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>' +
    '</div>' +
    '<script>' +
    'const {ipcRenderer}=require("electron");' +
    'var isDrag=false,sx=0,sy=0;' +
    'var bm=document.querySelector("[data-act=move]");' +
    'bm.addEventListener("pointerdown",function(e){isDrag=true;sx=e.screenX;sy=e.screenY;bm.setPointerCapture(e.pointerId)});' +
    'bm.addEventListener("pointermove",function(e){if(!isDrag)return;ipcRenderer.send("widget-move",{dx:e.screenX-sx,dy:e.screenY-sy});sx=e.screenX;sy=e.screenY});' +
    'bm.addEventListener("pointerup",function(){isDrag=false});' +
    'bm.addEventListener("lostpointercapture",function(){isDrag=false});' +
    'document.querySelector("[data-act=minimize]").addEventListener("click",function(){ipcRenderer.send("widget-minimize")});' +
    'document.querySelector("[data-act=close]").addEventListener("click",function(){ipcRenderer.send("close-widget")});' +
    '</script></body></html>';
}

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
let ctrlWindowLeft;
let ctrlWindowRight;

function positionControls() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    var pos = mainWindow.getPosition();
    var size = mainWindow.getSize();
    var wx = pos[0], wy = pos[1], ww = size[0];

    if (ctrlWindowRight && !ctrlWindowRight.isDestroyed()) {
        ctrlWindowRight.setPosition(wx + ww + 3, wy + 4);
    }
    if (ctrlWindowLeft && !ctrlWindowLeft.isDestroyed()) {
        ctrlWindowLeft.setPosition(wx - 37, wy + 4);
    }
}

app.whenReady().then(async () => {
    let widgetServerPort;
    try {
        widgetServerPort = await startWidgetServer(htmlFile);
    } catch (e) {
        console.error('Widget HTTP server failed, falling back to file://:', e.message);
    }

    var appIcon = getAppIcon();
    mainWindow = new BrowserWindow({
        width: config.width || 300,
        height: config.height || 300,
        transparent: true,
        frame: false,
        resizable: true,
        show: false,
        alwaysOnTop: config.alwaysOnTop !== false,
        icon: appIcon,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        const headers = { ...details.responseHeaders };
        // Only inject CORS for widget-originated requests, not for embedded iframes
        // (YouTube uses credentials:include which rejects wildcard '*')
        if (details.referrer && details.referrer.startsWith('http://localhost')) {
            delete headers['access-control-allow-origin'];
            delete headers['Access-Control-Allow-Origin'];
            delete headers['access-control-allow-methods'];
            delete headers['Access-Control-Allow-Methods'];
            delete headers['access-control-allow-headers'];
            delete headers['Access-Control-Allow-Headers'];
            headers['Access-Control-Allow-Origin'] = ['*'];
            headers['Access-Control-Allow-Methods'] = ['GET, POST, PUT, DELETE, OPTIONS'];
            headers['Access-Control-Allow-Headers'] = ['*'];
        }
        callback({ responseHeaders: headers });
    });

    if (widgetServerPort) {
        mainWindow.loadURL('http://localhost:' + widgetServerPort);
    } else {
        mainWindow.loadFile(htmlFile);
    }

    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.executeJavaScript(`if(!document.querySelector('link[rel="icon"]')){var l=document.createElement('link');l.rel='icon';l.href='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';document.head.appendChild(l)}`).catch(function(){});

        mainWindow.webContents.executeJavaScript(`
            new Promise(resolve => {
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

                document.documentElement.style.setProperty('background', 'transparent', 'important');
                document.documentElement.style.setProperty('margin', '0', 'important');

                let mainContainer = null;
                let maxArea = 0;
                [...document.body.children].forEach(el => {
                    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
                    const cs = window.getComputedStyle(el);
                    if (cs.display === 'none') return;
                    const rect = el.getBoundingClientRect();
                    const area = rect.width * rect.height;
                    const fallbackArea = (el.offsetWidth || 0) * (el.offsetHeight || 0);
                    const finalArea = Math.max(area, fallbackArea);
                    if (finalArea > maxArea) { maxArea = finalArea; mainContainer = el; }
                });

                function hasRadius(v){if(!v)return false;var m=v.match(/[\\d.]+/g);return m?m.some(function(n){return parseFloat(n)>0}):false}
                var bodyHasRadius=hasRadius(bodyCS.borderRadius);
                var mainHasRadius=mainContainer?hasRadius(window.getComputedStyle(mainContainer).borderRadius):false;

                if(bodyHasRadius){
                    document.documentElement.style.setProperty('background','transparent','important');
                    document.documentElement.style.setProperty('margin','0','important');
                    document.body.style.setProperty('margin','0','important');
                    document.body.style.setProperty('overflow','hidden','important');
                }else if(mainHasRadius){
                    document.documentElement.style.setProperty('background','transparent','important');
                    document.documentElement.style.setProperty('margin','0','important');
                    document.body.style.setProperty('background','transparent','important');
                    document.body.style.setProperty('margin','0','important');
                    document.body.style.setProperty('height','auto','important');
                    document.body.style.setProperty('min-height','0','important');
                    mainContainer.style.setProperty('box-shadow','none','important');
                    var tCS=window.getComputedStyle(mainContainer);
                    var tHasBg=(tCS.backgroundColor&&tCS.backgroundColor!=='rgba(0, 0, 0, 0)'&&tCS.backgroundColor!=='transparent')||(tCS.backgroundImage&&tCS.backgroundImage!=='none');
                    if(!tHasBg){
                        if(finalBg)mainContainer.style.setProperty('background-color',finalBg,'important');
                        if(finalImg)mainContainer.style.setProperty('background-image',finalImg,'important');
                    }
                }else{
                    var wrapper=document.createElement('div');
                    wrapper.id='__miku_widget_frame__';
                    wrapper.style.borderRadius='12px';
                    wrapper.style.overflow='hidden';
                    wrapper.style.width='100%';
                    wrapper.style.minHeight=document.body.offsetHeight+'px';
                    wrapper.style.position='relative';
                    wrapper.style.boxSizing='border-box';
                    wrapper.style.display=bodyCS.display;
                    if(bodyCS.display==='flex'||bodyCS.display==='inline-flex'){
                        wrapper.style.flexDirection=bodyCS.flexDirection;
                        wrapper.style.alignItems=bodyCS.alignItems;
                        wrapper.style.justifyContent=bodyCS.justifyContent;
                        wrapper.style.flexWrap=bodyCS.flexWrap;
                    }
                    if(finalBg)wrapper.style.backgroundColor=finalBg;
                    if(finalImg)wrapper.style.backgroundImage=finalImg;
                    while(document.body.firstChild)wrapper.appendChild(document.body.firstChild);
                    document.body.appendChild(wrapper);
                    document.body.style.setProperty('background','transparent','important');
                    document.body.style.setProperty('margin','0','important');
                    document.body.style.setProperty('padding','0','important');
                }

                setTimeout(function() {
                    var maxR = 0, maxB = 0;
                    document.querySelectorAll('*').forEach(function(el) {
                        var r = el.getBoundingClientRect();
                        if (r.bottom > maxB) maxB = r.bottom;
                        if (r.right > maxR) maxR = r.right;
                    });
                    resolve([maxR, maxB]);
                }, 400);
            })
        `).then(function(result) {
            if (!mainWindow || mainWindow.isDestroyed()) return;
            var contentW = result[0], contentH = result[1];
            var finalW = Math.max(config.width || 300, contentW);
            var finalH = Math.max(config.height || 300, contentH);
            mainWindow.setContentSize(finalW, finalH);
            mainWindow.setResizable(false);
            mainWindow.show();

            // Create floating controls windows on both sides of the widget
            var ctrlHtml = 'data:text/html;charset=utf-8,' + encodeURIComponent(buildControlsHtml());
            var ctrlOpts = {
                width: 34,
                height: Math.max(finalH, 92),
                transparent: true,
                frame: false,
                resizable: false,
                alwaysOnTop: config.alwaysOnTop !== false,
                hasShadow: false,
                skipTaskbar: true,
                focusable: false,
                show: false,
                parent: mainWindow,
                icon: appIcon,
                webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: false
                }
            };

            ctrlWindowRight = new BrowserWindow(ctrlOpts);
            ctrlWindowRight.loadURL(ctrlHtml);
            ctrlWindowRight.show();

            ctrlWindowLeft = new BrowserWindow(Object.assign({}, ctrlOpts));
            ctrlWindowLeft.loadURL(ctrlHtml);
            ctrlWindowLeft.show();

            positionControls();

            // Re-measure after async content loads (e.g., weather APIs)
            setTimeout(function() {
                if (!mainWindow || mainWindow.isDestroyed()) return;
                mainWindow.webContents.executeJavaScript('new Promise(function(r){setTimeout(function(){var x=0,y=0;document.querySelectorAll("*").forEach(function(e){var b=e.getBoundingClientRect();if(b.bottom>y)y=b.bottom;if(b.right>x)x=b.right});r([x,y])},50)})').then(function(res) {
                    if (!mainWindow || mainWindow.isDestroyed()) return;
                    var w = Math.max(config.width || 300, res[0]);
                    var h = Math.max(config.height || 300, res[1]);
                    mainWindow.setContentSize(w, h);
                    if (ctrlWindowRight && !ctrlWindowRight.isDestroyed()) ctrlWindowRight.setSize(34, Math.max(h, 92));
                    if (ctrlWindowLeft && !ctrlWindowLeft.isDestroyed()) ctrlWindowLeft.setSize(34, Math.max(h, 92));
                    positionControls();
                }).catch(function(){});
            }, 2500);
        }).catch(function() {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.setResizable(false);
                mainWindow.show();
            }
        });
    });

    // Keep controls synced with widget position
    mainWindow.on('move', function() { positionControls(); });

    // IPC: move widget and controls together in one step
    ipcMain.on('widget-move', function(event, delta) {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        var pos = mainWindow.getPosition();
        var nx = pos[0] + delta.dx, ny = pos[1] + delta.dy;
        mainWindow.setPosition(nx, ny);
        var sz = mainWindow.getSize();
        if (ctrlWindowRight && !ctrlWindowRight.isDestroyed()) ctrlWindowRight.setPosition(nx + sz[0] + 3, ny + 4);
        if (ctrlWindowLeft && !ctrlWindowLeft.isDestroyed()) ctrlWindowLeft.setPosition(nx - 37, ny + 4);
    });

    // IPC: minimize widget (controls auto-hide as child of parent)
    ipcMain.on('widget-minimize', function() {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
    });

    // IPC: close everything
    ipcMain.on('close-widget', function() { app.quit(); });

    mainWindow.on('closed', function() { mainWindow = null; });
});

app.on('window-all-closed', function() { app.quit(); });
