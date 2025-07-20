const { getDb } = require('./db');
const sgMail = require('@sendgrid/mail');
const dotenv = require('dotenv');
dotenv.config();

// Set SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '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');

console.log('📧 Starting test email to all users...');
console.log('-------------------------------------');

async function sendTestEmailToAll() {
  const startTime = new Date();
  console.log(`⏱️  Start time: ${startTime.toLocaleString()}`);
  
  try {
    console.log('🔍 Connecting to database...');
    const db = await getDb();
    
    // Get all users with email addresses
    console.log('📋 Fetching user emails...');
    const users = await new Promise((resolve, reject) => {
      db.all(
        'SELECT DISTINCT email, name FROM users WHERE email IS NOT NULL AND email != ?', 
        ['default@example.com'], // Exclude default/example emails
        (err, rows) => {
          if (err) {
            console.error('❌ Database error:', err);
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });

    if (!users || users.length === 0) {
      console.log('❌ No users with email addresses found in the database');
      return { success: false, message: 'No users found' };
    }

    console.log(`\n📬 Found ${users.length} users with email addresses:`);
    users.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} (${user.name || 'No name'})`);
    });

    // Prepare email content
    const emailContent = {
      from: 'monad@flypass.io',
      subject: '🔔 Test Email from Monad Calendar',
      text: `Hello,\n\nThis is a test email to verify the notification system.\n\nIf you received this, email notifications are working correctly!`,
      html: `
        <h1>Test Email from Monad Calendar</h1>
        <p>Hello,</p>
        <p>This is a test email to verify the notification system.</p>
        <p>If you received this, email notifications are working correctly!</p>
        <p><strong>Time sent:</strong> ${new Date().toLocaleString()}</p>
      `
    };

    console.log('\n✉️  Sending test emails...');
    console.log(`   From: ${emailContent.from}`);
    console.log(`   To: ${users.length} recipients`);

    // Prepare all recipients in BCC
    const bccEmails = users.map(user => user.email);
    
    // Update email content to be more generic for BCC-only sending
    const personalizedHtml = emailContent.html
      .replace('Hello,', `Hello`)
      .replace('This is a test email', `This is a test email from Monad Calendar`);
    
    // Prepare the email with all recipients in BCC
    const msg = {
      ...emailContent,
      to: 'monad@flypass.io',  // Generic 'to' address
      bcc: bccEmails,
      html: personalizedHtml,
      text: `Hello,\n\nThis is a test email from Monad Calendar.\n\nIf you received this, email notifications are working correctly!`
    };
    
    let successCount = 0;
    const failedEmails = [];
    
    try {
      // Send a single email with all recipients in CC
      await sgMail.send(msg);
      console.log(`   ✓ Sent to all recipients in BCC`);
      console.log(`   ✓ BCC recipients: ${bccEmails.join(', ')}`);
      successCount = users.length;
    } catch (error) {
      console.error('   ✗ Failed to send email:', error.message);
      failedEmails.push(...users.map(user => ({
        email: user.email,
        error: error.message
      })));
    }
    
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    
    console.log('\n📊 Email sending summary:');
    console.log(`   Total recipients: ${users.length}`);
    console.log(`   Successfully sent: ${successCount}`);
    if (failedEmails.length > 0) {
      console.log(`   Failed to send: ${failedEmails.length}`);
      console.log('   Failed emails:', failedEmails.map(f => f.email).join(', '));
    }
    
    console.log(`\n✅ Test emails sent!`);
    console.log(`   Started: ${startTime.toLocaleTimeString()}`);
    console.log(`   Finished: ${endTime.toLocaleTimeString()}`);
    console.log(`   Duration: ${duration.toFixed(2)} seconds`);
    
    return { 
      success: failedEmails.length === 0,
      message: `Sent to ${successCount} of ${users.length} recipients`,
      successCount,
      failedCount: failedEmails.length,
      failedEmails,
      startTime,
      endTime,
      duration
    };
    
  } catch (error) {
    console.error('\n❌ Error in test email script:');
    console.error(error);
    
    return { 
      success: false, 
      message: error.message,
      error: error.toString(),
      time: new Date().toISOString()
    };
  }
}

// Run the function and handle the result
sendTestEmailToAll()
  .then(result => {
    console.log('\n🏁 Script execution completed');
    console.log('-------------------------------------');
    if (result.success) {
      console.log('✅ SUCCESS:', result.message);
    } else {
      console.log('❌ PARTIAL SUCCESS:', result.message);
      if (result.failedEmails && result.failedEmails.length > 0) {
        console.log(`   Failed to send to ${result.failedEmails.length} emails`);
      }
    }
    console.log('-------------------------------------\n');
    
    // Exit with appropriate status code
    process.exit(result.success ? 0 : 1);
  })
  .catch(err => {
    console.error('\n💥 Unhandled error in script:');
    console.error(err);
    console.log('\n❌ Script execution failed');
    console.log('-------------------------------------\n');
    process.exit(1);
  });
