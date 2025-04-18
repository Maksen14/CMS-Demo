/**
 * Redis Connection Test Script
 * 
 * This script tests the connection to Redis and basic operations.
 * Run with: node redis-test.js
 */

// Load environment variables
require('dotenv').config();

const redis = require('redis');

async function testRedisConnection() {
  console.log('Testing Redis connection...');
  console.log(`Using Redis URL: ${process.env.REDIS_URL || 'redis://localhost:6379'}`);
  
  try {
    // Initialize Redis client
    const client = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD || undefined,
      username: process.env.REDIS_USERNAME || undefined,
      legacyMode: true
    });

    // Log events
    client.on('error', (err) => {
      console.error('Redis Error:', err);
    });

    client.on('connect', () => {
      console.log('Connected to Redis successfully');
    });

    client.on('ready', () => {
      console.log('Redis client is ready');
    });

    // Connect to Redis
    await client.connect();

    // Test set/get operations
    const testKey = 'test:connection';
    const testValue = 'Connection successful: ' + new Date().toISOString();
    
    console.log(`Setting test value: ${testKey} = ${testValue}`);
    await client.set(testKey, testValue);
    
    const retrievedValue = await client.get(testKey);
    console.log(`Retrieved value: ${retrievedValue}`);
    
    if (retrievedValue === testValue) {
      console.log('✅ Test passed - values match');
    } else {
      console.log('❌ Test failed - values do not match');
    }

    // Clean up
    await client.del(testKey);
    console.log('Test key removed');
    
    // Close connection
    await client.quit();
    console.log('Redis connection closed');
  } catch (error) {
    console.error('Test failed with error:', error);
    process.exit(1);
  }
}

testRedisConnection().catch(console.error); 