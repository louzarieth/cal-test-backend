const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../db/calendar.db');

// Connect to the database in read-write mode
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    return;
  }
  console.log('✅ Connected to the database');
});

// Function to safely add a column if it doesn't exist
function addColumnIfNotExists(tableName, columnDefinition) {
  return new Promise((resolve, reject) => {
    const checkQuery = `PRAGMA table_info(${tableName})`;
    
    db.all(checkQuery, [], (err, columns) => {
      if (err) {
        console.error(`Error checking columns in ${tableName}:`, err.message);
        reject(err);
        return;
      }
      
      const columnName = columnDefinition.split(' ')[0];
      const columnExists = columns.some(col => col.name === columnName);
      
      if (columnExists) {
        console.log(`ℹ️ Column ${columnName} already exists in ${tableName}`);
        resolve(false);
        return;
      }
      
      const alterQuery = `ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`;
      
      db.run(alterQuery, [], function(err) {
        if (err) {
          console.error(`Error adding column ${columnName} to ${tableName}:`, err.message);
          reject(err);
          return;
        }
        
        console.log(`✅ Added column ${columnName} to ${tableName}`);
        resolve(true);
      });
    });
  });
}

// Function to create or update the user_preferences table
async function updateUserPreferencesTable() {
  try {
    // First, check if the table exists
    const tableExists = await new Promise((resolve) => {
      db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='user_preferences'",
        (err, row) => resolve(!!row)
      );
    });
    
    if (!tableExists) {
      // Create the table if it doesn't exist
      await new Promise((resolve, reject) => {
        const createTableQuery = `
          CREATE TABLE IF NOT EXISTS user_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            email_notifications_enabled BOOLEAN DEFAULT 1,
            browser_notifications_enabled BOOLEAN DEFAULT 1,
            twitter_notifications_enabled BOOLEAN DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id)
          )
        `;
        
        db.run(createTableQuery, function(err) {
          if (err) {
            console.error('Error creating user_preferences table:', err.message);
            reject(err);
            return;
          }
          console.log('✅ Created user_preferences table');
          resolve(true);
        });
      });
    } else {
      // Table exists, just add missing columns
      console.log('ℹ️ user_preferences table already exists, checking for missing columns...');
      await addColumnIfNotExists('user_preferences', 'email_notifications_enabled BOOLEAN DEFAULT 1');
      await addColumnIfNotExists('user_preferences', 'browser_notifications_enabled BOOLEAN DEFAULT 1');
      await addColumnIfNotExists('user_preferences', 'twitter_notifications_enabled BOOLEAN DEFAULT 1');
      await addColumnIfNotExists('user_preferences', 'updated_at TEXT DEFAULT CURRENT_TIMESTAMP');
    }
    
    // Ensure all users have a preferences record
    await new Promise((resolve, reject) => {
      const ensureUserPrefsQuery = `
        INSERT INTO user_preferences (user_id, email_notifications_enabled, browser_notifications_enabled, twitter_notifications_enabled)
        SELECT id, 1, 1, 1 FROM users
        WHERE id NOT IN (SELECT user_id FROM user_preferences)
      `;
      
      db.run(ensureUserPrefsQuery, function(err) {
        if (err) {
          console.error('Error ensuring user preferences:', err.message);
          reject(err);
          return;
        }
        
        if (this.changes > 0) {
          console.log(`✅ Added default preferences for ${this.changes} users`);
        } else {
          console.log('ℹ️ All users already have preferences');
        }
        resolve();
      });
    });
    
  } catch (error) {
    console.error('Error updating user_preferences table:', error);
    throw error;
  }
}

// Function to update the event_reminders table
async function updateEventRemindersTable() {
  try {
    // Add reminder_time column if it doesn't exist
    await addColumnIfNotExists('event_reminders', 'reminder_time TEXT');
    
    // Add reminder_type column if it doesn't exist
    await addColumnIfNotExists('event_reminders', 'reminder_type TEXT DEFAULT "email"');
    
    // Update existing reminders to have a calculated reminder_time
    const updateQuery = `
      UPDATE event_reminders
      SET reminder_time = (
        SELECT datetime(e.start_time, '-' || event_reminders.reminder_minutes || ' minutes')
        FROM events e
        WHERE e.id = event_reminders.event_id
      )
      WHERE reminder_time IS NULL
    `;
    
    await new Promise((resolve, reject) => {
      db.run(updateQuery, [], function(err) {
        if (err) {
          console.error('Error updating reminder times:', err.message);
          reject(err);
          return;
        }
        
        if (this.changes > 0) {
          console.log(`✅ Updated reminder_time for ${this.changes} reminders`);
        } else {
          console.log('ℹ️ No reminders needed updating');
        }
        resolve();
      });
    });
    
  } catch (error) {
    console.error('Error updating event_reminders table:', error);
    throw error;
  }
}

// Main function
async function fixDatabaseSchema() {
  try {
    // Enable foreign keys
    await new Promise((resolve, reject) => {
      db.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) {
          console.error('Error enabling foreign keys:', err.message);
          reject(err);
          return;
        }
        console.log('✅ Enabled foreign key constraints');
        resolve();
      });
    });
    
    // Update user_preferences table
    console.log('\n🔄 Updating user_preferences table...');
    await updateUserPreferencesTable();
    
    // Update event_reminders table
    console.log('\n🔄 Updating event_reminders table...');
    await updateEventRemindersTable();
    
    console.log('\n✅ Database schema updated successfully!');
    
  } catch (error) {
    console.error('❌ Error updating database schema:', error);
  } finally {
    // Close the database connection
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('\n✅ Database connection closed');
      }
    });
  }
}

// Run the schema fix
fixDatabaseSchema();
