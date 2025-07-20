const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'calendar.db');
const db = new sqlite3.Database(dbPath);

console.log('🚀 Starting migration: Add id column to user_preferences table');

db.serialize(() => {
  // Step 1: Create a new table with the same structure plus id column
  db.run(`
    CREATE TABLE IF NOT EXISTS user_preferences_new (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      notify_email BOOLEAN DEFAULT 1,
      notify_browser BOOLEAN DEFAULT 1,
      notify_all_events BOOLEAN DEFAULT 1,
      email_1h_before BOOLEAN DEFAULT 1,
      email_10m_before BOOLEAN DEFAULT 1,
      browser_1h_before BOOLEAN DEFAULT 1,
      browser_10m_before BOOLEAN DEFAULT 1,
      notify_new_events BOOLEAN DEFAULT 1,
      email_notifications_enabled BOOLEAN DEFAULT 1,
      browser_notifications_enabled BOOLEAN DEFAULT 1,
      twitter_notifications_enabled BOOLEAN DEFAULT 1,
      reminder_minutes INTEGER DEFAULT 60,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    )
  `);

  // Step 2: First, ensure we have all users in user_preferences
  db.run(`
    INSERT OR IGNORE INTO user_preferences (email)
    SELECT email FROM users
    WHERE email NOT IN (SELECT email FROM user_preferences)
  `);

  // Step 3: Update user_preferences with correct user IDs from users table
  db.run(`
    UPDATE user_preferences
    SET id = (SELECT id FROM users WHERE users.email = user_preferences.email)
    WHERE id IS NULL OR id != (SELECT id FROM users WHERE users.email = user_preferences.email)
  `);

  // Step 4: Copy data to new table with correct user IDs
  db.run(`
    INSERT INTO user_preferences_new 
    (id, email, notify_email, notify_browser, notify_all_events,
     email_1h_before, email_10m_before, browser_1h_before, 
     browser_10m_before, notify_new_events, email_notifications_enabled,
     browser_notifications_enabled, twitter_notifications_enabled,
     reminder_minutes, created_at, updated_at)
    SELECT 
      u.id,
      up.email, 
      COALESCE(up.notify_email, 1),
      COALESCE(up.notify_browser, 1),
      COALESCE(up.notify_all_events, 1),
      COALESCE(up.email_1h_before, 1),
      COALESCE(up.email_10m_before, 1),
      COALESCE(up.browser_1h_before, 1),
      COALESCE(up.browser_10m_before, 1),
      1, 1, 1, 1, 60,  -- Default values for new columns
      COALESCE(up.created_at, CURRENT_TIMESTAMP),
      COALESCE(up.updated_at, CURRENT_TIMESTAMP)
    FROM user_preferences up
    JOIN users u ON up.email = u.email
  `);

  // Step 3: Drop old table and rename new one
  db.run('DROP TABLE IF EXISTS user_preferences_old');
  db.run('ALTER TABLE user_preferences RENAME TO user_preferences_old');
  db.run('ALTER TABLE user_preferences_new RENAME TO user_preferences');

  console.log('✅ Migration completed: Added id column to user_preferences table');
});

db.close();
