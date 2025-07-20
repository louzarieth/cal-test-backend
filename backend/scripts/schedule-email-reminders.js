const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { sendEmail } = require('../services/emailService');
const dbPath = path.join(__dirname, '../db/calendar.db');

// Connect to the database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    return;
  }
  console.log('✅ Connected to the database');
});

// Function to get the next upcoming event
function getNextUpcomingEvent() {
  return new Promise((resolve, reject) => {
    const now = new Date();
    const query = `
      SELECT * FROM events 
      WHERE start_time > ?
      ORDER BY start_time ASC
      LIMIT 1
    `;
    
    db.get(query, [now.toISOString()], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row || null);
    });
  });
}

// Function to get users with email notifications enabled for an event
function getUsersWithEmailNotifications(eventId) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT u.id, u.email, u.name,
             up.email_notifications_enabled,
             up.reminder_minutes
      FROM users u
      JOIN user_preferences up ON u.email = up.email
      WHERE up.email_notifications_enabled = 1
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Filter users who want 1h or 10m reminders
      const users = rows.map(user => ({
        ...user,
        reminder_minutes: user.reminder_minutes || 60 // Default to 60 minutes if not set
      }));
      
      resolve(users);
    });
  });
}

// Function to schedule an email reminder
function scheduleEmailReminder(user, event, reminderMinutes) {
  return new Promise((resolve, reject) => {
    const eventTime = new Date(event.start_time);
    const reminderTime = new Date(eventTime.getTime() - (reminderMinutes * 60 * 1000));
    const now = new Date();
    
    // If the reminder time is in the past, don't schedule it
    if (reminderTime < now) {
      console.log(`⚠️  Reminder time for ${user.email} is in the past, not scheduling`);
      resolve(false);
      return;
    }
    
    // Calculate delay in milliseconds
    const delay = reminderTime - now;
    
    console.log(`⏰ Scheduling email for ${user.email} at ${reminderTime.toLocaleString()} (${reminderMinutes} min before event)`);
    
    // Schedule the email
    const timer = setTimeout(async () => {
      try {
        console.log(`✉️  Sending email to ${user.email} for event: ${event.title}`);
        
        // Create email content
        const subject = `🔔 Reminder: ${event.title} starts soon!`;
        const text = `
          Hello ${user.name || 'there'},
          
          This is a reminder for the upcoming event:
          
          Event: ${event.title}
          Time: ${new Date(event.start_time).toLocaleString()}
          
          ${event.description ? `\n${event.description}\n` : ''}
          Don't forget to join on time!
          
          Best regards,
          Your Calendar Team
        `;
        
        // Send the email
        await sendEmail({
          to: user.email,
          subject,
          text: text.trim()
        });
        
        console.log(`✅ Email sent to ${user.email}`);
        
        // Record that we've sent this reminder
        await recordReminderSent(user.id, event.id, reminderMinutes);
        
      } catch (error) {
        console.error(`❌ Failed to send email to ${user.email}:`, error.message);
      }
    }, delay);
    
    // Store the timer so we can clear it if needed
    scheduledTimers.push(timer);
    
    resolve(true);
  });
}

// Function to record that a reminder was sent
function recordReminderSent(userId, eventId, reminderMinutes) {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO event_reminders (
        event_id, email,reminder_minutes, 
        reminder_type,
        sent_at,
        reminder_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP), datetime(?, ? || ' minutes'))
    `;
    
    db.run(query, [
      eventId, 
      userId, 
      reminderMinutes,
      `-${reminderMinutes}`
    ], function(err) {
      if (err) {
        console.error('Error recording reminder:', err.message);
        reject(err);
        return;
      }
      resolve();
    });
  });
}

// Store scheduled timers so we can clear them if needed
const scheduledTimers = [];

// Main function
async function scheduleAllReminders() {
  try {
    console.log('🔍 Checking for upcoming events...');
    
    // Get the next upcoming event
    const event = await getNextUpcomingEvent();
    
    if (!event) {
      console.log('ℹ️ No upcoming events found');
      return;
    }
    
    console.log(`\n📅 Next Event: ${event.title}`);
    console.log(`   🕒 ${new Date(event.start_time).toLocaleString()}`);
    
    // Get users who want email notifications
    const users = await getUsersWithEmailNotifications(event.id);
    
    if (users.length === 0) {
      console.log('ℹ️ No users with email notifications enabled');
      return;
    }
    
    console.log(`\n👥 Found ${users.length} users with email notifications enabled`);
    
    // Group users by reminder time
    const oneHourUsers = users.filter(u => u.reminder_minutes === 60);
    const tenMinUsers = users.filter(u => u.reminder_minutes === 10);
    
    console.log(`   • ${oneHourUsers.length} users want 1-hour reminders`);
    console.log(`   • ${tenMinUsers.length} users want 10-minute reminders`);
    
    // Schedule 1-hour reminders
    console.log('\n⏳ Scheduling 1-hour reminders...');
    for (const user of oneHourUsers) {
      await scheduleEmailReminder(user, event, 60);
    }
    
    // Schedule 10-minute reminders
    console.log('\n⏳ Scheduling 10-minute reminders...');
    for (const user of tenMinUsers) {
      await scheduleEmailReminder(user, event, 10);
    }
    
    console.log('\n✅ All reminders scheduled successfully!');
    
  } catch (error) {
    console.error('❌ Error scheduling reminders:', error);
  } finally {
    // Close the database connection
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('\n✅ Database connection closed');
      }
    });
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping scheduler...');
  
  // Clear any pending timers
  scheduledTimers.forEach(timer => clearTimeout(timer));
  
  // Close the database connection
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
      process.exit(1);
    }
    console.log('✅ Cleanup complete');
    process.exit(0);
  });
});

// Run the scheduler
scheduleAllReminders();
