///////////////////////////////////
///// HANDLE LIBRARY CREATION /////
///////////////////////////////////
const libTable = document.getElementById('gameTable')
let tableHeaders = new Array()
tableHeaders = ['Game','Developer','Publisher','Release Date','Platform','Tags', ' ',' ']
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
    emptyTable.appendChild(createGameRow(games[g]))
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
  await window.libraryAPI.handleAddGameBtn()
})

////////////////////////////////////////////////
///// HANDLE UPDATE GAME LIBRARY OPERATION /////
////////////////////////////////////////////////
window.libraryAPI.handleUpdateGames((event, game) => {
  if (document.getElementById('gameLib') !== null) {
    let gameLib = document.getElementById('gameLib')
    // Append new row to the game library table.
    gameLib.appendChild(createGameRow(game))
  } else {
    // Should never reach here as the table is always created at app init.
    console.error("Cannot add game: HTML table does not exist!")
  }
})

///////////////////////////////////
///// HANDLE ADD TAG BUTTON ///////
///////////////////////////////////
const addTagBtn = document.getElementById('addTagBtn')
// Open a modal with the form to submit a new game.
addTagBtn.addEventListener('click', async () => {
  await window.libraryAPI.handleAddTagBtn()
})

//////////////////////////////////////////////
///// HANDLE REMOVE ROW AFTER DELETION ///////
//////////////////////////////////////////////
window.libraryAPI.handleRemoveGameRow((event, gid) => {
  // Table rows use `gid` in row ID for easy identification.
  document.getElementById('row-id-' + gid).remove()
})

///////////////////////////////////////////////
///// HANDLE UPDATE GAME ROW AFTER EDIT ///////
///////////////////////////////////////////////
window.libraryAPI.handleUpdateGameRow((event, gameData) => {
  document.getElementById(`name-${gameData['gid']}`).innerText = gameData['name']
  document.getElementById(`developer-${gameData['gid']}`).innerText = gameData['developer']
  document.getElementById(`publisher-${gameData['gid']}`).innerText = gameData['publisher']
  document.getElementById(`release_date-${gameData['gid']}`).innerText = gameData['release_date']
  document.getElementById(`platform-${gameData['gid']}`).innerText = gameData['platform']
  document.getElementById(`genre-${gameData['gid']}`).innerText = gameData['genre'].name
})

//////////////////////////////
///// CREATE TABLE ROW ///////
//////////////////////////////
function createGameRow(game) {
  // Append new row to the game library table.
  let row = document.createElement("tr")
  // Assign `gid` to row ID to easily identify row for update/delete operations.
  row.setAttribute('id', `row-id-${game['gid']}`)
  // Game.
  let nameCell = row.insertCell(0)
  nameCell.setAttribute('id', `name-${game['gid']}`)
  let nameText = document.createTextNode(game['name'])
  nameCell.appendChild(nameText)
  // Developer.
  let devCell = row.insertCell(1)
  devCell.setAttribute('id', `developer-${game['gid']}`)
  let devText = document.createTextNode(game['developer'])
  devCell.appendChild(devText)
  // Publisher.
  let pubCell = row.insertCell(2)
  pubCell.setAttribute('id', `publisher-${game['gid']}`)
  let pubText = document.createTextNode(game['publisher'])
  pubCell.appendChild(pubText)
  // Release Date.
  let relCell = row.insertCell(3)
  relCell.setAttribute('id', `release_date-${game['gid']}`)
  let relText = document.createTextNode(game['release_date'])
  relCell.appendChild(relText)
  // Platform.
  let platCell = row.insertCell(4)
  platCell.setAttribute('id', `platform-${game['gid']}`)
  let platText = document.createTextNode(game['platform'])
  platCell.appendChild(platText)
  // Tags.
  let tagCell = row.insertCell(5)
  tagCell.setAttribute('id', `genre-${game['gid']}`)
  let tagText = document.createTextNode(game['Tags'].slice(1))
  tagCell.appendChild(tagText)
  // Edit Button.
  let editCell = row.insertCell(6)
  let editBtn = document.createElement("button")
  editBtn.setAttribute('id', game['gid'])
  editBtn.setAttribute('class', 'editBtn')
  editBtn.innerText = "Edit"
  editCell.appendChild(editBtn)
  editBtn.addEventListener('click', async (event) => {
    await window.libraryAPI.handleEditGameBtn(event.target.id)
  })
  // Delete Button.
  let delCell = row.insertCell(7)
  let delBtn = document.createElement("button")
  // Give delete button the ID the game targeted for deletion.
  delBtn.setAttribute('id', game['gid'])
  delBtn.setAttribute('class', 'deleteBtn')
  delBtn.innerText = "Delete"
  delCell.appendChild(delBtn)
  delBtn.addEventListener('click', async (event) => {
    await window.libraryAPI.handleGameDeleteBtn(event.target.id)
  })

  return row
}
