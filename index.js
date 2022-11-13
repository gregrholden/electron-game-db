// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const windowStateKeeper = require('electron-window-state')
const sqlite3 = require('sqlite3').verbose()
const { open } = require('sqlite')
const path = require('path')
const DATABASE = './assets/gameDB.sqlite';

let mainWindow

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
  let tags = await getAllFromTable("tags")
  let views = await getAllFromTable("views")

  // Load the index.html file of the app and pass initial data to renderer.
  mainWindow.loadFile(path.join(__dirname, 'index.html'))
    .then(() => { mainWindow.webContents.send('existing-libs', libs) })
    .then(() => { mainWindow.webContents.send('existing-games', games) })
    .then(() => { mainWindow.webContents.send('existing-tags', tags) })
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
  // Modal window to add a new game.
  ipcMain.handle('modal:addGame', addGame)
  // Event handler for when a new game is submitted via the above modal.
  ipcMain.on('submitGame', (event, gameData) => {
    // Insert new game into database.
    insertGame(gameData)
    // Then update the library on the renderer.
    mainWindow.webContents.send('update-games', gameData)
  })
  // Initialize and create the main window.
  createWindow()
  // Handle window initialization on macOS.
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
// Handle app close operation on macOS.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// Function to handle the "Add Game" button.
async function addGame() {
  let addGameModal = new BrowserWindow({
    width: 600,
    height: 300,
    modal: true,
    parent: mainWindow,
    webPreferences: {
      preload: path.join(__dirname, 'assets/renderers/preload.js')
    }
  })
  addGameModal.on('closed', () => {
    addGameModal = null
  })
  addGameModal.loadFile(path.join(__dirname, 'assets/modals/addGame.html'))
  addGameModal.on('ready-to-show', () => {
    addGameModal.show()
  })
}

///////////////////////////////////
/////// DATABASE OPERATIONS ///////
///////////////////////////////////

// Initialize SQLite3 database with default schema and values.
async function initDB() {
  // Establish DB connection config.
  const db = await open({
    filename: DATABASE,
    driver: sqlite3.Database
  })
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
          "rating         INT)"
        )
  // Create tags schema.
  await db.exec("CREATE TABLE IF NOT EXISTS tags(" +
          "tid            INTEGER   PRIMARY KEY AUTOINCREMENT," +
          "name           TEXT  UNIQUE NOT NULL)"
        )
  // Create associative schema to connect games and tags.
  await db.exec("CREATE TABLE IF NOT EXISTS game_tags(" +
          "gid            INT," +
          "tid            INT," +
          "FOREIGN KEY(gid) REFERENCES games(gid)," +
          "FOREIGN KEY(tid) REFERENCES tags(tid))"
        )
  // Create views schema.
  await db.exec("CREATE TABLE IF NOT EXISTS views(" +
          "vid            INTEGER   PRIMARY KEY AUTOINCREMENT," +
          "lid            INT," +
          "tid            INT," +
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

// Using SELECT statement, return all values from specified table.
async function getAllFromTable(table) {
  let result = []
  // DB connection config.
  const db = await open({
    filename: DATABASE,
    driver: sqlite3.Database
  })
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

async function insertGame(gameData) {
  // DB connection config.
  const db = await open({
    filename: DATABASE,
    driver: sqlite3.Database
  })
  await db.open()
  const stmt = await db.prepare(
          "INSERT INTO games (name,developer,publisher,release_date,platform)" +
          " VALUES (?,?,?,?,?)"
        )
  await stmt.run(
          gameData.name,
          gameData.developer,
          gameData.publisher,
          gameData.release_date,
          gameData.platform
        )
  await stmt.finalize()
  await db.close()
}