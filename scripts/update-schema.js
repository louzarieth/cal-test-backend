const { getDb, runQuery } = require('../db');
const fs = require('fs');
const path = require('path');

async function updateSchema() {
  console.log('Starting database schema update...');
  
  try {
    // Check if the events table exists
    const tableInfo = await runQuery(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='events'"
    );
    
    if (!tableInfo || tableInfo.length === 0) {
      console.log('Events table does not exist. Creating it...');
      await createEventsTable();
    } else {
      console.log('Events table exists. Checking schema...');
      await updateEventsTable();
    }
    
    console.log('✅ Database schema update completed successfully');
  } catch (error) {
    console.error('❌ Error updating database schema:', error);
    process.exit(1);
  }
}

async function createEventsTable() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      html_link TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_deleted BOOLEAN DEFAULT 0,
      event_type TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_events_event_id ON events(event_id);
    CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
    CREATE INDEX IF NOT EXISTS idx_events_end_time ON events(end_time);
  `;
  
  console.log('Creating events table with schema:');
  console.log(createTableSQL);
  
  await runQuery(createTableSQL);
  console.log('✅ Created events table');
}

async function updateEventsTable() {
  try {
    const db = await getDb();
    
    // Get column info using PRAGMA
    const columns = await new Promise((resolve, reject) => {
      db.all('PRAGMA table_info(events)', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    const columnNames = columns.map(col => col.name);
    console.log('Current columns:', columnNames.join(', '));
    
    // Add missing columns
    if (!columnNames.includes('html_link')) {
      console.log('Adding html_link column to events table...');
      await runQuery('ALTER TABLE events ADD COLUMN html_link TEXT');
      console.log('✅ Added html_link column');
    }
    
    if (!columnNames.includes('event_type')) {
      console.log('Adding event_type column to events table...');
      await runQuery('ALTER TABLE events ADD COLUMN event_type TEXT');
      console.log('✅ Added event_type column');
    }
    
    // Remove location column since it's not needed
    if (columnNames.includes('location')) {
      console.log('Removing unused location column from events table...');
      await runQuery('ALTER TABLE events DROP COLUMN location');
      console.log('✅ Removed location column');
    }
    
    console.log('✅ Events table schema is up to date');
  } catch (err) {
    console.error('❌ Error updating events table:', err);
    throw err;
  }
}

// Run the update
updateSchema()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
