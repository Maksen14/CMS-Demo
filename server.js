const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const crypto = require('crypto');
const { JSDOM } = require('jsdom');
const nodemailer = require('nodemailer');
// Load environment variables from .env file
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const dataFile = path.join(__dirname, 'data.json');
const menuFile = path.join(__dirname, 'menu.json');
// Ensure the uploads directory exists
const uploadDir = path.join(__dirname, 'public', 'images');
const menuImagesDir = path.join(__dirname, 'public', 'images', 'menu');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(menuImagesDir)) {
  fs.mkdirSync(menuImagesDir, { recursive: true });
}

// Create placeholder menu images or copy from existing location if needed
const placeholderImages = [
  'bruschetta.jpg', 'calamari.jpg', 'arancini.jpg', 
  'margherita.jpg', 'diavola.jpg', 'funghi.jpg',
  'pasta-pomodoro.jpg', 'risotto.jpg', 'branzino.jpg',
  'cannoli.jpg', 'tiramisu.jpg', 'pannacotta.jpg',
  'placeholder.jpg' // Add a generic placeholder
];

// Create basic placeholder image content (a 1x1 transparent pixel base64 encoded)
const placeholderImageContent = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

placeholderImages.forEach(filename => {
  const destPath = path.join(menuImagesDir, filename);
  const sourcePath = path.join(__dirname, 'public', 'img', 'menu', filename);
  
  // If the file doesn't exist in the new location but exists in the old location, copy it
  if (!fs.existsSync(destPath) && fs.existsSync(sourcePath)) {
    try {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`Copied ${filename} to new location`);
    } catch (err) {
      console.error(`Error copying ${filename}:`, err);
    }
  }
  // If the file doesn't exist in either location, create a placeholder
  else if (!fs.existsSync(destPath)) {
    try {
      // Create a placeholder image
      fs.writeFileSync(destPath, placeholderImageContent);
      console.log(`Created placeholder image for ${filename}`);
    } catch (err) {
      console.error(`Error creating placeholder for ${filename}:`, err);
    }
  }
});

// Also copy any existing file from old menu directory that isn't in the placeholders list
if (fs.existsSync(path.join(__dirname, 'public', 'img', 'menu'))) {
  try {
    const oldMenuFiles = fs.readdirSync(path.join(__dirname, 'public', 'img', 'menu'));
    oldMenuFiles.forEach(filename => {
      if (!placeholderImages.includes(filename)) {
        const destPath = path.join(menuImagesDir, filename);
        const sourcePath = path.join(__dirname, 'public', 'img', 'menu', filename);
        
        if (!fs.existsSync(destPath)) {
          try {
            fs.copyFileSync(sourcePath, destPath);
            console.log(`Copied additional file ${filename} to new location`);
          } catch (err) {
            console.error(`Error copying additional file ${filename}:`, err);
          }
        }
      }
    });
  } catch (err) {
    console.error('Error reading old menu directory:', err);
  }
}

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    // Create a safe filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|webp)$/)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Single image upload for hero image
const uploadHero = upload.single('image');

// Multiple images upload for content images
const uploadContentImages = upload.array('images', 10);

// Configure multer for menu image uploads
const menuStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'public', 'images', 'menu');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'dish-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadMenuImage = multer({
  storage: menuStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
}).single('image');

// Session middleware setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'some-fallback-secret-key', // Use env var or fallback
  resave: false,
  saveUninitialized: true,
}));

// To parse JSON bodies
app.use(express.json());
// To parse URL-encoded bodies (for the login form)
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

/* --------------------------
   Rate Limiter for Login
-------------------------- */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: "Too many login attempts from this IP, please try again after 15 minutes."
});

/* --------------------------
   Authentication Endpoints
-------------------------- */

// Serve the login page with Tailwind styling
app.get('/login', (req, res) => {
    res.send(`<!DOCTYPE html>
  <html class="h-full bg-white">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sign in to your account</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="h-full">
    <div class="flex min-h-full flex-col justify-center px-6 py-12 lg:px-8">
      <div class="sm:mx-auto sm:w-full sm:max-w-sm">
        <img class="mx-auto h-10 w-auto" src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=600" alt="Your Company">
        <h2 class="mt-10 text-center text-2xl font-bold tracking-tight text-gray-900">Se connecter</h2>
      </div>
  
      <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <form class="space-y-6" action="/login" method="POST">
          <div>
            <div class="flex items-center justify-between">
              <label for="password" class="block text-sm font-medium text-gray-900">Password</label>
            </div>
            <div class="mt-2">
              <input type="password" name="password" id="password" autocomplete="current-password" required class="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:outline-indigo-600">
            </div>
          </div>
  
          <div>
            <button type="submit" class="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-indigo-600">Sign in</button>
          </div>
        </form>
  
        
      </div>
    </div>
  </body>
  </html>`);
  });
// Process login using rate limiting to prevent brute force attacks
app.post('/login', loginLimiter, (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    req.session.authenticated = true;
    res.redirect('/');
  } else {
    res.send('Incorrect password. <a href="/login">Try again</a>');
  }
});

// Logout endpoint
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Endpoint to check authentication status
app.get('/api/auth-status', (req, res) => {
  res.json({ authenticated: !!req.session.authenticated });
});

/* --------------------------
   API Endpoints for Content
-------------------------- */

app.get('/api/content', (req, res) => { 
  let page = req.query.page || 'index'; 
  // Supprimer l'extension .html si présente 
  page = page.replace('.html', '');

  // Special handling for reservations-admin page
  if (page === 'reservations-admin') {
    // Return a default content object for the reservations admin page
    return res.json({
      title: 'Manage Reservations',
      content: '',
      footer: '© 2025 La Bella Cucina. All rights reserved.',
      heroImage: ''
    });
  }

  if (page === 'menu') { 
    // Pour la page menu, lire le contenu dans menu.json 
    fs.readFile(menuFile, 'utf8', (err, data) => { 
      if (err) { 
        console.error("Erreur lors de la lecture du fichier menu.json:", err); 
        return res.status(500).json({ error: 'Erreur lors de la lecture du fichier menu.json' }); 
      } 
      try { 
        const menuContent = JSON.parse(data); 
        res.json(menuContent); 
      } 
      catch (parseError) { 
        console.error("Erreur lors du parsing de menu.json:", parseError); 
        res.status(500).json({ error: 'Erreur lors du parsing du fichier menu.json' }); 
      } 
    }); 
  } 
  else { 
    //Pour les autres pages, lire data.json 
    fs.readFile(dataFile, 'utf8', (err, data) => { 
      if (err) { 
        console.error('Erreur lors de la lecture du fichier data.json:', err); 
        return res.status(500).json({ error: 'Erreur lors de la lecture du fichier data.json' }); 
      } 
      try { 
        const content = JSON.parse(data); 
        if (content[page]) { 
          res.json(content[page]); 
        } else { 
          res.status(404).json({ error: 'Page non trouvée' }); 
        } 
      } 
      catch (parseError) { 
        console.error('Erreur lors du parsing du fichier data.json:', parseError); 
        res.status(500).json({ error: 'Erreur lors du parsing du fichier data.json' }); 
      } 
    }); 
  } 
});


