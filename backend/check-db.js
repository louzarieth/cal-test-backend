const fs = require('fs');
const path = require('path');
const { getDb } = require('./db');

async function checkDatabase() {
  const dbPath = path.join(__dirname, 'db', 'calendar.db');
  
  // Check if database file exists
  const dbExists = fs.existsSync(dbPath);
  console.log(`Database file exists: ${dbExists}`);
  console.log(`Database path: ${dbPath}`);
  
  if (dbExists) {
    const stats = fs.statSync(dbPath);
    console.log(`Database size: ${stats.size} bytes`);
    console.log(`Last modified: ${stats.mtime}`);
  }
  
  // Try to connect to the database
  try {
    console.log('\nAttempting to connect to database...');
    const db = await getDb();
    
    // Check database version
    const version = await new Promise((resolve, reject) => {
      db.get('SELECT sqlite_version() as version', (err, row) => {
        if (err) reject(err);
        else resolve(row?.version);
      });
    });
    
    console.log(`Connected to SQLite version: ${version}`);
    
    // List all tables
    const tables = await new Promise((resolve, reject) => {
      db.all(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
    
    console.log('\nDatabase tables:');
    if (tables.length === 0) {
      console.log('  No tables found in the database');
    } else {
      for (const table of tables) {
        const count = await new Promise((resolve) => {
          db.get(`SELECT COUNT(*) as count FROM ${table.name}`, (err, row) => {
            resolve(err ? -1 : (row?.count || 0));
          });
        });
        
        console.log(`  ${table.name}: ${count} rows`);
      }
    }
    
    // Check if events table exists and has data
    if (tables.some(t => t.name === 'events')) {
      const eventCount = await new Promise((resolve) => {
        db.get('SELECT COUNT(*) as count FROM events', (err, row) => {
          resolve(err ? -1 : (row?.count || 0));
        });
      });
      
      console.log(`\nEvents table has ${eventCount} rows`);
      
      if (eventCount > 0) {
        const sampleEvent = await new Promise((resolve) => {
          db.get('SELECT * FROM events LIMIT 1', (err, row) => {
            resolve(row || null);
          });
        });
        
        if (sampleEvent) {
          console.log('\nSample event:');
          console.log(JSON.stringify(sampleEvent, null, 2));
        }
      }
    }
    
  } catch (error) {
    console.error('\nError connecting to database:');
    console.error(error);
  } finally {
    // Close the database connection
    const { closeDb } = require('./db');
    await closeDb();
    process.exit(0);
  }
}

checkDatabase();
