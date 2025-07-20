const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'db', 'calendar.db');

console.log('🔍 Checking user_preferences table schema...\n');

// Open the database
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    return;
  }
  
  // Get table info
  db.all("PRAGMA table_info(user_preferences)", [], (err, columns) => {
    if (err) {
      console.error('❌ Error getting table info:', err.message);
      db.close();
      return;
    }
    
    console.log('📋 user_preferences table columns:');
    console.table(columns.map(col => ({
      'Column Name': col.name,
      'Type': col.type,
      'Not Null': col.notnull ? 'YES' : 'NO',
      'Default Value': col.dflt_value || 'NULL',
      'Primary Key': col.pk ? 'YES' : 'NO'
    })));
    
    // Get table constraints
    db.all("SELECT * FROM sqlite_master WHERE type='table' AND name='user_preferences'", [], (err, tables) => {
      if (!err && tables.length > 0) {
        console.log('\n🔒 Table Definition:');
        console.log(tables[0].sql);
      }
      
      // Close the database connection
      db.close();
    });
  });
});
