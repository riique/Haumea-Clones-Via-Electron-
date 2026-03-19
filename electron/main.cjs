const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const Store = require('electron-store').default
const { autoUpdater } = require('electron-updater')
const { PythonBridge } = require('./python-bridge.cjs')

const store = new Store({ name: 'haumea-credentials' })

const TITLEBAR_HEIGHT = 40

let mainWindow
let pythonBridge
let updateState = createDefaultUpdateState()

function createDefaultUpdateState() {
    return {
        supported: false,
        status: 'idle',
        currentVersion: app.getVersion(),
        availableVersion: '',
        downloadedVersion: '',
        percent: 0,
        transferred: 0,
        total: 0,
        message: '',
        error: '',
        checkedAt: null,
        releaseNotes: '',
    }
}

function isAutoUpdateSupported() {
    return app.isPackaged && !process.argv.includes('--dev')
}

function stripMarkup(value = '') {
    return String(value)
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function normalizeReleaseNotes(releaseNotes) {
    if (!releaseNotes) return ''

    if (Array.isArray(releaseNotes)) {
        return releaseNotes
            .map((item) => {
                if (item?.note) return stripMarkup(item.note)
                return stripMarkup(item)
            })
            .filter(Boolean)
            .join('\n\n')
    }

    return stripMarkup(releaseNotes)
}

function sendUpdateState() {
    mainWindow?.webContents.send('updater:state', updateState)
}

function setUpdateState(patch = {}) {
    updateState = {
        ...updateState,
        ...patch,
        currentVersion: app.getVersion(),
    }
    sendUpdateState()
}

async function checkForAppUpdates() {
    if (!isAutoUpdateSupported()) {
        setUpdateState({
            supported: false,
            status: 'unsupported',
            message: 'As atualizações automáticas funcionam apenas no app instalado.',
            error: '',
        })
        return { ok: false, supported: false }
    }

    try {
        await autoUpdater.checkForUpdates()
        return { ok: true }
    } catch (error) {
        const message = String(error?.message || error || 'Falha ao verificar atualizações.')
        setUpdateState({
            supported: true,
            status: 'error',
            error: message,
            message: 'Não foi possível verificar atualizações agora.',
        })
        return { ok: false, error: message }
    }
}

async function downloadAppUpdate() {
    if (!isAutoUpdateSupported()) {
        return { ok: false, error: 'Auto-update indisponível neste ambiente.' }
    }

    if (updateState.status === 'downloaded') {
        return { ok: true, already_downloaded: true }
    }

    if (updateState.status !== 'available') {
        return { ok: false, error: 'Nenhuma atualização disponível para download.' }
    }

    try {
        await autoUpdater.downloadUpdate()
        return { ok: true }
    } catch (error) {
        const message = String(error?.message || error || 'Falha ao baixar atualização.')
        setUpdateState({
            supported: true,
            status: 'error',
            error: message,
            message: 'O download da atualização falhou.',
        })
        return { ok: false, error: message }
    }
}

function installAppUpdate() {
    if (!isAutoUpdateSupported()) {
        return { ok: false, error: 'Auto-update indisponível neste ambiente.' }
    }

    if (updateState.status !== 'downloaded') {
        return { ok: false, error: 'Ainda não existe atualização pronta para instalar.' }
    }

    setImmediate(() => {
        autoUpdater.quitAndInstall()
    })

    return { ok: true }
}

function setupAutoUpdater() {
    updateState = createDefaultUpdateState()

    if (!isAutoUpdateSupported()) {
        setUpdateState({
            supported: false,
            status: 'unsupported',
            message: 'As atualizações automáticas ficam disponíveis no app instalado.',
            error: '',
        })
        return
    }

    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.allowDowngrade = false

    setUpdateState({
        supported: true,
        status: 'idle',
        message: 'Pronto para verificar novas versões.',
        error: '',
    })

    autoUpdater.on('checking-for-update', () => {
        setUpdateState({
            supported: true,
            status: 'checking',
            checkedAt: new Date().toISOString(),
            message: 'Verificando atualizações...',
            error: '',
            percent: 0,
            transferred: 0,
            total: 0,
        })
    })

    autoUpdater.on('update-available', (info) => {
        setUpdateState({
            supported: true,
            status: 'available',
            availableVersion: info?.version || '',
            downloadedVersion: '',
            message: 'Nova versão disponível para download.',
            error: '',
            percent: 0,
            transferred: 0,
            total: 0,
            releaseNotes: normalizeReleaseNotes(info?.releaseNotes),
        })
    })

    autoUpdater.on('update-not-available', (info) => {
        setUpdateState({
            supported: true,
            status: 'not-available',
            availableVersion: info?.version || '',
            downloadedVersion: '',
            message: 'Você já está na versão mais recente.',
            error: '',
            percent: 0,
            transferred: 0,
            total: 0,
            releaseNotes: '',
        })
    })

    autoUpdater.on('download-progress', (progress) => {
        setUpdateState({
            supported: true,
            status: 'downloading',
            percent: Number((progress?.percent || 0).toFixed(1)),
            transferred: progress?.transferred || 0,
            total: progress?.total || 0,
            message: 'Baixando atualização...',
            error: '',
        })
    })

    autoUpdater.on('update-downloaded', (info) => {
        setUpdateState({
            supported: true,
            status: 'downloaded',
            availableVersion: info?.version || updateState.availableVersion,
            downloadedVersion: info?.version || updateState.availableVersion,
            percent: 100,
            message: 'Atualização pronta para instalar.',
            error: '',
            releaseNotes: normalizeReleaseNotes(info?.releaseNotes) || updateState.releaseNotes,
        })
    })

    autoUpdater.on('error', (error) => {
        const message = String(error?.message || error || 'Falha ao verificar atualizações.')
        setUpdateState({
            supported: true,
            status: 'error',
            message: 'O sistema de atualização encontrou um erro.',
            error: message,
        })
    })
}

function getStoredCredentials() {
    return store.get('credentials') || {}
}

function patchStoredCredentials(patch = {}) {
    const current = getStoredCredentials()
    const next = { ...current, ...patch }
    store.set('credentials', next)
    return next
}

function createWindow() {
    const isMac = process.platform === 'darwin'

    mainWindow = new BrowserWindow({
        width: 1360,
        height: 920,
        minWidth: 1180,
        minHeight: 780,
        icon: path.join(__dirname, '..', 'icon.ico'),
        autoHideMenuBar: true,
        backgroundColor: '#060609',
        titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
        ...(isMac
            ? {}
            : {
                titleBarOverlay: {
                    color: '#0c0c12',
                    symbolColor: '#eae8e4',
                    height: TITLEBAR_HEIGHT,
                },
            }),
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    })

    if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
        mainWindow.loadURL('http://localhost:5173')
    } else {
        mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
    }

    mainWindow.webContents.on('did-finish-load', () => {
        sendUpdateState()
    })

    mainWindow.on('closed', () => {
        mainWindow = null
    })
}

