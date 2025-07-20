const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'calendar.db');

// Open the database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
    process.exit(1);
  }
  console.log('Connected to the SQLite database.');
  
  // First, get the column names
  db.all("PRAGMA table_info(user_preferences)", [], (err, columns) => {
    if (err) {
      console.error('Error getting table info:', err);
      db.close();
      return;
    }
    
    const columnNames = columns.map(col => col.name);
    
    // Now get all rows from user_preferences
    db.all("SELECT * FROM user_preferences", [], (err, rows) => {
      if (err) {
        console.error('Error querying user_preferences:', err);
        db.close();
        return;
      }
      
      if (rows.length === 0) {
        console.log('No records found in user_preferences table.');
        db.close();
        return;
      }
      
      // Print table header
      console.log('USER PREFERENCES');
      console.log('='.repeat(80));
      
      // Print each row with formatted output
      rows.forEach((row, index) => {
        console.log(`\nRecord #${index + 1}:`);
        console.log('-' + '-'.repeat(78));
        
        // Group related settings
        const groups = {
          'Notification Channels': [
            'notify_email', 'notify_browser', 'notify_all_events'
          ],
          'Email Notifications': [
            'email_1h_before', 'email_10m_before'
          ],
          'Browser Notifications': [
            'browser_1h_before', 'browser_10m_before'
          ],
          'Other Settings': [
            'notify_new_events', 'email_notifications_enabled', 
            'browser_notifications_enabled', 'twitter_notifications_enabled',
            'reminder_minutes'
          ],
          'Metadata': [
            'id', 'user_id', 'created_at', 'updated_at'
          ]
        };
        
        // Print each group
        Object.entries(groups).forEach(([groupName, fields]) => {
          console.log(`\n${groupName}:`);
          console.log('-'.repeat(groupName.length + 1));
          
          fields.forEach(field => {
            if (columnNames.includes(field)) {
              const value = row[field] === null ? 'NULL' : 
                          row[field] === undefined ? 'undefined' : 
                          row[field].toString();
              console.log(`  ${field.padEnd(30)}: ${value}`);
            }
          });
        });
        
        console.log('');
      });
      
      db.close();
    });
  });
});
