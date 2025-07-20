// Load environment variables first
require('dotenv').config();

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
  console.log('\nPlease update your .env file with these values and try again.');
  process.exit(1);
}

// Import the Twitter service
const { twitterService } = require('../services/twitterService');

async function testTwitterPost() {
  try {
    console.log('🚀 Testing Twitter post...');
    
    // Verify the service is initialized
    if (!twitterService.client) {
      throw new Error('Twitter client not initialized');
    }
    
    // Test posting a tweet
    console.log('📤 Posting test tweet...');
    const tweet = await twitterService.testPostTweet();
    
    if (tweet) {
      console.log('\n✅ Test tweet posted successfully!');
      console.log('==================================');
      console.log(`🆔 Tweet ID: ${tweet.id_str}`);
      console.log(`📝 Content: ${tweet.full_text || 'No text content'}`);
      console.log(`⏰ Posted at: ${tweet.created_at || new Date().toISOString()}`);
      console.log('==================================');
      console.log('Check your Twitter account to verify the post.');
    } else {
      console.log('❌ Failed to post test tweet - no error but no tweet returned');
    }
    
  } catch (error) {
    console.error('\n❌ Error in test:');
    console.error('================');
    console.error(error.message);
    
    if (error.rateLimit) {
      console.error('\n⚠️ Rate limit info:');
      console.error(`- Limit: ${error.rateLimit.limit}`);
      console.error(`- Remaining: ${error.rateLimit.remaining}`);
      console.error(`- Reset: ${new Date(error.rateLimit.reset * 1000).toLocaleString()}`);
    }
    
    if (error.code) {
      console.error('\n🔧 Error details:', error.data || 'No additional details');
    }
    
    process.exit(1);
  }
}

// Run the test
console.log('🔍 Checking Twitter configuration...');
testTwitterPost();
