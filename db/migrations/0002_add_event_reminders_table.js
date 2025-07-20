const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'calendar.db');

// Open the database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
    process.exit(1);
  }
  console.log('Connected to the SQLite database for migration.');
});

// Run the migration
db.serialize(() => {
  // Check if the event_reminders table exists
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='event_reminders'", [], (err, row) => {
    if (err) {
      console.error('Error checking for event_reminders table:', err);
      process.exit(1);
    }

    if (!row) {
      console.log('Creating event_reminders table...');
      
      db.run(`
        CREATE TABLE event_reminders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id TEXT NOT NULL,
          reminder_minutes INTEGER NOT NULL,
          sent_at DATETIME,
          tweet_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME,
          FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
          UNIQUE(event_id, reminder_minutes)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating event_reminders table:', err);
          process.exit(1);
        }
        
        console.log('Successfully created event_reminders table');
        
        // Create index for better performance
        db.run('CREATE INDEX IF NOT EXISTS idx_event_reminders_event_id ON event_reminders(event_id)', (err) => {
          if (err) {
            console.error('Error creating index on event_reminders:', err);
            process.exit(1);
          }
          console.log('Created index on event_reminders.event_id');
          process.exit(0);
        });
      });
    } else {
      console.log('event_reminders table already exists');
      process.exit(0);
    }
  });
});

// Close the database connection when done
process.on('exit', () => {
  db.close();
});
