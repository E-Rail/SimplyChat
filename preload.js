const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Listen for OAuth callback URLs
  onOAuthCallback: (callback) => ipcRenderer.on('oauth-callback', (_event, url) => callback(url)),
  // Open URL in system browser (for OAuth)
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  // Check for protocol URL on app start (Windows/Linux)
  getProtocolUrl: () => ipcRenderer.invoke('get-protocol-url')
});
