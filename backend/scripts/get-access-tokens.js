const { TwitterApi } = require('twitter-api-v2');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Path to the temporary OAuth tokens
const TOKEN_FILE = path.join(__dirname, '.twitter-oauth-tokens.json');

// Get PIN from command line argument
const pinCode = process.argv[2];

if (!pinCode) {
  console.error('\x1b[31m%s\x1b[0m', '❌ Error: Please provide the PIN code as an argument');
  console.log('Usage: node scripts/get-access-tokens.js YOUR_PIN');
  process.exit(1);
}

// Check if token file exists
if (!fs.existsSync(TOKEN_FILE)) {
  console.error('\x1b[31m%s\x1b[0m', '❌ Error: No OAuth tokens found. Please run get-twitter-auth.js first.');
  process.exit(1);
}

// Read the stored tokens
const tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
const { oauth_token, oauth_token_secret } = tokenData;

// Initialize the Twitter client with the request tokens
const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: oauth_token,
  accessSecret: oauth_token_secret
});

async function getTokens() {
  try {
    console.log('Exchanging PIN for access tokens...');
    
    // Use the PIN to get the access tokens
    const { accessToken, accessSecret, screenName, userId } = await client.login(pinCode);
    
    // Clean up the temporary token file
    if (fs.existsSync(TOKEN_FILE)) {
      fs.unlinkSync(TOKEN_FILE);
    }
    
    console.log('\n\x1b[32m%s\x1b[0m', '✅ Success! Add these to your .env file:');
    console.log('\n# Twitter API Access Tokens (for posting as @' + screenName + ')')
    console.log('TWITTER_ACCESS_TOKEN=' + accessToken);
    console.log('TWITTER_ACCESS_SECRET=' + accessSecret);
    console.log('\nAfter updating .env, restart your server for the changes to take effect.');
    
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ Error getting tokens:');
    console.error(error);
    
    console.log('\nMake sure:');
    console.log('1. The PIN code is correct and was used within a few minutes of generation');
    console.log('2. Your Twitter app has the correct permissions (Read & Write)');
    console.log('3. Your API keys in .env are correct');
    
    // Clean up the token file on error
    if (fs.existsSync(TOKEN_FILE)) {
      fs.unlinkSync(TOKEN_FILE);
    }
  }
}

// Run the token exchange
getTokens();
