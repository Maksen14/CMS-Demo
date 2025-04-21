document.addEventListener("DOMContentLoaded", function() {
  const editableElements = document.querySelectorAll("[contenteditable]");
  const editButton = document.getElementById("edit-toggle");
  const saveButton = document.getElementById("save-content");
  const editImagesButton = document.getElementById("edit-images-button");

  // Function to get current page name (default to 'index')
  function getPageName() {
    const path = window.location.pathname;
    const page = path.substring(path.lastIndexOf('/') + 1).split('.')[0];
    return page || 'index';
  }
  
  const pageName = getPageName();

  // Check auth status and hide edit button if not authenticated
  fetch('/api/auth-status')
    .then(response => response.json())
    .then(data => {
      if (!data.authenticated) {
        if (editButton) editButton.style.display = "none";
        if (editImagesButton) editImagesButton.style.display = "none";
      } else {
        if (editButton) editButton.style.display = "flex";
        if (editImagesButton) editImagesButton.style.display = "flex";
      }
    })
    .catch(err => console.error('Error checking auth status:', err));

  // Load content from the server for the current page via API
  fetch('/api/content?page=' + pageName)
    .then(response => response.json())
    .then(data => {
      // Update site title if it exists
      const siteTitle = document.getElementById("site-title");
      if (siteTitle) {
        // Only update title if data.title exists and is not undefined
        if (data.title && data.title !== "undefined") {
          siteTitle.innerHTML = `${data.title}`;
        } else {
          // Keep the default content with just the restaurant name
          siteTitle.innerHTML = 'La Bella Cucina';
        }
      }

      // Update content if it exists
      const content = document.getElementById("content");
      if (content) content.innerHTML = data.content;

      // Update footer if it exists
      const footerText = document.getElementById("footer-text");
      if (footerText) footerText.innerHTML = data.footer;

      // Set page title
      document.title = pageName === 'reservations-admin' ? 
        'La Bella Cucina - Manage Reservations' : 
        (data.title || "La Bella Cucina");
    })
    .catch(err => console.error('Error loading content:', err));

  // Toggle edit mode when "Edit Content" is clicked
  if (editButton) {
  editButton.addEventListener("click", () => {
      const isEditing = editableElements[0]?.getAttribute("contenteditable") === "true";
    editableElements.forEach(el => {
      el.setAttribute("contenteditable", !isEditing);
      el.style.border = !isEditing ? "1px solid #ccc" : "none";
    });
    editButton.style.display = "none";
      saveButton.style.display = "flex";
      if (editImagesButton) editImagesButton.style.display = "flex";
  });
  }

  // Save content by posting updated data for the current page to the server API
  if (saveButton) {
  saveButton.addEventListener("click", () => {
    const newContent = {
      page: pageName,
        title: document.getElementById("site-title")?.innerHTML || document.title,
        content: document.getElementById("content")?.innerHTML || "",
        footer: document.getElementById("footer-text")?.innerHTML || ""
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
        editButton.style.display = "flex";
      saveButton.style.display = "none";
    })
    .catch(err => {
      console.error('Error saving content:', err);
      alert('Error saving content. Are you logged in?');
    });
  });
  }
});

// Check authentication status
async function checkAuth() {
  try {
    const response = await fetch('/api/auth-status');
    const data = await response.json();
    return data.authenticated;
  } catch (error) {
    console.error('Error checking auth status:', error);
    return false;
  }
}

