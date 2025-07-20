require('dotenv').config();
const { getDb } = require('../db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const db = await getDb();
  
  try {
    // Get all migration files
    const migrationsDir = path.join(__dirname, '../migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js') && file !== 'index.js')
      .sort();
    
    console.log('Found migrations:', migrationFiles);
    
    // Create migrations table if it doesn't exist
    await db.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Get applied migrations
    const appliedMigrations = await db.all('SELECT name FROM migrations');
    const appliedMigrationNames = new Set(appliedMigrations.map(m => m.name));
    
    console.log('Applied migrations:', [...appliedMigrationNames]);
    
    // Run pending migrations
    for (const file of migrationFiles) {
      if (!appliedMigrationNames.has(file)) {
        console.log(`\nRunning migration: ${file}`);
        const migration = require(path.join(migrationsDir, file));
        
        // Start transaction
        await db.run('BEGIN TRANSACTION');
        
        try {
          // Run migration
          await migration.up();
          
          // Record migration
          await db.run('INSERT INTO migrations (name) VALUES (?)', [file]);
          
          // Commit transaction
          await db.run('COMMIT');
          console.log(`✅ Successfully applied migration: ${file}`);
        } catch (error) {
          // Rollback on error
          await db.run('ROLLBACK');
          console.error(`❌ Error applying migration ${file}:`, error);
          throw error;
        }
      }
    }
    
    console.log('\n✅ All migrations applied successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    if (db) {
      await db.close().catch(console.error);
    }
  }
}

// Run the migration
runMigration().catch(console.error);
