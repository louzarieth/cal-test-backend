const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to the database file
const dbPath = path.join(__dirname, '..', 'db', 'calendar.db');

async function showTables() {
  // Open the database
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database', err);
      process.exit(1);
    }
  });
  
  try {
    // Get list of tables
    const tables = await new Promise((resolve, reject) => {
      db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => row.name));
      });
    });

    console.log('\n=== Database Tables ===');
    
    // Show data for each table
    for (const table of tables) {
      if (table === 'sqlite_sequence') continue; // Skip internal SQLite table
      
      console.log(`\nTable: ${table}`);
      console.log('='.repeat(50));
      
      try {
        // Get column names
        const columns = await new Promise((resolve, reject) => {
          db.all(`PRAGMA table_info(${table})`, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows.map(row => row.name));
          });
        });
        
        // Get table data
        const rows = await new Promise((resolve, reject) => {
          db.all(`SELECT * FROM ${table}`, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
        
        // Display column headers
        console.log(columns.join(' | '));
        console.log('-'.repeat(50));
        
        // Display rows
        if (rows.length === 0) {
          console.log('(No data)');
        } else {
          for (const row of rows) {
            const values = columns.map(col => {
              const val = row[col];
              // Handle potential undefined/null values
              if (val === null || val === undefined) return 'NULL';
              // Truncate long values for display
              const str = String(val);
              return str.length > 30 ? str.substring(0, 27) + '...' : str;
            });
            console.log(values.join(' | '));
          }
        }
      } catch (err) {
        console.error(`Error reading table ${table}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Error reading database:', err);
  } finally {
    // Close the database connection
    db.close();
  }
}

// Run the function
showTables().catch(console.error);