// Middleware to protect routes that require authentication
function ensureAuthenticated(req, res, next) {
  if (req.session.authenticated) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized. Please log in.' });
}

// Protected endpoint to update content
app.post('/api/content', ensureAuthenticated, (req, res) => { let { page, title, content: pageContent, footer, heroImage } = req.body; page = (page || 'index').replace('.html', '');

if (page === 'menu') { 
  // Pour la page menu, mise à jour dans menu.json 
  fs.readFile(menuFile, 'utf8', (err, data) => { if (err) { console.error('Erreur lors de la lecture du fichier menu.json:', err); 
    return res.status(500).json({ error: 'Erreur lors de la lecture du fichier menu.json' }); }

  let menuData = {};
  try {
    menuData = JSON.parse(data);
  } catch (parseError) {
    console.error('Erreur lors du parsing du fichier menu.json:', parseError);
    return res.status(500).json({ error: 'Erreur lors du parsing du fichier menu.json' });
  }
  
  // Mettez à jour les propriétés souhaitées
  menuData.title = title || menuData.title || 'Menu';
  menuData.content = pageContent || menuData.content || '';
  menuData.footer = footer || menuData.footer || '';
  // Optionnel : si vous utilisez une image hero sur la page menu, la sauvegarder aussi
  menuData.heroImage = heroImage || menuData.heroImage || '';

  fs.writeFile(menuFile, JSON.stringify(menuData, null, 2), 'utf8', (err) => {
    if (err) {
      console.error('Error writing to menu.json:', err);
      return res.status(500).json({ error: 'Error writing to menu.json' });
    }
    res.json({ message: 'Menu content updated successfully!' });
  });
});
} else { 
  // Pour les autres pages, mise à jour dans data.json (code inchangé) 
  fs.readFile(dataFile, 'utf8', (err, data) => { if (err) { console.error('Erreur lors de la lecture du fichier data.json:', err); 
    return res.status(500).json({ error: 'Erreur lors de la lecture du fichier data.json' }); } 
    let allContent = {}; try { allContent = JSON.parse(data); } catch (parseError) { console.error('Erreur lors du parsing de data.json:', parseError); 
      return res.status(500).json({ error: 'Erreur lors du parsing du fichier data.json' }); }


  if (!allContent[page]) {
    allContent[page] = {};
  }
  
  allContent[page] = {
    ...allContent[page],
    title: title || allContent[page].title || 'Untitled',
    content: pageContent || allContent[page].content || '',
    footer: footer || allContent[page].footer || '',
    heroImage: heroImage || allContent[page].heroImage || ''
  };

  fs.writeFile(dataFile, JSON.stringify(allContent, null, 2), 'utf8', (err) => {
    if (err) {
      console.error('Error writing to data.json:', err);
      return res.status(500).json({ error: 'Error writing to data.json' });
    }
    res.json({ message: 'Content updated successfully!' });
  });
});
} });




// Endpoint to upload hero image
app.post('/api/upload-hero', ensureAuthenticated, (req, res) => {
  uploadHero(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const imagePath = `/images/${req.file.filename}`;
    
    // Update the hero image path in data.json
    fs.readFile(dataFile, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading data file:', err);
        return res.status(500).json({ error: 'Error reading data file' });
      }

      try {
        const content = JSON.parse(data);
        content[req.body.page].heroImage = imagePath;

        fs.writeFile(dataFile, JSON.stringify(content, null, 2), (err) => {
          if (err) {
            console.error('Error writing data file:', err);
            return res.status(500).json({ error: 'Error saving image path' });
          }
          res.json({ success: true, imagePath });
        });
      } catch (parseError) {
        console.error('Error parsing data file:', parseError);
        res.status(500).json({ error: 'Error parsing data file' });
      }
    });
  });
});

