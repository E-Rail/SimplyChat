const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

if (require('electron-squirrel-startup')) {
  app.quit();
}

// Register custom protocol for OAuth redirects
if (process.defaultApp) {
  // In development, need to re-register with the exec path
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('simplychat', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('simplychat');
}

let mainWindow;

function sendOAuthUrl(url) {
  if (mainWindow) {
    mainWindow.webContents.send('oauth-callback', url);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
}

// Handle protocol URL (macOS open-url event)
app.on('open-url', (event, url) => {
  event.preventDefault();
  sendOAuthUrl(url);
});

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src/login.html'));

  // Open DevTools for debugging (uncomment if needed)
  // mainWindow.webContents.openDevTools();
};

app.on('ready', () => {
  createWindow();

  // Handle protocol URL passed as arg (app not running when link clicked)
  const protocolUrl = process.argv.find(arg => arg.startsWith('simplychat://'));
  if (protocolUrl) {
    setTimeout(() => sendOAuthUrl(protocolUrl), 1000);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC: open external URL (for OAuth)
ipcMain.handle('open-external', async (event, url) => {
  await shell.openExternal(url);
});

// IPC: check for protocol URL on Windows/Linux
ipcMain.handle('get-protocol-url', () => {
  const url = process.argv.find(arg => arg.startsWith('simplychat://'));
  return url || null;
});
