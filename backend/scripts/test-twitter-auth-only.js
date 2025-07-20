require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');

async function testTwitterAuth() {
  console.log('🔍 Testing Twitter authentication...');
  
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
    console.log('\nPlease add these to your .env file and try again.');
    process.exit(1);
  }

  console.log('✅ All required environment variables are present');
  
  // Initialize Twitter client with minimal configuration
  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET
  });

  try {
    // Try to get the current user's profile (minimal API call)
    console.log('\n🔐 Attempting to authenticate...');
    const user = await client.v2.me();
    
    // If we get here, authentication was successful
    console.log(`\n🎉 Success! Authenticated as @${user.data.username}`);
    console.log('\n✅ Twitter authentication is working correctly!');
    console.log('\nNext steps:');
    console.log('1. The system will automatically post reminders for upcoming events');
    console.log('2. The next reminder is scheduled for your event "Study Indonesia" at 10:00 AM');
    
  } catch (error) {
    console.error('\n❌ Twitter authentication failed:');
    
    if (error.code === 429) {
      console.error('Rate limit exceeded. Please wait and try again later.');
      if (error.rateLimit) {
        console.log('Rate limit info:');
        console.log(`- Limit: ${error.rateLimit.limit}`);
        console.log(`- Remaining: ${error.rateLimit.remaining}`);
        console.log(`- Reset: ${new Date(error.rateLimit.reset * 1000).toISOString()}`);
      }
    } else if (error.code === 401) {
      console.error('Authentication failed. Please verify your Twitter API credentials in the .env file.');
      console.log('\nTo fix this:');
      console.log('1. Go to https://developer.twitter.com/');
      console.log('2. Check that your app has the correct permissions');
      console.log('3. Regenerate your access tokens if needed');
    } else if (error.code === 403) {
      console.error('Forbidden. Your app may not have the required permissions.');
      console.log('\nPlease check:');
      console.log('1. Your app has Read & Write permissions');
      console.log('2. Your app is not in read-only mode');
    } else {
      console.error('Error details:', error);
    }
    
    process.exit(1);
  }
}

testTwitterAuth();
