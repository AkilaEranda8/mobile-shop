const { app, BrowserWindow, shell, Menu, nativeTheme, dialog, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')
const https = require('https')
const { spawn } = require('child_process')

const DEFAULT_URL = 'https://app.hexalyte.com/login'
const APP_URL_ENV = process.env.HEXALYTE_DESKTOP_URL
const VERSION_URL = 'https://app.hexalyte.com/downloads/desktop-version.json'
const DOWNLOAD_URL = 'https://app.hexalyte.com/downloads/Hexalyte-Setup.exe'
const STATE_FILE = 'window-state.json'
const SHOP_FILE = 'shop-config.json'
const RESERVED_SHOP_SLUGS = new Set(['app', 'test', 'www', 'api', 'admin', 'platform'])

/** @type {BrowserWindow | null} */
let mainWindow = null
let updateInProgress = false

function normalizeShopSlug(raw) {
  const slug = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
  return slug.length >= 2 ? slug : null
}

function shopConfigPath() {
  return path.join(app.getPath('userData'), SHOP_FILE)
}

function loadShopSlug() {
  try {
    const raw = fs.readFileSync(shopConfigPath(), 'utf8')
    const parsed = JSON.parse(raw)
    return normalizeShopSlug(parsed?.shopSlug)
  } catch {
    return null
  }
}

function saveShopSlug(raw) {
  const slug = normalizeShopSlug(raw)
  if (!slug) return null
  try {
    fs.writeFileSync(shopConfigPath(), JSON.stringify({ shopSlug: slug }, null, 2), 'utf8')
  } catch (err) {
    console.warn('[hexalyte-desktop] failed to save shop slug:', err)
  }
  return slug
}

function clearShopSlug() {
  try {
    if (fs.existsSync(shopConfigPath())) fs.unlinkSync(shopConfigPath())
  } catch {
    /* ignore */
  }
}

/** Tenant subdomain login when slug is safe; reserved slugs stay on shared host. */
function shopLoginUrl(slug) {
  const s = normalizeShopSlug(slug)
  if (!s || RESERVED_SHOP_SLUGS.has(s)) return DEFAULT_URL
  return `https://${s}.app.hexalyte.com/login`
}

/**
 * Marketing / landing pages must never stay open inside the desktop shell.
 * Rewrite bare app roots (and public marketing hosts) to the login screen.
 */
function toAppLoginUrl(url) {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    const path = (u.pathname || '/').replace(/\/+$/, '') || '/'

    // Public marketing site → shared app login
    if (host === 'hexalyte.com' || host === 'www.hexalyte.com') {
      return DEFAULT_URL
    }

    const isAppHost =
      host === 'app.hexalyte.com' ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      /^[a-z0-9-]+\.app\.hexalyte\.com$/.test(host) ||
      /^[a-z0-9-]+\.test\.app\.hexalyte\.com$/.test(host)

    if (isAppHost && (path === '/' || path === '')) {
      u.pathname = '/login'
      u.hash = ''
      return u.toString()
    }
  } catch {
    /* ignore */
  }
  return null
}

function resolveStartUrl() {
  if (APP_URL_ENV && String(APP_URL_ENV).trim()) {
    const envUrl = String(APP_URL_ENV).trim().replace(/\/$/, '')
    return toAppLoginUrl(envUrl) || envUrl
  }
  const slug = loadShopSlug()
  if (slug) return shopLoginUrl(slug)
  return DEFAULT_URL
}

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

function absoluteDownloadUrl(raw) {
  const s = String(raw || '').trim()
  if (!s) return DOWNLOAD_URL
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  if (s.startsWith('/')) return `https://app.hexalyte.com${s}`
  return DOWNLOAD_URL
}

function isInstallerUrl(url) {
  try {
    const u = new URL(url)
    const p = (u.pathname || '').toLowerCase()
    return p.endsWith('.exe') || p.includes('/downloads/hexalyte-setup')
  } catch {
    return false
  }
}

