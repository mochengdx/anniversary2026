// Electron preload 脚本 - 安全暴露 API 给渲染进程
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectAlbumDirectory: () => ipcRenderer.invoke('select-album-directory'),
  readAlbumFiles: (dirPath) => ipcRenderer.invoke('read-album-files', dirPath),
  getLocalIP: () => ipcRenderer.invoke('get-local-ip'),
});
