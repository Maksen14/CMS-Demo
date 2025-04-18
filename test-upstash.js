/**
 * Simple Upstash Redis Connection Test
 */
require('dotenv').config();

const redis = require('redis');

async function testUpstashConnection() {
  console.log('Testing Upstash Redis connection...');
  
  // Get Redis URL from environment
  const redisUrl = process.env.REDIS_URL;
  console.log(`Using Redis URL: ${redisUrl}`);
  
  try {
    // Create Redis client
    const client = redis.createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: false, // Don't automatically reconnect
        connectTimeout: 10000     // 10 seconds timeout
      }
    });
    
    console.log('Client created, attempting to connect...');
    
    // Connect to Redis
    await client.connect();
    console.log('Connected to Redis successfully!');
    
    // Test basic operations
    const testKey = 'test:upstash';
    const testValue = 'Working with Upstash at ' + new Date().toISOString();
    
    console.log(`Setting test value: ${testKey} = ${testValue}`);
    await client.set(testKey, testValue);
    
    const retrievedValue = await client.get(testKey);
    console.log(`Retrieved value: ${retrievedValue}`);
    
    if (retrievedValue === testValue) {
      console.log('✅ Test passed - values match');
    } else {
      console.log('❌ Test failed - values do not match');
    }
    
    // Clean up and close
    await client.del(testKey);
    console.log('Test key removed');
    await client.quit();
    console.log('Redis connection closed');
    
    return true;
  } catch (error) {
    console.error('Test failed with error:', error);
    return false;
  }
}

// Run the test
testUpstashConnection().then(success => {
  if (!success) {
    console.log('Connection test failed. Please check your Redis configuration.');
    process.exit(1);
  }
}).catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
}); 