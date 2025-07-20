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

  // Get the table info
  db.all("PRAGMA table_info(user_preferences)", [], (err, rows) => {
    if (err) {
      console.error('Error getting table info:', err);
      process.exit(1);
    }

    console.log('\nCurrent schema for user_preferences table:');
    console.table(rows);

    // Get sample data
    db.all("SELECT * FROM user_preferences LIMIT 1", [], (err, data) => {
      if (err) {
        console.error('Error getting sample data:', err);
        process.exit(1);
      }

      console.log('\nSample data from user_preferences:');
      console.log(data);

      // Close the database connection
      db.close();
    });
  });
});
