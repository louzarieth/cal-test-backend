require('dotenv').config();
const { TwitterService } = require('../services/twitterService');

// Test the Twitter service
async function testTwitterService() {
  console.log('🚀 Starting Twitter service test...');
  
  // Initialize the Twitter service
  const twitterService = new TwitterService();
  
  try {
    // Test 1: Verify credentials
    console.log('\n🔍 Testing credentials...');
    const username = await twitterService.verifyCredentials();
    console.log(`✅ Connected to Twitter as @${username}`);
    
    // Test 2: Post a test tweet
    console.log('\n🐦 Testing tweet posting...');
    const testTweet = await twitterService.postTweet(
      '🔧 Testing Twitter integration for Monad Calendar\n\n' +
      'This is a test tweet from the development environment.\n' +
      `Time: ${new Date().toISOString()}\n\n` +
      '#Monad #Test #Dev'
    );
    console.log('✅ Test tweet posted successfully!');
    console.log(`   Tweet ID: ${testTweet.id}`);
    console.log(`   Text: ${testTweet.text}`);
    
    // Test 3: Test reminder system with a test event
    console.log('\n⏰ Testing 10-minute reminder system...');
    const testEvent = {
      id: 'test-event-1',
      title: 'Monad Community Call',
      description: 'Join us for our weekly community call where we discuss the latest updates and answer your questions.',
      start_time: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes from now
      imageUrl: null
    };
    
    // Using default parameter which is now [10] minutes
    console.log('Posting test reminder for event:', testEvent.title);
    const reminderResult = await twitterService.checkAndPostReminders();
    
    console.log('\n📊 Reminder Test Results:');
    console.log(`   Success: ${reminderResult.success}`);
    console.log(`   Posted: ${reminderResult.posted} reminder(s)`);
    console.log(`   Errors: ${reminderResult.errors}`);
    
    if (reminderResult.details && reminderResult.details.length > 0) {
      console.log('\n📝 Details:');
      reminderResult.details.forEach((detail, index) => {
        console.log(`   ${index + 1}. ${detail.success ? '✅' : '❌'} ${detail.eventId} - ${detail.title}`);
        if (!detail.success) {
          console.log(`      Error: ${detail.error}`);
        } else {
          console.log(`      Tweet ID: ${detail.tweetId}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.rateLimit) {
      console.error('Rate limit info:', {
        limit: error.rateLimit.limit,
        remaining: error.rateLimit.remaining,
        reset: new Date(error.rateLimit.reset * 1000).toISOString()
      });
    }
    process.exit(1);
  } finally {
    console.log('\n🏁 Test completed');
    process.exit(0);
  }
}

// Run the test
testTwitterService().catch(console.error);
