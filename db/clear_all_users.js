const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'calendar.db');

// Open the database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
    process.exit(1);
  }
  console.log('Connected to the SQLite database.');
  
  // Enable foreign key constraints
  db.run('PRAGMA foreign_keys = ON');
  
  // Start a transaction
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    try {
      // List of tables to clear (in order to respect foreign key constraints)
      const tablesToClear = [
        'event_reminders',
        'push_subscriptions',
        'user_event_preferences',
        'user_preferences',
        'users'
      ];
      
      // Clear each table
      tablesToClear.forEach(table => {
        db.run(`DELETE FROM ${table}`, function(err) {
          if (err) {
            console.error(`Error clearing ${table}:`, err);
            return db.run('ROLLBACK', () => {
              db.close();
              process.exit(1);
            });
          }
          console.log(`Cleared ${this.changes} rows from ${table}`);
        });
      });
      
      // Commit the transaction
      db.run('COMMIT', (err) => {
        if (err) {
          console.error('Error committing transaction:', err);
          return db.run('ROLLBACK', () => {
            db.close();
            process.exit(1);
          });
        }
        
        console.log('\nSuccessfully cleared all user data!');
        
        // Verify the tables are empty
        db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name", [], (err, tables) => {
          if (err) {
            console.error('Error getting table list:', err);
            db.close();
            return;
          }
          
          console.log('\nTable row counts after cleanup:');
          console.log('----------------------------');
          
          let tablesProcessed = 0;
          tables.forEach(table => {
            db.get(`SELECT COUNT(*) as count FROM ${table.name}`, (err, row) => {
              if (err) {
                console.error(`Error getting row count for ${table.name}:`, err);
              } else {
                console.log(`${table.name.padEnd(25)}: ${row.count} rows`);
              }
              
              tablesProcessed++;
              if (tablesProcessed === tables.length) {
                console.log('\nAll user data has been cleared.');
                db.close();
              }
            });
          });
        });
      });
      
    } catch (error) {
      console.error('Error during cleanup:', error);
      db.run('ROLLBACK', () => {
        db.close();
        process.exit(1);
      });
    }
  });
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nOperation cancelled by user.');
  db.close();
  process.exit(0);
});
