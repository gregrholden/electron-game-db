// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const windowStateKeeper = require('electron-window-state')
const sqlite3 = require('sqlite3').verbose()
const { open } = require('sqlite')
const path = require('path')
const DATABASE = './assets/gameDB.sqlite';

// Prevent garbage collection on mainWindow.
let mainWindow

// DB connection driver.
async function getDBDriver() {
  const db = await open({
    filename: DATABASE,
    driver: sqlite3.Database
  })
  return db
}

// Main window creation.
async function createWindow() {
  // Create window state manager.
  let winState = windowStateKeeper({
    defaultWidth: 1600,
    defaultHeight: 800
  })

  // Create main app window.
  mainWindow = new BrowserWindow({
    width: winState.width,
    height: winState.height,
    x: winState.x,
    y: winState.y,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'assets/renderers/preload.js')
    }
  })

  // Initialize our database with schema and default values.
  await initDB()

  // Retrieve arrays of existing objects from the database.
  let libs = await getAllFromTable("library")
  let games = await getAllFromTable("games")
  // Get existing game_tags for each game and append to each game in array.
  let games_with_tags = []
  for (let i = 0; i < games.length; i++) {
    games_with_tags.push(await getGameTags(games[i]))
  }
  let filters = await getAllFromTable("filters")

  // Load the index.html file of the app and pass initial data to renderer.
  mainWindow.loadFile(path.join(__dirname, 'index.html'))
    .then(() => { mainWindow.webContents.send('existing-games', games_with_tags) })
    .then(() => { mainWindow.webContents.send('existing-filters', filters) })
    .then(() => { mainWindow.webContents.send('existing-libs', libs) })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })
  // Track and manage window state.
  winState.manage(mainWindow)
  // Open Chromium DevTools.
  mainWindow.webContents.openDevTools()
}

