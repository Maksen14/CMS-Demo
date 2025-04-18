/**
 * Redis Session Setup Helper
 * 
 * This module provides functions to initialize Redis for session storage.
 */

// Load environment variables
require('dotenv').config();

const redis = require('redis');
const session = require('express-session');
const RedisStore = require('connect-redis')(session);

// Initialize Redis client and store
let redisClient = null;
let redisStore = null;

/**
 * Initialize Redis client and store
 * @returns {Promise<Object>} An object with redisClient and redisStore (both may be null if Redis is unavailable)
 */
async function initRedisClient() {
  // If Redis is explicitly disabled, don't try to connect
  if (process.env.USE_REDIS_STORE === 'false') {
    console.log('Redis session store is disabled by configuration. Using in-memory store.');
    return { redisClient: null, redisStore: null };
  }

  try {
    console.log('Attempting to connect to Redis...');
    console.log(`Redis URL: ${process.env.REDIS_URL}`);
    
    // Create Redis client with resilient settings
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD || undefined,
      username: process.env.REDIS_USERNAME || undefined,
      legacyMode: true
    });

    // Set up event handlers
    redisClient.on('error', (err) => {
      console.error('Redis client error:', err.message);
      // On error, make sure we're not using Redis store
      redisStore = null;
    });
    
    redisClient.on('connect', () => {
      console.log('Connected to Redis successfully');
    });
    
    // Attempt connection with timeout
    let timeoutId;
    const connectionPromise = redisClient.connect();
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Redis connection timeout')), 5000);
    });
    
    try {
      await Promise.race([connectionPromise, timeoutPromise]);
      clearTimeout(timeoutId);
      
      // If we got here, connection was successful
      redisStore = new RedisStore({ client: redisClient });
      console.log('Redis store initialized');
      
      return { redisClient, redisStore };
    } catch (innerError) {
      clearTimeout(timeoutId);
      throw innerError;
    }
  } catch (error) {
    console.error('Failed to initialize Redis client:', error.message);
    console.log('Falling back to in-memory session store');
    
    // Clean up any partially initialized resources
    if (redisClient) {
      try {
        await redisClient.quit().catch(() => {});
      } catch (e) {
        // Ignore quit errors
      }
    }
    
    return { redisClient: null, redisStore: null };
  }
}

/**
 * Get session middleware configuration
 * @param {Object} redisStore - Redis store instance (or null for memory store)
 * @returns {Object} Session middleware configuration
 */
function getSessionConfig(redisStore) {
  return {
    store: redisStore, // Will be null if Redis is unavailable
    secret: process.env.SESSION_SECRET || 'some-fallback-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
      maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
  };
}

module.exports = {
  initRedisClient,
  getSessionConfig
}; 