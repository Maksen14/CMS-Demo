/**
 * Server Routes
 * 
 * This module exports routes and handlers from the original server file.
 */
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const { JSDOM } = require('jsdom');
const nodemailer = require('nodemailer');

// Load environment variables
require('dotenv').config();

module.exports = function(app, loginLimiter) {
  // Define paths for data files
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

  // Configure multer for image upload
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
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
              <div class="text-sm">
                <a href="#" class="font-semibold text-indigo-600 hover:text-indigo-500">Mot de passe oublié?</a>
              </div>
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

  // Middleware to protect routes that require authentication
  function ensureAuthenticated(req, res, next) {
    if (req.session.authenticated) {
      return next();
    }
    res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  /* --------------------------
     API Endpoints for Content
  -------------------------- */

  app.get('/api/content', (req, res) => {
    let page = req.query.page || 'index';
    page = page.replace('.html', '');

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
        } catch (parseError) {
          console.error("Erreur lors du parsing de menu.json:", parseError); 
          res.status(500).json({ error: 'Erreur lors du parsing du fichier menu.json' });
        }
      });
    } else { 
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
        } catch (parseError) {
          console.error('Erreur lors du parsing du fichier data.json:', parseError);
          res.status(500).json({ error: 'Erreur lors du parsing du fichier data.json' });
        }
      });
    }
  });

  // Protected endpoint to update content
  app.post('/api/content', ensureAuthenticated, (req, res) => {
    let { page, title, content: pageContent, footer, heroImage } = req.body;
    page = (page || 'index').replace('.html', '');

    if (page === 'menu') { 
      // Pour la page menu, mise à jour dans menu.json 
      fs.readFile(menuFile, 'utf8', (err, data) => {
        if (err) {
          console.error('Erreur lors de la lecture du fichier menu.json:', err); 
          return res.status(500).json({ error: 'Erreur lors de la lecture du fichier menu.json' });
        }

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
      fs.readFile(dataFile, 'utf8', (err, data) => {
        if (err) {
          console.error('Erreur lors de la lecture du fichier data.json:', err); 
          return res.status(500).json({ error: 'Erreur lors de la lecture du fichier data.json' });
        }
        
        let allContent = {};
        try {
          allContent = JSON.parse(data);
        } catch (parseError) {
          console.error('Erreur lors du parsing de data.json:', parseError); 
          return res.status(500).json({ error: 'Erreur lors du parsing du fichier data.json' });
        }

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
    }
  });

  // Additional routes would be added here...

  // Ensure placeholder image exists on startup
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

  // Return the configured middleware functions
  return {
    ensureAuthenticated,
    uploadHero,
    uploadContentImages,
    uploadMenuImage
  };
}; 