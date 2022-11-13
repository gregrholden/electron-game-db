const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('libraryAPI', {
  handleExistingGames: (callback) => ipcRenderer.on('existing-games', callback),
  handleUpdateGames:   (callback) => ipcRenderer.on('update-games', callback),
  handleExistingTags:  (callback) => ipcRenderer.on('existing-tags',  callback),
  handleExistingLibs:  (callback) => ipcRenderer.on('existing-libs',  callback),
  handleExistingViews: (callback) => ipcRenderer.on('existing-views', callback),
  handleAddGameBtn:    ()         => ipcRenderer.invoke('modal:addGame'),
  handleSubmitGameBtn: (gameData) => ipcRenderer.send('submitGame', gameData)
});