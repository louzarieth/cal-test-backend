require('dotenv').config();
const { testPostTweet } = require('../services/twitterService');

async function runTest() {
  try {
    console.log('Starting Twitter test...');
    const result = await testPostTweet();
    console.log('Test completed successfully!', result);
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Exit the process
    process.exit(0);
  }
}

runTest();