// Endpoint to upload content images
app.post('/api/upload-content-images', ensureAuthenticated, (req, res) => {
  uploadContentImages(req, res, function(err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'File upload error: ' + err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const imagePaths = req.files.map(file => 'images/' + file.filename);
    let oldImagePath = req.body.oldImagePath;
    const isHeroImage = req.body.isHeroImage === 'true';
    
    if (!oldImagePath) {
      return res.status(400).json({ error: 'Old image path not provided' });
    }
    
    // Get just the filename part if it's a full path
    const oldImageFilename = oldImagePath.split('/').pop();
    
    console.log('Received old path:', oldImagePath);
    console.log('Filename extracted:', oldImageFilename);
    console.log('New image path:', imagePaths[0]);
    console.log('Is hero image:', isHeroImage);
    
    // If it's the hero image, we can handle it directly without searching in content
    if (isHeroImage) {
      fs.readFile(dataFile, 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading content file:', err);
          return res.status(500).json({ error: 'Error reading content file' });
        }
        
        try {
          const content = JSON.parse(data);
          // Update the hero image property
          if (content.index) {
            content.index.heroImage = imagePaths[0];
            
            // Also try to update the src in the content if it exists
            if (content.index.content) {
              const safeOldPath = oldImagePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              let regex = new RegExp(`src="${safeOldPath}"`, 'g');
              
              // If the content doesn't have the full path, try looking for just the filename
              if (!content.index.content.includes(oldImagePath) && oldImageFilename) {
                console.log('Full path not found for hero, looking for filename in src attributes');
                
                // Create a regex that looks for the filename in any path
                const safeFilename = oldImageFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                regex = new RegExp(`src="[^"]*${safeFilename}"`, 'g');
              }
              
              // Look for the ID of the hero image
              const heroRegex = new RegExp(`id="hero-image"[^>]*src="[^"]*"`, 'g');
              
              // Try different approaches to find and replace the hero image
              if (content.index.content.match(heroRegex)) {
                console.log('Found hero image by ID');
                content.index.content = content.index.content.replace(
                  heroRegex,
                  match => match.replace(/src="[^"]*"/, `src="${imagePaths[0]}"`)
                );
              } else if (content.index.content.match(regex)) {
                console.log('Found hero image by path or filename');
                content.index.content = content.index.content.replace(
                  regex,
                  `src="${imagePaths[0]}"`
                );
              }
            }
            
            fs.writeFile(dataFile, JSON.stringify(content, null, 2), 'utf8', (err) => {
              if (err) {
                console.error('Error updating content file:', err);
                return res.status(500).json({ error: 'Error updating content file' });
              }
              console.log('Hero image updated successfully');
              res.json({ 
                message: 'Image uploaded successfully!',
                imagePaths: imagePaths
              });
            });
          } else {
            res.status(500).json({ error: 'Index page not found in content' });
          }
        } catch (parseError) {
          console.error('Error parsing content file:', parseError);
          res.status(500).json({ error: 'Error parsing content file' });
        }
      });
      return;
    }
    
    // For regular content images:
    fs.readFile(dataFile, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading content file:', err);
        return res.status(500).json({ error: 'Error reading content file' });
      }
      
      try {
        const content = JSON.parse(data);
        let updated = false;
        
        // Update the src in the content
        if (content.index && content.index.content) {
          // Try both the full path and just the filename
          const safeOldPath = oldImagePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          let regex = new RegExp(`src="${safeOldPath}"`, 'g');
          
          // Test for full path
          if (content.index.content.match(regex)) {
            console.log('Found image by full path');
          } else if (oldImageFilename) {
            // If the content doesn't have the full path, try looking for just the filename
            console.log('Full path not found, looking for filename in src attributes');
            
            // Create a regex that looks for the filename in any path
            const safeFilename = oldImageFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            regex = new RegExp(`src="[^"]*${safeFilename}"`, 'g');
            
            if (content.index.content.match(regex)) {
              console.log('Found image by filename');
            } else {
              // If we can't find by filename either, let's try a more lenient approach:
              // Find an img tag with alt text or similar characteristics
              const altText = req.body.altText;
              if (altText) {
                console.log('Trying to find by alt text:', altText);
                const safeAltText = altText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                regex = new RegExp(`<img[^>]*alt="${safeAltText}"[^>]*>`, 'g');
                
                if (content.index.content.match(regex)) {
                  console.log('Found image by alt text');
                  // Replace the src in this img tag
                  content.index.content = content.index.content.replace(
                    regex,
                    match => match.replace(/src="[^"]*"/, `src="${imagePaths[0]}"`)
                  );
                  updated = true;
                }
              }
              
              // If still not found and we're replacing in edit mode, just accept the upload
              if (!updated && req.body.forceUpdate === 'true') {
                console.log('Force update requested, accepting the upload without content modification');
                updated = true;
              } else if (!updated) {
                console.error('Image not found in content by any method');
                return res.status(400).json({ 
                  error: 'Image not found in content. Please try another image or refresh the page.'
                });
              }
            }
          }
          
          // If we made it here and haven't found anything, let's accept the upload anyway
          // This ensures better compatibility with different content structures
          if (!updated) {
            // Replace the old image path with the new one in the content
            const newContent = content.index.content.replace(
              regex,
              `src="${imagePaths[0]}"`
            );
            
            // Only update if something actually changed
            if (newContent !== content.index.content) {
              content.index.content = newContent;
              updated = true;
            } else {
              console.log('No changes made to content, but accepting upload');
              updated = true; // Accept the upload anyway
            }
          }
        }
        
        // Save the updated content back to data.json
        if (updated) {
          fs.writeFile(dataFile, JSON.stringify(content, null, 2), 'utf8', (err) => {
            if (err) {
              console.error('Error updating content file:', err);
              return res.status(500).json({ error: 'Error updating content file' });
            }
            console.log('Content updated successfully with new image');
            res.json({ 
              message: 'Image uploaded successfully!',
              imagePaths: imagePaths
            });
          });
        } else {
          console.error('No content was updated');
          res.status(500).json({ error: 'No content was updated' });
        }
      } catch (parseError) {
        console.error('Error parsing content file:', parseError);
        res.status(500).json({ error: 'Error parsing content file' });
      }
    });
  });
});

