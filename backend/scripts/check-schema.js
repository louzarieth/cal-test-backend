const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'db', 'calendar.db');

// Open the database
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    return;
  }
  console.log('✅ Connected to the database');
  
  // Check user_preferences table
  db.all("PRAGMA table_info(user_preferences)", [], (err, rows) => {
    if (err) {
      console.error('❌ Error getting user_preferences table info:', err.message);
      db.close();
      return;
    }
    
    console.log('\n📋 user_preferences table columns:');
    console.table(rows.map(col => ({
      name: col.name,
      type: col.type,
      notnull: col.notnull ? 'YES' : 'NO',
      dflt_value: col.dflt_value || 'NULL',
      pk: col.pk ? 'YES' : 'NO'
    })));
    
    // Check if all required columns exist
    const requiredColumns = [
      'browser_1h_before',
      'browser_10m_before',
      'email_1h_before',
      'email_10m_before',
      'notify_new_events'
    ];
    
    const existingColumns = new Set(rows.map(col => col.name));
    const missingColumns = requiredColumns.filter(col => !existingColumns.has(col));
    
    if (missingColumns.length > 0) {
      console.error('\n❌ Missing required columns:', missingColumns.join(', '));
    } else {
      console.log('\n✅ All required columns are present');
    }
    
    // Close the database connection
    db.close();
  });
});
