const { sendEmail, sendEventNotification } = require('../services/notification/emailService');

async function testSendEmail() {
  console.log('Sending test email to monadpulse@gmail.com...');
  console.log('Make sure the SendGrid API key is properly configured in your .env file');
  
  // Example users (in a real app, these would come from your database)
    // Single test recipient for now
  const testUsers = [
    { 
      id: 'test-user-1',
      email: 'monadpulse@gmail.com',
      name: 'Monad Pulse',
      preferences: {
        notifyEmail: true,
        notifyAllEvents: true,
        notify1hBefore: true,
        notify10mBefore: true
      }
    }
  ];
  
  // Test event data - using a future date to trigger notifications
  const testEvent = {
    id: 'test123',
    title: 'Team Meeting',
    start: new Date(Date.now() + 3600000 * 24), // 24 hours from now
    end: new Date(Date.now() + 3600000 * 25),   // 25 hours from now
    description: 'This is a test meeting to check group email notifications.',
    location: 'Conference Room A',
    event_type: 'meeting'
  };
  
  // Send notification to all users
  console.log('Sending notification for event:', testEvent.title);
  console.log('Event time:', testEvent.start.toISOString());
  
  const result = await sendEventNotification(
    testUsers,
    testEvent,
    'in 1 hour'  // Time before event
  );
  
  console.log('SendGrid API Response:', JSON.stringify(result, null, 2));

  if (result.success) {
    console.log('✅ Test email sent successfully!');
  } else {
    console.error('❌ Failed to send test email:', result.error);
  }
}

testSendEmail().catch(console.error);
