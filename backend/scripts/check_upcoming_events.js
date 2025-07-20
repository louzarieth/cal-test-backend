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

  // Get current time and time 24 hours from now
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  console.log('Checking for events between:', now.toISOString(), 'and', tomorrow.toISOString());

  // Query for events in the next 24 hours
  const query = `
    SELECT id, title, start, end, event_type
    FROM events
    WHERE datetime(start) BETWEEN ? AND ?
    AND is_deleted = 0
    ORDER BY start ASC
  `;

  db.all(query, [now.toISOString(), tomorrow.toISOString()], (err, events) => {
    if (err) {
      console.error('Error fetching events:', err);
      process.exit(1);
    }

    console.log(`\nFound ${events.length} upcoming events:`);
    events.forEach((event, index) => {
      console.log(`\n[${index + 1}] ${event.title}`);
      console.log(`   Type: ${event.event_type || 'default'}`);
      console.log(`   Start: ${new Date(event.start).toLocaleString()}`);
      console.log(`   End:   ${new Date(event.end).toLocaleString()}`);
      console.log(`   ID:    ${event.id}`);
    });

    // Check for scheduled reminders
    if (events.length > 0) {
      console.log('\nChecking for scheduled reminders...');
      const eventIds = events.map(e => `'${e.id}'`).join(',');
      
      db.all(
        `SELECT * FROM event_reminders WHERE event_id IN (${eventIds})`,
        (err, reminders) => {
          if (err) {
            console.error('Error fetching reminders:', err);
            process.exit(1);
          }

          console.log(`\nFound ${reminders.length} scheduled reminders:`);
          reminders.forEach((reminder, index) => {
            console.log(`\n[${index + 1}] Reminder for event: ${reminder.event_id}`);
            console.log(`   Type: ${reminder.reminder_type}`);
            console.log(`   Time: ${new Date(reminder.reminder_time).toLocaleString()}`);
            console.log(`   Status: ${reminder.status}`);
          });

          // Check user preferences for browser notifications
          console.log('\nChecking user notification preferences...');
          db.all(
            `SELECT email, browser_1h_before, browser_10m_before, notify_browser 
             FROM user_preferences 
             WHERE notify_browser = 1 
             AND (browser_1h_before = 1 OR browser_10m_before = 1)`,
            (err, users) => {
              if (err) {
                console.error('Error fetching user preferences:', err);
                process.exit(1);
              }

              console.log(`\nFound ${users.length} users with browser notifications enabled:`);
              users.forEach((user, index) => {
                console.log(`\n[${index + 1}] ${user.email}`);
                console.log(`   1h before: ${user.browser_1h_before ? '✅' : '❌'}`);
                console.log(`   10m before: ${user.browser_10m_before ? '✅' : '❌'}`);
              });

              // Check push subscriptions
              console.log('\nChecking push subscriptions...');
              const userEmails = users.map(u => `'${u.email}'`).join(',');
              
              db.all(
                `SELECT * FROM push_subscriptions WHERE user_id IN (${userEmails})`,
                (err, subscriptions) => {
                  if (err) {
                    console.error('Error fetching push subscriptions:', err);
                    process.exit(1);
                  }

                  console.log(`\nFound ${subscriptions.length} push subscriptions:`);
                  subscriptions.forEach((sub, index) => {
                    console.log(`\n[${index + 1}] ${sub.user_id}`);
                    console.log(`   Endpoint: ${sub.endpoint.substring(0, 50)}...`);
                    console.log(`   Created: ${new Date(sub.created_at).toLocaleString()}`);
                  });

                  process.exit(0);
                }
              );
            }
          );
        }
      );
    } else {
      console.log('\nNo upcoming events found in the next 24 hours.');
      process.exit(0);
    }
  });
});
