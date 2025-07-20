const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../db/calendar.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking database schema...');
console.log('-------------------------');

// List all tables
db.all(
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
  [],
  (err, tables) => {
    if (err) {
      console.error('Error listing tables:', err.message);
      return;
    }

    console.log('\nTables in database:');
    console.log('-------------------');
    tables.forEach(table => {
      console.log(`- ${table.name}`);
    });

    // Check event_reminders table structure
    db.get(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='event_reminders'",
      [],
      (err, result) => {
        if (err) {
          console.error('Error getting event_reminders schema:', err.message);
          return;
        }

        if (!result) {
          console.log('\n❌ event_reminders table does not exist!');
          console.log('This is why no reminders are being scheduled.');
          return;
        }

        console.log('\n🔍 event_reminders table schema:');
        console.log('--------------------------------');
        console.log(result.sql);

        // Check if status column exists
        db.get(
          "PRAGMA table_info(event_reminders)",
          [],
          (err, columns) => {
            if (err) {
              console.error('Error getting column info:', err.message);
              return;
            }

            console.log('\n📋 event_reminders columns:');
            console.log('-------------------------');
            console.log(columns);
            
            // Check if status column exists
            const hasStatusColumn = columns.some(col => col.name === 'status');
            console.log(`\nStatus column exists: ${hasStatusColumn ? '✅ Yes' : '❌ No'}`);
            
            if (!hasStatusColumn) {
              console.log('\n⚠️  The "status" column is missing from event_reminders table.');
              console.log('This is preventing reminders from being scheduled.');
              console.log('\nTo fix this, you need to add the status column with:');
              console.log('ALTER TABLE event_reminders ADD COLUMN status TEXT DEFAULT \'scheduled\';');
            }
          }
        );
      }
    );

    // Check if there are any records in event_reminders
    db.get("SELECT COUNT(*) as count FROM event_reminders", [], (err, result) => {
      if (err) {
        console.error('Error counting event_reminders:', err.message);
        return;
      }
      console.log(`\n📊 Number of records in event_reminders: ${result.count}`);
      
      if (result.count > 0) {
        console.log('\nFirst few records in event_reminders:');
        db.all("SELECT * FROM event_reminders LIMIT 5", [], (err, rows) => {
          if (err) {
            console.error('Error fetching event_reminders:', err.message);
            return;
          }
          console.log(rows);
          db.close();
        });
      } else {
        console.log('The event_reminders table is empty.');
        db.close();
      }
    });
  }
);
