//////////////////////////////////////
///// HANDLE EDIT GAME OPERATION /////
//////////////////////////////////////
const submitEditsBtn = document.getElementById('submitEdits')
submitEditsBtn.addEventListener('click', async () => {
  const gid = document.getElementById('gid').value
  const name = document.getElementById('name').value
  const developer = document.getElementById('developer').value
  const publisher = document.getElementById('publisher').value
  const release_date = document.getElementById('release_date').value
  const platform = document.getElementById('platform').value
  const image_url = document.getElementById('image_url').value
  const exe_url = document.getElementById('exe_url').value
  const rating = document.getElementById('rating').value
  const genre = document.getElementById('genre').value
  gameData = {
              "gid": gid,
              "name": name,
              "developer": developer,
              "publisher": publisher,
              "release_date": release_date,
              "platform": platform,
              "image_url": image_url,
              "exe_url": exe_url,
              "rating": rating,
              "genre": genre,
            }
  await window.libraryAPI.handleSubmitEditsBtn(gameData)
})

// Handle Populating Select Dropdown with existing Tags.
window.libraryAPI.handleExistingTags(async (event, tags) => {
  const tagsDropdown = await document.getElementById('genre')
  // Start from 1 to skip default 'All' tag.
  for (let i = 1; i < tags.length; i++) {
    let option = await document.createElement('option')
    await option.setAttribute('value', tags[i].tid)
    let optionText = await document.createTextNode(tags[i].name)
    await option.appendChild(optionText)
    await tagsDropdown.appendChild(option)
  }
})

// Populate Edit Window with values of game selected.
window.libraryAPI.handleEditGameData((event, gameData) => {
  document.getElementById('gid').value = gameData.gid
  document.getElementById('name').value = gameData.name
  document.getElementById('developer').value = gameData.developer
  document.getElementById('publisher').value = gameData.publisher
  document.getElementById('release_date').value = gameData.release_date
  document.getElementById('platform').value = gameData.platform
  document.getElementById('image_url').value = gameData.image_url
  document.getElementById('exe_url').value = gameData.exe_url
  document.getElementById('rating').value = gameData.rating
  document.getElementById('genre').value = gameData.genre.tid
})
