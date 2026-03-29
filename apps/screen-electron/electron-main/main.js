// Electron 主进程
import { app, BrowserWindow, protocol, dialog, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: !isDev,
    // frame: false, // 隐藏所有边框，实现纯粹的全屏展示
    // autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // mainWindow.maximize(); // 默认最大化窗口
  mainWindow.setFullScreen(true); // 进入全屏模式

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// 注册自定义协议：local-media:// 安全映射本地文件
function registerLocalMediaProtocol() {
  protocol.registerFileProtocol('local-media', (request, callback) => {
    const filePath = decodeURIComponent(
      request.url.replace('local-media://', '')
    );
    callback({ path: filePath });
  });
}

app.whenReady().then(() => {
  registerLocalMediaProtocol();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ===== IPC: 本地相册功能 =====

// 选择相册目录
ipcMain.handle('select-album-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择相册文件夹',
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// 读取目录下的图片文件列表
ipcMain.handle('read-album-files', async (_event, dirPath) => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  try {
    const files = fs.readdirSync(dirPath);
    const images = files
      .filter((f) =>
        imageExtensions.includes(path.extname(f).toLowerCase())
      )
      .map((f) => ({
        name: f,
        url: `local-media://${encodeURIComponent(path.join(dirPath, f))}`,
        path: path.join(dirPath, f),
      }));
    return images;
  } catch {
    return [];
  }
});

// 获取本机局域网 IP
ipcMain.handle('get-local-ip', async () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
});

// 相册本地数据库
const ALBUMS_DB_PATH = path.join(app.getPath('userData'), 'albums_db.json');

ipcMain.handle('get-albums', async () => {
  try {
    if (fs.existsSync(ALBUMS_DB_PATH)) {
      const data = fs.readFileSync(ALBUMS_DB_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('get-albums error', e);
  }
  return [];
});

ipcMain.handle('save-albums', async (_event, albums) => {
  try {
    fs.writeFileSync(ALBUMS_DB_PATH, JSON.stringify(albums, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('save-albums error', e);
    return false;
  }
});

ipcMain.handle('select-audio-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'aac'] }],
    title: '选择背景音乐',
  });
  if (result.canceled) return null;
  return `local-media://${encodeURIComponent(result.filePaths[0])}`;
});

ipcMain.handle('toggle-fullscreen', async () => {
  if (mainWindow) {
    const isFS = mainWindow.isFullScreen();
    mainWindow.setFullScreen(!isFS);
    if (!isFS) mainWindow.setMenuBarVisibility(false);
    return !isFS;
  }
  return false;
});
