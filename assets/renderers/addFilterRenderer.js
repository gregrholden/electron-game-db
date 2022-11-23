// Handle Populating Checklist with existing Tags.
window.libraryAPI.handleExistingTags((event, tags) => {
  // Get the fieldset element.
  const tagsChecklist = document.getElementById('tagsChecklist')
  // Start from 1 to skip default 'All' tag.
  for (let i = 1; i < tags.length; i++) {
    // Create wrapper div.
    let option = document.createElement('div')
    // Create checkbox input.
    let tagVal = document.createElement('input')
    tagVal.setAttribute('type', 'checkbox')
    tagVal.setAttribute('value', tags[i].tid)
    tagVal.setAttribute('id', tags[i].tid)
    option.appendChild(tagVal)
    // Create label for checkbox.
    let label = document.createElement('label')
    label.setAttribute('for', tags[i].tid)
    let labelText = document.createTextNode(tags[i].name)
    label.appendChild(labelText)
    option.appendChild(label)
    // Add new entry to the fieldset.
    tagsChecklist.appendChild(option)
  }
})

const submitFilterBtn = document.getElementById('submitFilterBtn')
// Provide submission functionality on the modal form.
submitFilterBtn.addEventListener('click', async () => {
  let name = document.getElementById('name').value
  let checked = []
  let inputs = document.getElementsByTagName('input')
  for (let i = 0; i < inputs.length; i++) {
    if (inputs[i].type == 'checkbox') {
      if (inputs[i].checked) {
        checked.push(inputs[i].value)
      }
    }
  }
  let filter = { 'name': name, 'tids': checked }
  await window.libraryAPI.handleSubmitFilter(filter)
})
