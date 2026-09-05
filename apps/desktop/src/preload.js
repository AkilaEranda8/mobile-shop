const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('hexalyteDesktop', {
  platform: process.platform,
  isDesktop: true,
})
