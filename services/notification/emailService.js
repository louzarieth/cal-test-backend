const sgMail = require('@sendgrid/mail');
const { format, formatDistanceToNow } = require('date-fns');

// Set SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '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');

const FROM_EMAIL = process.env.FROM_EMAIL || 'monad@flypass.io';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Email template for event notifications
const eventNotificationTemplate = (event, timeBefore, user) => {
  const eventStart = new Date(event.start_time);
  const eventEnd = new Date(event.end_time);

  let formattedDate = 'Invalid date';
  let formattedTime = 'Invalid time';
  let timeUntil = '';
  if (!isNaN(eventStart) && !isNaN(eventEnd)) {
    formattedDate = format(eventStart, 'EEEE, MMMM do, yyyy');
    formattedTime = `${format(eventStart, 'h:mm a')} - ${format(eventEnd, 'h:mm a')}`;
    timeUntil = formatDistanceToNow(eventStart, { addSuffix: true });
  } else {
    console.error('Invalid date:', event.start, event.end);
    formattedDate = `Invalid date: ${event.start}`;
    formattedTime = `Invalid time: ${event.start} - ${event.end}`;
    timeUntil = '';
  }

  // Base URL for calendar links (frontend URL)
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const eventUrl = `${baseUrl}/event/${encodeURIComponent(event.id)}`;
  
  // Format description with proper line breaks
  const formattedDescription = event.description 
    ? event.description.replace(/\n/g, '<br>')
    : 'No description provided.';
  
  return {
    subject: `🔔 Monad Alert: ${event.title} starts ${timeBefore}`,
    text: `
      Event: ${event.title}
      Date: ${formattedDate}
      Time: ${formattedTime}
      ${event.location ? `Location: ${event.location}\n` : ''}
      ${formattedDescription}
      
      This event starts in ${timeUntil}.
      
      View event: ${eventUrl}
      
      ---
      You're receiving this email because you have email notifications enabled for ${event.title || 'this type of event'}.
      To change your notification preferences, visit: ${baseUrl}/settings/notifications
    `,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
          <h1 style="color: #1a73e8; margin-top: 0;">🔔 ${event.title}</h1>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 15px 0;">
            <p style="font-size: 18px; margin: 0 0 10px 0; color: #202124;">
              <strong>Starts:</strong> ${formattedDate} at ${format(eventStart, 'h:mm a')}<br>
              <strong>Ends:</strong> ${formattedDate} at ${format(eventEnd, 'h:mm a')}
              ${event.location ? `<br><strong>Location:</strong> ${event.location}` : ''}
            </p>
            
            <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 4px;">
              ${formattedDescription}
            </div>
            
            <p style="color: #5f6368; font-size: 14px; margin: 10px 0 0 0;">
              This event starts in ${timeBefore} (${timeUntil}).
            </p>
            
            <div style="margin-top: 25px; text-align: center;">
              <a href="https://monadpulse.vercel.com" style="display: inline-block; padding: 12px 24px; background-color: #4285f4; color: white; text-decoration: none; border-radius: 4px; font-weight: 500; margin: 20px 0;">View Event</a>
            </div>
          </div>
          
          <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #5f6368;">
            <p style="margin: 5px 0;">
              You're receiving this email because you have email notifications enabled for 
              <strong>${event.title || 'this type of event'}</strong>.
            </p>
            <p style="margin: 5px 0 0 0;">
              <a href="https://monadpulse.vercel.com" style="color: #1a73e8; text-decoration: none;">
                Manage notification preferences
              </a>
              <span style="margin: 0 5px;">•</span>
              <a href="https://monadpulse.vercel.com" style="color: #5f6368; text-decoration: none;">
                Unsubscribe
              </a>
            </p>
          </div>
        </div>
      </div>
    `
  };
};

/**
 * Send an email notification to multiple recipients at once
 * @param {string|string[]} to Recipient email address(es)
 * @param {string} subject Email subject
 * @param {string} text Email text content
 * @param {string} html HTML content (optional)
 */
const sendEmail = async (to, subject, text, html = '') => {
  try {
    const recipients = Array.isArray(to) ? to : [to];
    
    // For batch email notifications, use a generic 'to' and all real recipients in BCC
    const msg = {
      to: 'noreply@monad.calendar', // or FROM_EMAIL if you prefer
      bcc: recipients,
      from: {
        email: FROM_EMAIL,
        name: 'Calendar Notifications'
      },
      subject,
      text,
      html: html || text,
      trackingSettings: {
        clickTracking: {
          enable: true,
          enableText: true
        },
        openTracking: {
          enable: true
        }
      },
      mailSettings: {
        sandboxMode: {
          enable: false
        }
      }
    };

    await sgMail.send(msg);
    console.log(`Email sent to ${recipients.length} recipients: ${subject}`);
    return { success: true, recipients: recipients.length };
  } catch (error) {
    console.error('Error sending email via SendGrid:', error.response?.body || error.message);
    return { 
      success: false, 
      error: error.response?.body?.errors?.[0]?.message || error.message 
    };
  }
};

/**
 * Send a notification for an upcoming event to all participants
 * @param {Object[]} users Array of user objects with notification preferences
 * @param {Object} event Event object
 * @param {string} timeBefore Time before event to send notification (e.g., '1 hour')
 */
const sendEventNotification = async (users, event, timeBefore) => {
  const { getDb } = require('../../db');
  const db = await getDb();
  
  try {
    // Filter users with valid email addresses and email notifications enabled
    const validUsers = users.filter(user => user && user.email && user.notify_email === 1);
    
    if (validUsers.length === 0) {
      console.log('No valid email addresses found for notification');
      return { success: false, error: 'No valid email addresses' };
    }

    // Calculate reminder minutes based on timeBefore
    const reminderMinutes = timeBefore.includes('hour') ? 60 : 10;
    
    // Get email addresses of all recipients
    const recipientEmails = validUsers.map(user => user.email);
    
    // Create a generic notification (without user-specific content)
    const { subject, text, html } = eventNotificationTemplate(event, timeBefore, {});
    
    // Mark the reminder as sent in the database
    
    // Loop through each valid user to update reminders individually
for (const user of validUsers) {
  try {
    await db.run(
      `INSERT INTO event_reminders (event_id, user_id, reminder_minutes, sent_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(event_id, user_id, reminder_minutes) 
       DO UPDATE SET sent_at = CURRENT_TIMESTAMP`,
      [event.id, user.id, reminderMinutes]
    );
  } catch (dbError) {
    console.error(`Error updating event_reminders for user ${user.id}:`, dbError);
    // Optional: continue or handle errors based on use case
  }
}

    
    // Send a single email to all recipients
    const result = await sendEmail(
      recipientEmails,
      subject,
      text,
      html
    );
    
    return result;
  } catch (error) {
    console.error('Error sending event notification:', error);
    return { 
      success: false, 
      error: error.response?.body?.errors?.[0]?.message || error.message 
    };
  }
};

/**
 * Send a welcome email with notification settings
 * @param {Object} user User object
 */
const sendWelcomeEmail = async (user) => {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const settingsUrl = `${baseUrl}/settings/notifications`;
  
  const subject = 'Welcome to Calendar Notifications!';
  const text = `
    Welcome to Calendar Notifications, ${user.name || 'there'}! 🎉
    
    We're excited to help you stay on top of your schedule. Here's what you can do:
    
    1. Get email reminders for upcoming events
    2. Receive browser notifications
    3. Customize which events trigger notifications
    
    Manage your notification preferences here: ${settingsUrl}
    
    If you have any questions, just reply to this email and we'll help you out.
    
    Best regards,
    The Calendar Team
  `;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f5f5f5; padding: 30px; border-radius: 8px;">
        <h1 style="color: #1a73e8; margin-top: 0;">Welcome to Calendar Notifications, ${user.name || 'there'}! 🎉</h1>
        
        <div style="background: white; padding: 25px; border-radius: 8px; margin: 20px 0;">
          <p style="font-size: 16px; line-height: 1.6; color: #202124;">
            We're excited to help you stay on top of your schedule. Here's what you can do:
          </p>
          
          <ul style="font-size: 15px; line-height: 1.8; color: #202124; padding-left: 20px;">
            <li>Get email reminders for upcoming events</li>
            <li>Receive browser notifications</li>
            <li>Customize which events trigger notifications</li>
          </ul>
          
          <div style="margin: 30px 0; text-align: center;">
            <a href="${settingsUrl}" 
               style="display: inline-block; background-color: #1a73e8; color: white; 
                      text-decoration: none; padding: 12px 24px; border-radius: 4px; 
                      font-weight: bold; font-size: 16px;">
              Manage Notifications
            </a>
          </div>
          
          <p style="font-size: 15px; line-height: 1.6; color: #5f6368;">
            If you have any questions, just reply to this email and we'll help you out.
          </p>
        </div>
        
        <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #5f6368;">
          <p style="margin: 5px 0;">
            <a href="${baseUrl}" style="color: #1a73e8; text-decoration: none;">Calendar App</a>
            <span style="margin: 0 5px;">•</span>
            <a href="${baseUrl}/settings/notifications" style="color: #5f6368; text-decoration: none;">Notification Settings</a>
            <span style="margin: 0 5px;">•</span>
            <a href="${baseUrl}/unsubscribe/${user.id}" style="color: #5f6368; text-decoration: none;">Unsubscribe</a>
          </p>
        </div>
      </div>
    </div>
  `;
  
  return sendEmail(user.email, subject, text.trim(), html);
};

module.exports = {
  sendEmail,
  sendEventNotification,
  sendWelcomeEmail,
};
