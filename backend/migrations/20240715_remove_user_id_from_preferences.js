// Migration to remove user_id from user_preferences table and update all references
const path = require('path');
const { getDb } = require('../db');

module.exports = {
  async up() {
    console.log('Running migration: Remove user_id from user_preferences');
    const db = await getDb();

    try {
      // Begin transaction
      await db.run('BEGIN TRANSACTION');

      // 1. Create a backup of the current table
      console.log('Creating backup of user_preferences...');
      await db.run('CREATE TABLE IF NOT EXISTS user_preferences_backup AS SELECT * FROM user_preferences');

      // 2. Create a new table with the updated schema (using email as primary key)
      console.log('Creating new user_preferences table...');
      await db.run(`
        CREATE TABLE IF NOT EXISTS user_preferences_new (
          email TEXT PRIMARY KEY NOT NULL,
          notify_email BOOLEAN NOT NULL DEFAULT 1,
          notify_browser BOOLEAN NOT NULL DEFAULT 1,
          notify_all_events BOOLEAN NOT NULL DEFAULT 1,
          email_1h_before BOOLEAN NOT NULL DEFAULT 1,
          email_10m_before BOOLEAN NOT NULL DEFAULT 1,
          browser_1h_before BOOLEAN NOT NULL DEFAULT 1,
          browser_10m_before BOOLEAN NOT NULL DEFAULT 1,
          notify_new_events BOOLEAN NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 3. Copy data from old table to new table
      console.log('Migrating data to new table...');
      await db.run(`
        INSERT OR REPLACE INTO user_preferences_new (
          email, 
          notify_email,
          notify_browser,
          notify_all_events,
          email_1h_before,
          email_10m_before,
          browser_1h_before,
          browser_10m_before,
          notify_new_events,
          created_at,
          updated_at
        )
        SELECT 
          email,
          notify_email,
          notify_browser,
          notify_all_events,
          email_1h_before,
          email_10m_before,
          browser_1h_before,
          browser_10m_before,
          notify_new_events,
          created_at,
          updated_at
        FROM user_preferences
      `);

      // 4. Drop the old table and rename the new one
      console.log('Replacing old table with new one...');
      await db.run('DROP TABLE IF EXISTS user_preferences_old');
      await db.run('ALTER TABLE user_preferences RENAME TO user_preferences_old');
      await db.run('ALTER TABLE user_preferences_new RENAME TO user_preferences');

      // 5. Create indexes
      console.log('Creating indexes...');
      await db.run('CREATE INDEX IF NOT EXISTS idx_user_preferences_email ON user_preferences(email)');

      // 6. Commit the transaction
      await db.run('COMMIT');
      console.log('Migration completed successfully');
    } catch (error) {
      // Rollback on error
      await db.run('ROLLBACK');
      console.error('Migration failed:', error);
      throw error;
    }
  },

  async down() {
    // This migration is not easily reversible
    console.warn('This migration is not easily reversible. A backup was created as user_preferences_backup');
  }
};
