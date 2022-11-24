// Handle Populating Checklist with existing Tags.
window.libraryAPI.handleExistingFilters((event, filters) => {
  // Get the fieldset element.
  const tagsChecklist = document.getElementById('tagsChecklist')
  // Start from 1 to skip default 'All' tag.
  for (let i = 1; i < filters.length; i++) {
    // Create wrapper div.
    let option = document.createElement('div')
    // Create checkbox input.
    let filterVal = document.createElement('input')
    filterVal.setAttribute('type', 'checkbox')
    filterVal.setAttribute('value', filters[i].fid)
    filterVal.setAttribute('id', filters[i].fid)
    option.appendChild(filterVal)
    // Create label for checkbox.
    let label = document.createElement('label')
    label.setAttribute('for', filters[i].fid)
    let labelText = document.createTextNode(filters[i].name)
    label.appendChild(labelText)
    option.appendChild(label)
    // Add new entry to the fieldset.
    tagsChecklist.appendChild(option)
  }
})

const submitFilterRmvBtn = document.getElementById('submitFilterRmvBtn')
// Provide submission functionality on the modal form.
submitFilterRmvBtn.addEventListener('click', async () => {
  let checked = []
  let inputs = document.getElementsByTagName('input')
  for (let i = 0; i < inputs.length; i++) {
    if (inputs[i].type == 'checkbox') {
      if (inputs[i].checked) {
        checked.push(inputs[i].value)
      }
    }
  }
  await window.libraryAPI.handleSubmitRmvFilters(checked)
})