// Endpoint to add a new dish
app.post('/api/menu-dish', ensureAuthenticated, (req, res) => {
  upload.single('image')(req, res, function(err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'File upload error: ' + err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    const { name, price, description, category } = req.body;
    let dietary = [];
    
    try {
      if (req.body.dietary) {
        dietary = JSON.parse(req.body.dietary);
      }
    } catch (error) {
      console.error('Error parsing dietary options:', error);
    }

    if (!name || !price || !description || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Generate a unique ID for the dish
    const dishId = crypto.randomUUID();
    
    // Get image path if uploaded
    const imagePath = req.file ? 'images/' + req.file.filename : 'images/placeholder-dish.png';

    fs.readFile(dataFile, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading data file:', err);
        return res.status(500).json({ error: 'Error reading data file' });
      }

      try {
        const allContent = JSON.parse(data);
        
        if (!allContent.menu) {
          allContent.menu = {
            title: 'Our Menu',
            content: '',
            footer: '© 2025 La Bella Cucina. All rights reserved.'
          };
        }

        // Create HTML for the new dish
        const dietaryIcons = {
          'vegetarian': '<span class="text-green-600"><i class="fas fa-leaf" title="Vegetarian"></i></span>',
          'vegan': '<span class="text-green-700"><i class="fas fa-seedling" title="Vegan"></i></span>',
          'gluten-free': '<span class="text-yellow-600"><i class="fas fa-wheat-awn-circle-exclamation" title="Gluten-Free"></i></span>',
          'spicy': '<span class="text-red-500"><i class="fas fa-pepper-hot" title="Spicy"></i></span>',
          'chefs-special': '<span class="text-blue-500"><i class="fas fa-star" title="Chef\'s Special"></i></span>'
        };

        let dietaryHTML = '';
        dietary.forEach(option => {
          if (dietaryIcons[option]) {
            dietaryHTML += ' ' + dietaryIcons[option];
          }
        });

        // Parse existing content or create new structure
        let menuContent = '';
        
        if (allContent.menu.content) {
          menuContent = allContent.menu.content;
        } else {
          // Create basic menu structure if it doesn't exist
          menuContent = `<div class="space-y-12">
            <section class="mb-8">
              <h2 class="text-3xl font-bold text-gray-800 mb-4">Our Culinary Experience</h2>
              <p class="text-gray-600 leading-relaxed">Discover our carefully crafted menu featuring authentic Italian cuisine made with the freshest ingredients and traditional recipes passed down through generations.</p>
            </section>
            <section class="space-y-10">
              <div id="starters">
                <h3 class="text-2xl font-bold text-red-600 mb-4 border-b border-gray-200 pb-2">Starters</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6"></div>
              </div>
              <div id="mains">
                <h3 class="text-2xl font-bold text-red-600 mb-4 border-b border-gray-200 pb-2">Main Courses</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6"></div>
              </div>
              <div id="pasta">
                <h3 class="text-2xl font-bold text-red-600 mb-4 border-b border-gray-200 pb-2">Pasta & Risotto</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6"></div>
              </div>
              <div id="desserts">
                <h3 class="text-2xl font-bold text-red-600 mb-4 border-b border-gray-200 pb-2">Desserts</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6"></div>
              </div>
              <div id="drinks">
                <h3 class="text-2xl font-bold text-red-600 mb-4 border-b border-gray-200 pb-2">Drinks</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6"></div>
              </div>
            </section>
          </div>`;
        }

        // Create new dish HTML
        const newDishHTML = `
          <div class="bg-white p-5 rounded-lg shadow-md menu-item">
            <div class="flex justify-between items-start mb-2">
              <h4 class="text-xl font-semibold" data-dish-id="${dishId}">${name} ${dietaryHTML}</h4>
              <span class="text-red-600 font-medium">€${price}</span>
            </div>
            <p class="text-gray-600 mb-2">${description}</p>
            <div class="relative">
              <img src="${imagePath}" alt="${name}" class="w-full h-40 object-cover rounded-md">
              <button class="delete-dish-btn absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700" data-dish-id="${dishId}">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>
        `;

        // Insert the new dish into the appropriate category
        const categoryId = category || 'starters';
        const categoryRegex = new RegExp(`<div id="${categoryId}">[\\s\\S]*?<div class="grid grid-cols-1 md:grid-cols-2 gap-6">([\\s\\S]*?)<\\/div>`, 'i');
        
        const match = menuContent.match(categoryRegex);
        if (match) {
          // Insert dish at the beginning of the grid
          menuContent = menuContent.replace(
            `<div id="${categoryId}">`,
            `<div id="${categoryId}">`
          ).replace(
            `<div class="grid grid-cols-1 md:grid-cols-2 gap-6">`,
            `<div class="grid grid-cols-1 md:grid-cols-2 gap-6">${newDishHTML}`
          );
        } else {
          console.error(`Category ${categoryId} not found in menu content`);
          return res.status(400).json({ error: `Category ${categoryId} not found in menu content` });
        }

        // Update menu content
        allContent.menu.content = menuContent;

        // Save the updated content back to the file
        fs.writeFile(dataFile, JSON.stringify(allContent, null, 2), 'utf8', (err) => {
          if (err) {
            console.error('Error writing data file:', err);
            return res.status(500).json({ error: 'Error writing data file' });
          }
          res.json({ 
            message: 'Dish added successfully',
            dishId: dishId,
            imagePath: imagePath
          });
        });
      } catch (parseError) {
        console.error('Error parsing data file:', parseError);
        res.status(500).json({ error: 'Error parsing data file' });
      }
    });
  });
});

// Endpoint to delete a dish
app.delete('/api/menu-dish', ensureAuthenticated, (req, res) => {
  const { dishId } = req.body;
  
  if (!dishId) {
    return res.status(400).json({ error: 'Missing dish ID' });
  }

  fs.readFile(dataFile, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading data file:', err);
      return res.status(500).json({ error: 'Error reading data file' });
    }

    try {
      const allContent = JSON.parse(data);
      
      if (!allContent.menu || !allContent.menu.content) {
        return res.status(404).json({ error: 'Menu content not found' });
      }

      // Find and remove the dish with the given ID
      const dishRegex = new RegExp(`<div class="bg-white p-5 rounded-lg shadow-md menu-item">[\\s\\S]*?data-dish-id="${dishId}"[\\s\\S]*?<\\/div>\\s*<\\/div>`, 'g');
      
      const newContent = allContent.menu.content.replace(dishRegex, '');
      
      if (newContent === allContent.menu.content) {
        return res.status(404).json({ error: 'Dish not found' });
      }

      allContent.menu.content = newContent;

      // Save the updated content back to the file
      fs.writeFile(dataFile, JSON.stringify(allContent, null, 2), 'utf8', (err) => {
        if (err) {
          console.error('Error writing data file:', err);
          return res.status(500).json({ error: 'Error writing data file' });
        }
        res.json({ message: 'Dish deleted successfully' });
      });
    } catch (parseError) {
      console.error('Error parsing data file:', parseError);
      res.status(500).json({ error: 'Error parsing data file' });
    }
  });
});

