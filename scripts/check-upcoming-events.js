const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../db/calendar.db');
const db = new sqlite3.Database(dbPath);

const now = new Date();
const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

console.log('Checking for upcoming events...');
console.log(`Current time: ${now.toISOString()}`);
console.log(`Looking for events before: ${oneDayFromNow.toISOString()}`);
console.log('--------------------------------------');

// Check upcoming events
db.all(
  `SELECT id, title, start_time, end_time, description, event_type 
   FROM events 
   WHERE start_time > ? AND start_time < ?
   ORDER BY start_time ASC`,
  [now.toISOString(), oneDayFromNow.toISOString()],
  (err, events) => {
    if (err) {
      console.error('Error fetching upcoming events:', err.message);
      return;
    }

    if (events.length === 0) {
      console.log('No upcoming events found in the next 24 hours.');
    } else {
      console.log(`Found ${events.length} upcoming event(s):\n`);
      
      events.forEach((event, index) => {
        const startTime = new Date(event.start_time);
        const timeUntil = Math.round((startTime - now) / (60 * 1000)); // minutes until event
        
        console.log(`[${index + 1}] ${event.title}`);
        console.log(`    ID: ${event.id}`);
        console.log(`    Start: ${startTime.toISOString()} (in ${timeUntil} minutes)`);
        console.log(`    Type: ${event.event_type || 'No type'}`);
        console.log(`    Description: ${event.description || 'No description'}`);
        
        // Check if there are any reminders scheduled for this event
        db.all(
          `SELECT * FROM event_reminders 
           WHERE event_id = ? AND sent_at IS NULL`,
          [event.id],
          (err, reminders) => {
            if (err) {
              console.error(`Error checking reminders for event ${event.id}:`, err.message);
              return;
            }
            
            if (reminders.length === 0) {
              console.log('    ❌ No scheduled reminders for this event');
            } else {
              console.log(`    ✅ ${reminders.length} reminder(s) scheduled:`);
              reminders.forEach(reminder => {
                const reminderTime = new Date(reminder.notification_time);
                const timeUntilReminder = Math.round((reminderTime - now) / (60 * 1000));
                console.log(`        - ${reminder.reminder_type} at ${reminderTime.toISOString()} (in ${timeUntilReminder} minutes)`);
              });
            }
            console.log('');
          }
        );
      });
    }
    
    // Close the database connection after a short delay to allow async operations to complete
    setTimeout(() => db.close(), 1000);
  }
);
