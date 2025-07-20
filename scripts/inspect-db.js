const { getDb } = require('../db');

async function inspectDatabase() {
  const db = await getDb();
  
  try {
    // Get list of all tables
    const tables = await db.all(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );

    console.log('\n📊 Database Tables:');
    console.log('='.repeat(50));
    
    for (const table of tables) {
      console.log(`\nTable: ${table.name}`);
      console.log('-' + '-'.repeat(table.name.length + 7));
      
      try {
        // Get table info
        const columns = await db.all(`PRAGMA table_info(${table.name})`);
        
        if (columns.length > 0) {
          console.log('Columns:');
          columns.forEach(col => {
            console.log(`  - ${col.name} (${col.type}${col.pk ? ', PRIMARY KEY' : ''}${col.notnull ? ', NOT NULL' : ''}${col.dflt_value ? ', DEFAULT ' + col.dflt_value : ''})`);
          });
        } else {
          console.log('  No columns found or unable to read schema');
        }
        
        // Get row count
        const countResult = await db.get(`SELECT COUNT(*) as count FROM ${table.name}`);
        console.log(`  Rows: ${countResult.count}`);
        
        // Show first 3 rows if table is not empty
        if (countResult.count > 0) {
          const rows = await db.all(`SELECT * FROM ${table.name} LIMIT 3`);
          console.log('  Sample Rows:');
          console.log(rows);
        }
        
      } catch (err) {
        console.error(`  Error inspecting table ${table.name}:`, err.message);
      }
    }
    
  } catch (error) {
    console.error('Error inspecting database:', error);
  } finally {
    if (db) {
      db.close();
    }
  }
}

inspectDatabase();
