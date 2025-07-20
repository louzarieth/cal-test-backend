const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { getDb } = require('../db');

async function addNotifyNewEventsColumn() {
  console.log('🔄 Adding notify_new_events column to user_preferences table...');
  
  const db = await getDb();
  
  try {
    // Check if the column already exists
    const columnExists = await db.get(
      "PRAGMA table_info(user_preferences)",
      (err, row) => {
        if (err) throw err;
        return row && row.some(col => col.name === 'notify_new_events');
      }
    );

    if (columnExists) {
      console.log('✅ notify_new_events column already exists');
      return;
    }

    // Add the new column
    await db.run(`
      ALTER TABLE user_preferences
      ADD COLUMN notify_new_events BOOLEAN DEFAULT 1
    `);
    
    console.log('✅ Successfully added notify_new_events column');
  } catch (error) {
    console.error('❌ Error adding notify_new_events column:', error);
    throw error;
  } finally {
    await db.close();
  }
}

// Run the migration
addNotifyNewEventsColumn()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
