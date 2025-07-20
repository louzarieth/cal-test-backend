const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../db/calendar.db');

// Connect to the database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    return;
  }
  console.log('✅ Connected to the database');
});

// Function to check if a column exists in a table
async function columnExists(tableName, columnName) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, [], (err, columns) => {
      if (err) {
        console.error(`Error checking columns in ${tableName}:`, err.message);
        reject(err);
        return;
      }
      
      const columnExists = columns.some(col => col.name === columnName);
      resolve(columnExists);
    });
  });
}

// Function to add the user_id column to event_reminders
async function addUserIdToEventReminders() {
  try {
    // Check if user_id column already exists
    const hasUserId = await columnExists('event_reminders', 'user_id');
    
    if (hasUserId) {
      console.log('ℹ️ user_id column already exists in event_reminders table');
      return false;
    }
    
    // SQLite doesn't support adding a NOT NULL column with a default value in a single ALTER TABLE
    // So we'll do it in multiple steps
    
    // 1. Rename the existing table
    await new Promise((resolve, reject) => {
      db.run('ALTER TABLE event_reminders RENAME TO event_reminders_old', (err) => {
        if (err) {
          console.error('Error renaming table:', err.message);
          reject(err);
          return;
        }
        console.log('ℹ️ Renamed event_reminders to event_reminders_old');
        resolve();
      });
    });
    
    // 2. Create a new table with the correct schema
    await new Promise((resolve, reject) => {
      const createTableQuery = `
        CREATE TABLE event_reminders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          reminder_minutes INTEGER NOT NULL,
          reminder_type TEXT DEFAULT 'email',
          reminder_time TEXT,
          sent_at TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(event_id, user_id, reminder_minutes, reminder_type)
        )
      `;
      
      db.run(createTableQuery, (err) => {
        if (err) {
          console.error('Error creating new event_reminders table:', err.message);
          reject(err);
          return;
        }
        console.log('✅ Created new event_reminders table with user_id column');
        resolve();
      });
    });
    
    // 3. Copy data from the old table to the new one
    // Since the old table doesn't have user_id, we'll set a default value
    // You may need to adjust this based on your actual requirements
    await new Promise((resolve, reject) => {
      const copyDataQuery = `
        INSERT INTO event_reminders (
          id, event_id, reminder_minutes, reminder_type, 
          reminder_time, sent_at, created_at, user_id
        )
        SELECT 
          id, event_id, reminder_minutes, COALESCE(reminder_type, 'email'), 
          reminder_time, sent_at, created_at,
          (SELECT id FROM users LIMIT 1) as user_id
        FROM event_reminders_old
      `;
      
      db.run(copyDataQuery, [], function(err) {
        if (err) {
          console.error('Error copying data to new table:', err.message);
          reject(err);
          return;
        }
        
        console.log(`✅ Copied ${this.changes} records to the new table`);
        resolve();
      });
    });
    
    // 4. Drop the old table
    await new Promise((resolve, reject) => {
      db.run('DROP TABLE event_reminders_old', (err) => {
        if (err) {
          console.error('Error dropping old table:', err.message);
          reject(err);
          return;
        }
        console.log('✅ Dropped the old event_reminders_old table');
        resolve();
      });
    });
    
    return true;
    
  } catch (error) {
    console.error('Error in addUserIdToEventReminders:', error);
    throw error;
  }
}

// Main function
async function main() {
  try {
    // Enable foreign keys
    await new Promise((resolve, reject) => {
      db.run('PRAGMA foreign_keys = OFF', (err) => {
        if (err) {
          console.error('Error disabling foreign keys:', err.message);
          reject(err);
          return;
        }
        console.log('ℹ️ Disabled foreign key constraints for the operation');
        resolve();
      });
    });
    
    // Add user_id to event_reminders
    const updated = await addUserIdToEventReminders();
    
    if (updated) {
      console.log('\n✅ Database schema updated successfully!');
      console.log('The event_reminders table now includes the user_id column.');
    } else {
      console.log('\nℹ️ No changes were needed to the database schema.');
    }
    
  } catch (error) {
    console.error('❌ Error updating database schema:', error);
  } finally {
    // Re-enable foreign keys
    await new Promise((resolve) => {
      db.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) {
          console.error('Error re-enabling foreign keys:', err.message);
        } else {
          console.log('✅ Re-enabled foreign key constraints');
        }
        resolve();
      });
    });
    
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

// Run the script
main();