// Function to update UI based on authentication status
async function updateAuthUI() {
  const isAuthenticated = await checkAuth();
  
  // Add authenticated class to body
  if (isAuthenticated) {
    document.body.classList.add('authenticated');
  } else {
    document.body.classList.remove('authenticated');
  }
  
  // Update footer login/logout buttons
  const footerLoginLink = document.getElementById('footer-login-link');
  const footerLogoutLink = document.getElementById('footer-logout-link');
  
  if (footerLoginLink && footerLogoutLink) {
    if (isAuthenticated) {
      footerLoginLink.style.display = 'none';
      footerLogoutLink.style.display = 'block';
    } else {
      footerLoginLink.style.display = 'block';
      footerLogoutLink.style.display = 'none';
    }
  }
  
  // Show/hide admin controls
  const adminControls = document.querySelectorAll('.admin-controls');
  adminControls.forEach(control => {
    control.style.display = isAuthenticated ? 'block' : 'none';
  });
  
  // Show/hide edit buttons
  const editButtons = document.querySelectorAll('.edit-button');
  editButtons.forEach(button => {
    button.style.display = isAuthenticated ? 'block' : 'none';
  });

  // Update navigation login/logout buttons
  const navLogoutLink = document.getElementById('logout-link');
  const mobileNavLogoutLink = document.getElementById('mobile-logout-link');
  
  // Get all admin links in regular and mobile navs
  const reservationsAdminLinks = document.querySelectorAll('a[href="reservations-admin.html"]');

  // Handle logout links - completely hide them when not authenticated
  if (navLogoutLink) {
    navLogoutLink.style.display = isAuthenticated ? 'inline-block' : 'none';
  }
  
  if (mobileNavLogoutLink) {
    mobileNavLogoutLink.style.display = isAuthenticated ? 'block' : 'none';
  }

  // Handle admin links - completely hide them when not authenticated
  reservationsAdminLinks.forEach(link => {
    link.style.display = isAuthenticated ? 'inline-block' : 'none';
  });
}

// Load content from the server
async function loadContent() {
  try {
    const page = window.location.pathname.split('/').pop() || 'index';
    const response = await fetch(`/api/content?page=${page}`);
    const data = await response.json();
    
    // Update title
    document.title = data.title || 'La Bella Cucina';
    
    // Update content
    const contentDiv = document.getElementById('content');
    if (contentDiv) {
      contentDiv.innerHTML = data.content;
    }
    
    // Update footer
    const footerText = document.getElementById('footer-text');
    if (footerText) {
      footerText.textContent = data.footer;
    }

    // Update hero image if it exists
    const heroImage = document.getElementById('hero-image');
    if (heroImage && data.heroImage) {
      heroImage.src = data.heroImage;
    }

    // Update UI based on auth status
    await updateAuthUI();
  } catch (error) {
    console.error('Error loading content:', error);
  }
}

// Handle content editing
let isEditing = false;

function setupEditToggle() {
  const editToggle = document.getElementById('edit-toggle');
  const saveContent = document.getElementById('save-content');
  const editImagesButton = document.getElementById('edit-images-button');
  const contentDiv = document.getElementById('content');
  
  if (editToggle && saveContent && contentDiv) {
    editToggle.addEventListener('click', () => {
      isEditing = true;
      contentDiv.contentEditable = true;
      editToggle.style.display = 'none';
      saveContent.style.display = 'flex';
      if (editImagesButton) editImagesButton.style.display = 'flex';
    });

    saveContent.addEventListener('click', async () => {
      isEditing = false;
      contentDiv.contentEditable = false;
      editToggle.style.display = 'flex';
      saveContent.style.display = 'none';

      // Save content to server
      try {
        const page = window.location.pathname.split('/').pop() || 'index';
        const response = await fetch('/api/content', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            page,
            content: contentDiv.innerHTML,
            title: document.title,
            footer: document.getElementById('footer-text').textContent
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save content');
        }
      } catch (error) {
        console.error('Error saving content:', error);
        alert('Failed to save content. Please try again.');
      }
    });
  }
}

// Handle hero image upload
// Hero image upload functionality removed

