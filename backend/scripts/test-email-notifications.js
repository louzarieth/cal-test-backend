const sqlite3 = require('sqlite3').verbose();
const path = require('path');
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

// Function to get users with email notifications enabled
function getUsersWithEmailNotifications() {
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
      resolve(rows || []);
    });
  });
}

// Function to check if a reminder has already been sent
function checkReminderSent(eventId, userId, reminderMinutes) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT COUNT(*) as count 
      FROM event_reminders 
      WHERE event_id = ? 
        AND user_id = ? 
        AND reminder_minutes = ?
        AND reminder_type = 'email'
    `;
    
    db.get(query, [eventId, userId, reminderMinutes], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row.count > 0);
    });
  });
}

// Main function
async function testEmailNotifications() {
  try {
    console.log('🔍 Testing email notifications...');
    
    // Get the next upcoming event
    const event = await getNextUpcomingEvent();
    
    if (!event) {
      console.log('ℹ️ No upcoming events found');
      return;
    }
    
    console.log('\n📅 Next Event:');
    console.log('-------------');
    console.log(`Title: ${event.title}`);
    console.log(`Start Time: ${new Date(event.start_time).toLocaleString()}`);
    console.log(`Event ID: ${event.id}`);
    
    // Get users with email notifications enabled
    const users = await getUsersWithEmailNotifications();
    
    if (users.length === 0) {
      console.log('\nℹ️ No users with email notifications enabled');
      return;
    }
    
    console.log(`\n👥 Found ${users.length} users with email notifications enabled:`);
    
    // Group users by reminder time
    const oneHourUsers = [];
    const tenMinUsers = [];
    
    for (const user of users) {
      const reminderMinutes = user.reminder_minutes || 60; // Default to 60 minutes
      
      // Check if reminder was already sent
      const alreadySent = await checkReminderSent(event.id, user.id, reminderMinutes);
      
      const userInfo = {
        id: user.id,
        email: user.email,
        name: user.name,
        reminderMinutes,
        alreadySent
      };
      
      if (reminderMinutes === 60) {
        oneHourUsers.push(userInfo);
      } else if (reminderMinutes === 10) {
        tenMinUsers.push(userInfo);
      }
    }
    
    // Display 1-hour reminder users
    console.log('\n⏰ 1-Hour Reminder List:');
    console.log('----------------------');
    if (oneHourUsers.length > 0) {
      oneHourUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email}) - ${user.alreadySent ? '✅ Sent' : '⏳ Pending'}`);
      });
    } else {
      console.log('No users with 1-hour reminders');
    }
    
    // Display 10-minute reminder users
    console.log('\n⏰ 10-Minute Reminder List:');
    console.log('-------------------------');
    if (tenMinUsers.length > 0) {
      tenMinUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email}) - ${user.alreadySent ? '✅ Sent' : '⏳ Pending'}`);
      });
    } else {
      console.log('No users with 10-minute reminders');
    }
    
    // Calculate reminder times
    const eventTime = new Date(event.start_time);
    const oneHourBefore = new Date(eventTime.getTime() - (60 * 60 * 1000));
    const tenMinutesBefore = new Date(eventTime.getTime() - (10 * 60 * 1000));
    
    console.log('\n⏰ Reminder Schedule:');
    console.log('-------------------');
    console.log(`Event Time: ${eventTime.toLocaleString()}`);
    console.log(`1-Hour Reminder: ${oneHourBefore.toLocaleString()}`);
    console.log(`10-Minute Reminder: ${tenMinutesBefore.toLocaleString()}`);
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing email notifications:', error);
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

// Run the test
testEmailNotifications();
