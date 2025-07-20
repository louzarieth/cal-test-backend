require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');

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

// Initialize the Twitter client
const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET
});

// Test the credentials by fetching the authenticated user's profile
async function verifyCredentials() {
  try {
    console.log('🔍 Verifying Twitter API credentials...');
    
    // Test with a simple read operation first
    const user = await client.v2.me();
    console.log('✅ Successfully authenticated as:', user.data.username);
    
    // Test if we can post (without actually posting)
    console.log('\n🔒 Testing write permissions...');
    try {
      // This just verifies the credentials are valid for write operations
      const result = await client.v2.tweet('Test tweet - please ignore', { dry_run: true });
      console.log('✅ Write permissions verified!');
    } catch (error) {
      if (error.code === 401) {
        console.error('❌ Insufficient permissions. Please check if your app has Read & Write permissions.');
      } else {
        console.error('❌ Error testing write permissions:', error.message);
      }
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error('\n❌ Authentication failed:', error.message);
    
    if (error.code === 32) {
      console.log('\n🔧 Possible solutions:');
      console.log('1. Regenerate your API keys in the Twitter Developer Portal');
      console.log('2. Ensure your app has the correct permissions (Read & Write)');
      console.log('3. Make sure your system clock is synchronized');
      console.log('4. Try generating new access tokens');
    }
    
    if (error.rateLimit) {
      console.log('\n⚠️ Rate limit info:');
      console.log('- Limit:', error.rateLimit.limit);
      console.log('- Remaining:', error.rateLimit.remaining);
      console.log('- Reset:', new Date(error.rateLimit.reset * 1000).toLocaleString());
    }
    
    return false;
  }
}

// Run the verification
verifyCredentials().then(success => {
  if (success) {
    console.log('\n🎉 Twitter API authentication is working correctly!');
  } else {
    console.log('\n❌ There was an issue with Twitter API authentication.');
    process.exit(1);
  }
});
