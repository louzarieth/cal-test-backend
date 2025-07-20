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
        console.log('First row:', JSON.stringify(rows[0], null, 2));
      }
      resolve(rows);
    });
  });
}

// Main function to check database
async function checkDatabase() {
  try {
    // Check user_event_preferences table
    await runQuery("SELECT * FROM sqlite_master WHERE type='table' AND name='user_event_preferences'");
    
    // Get schema of user_event_preferences
    await runQuery("PRAGMA table_info(user_event_preferences)");
    
    // Get sample data from user_event_preferences
    await runQuery("SELECT * FROM user_event_preferences LIMIT 5");
    
    // Check if there are any enabled preferences
    await runQuery("SELECT COUNT(*) as count FROM user_event_preferences WHERE is_enabled = 1");
    
    // Get distinct event types with enabled preferences
    await runQuery("SELECT DISTINCT event_type FROM user_event_preferences WHERE is_enabled = 1");
    
    // Check users table
    await runQuery("SELECT * FROM users LIMIT 1");
    
    // Check events table
    await runQuery("SELECT * FROM events WHERE end > datetime('now') ORDER BY start ASC LIMIT 1");
    
    console.log('\n✅ Database check completed');
  } catch (error) {
    console.error('Error during database check:', error);
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
checkDatabase();
