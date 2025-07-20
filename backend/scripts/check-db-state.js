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

// Main function to check database state
async function checkDatabaseState() {
  try {
    // 1. Check if tables exist
    const tables = await runQuery(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    console.log('\n📋 Database tables:', tables.map(t => t.name).join(', '));

    // 2. Check users table
    await runQuery('SELECT COUNT(*) as count FROM users');
    await runQuery('SELECT * FROM users LIMIT 1');

    // 3. Check events table
    await runQuery('SELECT COUNT(*) as count FROM events');
    await runQuery('SELECT * FROM events ORDER BY start_time DESC LIMIT 1');
    
    // 4. Check user_event_preferences table
    await runQuery('SELECT COUNT(*) as count FROM user_event_preferences');
    await runQuery('SELECT * FROM user_event_preferences LIMIT 1');
    
    // 5. Check if there are any enabled preferences
    await runQuery(
      'SELECT event_type, COUNT(*) as count FROM user_event_preferences WHERE is_enabled = 1 GROUP BY event_type'
    );
    
    // 6. Check if there are any upcoming events
    const now = new Date().toISOString();
    await runQuery(
      'SELECT COUNT(*) as count FROM events WHERE end_time > ?',
      [now]
    );
    
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
checkDatabaseState();