// Endpoint to update an existing dish
app.post('/api/update-dish', ensureAuthenticated, (req, res) => {
  upload.single('image')(req, res, function(err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'File upload error: ' + err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    const { dishId, name, price, description, category } = req.body;
    let dietary = [];
    
    try {
      if (req.body.dietary) {
        dietary = JSON.parse(req.body.dietary);
      }
    } catch (error) {
      console.error('Error parsing dietary options:', error);
    }

    if (!dishId || !name || !price || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get image path if uploaded
    const hasNewImage = !!req.file;
    const newImagePath = hasNewImage ? 'images/' + req.file.filename : '';

    fs.readFile(dataFile, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading data file:', err);
        return res.status(500).json({ error: 'Error reading data file' });
      }

      try {
        const allContent = JSON.parse(data);
        
        if (!allContent.menu || !allContent.menu.content) {
          return res.status(404).json({ error: 'Menu content not found' });
        }

        // Create temporary DOM to find and update the dish
        let updatedContent = allContent.menu.content;
        
        // Find dish by ID and replace its content
        const dishRegex = new RegExp(`<div class="bg-white p-5 rounded-lg shadow-md menu-item">[\\s\\S]*?data-dish-id="${dishId}"[\\s\\S]*?<\\/div>\\s*<\\/div>`, 'g');
        const dishMatch = dishRegex.exec(updatedContent);
        
        if (!dishMatch) {
          return res.status(404).json({ error: 'Dish not found' });
        }
        
        // Get existing dish HTML to extract image path if no new image was provided
        const existingDishHTML = dishMatch[0];
        let imagePath = newImagePath;
        
        if (!hasNewImage) {
          // Extract existing image path if no new image
          const imgSrcRegex = /<img src="([^"]+)" alt="/;
          const imgMatch = existingDishHTML.match(imgSrcRegex);
          imagePath = imgMatch && imgMatch[1] ? imgMatch[1] : 'images/placeholder-dish.png';
        }

        // Create dietary icons HTML
        const dietaryIcons = {
          'vegetarian': '<span class="text-green-600"><i class="fas fa-leaf" title="Vegetarian"></i></span>',
          'vegan': '<span class="text-green-700"><i class="fas fa-seedling" title="Vegan"></i></span>',
          'gluten-free': '<span class="text-yellow-600"><i class="fas fa-wheat-awn-circle-exclamation" title="Gluten-Free"></i></span>',
          'spicy': '<span class="text-red-500"><i class="fas fa-pepper-hot" title="Spicy"></i></span>',
          'chefs-special': '<span class="text-blue-500"><i class="fas fa-star" title="Chef\'s Special"></i></span>'
        };

        let dietaryHTML = '';
        dietary.forEach(option => {
          if (dietaryIcons[option]) {
            dietaryHTML += ' ' + dietaryIcons[option];
          }
        });

        // Create updated dish HTML
        const updatedDishHTML = `
          <div class="bg-white p-5 rounded-lg shadow-md menu-item">
            <div class="flex justify-between items-start mb-2">
              <h4 class="text-xl font-semibold" data-dish-id="${dishId}">${name} ${dietaryHTML}</h4>
              <span class="text-red-600 font-medium">€${price}</span>
            </div>
            <p class="text-gray-600 mb-2">${description}</p>
            <div class="relative">
              <img src="${imagePath}" alt="${name}" class="w-full h-40 object-cover rounded-md">
              <button class="delete-dish-btn absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700" data-dish-id="${dishId}">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>
        `;

        // First - if category changed, remove from old category
        updatedContent = updatedContent.replace(dishRegex, '');
        
        // Then add to new category
        const categoryId = category;
        const categoryRegex = new RegExp(`<div id="${categoryId}">[\\s\\S]*?<div class="grid grid-cols-1 md:grid-cols-2 gap-6">([\\s\\S]*?)<\\/div>`, 'i');
        
        const categoryMatch = categoryRegex.exec(updatedContent);
        if (categoryMatch) {
          // Insert dish at the beginning of the grid
          updatedContent = updatedContent.replace(
            `<div id="${categoryId}">`,
            `<div id="${categoryId}">`
          ).replace(
            `<div class="grid grid-cols-1 md:grid-cols-2 gap-6">`,
            `<div class="grid grid-cols-1 md:grid-cols-2 gap-6">${updatedDishHTML}`
          );
        } else {
          console.error(`Category ${categoryId} not found in menu content`);
          return res.status(400).json({ error: `Category ${categoryId} not found in menu content` });
        }

        // Update menu content
        allContent.menu.content = updatedContent;

        // Save the updated content back to the file
        fs.writeFile(dataFile, JSON.stringify(allContent, null, 2), 'utf8', (err) => {
          if (err) {
            console.error('Error writing data file:', err);
            return res.status(500).json({ error: 'Error writing data file' });
          }
          res.json({ 
            message: 'Dish updated successfully',
            dishId: dishId,
            imagePath: imagePath
          });
        });
      } catch (parseError) {
        console.error('Error parsing data file:', parseError);
        res.status(500).json({ error: 'Error parsing data file' });
      }
    });
  });
});

// Endpoint to save dish order and categories
app.post('/api/save-dish-order', ensureAuthenticated, (req, res) => {
  const { dishes } = req.body;
  
  if (!dishes || !Array.isArray(dishes) || dishes.length === 0) {
    return res.status(400).json({ error: 'Invalid dishes data' });
  }

  fs.readFile(dataFile, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading data file:', err);
      return res.status(500).json({ error: 'Error reading data file' });
    }

    try {
      const allContent = JSON.parse(data);
      
      if (!allContent.menu || !allContent.menu.content) {
        return res.status(404).json({ error: 'Menu content not found' });
      }

      // Extract all dishes from the menu content using JSDOM
      const dom = new JSDOM(allContent.menu.content);
      const tempDiv = dom.window.document.createElement('div');
      tempDiv.innerHTML = allContent.menu.content;
      
      // Group dishes by category
      const dishesByCategory = {};
      dishes.forEach(dish => {
        if (!dishesByCategory[dish.category]) {
          dishesByCategory[dish.category] = [];
        }
        dishesByCategory[dish.category].push(dish);
      });
      
      // Sort dishes within each category
      Object.keys(dishesByCategory).forEach(category => {
        dishesByCategory[category].sort((a, b) => a.order - b.order);
      });
      
      // Create a map of dish IDs to HTML
      const dishMap = {};
      const dishElements = dom.window.document.querySelectorAll('.menu-item');
      
      dishElements.forEach(element => {
        const nameElement = element.querySelector('[data-dish-id]');
        if (nameElement) {
          const id = nameElement.getAttribute('data-dish-id');
          dishMap[id] = element.outerHTML;
        }
      });
      
      // Clear all existing dishes from categories
      let updatedContent = allContent.menu.content;
      Object.keys(dishesByCategory).forEach(categoryId => {
        const categoryRegex = new RegExp(`(<div id="${categoryId}">[\\s\\S]*?<div class="grid grid-cols-1 md:grid-cols-2 gap-6">)[\\s\\S]*?(<\\/div>)`, 'i');
        updatedContent = updatedContent.replace(categoryRegex, '$1$2');
      });
      
      // Insert dishes in their new order for each category
      Object.keys(dishesByCategory).forEach(categoryId => {
        let categoryContent = '';
        
        dishesByCategory[categoryId].forEach(dish => {
          if (dishMap[dish.dishId]) {
            categoryContent += dishMap[dish.dishId];
          }
        });
        
        if (categoryContent) {
          const categoryRegex = new RegExp(`(<div id="${categoryId}">[\\s\\S]*?<div class="grid grid-cols-1 md:grid-cols-2 gap-6">)([\\s\\S]*?)(<\\/div>)`, 'i');
          updatedContent = updatedContent.replace(categoryRegex, `$1${categoryContent}$3`);
        }
      });
      
      // Update menu content
      allContent.menu.content = updatedContent;
      
      // Save the updated content back to the file
      fs.writeFile(dataFile, JSON.stringify(allContent, null, 2), 'utf8', (err) => {
        if (err) {
          console.error('Error writing data file:', err);
          return res.status(500).json({ error: 'Error writing data file' });
        }
        res.json({ message: 'Dish order saved successfully' });
      });
    } catch (parseError) {
      console.error('Error parsing data file:', parseError);
      res.status(500).json({ error: 'Error parsing data file' });
    }
  });
});

