const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Forks can use this for product-specific links without enabling node in the renderer.
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
