/**
 * Simple script to generate a secure random string for use as SESSION_SECRET
 * Run this script with: node generate-secret.js
 */

const crypto = require('crypto');

// Generate a random string of 64 characters
const secret = crypto.randomBytes(32).toString('hex');

console.log('Generated SESSION_SECRET:');
console.log(secret);
console.log('\nUpdate your .env file with this value for SESSION_SECRET.'); 