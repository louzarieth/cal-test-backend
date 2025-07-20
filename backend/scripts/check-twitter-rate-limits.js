require('dotenv').config({ path: '../.env' });
const { TwitterApi } = require('twitter-api-v2');
const { getDb } = require('../db');

// Initialize Twitter client
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

async function checkRateLimits() {
  console.log('🔍 Checking Twitter API rate limits...');
  
  try {
    // Test a simple API call to get rate limit status
    const rateLimits = await twitterClient.v2.rateLimitStatus('tweets');
    
    console.log('\n📊 Rate Limit Status:');
    console.log('------------------');
    console.log('Endpoint: Tweets (v2)');
    console.log('Limit:', rateLimits.limit);
    console.log('Remaining:', rateLimits.remaining);
    console.log('Reset at:', new Date(rateLimits.reset * 1000).toLocaleString());
    
    // Check if we're rate limited
    if (rateLimits.remaining === 0) {
      const resetTime = new Date(rateLimits.reset * 1000);
      const now = new Date();
      const minutesUntilReset = Math.ceil((resetTime - now) / (1000 * 60));
      
      console.log('\n⚠️  RATE LIMITED!');
      console.log(`   - Next reset in ${minutesUntilReset} minutes`);
      console.log(`   - Reset time: ${resetTime.toLocaleString()}`);
    } else {
      console.log('\n✅ Rate limits look good!');
    }
    
  } catch (error) {
    console.error('\n❌ Error checking rate limits:');
    console.error(error);
    
    if (error.rateLimit) {
      console.log('\n📊 Rate limit info from error:');
      console.log('   - Limit:', error.rateLimit.limit);
      console.log('   - Remaining:', error.rateLimit.remaining);
      console.log('   - Reset at:', new Date(error.rateLimit.reset * 1000).toLocaleString());
    }
  }
}

// Check database for recent Twitter errors
async function checkRecentErrors() {
  try {
    const db = await getDb();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const errors = await db.all(
      "SELECT * FROM logs WHERE message LIKE '%Twitter%' AND timestamp > ? ORDER BY timestamp DESC LIMIT 5",
      [oneHourAgo]
    );
    
    if (errors.length > 0) {
      console.log('\n🔍 Recent Twitter-related errors:');
      console.log('--------------------------------');
      errors.forEach(err => {
        console.log(`[${new Date(err.timestamp).toLocaleString()}] ${err.message}`);
      });
    } else {
      console.log('\n✅ No recent Twitter-related errors found in logs');
    }
  } catch (err) {
    console.error('Error checking recent errors:', err);
  }
}

// Main function
async function main() {
  console.log('🕵️  Twitter Rate Limit Diagnostic Tool');
  console.log('====================================\n');
  
  // Verify required environment variables
  const requiredVars = [
    'TWITTER_API_KEY',
    'TWITTER_API_SECRET',
    'TWITTER_ACCESS_TOKEN',
    'TWITTER_ACCESS_TOKEN_SECRET'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => console.log(`   - ${varName}`));
    console.log('\nPlease make sure your .env file is properly configured.');
    process.exit(1);
  }
  
  await checkRateLimits();
  await checkRecentErrors();
  
  console.log('\n✅ Diagnostic complete!');
}

main().catch(console.error);
