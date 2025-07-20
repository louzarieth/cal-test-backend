require('dotenv').config();
const { TwitterService } = require('../services/twitterService');
const dotenv = require('dotenv');
const path = require('path');

async function testTweet() {
  try {
    console.log('🚀 Testing tweet posting...');
    
    // Initialize the Twitter service
    const twitterService = new TwitterService();
    
    // Test event data with image
    const imagePath = path.join(__dirname, '..', 'public', 'icons', 'twitter.png');
    console.log('Using image path:', imagePath);
    
    // Verify image exists
    try {
      const fs = require('fs');
      if (!fs.existsSync(imagePath)) {
        console.error('❌ Image not found at path:', imagePath);
        return;
      }
      console.log('✅ Image found at path');
    } catch (err) {
      console.error('❌ Error checking image path:', err);
      return;
    }
    
    const testEvent = {
      id: 'test-' + Date.now(),
      title: '🚀 Test Event with Image',
      start_time: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes from now
      end_time: new Date(Date.now() + 70 * 60 * 1000).toISOString(), // 1 hour after start
      description: 'This is a test event with an image to verify Twitter integration. You can safely ignore this tweet.',
      imageUrl: imagePath
    };
    
    // Test posting a tweet using the postEventReminder method with the image path
    console.log('📤 Posting test tweet with image...');
    const tweet = await twitterService.postEventReminder(testEvent, imagePath);
    
    if (tweet) {
      console.log('\n✅ Tweet posted successfully!');
      console.log('==================================');
      console.log(`🆔 Tweet ID: ${tweet.id_str || tweet.data?.id}`);
      console.log(`📝 Content: ${tweet.text || tweet.data?.text}`);
      console.log(`⏰ Created at: ${tweet.created_at || new Date().toISOString()}`);
      console.log('==================================');
      console.log('Check your Twitter account to verify the post.');
    } else {
      console.log('❌ Failed to post tweet - no error but no tweet returned');
    }
    
  } catch (error) {
    console.error('\n❌ Error posting tweet:');
    console.error('===================');
    
    if (error.code) {
      console.error(`- Error code: ${error.code}`);
      console.error(`- Message: ${error.message}`);
      
      if (error.data) {
        console.error('\n🔧 Error details:', JSON.stringify(error.data, null, 2));
      }
    } else {
      console.error(error);
    }
    
    if (error.rateLimit) {
      console.log('\n⚠️ Rate limit info:');
      console.log(`- Limit: ${error.rateLimit.limit}`);
      console.log(`- Remaining: ${error.rateLimit.remaining}`);
      console.log(`- Reset: ${new Date(error.rateLimit.reset * 1000).toLocaleString()}`);
    }
  }
}

// Run the test
console.log('🔍 Initializing Twitter service...');
testTweet();
