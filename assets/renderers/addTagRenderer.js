const submitTagBtn = document.getElementById('submitTagBtn')
// Provide submission functionality on the modal form.
submitTagBtn.addEventListener('click', async () => {
  let tagName = document.getElementById('name').value
  await window.libraryAPI.handleSubmitTagBtn(tagName)
})
