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

// Function to check the schema of the event_reminders table
function checkEventRemindersSchema() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT sql FROM sqlite_master 
      WHERE type='table' AND name='event_reminders'
    `;

    db.get(query, [], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row ? row.sql : null);
    });
  });
}

// Function to get all scheduled reminders
function getAllScheduledReminders() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT er.*, e.title, e.start_time, 
             datetime(e.start_time, '-' || er.reminder_minutes || ' minutes') as calculated_reminder_time
      FROM event_reminders er
      JOIN events e ON er.event_id = e.id
      WHERE er.sent_at IS NULL
      ORDER BY e.start_time ASC
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

// Function to get upcoming events
function getUpcomingEvents() {
  return new Promise((resolve, reject) => {
    const now = new Date();
    const query = `
      SELECT id, title, start_time, end_time, event_type
      FROM events 
      WHERE start_time > ?
      ORDER BY start_time ASC
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
async function checkReminders() {
  try {
    console.log('🔍 Checking event reminders...');
    
    // Check the schema of event_reminders table
    console.log('\n📋 EVENT_REMINDERS TABLE SCHEMA:');
    console.log('------------------------------------');
    const schema = await checkEventRemindersSchema();
    console.log(schema || 'Table event_reminders does not exist');

    // Get all scheduled reminders
    console.log('\n⏰ SCHEDULED REMINDERS:');
    console.log('------------------------------------');
    const reminders = await getAllScheduledReminders();
    
    if (reminders.length > 0) {
      reminders.forEach((reminder, index) => {
        console.log(`\nReminder #${index + 1}:`);
        console.log('-------------------');
        console.log(`ID: ${reminder.id}`);
        console.log(`Event: ${reminder.title}`);
        console.log(`Event Time: ${new Date(reminder.start_time).toLocaleString()}`);
        console.log(`Reminder: ${reminder.reminder_minutes} minutes before`);
        console.log(`Calculated Reminder Time: ${new Date(reminder.calculated_reminder_time).toLocaleString()}`);
        console.log(`Status: ${reminder.sent_at ? `Sent at ${new Date(reminder.sent_at).toLocaleString()}` : '⏳ Pending'}`);
      });
    } else {
      console.log('No scheduled reminders found.');
    }

    // Get upcoming events
    console.log('\n📅 UPCOMING EVENTS:');
    console.log('------------------------------------');
    const events = await getUpcomingEvents();
    
    if (events.length > 0) {
      events.forEach((event, index) => {
        console.log(`\n${index + 1}. ${event.title}`);
        console.log(`   🕒 Start: ${new Date(event.start_time).toLocaleString()}`);
        console.log(`   🏁 End: ${new Date(event.end_time).toLocaleString()}`);
        console.log(`   🏷️  Type: ${event.event_type || 'default'}`);
      });
    } else {
      console.log('No upcoming events found.');
    }

  } catch (error) {
    console.error('❌ Error checking reminders:', error);
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
checkReminders();
