const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../db/calendar.db');

// Connect to the database
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    return;
  }
  console.log('✅ Connected to the database');
});

// Function to get the next scheduled email
function getNextScheduledEmail() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT er.*, e.title, e.start_time, e.end_time, u.email, u.name as user_name
      FROM event_reminders er
      JOIN events e ON er.event_id = e.id
      JOIN users u ON er.user_id = u.id
      WHERE er.sent_at IS NULL
      ORDER BY er.reminder_time ASC
      LIMIT 1
    `;

    db.get(query, [], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row || null);
    });
  });
}

// Function to get all users who should receive notifications
function getUsersWithNotificationsEnabled() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT u.id, u.name, u.email, up.email_notifications_enabled
      FROM users u
      LEFT JOIN user_preferences up ON u.email = up.email
      WHERE up.email_notifications_enabled = 1
    `;

    db.all(query, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });
  });
}

// Function to get upcoming events with reminders
function getUpcomingEventsWithReminders() {
  return new Promise((resolve, reject) => {
    const now = new Date();
    const query = `
      SELECT e.id, e.title, e.start_time, e.end_time, 
             er.reminder_time, er.reminder_minutes, er.sent_at
      FROM events e
      LEFT JOIN event_reminders er ON e.id = er.event_id
      WHERE e.start_time > ?
      ORDER BY e.start_time ASC
      LIMIT 5
    `;

    db.all(query, [now.toISOString()], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });
  });
}

// Main function
async function checkNextEmail() {
  try {
    console.log('🔍 Checking next scheduled email...');
    
    // Get the next scheduled email
    const nextEmail = await getNextScheduledEmail();
    
    if (nextEmail) {
      console.log('\n📧 NEXT SCHEDULED EMAIL:');
      console.log('-----------------------');
      console.log(`📅 Event: ${nextEmail.title}`);
      console.log(`⏰ Start Time: ${new Date(nextEmail.start_time).toLocaleString()}`);
      console.log(`🔔 Reminder Time: ${new Date(nextEmail.reminder_time).toLocaleString()}`);
      console.log(`👤 Recipient: ${nextEmail.user_name} (${nextEmail.email})`);
      console.log(`⏱️ Reminder set for: ${nextEmail.reminder_minutes} minutes before event`);
      console.log(`📝 Reminder ID: ${nextEmail.id}`);
    } else {
      console.log('ℹ️ No scheduled emails found in the queue.');
    }

    // Get users with notifications enabled
    const usersWithNotifications = await getUsersWithNotificationsEnabled();
    console.log('\n👥 USERS WITH EMAIL NOTIFICATIONS ENABLED:');
    console.log('------------------------------------');
    if (usersWithNotifications.length > 0) {
      usersWithNotifications.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email})`);
      });
    } else {
      console.log('No users with email notifications enabled found.');
    }

    // Get upcoming events with reminders
    const upcomingEvents = await getUpcomingEventsWithReminders();
    console.log('\n📅 UPCOMING EVENTS WITH REMINDERS:');
    console.log('------------------------------------');
    if (upcomingEvents.length > 0) {
      upcomingEvents.forEach((event, index) => {
        console.log(`\n${index + 1}. ${event.title}`);
        console.log(`   🕒 ${new Date(event.start_time).toLocaleString()}`);
        if (event.reminder_time) {
          console.log(`   🔔 Reminder: ${new Date(event.reminder_time).toLocaleString()}`);
          console.log(`   ⏱️ ${event.reminder_minutes} minutes before`);
          console.log(`   Status: ${event.sent_at ? '✅ Sent' : '⏳ Pending'}`);
        } else {
          console.log('   ⚠️ No reminder scheduled');
        }
      });
    } else {
      console.log('No upcoming events with reminders found.');
    }

  } catch (error) {
    console.error('❌ Error checking next email:', error);
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

// Run the check
checkNextEmail();
