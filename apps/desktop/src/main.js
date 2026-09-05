const { app, BrowserWindow, shell, Menu, nativeTheme, dialog, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

const DEFAULT_URL = 'https://app.hexalyte.com/login'
const APP_URL = (process.env.HEXALYTE_DESKTOP_URL || DEFAULT_URL).replace(/\/$/, '')
const VERSION_URL = 'https://app.hexalyte.com/downloads/desktop-version.json'
const DOWNLOAD_URL = 'https://app.hexalyte.com/downloads/Hexalyte-Setup.exe'
const STATE_FILE = 'window-state.json'

/** @type {BrowserWindow | null} */
let mainWindow = null

function compareSemver(a, b) {
  const pa = String(a).replace(/^v/i, '').split(/[.+-]/).map((n) => parseInt(n, 10) || 0)
  const pb = String(b).replace(/^v/i, '').split(/[.+-]/).map((n) => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x > y) return 1
    if (x < y) return -1
  }
  return 0
}

async function checkForDesktopUpdate() {
  if (process.env.HEXALYTE_DESKTOP_SKIP_UPDATE === '1') return
  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return
    const remote = await res.json()
    const latest = typeof remote?.version === 'string' ? remote.version.trim() : ''
    if (!latest) return
    const current = app.getVersion()
    if (compareSemver(current, latest) >= 0) return

    const download =
      typeof remote.downloadUrl === 'string' && remote.downloadUrl.startsWith('http')
        ? remote.downloadUrl
        : DOWNLOAD_URL
    const message =
      typeof remote.message === 'string' && remote.message.trim()
        ? remote.message.trim()
        : 'A new Hexalyte desktop update is available. Please install it to continue.'

    const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined
    const result = await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Desktop update available',
      message: 'Update required',
      detail: `${message}\n\nYou have v${current} → latest v${latest}`,
      buttons: ['Download update', 'Later'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    })
    if (result.response === 0) {
      if (win) {
        const payload = JSON.stringify({
          url: download,
          version: latest,
          label: 'Hexalyte Desktop update',
        })
        void win.webContents
          .executeJavaScript(
            `window.dispatchEvent(new CustomEvent('hx-desktop-download', { detail: ${payload} }))`,
          )
          .catch(() => {
            void shell.openExternal(download)
          })
      } else {
        void shell.openExternal(download)
      }
    }
  } catch (err) {
    console.warn('[hexalyte-desktop] update check failed:', err)
  }
}

function statePath() {
  return path.join(app.getPath('userData'), STATE_FILE)
}

function loadWindowState() {
  try {
    const raw = fs.readFileSync(statePath(), 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
    /* first run */
  }
  return {
    width: 1280,
    height: 800,
    x: undefined,
    y: undefined,
    isMaximized: true,
  }
}

function saveWindowState(win) {
  if (!win || win.isDestroyed()) return
  const bounds = win.getBounds()
  const state = {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    isMaximized: win.isMaximized(),
  }
  try {
    fs.writeFileSync(statePath(), JSON.stringify(state, null, 2), 'utf8')
  } catch (err) {
    console.warn('[hexalyte-desktop] failed to save window state:', err)
  }
}

function offlinePageUrl() {
  return `file://${path.join(__dirname, 'offline.html').replace(/\\/g, '/')}`
}

function isHexalyteUrl(url) {
  try {
    const u = new URL(url)
    const app = new URL(APP_URL)
    if (u.protocol === 'file:') return true
    if (u.hostname === app.hostname) return true
    if (u.hostname.endsWith('.hexalyte.com')) return true
    return false
  } catch {
    return false
  }
}

function createWindow() {
  const state = loadWindowState()
  const win = new BrowserWindow({
    width: state.width || 1280,
    height: state.height || 800,
    x: typeof state.x === 'number' ? state.x : undefined,
    y: typeof state.y === 'number' ? state.y : undefined,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    title: 'Hexalyte',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f172a' : '#f8fafc',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
  })

  mainWindow = win

  win.once('ready-to-show', () => {
    if (state.isMaximized !== false) win.maximize()
    win.show()
  })

  const persist = () => saveWindowState(win)
  win.on('resize', persist)
  win.on('move', persist)
  win.on('maximize', persist)
  win.on('unmaximize', persist)
  win.on('close', persist)

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isHexalyteUrl(url)) {
      return { action: 'allow' }
    }
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (!isHexalyteUrl(url)) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return
    // Ignore aborted loads (e.g. redirects)
    if (errorCode === -3) return
    console.warn('[hexalyte-desktop] load failed:', errorCode, errorDescription, validatedURL)
    void win.loadURL(`${offlinePageUrl()}?url=${encodeURIComponent(APP_URL)}`)
  })

  void win.loadURL(APP_URL)
  return win
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.reload()
          },
        },
        {
          label: 'Open in Browser',
          click: () => {
            void shell.openExternal(APP_URL)
          },
        },
        { type: 'separator' },
        { role: 'quit', label: 'Quit Hexalyte' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates…',
          click: () => {
            void checkForDesktopUpdate()
          },
        },
        {
          label: 'Hexalyte Website',
          click: () => {
            void shell.openExternal('https://hexalyte.com')
          },
        },
        {
          label: 'App URL',
          click: () => {
            void shell.openExternal(APP_URL)
          },
        },
        { type: 'separator' },
        {
          label: `Version ${app.getVersion()}`,
          enabled: false,
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

ipcMain.handle('desktop:get-version', () => app.getVersion())

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    buildMenu()
    createWindow()
    setTimeout(() => {
      void checkForDesktopUpdate()
    }, 2500)
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
