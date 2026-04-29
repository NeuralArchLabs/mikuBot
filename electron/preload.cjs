const { contextBridge, ipcRenderer } = require('electron');

// ── Security: IPC Channel Whitelist ──────────────────────────────────
// NEVER expose a generic invoke(channel, data) — it allows any renderer
// code (including browser extensions) to call arbitrary IPC handlers.
// Each channel below is explicitly whitelisted.

contextBridge.exposeInMainWorld('electron', {
    platform: process.platform,

    // Settings
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    loadSettings: () => ipcRenderer.invoke('load-settings'),
    setAutoLaunch: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),

    // Sessions
    getSessions: () => ipcRenderer.invoke('get-sessions'),
    loadSession: (id) => ipcRenderer.invoke('load-session', id),
    saveSession: (session) => ipcRenderer.invoke('save-session', session),
    deleteSession: (id) => ipcRenderer.invoke('delete-session', id),

    // Neural Scheduler
    saveSchedulerTasks: (data) => ipcRenderer.invoke('save-scheduler-tasks', data),
    loadSchedulerTasks: () => ipcRenderer.invoke('load-scheduler-tasks'),
    saveSchedulerLogs: (data) => ipcRenderer.invoke('save-scheduler-logs', data),
    loadSchedulerLogs: () => ipcRenderer.invoke('load-scheduler-logs'),

    // Native FS
    selectFolder: () => ipcRenderer.invoke('fs-select-folder'),
    openFolder: (path) => ipcRenderer.invoke('fs-open-folder', path),
    readFolder: (path) => ipcRenderer.invoke('fs-read-folder', path),
    writeFile: (data) => ipcRenderer.invoke('fs-write-file', data),
    deleteFile: (data) => ipcRenderer.invoke('fs-delete-file', data),
    getDefaultPath: () => ipcRenderer.invoke('get-default-path'),
    setupOnboarding: (data) => ipcRenderer.invoke('setup-onboarding', data),
    getInternalTemplates: () => ipcRenderer.invoke('get-internal-templates'),
    fsCheckExisting: (targetPath) => ipcRenderer.invoke('fs-check-existing', targetPath),
    exportBackup: () => ipcRenderer.invoke('export-backup'),
    importBackup: () => ipcRenderer.invoke('import-backup'),

    // Console & Python engine
    runConsole: (data) => ipcRenderer.invoke('run-console', data),
    runSearch: (data) => ipcRenderer.invoke('run-search', data),
    runExtract: (data) => ipcRenderer.invoke('run-extract', data),
    extractFileContent: (data) => ipcRenderer.invoke('extract-file-content', data),
    selectFiles: () => ipcRenderer.invoke('select-files'),
    readFileData: (path) => ipcRenderer.invoke('read-file-data', path),

    // Network proxy (keys stay in main process)
    fetchProxy: (data) => ipcRenderer.invoke('fetch-proxy', data),

    // API proxied calls (keys injected by main process, never sent from renderer)
    apiStream: (data) => ipcRenderer.invoke('api-stream', data),
    abortApiStream: (streamId) => ipcRenderer.send('api-stream-abort', streamId),

    // Skills
    listSkills: (data) => ipcRenderer.invoke('list-skills', data),
    listBlueprints: (data) => ipcRenderer.invoke('list-blueprints', data),
    executeSkill: (data) => ipcRenderer.invoke('execute-skill', data),
    deleteSkill: (data) => ipcRenderer.invoke('delete-skill', data),

    // Advanced Agent Tools
    agentReadFile: (data) => ipcRenderer.invoke('agent:read-file', data),
    getFileOutline: (data) => ipcRenderer.invoke('agent:get-file-outline', data),
    batchOperation: (data) => ipcRenderer.invoke('agent:batch-operation', data),
    listFilesNative: (data) => ipcRenderer.invoke('agent:list-files', data),
    searchFilesNative: (data) => ipcRenderer.invoke('agent:search-files', data),
    patchFile: (data) => ipcRenderer.invoke('agent:patch-file', data),
    undoPatch: (data) => ipcRenderer.invoke('agent:undo-patch', data),
    getSystemMetrics: () => ipcRenderer.invoke('agent:system-metrics'),

    // Voice & Vosk Models
    getVoiceStatus: () => ipcRenderer.invoke('voice:status'),
    listVoiceModels: () => ipcRenderer.invoke('voice:list-models'),
    downloadVoiceModel: (data) => ipcRenderer.invoke('voice:download-model', data),
    deleteVoiceModel: (data) => ipcRenderer.invoke('voice:delete-model', data),
    onVoiceDownloadProgress: (callback) => {
        const listener = (event, data) => callback(data);
        ipcRenderer.on('voice:download-progress', listener);
        return () => ipcRenderer.removeListener('voice:download-progress', listener);
    },

    // Recognition
    startVoiceRecognition: (data) => ipcRenderer.invoke('voice:start-recognition', data),
    stopVoiceRecognition: () => ipcRenderer.invoke('voice:stop-recognition'),
    sendAudioChunk: (buffer) => ipcRenderer.send('voice:audio-chunk', buffer),
    onVoiceEngineReady: (callback) => {
        const listener = (event) => callback();
        ipcRenderer.on('voice:engine-ready', listener);
        return () => ipcRenderer.removeListener('voice:engine-ready', listener);
    },
    onVoiceRecognitionResult: (callback) => {
        const listener = (event, data) => callback(data);
        ipcRenderer.on('voice:recognition-result', listener);
        return () => ipcRenderer.removeListener('voice:recognition-result', listener);
    },
    onVoiceRecognitionError: (callback) => {
        const listener = (event, data) => callback(data);
        ipcRenderer.on('voice:recognition-error', listener);
        return () => ipcRenderer.removeListener('voice:recognition-error', listener);
    },

    // Telegram Voice Processing
    processTelegramVoice: (fileId) => ipcRenderer.invoke('telegram:process-voice', fileId),

    // searXena Search Engine
    startSearXena: () => ipcRenderer.invoke('searxena:start'),
    stopSearXena: () => ipcRenderer.invoke('searxena:stop'),
    updateSearXenaEnv: () => ipcRenderer.invoke('searxena:update-env'),
    getSearXenaStatus: () => ipcRenderer.invoke('searxena:status'),
    onSearXenaStatusUpdate: (callback) => {
        const listener = (event, data) => callback(data);
        ipcRenderer.on('searxena:status-update', listener);
        return () => ipcRenderer.removeListener('searxena:status-update', listener);
    },

    // API streaming: listen for chunks from main process proxy
    onApiStreamChunk: (callback) => {
        const listener = (event, data) => callback(data);
        ipcRenderer.on('api-stream-chunk', listener);
        return () => ipcRenderer.removeListener('api-stream-chunk', listener);
    },

    // Menu events listener
    onMenuAction: (callback) => {
        const listener = (event, action) => callback(action);
        ipcRenderer.on('menu-action', listener);
        return () => ipcRenderer.removeListener('menu-action', listener);
    },

    // Trigger menu action from renderer (for custom titlebar)
    sendMenuAction: (action) => ipcRenderer.send('menu-action-trigger', action),

    // Trigger standard menu roles (undo, redo, etc.)
    sendMenuRole: (role) => ipcRenderer.send('menu-role-trigger', role),

    // Backgrounds
    getBackgrounds: () => ipcRenderer.invoke('get-backgrounds'),
    readBackground: (filename) => ipcRenderer.invoke('read-background', filename),

    // Title Bar
    updateTitleBar: (overlay) => ipcRenderer.send('update-titlebar', overlay)
});
