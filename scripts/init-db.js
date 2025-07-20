require('dotenv').config();
const { setupDatabase } = require('../db/setup');
const { getDb } = require('../db');

async function main() {
  try {
    console.log('🔄 Setting up database...');
    await setupDatabase();
    
    const db = await getDb();
    
    // Test the database connection
    const result = await db.get("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('✅ Database setup complete. Tables:', result);
    
    // List all tables
    const tables = await db.all(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    
    console.log('\n📋 Database tables:');
    for (const table of tables) {
      console.log(`- ${table.name}`);
      
      // Get table info
      try {
        const columns = await db.all(`PRAGMA table_info(${table.name})`);
        console.log(`  Columns: ${columns.map(c => c.name).join(', ')}`);
      } catch (e) {
        console.log('  (Could not fetch columns)');
      }
    }
    
    console.log('\n✨ Database is ready!');
    
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    const db = await getDb().catch(() => null);
    if (db) {
      await db.close().catch(console.error);
    }
  }
}

main();
