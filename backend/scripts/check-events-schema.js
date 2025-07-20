const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../db/calendar.db');

// Create a new database connection
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    return;
  }
  console.log('✅ Connected to the database');
});

// Function to run a query and log results
function runQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔍 Running query: ${query}`);
    if (params.length > 0) {
      console.log('With params:', params);
    }
    
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('❌ Query error:', err.message);
        reject(err);
        return;
      }
      
      console.log(`📊 Found ${rows.length} rows`);
      if (rows.length > 0) {
        console.log('Sample row:', JSON.stringify(rows[0], null, 2));
      }
      resolve(rows);
    });
  });
}

// Main function to check events table
async function checkEventsTable() {
  try {
    // Get schema of events table
    await runQuery("PRAGMA table_info(events)");
    
    // Check if there are any events
    await runQuery("SELECT COUNT(*) as count FROM events");
    
    // Get sample event
    await runQuery("SELECT * FROM events LIMIT 1");
    
    // Check for end_time column (if end doesn't exist)
    await runQuery("SELECT * FROM pragma_table_info('events') WHERE name LIKE '%end%'");
    
    // Check for datetime columns
    await runQuery("SELECT * FROM pragma_table_info('events') WHERE type LIKE '%TEXT%' OR type LIKE '%DATETIME%'");
    
    console.log('\n✅ Events table check completed');
  } catch (error) {
    console.error('Error during events table check:', error);
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
checkEventsTable();
