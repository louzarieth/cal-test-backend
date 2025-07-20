require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');

// Simple function to mask sensitive information
const maskString = (str) => {
  if (!str) return 'undefined';
  if (str.length <= 8) return '********';
  return `${str.substring(0, 4)}...${str.substring(str.length - 4)}`;
};

// Verify required environment variables
const requiredVars = [
  'TWITTER_API_KEY',
  'TWITTER_API_SECRET',
  'TWITTER_ACCESS_TOKEN',
  'TWITTER_ACCESS_SECRET'
];

// Check for missing variables
const missingVars = requiredVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.log(`- ${varName}`));
  process.exit(1);
}

// Log the presence of variables (masked for security)
console.log('🔍 Found Twitter API credentials:');
requiredVars.forEach(varName => {
  console.log(`- ${varName}: ${process.env[varName] ? '✅ Set' : '❌ Missing'}`);
});

// Initialize the Twitter client
const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET
});

// Test the connection
async function testConnection() {
  try {
    console.log('\n🔌 Testing Twitter API connection...');
    
    // Test with a simple read operation
    console.log('\n📡 Fetching user profile...');
    const user = await client.v2.me();
    
    console.log('✅ Successfully authenticated!');
    console.log('\n📋 Account Information:');
    console.log(`- Username: @${user.data.username}`);
    console.log(`- Name: ${user.data.name}`);
    console.log(`- ID: ${user.data.id}`);
    
    return true;
  } catch (error) {
    console.error('\n❌ Authentication failed:');
    
    if (error.code) {
      console.error(`- Error code: ${error.code}`);
      console.error(`- Message: ${error.message}`);
      
      if (error.rateLimit) {
        console.log('\n⚠️ Rate limit info:');
        console.log(`- Limit: ${error.rateLimit.limit}`);
        console.log(`- Remaining: ${error.rateLimit.remaining}`);
        console.log(`- Reset: ${new Date(error.rateLimit.reset * 1000).toLocaleString()}`);
      }
      
      if (error.data) {
        console.log('\n🔧 Error details:', JSON.stringify(error.data, null, 2));
      }
    } else {
      console.error(error);
    }
    
    return false;
  }
}

// Run the test
console.log('\n🚀 Starting Twitter API test...');
testConnection().then(success => {
  if (success) {
    console.log('\n🎉 Twitter API connection test completed successfully!');
  } else {
    console.log('\n❌ There was an issue connecting to the Twitter API.');
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Verify your API keys in the .env file are correct');
    console.log('2. Check if your app has the correct permissions in the Twitter Developer Portal');
    console.log('3. Ensure your system clock is synchronized');
    console.log('4. Try regenerating your API keys and access tokens');
    
    // Show masked credentials for verification
    console.log('\n🔑 Current credentials (masked for security):');
    requiredVars.forEach(varName => {
      console.log(`- ${varName}: ${maskString(process.env[varName])}`);
    });
  }
});
