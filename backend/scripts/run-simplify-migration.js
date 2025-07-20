const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { promisify } = require('util');

// Path to the database file
const dbPath = path.join(__dirname, '..', 'db', 'calendar.db');

// Open the database
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, async (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    return;
  }

  // Promisify database methods
  const run = promisify(db.run.bind(db));
  const all = promisify(db.all.bind(db));

  try {
    console.log('🚀 Starting database migration...');
    
    // Create a backup of the current database
    const backupPath = `${dbPath}.${new Date().toISOString().replace(/[:.]/g, '-')}.backup`;
    await run(`VACUUM main INTO '${backupPath.replace(/\\/g, '\\')}'`);
    console.log(`✅ Database backup created at: ${backupPath}`);

    // Run the migration
    console.log('🔄 Running migration...');
    const migration = require('../migrations/20240715_simplify_user_preferences');
    await migration.up({
      run: (sql, params = []) => run(sql, params),
      all: (sql, params = []) => all(sql, params)
    });

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    // Close the database connection
    db.close();
  }
});
