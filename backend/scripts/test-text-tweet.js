require('dotenv').config();
const { TwitterService } = require('../services/twitterService');

async function testTextTweet() {
  try {
    console.log('🚀 Testing text-only tweet...');
    
    // Initialize the Twitter service
    const twitterService = new TwitterService();
    
    // Test event data without image
    const testEvent = {
      id: 'test-text-' + Date.now(),
      title: '🚀 Test Text-Only Tweet',
      start_time: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes from now
      end_time: new Date(Date.now() + 70 * 60 * 1000).toISOString(), // 1 hour after start
      description: 'This is a test of the text-only tweet functionality. You can safely ignore this tweet.'
    };
    
    // Test posting a text-only tweet
    console.log('📤 Posting test tweet (text only)...');
    const tweet = await twitterService.postEventReminder(testEvent);
    
    if (tweet) {
      console.log('\n✅ Tweet posted successfully!');
      console.log('==================================');
      console.log(`🆔 Tweet ID: ${tweet.id_str || tweet.data?.id}`);
      console.log(`📝 Content: ${tweet.text || tweet.data?.text}`);
      console.log(`⏰ Created at: ${tweet.created_at || new Date().toISOString()}`);
      console.log('==================================');
      console.log('Check your Twitter account to verify the post.');
    } else {
      console.error('❌ Failed to post tweet: No response from Twitter API');
    }
  } catch (error) {
    console.error('❌ Error in testTextTweet:');
    console.error('==================');
    console.error(error);
    console.error('==================');
    
    if (error.rateLimit) {
      console.error('Rate limit exceeded. Reset at:', new Date(error.rateLimit.reset * 1000));
    }
    
    if (error.code) {
      console.error('Error code:', error.code);
      console.error('Error details:', error.data);
    }
  }
}

// Run the test
console.log('🔍 Initializing Twitter service...');
testTextTweet();