function broadcastUpdateProgress(payload) {
  const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
  if (!win) return
  try {
    win.webContents.send('desktop:update-progress', payload)
  } catch {
    /* ignore */
  }
  // Keep overlay in sync even if IPC listener is not ready yet
  try {
    const detail = JSON.stringify(payload)
    void win.webContents
      .executeJavaScript(
        `window.dispatchEvent(new CustomEvent('hx-desktop-update-progress', { detail: ${detail} }))`,
      )
      .catch(() => {})
  } catch {
    /* ignore */
  }
}

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http
    const req = lib.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        downloadFile(absoluteDownloadUrl(res.headers.location), dest, onProgress).then(resolve, reject)
        return
      }
      if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(`Download failed (HTTP ${res.statusCode})`))
        return
      }

      const total = Number(res.headers['content-length'] || 0)
      let received = 0
      const file = fs.createWriteStream(dest)
      res.on('data', (chunk) => {
        received += chunk.length
        if (total > 0 && onProgress) onProgress(received / total)
      })
      res.pipe(file)
      file.on('finish', () => {
        file.close((err) => {
          if (err) reject(err)
          else resolve(dest)
        })
      })
      file.on('error', (err) => {
        try {
          fs.unlinkSync(dest)
        } catch {
          /* ignore */
        }
        reject(err)
      })
    })
    req.on('error', reject)
  })
}

/** Quit app, then silent NSIS install; installer relaunches Hexalyte when done. */
function launchInstallerAndQuit(installerPath) {
  const quoted = `"${installerPath.replace(/"/g, '')}"`
  // Delay so Electron can release file locks before NSIS replaces files.
  const child = spawn(
    process.env.ComSpec || 'cmd.exe',
    ['/d', '/c', `ping -n 2 127.0.0.1 >nul & start "" /b ${quoted} /S`],
    { detached: true, stdio: 'ignore', windowsHide: true },
  )
  child.unref()
  setTimeout(() => {
    app.quit()
  }, 400)
}

async function installDesktopUpdate(downloadUrl, meta = {}) {
  if (updateInProgress) return { ok: false, reason: 'busy' }
  updateInProgress = true

  const url = absoluteDownloadUrl(downloadUrl || DOWNLOAD_URL)
  const version = typeof meta.version === 'string' ? meta.version.trim() : ''
  const dest = path.join(
    app.getPath('temp'),
    `Hexalyte-Setup-update${version ? `-${version}` : ''}.exe`,
  )

  try {
    broadcastUpdateProgress({
      phase: 'downloading',
      progress: 0,
      version: version || undefined,
      label: 'Hexalyte Desktop update',
    })

    await downloadFile(url, dest, (ratio) => {
      broadcastUpdateProgress({
        phase: 'downloading',
        progress: Math.max(1, Math.min(99, Math.round(ratio * 100))),
        version: version || undefined,
      })
    })

    broadcastUpdateProgress({
      phase: 'installing',
      progress: 100,
      version: version || undefined,
    })

    launchInstallerAndQuit(dest)
    return { ok: true }
  } catch (err) {
    updateInProgress = false
    const message = err && err.message ? String(err.message) : 'Update failed'
    console.warn('[hexalyte-desktop] update install failed:', err)
    broadcastUpdateProgress({ phase: 'error', progress: 0, message })
    return { ok: false, reason: message }
  }
}

/**
 * @param {{ interactive?: boolean }} [opts]
 */
async function checkForDesktopUpdate(opts = {}) {
  if (process.env.HEXALYTE_DESKTOP_SKIP_UPDATE === '1') return
  const interactive = Boolean(opts.interactive)
  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return
    const remote = await res.json()
    const latest = typeof remote?.version === 'string' ? remote.version.trim() : ''
    if (!latest) return
    const current = app.getVersion()
    if (compareSemver(current, latest) >= 0) {
      if (interactive) {
        const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined
        await dialog.showMessageBox(win, {
          type: 'info',
          title: 'Hexalyte',
          message: 'You are up to date',
          detail: `Hexalyte desktop v${current} is the latest version.`,
          buttons: ['OK'],
        })
      }
      return
    }

    const download = absoluteDownloadUrl(remote.downloadUrl)
    // Fully automatic: download → silent install → app restarts. No Save As.
    await installDesktopUpdate(download, { version: latest })
  } catch (err) {
    console.warn('[hexalyte-desktop] update check failed:', err)
    if (interactive) {
      const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined
      await dialog.showMessageBox(win, {
        type: 'warning',
        title: 'Update check failed',
        message: 'Could not check for updates',
        detail: err && err.message ? String(err.message) : 'Please try again later.',
        buttons: ['OK'],
      })
    }
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
    if (u.protocol === 'file:') return true
    if (u.hostname === 'app.hexalyte.com') return true
    if (u.hostname.endsWith('.hexalyte.com')) return true
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true
    return false
  } catch {
    return false
  }
}

