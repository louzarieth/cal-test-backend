const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { format } = require('date-fns');

const dbPath = path.join(__dirname, '..', 'db', 'calendar.db');

// Create a direct database connection
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    return;
  }
  
  console.log('Connected to the database.');
  
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  
  // Check events table for today's events
  db.all(`
    SELECT * 
    FROM events 
    WHERE date(start_time) = ? 
    ORDER BY start_time DESC
  `, [today], (err, events) => {
    if (err) {
      console.error('Error fetching events:', err.message);
      db.close();
      return;
    }
    
    console.log(`\n📅 Found ${events.length} events in the database:\n`);
    
    if (events.length > 0) {
      events.forEach((event, index) => {
        console.log(`📌 Event #${index + 1}:`);
        console.log(`   ID: ${event.id}`);
        console.log(`   Event ID: ${event.event_id}`);
        console.log(`   Title: ${event.title}`);
        console.log(`   Description: ${event.description || 'N/A'}`);
        console.log(`   Start: ${format(new Date(event.start_time), 'yyyy-MM-dd HH:mm')}`);
        console.log(`   End: ${format(new Date(event.end_time), 'yyyy-MM-dd HH:mm')}`);
        console.log(`   Type: ${event.event_type || 'N/A'}`);
        console.log(`   Created: ${event.created_at}`);
        console.log(`   Updated: ${event.updated_at || 'Never'}`);
        console.log(`   Deleted: ${event.is_deleted ? 'Yes' : 'No'}`);
        console.log('----------------------------------------');
      });
    } else {
      console.log('No events found in the database.');
    }
    
    // Check event_reminders table
    db.all('SELECT * FROM event_reminders ORDER BY created_at DESC', [], (err, reminders) => {
      if (err) {
        console.error('\nError fetching event reminders:', err.message);
        db.close();
        return;
      }
      
      console.log(`\n🔔 Found ${reminders.length} event reminders in the database:\n`);
      
      if (reminders.length > 0) {
        reminders.forEach((reminder, index) => {
          console.log(`   Reminder #${index + 1}:`);
          console.log(`   ID: ${reminder.id}`);
          console.log(`   Event ID: ${reminder.event_id}`);
          console.log(`   Reminder Minutes: ${reminder.reminder_minutes} minutes before event`);
          console.log(`   Tweet ID: ${reminder.tweet_id || 'N/A'}`);
          console.log(`   Sent At: ${reminder.sent_at || 'Not sent yet'}`);
          console.log(`   Created: ${reminder.created_at}`);
          console.log('----------------------------------------');
        });
      } else {
        console.log('No event reminders found in the database.');
      }
      
      // Close the database connection
      db.close();
    });
  });
});
