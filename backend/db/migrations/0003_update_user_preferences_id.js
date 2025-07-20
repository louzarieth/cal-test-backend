const { getDb } = require('../../db');

async function up() {
  const db = await getDb();
  
  try {
    // Start transaction
    await db.run('BEGIN TRANSACTION');
    
    console.log('Creating backup of user_preferences table...');
    await db.run('CREATE TABLE IF NOT EXISTS user_preferences_backup AS SELECT * FROM user_preferences');
    
    console.log('Dropping old user_preferences table...');
    await db.run('DROP TABLE IF EXISTS user_preferences');
    
    console.log('Creating new user_preferences table with id as primary key...');
    await db.run(`
      CREATE TABLE user_preferences (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        notify_email INTEGER DEFAULT 1,
        notify_browser INTEGER DEFAULT 1,
        notify_all_events INTEGER DEFAULT 1,
        email_1h_before INTEGER DEFAULT 1,
        email_10m_before INTEGER DEFAULT 1,
        browser_1h_before INTEGER DEFAULT 1,
        browser_10m_before INTEGER DEFAULT 1,
        notify_new_events INTEGER DEFAULT 1,
        email_notifications_enabled INTEGER DEFAULT 1,
        browser_notifications_enabled INTEGER DEFAULT 1,
        twitter_notifications_enabled INTEGER DEFAULT 1,
        reminder_minutes INTEGER DEFAULT 60,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Migrating data from backup to new table...');
    await db.run(`
      INSERT INTO user_preferences
      SELECT 
        u.id,
        up.email,
        COALESCE(up.notify_email, 1) as notify_email,
        COALESCE(up.notify_browser, 1) as notify_browser,
        COALESCE(up.notify_all_events, 1) as notify_all_events,
        COALESCE(up.email_1h_before, 1) as email_1h_before,
        COALESCE(up.email_10m_before, 1) as email_10m_before,
        COALESCE(up.browser_1h_before, 1) as browser_1h_before,
        COALESCE(up.browser_10m_before, 1) as browser_10m_before,
        COALESCE(up.notify_new_events, 1) as notify_new_events,
        COALESCE(up.email_notifications_enabled, 1) as email_notifications_enabled,
        COALESCE(up.browser_notifications_enabled, 1) as browser_notifications_enabled,
        COALESCE(up.twitter_notifications_enabled, 1) as twitter_notifications_enabled,
        COALESCE(up.reminder_minutes, 60) as reminder_minutes,
        COALESCE(up.created_at, CURRENT_TIMESTAMP) as created_at,
        COALESCE(up.updated_at, CURRENT_TIMESTAMP) as updated_at
      FROM user_preferences_backup up
      LEFT JOIN users u ON up.email = u.email
      WHERE u.id IS NOT NULL
    `);
    
    console.log('Migration completed successfully!');
    await db.run('COMMIT');
    
  } catch (error) {
    console.error('Error during migration:', error);
    await db.run('ROLLBACK');
    throw error;
  }
}

async function down() {
  const db = await getDb();
  
  try {
    await db.run('BEGIN TRANSACTION');
    
    // Drop the new table
    await db.run('DROP TABLE IF EXISTS user_preferences');
    
    // Restore from backup if exists
    const backupExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='user_preferences_backup'"
    );
    
    if (backupExists) {
      await db.run('ALTER TABLE user_preferences_backup RENAME TO user_preferences');
      console.log('Restored user_preferences from backup');
    } else {
      console.log('No backup found to restore from');
    }
    
    await db.run('COMMIT');
    
  } catch (error) {
    console.error('Error rolling back migration:', error);
    await db.run('ROLLBACK');
    throw error;
  }
}

module.exports = { up, down };
