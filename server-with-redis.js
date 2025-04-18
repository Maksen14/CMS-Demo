/**
 * Server with Redis Session Support
 * 
 * This is a wrapper around the main server.js file that adds Redis session support.
 */

// Import Redis session helper
const redisSessionSetup = require('./redis-session-setup');
const session = require('express-session');
const express = require('express');

// Import and start the original server's dependencies
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const crypto = require('crypto');
const { JSDOM } = require('jsdom');
const nodemailer = require('nodemailer');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const dataFile = path.join(__dirname, 'data.json');
const menuFile = path.join(__dirname, 'menu.json');

// Initialize Redis and start the server
async function startServer() {
  // Initialize Redis client and session store
  const { redisClient, redisStore } = await redisSessionSetup.initRedisClient();
  
  // Get session configuration
  const sessionConfig = redisSessionSetup.getSessionConfig(redisStore);

  // Set up session middleware
  app.use(session(sessionConfig));
  
  // Use JSON middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Serve static files
  app.use(express.static(path.join(__dirname, 'public')));
  
  // Set up rate limiter for login
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login attempts per windowMs
    message: "Too many login attempts from this IP, please try again after 15 minutes."
  });

  // Import all routes and functions from the original server file
  require('./server-routes')(app, loginLimiter);
  
  // Find an available port starting from the specified PORT
  function findAvailablePort(initialPort) {
    // Try to start the server on the specified port
    const server = app.listen(initialPort, () => {
      console.log(`Server is running on http://localhost:${initialPort}`);
      console.log(`Session store: ${redisStore ? 'Redis' : 'In-memory'}`);
    });

    // Handle port in use error
    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        console.log(`Port ${initialPort} is already in use, trying port ${initialPort + 1}...`);
        // Try the next port
        findAvailablePort(initialPort + 1);
      } else {
        console.error('Server error:', e);
      }
    });
  }

  // Start the server
  findAvailablePort(PORT);
}

// Start the server
startServer().catch(error => {
  console.error('Error starting server:', error);
  process.exit(1);
}); 