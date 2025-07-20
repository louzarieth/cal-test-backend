const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Try to find the database file
const possibleDbPaths = [
  path.join(__dirname, '../db/database.sqlite'),
  path.join(__dirname, '../database.sqlite'),
  path.join(process.cwd(), 'database.sqlite'),
  path.join(process.cwd(), 'db/database.sqlite')
];

// Find the first existing database file
let dbPath = possibleDbPaths.find(p => fs.existsSync(p));

if (!dbPath) {
  console.error('❌ Could not find database file. Checked these locations:');
  possibleDbPaths.forEach(p => console.log(`   - ${p}`));
  process.exit(1);
}

console.log(`🔍 Using database: ${dbPath}`);

// Connect to the database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error connecting to database:', err.message);
    process.exit(1);
  }
  
  console.log('✅ Connected to database');
  
  // First check if table exists
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='push_subscriptions'", [], (err, row) => {
    if (err) {
      console.error('❌ Error checking for table:', err.message);
      db.close();
      return;
    }
    
    if (!row) {
      console.log('❌ push_subscriptions table does not exist');
      db.close();
      return;
    }
    
    console.log('✅ push_subscriptions table exists');
    
    // Count rows before deletion
    db.get('SELECT COUNT(*) as count FROM push_subscriptions', [], (err, row) => {
      if (err) {
        console.error('❌ Error counting rows:', err.message);
        db.close();
        return;
      }
      
      const countBefore = row ? row.count : 0;
      console.log(`📊 Rows in push_subscriptions before: ${countBefore}`);
      
      if (countBefore === 0) {
        console.log('✅ Table is already empty');
        db.close();
        return;
      }
      
      // Delete all rows
      db.run('DELETE FROM push_subscriptions', function(err) {
        if (err) {
          console.error('❌ Error clearing table:', err.message);
          db.close();
          return;
        }
        
        console.log(`✅ Deleted ${this.changes} rows from push_subscriptions`);
        
        // Verify deletion
        db.get('SELECT COUNT(*) as count FROM push_subscriptions', [], (err, row) => {
          if (err) {
            console.error('❌ Error verifying deletion:', err.message);
          } else {
            console.log(`📊 Rows in push_subscriptions after: ${row.count}`);
          }
          
          db.close();
        });
      });
    });
  });
});
