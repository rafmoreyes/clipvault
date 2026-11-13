const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('vault', {
  load: () => ipcRenderer.invoke('load'),
  saveLayout: l => ipcRenderer.invoke('saveLayout', l),
  del: ids => ipcRenderer.invoke('del', ids),
  delDay: d => ipcRenderer.invoke('delDay', d),
  copyImage: id => ipcRenderer.invoke('copyImage', id),
  exportMany: ids => ipcRenderer.invoke('exportMany', ids),
  deleteMany: ids => ipcRenderer.invoke('deleteMany', ids),
  onNew: cb => ipcRenderer.on('new-image', (_e, i) => cb(i)),
  onPause: cb => ipcRenderer.on('paused', (_e, p) => cb(p)),
});