// Endpoint to manage menu categories
app.post('/api/menu-categories', ensureAuthenticated, (req, res) => {
  const { categories } = req.body;
  
  if (!categories || !Array.isArray(categories) || categories.length === 0) {
    return res.status(400).json({ error: 'Invalid categories data' });
  }

  fs.readFile(dataFile, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading data file:', err);
      return res.status(500).json({ error: 'Error reading data file' });
    }

    try {
      const allContent = JSON.parse(data);
      
      if (!allContent.menu) {
        allContent.menu = {
          title: 'Our Menu',
          content: '',
          footer: '© 2025 La Bella Cucina. All rights reserved.'
        };
      }

      // Store existing dishes by category to preserve them
      const existingDishes = {};
      
      // Use simple string parsing instead of DOM manipulation
      if (allContent.menu.content) {
        const content = allContent.menu.content;
        
        // Find all category sections using regex
        const categoryRegex = /<div id="([^"]+)">[^<]*<h3[^>]*>([^<]+)<\/h3>[^<]*<div class="grid[^>]*>([^<]*(?:<(?!\/div)[^<]*)*)<\/div>/g;
        let match;
        
        while ((match = categoryRegex.exec(content)) !== null) {
          const categoryId = match[1];
          const gridContent = match[3] || '';
          existingDishes[categoryId] = gridContent;
        }
      }

      // Create new menu structure with the provided categories
      let menuContent = `<div class="space-y-12">
        <section class="mb-8">
          <h2 class="text-3xl font-bold text-gray-800 mb-4">Our Culinary Experience</h2>
          <p class="text-gray-600 leading-relaxed">Discover our carefully crafted menu featuring authentic Italian cuisine made with the freshest ingredients and traditional recipes passed down through generations.</p>
        </section>
        <section class="space-y-10">`;

      // Add each category
      categories.forEach(category => {
        // Create a valid ID from the category name - only lowercase letters and numbers, replace spaces with dashes
        const categoryId = category.toLowerCase()
          .replace(/\s+/g, '-')         // Replace spaces with dashes
          .replace(/[^a-z0-9-]/g, '')   // Remove any characters that aren't lowercase letters, numbers, or dashes
          .replace(/-+/g, '-');         // Replace multiple consecutive dashes with a single dash
        
        // Get existing dishes for this category or for similar categories
        let dishesHTML = '';
        
        // First try exact match
        if (existingDishes[categoryId]) {
          dishesHTML = existingDishes[categoryId];
        } else {
          // Try to match with similar categories (e.g., "Starters" → "starter")
          const similarCategoryKey = Object.keys(existingDishes).find(key => 
            key.includes(categoryId) || categoryId.includes(key)
          );
          
          if (similarCategoryKey) {
            dishesHTML = existingDishes[similarCategoryKey];
          }
        }
        
        menuContent += `
          <div id="${categoryId}">
            <h3 class="text-2xl font-bold text-red-600 mb-4 border-b border-gray-200 pb-2">${category}</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">${dishesHTML}</div>
          </div>`;
      });

      menuContent += `
        </section>
      </div>`;

      // Update menu content
      allContent.menu.content = menuContent;

      // Save the updated content back to the file
      fs.writeFile(dataFile, JSON.stringify(allContent, null, 2), 'utf8', (err) => {
        if (err) {
          console.error('Error writing data file:', err);
          return res.status(500).json({ error: 'Error writing data file' });
        }
        res.json({ message: 'Menu categories updated successfully' });
      });
    } catch (parseError) {
      console.error('Error parsing data file:', parseError);
      res.status(500).json({ error: 'Error parsing data file' });
    }
  });
});

