const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'db', 'calendar.db');

// Create a direct database connection
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    return;
  }
  console.log('Connected to the database.');
  
  // List all tables
  db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
    if (err) {
      console.error('Error listing tables:', err);
      db.close();
      return;
    }
    
    console.log('\nTables in database:');
    console.log('===================');
    
    if (tables && tables.length > 0) {
      tables.forEach((table, index) => {
        console.log(`${index + 1}. ${table.name}`);
        
        // For each table, show its structure
        db.all(`PRAGMA table_info(${table.name})`, [], (err, columns) => {
          if (err) {
            console.error(`  Error getting schema for ${table.name}:`, err.message);
            return;
          }
          
          console.log(`\n  Table: ${table.name}`);
          console.log('  ' + '-'.repeat(10 + table.name.length));
          
          if (columns && columns.length > 0) {
            console.log('  Columns:');
            columns.forEach(col => {
              console.log(`    - ${col.name} (${col.type}${col.pk ? ', PRIMARY KEY' : ''}${col.notnull ? ', NOT NULL' : ''}${col.dflt_value ? ', DEFAULT ' + col.dflt_value : ''})`);
            });
          } else {
            console.log('  No columns found');
          }
          
          // If this is the last table, close the connection
          if (index === tables.length - 1) {
            db.close();
          }
        });
      });
    } else {
      console.log('No tables found in the database.');
      db.close();
    }
  });
});
