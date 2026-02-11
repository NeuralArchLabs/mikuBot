const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    platform: process.platform,
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),

    // Explicit helpers for better DX
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    loadSettings: () => ipcRenderer.invoke('load-settings'),

    getSessions: () => ipcRenderer.invoke('get-sessions'),
    loadSession: (id) => ipcRenderer.invoke('load-session', id),
    saveSession: (session) => ipcRenderer.invoke('save-session', session),
    deleteSession: (id) => ipcRenderer.invoke('delete-session', id)
});
