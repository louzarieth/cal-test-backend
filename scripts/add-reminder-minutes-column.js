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

// Function to add the reminder_minutes column if it doesn't exist
async function addReminderMinutesColumn() {
  return new Promise((resolve, reject) => {
    // First, check if the column exists
    db.all("PRAGMA table_info(user_preferences)", [], (err, columns) => {
      if (err) {
        console.error('Error checking columns:', err.message);
        reject(err);
        return;
      }
      
      // Check if the column already exists
      const hasReminderMinutes = columns.some(col => col.name === 'reminder_minutes');
      
      if (hasReminderMinutes) {
        console.log('ℹ️ reminder_minutes column already exists');
        resolve(false);
        return;
      }
      
      // Add the column
      const alterQuery = `
        ALTER TABLE user_preferences 
        ADD COLUMN reminder_minutes INTEGER DEFAULT 60
      `;
      
      db.run(alterQuery, [], function(err) {
        if (err) {
          console.error('Error adding reminder_minutes column:', err.message);
          reject(err);
          return;
        }
        
        console.log('✅ Added reminder_minutes column to user_preferences table');
        resolve(true);
      });
    });
  });
}

// Function to set default reminder minutes for all users
async function setDefaultReminderMinutes() {
  return new Promise((resolve, reject) => {
    const updateQuery = `
      UPDATE user_preferences 
      SET reminder_minutes = 60 
      WHERE reminder_minutes IS NULL
    `;
    
    db.run(updateQuery, [], function(err) {
      if (err) {
        console.error('Error setting default reminder minutes:', err.message);
        reject(err);
        return;
      }
      
      if (this.changes > 0) {
        console.log(`✅ Set default reminder minutes for ${this.changes} users`);
      } else {
        console.log('ℹ️ No users needed reminder minutes update');
      }
      
      resolve(this.changes);
    });
  });
}

// Main function
async function main() {
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
    
    // Add the reminder_minutes column
    const columnAdded = await addReminderMinutesColumn();
    
    // If the column was just added, set default values
    if (columnAdded) {
      await setDefaultReminderMinutes();
    }
    
    console.log('\n✅ Database update completed successfully!');
    
  } catch (error) {
    console.error('❌ Error updating database:', error);
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

// Run the script
main();