// Endpoint to handle reservations
app.post('/api/reservation', (req, res) => {
  const { name, email, date, time, guests, phone, message } = req.body;
  
  // Basic validation
  if (!name || !email || !date || !time || !guests || !phone) {
    return res.status(400).json({ error: 'All fields are required except for special requests' });
  }
  
  // Format reservation date and time for better readability
  const reservationDate = new Date(date);
  const formattedDate = reservationDate.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  // Configure email transport (Gmail)
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'cliptyque@gmail.com', // Admin's Gmail
      pass: 'ldir iwcp houu mcxs'  // Admin's password (app password)
    }
  });
  
  // Email to restaurant admin (reservation notification)
  const adminMailOptions = {
    from: 'cliptyque@gmail.com',
    to: 'cliptyque@gmail.com', // Send to the admin email
    subject: `New Reservation: ${name} for ${guests} on ${formattedDate}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #e53e3e; color: white; padding: 20px; text-align: center;">
          <h1>New Reservation Request</h1>
        </div>
        <div style="padding: 20px; border: 1px solid #ddd; background-color: #f9f9f9;">
          <h2>Reservation Details</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Time:</strong> ${time}</p>
          <p><strong>Number of Guests:</strong> ${guests}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Email:</strong> ${email}</p>
          ${message ? `<p><strong>Special Requests:</strong> ${message}</p>` : ''}
          <p style="margin-top: 20px;">Please log in to the admin panel to confirm or cancel this reservation.</p>
        </div>
        <div style="text-align: center; padding: 10px; font-size: 12px; color: #666;">
          <p>La Bella Cucina Restaurant Management System</p>
        </div>
      </div>
    `
  };
  
  // Email to customer (acknowledgment of reservation request)
  const customerMailOptions = {
    from: 'cliptyque@gmail.com',
    to: email,
    subject: `Reservation Request Received - La Bella Cucina`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #e53e3e; color: white; padding: 20px; text-align: center;">
          <h1>Reservation Request Received</h1>
        </div>
        <div style="padding: 20px; border: 1px solid #ddd; background-color: #f9f9f9;">
          <p>Dear ${name},</p>
          <p>Thank you for your reservation request at La Bella Cucina. We have received the following details:</p>
          
          <div style="background-color: white; padding: 15px; border-left: 4px solid #e53e3e; margin: 20px 0;">
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Time:</strong> ${time}</p>
            <p><strong>Number of Guests:</strong> ${guests}</p>
            ${message ? `<p><strong>Special Requests:</strong> ${message}</p>` : ''}
          </div>
          
          <p>Our team will review your reservation request and send you a confirmation soon.</p>
          <p>If you need to make any changes or have questions, please call us at +1 234 567 89.</p>
          
          <p>We look forward to welcoming you to La Bella Cucina!</p>
          <p>Warm regards,<br>La Bella Cucina Team</p>
        </div>
        <div style="text-align: center; padding: 10px; font-size: 12px; color: #666;">
          <p>123 Main Street, Food City</p>
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </div>
    `
  };
  
  try {
    // Send emails to both admin and customer
    transporter.sendMail(adminMailOptions, (error, info) => {
      if (error) {
        console.error('Error sending admin email:', error);
      } else {
        console.log('Admin email sent:', info.response);
      }
    });
    
    transporter.sendMail(customerMailOptions, (error, info) => {
      if (error) {
        console.error('Error sending customer email:', error);
      } else {
        console.log('Customer email sent:', info.response);
      }
    });
    
    // Store reservation in data.json for record-keeping
    fs.readFile(dataFile, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading data file:', err);
        return res.status(500).json({ error: 'Error processing reservation' });
      }
      
      try {
        const allContent = JSON.parse(data);
        
        // Initialize reservations array if it doesn't exist
        if (!allContent.reservations) {
          allContent.reservations = [];
        }
        
        // Add new reservation
        allContent.reservations.push({
          id: crypto.randomUUID(),
          name,
          email,
          date,
          time,
          guests,
          phone,
          message,
          created: new Date().toISOString(),
          status: 'pending' // Can be 'pending', 'confirmed', 'cancelled'
        });
        
        // Save updated data
        fs.writeFile(dataFile, JSON.stringify(allContent, null, 2), 'utf8', (err) => {
          if (err) {
            console.error('Error writing reservation to data file:', err);
            return res.status(500).json({ error: 'Error saving reservation' });
          }
          
          res.json({ 
            message: 'Your reservation request has been received! We will contact you shortly to confirm.'
          });
        });
      } catch (parseError) {
        console.error('Error parsing data file:', parseError);
        res.status(500).json({ error: 'Error processing reservation' });
      }
    });
  } catch (error) {
    console.error('Reservation error:', error);
    res.status(500).json({ error: 'Error processing reservation' });
  }
});

// Endpoint to get all reservations (admin only)
app.get('/api/reservations', ensureAuthenticated, (req, res) => {
  fs.readFile(dataFile, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading data file:', err);
      return res.status(500).json({ error: 'Error reading reservations' });
    }
    
    try {
      const allContent = JSON.parse(data);
      
      // Return empty array if no reservations yet
      if (!allContent.reservations) {
        return res.json([]);
      }
      
      // Sort reservations by date (newest first)
      const sortedReservations = allContent.reservations.sort((a, b) => {
        return new Date(b.created) - new Date(a.created);
      });
      
      res.json(sortedReservations);
    } catch (parseError) {
      console.error('Error parsing data file:', parseError);
      res.status(500).json({ error: 'Error parsing reservations data' });
    }
  });
});

// Endpoint to update reservation status (admin only)
app.put('/api/reservations/:id', ensureAuthenticated, (req, res) => {
  const { id } = req.params;
  const { status, message } = req.body;
  
  if (!id || !status || !['pending', 'confirmed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid reservation ID or status' });
  }
  
  fs.readFile(dataFile, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading data file:', err);
      return res.status(500).json({ error: 'Error updating reservation' });
    }
    
    try {
      const allContent = JSON.parse(data);
      
      if (!allContent.reservations) {
        return res.status(404).json({ error: 'No reservations found' });
      }
      
      // Find the reservation to update
      const reservationIndex = allContent.reservations.findIndex(r => r.id === id);
      
      if (reservationIndex === -1) {
        return res.status(404).json({ error: 'Reservation not found' });
      }
      
      const reservation = allContent.reservations[reservationIndex];
      const oldStatus = reservation.status;
      
      // Update status
      reservation.status = status;
      reservation.updatedAt = new Date().toISOString();
      
      // Configure email transport
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'cliptyque@gmail.com',
          pass: 'ldir iwcp houu mcxs'
        }
      });
      
      // Format date for email
      const reservationDate = new Date(reservation.date);
      const formattedDate = reservationDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      // Send appropriate email based on status change
      if (status === 'confirmed' && oldStatus !== 'confirmed') {
        // Email to customer (confirmation)
        const confirmationMailOptions = {
          from: 'cliptyque@gmail.com',
          to: reservation.email,
          subject: `Reservation Confirmed - La Bella Cucina`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #e53e3e; color: white; padding: 20px; text-align: center;">
                <h1>Reservation Confirmed</h1>
              </div>
              <div style="padding: 20px; border: 1px solid #ddd; background-color: #f9f9f9;">
                <h2>Reservation Details</h2>
                <p><strong>Name:</strong> ${reservation.name}</p>
                <p><strong>Date:</strong> ${formattedDate}</p>
                <p><strong>Time:</strong> ${reservation.time}</p>
                <p><strong>Number of Guests:</strong> ${reservation.guests}</p>
                ${reservation.message ? `<p><strong>Special Requests:</strong> ${reservation.message}</p>` : ''}
                <p style="margin-top: 20px;">We look forward to serving you!</p>
              </div>
              <div style="text-align: center; padding: 10px; font-size: 12px; color: #666;">
                <p>La Bella Cucina Restaurant Management System</p>
              </div>
            </div>
          `
        };
        
        transporter.sendMail(confirmationMailOptions, (error, info) => {
          if (error) {
            console.error('Error sending confirmation email:', error);
          } else {
            console.log('Confirmation email sent:', info.response);
          }
        });
      } else if (status === 'cancelled' && oldStatus !== 'cancelled') {
        // Email to customer (cancellation)
        const cancellationMailOptions = {
          from: 'cliptyque@gmail.com',
          to: reservation.email,
          subject: `Reservation Cancelled - La Bella Cucina`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #e53e3e; color: white; padding: 20px; text-align: center;">
                <h1>Reservation Cancelled</h1>
              </div>
              <div style="padding: 20px; border: 1px solid #ddd; background-color: #f9f9f9;">
                <h2>Reservation Details</h2>
                <p><strong>Name:</strong> ${reservation.name}</p>
                <p><strong>Date:</strong> ${formattedDate}</p>
                <p><strong>Time:</strong> ${reservation.time}</p>
                <p><strong>Number of Guests:</strong> ${reservation.guests}</p>
                ${message ? `<p><strong>Cancellation Reason:</strong> ${message}</p>` : ''}
                <p style="margin-top: 20px;">We apologize for any inconvenience. Please feel free to make a new reservation at your convenience.</p>
              </div>
              <div style="text-align: center; padding: 10px; font-size: 12px; color: #666;">
                <p>La Bella Cucina Restaurant Management System</p>
              </div>
            </div>
          `
        };
        
        transporter.sendMail(cancellationMailOptions, (error, info) => {
          if (error) {
            console.error('Error sending cancellation email:', error);
          } else {
            console.log('Cancellation email sent:', info.response);
          }
        });
      }
      
      // Save updated data
      fs.writeFile(dataFile, JSON.stringify(allContent, null, 2), 'utf8', (err) => {
        if (err) {
          console.error('Error writing reservation update to data file:', err);
          return res.status(500).json({ error: 'Error saving reservation update' });
        }
        
        // Return updated reservation
        res.json(allContent.reservations[reservationIndex]);
      });
    } catch (parseError) {
      console.error('Error parsing data file:', parseError);
      res.status(500).json({ error: 'Error processing reservation update' });
    }
  });
});

// Menu API Endpoints
app.get('/api/menu', (req, res) => {
  fs.readFile(menuFile, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error reading menu data' });
    }
    res.json(JSON.parse(data));
  });
});

app.post('/api/menu', ensureAuthenticated, (req, res) => {
  try {
    const menuData = req.body;
    // Validate menu data structure
    if (!menuData.introduction || !menuData.dietary || !menuData.categories) {
      return res.status(400).json({ error: 'Invalid menu data structure' });
    }
    
    // Write to file
    fs.writeFile(menuFile, JSON.stringify(menuData, null, 2), 'utf8', (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error saving menu data' });
      }
      res.json({ success: true, message: 'Menu data saved successfully' });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error processing request' });
  }
});

// Endpoint for menu dish image upload
app.post('/api/menu/dish-image', ensureAuthenticated, (req, res) => {
  uploadMenuImage(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Use the correct path for menu images with leading slash removed
    const imagePath = `images/menu/${req.file.filename}`;
    console.log('Dish image uploaded to:', imagePath);
    
    // Check if we have category and dish IDs to update the menu data
    if (req.body.categoryId && req.body.dishId) {
      console.log('Updating menu data for dish:', req.body.dishId, 'in category:', req.body.categoryId);
      
      // Update the menu data with the new image path
      fs.readFile(menuFile, 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading menu data:', err);
          return res.status(500).json({ error: 'Error reading menu data' });
        }

        try {
          const menuData = JSON.parse(data);
          const { categoryId, dishId } = req.body;

          // Find the category and dish
          const category = menuData.categories.find(c => c.id === categoryId);
          if (!category) {
            return res.status(404).json({ error: 'Category not found' });
          }

          const dish = category.dishes.find(d => d.id === dishId);
          if (!dish) {
            // If the dish doesn't exist yet (new dish), just return the image path
            console.log('Dish not found, this may be a new dish being created');
            return res.json({ success: true, imagePath });
          }

          // Keep track of the old image path so we can delete it later if needed
          const oldImagePath = dish.image;
          
          // Update the dish image
          dish.image = imagePath;
          console.log('Updated dish image path from', oldImagePath, 'to', imagePath);

          // Save the updated menu data
          fs.writeFile(
            menuFile,
            JSON.stringify(menuData, null, 2),
            (err) => {
              if (err) {
                console.error('Error saving menu data:', err);
                return res.status(500).json({ error: 'Error saving menu data' });
              }
              
              // Try to delete the old image file if it exists and it's not the default placeholder
              if (oldImagePath && 
                  !oldImagePath.includes('placeholder') && 
                  oldImagePath.startsWith('images/menu/') &&
                  fs.existsSync(path.join(__dirname, 'public', oldImagePath))) {
                try {
                  fs.unlinkSync(path.join(__dirname, 'public', oldImagePath));
                  console.log('Deleted old image:', oldImagePath);
                } catch (deleteErr) {
                  console.error('Error deleting old image:', deleteErr);
                  // Continue anyway, this is not critical
                }
              }
              
              console.log('Menu data saved successfully with new image path');
              res.json({ success: true, imagePath });
            }
          );
        } catch (parseError) {
          console.error('Error parsing menu data:', parseError);
          res.status(500).json({ error: 'Error parsing menu data' });
        }
      });
    } else {
      // If no category/dish IDs, just return the image path
      console.log('No category/dish IDs provided, returning image path only');
      res.json({ success: true, imagePath });
    }
  });
});

// Endpoint to create a placeholder image
app.post('/api/create-placeholder', (req, res) => {
  const placeholderPath = path.join(__dirname, 'public', 'images', 'menu', 'placeholder.jpg');
  
  // Check if placeholder already exists
  if (fs.existsSync(placeholderPath)) {
    return res.json({ success: true, message: 'Placeholder already exists' });
  }
  
  // Create directory if it doesn't exist
  const menuImagesDir = path.join(__dirname, 'public', 'images', 'menu');
  if (!fs.existsSync(menuImagesDir)) {
    fs.mkdirSync(menuImagesDir, { recursive: true });
  }
  
  // Create a basic placeholder image (1x1 transparent pixel)
  const placeholderImageContent = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  
  try {
    fs.writeFileSync(placeholderPath, placeholderImageContent);
    console.log('Created placeholder image at', placeholderPath);
    res.json({ success: true, message: 'Placeholder created successfully' });
  } catch (err) {
    console.error('Error creating placeholder image:', err);
    res.status(500).json({ error: 'Error creating placeholder image' });
  }
});

// Ensure placeholder images exist on startup
const ensurePlaceholderImage = () => {
  const placeholderPath = path.join(__dirname, 'public', 'images', 'menu', 'placeholder.jpg');
  const menuImagesDir = path.join(__dirname, 'public', 'images', 'menu');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(menuImagesDir)) {
    fs.mkdirSync(menuImagesDir, { recursive: true });
  }
  
  // Create placeholder if it doesn't exist
  if (!fs.existsSync(placeholderPath)) {
    // Create a basic placeholder image (1x1 transparent pixel)
    const placeholderImageContent = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    
    try {
      fs.writeFileSync(placeholderPath, placeholderImageContent);
      console.log('Created placeholder image on startup at', placeholderPath);
    } catch (err) {
      console.error('Error creating placeholder image on startup:', err);
    }
  }
};

// Call the function on server startup
ensurePlaceholderImage();

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
