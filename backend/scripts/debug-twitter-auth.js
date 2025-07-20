require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');

console.log('🔍 Starting Twitter API debug...');

// Log environment variables (mask sensitive data)
console.log('\n📋 Environment:');
console.log(`- TWITTER_API_KEY: ${process.env.TWITTER_API_KEY ? '✅ Present' : '❌ Missing'}`);
console.log(`- TWITTER_API_SECRET: ${process.env.TWITTER_API_SECRET ? '✅ Present' : '❌ Missing'}`);
console.log(`- TWITTER_ACCESS_TOKEN: ${process.env.TWITTER_ACCESS_TOKEN ? '✅ Present' : '❌ Missing'}`);
console.log(`- TWITTER_ACCESS_SECRET: ${process.env.TWITTER_ACCESS_SECRET ? '✅ Present' : '❌ Missing'}`);

// Initialize client with debug options
const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
  // Enable debug logging
  logger: {
    log: (message, level) => console.log(`[${level}] ${message}`)
  }
});

async function testConnection() {
  try {
    console.log('\n🔐 Attempting to call v2/me endpoint...');
    const response = await client.v2.me();
    
    console.log('\n✅ Success! API Response:');
    console.log(JSON.stringify(response, null, 2));
    
  } catch (error) {
    console.error('\n❌ Error Details:');
    console.log('Error Code:', error.code);
    console.log('Error Message:', error.message);
    
    if (error.rateLimit) {
      console.log('\nRate Limit Info:');
      console.log('- Limit:', error.rateLimit.limit);
      console.log('- Remaining:', error.rateLimit.remaining);
      console.log('- Reset:', new Date(error.rateLimit.reset * 1000).toISOString());
    }
    
    console.log('\nFull Error Object:');
    console.log(JSON.stringify({
      name: error.name,
      code: error.code,
      message: error.message,
      rateLimit: error.rateLimit,
      headers: error.headers,
      data: error.data
    }, null, 2));
    
    // If there's a response, log it
    if (error.request) {
      console.log('\nRequest Details:');
      console.log('- Method:', error.request.method);
      console.log('- URL:', error.request.url);
      console.log('- Headers:', error.request.headers);
    }
  }
}

testConnection();