// When the app is "ready" then we can add listeners and event handlers to it.
app.whenReady().then(() => {

  //////// ADD-GAME MODAL TRIGGER ////////
  // Modal window to add a new game.
  ipcMain.handle('modal:addGame', addGame)

  //////// HANDLER FOR INSERT OF NEW GAME ////////
  // Event handler for when a new game is submitted via the above modal.
  ipcMain.on('submitGame', async (event, gameData) => {
    // Insert new game into database.
    if (gameData.name) {
      let gid = await insertGame(gameData)
      // Get the game data (with autoincremented gid) from insert above.
      let newGameData = await getRowFromId('games', 'gid', gid.lastID)
      // Then update the library on the renderer.
      if (Object.keys(newGameData).length > 0) {
        // Associate all new games with the 'All' Tag (tid=0).
        await insertIntoGameTags(null, gid.lastID, 0)
        // Associate new game with user-selected Tag.
        await insertIntoGameTags(null, gid.lastID, gameData.tag)
        // Add array of Tag names associated with the new game to the object.
        newGameData = await getGameTags(newGameData)
        mainWindow.webContents.send('update-games', newGameData)
      } else {
        console.log("Nothing to update!")
      }
    }
  })

  //////// ADD-TAG MODAL TRIGGER ////////
  // Modal window to add a new game.
  ipcMain.handle('modal:addTag', addTag)

  //////// HANDLER FOR INSERT OF NEW TAG ////////
  // Event handler for when a new tag is submitted via the above modal.
  ipcMain.on('submitTag', async (event, tagName) => {
    await insertTag(tagName)
  })

  //////// HANDLE GAME DELETION ////////
  ipcMain.on('deleteGame', async (event, gid) => {
    // Pop-up modal asking for confirmation.
    let res = await confirmDelete()
    // If user selects 'Yes', delete game from database.
    if (res === 0) {
      await deleteGame(gid)
      // Refresh game library.
      mainWindow.webContents.send('remove-game-row', gid)
    }
  })

  // Function for displaying renderer data on backend console.
  // Used for debugging.
  ipcMain.on('console', async (event, message) => {
    console.log(message)
  })

  //////// HANDLE GAME EDITING FUNCTIONALITY ////////
  ipcMain.handle('modal:editGame', async (event, gid) => {
    // Get game data.
    let game = await getGame(gid)
    game.genre = await getTagIDs(gid)
    // Swap tag name with tag id.
    await editGame(game)
  })

  //////// HANDLE GAME EDIT SUBMIT BUTTON ////////
  ipcMain.on('submit-edits', async (event, gameData) => {
      await updateGame(gameData)
      await updateGameTag(gameData)
      // Convert tag ID to tag name in gameData object.
      gameData['genre'] = await getTagById(gameData['genre'])
      await mainWindow.webContents.send('update-game-row', gameData)
  })

  //////// HANDLE FILTER DROPDOWN CHANGE ////////
  ipcMain.on('change-filter', async (event, fid) => {
    // console.log("INPUT: " + fid)
    let tids = await getTidsByFids(fid)
    let gids = []
    for (let i = 0; i < tids.length; i++) {
      let objs = await getGidsByTids(tids[i]['tid'])
      objs.forEach(obj => {
        Object.values(obj).forEach(val => {
          gids.push(val)
        })
      })
    }
    let games = []
    for (let j = 0; j < gids.length; j++) {
      games.push(await getGame(gids[j]))
    }
    // Get existing game_tags for each game and append to each game in array.
    let games_with_tags = []
    for (let i = 0; i < games.length; i++) {
      games_with_tags.push(await getGameTags(games[i]))
    }
    await mainWindow.webContents.send('library-refresh', games_with_tags)
  })

  //////// HANDLE MODAL CREATION FOR ADDING NEW FILTERS ////////
  ipcMain.handle('modal:addFilter', addFilter)

  //////// HANDLE FILTER SUBMIT BUTTON ////////
  ipcMain.on('submit-filter', async (event, filter) => {
    // Check that input values are not empty.
    if (filter['name'] !== null && filter['tids'].length > 0) {
      // Insert new filter and return auto-incremented fid.
      let fid = await insertFilter(filter['name'])
      // Associate new filter with relevant Tags.
      for (let t = 0; t < filter['tids'].length; t++) {
        // Run INSERT statement on each tag selection from checklist.
        await insertFilterTag(fid.lastID, filter['tids'][t])
      }
      // Update filter dropdown list on mainWindow.
      let filterOpt = { 'name': filter['name'], 'fid': fid.lastID }
      await mainWindow.webContents.send('add-filter', filterOpt)
    }
  })

  //////// MAIN WINDOW TRIGGER ////////
  // Initialize and create the main window.
  createWindow()
  // Handle window initialization on macOS.
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
// Keep app open on macOS due to how it handles app quit functionality.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

//////// ADD GAME MODAL WINDOW ////////
// Function to handle the "Add Game" button.
async function addGame() {
  let addGameModal = new BrowserWindow({
    width: 600,
    height: 300,
    modal: true,
    parent: mainWindow,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'assets/renderers/preload.js')
    }
  })
  addGameModal.on('closed', () => {
    addGameModal = null
  })
  // Retrieve tags to display in addGame modal select dropdown.
  let tags = await getAllFromTable("tags")

  addGameModal.loadFile(path.join(__dirname, 'assets/modals/addGame.html'))
    .then(() => { addGameModal.webContents.send('existing-tags', tags) })
  addGameModal.on('ready-to-show', () => {
    addGameModal.show()
  })
  // addGameModal.webContents.openDevTools()
}

//////// ADD TAG MODAL WINDOW ////////
// Function to handle the "Add Tag" button.
async function addTag() {
  let addTagModal = new BrowserWindow({
    width: 600,
    height: 300,
    modal: true,
    parent: mainWindow,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'assets/renderers/preload.js')
    }
  })
  addTagModal.on('closed', () => {
    addTagModal = null
  })

  addTagModal.loadFile(path.join(__dirname, 'assets/modals/addTag.html'))

  addTagModal.on('ready-to-show', () => {
    addTagModal.show()
  })
}

