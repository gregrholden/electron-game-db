const submitGameBtn = document.getElementById('submitGameBtn')
// Provide submission functionality on the modal form.
submitGameBtn.addEventListener('click', async () => {
  let game = document.getElementById('name').value
  let developer = document.getElementById('developer').value
  let publisher = document.getElementById('publisher').value
  let release_date = document.getElementById('release_date').value
  let platform = document.getElementById('platform').value
  let tag = document.getElementById('tags_dropdown').value
  const gameData = {
    "name": game, "developer": developer, "publisher": publisher,
    "release_date": release_date, "platform": platform, "tag": tag
  }
  await window.libraryAPI.handleSubmitGameBtn(gameData)
})

// Handle Populating Select Dropdown with existing Tags.
window.libraryAPI.handleExistingTags((event, tags) => {
  const tagsDropdown = document.getElementById('tags_dropdown')
  // Start from 1 to skip default 'All' tag.
  for (let i = 1; i < tags.length; i++) {
    let option = document.createElement('option')
    option.setAttribute('value', tags[i].tid)
    let optionText = document.createTextNode(tags[i].name)
    option.appendChild(optionText)
    tagsDropdown.appendChild(option)
  }
})
