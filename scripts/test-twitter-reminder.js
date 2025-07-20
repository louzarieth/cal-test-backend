const { TwitterService } = require('../services/twitterService');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize database connection
const dbPath = path.join(__dirname, '..', 'db', 'calendar.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to the database');
});

// Helper function to run SQL queries with promises
function dbRun(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// Helper function to get a single row
function dbGet(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function testTwitterReminder() {
  try {
    console.log('🚀 Starting Twitter reminder test...');
    
    // Find an upcoming event in the database
    const now = new Date();
    const futureTime = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // Next 24 hours
    
    console.log('🔍 Looking for upcoming events...');
    const upcomingEvent = await dbGet(
      `SELECT * FROM events 
       WHERE start_time > ? AND start_time < ? AND is_deleted = 0 
       ORDER BY start_time ASC LIMIT 1`,
      [now.toISOString(), futureTime.toISOString()]
    );
    
    if (!upcomingEvent) {
      throw new Error('No upcoming events found in the database. Please add an event first.');
    }
    
    console.log(`✅ Found upcoming event: ${upcomingEvent.title}`);
    console.log(`   Starts at: ${new Date(upcomingEvent.start_time).toLocaleString()}`);
    console.log(`   Event ID: ${upcomingEvent.id}`);
    
    // Update the event to start in 5 minutes for testing
    const testStartTime = new Date(now.getTime() + (5 * 60 * 1000)); // 5 minutes from now
    const testEndTime = new Date(testStartTime.getTime() + (30 * 60 * 1000)); // 30 min duration
    
    await dbRun(
      `UPDATE events 
       SET start_time = ?, end_time = ?, updated_at = ? 
       WHERE id = ?`,
      [testStartTime.toISOString(), testEndTime.toISOString(), new Date().toISOString(), upcomingEvent.id]
    );
    
    console.log(`🔄 Updated event to start at: ${testStartTime.toLocaleString()}`);
    
    const testEvent = {
      ...upcomingEvent,
      start_time: testStartTime.toISOString(),
      end_time: testEndTime.toISOString()
    };
    
    // Initialize Twitter service
    const twitterService = new TwitterService();
    
    // Start the scheduler with debug output
    console.log('🔄 Starting Twitter reminder scheduler...');
    const scheduler = twitterService.startScheduler({
      runOnStart: true
    });
    
    console.log('\n📝 Test Setup Complete!');
    console.log('The test event will trigger a Twitter reminder in about 5 minutes.');
    console.log('\nTo monitor the process:');
    console.log('1. Keep this terminal open');
    console.log('2. Watch for the reminder log message');
    console.log('3. Check your Twitter account for the test reminder');
    
    // Clean up after test completes
    setTimeout(async () => {
      console.log('\n🧹 Restoring original event times...');
      try {
        await dbRun(
          `UPDATE events 
           SET start_time = ?, end_time = ?, updated_at = ? 
           WHERE id = ?`,
          [upcomingEvent.start_time, upcomingEvent.end_time, new Date().toISOString(), upcomingEvent.id]
        );
        console.log('✅ Original event times restored');
      } catch (error) {
        console.error('Error restoring original event times:', error.message);
      }
      
      // Stop the scheduler
      if (scheduler && typeof scheduler.stop === 'function') {
        scheduler.stop();
        console.log('⏹️  Twitter reminder scheduler stopped');
      }
      
      console.log('\n✅ Test complete!');
      // Close the database connection
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
        } else {
          console.log('🔴 Database connection closed');
        }
        process.exit(0);
      });
    }, 10 * 60 * 1000); // Wait 10 minutes for test to complete
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testTwitterReminder();
