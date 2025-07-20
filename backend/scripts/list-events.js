const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize database connection
const dbPath = path.join(__dirname, '..', 'db', 'calendar.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to the database');
});

// Get all events
console.log('📅 Listing all events in the database:');
db.all('SELECT id, title, start_time, end_time, event_type FROM events WHERE is_deleted = 0 ORDER BY start_time', [], (err, rows) => {
  if (err) {
    console.error('Error fetching events:', err.message);
    return;
  }
  
  if (rows.length === 0) {
    console.log('No events found in the database.');
  } else {
    console.log(`Found ${rows.length} events:`);
    console.table(rows.map(row => ({
      id: row.id,
      title: row.title,
      start_time: new Date(row.start_time).toLocaleString(),
      end_time: new Date(row.end_time).toLocaleString(),
      event_type: row.event_type || 'N/A'
    })));
  }
  
  // Close the database connection
  db.close();
});
