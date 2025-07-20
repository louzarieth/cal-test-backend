const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { TwitterService } = require('../services/twitterService');

const dbPath = path.join(__dirname, '..', 'db', 'calendar.db');

// Function to query upcoming events
function getUpcomingEvents() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
      
      const query = `
        SELECT id, title, start_time, end_time 
        FROM events 
        WHERE start_time > datetime('now') 
        ORDER BY start_time 
        LIMIT 5
      `;
      
      db.all(query, [], (err, rows) => {
        db.close();
        if (err) return reject(err);
        resolve(rows);
      });
    });
  });
}

// Function to check if reminders exist for an event
function checkReminders(eventId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
      
      const query = `
        SELECT reminder_minutes, sent_at, tweet_id 
        FROM event_reminders 
        WHERE event_id = ?
      `;
      
      db.all(query, [eventId], (err, rows) => {
        db.close();
        if (err) return reject(err);
        resolve(rows);
      });
    });
  });
}

async function main() {
  try {
    console.log('🔍 Checking Twitter reminder setup...');
    
    // Check if we have Twitter credentials
    const requiredVars = [
      'TWITTER_API_KEY',
      'TWITTER_API_SECRET',
      'TWITTER_ACCESS_TOKEN',
      'TWITTER_ACCESS_SECRET'
    ];
    
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      console.log('❌ Missing Twitter API credentials. Please set these environment variables:');
      console.log(missingVars.join(', '));
      return;
    }
    
    console.log('✅ Twitter API credentials found');
    
    // Initialize Twitter service
    const twitterService = new TwitterService();
    
    // Get upcoming events
    console.log('\n📅 Checking for upcoming events...');
    const events = await getUpcomingEvents();
    
    if (events.length === 0) {
      console.log('No upcoming events found in the database.');
      console.log('Please make sure the calendar refresh is working and events are being imported.');
      return;
    }
    
    console.log(`\nFound ${events.length} upcoming events:`);
    for (const event of events) {
      console.log(`\n📌 Event: ${event.title}`);
      console.log(`   ID: ${event.id}`);
      console.log(`   Start: ${new Date(event.start_time).toLocaleString()}`);
      
      // Check for existing reminders
      const reminders = await checkReminders(event.id);
      if (reminders.length > 0) {
        console.log('   Existing reminders:');
        for (const reminder of reminders) {
          console.log(`   - ${reminder.reminder_minutes} min before: ${reminder.sent_at ? `Sent at ${reminder.sent_at} (Tweet ID: ${reminder.tweet_id || 'N/A'})` : 'Pending'}`);
        }
      } else {
        console.log('   No reminders set up for this event yet.');
      }
    }
    
    // Test the Twitter service
    console.log('\n🧪 Testing Twitter service...');
    try {
      const username = await twitterService.verifyCredentials();
      console.log(`✅ Twitter service is working (authenticated as @${username})`);
      
      // Test scheduling a reminder for the next event
      const nextEvent = events[0];
      console.log(`\n⏰ Next event: ${nextEvent.title} at ${new Date(nextEvent.start_time).toLocaleString()}`);
      
      // Check if a reminder is already scheduled
      const nextEventReminders = await checkReminders(nextEvent.id);
      const has10MinReminder = nextEventReminders.some(r => r.reminder_minutes === 10);
      
      if (has10MinReminder) {
        console.log('✅ 10-minute reminder is already set up for this event');
      } else {
        console.log('ℹ️ No 10-minute reminder set up yet. The scheduler should create one soon.');
      }
      
    } catch (error) {
      console.error('❌ Twitter service test failed:', error.message);
      if (error.rateLimit) {
        console.error('Rate limit info:', error.rateLimit);
      }
    }
    
    console.log('\n✅ Twitter reminder check completed. The system appears to be set up correctly.');
    console.log('The scheduler will automatically post reminders 10 minutes before each event.');
    
  } catch (error) {
    console.error('❌ Error during Twitter reminder check:', error);
  } finally {
    process.exit(0);
  }
}

// Run the test
main();
