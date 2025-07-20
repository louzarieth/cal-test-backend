const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../calendar.db');

console.log('Running migration: Add browser notification preference columns');

// Open the database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
    process.exit(1);
  }
  console.log('Connected to the SQLite database.');
});

// Wrap database operations in a promise
const runMigration = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Enable foreign keys
      db.run('PRAGMA foreign_keys = ON');

      // Begin transaction
      db.run('BEGIN TRANSACTION');

      try {
        // 1. Add new columns for browser notifications
        console.log('Adding browser_1h_before column...');
        db.run(`
          ALTER TABLE user_preferences 
          ADD COLUMN browser_1h_before BOOLEAN DEFAULT 1
        `, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding browser_1h_before column:', err);
            return db.run('ROLLBACK', () => reject(err));
          }
          console.log('Added browser_1h_before column or it already exists');
        });

        console.log('Adding browser_10m_before column...');
        db.run(`
          ALTER TABLE user_preferences 
          ADD COLUMN browser_10m_before BOOLEAN DEFAULT 1
        `, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding browser_10m_before column:', err);
            return db.run('ROLLBACK', () => reject(err));
          }
          console.log('Added browser_10m_before column or it already exists');
        });

        // 2. Check if we need to rename columns (only if they exist with old names)
        db.get(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='user_preferences'",
          (err, row) => {
            if (err) {
              console.error('Error checking table structure:', err);
              return db.run('ROLLBACK', () => reject(err));
            }

            // Get all columns in the table
            db.all(
              "PRAGMA table_info(user_preferences)",
              (err, columns) => {
                if (err) {
                  console.error('Error getting table info:', err);
                  return db.run('ROLLBACK', () => reject(err));
                }

                // Convert to array of column names for easier checking
                const columnNames = columns.map(col => col.name);
                
                const hasNotify1h = columnNames.includes('notify_1h_before');
                const hasNotify10m = columnNames.includes('notify_10m_before');
                const hasEmail1h = columnNames.includes('email_1h_before');
                const hasEmail10m = columnNames.includes('email_10m_before');

                // Rename notify_1h_before to email_1h_before if needed
                if (hasNotify1h && !hasEmail1h) {
                  console.log('Renaming notify_1h_before to email_1h_before...');
                  db.run(`
                    ALTER TABLE user_preferences 
                    RENAME COLUMN notify_1h_before TO email_1h_before
                  `, (err) => {
                    if (err) {
                      console.error('Error renaming column:', err);
                      return db.run('ROLLBACK', () => reject(err));
                    }
                    console.log('Renamed notify_1h_before to email_1h_before');
                  });
                }

                // Rename notify_10m_before to email_10m_before if needed
                if (hasNotify10m && !hasEmail10m) {
                  console.log('Renaming notify_10m_before to email_10m_before...');
                  db.run(`
                    ALTER TABLE user_preferences 
                    RENAME COLUMN notify_10m_before TO email_10m_before
                  `, (err) => {
                    if (err) {
                      console.error('Error renaming column:', err);
                      return db.run('ROLLBACK', () => reject(err));
                    }
                    console.log('Renamed notify_10m_before to email_10m_before');
                  });
                }

                // If old columns don't exist, add the new ones with default values
                if (!hasNotify1h && !hasEmail1h) {
                  console.log('Adding email_1h_before column...');
                  db.run(`
                    ALTER TABLE user_preferences 
                    ADD COLUMN email_1h_before BOOLEAN DEFAULT 1
                  `, (err) => {
                    if (err && !err.message.includes('duplicate column name')) {
                      console.error('Error adding email_1h_before column:', err);
                      return db.run('ROLLBACK', () => reject(err));
                    }
                    console.log('Added email_1h_before column or it already exists');
                  });
                }

                if (!hasNotify10m && !hasEmail10m) {
                  console.log('Adding email_10m_before column...');
                  db.run(`
                    ALTER TABLE user_preferences 
                    ADD COLUMN email_10m_before BOOLEAN DEFAULT 1
                  `, (err) => {
                    if (err && !err.message.includes('duplicate column name')) {
                      console.error('Error adding email_10m_before column:', err);
                      return db.run('ROLLBACK', () => reject(err));
                    }
                    console.log('Added email_10m_before column or it already exists');
                  });
                }

                // Add notify_new_events column if it doesn't exist
                console.log('Ensuring notify_new_events column exists...');
                db.run(`
                  ALTER TABLE user_preferences 
                  ADD COLUMN notify_new_events BOOLEAN DEFAULT 1
                `, (err) => {
                  if (err && !err.message.includes('duplicate column name')) {
                    console.error('Error adding notify_new_events column:', err);
                    return db.run('ROLLBACK', () => reject(err));
                  }
                  console.log('Verified notify_new_events column exists');

                  // Commit the transaction
                  db.run('COMMIT', (err) => {
                    if (err) {
                      console.error('Error committing transaction:', err);
                      return db.run('ROLLBACK', () => reject(err));
                    }
                    console.log('Migration completed successfully');
                    resolve();
                  });
                });
              }
            );
          }
        );
      } catch (error) {
        console.error('Migration error:', error);
        db.run('ROLLBACK', () => reject(error));
      }
    });
  });
};

// Run the migration
runMigration()
  .then(() => {
    console.log('Database migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Database migration failed:', error);
    process.exit(1);
  })
  .finally(() => {
    // Close the database connection
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
        process.exit(1);
      }
      console.log('Closed the database connection');
    });
  });
