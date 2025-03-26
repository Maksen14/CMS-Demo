const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;
const dataFile = path.join(__dirname, 'data.json');

// Session middleware setup
app.use(session({
  secret: 'some-secret-key', // Replace with a secure key for production
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
  if (password === 'admin') {
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

// Public endpoint to get content
app.get('/api/content', (req, res) => {
  fs.readFile(dataFile, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading content file:', err);
      return res.status(500).json({ error: 'Error reading content file' });
    }
    try {
      const content = JSON.parse(data);
      res.json(content);
    } catch (parseError) {
      console.error('Error parsing content file:', parseError);
      res.status(500).json({ error: 'Error parsing content file' });
    }
  });
});

// Middleware to protect routes that require authentication
function ensureAuthenticated(req, res, next) {
  if (req.session.authenticated) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized. Please log in.' });
}

// Protected endpoint to update content
app.post('/api/content', ensureAuthenticated, (req, res) => {
  const newContent = req.body;
  fs.writeFile(dataFile, JSON.stringify(newContent, null, 2), 'utf8', (err) => {
    if (err) {
      console.error('Error writing content file:', err);
      return res.status(500).json({ error: 'Error writing content file' });
    }
    res.json({ message: 'Content updated successfully!' });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
