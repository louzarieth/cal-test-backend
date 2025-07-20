const { getDb } = require('../db');

/**
 * Migration to create the event_reminders table for tracking sent reminders
 */
module.exports = {
  name: '20240301_add_event_reminders_table',
  async up() {
    const db = await getDb();
    
    // Create event_reminders table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS event_reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL,
        reminder_type INTEGER NOT NULL, -- minutes before event (e.g., 10, 60)
        sent_at TIMESTAMP NOT NULL,
        tweet_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        UNIQUE(event_id, reminder_type)
      );
    `);
    
    // Create index for faster lookups
    await db.exec('CREATE INDEX IF NOT EXISTS idx_event_reminders_event_id ON event_reminders(event_id);');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_event_reminders_sent_at ON event_reminders(sent_at);');
    
    console.log('✅ Created event_reminders table');
  },
  
  async down() {
    const db = await getDb();
    await db.exec('DROP TABLE IF EXISTS event_reminders;');
    console.log('❌ Dropped event_reminders table');
  }
};
