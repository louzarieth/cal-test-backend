const { TwitterApi } = require('twitter-api-v2');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Path to store temporary OAuth tokens
const TOKEN_FILE = path.join(__dirname, '.twitter-oauth-tokens.json');

// Initialize the Twitter client with your app's API keys
const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET
});

// Generate the authorization URL
async function getAuthUrl() {
  try {
    // Generate the OAuth request tokens
    const { url, oauth_token, oauth_token_secret } = await client.generateAuthLink('oob');
    
    // Store the tokens in a temporary file
    const tokenData = {
      oauth_token,
      oauth_token_secret,
      timestamp: Date.now()
    };
    
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2));
    
    console.log('\n=== Twitter Account Authorization ===');
    console.log('1. Open this URL in your browser:');
    console.log('\x1b[34m%s\x1b[0m', url); // Blue color for URL
    console.log('\n2. Log in with the account you want to post from (Account 2)');
    console.log('3. You will get a PIN code - keep it safe');
    console.log('\nAfter getting the PIN, run:');
    console.log('node scripts/get-access-tokens.js YOUR_PIN\n');
    
  } catch (error) {
    console.error('Error generating auth URL:', error);
    if (fs.existsSync(TOKEN_FILE)) {
      fs.unlinkSync(TOKEN_FILE);
    }
  }
}

getAuthUrl();
