const { getDb } = require('../db');
const path = require('path');
const fs = require('fs');

async function checkDatabase() {
  try {
    // Check if database file exists
    const dbPath = path.join(__dirname, '..', 'database.sqlite');
    const dbExists = fs.existsSync(dbPath);
    
    console.log('📊 Database Configuration:');
    console.log(`- Database file: ${dbPath}`);
    console.log(`- Database exists: ${dbExists ? '✅ Yes' : '❌ No'}`);
    
    if (!dbExists) {
      console.log('\n🔍 No database file found. The application may be using a different database or in-memory storage.');
      return;
    }
    
    // Try to connect to the database
    const db = await getDb();
    
    // Get list of tables
    const tables = await db.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    
    console.log('\n📋 Database Tables:');
    if (tables && tables.length > 0) {
      tables.forEach(table => {
        console.log(`- ${table.name}`);
      });
      
      // Check if events table exists
      const eventsTableExists = tables.some(t => t.name === 'events');
      if (eventsTableExists) {
        // Count events
        const eventCount = await db.get('SELECT COUNT(*) as count FROM events');
        console.log(`\n📅 Events in database: ${eventCount.count}`);
        
        // Get next 5 upcoming events
        const upcomingEvents = await db.all(
          'SELECT id, title, start, end FROM events WHERE end > ? ORDER BY start ASC LIMIT 5',
          [new Date().toISOString()]
        );
        
        if (upcomingEvents && upcomingEvents.length > 0) {
          console.log('\n⏰ Upcoming Events:');
          upcomingEvents.forEach(event => {
            console.log(`- ${event.title} (ID: ${event.id})`);
            console.log(`  Start: ${event.start}`);
            console.log(`  End:   ${event.end}`);
            console.log('');
          });
        } else {
          console.log('\nℹ️ No upcoming events found in the database.');
        }
      }
      
      // Check for notification-related tables
      const notificationTables = ['user_preferences', 'push_subscriptions', 'event_reminders'];
      console.log('\n🔔 Notification System Status:');
      
      for (const table of notificationTables) {
        const exists = tables.some(t => t.name === table);
        console.log(`- ${table}: ${exists ? '✅ Found' : '❌ Not found'}`);
      }
      
      // Check if any users have notification preferences
      if (tables.some(t => t.name === 'user_preferences')) {
        const userPrefs = await db.get(
          'SELECT COUNT(*) as count FROM user_preferences WHERE notify_email = 1 OR notify_browser = 1'
        );
        console.log(`\n👥 Users with notifications enabled: ${userPrefs.count}`);
      }
      
    } else {
      console.log('No tables found in the database.');
    }
    
  } catch (error) {
    console.error('\n❌ Error checking database:', error.message);
    console.log('\n🔧 This might be due to:');
    console.log('1. Database not properly initialized');
    console.log('2. Database connection error');
    console.log('3. Missing database file or incorrect permissions');
  }
}

checkDatabase().then(() => process.exit(0));
