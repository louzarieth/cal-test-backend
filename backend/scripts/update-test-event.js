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

// Get the first event from the database
function getFirstEvent() {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM events ORDER BY id ASC LIMIT 1', [], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Update event time
async function updateEventTime(eventId) {
  const now = new Date();
  const startTime = new Date(now.getTime() + (5 * 60 * 1000)); // 5 minutes from now
  const endTime = new Date(startTime.getTime() + (60 * 60 * 1000)); // 1 hour duration
  
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE events SET start_time = ?, end_time = ?, updated_at = ? WHERE id = ?',
      [startTime.toISOString(), endTime.toISOString(), new Date().toISOString(), eventId],
      function(err) {
        if (err) reject(err);
        else {
          console.log(`✅ Updated event ${eventId} to start at ${startTime.toLocaleString()}`);
          resolve();
        }
      }
    );
  });
}

// Main function
async function main() {
  try {
    // Get the first event
    const event = await getFirstEvent();
    if (!event) {
      console.log('No events found in the database');
      return;
    }
    
    console.log(`📅 Found event: ${event.title}`);
    console.log(`   Current start time: ${new Date(event.start_time).toLocaleString()}`);
    
    // Update the event time
    await updateEventTime(event.id);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    // Close the database connection
    db.close();
  }
}

// Run the script
main();
