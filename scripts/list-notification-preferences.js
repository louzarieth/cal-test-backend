const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function listNotificationPreferences() {
  const dbPath = path.join(__dirname, '..', 'db', 'calendar.db');
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
      return;
    }
    console.log('Connected to the database.');
  });

  try {
    // First, check if the users table exists
    const tables = await new Promise((resolve, reject) => {
      db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    if (tables.length === 0) {
      console.log('No users table found in the database.');
      return;
    }
    
    // Get all users with their notification preferences
    const users = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          u.id, 
          u.email,
          u.name
        FROM users u
        ORDER BY u.email
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    if (users.length === 0) {
      console.log('No users found in the database.');
      return;
    }

    console.log('\n=== User List ===');
    
    for (const user of users) {
      console.log(`\n👤 User: ${user.name || 'No name'} (${user.email})`);
      console.log('----------------------------------------');
      
      // Get user preferences
      const prefs = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM user_preferences WHERE email = ?', 
          [user.id], 
          (err, row) => {
            if (err) reject(err);
            else resolve(row || {});
          }
        );
      });
      
      if (Object.keys(prefs).length > 0) {
        console.log('🔔 Notification Preferences:');
        console.log(`   Email Notifications: ${prefs.notify_email ? '✅ Enabled' : '❌ Disabled'}`);
        console.log(`   Browser Notifications: ${prefs.notify_browser ? '✅ Enabled' : '❌ Disabled'}`);
        console.log(`   Notify for All Events: ${prefs.notify_all_events ? '✅ Yes' : '❌ No'}`);
        console.log(`   1 Hour Reminder: ${prefs.notify_1h_before ? '✅ Enabled' : '❌ Disabled'}`);
        console.log(`   10 Minute Reminder: ${prefs.notify_10m_before ? '✅ Enabled' : '❌ Disabled'}`);
        
        // Get event type preferences for this user
        const eventPrefs = await new Promise((resolve, reject) => {
          db.all(
            'SELECT event_type, is_enabled FROM user_event_preferences WHERE user_id = ?',
            [user.id],
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            }
          );
        });
        
        if (eventPrefs.length > 0) {
          console.log('\n   📅 Event Type Preferences:');
          for (const pref of eventPrefs) {
            console.log(`      ${pref.event_type}: ${pref.is_enabled ? '✅ Enabled' : '❌ Disabled'}`);
          }
        } else {
          console.log('\n   ℹ️ No specific event type preferences set');
        }
      } else {
        console.log('ℹ️ No notification preferences found for this user');
      }
    }
    
    // List all available event types in the system
    const eventTypes = await new Promise((resolve, reject) => {
      db.all(
        'SELECT DISTINCT event_type FROM events WHERE event_type IS NOT NULL ORDER BY event_type',
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
    
    if (eventTypes.length > 0) {
      console.log('\n=== Available Event Types in System ===');
      eventTypes.forEach(et => console.log(`- ${et.event_type || 'No event type'}`));
    } else {
      console.log('\nℹ️ No event types found in the system');
    }
    
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
  } finally {
    // Close the database connection
    if (db) {
      db.close(err => {
        if (err) console.error('Error closing database:', err.message);
      });
    }
  }
}

// Run the function
listNotificationPreferences().catch(console.error);
