const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('vault', {
  load: () => ipcRenderer.invoke('load'),
  saveLayout: l => ipcRenderer.invoke('saveLayout', l),
  del: (ids, positions) => ipcRenderer.invoke('del', ids, positions),
  delDay: (d, positions) => ipcRenderer.invoke('delDay', d, positions),
  copyImage: id => ipcRenderer.invoke('copyImage', id),
  exportMany: ids => ipcRenderer.invoke('exportMany', ids),
  deleteMany: (ids, positions) => ipcRenderer.invoke('deleteMany', ids, positions),
  trashDays: (days, positions) => ipcRenderer.invoke('trashDays', days, positions),
  storageSnapshot: () => ipcRenderer.invoke('storageSnapshot'),
  restoreTrash: token => ipcRenderer.invoke('restoreTrash', token),
  emptyTrash: () => ipcRenderer.invoke('emptyTrash'),
  onNew: cb => ipcRenderer.on('new-image', (_e, i) => cb(i)),
  onPause: cb => ipcRenderer.on('paused', (_e, p) => cb(p)),
});
