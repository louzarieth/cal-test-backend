require('dotenv').config();

console.log('🔍 Checking Twitter environment variables...');

// List of required Twitter API variables
const requiredVars = [
  'TWITTER_API_KEY',
  'TWITTER_API_SECRET',
  'TWITTER_ACCESS_TOKEN',
  'TWITTER_ACCESS_SECRET'
];

// Check if variables exist
const missingVars = [];
const presentVars = [];

requiredVars.forEach(varName => {
  if (process.env[varName]) {
    presentVars.push(`${varName}=${process.env[varName].substring(0, 5)}...`);
  } else {
    missingVars.push(varName);
  }
});

// Display results
if (presentVars.length > 0) {
  console.log('✅ Found environment variables:');
  presentVars.forEach(v => console.log(`   ${v}`));
}

if (missingVars.length > 0) {
  console.log('\n❌ Missing environment variables:');
  missingVars.forEach(v => console.log(`   - ${v}`));
  console.log('\nPlease add these to your .env file and restart the server.');
  process.exit(1);
}

// If we get here, all variables are present
console.log('\n✅ All required Twitter environment variables are present!');
console.log('\nTesting Twitter API connection...');

// Test Twitter API connection
const { TwitterApi } = require('twitter-api-v2');

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET
});

// Try to get user info to test the connection
client.v2.me()
  .then(user => {
    console.log(`\n✅ Successfully connected to Twitter as @${user.data.username}`);
    console.log('\n🎉 Twitter API is working correctly! You can now use Twitter features.');
  })
  .catch(error => {
    console.error('\n❌ Error connecting to Twitter API:');
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    if (error.message) {
      console.error(`   Message: ${error.message}`);
    }
    if (error.rateLimit) {
      console.error('   Rate limit info:', error.rateLimit);
    }
    console.error('\nPlease check your Twitter API credentials in the .env file and try again.');
    process.exit(1);
  });