//////// EDIT GAME MODAL WINDOW ////////
// Function to handle the "Edit" button.
async function editGame(gameData) {
  let editGameModal = new BrowserWindow({
    width: 600,
    height: 300,
    modal: true,
    parent: mainWindow,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'assets/renderers/preload.js')
    }
  })

  editGameModal.on('closed', () => {
    editGameModal = null
  })

  let tags = await getAllFromTable("tags")
  editGameModal.loadFile(await path.join(__dirname, 'assets/modals/editGame.html'))
    .then(() => { editGameModal.webContents.send('existing-tags', tags) })
    .then(() => { editGameModal.webContents.send('edit-game-data', gameData) })

  editGameModal.on('ready-to-show', async () => {
    await editGameModal.show()
  })
  // editGameModal.webContents.openDevTools()
}

//////// ADD FILTER MODAL WINDOW ////////
// Function to handle the "Add Filter" button.
async function addFilter() {
  let addFilterModal = new BrowserWindow({
    width: 500,
    height: 400,
    modal: true,
    parent: mainWindow,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'assets/renderers/preload.js')
    }
  })

  addFilterModal.on('closed', () => {
    addFilterModal = null
  })

  // Retrieve tags to display in addFilter modal checklist.
  let tags = await getAllFromTable("tags")

  addFilterModal.loadFile(path.join(__dirname, 'assets/modals/addFilter.html'))
    .then(() => { addFilterModal.webContents.send('existing-tags', tags) })

  addFilterModal.on('ready-to-show', () => {
    addFilterModal.show()
  })
}

//////// CONFIRM DELETION MODAL ////////
async function confirmDelete() {
  let options = {
    buttons: ['Yes', 'Cancel'],
    message: 'Are you sure you want to delete this game? (Action cannot be undone!)'
  }
  let res = await dialog.showMessageBox(mainWindow, options)
  return res.response
}

///////////////////////////////////
/////// DATABASE OPERATIONS ///////
///////////////////////////////////

