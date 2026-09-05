const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('hexalyteDesktop', {
  platform: process.platform,
  isDesktop: true,
  /** Prefer getVersion() — sync field may be empty until main answers. */
  getVersion: () => ipcRenderer.invoke('desktop:get-version'),
  getShopSlug: () => ipcRenderer.invoke('desktop:get-shop-slug'),
  setShopSlug: (slug) => ipcRenderer.invoke('desktop:set-shop-slug', slug),
  clearShopSlug: () => ipcRenderer.invoke('desktop:clear-shop-slug'),
  /** Persist shop and navigate to tenant login URL when possible. */
  openShopLogin: (slug) => ipcRenderer.invoke('desktop:open-shop-login', slug),
  /** Silent download + NSIS install; app quits and relaunches. */
  installUpdate: (url, meta) => ipcRenderer.invoke('desktop:install-update', url, meta || {}),
  checkUpdate: () => ipcRenderer.invoke('desktop:check-update'),
  onUpdateProgress: (callback) => {
    if (typeof callback !== 'function') return () => {}
    const handler = (_event, payload) => callback(payload)
    ipcRenderer.on('desktop:update-progress', handler)
    return () => ipcRenderer.removeListener('desktop:update-progress', handler)
  },
})