app.whenReady().then(async () => {
    pythonBridge = new PythonBridge()
    setupAutoUpdater()

    pythonBridge.onLog((data) => {
        mainWindow?.webContents.send('python:log', data)
    })
    pythonBridge.onProgress((data) => {
        mainWindow?.webContents.send('python:progress', data)
    })
    pythonBridge.onStatus((data) => {
        mainWindow?.webContents.send('python:status', data)
    })

    ipcMain.handle('python:send', async (_event, method, params) => {
        return pythonBridge.send(method, params)
    })

    ipcMain.handle('python:start', async () => {
        return pythonBridge.start()
    })

    ipcMain.handle('python:stop', async () => {
        return pythonBridge.stop()
    })

    ipcMain.handle('updater:getState', async () => updateState)
    ipcMain.handle('updater:check', async () => checkForAppUpdates())
    ipcMain.handle('updater:download', async () => downloadAppUpdate())
    ipcMain.handle('updater:install', async () => installAppUpdate())

    // Credential store IPC
    ipcMain.handle('store:get', (_event, key) => store.get(key))
    ipcMain.handle('store:set', (_event, key, value) => store.set(key, value))
    ipcMain.handle('store:delete', (_event, key) => store.delete(key))
    ipcMain.handle('store:getAll', () => store.store)
    ipcMain.handle('store:patchCredentials', (_event, patch) => patchStoredCredentials(patch))
    ipcMain.handle('store:clearSession', () => patchStoredCredentials({ session_string: '' }))

    const started = await pythonBridge.start()
    if (!started?.ok) {
        console.error('[python:start]', started?.error || 'backend unavailable during boot')
    }
    createWindow()

    if (isAutoUpdateSupported()) {
        setTimeout(() => {
            void checkForAppUpdates()
        }, 3000)
    }
})

app.on('window-all-closed', () => {
    void (async () => {
        await pythonBridge?.stop()
        app.quit()
    })()
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