//////// INITIALIZE DATABASE WITH DEFAULT SCHEMA AND VALUES ////////
async function initDB() {
  const db = await getDBDriver()
  // Open database connection
  await db.open()

  ///////////////////////////////
  /////// DATABASE SCHEMA ///////
  ///////////////////////////////

  // Create library schema.
  await db.exec(`CREATE TABLE IF NOT EXISTS library(
                  lid            INTEGER   PRIMARY KEY AUTOINCREMENT,
                  name           TEXT  NOT NULL)`
        )
  // Create games schema.
  await db.exec(`CREATE TABLE IF NOT EXISTS games(
                  gid            INTEGER   PRIMARY KEY AUTOINCREMENT,
                  name           TEXT  NOT NULL,
                  release_date   DATE,
                  platform       TEXT,
                  developer      TEXT,
                  publisher      TEXT)`
        )
  // Create tags schema.
  await db.exec(`CREATE TABLE IF NOT EXISTS tags(
                  tid            INTEGER   PRIMARY KEY AUTOINCREMENT,
                  name           TEXT  UNIQUE NOT NULL)`
        )
  // Create associative schema to connect games and tags.
  await db.exec(`CREATE TABLE IF NOT EXISTS game_tags(
                  gtid           INTEGER   PRIMARY KEY AUTOINCREMENT,
                  gid            INTEGER   NOT NULL,
                  tid            INTEGER   NOT NULL,
                  FOREIGN KEY(gid) REFERENCES games(gid),
                  FOREIGN KEY(tid) REFERENCES tags(tid))`
        )
  // Create filters schema.
  await db.exec(`CREATE TABLE IF NOT EXISTS filters(
                  fid            INTEGER   PRIMARY KEY AUTOINCREMENT,
                  name           TEXT      UNIQUE NOT NULL)`
        )
  // Create associative schema to connect filters and tags.
  await db.exec(`CREATE TABLE IF NOT EXISTS filter_tags(
                  ftid           INTEGER   PRIMARY KEY AUTOINCREMENT,
                  fid            INTEGER   NOT NULL,
                  tid            INTEGER   NOT NULL,
                  FOREIGN KEY(fid) REFERENCES filters(fid),
                  FOREIGN KEY(tid) REFERENCES tags(tid))`
        )

  //////////////////////////////////////
  ////////// INSERT TEST DATA //////////
  //////////////////////////////////////

  // LIBRARY.
  await db.run("INSERT OR IGNORE INTO library (lid,name) VALUES (1,'Default')")

  // TAGS.
  const cats = ['All', 'Action', 'Adventure', 'Casual', 'FPS', 'Indie',
    'RPG', 'Simulation', 'Sports', 'Stealth', 'Strategy',
    'Survival'];
  const stmt = await db.prepare("INSERT OR IGNORE INTO tags (tid,name) VALUES (?,?)")
  for (let i = 0; i < cats.length; i++) {
    await stmt.run(i, cats[i])
  }
  await stmt.finalize()

  // GAMES.
  const gameStmt = await db.prepare("INSERT OR IGNORE INTO games (gid,name,release_date,platform,developer,publisher)" +
                "VALUES(?,?,?,?,?,?)")
  const gameArr = [
    [1,"Tiny Tina's Wonderlands",2022,"Epic","Gearbox","2K Games"],
    [2,"Total War: Warhammer III",2022,"Steam","Creative Assembly","Sega"],
    [3,"Vermintide 2",2017,"Steam","Fatshark","Fatshark"],
    [4,"World War Z",2019,"Epic","Saber Interactive","Saber Interactive"],
    [5,"Risk of Rain 2",2019,"Steam","Hopoo Games","Gearbox"],
    [6,"Settlement Survival",2021,"Steam","Gleamer Studio","Gleamer Studio"],
    [7,"Ghost Recon Breakpoint",2019,"uPlay","Ubisoft","Ubisoft"],
    [8,"Raft",2018,"Steam","Redbeet Interactive","Axolot Games"],
    [9,"Madden NFL 23",2022,"EA","EA Tiburon","Electronic Arts"],
    [10,"Stardew Valley",2016,"Steam","ConcernedApe","ConcernedApe"]
  ]
  for (let i = 0; i < gameArr.length; i++) {
    await gameStmt.run(gameArr[i])
    // Associate every game with the 'All' tag.
    await insertIntoGameTags(i, gameArr[i][0], 0)
  }
  await gameStmt.finalize()

  // GAME_TAGS.
  const tagIDs = [6,9,1,4,4,7,4,11,8,3]
  for (let i = 0; i < gameArr.length; i++) {
    await insertIntoGameTags((i + 10), gameArr[i][0], tagIDs[i])
  }

  // FILTERS.
  await db.run("INSERT OR IGNORE INTO filters (fid,name) VALUES (1,'All Games')")
  await db.run("INSERT OR IGNORE INTO filters (fid,name) VALUES (2,'Action Games')")
  await db.run("INSERT OR IGNORE INTO filters (fid,name) VALUES (3,'First-Person Shooters')")
  await db.run("INSERT OR IGNORE INTO filters (fid,name) VALUES (4,'Role Playing Games (RPG)')")
  await db.run("INSERT OR IGNORE INTO filters (fid,name) VALUES (5,'Action and RPGs')")
  // Associate default filters with filter_tags.
  await db.run("INSERT OR IGNORE INTO filter_tags (ftid,fid,tid) VALUES (1,1,0)")
  await db.run("INSERT OR IGNORE INTO filter_tags (ftid,fid,tid) VALUES (2,2,1)")
  await db.run("INSERT OR IGNORE INTO filter_tags (ftid,fid,tid) VALUES (3,3,4)")
  await db.run("INSERT OR IGNORE INTO filter_tags (ftid,fid,tid) VALUES (4,4,6)")
  // Two tags for this filter:
  await db.run("INSERT OR IGNORE INTO filter_tags (ftid,fid,tid) VALUES (5,5,1)")
  await db.run("INSERT OR IGNORE INTO filter_tags (ftid,fid,tid) VALUES (6,5,6)")
  // Close database connection.
  await db.close()
}

