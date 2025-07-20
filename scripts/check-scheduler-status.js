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

// Function to check if scheduler is running
function checkSchedulerStatus() {
  return new Promise((resolve, reject) => {
    // Check if there are any processes running the scheduler
    const query = `
      SELECT * FROM process_list 
      WHERE name LIKE '%node%' AND info LIKE '%scheduler%'
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        // If the query fails, it might be because the process_list table doesn't exist
        // which is fine, we'll just return an empty result
        resolve([]);
        return;
      }
      resolve(rows || []);
    });
  });
}

// Function to get the next event that should have a reminder
function getNextEventForReminder() {
  return new Promise((resolve, reject) => {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    
    const query = `
      SELECT e.*, 
             datetime(e.start_time, '-' || 60 || ' minutes') as reminder_time_1h,
             datetime(e.start_time, '-' || 10 || ' minutes') as reminder_time_10m
      FROM events e
      WHERE e.start_time > ? AND e.start_time < ?
        AND NOT EXISTS (
          SELECT 1 FROM event_reminders er 
          WHERE er.event_id = e.id AND er.reminder_minutes = 60
        )
      ORDER BY e.start_time ASC
      LIMIT 1
    `;
    
    db.get(query, [now.toISOString(), oneHourFromNow.toISOString()], (err, row) => {
      if (err) {
        console.error('Error in getNextEventForReminder:', err);
        reject(err);
        return;
      }
      resolve(row || null);
    });
  });
}

// Function to get all notification preferences
function getNotificationPreferences() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT up.*, u.email, u.name as user_name
      FROM user_preferences up
      JOIN users u ON up.user_id = u.id
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

// Main function
async function checkScheduler() {
  try {
    console.log('🔍 Checking scheduler status...');
    
    // Check if scheduler process is running
    const schedulerProcesses = await checkSchedulerStatus();
    console.log('\n🔄 SCHEDULER PROCESSES:');
    console.log('-------------------------');
    if (schedulerProcesses.length > 0) {
      console.log(`✅ Scheduler is running (${schedulerProcesses.length} processes)`);
      schedulerProcesses.forEach((proc, index) => {
        console.log(`\nProcess #${index + 1}:`);
        console.log(`  ID: ${proc.id}`);
        console.log(`  User: ${proc.user || 'unknown'}`);
        console.log(`  Command: ${proc.info || 'unknown'}`);
      });
    } else {
      console.log('⚠️  No scheduler processes found. The scheduler may not be running.');
    }
    
    // Check next event that should have a reminder
    console.log('\n⏰ NEXT EVENT NEEDING REMINDER:');
    console.log('-------------------------');
    const nextEvent = await getNextEventForReminder();
    if (nextEvent) {
      console.log(`📅 Event: ${nextEvent.title}`);
      console.log(`🕒 Start Time: ${new Date(nextEvent.start_time).toLocaleString()}`);
      console.log(`🔔 1h Reminder Should Be: ${new Date(nextEvent.reminder_time_1h).toLocaleString()}`);
      console.log(`🔔 10m Reminder Should Be: ${new Date(nextEvent.reminder_time_10m).toLocaleString()}`);
      console.log(`🔗 Event ID: ${nextEvent.id}`);
      
      // Check if the event is within the next hour
      const now = new Date();
      const eventTime = new Date(nextEvent.start_time);
      const timeDiff = (eventTime - now) / (1000 * 60); // in minutes
      
      if (timeDiff < 0) {
        console.log('\n⚠️  This event is in the past!');
      } else if (timeDiff < 60) {
        console.log(`\n⚠️  This event is in ${Math.round(timeDiff)} minutes! Reminders should have been scheduled.`);
      } else {
        console.log(`\nℹ️  This event is in ${Math.round(timeDiff / 60)} hours.`);
      }
    } else {
      console.log('No upcoming events found that need reminders.');
    }
    
    // Check notification preferences
    console.log('\n🔔 NOTIFICATION PREFERENCES:');
    console.log('-------------------------');
    const prefs = await getNotificationPreferences();
    if (prefs.length > 0) {
      console.log(`Found ${prefs.length} users with email notifications enabled:`);
      prefs.forEach((pref, index) => {
        console.log(`\n${index + 1}. ${pref.user_name} (${pref.email})`);
        console.log(`   Email Notifications: ${pref.email_notifications_enabled ? '✅ Enabled' : '❌ Disabled'}`);
        console.log(`   Browser Notifications: ${pref.browser_notifications_enabled ? '✅ Enabled' : '❌ Disabled'}`);
      });
    } else {
      console.log('No users with email notifications enabled found.');
    }
    
    console.log('\n✅ Scheduler check completed');
    
  } catch (error) {
    console.error('❌ Error checking scheduler status:', error);
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
checkScheduler();
