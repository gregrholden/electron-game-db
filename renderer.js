///////////////////////////////////
///// HANDLE LIBRARY CREATION /////
///////////////////////////////////
const libTable = document.getElementById('gameTable')
let tableHeaders = new Array()
tableHeaders = ['Game','Developer','Publisher','Release Date','Platform','Tags']
// Invoke the exposed libraryAPI.
window.libraryAPI.handleExistingGames((event, games) => {
  // Initialize new table and its headers.
  let emptyTable = document.createElement("table")
  emptyTable.setAttribute('id', 'gameLib')
  let tr1 = emptyTable.insertRow(-1)
  // Create table headers.
  for (let h = 0; h < tableHeaders.length; h++) {
    let th = document.createElement('th')
    th.innerHTML = tableHeaders[h]
    tr1.appendChild(th)
  }
  // Create table rows.
  for (let g = 0; g < games.length; g++) {
    // Create a new row.
    let tr2 = emptyTable.insertRow(-1)
    // Game.
    let game = document.createElement('td')
    game.innerHTML = games[g].name
    tr2.appendChild(game)
    // Developer.
    let dev = document.createElement('td')
    dev.innerHTML = games[g].developer
    tr2.appendChild(dev)
    // Publisher
    let pub = document.createElement('td')
    pub.innerHTML = games[g].publisher
    tr2.appendChild(pub)
    // Release Date.
    let rel = document.createElement('td')
    rel.innerHTML = games[g].release_date
    tr2.appendChild(rel)
    // Platform.
    let plat = document.createElement('td')
    plat.innerHTML = games[g].platform
    tr2.appendChild(plat)
  }
  // Append the dynamic table from above to our gameTable div on index.html.
  libTable.appendChild(emptyTable)
})

///////////////////////////////////
///// HANDLE ADD GAME BUTTON //////
///////////////////////////////////
const addGameBtn = document.getElementById('addGameBtn')
// Open a modal with the form to submit a new game.
addGameBtn.addEventListener('click', async () => {
  const newWindow = await window.libraryAPI.handleAddGameBtn()
})

/////////////////////////////////////
///// HANDLE ADD GAME OPERATION /////
/////////////////////////////////////
window.libraryAPI.handleUpdateGames((event, game) => {
  if (document.getElementById('gameLib') !== null) {
    let gameLib = document.getElementById('gameLib')
    // Create new row at the end of our game library table.
    let row = gameLib.insertRow(-1)
    // Game.
    let nameCell = row.insertCell(0)
    let nameText = document.createTextNode(game.name)
    nameCell.appendChild(nameText)
    // Developer.
    let devCell = row.insertCell(1)
    let devText = document.createTextNode(game.developer)
    devCell.appendChild(devText)
    // Publisher.
    let pubCell = row.insertCell(2)
    let pubText = document.createTextNode(game.publisher)
    pubCell.appendChild(pubText)
    // Release Date.
    let relCell = row.insertCell(3)
    let relText = document.createTextNode(game.release_date)
    relCell.appendChild(relText)
    // Platform.
    let platCell = row.insertCell(4)
    let platText = document.createTextNode(game.platform)
    platCell.appendChild(platText)
  } else {
    console.log("Cannot add game: 'gameLib' table does not yet exist!")
  }
})