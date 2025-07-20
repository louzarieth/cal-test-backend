const axios = require('axios');

// Test data
const testEmail = 'test@example.com';
const baseUrl = 'http://localhost:3001/api';

async function testNotificationPreferences() {
  try {
    console.log('🚀 Testing notification preferences endpoint...');
    
    // 1. Test updating preferences
    console.log('\n1. Updating notification preferences...');
    const updateResponse = await axios.put(
      `${baseUrl}/users/me/preferences`,
      {
        email: testEmail,
        notify_email: true,
        notify_browser: true,
        notify_all_events: true,
        email_1h_before: true,
        email_10m_before: true,
        browser_1h_before: true,
        browser_10m_before: true,
        notify_new_events: true
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    console.log('✅ Update successful!');
    console.log('Response:', JSON.stringify(updateResponse.data, null, 2));
    
    // 2. Test getting the updated preferences
    console.log('\n2. Getting updated preferences...');
    const getResponse = await axios.get(
      `${baseUrl}/users/me/preferences?email=${encodeURIComponent(testEmail)}`
    );
    
    console.log('✅ Get successful!');
    console.log('Current preferences:', JSON.stringify(getResponse.data, null, 2));
    
    // 3. Verify the data was saved correctly
    console.log('\n3. Verifying data...');
    const prefs = getResponse.data.data;
    
    const allTrue = [
      prefs.notify_email,
      prefs.notify_browser,
      prefs.notify_all_events,
      prefs.email_1h_before,
      prefs.email_10m_before,
      prefs.browser_1h_before,
      prefs.browser_10m_before,
      prefs.notify_new_events
    ].every(Boolean);
    
    if (allTrue) {
      console.log('✅ All preferences were saved correctly!');
    } else {
      console.error('❌ Some preferences were not saved correctly');
    }
    
  } catch (error) {
    console.error('❌ Test failed:');
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Response data:', error.response.data);
      console.error('Status code:', error.response.status);
      console.error('Headers:', error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

// Run the test
testNotificationPreferences();
