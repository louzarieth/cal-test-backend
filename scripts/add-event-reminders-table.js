const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { getDb, runQuery } = require('../db');

async function addEventRemindersTable() {
  console.log('Adding event_reminders table...');
  
  try {
    // Get the database connection
    const db = await getDb();
    
    // Create the event_reminders table
    await runQuery(`
      CREATE TABLE IF NOT EXISTS event_reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL,
        reminder_minutes INTEGER NOT NULL,
        tweet_id TEXT,
        sent_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        UNIQUE(event_id, reminder_minutes)
      )
    `);
    
    console.log('✅ event_reminders table created or already exists');
    
    // Add indexes for better query performance
    await runQuery('CREATE INDEX IF NOT EXISTS idx_event_reminders_event_id ON event_reminders(event_id)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_event_reminders_sent ON event_reminders(sent_at)');
    
    console.log('✅ Indexes created or already exist');
    
    return true;
  } catch (error) {
    console.error('❌ Error adding event_reminders table:', error);
    throw error;
  }
}

// Run the script if executed directly
if (require.main === module) {
  addEventRemindersTable()
    .then(() => {
      console.log('✅ Database setup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database setup failed:', error);
      process.exit(1);
    });
}

module.exports = {
  addEventRemindersTable
};