/** If url is a marketing/landing page, navigate the window to login instead. */
function redirectAwayFromMarketing(win, url) {
  const loginUrl = toAppLoginUrl(url)
  if (!loginUrl || loginUrl === url) return false
  if (!win || win.isDestroyed()) return false
  void win.loadURL(loginUrl)
  return true
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
    if (isInstallerUrl(url)) {
      void installDesktopUpdate(url)
      return { action: 'deny' }
    }
    const rewritten = toAppLoginUrl(url)
    if (rewritten) {
      void win.loadURL(rewritten)
      return { action: 'deny' }
    }
    if (isHexalyteUrl(url)) {
      return { action: 'allow' }
    }
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    // Never navigate the window to the .exe — that opens Windows Save As.
    if (isInstallerUrl(url)) {
      event.preventDefault()
      void installDesktopUpdate(url)
      return
    }
    const rewritten = toAppLoginUrl(url)
    if (rewritten && rewritten !== url) {
      event.preventDefault()
      void win.loadURL(rewritten)
      return
    }
    if (!isHexalyteUrl(url)) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })

  win.webContents.session.on('will-download', (_event, item) => {
    // Intercept Chromium Save As downloads → silent native install instead.
    const url = item.getURL()
    const name = item.getFilename() || ''
    if (!isInstallerUrl(url) && !/\.exe$/i.test(name)) return
    try {
      item.cancel()
    } catch {
      /* ignore */
    }
    void installDesktopUpdate(url || DOWNLOAD_URL)
  })

  win.webContents.on('will-redirect', (event, url) => {
    const rewritten = toAppLoginUrl(url)
    if (rewritten && rewritten !== url) {
      event.preventDefault()
      void win.loadURL(rewritten)
    }
  })

  win.webContents.on('did-navigate', (_event, url) => {
    redirectAwayFromMarketing(win, url)
  })

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return
    // Ignore aborted loads (e.g. redirects)
    if (errorCode === -3) return
    console.warn('[hexalyte-desktop] load failed:', errorCode, errorDescription, validatedURL)
    void win.loadURL(`${offlinePageUrl()}?url=${encodeURIComponent(resolveStartUrl())}`)
  })

  void win.loadURL(resolveStartUrl())
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
          label: 'Change Shop…',
          click: () => {
            clearShopSlug()
            if (mainWindow && !mainWindow.isDestroyed()) {
              void mainWindow.loadURL(DEFAULT_URL)
            }
          },
        },
        {
          label: 'Open in Browser',
          click: () => {
            void shell.openExternal(resolveStartUrl())
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
            void checkForDesktopUpdate({ interactive: true })
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
            void shell.openExternal(resolveStartUrl())
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
ipcMain.handle('desktop:get-shop-slug', () => loadShopSlug())
ipcMain.handle('desktop:set-shop-slug', (_event, raw) => saveShopSlug(raw))
ipcMain.handle('desktop:clear-shop-slug', () => {
  clearShopSlug()
  return true
})
ipcMain.handle('desktop:open-shop-login', (_event, raw) => {
  const saved = saveShopSlug(raw)
  const url = shopLoginUrl(saved)
  if (mainWindow && !mainWindow.isDestroyed()) {
    void mainWindow.loadURL(url)
  }
  return { slug: saved, url }
})
ipcMain.handle('desktop:install-update', (_event, rawUrl, meta) => {
  return installDesktopUpdate(rawUrl || DOWNLOAD_URL, meta && typeof meta === 'object' ? meta : {})
})
ipcMain.handle('desktop:check-update', () => checkForDesktopUpdate({ interactive: false }))

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
