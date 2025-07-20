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

  // 1. Check events table and upcoming events
  db.all("SELECT * FROM sqlite_master WHERE type='table' AND name='events'", [], (err, tables) => {
    if (err) {
      console.error('Error checking events table:', err);
      return;
    }

    if (tables.length === 0) {
      console.error('❌ Events table does not exist!');
      return;
    }

    console.log('\n📅 Checking events table...');
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    // Get events in the next 24 hours
    db.all(
      `SELECT id, title, start_time, end_time, event_type 
       FROM events 
       WHERE start_time > ? AND start_time < ? 
       AND is_deleted = 0 
       ORDER BY start_time ASC`,
      [now.toISOString(), tomorrow.toISOString()],
      (err, events) => {
        if (err) {
          console.error('Error fetching events:', err);
          return;
        }

        console.log(`\nFound ${events.length} upcoming events in the next 24 hours:`);
        events.forEach((event, index) => {
          console.log(`\n[${index + 1}] ${event.title}`);
          console.log(`   ID:    ${event.id}`);
          console.log(`   Type:  ${event.event_type || 'default'}`);
          console.log(`   Start: ${new Date(event.start_time).toLocaleString()}`);
          console.log(`   End:   ${new Date(event.end_time).toLocaleString()}`);
        });

        // 2. Check user preferences
        console.log('\n🔍 Checking user preferences...');
        db.all(
          `SELECT email, notify_browser, browser_1h_before, browser_10m_before 
           FROM user_preferences 
           WHERE notify_browser = 1 
           AND (browser_1h_before = 1 OR browser_10m_before = 1)`,
          [],
          (err, users) => {
            if (err) {
              console.error('Error fetching user preferences:', err);
              return;
            }

            console.log(`\nFound ${users.length} users with browser notifications enabled:`);
            users.forEach((user, index) => {
              console.log(`\n[${index + 1}] ${user.email}`);
              console.log(`   Browser Notifications: ${user.notify_browser ? '✅' : '❌'}`);
              console.log(`   1h before: ${user.browser_1h_before ? '✅' : '❌'}`);
              console.log(`   10m before: ${user.browser_10m_before ? '✅' : '❌'}`);
            });

            // 3. Check push subscriptions
            if (users.length > 0) {
              console.log('\n🔔 Checking push subscriptions...');
              const userEmails = users.map(u => `'${u.email}'`).join(',');
              
              db.all(
                `SELECT * FROM push_subscriptions WHERE user_id IN (${userEmails})`,
                [],
                (err, subscriptions) => {
                  if (err) {
                    console.error('Error fetching push subscriptions:', err);
                    return;
                  }

                  console.log(`\nFound ${subscriptions.length} push subscriptions:`);
                  subscriptions.forEach((sub, index) => {
                    console.log(`\n[${index + 1}] ${sub.user_id}`);
                    console.log(`   Endpoint: ${sub.endpoint.substring(0, 50)}...`);
                    console.log(`   Created:  ${new Date(sub.created_at).toLocaleString()}`);
                  });

                  // 4. Check scheduled reminders
                  if (events.length > 0) {
                    console.log('\n⏰ Checking scheduled reminders...');
                    const eventIds = events.map(e => `'${e.id}'`).join(',');
                    
                    db.all(
                      `SELECT * FROM event_reminders WHERE event_id IN (${eventIds})`,
                      [],
                      (err, reminders) => {
                        if (err) {
                          console.error('Error fetching reminders:', err);
                          return;
                        }

                        console.log(`\nFound ${reminders.length} scheduled reminders:`);
                        reminders.forEach((reminder, index) => {
                          console.log(`\n[${index + 1}] Event: ${reminder.event_id}`);
                          console.log(`   Type:   ${reminder.reminder_type}`);
                          console.log(`   Status: ${reminder.status}`);
                          console.log(`   Time:   ${new Date(reminder.reminder_time).toLocaleString()}`);
                          console.log(`   User:   ${reminder.user_id}`);
                        });

                        // 5. Check event types with preferences
                        console.log('\n🎭 Checking event types with preferences...');
                        db.all(
                          `SELECT DISTINCT event_type FROM user_event_preferences WHERE is_enabled = 1`,
                          [],
                          (err, eventTypes) => {
                            if (err) {
                              console.error('Error fetching event types with preferences:', err);
                              return;
                            }

                            console.log(`\nFound ${eventTypes.length} event types with enabled preferences:`);
                            if (eventTypes.length > 0) {
                              console.log(eventTypes.map(et => `- ${et.event_type}`).join('\n'));
                            }

                            process.exit(0);
                          }
                        );
                      }
                    );
                  } else {
                    process.exit(0);
                  }
                }
              );
            } else {
              process.exit(0);
            }
          }
        );
      }
    );
  });
});
