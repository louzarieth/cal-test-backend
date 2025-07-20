const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../db/calendar.db');

// Open the database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
    process.exit(1);
  }
  console.log('Connected to the SQLite database.');

  // Create push_subscriptions table if it doesn't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      keys TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, endpoint)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating push_subscriptions table:', err);
      process.exit(1);
    }
    console.log('✅ Verified push_subscriptions table exists');

    // Get users with browser notifications enabled but no push subscription
    db.all(
      `SELECT p.email 
       FROM user_preferences p 
       LEFT JOIN push_subscriptions ps ON p.email = ps.user_id 
       WHERE p.notify_browser = 1 AND ps.id IS NULL`,
      [],
      (err, users) => {
        if (err) {
          console.error('Error finding users without push subscriptions:', err);
          process.exit(1);
        }

        console.log(`\nFound ${users.length} users with browser notifications enabled but no push subscription:`);
        users.forEach((user, index) => {
          console.log('[' + (index + 1) + '] ' + user.email);
        });

        if (users.length > 0) {
          console.log('\nTo fix this, users need to grant browser notification permissions again.');
          console.log('Ask them to:');
          console.log('1. Open the calendar app');
          console.log('2. Click the notification bell icon');
          console.log('3. Click "Enable Browser Notifications"');
          console.log('4. Allow notifications when the browser prompts');
        } else {
          console.log('\n✅ All users with browser notifications enabled have active push subscriptions.');
        }

        // Verify push subscription data
        console.log('\n🔍 Verifying push subscription data...');
        db.all(
          `SELECT user_id, endpoint, created_at 
           FROM push_subscriptions`,
          [],
          (err, subscriptions) => {
            if (err) {
              console.error('Error fetching push subscriptions:', err);
              process.exit(1);
            }

            console.log(`\nFound ${subscriptions.length} push subscriptions in database:`);
            if (subscriptions.length > 0) {
              console.table(subscriptions.map(sub => ({
                user: sub.user_id,
                endpoint: sub.endpoint.substring(0, 30) + '...',
                created: new Date(sub.created_at).toLocaleString()
              })));
            }

            // Check for any invalid subscription data
            const invalidSubs = subscriptions.filter(sub => !sub.endpoint || !sub.keys);
            if (invalidSubs.length > 0) {
              console.log(`\n⚠️ Found ${invalidSubs.length} invalid push subscriptions (missing endpoint or keys):`);
              console.table(invalidSubs);
              
              // Clean up invalid subscriptions
              console.log('\nCleaning up invalid subscriptions...');
              const stmt = db.prepare('DELETE FROM push_subscriptions WHERE id = ?');
              invalidSubs.forEach(sub => {
                stmt.run(sub.id, (err) => {
                  if (err) console.error(`Error removing invalid subscription ${sub.id}:`, err);
                });
              });
              stmt.finalize();
              console.log('✅ Cleanup complete');
            }

            process.exit(0);
          }
        );
      }
    );
  });
});
