const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../db/calendar.db');

// Open the database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
    process.exit(1);
  }
  console.log('Connected to the SQLite database.');

  // Get schema of events table
  db.all("PRAGMA table_info(events)", [], (err, schema) => {
    if (err) {
      console.error('Error getting schema:', err);
      process.exit(1);
    }

    console.log('\nSchema for events table:');
    console.table(schema);

    // Get sample data
    db.all("SELECT * FROM events LIMIT 5", [], (err, rows) => {
      if (err) {
        console.error('Error getting sample data:', err);
        process.exit(1);
      }

      console.log('\nSample events data:');
      console.table(rows);
      
      // Count total events
      db.get("SELECT COUNT(*) as count FROM events", [], (err, row) => {
        if (err) {
          console.error('Error counting events:', err);
          process.exit(1);
        }
        console.log(`\nTotal events in database: ${row.count}`);
        
        // Check for events in the future
        const now = new Date().toISOString();
        db.get("SELECT COUNT(*) as count FROM events WHERE start_datetime > ?", [now], (err, row) => {
          if (err) {
            console.error('Error counting future events:', err);
            process.exit(1);
          }
          console.log(`Events in the future: ${row.count}`);
          
          // Get the next upcoming event
          db.get(
            "SELECT id, summary as title, start_datetime as start, end_datetime as end, description, html_link " +
            "FROM events WHERE start_datetime > ? ORDER BY start_datetime ASC LIMIT 1", 
            [now], 
            (err, event) => {
              if (err) {
                console.error('Error getting next event:', err);
                process.exit(1);
              }
              
              if (event) {
                console.log('\nNext upcoming event:');
                console.log(`Title: ${event.title}`);
                console.log(`Start: ${new Date(event.start).toLocaleString()}`);
                console.log(`End:   ${new Date(event.end).toLocaleString()}`);
                console.log(`ID:    ${event.id}`);
                
                // Check for scheduled reminders for this event
                db.all(
                  "SELECT * FROM event_reminders WHERE event_id = ?", 
                  [event.id], 
                  (err, reminders) => {
                    if (err) {
                      console.error('Error checking reminders:', err);
                      process.exit(1);
                    }
                    
                    console.log(`\nFound ${reminders.length} scheduled reminders for this event:`);
                    reminders.forEach((reminder, i) => {
                      console.log(`[${i + 1}] Type: ${reminder.reminder_type}, ` +
                                  `Time: ${new Date(reminder.reminder_time).toLocaleString()}, ` +
                                  `Status: ${reminder.status}`);
                    });
                    
                    process.exit(0);
                  }
                );
              } else {
                console.log('\nNo upcoming events found.');
                process.exit(0);
              }
            }
          );
        });
      });
    });
  });
});
