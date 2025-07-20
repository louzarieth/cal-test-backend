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
  // Check if the event_type column exists in the events table
  db.all("PRAGMA table_info(events)", [], (err, columns) => {
    if (err) {
      console.error('Error getting table info:', err);
      process.exit(1);
    }

    const hasEventTypeColumn = columns && Array.isArray(columns) && 
      columns.some(col => col.name === 'event_type');
    
    if (!hasEventTypeColumn) {
      console.log('Adding event_type column to events table...');
      db.run('ALTER TABLE events ADD COLUMN event_type TEXT', (err) => {
        if (err) {
          console.error('Error adding event_type column:', err);
          process.exit(1);
        }
        console.log('Successfully added event_type column to events table');
        process.exit(0);
      });
    } else {
      console.log('event_type column already exists in events table');
      process.exit(0);
    }
  });
});

// Close the database connection when done
process.on('exit', () => {
  db.close();
});
