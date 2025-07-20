const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../calendar.db');

console.log('Running migration: Add id column to user_preferences table');

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
        // 1. Add id column to user_preferences
        console.log('Adding id column to user_preferences...');
        db.run(`
          ALTER TABLE user_preferences 
          ADD COLUMN id TEXT
        `, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding id column:', err);
            return db.run('ROLLBACK', () => reject(err));
          }
          console.log('Added id column or it already exists');
          
          // 2. Update existing rows with a default ID (using rowid as a fallback)
          console.log('Populating id column...');
          db.run(
            `UPDATE user_preferences 
             SET id = 'pref_' || rowid 
             WHERE id IS NULL`,
            function(err) {
              if (err) {
                console.error('Error populating id column:', err);
                return db.run('ROLLBACK', () => reject(err));
              }
              console.log(`Updated ${this.changes} rows with id values`);
              
              // 3. Make the id column a primary key
              // SQLite doesn't support adding a primary key with ALTER TABLE,
              // so we need to create a new table and copy the data
              console.log('Making id column primary key...');
              
              // Create a new table with the desired schema
              db.run(`
                CREATE TABLE IF NOT EXISTS user_preferences_new (
                  id TEXT PRIMARY KEY,
                  user_id TEXT NOT NULL,
                  notify_email BOOLEAN DEFAULT 1,
                  notify_browser BOOLEAN DEFAULT 1,
                  notify_all_events BOOLEAN DEFAULT 1,
                  browser_1h_before BOOLEAN DEFAULT 1,
                  browser_10m_before BOOLEAN DEFAULT 1,
                  notify_new_events BOOLEAN DEFAULT 1,
                  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                  updated_at TEXT,
                  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                  UNIQUE(user_id)
                )
              `, (err) => {
                if (err) {
                  console.error('Error creating new user_preferences table:', err);
                  return db.run('ROLLBACK', () => reject(err));
                }
                
                // Copy data from old table to new table
                console.log('Copying data to new table...');
                db.run(`
                  INSERT INTO user_preferences_new (
                    id, user_id, notify_email, notify_browser, 
                    notify_all_events, browser_1h_before, 
                    browser_10m_before, notify_new_events, 
                    created_at, updated_at
                  )
                  SELECT 
                    id, user_id, notify_email, notify_browser, 
                    notify_all_events, browser_1h_before, 
                    browser_10m_before, COALESCE(notify_new_events, 1), 
                    created_at, updated_at
                  FROM user_preferences
                `, function(err) {
                  if (err) {
                    console.error('Error copying data to new table:', err);
                    return db.run('ROLLBACK', () => reject(err));
                  }
                  console.log(`Copied ${this.changes} rows to new table`);
                  
                  // Drop the old table
                  console.log('Dropping old table...');
                  db.run('DROP TABLE user_preferences', (err) => {
                    if (err) {
                      console.error('Error dropping old table:', err);
                      return db.run('ROLLBACK', () => reject(err));
                    }
                    
                    // Rename new table to original name
                    console.log('Renaming new table...');
                    db.run('ALTER TABLE user_preferences_new RENAME TO user_preferences', (err) => {
                      if (err) {
                        console.error('Error renaming table:', err);
                        return db.run('ROLLBACK', () => reject(err));
                      }
                      
                      // Recreate indexes
                      console.log('Recreating indexes...');
                      db.series([
                        (next) => db.run('CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id)', next)
                      ], (err) => {
                        if (err) {
                          console.error('Error recreating indexes:', err);
                          return db.run('ROLLBACK', () => reject(err));
                        }
                        
                        // Commit the transaction
                        console.log('Committing transaction...');
                        db.run('COMMIT', (err) => {
                          if (err) {
                            console.error('Error committing transaction:', err);
                            return reject(err);
                          }
                          console.log('Migration completed successfully');
                          resolve();
                        });
                      });
                    });
                  });
                });
              });
            }
          );
        });
      } catch (error) {
        console.error('Migration error:', error);
        db.run('ROLLBACK', () => {
          reject(error);
        });
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
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
