document.addEventListener("DOMContentLoaded", function() {
  const editableElements = document.querySelectorAll("[contenteditable]");
  const editButton = document.getElementById("edit-toggle");
  const saveButton = document.getElementById("save-content");

  // Check auth status and hide edit button if not authenticated
  fetch('/api/auth-status')
    .then(response => response.json())
    .then(data => {
      if (!data.authenticated) {
        editButton.style.display = "none";
      }
    })
    .catch(err => console.error('Error checking auth status:', err));

  // Load content from the server via API
  fetch('/api/content')
    .then(response => response.json())
    .then(data => {
      document.getElementById("site-title").innerHTML = data.title;
      document.getElementById("content").innerHTML = data.content;
      document.getElementById("footer-text").innerHTML = data.footer;
    })
    .catch(err => console.error('Error loading content:', err));

  // Toggle edit mode when "Edit Content" is clicked
  editButton.addEventListener("click", () => {
    const isEditing = editableElements[0].getAttribute("contenteditable") === "true";
    editableElements.forEach(el => {
      el.setAttribute("contenteditable", !isEditing);
      el.style.border = !isEditing ? "1px solid #ccc" : "none";
    });
    editButton.style.display = "none";
    saveButton.style.display = "inline-block";
  });

  // Save content by posting updated data to the server API
  saveButton.addEventListener("click", () => {
    const newContent = {
      title: document.getElementById("site-title").innerHTML,
      content: document.getElementById("content").innerHTML,
      footer: document.getElementById("footer-text").innerHTML
    };

    fetch('/api/content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newContent)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Unauthorized or error saving content.');
      }
      return response.json();
    })
    .then(result => {
      alert(result.message);
      editableElements.forEach(el => {
        el.setAttribute("contenteditable", "false");
        el.style.border = "none";
      });
      editButton.style.display = "inline-block";
      saveButton.style.display = "none";
    })
    .catch(err => {
      console.error('Error saving content:', err);
      alert('Error saving content. Are you logged in?');
    });
  });
});
