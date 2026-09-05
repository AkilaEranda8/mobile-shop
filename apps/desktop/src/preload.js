const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('hexalyteDesktop', {
  platform: process.platform,
  isDesktop: true,
  /** Prefer getVersion() — sync field may be empty until main answers. */
  getVersion: () => ipcRenderer.invoke('desktop:get-version'),
})