function setupImageEditing() {
  // Get the edit images button
  const editImagesButton = document.getElementById('edit-images-button');
  
  // Skip if button doesn't exist
  if (!editImagesButton) return;

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 hidden z-50 overflow-y-auto';
  modal.innerHTML = `
    <div class="min-h-screen px-2 py-6 sm:px-4 sm:py-8 flex items-center justify-center">
      <div class="bg-white rounded-lg w-full max-w-5xl">
        <div class="p-3 sm:p-6">
          <div class="flex justify-between items-center mb-4 sm:mb-6">
            <h2 class="text-xl sm:text-2xl font-bold text-gray-800">Edit Images</h2>
            <button class="text-gray-500 hover:text-gray-700 p-2" id="close-modal">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
          <div id="images-loading" class="py-12 text-center text-gray-500 hidden">
            <i class="fas fa-spinner fa-spin text-3xl mb-3"></i>
            <p>Loading images...</p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6" id="images-grid"></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Function to create image card
  function createImageCard(img, isHeroImage = false, altText = '', forceUpdate = false) {
    const card = document.createElement('div');
    card.className = 'bg-gray-50 rounded-lg p-3 sm:p-4 flex flex-col h-full';
    
    if (isHeroImage) {
      const heroTitle = document.createElement('div');
      heroTitle.className = 'font-semibold text-blue-600 mb-2 text-sm sm:text-base';
      heroTitle.innerText = 'Hero Image';
      card.appendChild(heroTitle);
    } else {
      // Add empty div to maintain consistent height with hero image card
      const spacer = document.createElement('div');
      spacer.className = 'mb-2 h-5';
      card.appendChild(spacer);
    }
    
    const imgContainer = document.createElement('div');
    imgContainer.className = 'flex-grow mb-3 sm:mb-4 relative';
    
    const imgPreview = document.createElement('img');
    imgPreview.src = img.src;
    imgPreview.className = 'w-full h-32 sm:h-48 object-cover rounded-lg';
    imgPreview.alt = img.alt || altText;
    
    // Add loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'absolute inset-0 bg-gray-800 bg-opacity-70 rounded-lg flex items-center justify-center hidden';
    loadingOverlay.innerHTML = '<i class="fas fa-spinner fa-spin text-white text-2xl"></i>';
    
    imgContainer.appendChild(imgPreview);
    imgContainer.appendChild(loadingOverlay);
    card.appendChild(imgContainer);
    
    const uploadLabel = document.createElement('label');
    uploadLabel.className = 'block w-full bg-white text-gray-700 px-3 py-2 text-sm sm:text-base rounded-lg border border-gray-300 hover:bg-gray-50 cursor-pointer text-center mt-auto';
    uploadLabel.innerHTML = '<i class="fas fa-camera mr-1 sm:mr-2"></i>Change Image';
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.className = 'hidden';
    
    uploadLabel.appendChild(fileInput);
    card.appendChild(uploadLabel);
    
    // Handle image upload
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      // Check file type
      if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
        alert('Please select a valid image file (JPEG, PNG, or WEBP)');
        return;
      }

      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }
      
      // Get the cleanest version of the path by removing any query params
      const oldImagePath = img.src.split('?')[0]; 
      
      // Check if this is the hero image
      const isHeroImage = img.id === 'hero-image';
      
      console.log('Sending image path to server:', oldImagePath);
      console.log('Is hero image:', isHeroImage);
      
      const formData = new FormData();
      formData.append('images', file);
      formData.append('oldImagePath', oldImagePath);
      formData.append('isHeroImage', isHeroImage);
      formData.append('altText', img.alt || altText || '');
      formData.append('forceUpdate', forceUpdate || 'true'); // Allow upload even if image not found in content
      
      try {
        // Show loading indicator
        loadingOverlay.classList.remove('hidden');
        
        const response = await fetch('/api/upload-content-images', {
          method: 'POST',
          body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Upload failed');
        }
        
        if (data.imagePaths && data.imagePaths.length > 0) {
          const newImagePath = data.imagePaths[0];
          console.log('New image path:', newImagePath);
          
          // Update both the content image and the preview
          img.src = newImagePath + '?t=' + Date.now();
          imgPreview.src = newImagePath + '?t=' + Date.now();
          
          // Save the content to persist the change
          await saveContentAfterImageUpdate();
          
          alert('Image uploaded successfully!');
        }
      } catch (error) {
        console.error('Error uploading image:', error);
        alert(error.message || 'Failed to upload image. Please try again.');
      } finally {
        // Hide loading indicator
        loadingOverlay.classList.add('hidden');
      }
    });
    
    return card;
  }

  // Function to save content after image update
  async function saveContentAfterImageUpdate() {
    try {
      const page = window.location.pathname.split('/').pop() || 'index';
      const contentDiv = document.getElementById('content');
      
      const response = await fetch('/api/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page,
          content: contentDiv?.innerHTML || '',
          title: document.title,
          footer: document.getElementById('footer-text')?.textContent || ''
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save content');
      }
      
      console.log('Content saved after image update');
    } catch (error) {
      console.error('Error saving content after image update:', error);
    }
  }

  // Function to show modal with all images
  function showImageModal() {
    const imagesGrid = document.getElementById('images-grid');
    const imagesLoading = document.getElementById('images-loading');
    
    // Show loading indicator
    imagesGrid.innerHTML = '';
    imagesLoading.classList.remove('hidden');
    modal.classList.remove('hidden');
    
    // Small delay to allow loading indicator to show
    setTimeout(() => {
      try {
        // Add the hero image if it exists
        const heroImage = document.getElementById('hero-image');
        if (heroImage) {
          const heroCard = createImageCard(heroImage, true);
          imagesGrid.appendChild(heroCard);
        }
        
        // Get all images from the content
        let foundImages = false;
        
        // First check the main content div
        const contentDiv = document.querySelector('#content');
        if (contentDiv) {
          const contentImages = contentDiv.querySelectorAll('img:not(#hero-image)');
          if (contentImages.length > 0) {
            foundImages = true;
            contentImages.forEach(img => {
              const card = createImageCard(img);
              imagesGrid.appendChild(card);
            });
          }
        }
        
        // Also check for images in the menu sections
        const menuSections = document.querySelectorAll('.menu-section');
        if (menuSections.length > 0) {
          menuSections.forEach(section => {
            const menuImages = section.querySelectorAll('img');
            if (menuImages.length > 0) {
              foundImages = true;
              menuImages.forEach(img => {
                const card = createImageCard(img);
                imagesGrid.appendChild(card);
              });
            }
          });
        }
        
        if (!foundImages && !heroImage) {
          alert('No images found in the content.');
          modal.classList.add('hidden');
          return;
        }
      } finally {
        // Hide loading indicator when done
        imagesLoading.classList.add('hidden');
      }
    }, 100);
  }

  // Event listeners
  editImagesButton.addEventListener('click', showImageModal);
  
  document.getElementById('close-modal').addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
    }
  });

  // Update auth UI to show/hide edit images button
  const originalUpdateAuthUI = window.updateAuthUI;
  window.updateAuthUI = function(isAuthenticated) {
    originalUpdateAuthUI(isAuthenticated);
    editImagesButton.style.display = isAuthenticated ? 'flex' : 'none';
  };
}

// Mobile navigation
function setupMobileNav() {
  const mobileMenuButton = document.getElementById('mobile-menu-button');
  const mobileMenu = document.getElementById('mobile-menu');
  
  if (mobileMenuButton && mobileMenu) {
    // Use direct click handler with stopPropagation
    mobileMenuButton.addEventListener('click', function(event) {
      // Prevent event from bubbling up
      event.stopPropagation();
      
      // Toggle the mobile menu visibility
      mobileMenu.classList.toggle('hidden');
      
      // Toggle between hamburger and close icons
      if (mobileMenu.classList.contains('hidden')) {
        mobileMenuButton.innerHTML = '<i class="fas fa-bars text-2xl"></i>';
      } else {
        mobileMenuButton.innerHTML = '<i class="fas fa-times text-2xl"></i>';
      }
    });
    
    // Close menu when clicking on a link
    const mobileLinks = mobileMenu.querySelectorAll('a');
    mobileLinks.forEach(link => {
      link.addEventListener('click', function() {
        mobileMenu.classList.add('hidden');
        mobileMenuButton.innerHTML = '<i class="fas fa-bars text-2xl"></i>';
      });
    });
    
    // Close menu when clicking outside of it
    document.addEventListener('click', function(event) {
      // Don't close if clicking on the menu itself or the menu button
      if (mobileMenu.contains(event.target) || mobileMenuButton.contains(event.target)) {
        return;
      }
      
      // Only close if menu is currently open
      if (!mobileMenu.classList.contains('hidden')) {
        mobileMenu.classList.add('hidden');
        mobileMenuButton.innerHTML = '<i class="fas fa-bars text-2xl"></i>';
      }
    });
  }
}

// Setup menu tabs functionality
function setupMenuTabs() {
  // Select all menu tab buttons
  const tabButtons = document.querySelectorAll('.menu-tab');
  
  if (tabButtons.length === 0) {
    return; // Don't set up event listeners if no tabs exist
  }
  
  // Get all category sections by their IDs
  const tabSections = document.querySelectorAll('[id^="starters"],[id^="main"],[id^="pasta"],[id^="desserts"],[id^="drinks"],[id^="boisson"]');
  
  // Hide all sections except the first one (default)
  tabSections.forEach((section, index) => {
    if (index !== 0) {
      section.style.display = 'none';
    }
  });
  
  // Add click event to each tab button
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      // Remove active class from all buttons
      tabButtons.forEach(btn => {
        btn.classList.remove('active-tab', 'text-red-600', 'border-b-2', 'border-red-600');
      });
      
      // Add active class to clicked button
      this.classList.add('active-tab', 'text-red-600', 'border-b-2', 'border-red-600');
      
      // Hide all sections
      tabSections.forEach(section => {
        section.style.display = 'none';
      });
      
      // Show the section that corresponds to the clicked tab
      const targetId = this.getAttribute('data-target');
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.style.display = 'block';
      }
    });
  });
  
  // Activate the first tab by default
  if (tabButtons.length > 0) {
    tabButtons[0].classList.add('active-tab', 'text-red-600', 'border-b-2', 'border-red-600');
  }
}

// Setup delete dish functionality
function setupDeleteDishButtons() {
  const deleteButtons = document.querySelectorAll('.delete-dish-btn');
  if (deleteButtons.length > 0) {
    deleteButtons.forEach(button => {
      button.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const dishId = this.getAttribute('data-dish-id');
        if (!dishId) return;
        
        // Show confirmation dialog
        if (confirm('Are you sure you want to delete this dish? This cannot be undone.')) {
          try {
            const response = await fetch('/api/menu-dish', {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ dishId }),
            });
            
            if (!response.ok) {
              throw new Error('Failed to delete dish');
            }
            
            // Remove dish from UI
            const dishElement = this.closest('.menu-item');
            if (dishElement) {
              dishElement.remove();
            }
            
          } catch (error) {
            console.error('Error deleting dish:', error);
            alert('Failed to delete dish. Please try again.');
          }
        }
      });
    });
  }
}

// Initialize menu page features
function initMenuPage() {
  // Check if we're on the menu page
  const contentDiv = document.querySelector('#content');
  if (!contentDiv || !window.location.pathname.includes('menu')) return;
  
  fetch('/api/content?page=menu')
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      if (!data || !data.content) {
        throw new Error('Invalid menu data received');
      }
      
      // Parse the content
      const parser = new DOMParser();
      const doc = parser.parseFromString(data.content, 'text/html');
      
      // Get the introduction section
      const introSection = doc.querySelector('section.mb-8');
      
      // Get the menu categories section
      const menuSection = doc.querySelector('section.space-y-10');
      
      // Extract categories from the menu section
      const categories = [];
      const sections = menuSection.querySelectorAll('[id]');
      sections.forEach(section => {
        if (section.id && section.querySelector('h3')) {
          categories.push({
            id: section.id,
            title: section.querySelector('h3').textContent
          });
        }
      });
      
      // Only create tabs if we have categories and tabs don't already exist
      if (categories.length > 0 && !document.querySelector('.menu-tabs-container')) {
        // Create tabs HTML
        let tabsHTML = `
          <div class="mb-10">
            <div class="flex flex-wrap justify-center mb-6 border-b border-gray-200">
        `;
        
        categories.forEach((category, index) => {
          const isActive = index === 0 ? 'active-tab text-red-600 border-b-2 border-red-600' : '';
          tabsHTML += `<button class="menu-tab px-5 py-3 font-medium text-lg focus:outline-none transition-colors hover:text-red-600 ${isActive}" data-target="${category.id}">${category.title}</button>`;
        });
        
        tabsHTML += `
            </div>
            
            <!-- Dietary Key -->
            <div class="flex flex-wrap justify-center gap-4 mb-8 text-sm text-gray-600">
              <div class="flex items-center">
                <span class="w-4 h-4 inline-block mr-1 text-green-600"><i class="fas fa-leaf"></i></span>
                <span>Vegetarian</span>
              </div>
              <div class="flex items-center">
                <span class="w-4 h-4 inline-block mr-1 text-green-700"><i class="fas fa-seedling"></i></span>
                <span>Vegan</span>
              </div>
              <div class="flex items-center">
                <span class="w-4 h-4 inline-block mr-1 text-yellow-600"><i class="fas fa-wheat-awn-circle-exclamation"></i></span>
                <span>Gluten-Free</span>
              </div>
              <div class="flex items-center">
                <span class="w-4 h-4 inline-block mr-1 text-red-500"><i class="fas fa-pepper-hot"></i></span>
                <span>Spicy</span>
              </div>
              <div class="flex items-center">
                <span class="w-4 h-4 inline-block mr-1 text-blue-500"><i class="fas fa-star"></i></span>
                <span>Chef's Special</span>
              </div>
            </div>
          </div>
        `;
        
        // Create a container for the menu content
        const menuContainer = document.createElement('div');
        
        // First add the introduction
        if (introSection) {
          menuContainer.appendChild(introSection.cloneNode(true));
        }
        
        // Then add the tabs
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'menu-tabs-container';
        tabsContainer.innerHTML = tabsHTML;
        menuContainer.appendChild(tabsContainer);
        
        // Then add the menu sections
        menuContainer.appendChild(menuSection.cloneNode(true));
        
        // Replace content with our reorganized structure
        contentDiv.innerHTML = '';
        contentDiv.appendChild(menuContainer);
      } else {
        // Just insert the content as is
        contentDiv.innerHTML = data.content;
      }
      
      // Setup tab functionality
      setupMenuTabs();
      
      // Fix category IDs to match dropdown values
      fixCategoryIds();
      
      // Show admin controls if authenticated
      checkAuth().then(isAuthenticated => {
        if (isAuthenticated) {
          // Make delete buttons visible
          const deleteButtons = document.querySelectorAll('.delete-dish-btn');
          deleteButtons.forEach(button => {
            button.style.display = 'block';
          });
        }
      });
    })
    .catch(error => {
      console.error('Error loading menu content:', error);
      contentDiv.innerHTML = '<p class="text-center text-red-600 my-12">Error loading menu. Please try again later.</p>';
    });
}

// Function to fix category IDs
function fixCategoryIds() {
  // Get all category sections
  const sections = document.querySelectorAll('[id]');
  
  // Create a mapping for problematic IDs
  const idMapping = {
    'pasta-risotto': 'pasta',
    'main-courses': 'mains'
  };
  
  // Update IDs
  sections.forEach(section => {
    if (section.id in idMapping) {
      // Store the old ID
      const oldId = section.id;
      // Set the new ID
      section.id = idMapping[oldId];
      
      // Find the tab that points to the old ID
      const tab = document.querySelector(`.menu-tab[data-target="${oldId}"]`);
      if (tab) {
        // Update the tab to point to the new ID
        tab.setAttribute('data-target', idMapping[oldId]);
      }
    }
  });
}

// Handle transparent navbar on scroll
function setupTransparentNavbar() {
  const navbar = document.querySelector('nav');
  
  // Only apply to pages with the transparent navbar class
  if (!navbar || !navbar.classList.contains('navbar-transparent')) return;
  
  // Function to handle scroll
  function handleScroll() {
    if (window.scrollY > 50) {
      navbar.classList.add('navbar-scrolled');
    } else {
      navbar.classList.remove('navbar-scrolled');
    }
  }
  
  // Add scroll event listener
  window.addEventListener('scroll', handleScroll);
  
  // Call handleScroll on page load (in case the page is loaded already scrolled)
  handleScroll();
}

function setupScrollAnimations() {
  // Set up animations on both index and about pages
  const currentPath = window.location.pathname;
  console.log('Current path:', currentPath); // Debug path detection
  
  // Check if we're on index or about page
  if (currentPath.endsWith('index.html') || 
      currentPath === '/' || 
      currentPath === '' || 
      currentPath.includes('about') || 
      currentPath.endsWith('about.html')) {
    
    console.log('Setting up animations for path:', currentPath); // Debug log
    
    // Create an observer with options
    const observerOptions = {
      root: null, // Use the viewport as the root
      rootMargin: '0px', // No margin
      threshold: 0.1 // Trigger when 10% of the element is visible
    };

    // Create callback function that adds 'show' class to elements when they become visible
    const observerCallback = (entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('show');
          // Once the animation has played, no need to observe it anymore
          observer.unobserve(entry.target);
        }
      });
    };

    // Create the Intersection Observer
    const observer = new IntersectionObserver(observerCallback, observerOptions);

    // Special handling specifically for about page
    if (currentPath.includes('about') || currentPath.endsWith('about.html')) {
      console.log('Applying about page specific animations');
      
      function setupAboutPageAnimations() {
        // First handle hero sections with background images - no animation for container
        const heroSections = document.querySelectorAll('section.hero-section, section[class*="bg-cover"], section[style*="background-image"]');
        heroSections.forEach((hero) => {
          console.log('Found hero section:', hero.className);
          
          // Remove any animation classes from the hero container itself
          hero.classList.remove('fade-in', 'fade-in-up', 'fade-in-down', 'zoom-in');
          hero.style.opacity = '1';
          hero.style.transform = 'none';
          hero.style.transition = 'none';
          
          // Only animate child elements inside the hero section
          const heroHeadings = hero.querySelectorAll('h1, h2, h3');
          heroHeadings.forEach((heading, i) => {
            heading.classList.add('fade-in-down');
            heading.classList.add(`delay-${(i % 5 + 1) * 100}`);
            observer.observe(heading);
          });
          
          const heroParagraphs = hero.querySelectorAll('p');
          heroParagraphs.forEach((paragraph, i) => {
            paragraph.classList.add('fade-in');
            paragraph.classList.add(`delay-${(i % 5 + 2) * 100}`);
            observer.observe(paragraph);
          });
          
          const heroButtons = hero.querySelectorAll('a.bg-white, a.bg-red-600, a.rounded-full, .btn, button');
          heroButtons.forEach((button, i) => {
            button.classList.add('fade-in-up');
            button.classList.add(`delay-${(i % 5 + 3) * 100}`);
            observer.observe(button);
          });
        });
        
        // Special handling for "À PROPOS DE NOUS" section
        const aproposSections = Array.from(document.querySelectorAll('section')).filter(sect => {
          const heading = sect.querySelector('h1, h2');
          return heading && (
            heading.textContent.includes('PROPOS DE NOUS') || 
            heading.textContent.includes('À PROPOS') ||
            heading.textContent.includes('ABOUT US')
          );
        });
        
        aproposSections.forEach(sect => {
          console.log('Found À PROPOS DE NOUS section');
          
          // Remove any animation classes from the section itself
          sect.classList.remove('fade-in', 'fade-in-up', 'fade-in-down', 'zoom-in');
          sect.style.opacity = '1';
          sect.style.transform = 'none';
          sect.style.transition = 'none';
          
          // If has background image, ensure it's fixed
          if (sect.style.backgroundImage || window.getComputedStyle(sect).backgroundImage !== 'none') {
            sect.style.backgroundAttachment = 'fixed';
          }
          
          // Only animate text elements
          const headings = sect.querySelectorAll('h1, h2, h3');
          headings.forEach((el, i) => {
            el.classList.add('fade-in-down');
            el.classList.add(`delay-${(i % 5 + 1) * 100}`);
            observer.observe(el);
          });
          
          const paragraphs = sect.querySelectorAll('p');
          paragraphs.forEach((el, i) => {
            el.classList.add('fade-in');
            el.classList.add(`delay-${(i % 5 + 2) * 100}`);
            observer.observe(el);
          });
          
          // Ensure images are not animated
          const images = sect.querySelectorAll('img');
          images.forEach(img => {
            img.style.opacity = '1';
            img.style.transform = 'none';
            img.style.transition = 'none';
          });
        });
        
        // Special handling for quote sections with black backgrounds
        const quoteSections = document.querySelectorAll('.quote-section, blockquote');
        quoteSections.forEach((quote) => {
          // For sections with black background
          if (quote.classList.contains('bg-black')) {
            console.log('Found quote section with black background');
            
            // Don't animate the container
            quote.classList.remove('fade-in', 'fade-in-up', 'fade-in-down', 'zoom-in');
            quote.style.opacity = '1';
            quote.style.transform = 'none';
            quote.style.transition = 'none';
            
            // Only animate the text content
            const quoteText = quote.querySelector('.quote-text, p, h2, h3');
            if (quoteText) {
              quoteText.classList.add('fade-in');
              quoteText.classList.add('delay-200');
              observer.observe(quoteText);
            }
          } else {
            // For quotes without black background, animate normally
            quote.classList.add('fade-in');
            quote.classList.add('delay-300');
            observer.observe(quote);
          }
        });

        // Handle any other standard content sections
        const otherSections = document.querySelectorAll('section:not(.hero-section):not([style*="background-image"]):not(.quote-section)');
        otherSections.forEach((section, index) => {
          // Don't animate sections with background images
          if (section.style.backgroundImage || 
              window.getComputedStyle(section).backgroundImage !== 'none' ||
              section.classList.contains('bg-cover')) {
            section.style.opacity = '1';
            section.style.transform = 'none';
            section.style.transition = 'none';
          } else {
            // Standard animation for regular sections
            section.classList.add('fade-in');
            section.classList.add(`delay-${(index % 5 + 1) * 100}`);
            observer.observe(section);
          }
        });
      }
      
      // Call the setup function after a short delay to ensure DOM is loaded
      setTimeout(setupAboutPageAnimations, 300);
      
      // Also set up a mutation observer to catch dynamically loaded content
      const contentObserver = new MutationObserver(() => {
        console.log('Content changed, reapplying about page animations');
        setTimeout(setupAboutPageAnimations, 300);
      });
      
      const contentElement = document.querySelector('#content');
      if (contentElement) {
        contentObserver.observe(contentElement, { childList: true, subtree: true });
      }
    }
    // Standard animation setup for other pages (like index)
    else {
      // Apply animations directly to elements already in the DOM
      function applyAnimationsToContent() {
        console.log('Applying animations to content'); // Debug animation loading
        
        const contentDiv = document.querySelector('#content');
        if (!contentDiv) {
          console.log('Content div not found, retrying soon'); // Debug content loading
          setTimeout(applyAnimationsToContent, 500);
          return;
        }
        
        // Add animation classes based on content structure
        const sections = contentDiv.querySelectorAll('section');
        console.log('Found sections:', sections.length); // Debug sections found
        
        if (sections.length === 0) {
          // If no sections found yet, try again after a short delay
          setTimeout(applyAnimationsToContent, 500);
          return;
        }
        
        sections.forEach((section, index) => {
          // Add basic fade-in animation to sections
          section.classList.add('fade-in');
          
          // Add a delay based on the position
          if (index > 0) {
            section.classList.add(`delay-${(index % 5 + 1) * 100}`);
          }
          
          // Observe section for animation
          observer.observe(section);
          
          // Add animations to section elements
          const headings = section.querySelectorAll('h1, h2, h3');
          const paragraphs = section.querySelectorAll('p');
          const images = section.querySelectorAll('img');
          const buttons = section.querySelectorAll('button, .button, a.bg-red-600, a.rounded-full');
          
          // Add fade-in-down to headings
          headings.forEach((heading, i) => {
            heading.classList.add('fade-in-down');
            heading.classList.add(`delay-${(i % 5 + 1) * 100}`);
            observer.observe(heading);
          });
          
          // Add fade-in to paragraphs
          paragraphs.forEach((paragraph, i) => {
            paragraph.classList.add('fade-in');
            paragraph.classList.add(`delay-${(i % 5 + 2) * 100}`);
            observer.observe(paragraph);
          });
          
          // Add zoom-in to images
          images.forEach((image, i) => {
            image.classList.add('zoom-in');
            image.classList.add(`delay-${(i % 5 + 1) * 100}`);
            observer.observe(image);
          });
          
          // Add fade-in-up to buttons
          buttons.forEach((button, i) => {
            button.classList.add('fade-in-up');
            button.classList.add(`delay-${(i % 5 + 3) * 100}`);
            observer.observe(button);
          });
          
          // Special handling for grid layouts
          const gridItems = section.querySelectorAll('.grid > div');
          gridItems.forEach((item, i) => {
            // Alternate between left and right animations
            if (i % 2 === 0) {
              item.classList.add('fade-in-left');
            } else {
              item.classList.add('fade-in-right');
            }
            item.classList.add(`delay-${(i % 5 + 1) * 100}`);
            observer.observe(item);
          });
        });
      }
      
      // Call the animation application function with a delay to ensure content is loaded
      setTimeout(applyAnimationsToContent, 300);
      
      // Also set up a mutation observer to catch any dynamically added content
      const contentObserver = new MutationObserver(() => {
        console.log('Content changed, reapplying animations');
        setTimeout(applyAnimationsToContent, 300);
      });
      
      // Start observing content changes
      const contentElement = document.querySelector('#content');
      if (contentElement) {
        contentObserver.observe(contentElement, { childList: true, subtree: true });
      }
    }
  }
}

function initializePage() {
  updateAuthUI();
  loadContent();
  setupEditToggle();
  setupImageEditing();
  setupMobileNav();
  setupTransparentNavbar();
  setupScrollAnimations();
  
  // Page-specific initializations
  const pathname = window.location.pathname;
  if (pathname.includes('menu.html')) {
    setupMenuTabs();
    setupDeleteDishButtons();
    initMenuPage();
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', initializePage);
