const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  sendKey: (key) => ipcRenderer.send('send-key', key)
})