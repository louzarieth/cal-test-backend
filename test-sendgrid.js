const sgMail = require('@sendgrid/mail');
const dotenv = require('dotenv');
dotenv.config();

// Set SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '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');

async function sendTestEmail() {
  const msg = {
    to: 'anass.louzari8@gmail.com',
    from: 'monad@flypass.io', // Use the email you verified with SendGrid
    subject: '🔔 Test Email from Monad Calendar',
    text: 'This is a test email to verify SendGrid integration is working.',
    html: `
      <h1>Test Email from Monad Calendar</h1>
      <p>This is a test email to verify SendGrid integration is working.</p>
      <p>If you received this, the email system is working correctly!</p>
      <p><strong>Time sent:</strong> ${new Date().toLocaleString()}</p>
    `,
  };

  try {
    console.log('Sending test email...');
    await sgMail.send(msg);
    console.log('✅ Test email sent successfully!');
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending test email:');
    console.error(error);
    if (error.response) {
      console.error('Error response body:', error.response.body);
    }
    return { success: false, error };
  }
}

// Run the test
sendTestEmail()
  .then(result => {
    if (result.success) {
      console.log('✅ Email sent successfully!');
    } else {
      console.error('❌ Failed to send email');
    }
  })
  .catch(error => {
    console.error('❌ Unhandled error in test script:');
    console.error(error);
  });
