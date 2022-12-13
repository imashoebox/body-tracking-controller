const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  sendKey: (key) => ipcRenderer.send('send-key', key),
  sendMouse: (mouse) => ipcRenderer.send('send-mouse', mouse),
  sendMouseMove: (mouseMove) => ipcRenderer.send('send-mouse-move', mouseMove),
})