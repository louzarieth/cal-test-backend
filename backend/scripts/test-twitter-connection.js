require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');

async function testTwitterConnection() {
  console.log('🔍 Testing Twitter API connection...');
  
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
  
  // Initialize Twitter client
  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET
  });

  try {
    // Test with a simple API call first
    console.log('\n🔐 Testing API access with a simple request...');
    
    try {
      // Try to get the authenticated user's profile
      const user = await client.v2.me();
      console.log(`✅ Successfully authenticated as @${user.data.username}`);
      
      // Get the user's tweets (limited to 1)
      const tweets = await client.v2.userTimeline(user.data.id, {
        max_results: 5,
        'tweet.fields': ['created_at']
      });
      
      console.log('✅ Successfully made API request to Twitter');
      
      // If we get here, the request worked
      console.log('\n🐦 Testing tweet...');
      const testTweet = await client.v2.tweet('🔧 Test tweet from calendar app - please ignore');
      console.log(`✅ Test tweet posted: https://twitter.com/user/status/${testTweet.data.id}`);
      
    } catch (apiError) {
      console.error('\n❌ Twitter API Error:');
      console.error(`- Status: ${apiError.code || 'Unknown'}`);
      console.error(`- Message: ${apiError.message}`);
      
      if (apiError.rateLimit) {
        console.log('\nRate limit info:');
        console.log(`- Limit: ${apiError.rateLimit.limit}`);
        console.log(`- Remaining: ${apiError.rateLimit.remaining}`);
        console.log(`- Reset: ${new Date(apiError.rateLimit.reset * 1000).toISOString()}`);
      }
      
      if (apiError.code === 429) {
        console.log('\n⚠️  Rate limit exceeded. This could be due to:');
        console.log('1. Too many failed authentication attempts');
        console.log('2. Reached Twitter API rate limits');
        console.log('3. Temporary Twitter API restrictions');
        console.log('\nPlease try again in 15-30 minutes.');
      } else if (apiError.code === 401) {
        console.log('\n🔑 Authentication failed. Please verify your Twitter API credentials in the .env file.');
      } else {
        console.log('\n🔍 Additional error details:', JSON.stringify(apiError, null, 2));
      }
      
      process.exit(1);
    }
    
    console.log('\n🎉 Twitter API connection test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error testing Twitter connection:');
    if (error.rateLimit) {
      console.error('Rate limit exceeded:');
      console.error(`- Limit: ${error.rateLimit.limit}`);
      console.error(`- Remaining: ${error.rateLimit.remaining}`);
      console.error(`- Reset: ${new Date(error.rateLimit.reset * 1000).toISOString()}`);
    } else if (error.code) {
      console.error(`Error code: ${error.code}`);
      console.error(`Message: ${error.message}`);
      if (error.data) {
        console.error('Error details:', JSON.stringify(error.data, null, 2));
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

testTwitterConnection();
