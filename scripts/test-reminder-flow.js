require('dotenv').config();
const { TwitterService } = require('../services/twitterService');
const { getDb } = require('../db');
const { format, addMinutes, parseISO, formatDistanceToNow } = require('date-fns');
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

// Initialize Twitter service
const twitterService = new TwitterService();

async function getNextEvent() {
  const db = await getDb();
  
  // Find the next event that doesn't have a reminder set yet
  const event = await new Promise((resolve, reject) => {
    db.get(`
      SELECT e.* 
      FROM events e
      LEFT JOIN event_reminders er ON e.id = er.event_id AND er.reminder_minutes = 10
      WHERE e.start_time > datetime('now')
        AND e.is_deleted = 0
        AND (er.id IS NULL OR er.sent_at IS NULL)
      ORDER BY e.start_time ASC
      LIMIT 1
    `, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
  
  return event;
}

async function testReminder() {
  try {
    console.log('🔍 Looking for the next upcoming event...');
    
    // Get the next event
    const event = await getNextEvent();
    
    if (!event) {
      console.log('No upcoming events found that need reminders.');
      return;
    }
    
    const eventTime = new Date(event.start_time);
    const reminderTime = addMinutes(eventTime, -10); // 10 minutes before event
    const now = new Date();
    
    console.log('\n📅 Next Event Details:');
    console.log('-------------------');
    console.log(`Title: ${event.title}`);
    console.log(`Event ID: ${event.id}`);
    console.log(`Event Time: ${eventTime.toLocaleString()}`);
    console.log(`Reminder Time: ${reminderTime.toLocaleString()}`);
    console.log(`Time until reminder: ${formatDistanceToNow(reminderTime, { addSuffix: true })}`);
    
    // Show what the reminder tweet will look like
    const tweetText = twitterService.formatEventTweet(event, 10);
    console.log('\n📝 Reminder Tweet Preview:');
    console.log('----------------------');
    console.log(tweetText);
    
    // Ask if we should post the reminder now
    readline.question('\nDo you want to post this reminder now? (y/N) ', async (answer) => {
      if (answer.toLowerCase() === 'y') {
        console.log('\n🚀 Posting reminder now...');
        try {
          // Force post the reminder
          await twitterService.checkAndPostReminders([10]);
          console.log('✅ Reminder posted successfully!');
        } catch (error) {
          console.error('❌ Error posting reminder:', error.message);
        }
      } else {
        console.log('\nReminder not posted. The system will post it automatically at the scheduled time.');
      }
      
      // Close the readline interface
      readline.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Error testing reminder:', error);
    process.exit(1);
  }
}

// Run the test
testReminder();
