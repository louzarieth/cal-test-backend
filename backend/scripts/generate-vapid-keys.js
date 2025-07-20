const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

// Generate VAPID keys
const vapidKeys = webpush.generateVAPIDKeys();

// Create the output object
const output = {
  VAPID_PUBLIC_KEY: vapidKeys.publicKey,
  VAPID_PRIVATE_KEY: vapidKeys.privateKey,
  VAPID_MAILTO: 'your-email@example.com' // Replace with your email
};

// Convert to .env format
const envContent = Object.entries(output)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');

// Write to .env file
const envPath = path.join(__dirname, '../../.env');
fs.writeFileSync(envPath, envContent, { flag: 'w' });

// Also write to backend/.env
const backendEnvPath = path.join(__dirname, '../.env');
fs.writeFileSync(backendEnvPath, envContent, { flag: 'w' });

console.log('VAPID keys generated and saved to .env files:');
console.log('Public Key:', output.VAPID_PUBLIC_KEY);
console.log('Private Key:', output.VAPID_PRIVATE_KEY);
console.log('\nPlease restart your backend server for the changes to take effect.');
