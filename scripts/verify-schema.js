const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to the database file
const dbPath = path.join(__dirname, '..', 'db', 'calendar.db');

// Open the database
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    return;
  }

  console.log('🔍 Verifying user_preferences table schema...\n');

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

    // Check for required columns
    const requiredColumns = [
      'email',
      'notify_email',
      'notify_browser',
      'notify_all_events',
      'email_1h_before',
      'email_10m_before',
      'browser_1h_before',
      'browser_10m_before',
      'notify_new_events'
    ];

    const existingColumns = new Set(columns.map(col => col.name));
    const missingColumns = requiredColumns.filter(col => !existingColumns.has(col));

    if (missingColumns.length > 0) {
      console.error('\n❌ Missing required columns:', missingColumns.join(', '));
    } else {
      console.log('\n✅ All required columns are present');
    }

    // Check for removed columns
    const removedColumns = ['id', 'user_id'];
    const foundRemovedColumns = removedColumns.filter(col => existingColumns.has(col));

    if (foundRemovedColumns.length > 0) {
      console.error('\n❌ Found columns that should have been removed:', foundRemovedColumns.join(', '));
    } else {
      console.log('\n✅ All unnecessary columns have been removed');
    }

    // Check primary key
    const primaryKeyColumns = columns.filter(col => col.pk).map(col => col.name);
    if (primaryKeyColumns.length === 1 && primaryKeyColumns[0] === 'email') {
      console.log('\n✅ Primary key is correctly set to email');
    } else {
      console.error('\n❌ Primary key is not correctly set. Expected: email, Found:', primaryKeyColumns.join(', '));
    }

    // Close the database connection
    db.close();
  });
});
