const { getDb } = require('../db');

/**
 * Migration to update user_preferences table with new columns and remove old ones
 */
module.exports = {
  name: '20240715_update_user_preferences_columns',
  async up() {
    const db = await getDb();
    
    // Add new columns if they don't exist
    await db.exec(`
      PRAGMA foreign_keys=off;
      
      -- Create a temporary table with the new schema
      CREATE TABLE IF NOT EXISTS user_preferences_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        notify_email BOOLEAN DEFAULT 1,
        notify_browser BOOLEAN DEFAULT 1,
        notify_all_events BOOLEAN DEFAULT 1,
        email_1h_before BOOLEAN DEFAULT 1,
        email_10m_before BOOLEAN DEFAULT 1,
        browser_1h_before BOOLEAN DEFAULT 1,
        browser_10m_before BOOLEAN DEFAULT 1,
        notify_new_events BOOLEAN DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id)
      );
      
      -- Copy data from old table to new table
      INSERT INTO user_preferences_new (
        id, user_id, notify_email, notify_browser, notify_all_events,
        email_1h_before, email_10m_before, browser_1h_before, browser_10m_before,
        notify_new_events, created_at, updated_at
      )
      SELECT 
        id, user_id, notify_email, notify_browser, notify_all_events,
        notify_1h_before, notify_10m_before, 
        CASE WHEN notify_browser = 1 THEN 1 ELSE 0 END as browser_1h_before,
        CASE WHEN notify_browser = 1 THEN 1 ELSE 0 END as browser_10m_before,
        1 as notify_new_events, -- Default to true for existing users
        created_at, updated_at
      FROM user_preferences;
      
      -- Drop the old table
      DROP TABLE user_preferences;
      
      -- Rename new table to original name
      ALTER TABLE user_preferences_new RENAME TO user_preferences;
      
      -- Recreate indexes
      CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
      
      PRAGMA foreign_keys=on;
    `);
    
    console.log('✅ Updated user_preferences table with new columns');
  },
  
  async down() {
    const db = await getDb();
    
    // Revert to old schema if needed
    await db.exec(`
      PRAGMA foreign_keys=off;
      
      -- Create a temporary table with the old schema
      CREATE TABLE IF NOT EXISTS user_preferences_old (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        notify_email BOOLEAN DEFAULT 1,
        notify_browser BOOLEAN DEFAULT 1,
        notify_all_events BOOLEAN DEFAULT 1,
        notify_1h_before BOOLEAN DEFAULT 1,
        notify_10m_before BOOLEAN DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id)
      );
      
      -- Copy data back to old schema
      INSERT INTO user_preferences_old (
        id, user_id, notify_email, notify_browser, notify_all_events,
        notify_1h_before, notify_10m_before, created_at, updated_at
      )
      SELECT 
        id, user_id, notify_email, notify_browser, notify_all_events,
        email_1h_before, email_10m_before, created_at, updated_at
      FROM user_preferences;
      
      -- Drop the current table
      DROP TABLE user_preferences;
      
      -- Rename old table back to original name
      ALTER TABLE user_preferences_old RENAME TO user_preferences;
      
      -- Recreate indexes
      CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
      
      PRAGMA foreign_keys=on;
    `);
    
    console.log('❌ Reverted user_preferences table to old schema');
  }
};
