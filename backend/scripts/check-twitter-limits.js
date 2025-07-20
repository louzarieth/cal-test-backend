require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');
const https = require('https');

// Get Twitter credentials from environment
const {
  TWITTER_API_KEY,
  TWITTER_API_SECRET,
  TWITTER_ACCESS_TOKEN,
  TWITTER_ACCESS_TOKEN_SECRET
} = process.env;

// Simple function to make a GET request and return headers
function getWithHeaders(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, options, (res) => {
      const headers = res.headers;
      let data = '';
      
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers,
            data: data ? JSON.parse(data) : {}
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers,
            data: { error: 'Failed to parse response' }
          });
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function checkRateLimits() {
  console.log('🕒 Checking Twitter API rate limits...\n');
  
  try {
    // Make a simple request to Twitter API v2 to get rate limit headers
    const response = await getWithHeaders('https://api.twitter.com/2/tweets/20', {
      headers: {
        'Authorization': `Bearer ${TWITTER_ACCESS_TOKEN}`,
        'User-Agent': 'TwitterRateLimitChecker/1.0'
      }
    });
    
    const now = new Date();
    const headers = response.headers;
    
    // Extract rate limit info from headers
    const rateLimitInfo = {
      limit: headers['x-rate-limit-limit'] ? parseInt(headers['x-rate-limit-limit']) : null,
      remaining: headers['x-rate-limit-remaining'] ? parseInt(headers['x-rate-limit-remaining']) : null,
      reset: headers['x-rate-limit-reset'] ? parseInt(headers['x-rate-limit-reset']) * 1000 : null,
      '24h_limit': headers['x-user-limit-24hour-limit'] ? parseInt(headers['x-user-limit-24hour-limit']) : null,
      '24h_remaining': headers['x-user-limit-24hour-remaining'] ? parseInt(headers['x-user-limit-24hour-remaining']) : null,
      '24h_reset': headers['x-user-limit-24hour-reset'] ? parseInt(headers['x-user-limit-24hour-reset']) * 1000 : null
    };
    
    // Display results
    console.log('📊 Twitter API Rate Limits Status');
    console.log('===============================');
    
    // Current time
    console.log(`🔹 Current time: ${now.toLocaleString()}`);
    
    // Standard rate limits
    if (rateLimitInfo.limit !== null) {
      const resetTime = new Date(rateLimitInfo.reset);
      const timeUntilReset = resetTime - now;
      const minutes = Math.max(0, Math.floor(timeUntilReset / (1000 * 60)));
      const seconds = Math.max(0, Math.floor((timeUntilReset % (60000)) / 1000));
      
      console.log('\n📊 Standard Rate Limits:');
      console.log('---------------------');
      console.log(`🔹 Limit:     ${rateLimitInfo.limit}`);
      console.log(`🔹 Remaining: ${rateLimitInfo.remaining}`);
      console.log(`🔹 Reset:     ${resetTime.toLocaleString()} (in ${minutes}m ${seconds}s)`);
    }
    
    // 24-hour limits (appear when rate limited)
    if (rateLimitInfo['24h_limit'] !== null) {
      const reset24hTime = new Date(rateLimitInfo['24h_reset']);
      const timeUntil24hReset = reset24hTime - now;
      const hours24h = Math.max(0, Math.floor(timeUntil24hReset / (1000 * 60 * 60)));
      const minutes24h = Math.max(0, Math.floor((timeUntil24hReset % (1000 * 60 * 60)) / (1000 * 60)));
      
      console.log('\n📅 24-Hour Rate Limits:');
      console.log('---------------------');
      console.log(`🔹 Limit:     ${rateLimitInfo['24h_limit']}`);
      console.log(`🔹 Remaining: ${rateLimitInfo['24h_remaining']}`);
      console.log(`🔹 Reset:     ${reset24hTime.toLocaleString()} (in ${hours24h}h ${minutes24h}m)`);
      
      if (rateLimitInfo['24h_remaining'] === 0) {
        console.log('\n⚠️  24-HOUR RATE LIMIT REACHED!');
        console.log(`   - Next reset in ${hours24h}h ${minutes24h}m`);
        console.log(`   - Reset time: ${reset24hTime.toLocaleString()}`);
      }
    }
    
    // If we got a 429, show the Retry-After header if present
    if (response.statusCode === 429 && headers['retry-after']) {
      console.log('\n⏱️  Rate limited - Retry after:', headers['retry-after'], 'seconds');
    }
    
  } catch (error) {
    console.error('❌ Error checking rate limits:');
    console.error(error);
  }
}

// Run the check
checkRateLimits().catch(console.error);
