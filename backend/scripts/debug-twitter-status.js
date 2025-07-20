require('dotenv').config();
const https = require('https');
const { TwitterApi } = require('twitter-api-v2');

// Get Twitter credentials from environment
const {
  TWITTER_API_KEY,
  TWITTER_API_SECRET,
  TWITTER_ACCESS_TOKEN,
  TWITTER_ACCESS_SECRET  // Note: This was previously TWITTER_ACCESS_TOKEN_SECRET
} = process.env;

// Check if required environment variables are set
console.log('🔍 Checking environment variables...');
const missingVars = [];
if (!TWITTER_API_KEY) missingVars.push('TWITTER_API_KEY');
if (!TWITTER_API_SECRET) missingVars.push('TWITTER_API_SECRET');
if (!TWITTER_ACCESS_TOKEN) missingVars.push('TWITTER_ACCESS_TOKEN');
if (!TWITTER_ACCESS_SECRET) missingVars.push('TWITTER_ACCESS_SECRET');

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(v => console.log(`   - ${v}`));
  process.exit(1);
}

console.log('✅ All required environment variables are present');

// Log the first few characters of each credential for verification (without exposing full keys)
console.log('\n🔑 Credentials found (partial for verification):');
console.log(`   - API Key: ${TWITTER_API_KEY ? `${TWITTER_API_KEY.substring(0, 5)}...` : 'Not found'}`);
console.log(`   - Access Token: ${TWITTER_ACCESS_TOKEN ? `${TWITTER_ACCESS_TOKEN.substring(0, 5)}...` : 'Not found'}`);

// Initialize Twitter client with the correct environment variable names
const client = new TwitterApi({
  appKey: TWITTER_API_KEY,
  appSecret: TWITTER_API_SECRET,
  accessToken: TWITTER_ACCESS_TOKEN,
  accessSecret: TWITTER_ACCESS_SECRET  // Using the correct variable name here
});

// Function to make a direct HTTP request and log all headers
function makeTwitterRequest(endpoint, method = 'GET') {
  return new Promise((resolve) => {
    console.log(`\n🌐 Making ${method} request to: ${endpoint}`);
    
    const options = {
      hostname: 'api.twitter.com',
      path: endpoint,
      method,
      headers: {
        'Authorization': `Bearer ${TWITTER_ACCESS_TOKEN}`,
        'User-Agent': 'TwitterDebugger/1.0'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      console.log('\n📡 Response Headers:');
      console.log('------------------');
      Object.entries(res.headers).forEach(([key, value]) => {
        console.log(`${key}: ${value}`);
      });
      
      res.on('data', (chunk) => data += chunk);
      
      res.on('end', () => {
        console.log('\n📦 Response Body:');
        console.log('----------------');
        try {
          const json = JSON.parse(data);
          console.log(JSON.stringify(json, null, 2));
          resolve({ statusCode: res.statusCode, headers: res.headers, data: json });
        } catch (e) {
          console.log(data);
          resolve({ statusCode: res.statusCode, headers: res.headers, data });
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Request error:', error);
      resolve({ error });
    });
    
    req.end();
  });
}

// Function to check rate limits using the Twitter API v1.1
async function checkRateLimits() {
  console.log('\n🔄 Checking rate limits...');
  
  // Try to get rate limit status
  try {
    // Use v1.1 API to verify credentials and get rate limits
    const credentials = await client.v1.verifyCredentials();
    console.log('✅ Successfully authenticated with Twitter API v1.1');
    console.log('   - Username:', credentials.screen_name);
    console.log('   - ID:', credentials.id_str);
    
    // Get rate limit status
    const rateLimits = await client.v1.rateLimitStatus();
    console.log('\n📊 Rate Limits:');
    console.log('--------------');
    
    // Display relevant rate limits
    const endpoints = [
      'statuses/update',
      'statuses/user_timeline',
      'users/show',
      'search/tweets'
    ];
    
    endpoints.forEach(endpoint => {
      const limit = rateLimits.resources.statuses[endpoint] || 
                   rateLimits.resources.users[endpoint] ||
                   rateLimits.resources.search[endpoint];
      
      if (limit) {
        const resetTime = new Date(limit.reset * 1000);
        const now = new Date();
        const minutes = Math.ceil((resetTime - now) / (1000 * 60));
        
        console.log(`\n🔹 ${endpoint}:`);
        console.log(`   - Limit:     ${limit.limit}`);
        console.log(`   - Remaining: ${limit.remaining}`);
        console.log(`   - Reset:     ${resetTime.toLocaleString()} (in ~${minutes} minutes)`);
        
        if (limit.remaining === 0) {
          console.log('   ⚠️  RATE LIMITED - No requests remaining');
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking rate limits:');
    
    // Handle rate limit errors
    if (error.rateLimit) {
      console.log('📊 Rate limit info:');
      console.log('   - Limit:', error.rateLimit.limit);
      console.log('   - Remaining:', error.rateLimit.remaining);
      console.log('   - Reset at:', new Date(error.rateLimit.reset * 1000).toLocaleString());
    }
    
    // Handle HTTP errors
    if (error.code === 429) {
      console.log('⛔ RATE LIMITED: You have exceeded the rate limit for this endpoint');
      
      // Check for retry-after header
      const retryAfter = error.rateLimit?.reset || null;
      if (retryAfter) {
        const resetTime = new Date(retryAfter * 1000);
        const now = new Date();
        const minutes = Math.ceil((resetTime - now) / (1000 * 60));
        console.log(`   - Rate limit resets in ~${minutes} minutes (at ${resetTime.toLocaleString()})`);
      }
    }
    
    // Log full error details
    console.log('\n🔍 Full error details:');
    console.log(JSON.stringify({
      code: error.code,
      message: error.message,
      name: error.name,
      rateLimit: error.rateLimit || 'No rate limit info',
      status: error.status || 'No status code',
      ...(error.errors ? { errors: error.errors } : {})
    }, null, 2));
  }
}

// Main function
async function main() {
  console.log('\n🔍 Twitter API Debugger');
  console.log('====================');
  
  // Make a direct request to the Twitter API to check rate limits
  await makeTwitterRequest('/2/tweets/search/recent?query=test&max_results=1');
  
  // Check rate limits using the Twitter client
  await checkRateLimits();
  
  console.log('\n✅ Debugging complete');
}

// Run the debugger
main().catch(console.error);