////////  RETRIEVE ALL ROW VALUES FROM SPECIFIED TABLE  ////////
async function getAllFromTable(table) {
  const db = await getDBDriver()
  await db.open()
  let query = `SELECT * FROM ${table}`;
  let result = []
  result = await db.all(query, [], (err, rows) => {
    if (err) return console.error(err)
    return rows
  })
  await db.close()
  return result
}

////////  RETRIEVE GAME USING `gid`  ////////
async function getGame(gid) {
  const db = await getDBDriver()
  await db.open()
  const game = await db.get(`SELECT * FROM games WHERE gid = '${gid}'`, (err, row) => {
    if (err) console.error(err)
    return row
  })
  await db.close()
  return game
}

////////  INSERT GAME INTO DATABASE  ////////
async function insertGame(gameData) {
  const db = await getDBDriver()
  await db.open()
  const stmt = await db.prepare(
            `INSERT INTO games (name,developer,publisher,release_date,platform)
              VALUES (?,?,?,?,?)`
            )
  let id = await stmt.run([
          gameData.name,
          gameData.developer,
          gameData.publisher,
          gameData.release_date,
          gameData.platform
        ],
        // Get the primary key ID of this inserted row.
        function () { return this.lastID }
      )
  await stmt.finalize()
  await db.close()
  return id
}

////////  RETRIEVE ROW FROM ID NAME/VALUE  ////////
async function getRowFromId(table, idName, id) {
  let result = {}
  const db = await getDBDriver()
  // Compose query.
  query = `SELECT * FROM ${table} WHERE ${idName} = '${id}'`
  await db.open()
  // Retrieve object from database.
  result = await db.get(query, [], (err, row) => {
    if (err) return console.error(err)
    return row
  })
  await db.close()
  return result
}

////////  INSERT INTO `game_tags` TABLE  ////////
async function insertIntoGameTags(gtid, gid, tid) {
  const db = await getDBDriver()
  await db.open()
  // Allow auto-increment when `gtid` not present.
  if (gtid !== null) {
    const stmt = await db.prepare("INSERT OR REPLACE INTO game_tags (gtid,gid,tid) VALUES (?,?,?)")
    await stmt.run([gtid, gid, tid])
    await stmt.finalize()
  } else {
    const stmt = await db.prepare("INSERT OR REPLACE INTO game_tags (gid,tid) VALUES (?,?)")
    await stmt.run([gid, tid])
    await stmt.finalize()
  }
  await db.close()
}

///////  RETRIEVE GAME TAGS AND APPEND THEM TO GAME OBJECT  ///////
async function getGameTags(gameObj) {
  const db = await getDBDriver()
  await db.open()
  const query = `SELECT t.name
                  FROM tags t
                  JOIN game_tags gt
                  ON t.tid = gt.tid
                  WHERE gt.gid = '${gameObj.gid}'`

  const tagArr = await db.all(query, (err, rows) => {
                                if (err) console.error(err)
                                return rows
                              })
  let tagNames = []
  // Remove object wrappers and place name values in flat array.
  for (let i = 0; i < tagArr.length; i++) {
    tagNames.push(tagArr[i].name)
  }
  gameObj.Tags = tagNames
  db.close()
  return gameObj
}

