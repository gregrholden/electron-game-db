const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('libraryAPI', {
  // Library management APIs.
  handleExistingLibs:     (callback)  => ipcRenderer.on('existing-libs', callback),
  handleLibraryRefresh:   (games)     => ipcRenderer.on('library-refresh', games),
  // Game management APIs.
  handleExistingGames:    (callback)  => ipcRenderer.on('existing-games', callback),
  handleUpdateGames:      (callback)  => ipcRenderer.on('update-games', callback),
  handleAddGameBtn:       ()          => ipcRenderer.invoke('modal:addGame'),
  handleEditGameBtn:      (gid)       => ipcRenderer.send('modal:editGame', gid),
  handleSubmitGameBtn:    (gameData)  => ipcRenderer.send('submitGame', gameData),
  handleGameDeleteBtn:    (gid)       => ipcRenderer.send('deleteGame', gid),
  handleRemoveGameRow:    (callback)  => ipcRenderer.on('remove-game-row', callback),
  handleEditGameData:     (gameData)  => ipcRenderer.on('edit-game-data', gameData),
  handleSubmitEditsBtn:   (gameData)  => ipcRenderer.send('submit-edits', gameData),
  handleUpdateGameRow:    (gameData)  => ipcRenderer.on('update-game-row', gameData),
  // Tag management APIs.
  handleExistingTags:     (callback)  => ipcRenderer.on('existing-tags',  callback),
  handleAddTagBtn:        ()          => ipcRenderer.invoke('modal:addTag'),
  handleSubmitTagBtn:     (tagData)   => ipcRenderer.send('submitTag', tagData),
  // Filter management APIs.
  handleExistingFilters:  (callback)  => ipcRenderer.on('existing-filters', callback),
  handleChangeFilter:     (fid)       => ipcRenderer.send('change-filter', fid),
  handleAddFilterBtn:     ()          => ipcRenderer.invoke('modal:addFilter'),
  handleSubmitFilter:     (filter)    => ipcRenderer.send('submit-filter', filter),
  handleAddFilter:        (filter)    => ipcRenderer.on('add-filter', filter),
  handleRemoveFiltersBtn: ()          => ipcRenderer.invoke('modal:removeFilters'),
  handleSubmitRmvFilters: (filters)   => ipcRenderer.send('remove-filters', filters),
  // Utility APIs.
  sendToConsole:          (message)   => ipcRenderer.send('console', message)
})
