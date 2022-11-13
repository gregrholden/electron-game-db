const submitGameBtn = document.getElementById('submitGameBtn')
// Provide submission functionality on the modal form.
submitGameBtn.addEventListener('click', async () => {
  let game = document.getElementById('name').value
  let developer = document.getElementById('developer').value
  let publisher = document.getElementById('publisher').value
  let release_date = document.getElementById('release_date').value
  let platform = document.getElementById('platform').value
  const gameData = {
    "name": game, "developer": developer, "publisher": publisher,
    "release_date": release_date, "platform": platform
  }
  await window.libraryAPI.handleSubmitGameBtn(gameData)
})