////////  INSERT NEW TAG  ////////
async function insertTag(tagName) {
  const db = await getDBDriver()
  await db.open()
  await db.exec(`INSERT OR IGNORE INTO tags (name) VALUES ('${tagName}')`)
  await db.close()
}

////////  GET TAG ID BY NAME  ////////
async function getTagIDs(gid) {
  const db = await getDBDriver()
  await db.open()
  let result = await db.get(`SELECT tid FROM game_tags
                             WHERE gid = '${gid}' AND tid != 0`,
      (err, row) => {
        if (err) console.error(err)
        return row
      })
  await db.close()
  return result
}

////////  DELETE GAME FROM DATABASE  ////////
async function deleteGame(gid) {
  const db = await getDBDriver()
  await db.open()
  await db.exec(`DELETE FROM games WHERE gid = ${gid}`)
  await db.close()
}

////////  UPDATE GAME VALUES  ////////
async function updateGame(gameData) {
  const db = await getDBDriver()
  await db.open()
  bindValues = [gameData['name'],
                gameData['developer'],
                gameData['publisher'],
                gameData['release_date'],
                gameData['platform'],
                gameData['gid']]
  const stmt = await db.prepare("UPDATE games SET name=?, " +
                                "developer=?, " +
                                "publisher=?, " +
                                "release_date=?, " +
                                "platform=? " +
                                "WHERE gid = ?")
  await stmt.bind(bindValues)
  await stmt.run()
  await stmt.finalize()
  await db.close()
}

////////  UPDATE GAME TAG  ////////
async function updateGameTag(gameData) {
  const db = await getDBDriver()
  await db.open()
  // Return game_tag row by gid where tid is not 0 (i.e. not 'All').
  let query = `UPDATE game_tags SET tid = '${gameData['genre']}'
               WHERE gid = '${gameData['gid']}' AND tid != 0`
  await db.exec(query, (cb) => {
    console.error(cb)
  })
  await db.close()
}

////////  GET TAG NAME BY TAG ID  ////////
async function getTagById(tid) {
  const db = await getDBDriver()
  await db.open()
  let tagName = await db.get(`SELECT name FROM tags WHERE tid = ${tid} AND tid != 0`, (err, row) => {
    if (err) console.error(err)
    return row
  })
  await db.close()
  return tagName
}

////////  GET TAG IDS BY FILTER ID  ////////
async function getTidsByFids(fid) {
  const db = await getDBDriver()
  await db.open()
  const stmt = await db.prepare("SELECT tid FROM filter_tags WHERE fid = ?")
  const results = await stmt.all([fid], (err, rows) => {
    if (err) console.error(err)
    return rows
  })
  await stmt.finalize()
  await db.close()
  return results
}

////////  GET GAME IDS BY TAG IDS  ////////
async function getGidsByTids(tid) {
  const db = await getDBDriver()
  await db.open()
  const stmt = await db.prepare("SELECT gid FROM game_tags WHERE tid = ?")
  const results = await stmt.all([tid], (err, rows) => {
    if (err) console.error(err)
    return rows
  })
  await stmt.finalize()
  await db.close()
  return results
}

////////  INSERT NEW FILTER  ////////
// Also returns the auto-incremented `fid` of the newly inserted filter.
async function insertFilter(name) {
  const db = await getDBDriver()
  await db.open()
  let stmt = await db.prepare("INSERT OR IGNORE INTO filters (name) VALUES (?)")
  const id = await stmt.run([name], function() { return this.lastID })
  await stmt.finalize()
  await db.close()
  return id
}

////////  ASSOCIATE FILTER WITH TAGS  ////////
// Also returns the auto-incremented `fid` of the newly inserted filter.
async function insertFilterTag(fid, tid) {
  const db = await getDBDriver()
  await db.open()
  let stmt = await db.prepare("INSERT OR IGNORE INTO filter_tags (fid,tid) VALUES (?,?)")
  await stmt.run([fid, tid])
  await stmt.finalize()
  await db.close()
}
