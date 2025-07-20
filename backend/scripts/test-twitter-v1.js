require('dotenv').config();
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const fetch = require('node-fetch');

// Check required environment variables
const requiredVars = [
  'TWITTER_API_KEY',
  'TWITTER_API_SECRET',
  'TWITTER_ACCESS_TOKEN',
  'TWITTER_ACCESS_SECRET'
];

// Verify all required variables are present
const missingVars = requiredVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.log(`- ${varName}`));
  process.exit(1);
}

// Initialize OAuth 1.0a
const oauth = OAuth({
  consumer: {
    key: process.env.TWITTER_API_KEY,
    secret: process.env.TWITTER_API_SECRET
  },
  signature_method: 'HMAC-SHA1',
  hash_function: (baseString, key) => {
    return crypto.createHmac('sha1', key).update(baseString).digest('base64');
  }
});

// Twitter API endpoints
const API_BASE = 'https://api.twitter.com/1.1';

async function makeRequest(url, method = 'GET', data = {}) {
  const requestData = {
    url: `${API_BASE}${url}`,
    method,
    data
  };

  const token = {
    key: process.env.TWITTER_ACCESS_TOKEN,
    secret: process.env.TWITTER_ACCESS_SECRET
  };

  try {
    console.log(`\n🔍 Making ${method} request to: ${requestData.url}`);
    
    const response = await fetch(requestData.url, {
      method,
      headers: {
        ...oauth.toHeader(oauth.authorize(requestData, token)),
        'Content-Type': 'application/json',
      },
      body: method !== 'GET' ? JSON.stringify(data) : undefined,
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('❌ Request failed with status:', response.status);
      console.error('Response:', JSON.stringify(responseData, null, 2));
      return null;
    }
    
    console.log('✅ Request successful!');
    return responseData;
  } catch (error) {
    console.error('❌ Error making request:', error.message);
    return null;
  }
}

async function testTwitterAPI() {
  try {
    console.log('🚀 Testing Twitter API v1.1...');
    
    // Test 1: Get account verify credentials
    console.log('\n🔑 Testing account credentials...');
    const accountInfo = await makeRequest('/account/verify_credentials.json');
    if (accountInfo) {
      console.log('✅ Successfully authenticated as:', accountInfo.screen_name);
      console.log('Account name:', accountInfo.name);
    }
    
    // Test 2: Try to post a test tweet (dry run)
    console.log('\n📝 Testing tweet creation (dry run)...');
    const testTweet = await makeRequest('/statuses/update.json', 'POST', {
      status: 'Test tweet from API v1.1 - please ignore',
      dry_run: true
    });
    
    if (testTweet) {
      console.log('✅ Success! The tweet would have been posted.');
    } else {
      console.log('❌ Failed to verify tweet creation.');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error in test:', error.message);
    return false;
  }
}

// Run the test
testTwitterAPI().then(success => {
  if (success) {
    console.log('\n🎉 Twitter API v1.1 test completed successfully!');
  } else {
    console.log('\n❌ There was an issue testing the Twitter API.');
  }
});
