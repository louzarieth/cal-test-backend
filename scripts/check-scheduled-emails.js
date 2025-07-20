const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../db/calendar.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking scheduled email notifications...');
console.log('--------------------------------------');

// Check scheduled email reminders
db.all(
  `SELECT er.*, e.title, e.start_time, e.end_time, e.description 
   FROM event_reminders er
   JOIN events e ON er.event_id = e.id
   WHERE er.sent_at IS NULL
   ORDER BY e.start_time ASC`,
  [],
  (err, reminders) => {
    if (err) {
      console.error('Error fetching scheduled emails:', err.message);
      return;
    }

    if (reminders.length === 0) {
      console.log('No scheduled email notifications found.');
    } else {
      console.log(`Found ${reminders.length} scheduled email notifications:\n`);
      
      reminders.forEach((reminder, index) => {
        console.log(`[${index + 1}] Event: ${reminder.title}`);
        console.log(`    ID: ${reminder.event_id}`);
        console.log(`    Notification Time: ${new Date(reminder.notification_time).toLocaleString()}`);
        console.log(`    Reminder Type: ${reminder.reminder_type}`);
        console.log(`    Start Time: ${new Date(reminder.start_time).toLocaleString()}`);
        console.log(`    End Time: ${new Date(reminder.end_time).toLocaleString()}`);
        console.log(`    Description: ${reminder.description || 'No description'}\n`);
      });
    }
  }
);

// Check user notification preferences
db.all(
  `SELECT up.user_id, up.notify_email, up.notify_all_events, 
          up.notify_1h_before, up.notify_10m_before,
          u.email
   FROM user_preferences up
   JOIN users u ON up.user_id = u.id
   WHERE up.notify_email = 1`,
  [],
  (err, users) => {
    if (err) {
      console.error('Error fetching user preferences:', err.message);
      return;
    }

    console.log('\nUsers with email notifications enabled:');
    console.log('--------------------------------------');
    
    if (users.length === 0) {
      console.log('No users with email notifications enabled found.');
    } else {
      users.forEach(user => {
        console.log(`User: ${user.email} (ID: ${user.user_id})`);
        console.log(`  - Notify All Events: ${user.notify_all_events ? '✅' : '❌'}`);
        console.log(`  - 1 Hour Reminder: ${user.notify_1h_before ? '✅' : '❌'}`);
        console.log(`  - 10 Minute Reminder: ${user.notify_10m_before ? '✅' : '❌'}\n`);
      });
    }
    
    // Close the database connection
    db.close();
  }
);
