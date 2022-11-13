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
  let views = await getAllFromTable("views")

  // Load the index.html file of the app and pass initial data to renderer.
  mainWindow.loadFile(path.join(__dirname, 'index.html'))
    .then(() => { mainWindow.webContents.send('existing-libs', libs) })
    .then(() => { mainWindow.webContents.send('existing-games', games_with_tags) })
    .then(() => { mainWindow.webContents.send('existing-views', views) })
    .then(() => { mainWindow.show() })

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

  //////// ADD GAME MODAL TRIGGER ////////
  // Modal window to add a new game.
  ipcMain.handle('modal:addGame', addGame)

  //////// INSERT NEW GAME ////////
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
        await insertIntoGameTags(gid.lastID, 0)
        // Associate new game with user-selected Tag.
        await insertIntoGameTags(gid.lastID, gameData.tag)
        // Add array of Tag names associated with the new game to the object.
        newGameData = await getGameTags(newGameData)
        mainWindow.webContents.send('update-games', newGameData)
      } else {
        console.log("Nothing to update!")
      }
    }
  })

  //////// ADD TAG MODAL TRIGGER ////////
  // Modal window to add a new game.
  ipcMain.handle('modal:addTag', addTag)

  //////// INSERT NEW TAG ////////
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

// Initialize SQLite3 database with default schema and values.
async function initDB() {
  const db = await getDBDriver()
  // Open database connection
  await db.open()
  // Create library schema.
  await db.exec("CREATE TABLE IF NOT EXISTS library(" +
          "lid            INTEGER   PRIMARY KEY AUTOINCREMENT," +
          "name           TEXT  NOT NULL)"
        )
  // Create games schema.
  await db.exec("CREATE TABLE IF NOT EXISTS games(" +
          "gid            INTEGER   PRIMARY KEY AUTOINCREMENT," +
          "name           TEXT  NOT NULL," +
          "image_url      Varchar(128)," +
          "release_date   Date," +
          "platform       TEXT," +
          "exe_url        Varchar(128)," +
          "developer      TEXT," +
          "publisher      TEXT," +
          "rating         INTEGER)"
        )
  // Create tags schema.
  await db.exec("CREATE TABLE IF NOT EXISTS tags(" +
          "tid            INTEGER   PRIMARY KEY AUTOINCREMENT," +
          "name           TEXT  UNIQUE NOT NULL)"
        )
  // Create associative schema to connect games and tags.
  await db.exec("CREATE TABLE IF NOT EXISTS game_tags(" +
          "gtid           INTEGER PRIMARY KEY AUTOINCREMENT," +
          "gid            INTEGER," +
          "tid            INTEGER," +
          "FOREIGN KEY(gid) REFERENCES games(gid)," +
          "FOREIGN KEY(tid) REFERENCES tags(tid))"
        )
  // Create views schema.
  await db.exec("CREATE TABLE IF NOT EXISTS views(" +
          "vid            INTEGER   PRIMARY KEY AUTOINCREMENT," +
          "lid            INTEGER," +
          "tid            INTEGER," +
          "name           TEXT UNIQUE NOT NULL," +
          "FOREIGN KEY(lid) REFERENCES library(lid)," +
          "FOREIGN KEY(tid) REFERENCES tags(tid))"
        )
  // Add default library.
  await db.run("INSERT OR IGNORE INTO library (lid,name) VALUES (1,'Default')")
  // Add selection of standard tags.
  const cats = ['All', 'Action', 'Adventure', 'Casual', 'FPS', 'Indie',
                'RPG', 'Simulation', 'Sports', 'Stealth', 'Strategy',
                'Survival'];
  const stmt = await db.prepare("INSERT OR IGNORE INTO tags (tid,name) VALUES (?,?)")
  for (let i = 0; i < cats.length; i++) {
    await stmt.run(i, cats[i])
  }
  await stmt.finalize()
  // Add default view.
  await db.run("INSERT OR IGNORE INTO views (vid,lid,tid,name) VALUES (1,1,0,'Default')")
  // Close database connection.
  await db.close()
}

////////  SELECT * FROM `table`  ////////
// Using SELECT statement, return all values from specified table.
async function getAllFromTable(table) {
  const db = await getDBDriver()
  let result = []
  // Our composed query.
  query = "SELECT * FROM " + table;
  // Open DB connection.
  await db.open()
  // Assign results of our query to our result variable (or display error).
  result = await db.all(query, [], (err, rows) => {
    if (err) return console.error(err)
    return rows
  })
  // Close DB connection.
  await db.close()
  // Return our resulting array.
  return result
}

////////  INSERT INTO games () VALUES ()  ///////
// Insert new game into database.
async function insertGame(gameData) {
  const db = await getDBDriver()
  await db.open()
  const stmt = await db.prepare(
          "INSERT INTO games (name,developer,publisher,release_date,platform)" +
          " VALUES (?,?,?,?,?)"
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

//////// SELECT * FROM `table` WHERE `idName` = '`id`' ////////
// Retrieve specified table row from provided primary key ID.
async function getRowFromId(table, idName, id) {
  let result = {}
  const db = await getDBDriver()
  // Compose query.
  query = "SELECT * FROM " + table + " WHERE " + idName + " = '" + id + "'"
  await db.open()
  // Retrieve object from database.
  result = await db.get(query, [], (err, row) => {
    if (err) return console.error(err)
    return row
  })
  await db.close()
  return result
}

//////// INSERT INTO game_tags (gid,tid) VALUES (`gid`,`tid`) ////////
// Associate newly added game with 'All' Tag.
async function insertIntoGameTags(gid, tid) {
  const db = await getDBDriver()
  await db.open()
  const stmt = await db.prepare("INSERT INTO game_tags (gid,tid) VALUES (?,?)")
  await stmt.run([gid, tid])
  await stmt.finalize()
  await db.close()
}

//////// SELECT t.name FROM tags t
////////  JOIN game_tags gt
////////  ON t.tid = gt.tid
////////  WHERE gt.gid = `gameObj.gid`
// Retrieve game_tag names and append them to game object.
async function getGameTags(gameObj) {
  const db = await getDBDriver()
  await db.open()
  const query = "SELECT t.name FROM tags t " +
                  "JOIN game_tags gt " +
                  "ON t.tid = gt.tid " +
                  "WHERE gt.gid = '" + gameObj.gid + "'"

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

//////// INSERT NEW TAG ////////
// Insert a new tag into the database.
async function insertTag(tagName) {
  const db = await getDBDriver()
  await db.open()
  await db.exec("INSERT INTO tags (name) VALUES ('" + tagName + "')")
  await db.close()
}

async function deleteGame(gid) {
  const db = await getDBDriver()
  await db.open()
  await db.exec("DELETE FROM games WHERE gid = " + gid)
  await db.close()
}
