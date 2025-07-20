const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../db/calendar.db');
const db = new sqlite3.Database(dbPath);

// This is the demo user ID - adjust if different
const DEMO_USER_ID = 'demo-user';

// Initialize user preferences for the demo user
db.serialize(() => {
  // First, check if the user exists in the users table
  db.get('SELECT id FROM users WHERE id = ?', [DEMO_USER_ID], (err, user) => {
    if (err) {
      console.error('Error checking for user:', err.message);
      return;
    }

    if (!user) {
      console.log('Creating demo user...');
      // Insert demo user if not exists
      db.run(
        'INSERT OR IGNORE INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP))',
        [DEMO_USER_ID, 'demo@example.com', 'Demo User'],
        function(err) {
          if (err) {
            console.error('Error creating demo user:', err.message);
            return;
          }
          console.log('Demo user created');
          initializePreferences();
        }
      );
    } else {
      console.log('Demo user exists');
      initializePreferences();
    }
  });

  function initializePreferences() {
    // Insert or update user preferences with all notifications enabled by default
    const sql = `
      INSERT OR REPLACE INTO user_preferences 
      (user_id, notify_email, notify_browser, notify_all_events, notify_1h_before, notify_10m_before, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP))
    `;

    db.run(sql, [DEMO_USER_ID], function(err) {
      if (err) {
        console.error('Error initializing user preferences:', err.message);
        return;
      }
      console.log('User preferences initialized successfully');
      
      // Verify the preferences were set
      db.get(
        'SELECT * FROM user_preferences WHERE email = ?', 
        [DEMO_USER_ID], 
        (err, prefs) => {
          if (err) {
            console.error('Error verifying preferences:', err.message);
            return;
          }
          console.log('Current preferences:', {
            notify_email: prefs.notify_email,
            notify_browser: prefs.notify_browser,
            notify_all_events: prefs.notify_all_events,
            notify_1h_before: prefs.notify_1h_before,
            notify_10m_before: prefs.notify_10m_before
          });
          db.close();
        }
      );
    });
  }
});
