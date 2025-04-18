/**
 * Session Store Management Utility
 * 
 * This script helps switch between Redis and in-memory session storage
 * for development and testing purposes.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load the current .env file
dotenv.config();

// Command line argument: "redis" or "memory"
const storeType = process.argv[2]?.toLowerCase();

if (!storeType || (storeType !== 'redis' && storeType !== 'memory')) {
  console.log(`
Session Store Management Utility
--------------------------------

This utility helps you switch between Redis and in-memory session storage
for development and testing purposes.

Usage:
  node manage-session-store.js [store-type]

Arguments:
  store-type     Either "redis" or "memory"

Examples:
  node manage-session-store.js redis    # Enable Redis session store
  node manage-session-store.js memory   # Use in-memory session store

Current configuration:
  Session Store: ${process.env.USE_REDIS_STORE === 'false' ? 'Memory (in-process)' : 'Redis (if available)'}
  Redis URL: ${process.env.REDIS_URL || 'Not configured'}
  `);
  process.exit(0);
}

// Read the current .env file
const envFilePath = path.join(__dirname, '.env');
let envContent = '';

try {
  envContent = fs.readFileSync(envFilePath, 'utf8');
} catch (error) {
  console.error('Error reading .env file:', error.message);
  process.exit(1);
}

// Determine if USE_REDIS_STORE exists in the file
const hasRedisStoreFlag = /USE_REDIS_STORE=/.test(envContent);

if (storeType === 'redis') {
  // Enable Redis session store
  if (hasRedisStoreFlag) {
    // Update existing flag
    envContent = envContent.replace(/USE_REDIS_STORE=.*/, 'USE_REDIS_STORE=true');
  } else {
    // Add the flag
    envContent += '\n# Toggle session store (true = Redis, false = Memory)\nUSE_REDIS_STORE=true\n';
  }
  console.log('✅ Redis session store enabled (will be used if Redis is available)');
} else {
  // Use memory session store
  if (hasRedisStoreFlag) {
    // Update existing flag
    envContent = envContent.replace(/USE_REDIS_STORE=.*/, 'USE_REDIS_STORE=false');
  } else {
    // Add the flag
    envContent += '\n# Toggle session store (true = Redis, false = Memory)\nUSE_REDIS_STORE=false\n';
  }
  console.log('✅ In-memory session store configured (Redis will not be used)');
}

// Write the updated .env file
try {
  fs.writeFileSync(envFilePath, envContent);
} catch (error) {
  console.error('Error writing .env file:', error.message);
  process.exit(1);
}

console.log('Configuration saved. Restart your server for changes to take effect.'); 