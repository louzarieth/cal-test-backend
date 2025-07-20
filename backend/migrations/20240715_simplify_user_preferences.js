// Migration to simplify the user_preferences table by removing the id and user_id columns
// and using email as the primary key instead

module.exports = {
  async up(db) {
    // Create a backup of the current table
    await db.run(`
      CREATE TABLE IF NOT EXISTS user_preferences_backup (
        email TEXT PRIMARY KEY,
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

    // Copy data to the backup table
    await db.run(`
      INSERT INTO user_preferences_backup (
        email, 
        notify_email, 
        notify_browser, 
        notify_all_events,
        email_1h_before,
        email_10m_before,
        browser_1h_before,
        browser_10m_before,
        notify_new_events,
        email_notifications_enabled,
        browser_notifications_enabled,
        twitter_notifications_enabled,
        reminder_minutes,
        created_at,
        updated_at
      )
      SELECT 
        user_id as email,
        notify_email,
        notify_browser,
        notify_all_events,
        email_1h_before,
        email_10m_before,
        browser_1h_before,
        browser_10m_before,
        notify_new_events,
        email_notifications_enabled,
        browser_notifications_enabled,
        twitter_notifications_enabled,
        reminder_minutes,
        created_at,
        updated_at
      FROM user_preferences
    `);

    // Drop the old table
    await db.run('DROP TABLE IF EXISTS user_preferences');

    // Rename backup to original
    await db.run('ALTER TABLE user_preferences_backup RENAME TO user_preferences');

    console.log('✅ Simplified user_preferences table schema');
  },

  async down(db) {
    // This migration is not easily reversible
    console.warn('⚠️ This migration cannot be automatically reversed');
  }
};
