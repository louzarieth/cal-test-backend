require('dotenv').config();
const { TwitterService } = require('../services/twitterService');
const { getDb } = require('../db');
const { format, addMinutes, parseISO, formatDistanceToNow, differenceInMinutes } = require('date-fns');
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

// Initialize Twitter service
const twitterService = new TwitterService();

async function getUpcomingEvents() {
  const db = await getDb();
  
  // Find all upcoming events in the next 7 days
  const events = await new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        e.*,
        er.sent_at as reminder_sent,
        er.tweet_id,
        er.reminder_minutes
      FROM events e
      LEFT JOIN event_reminders er ON e.id = er.event_id AND er.reminder_minutes = 10
      WHERE e.start_time > datetime('now')
        AND e.start_time < datetime('now', '+7 days')
        AND e.is_deleted = 0
      ORDER BY e.start_time ASC
    `, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
  
  return events;
}

async function testReminderForEvent(eventId) {
  try {
    console.log('\n🚀 Testing reminder for event ID:', eventId);
    
    // Force check and post reminders
    const result = await twitterService.checkAndPostReminders([10]);
    
    console.log('✅ Reminder test completed:', result);
    
    // Check if reminder was created in the database
    const db = await getDb();
    const reminder = await new Promise((resolve) => {
      db.get(
        'SELECT * FROM event_reminders WHERE event_id = ? AND reminder_minutes = 10',
        [eventId],
        (err, row) => resolve(row)
      );
    });
    
    if (reminder) {
      console.log('\n📝 Reminder was created/updated:');
      console.log('----------------------------');
      console.log(`Event ID: ${reminder.event_id}`);
      console.log(`Reminder Time: ${new Date(reminder.sent_at).toLocaleString()}`);
      console.log(`Tweet ID: ${reminder.tweet_id || 'Not posted yet'}`);
    } else {
      console.log('\nℹ️ No reminder was created. The event might not be within the reminder window.');
    }
    
  } catch (error) {
    console.error('❌ Error testing reminder:', error);
  }
}

async function showEventMenu(events) {
  console.log('\n📅 Upcoming Events (Next 7 days)');
  console.log('==============================');
  
  events.forEach((event, index) => {
    const eventTime = new Date(event.start_time);
    const reminderTime = addMinutes(eventTime, -10);
    const now = new Date();
    const timeUntilEvent = formatDistanceToNow(eventTime, { addSuffix: true });
    const reminderStatus = event.reminder_sent 
      ? `✅ Reminder sent at ${new Date(event.reminder_sent).toLocaleString()}`
      : `⏰ Reminder scheduled for ${reminderTime.toLocaleString()}`;
    
    console.log(`\n${index + 1}. ${event.title}`);
    console.log(`   📅 ${eventTime.toLocaleString()}`);
    console.log(`   ⏰ ${timeUntilEvent}`);
    console.log(`   🔔 ${reminderStatus}`);
    if (event.tweet_id) {
      console.log(`   🐦 Tweet ID: ${event.tweet_id}`);
    }
  });
  
  console.log('\nOptions:');
  console.log('1-' + events.length + '. Test reminder for event');
  console.log('r. Refresh event list');
  console.log('q. Quit');
  
  readline.question('\nSelect an option: ', async (answer) => {
    if (answer.toLowerCase() === 'q') {
      console.log('Goodbye! 👋');
      readline.close();
      process.exit(0);
    } else if (answer.toLowerCase() === 'r') {
      // Refresh the event list
      const events = await getUpcomingEvents();
      showEventMenu(events);
    } else {
      const index = parseInt(answer) - 1;
      if (index >= 0 && index < events.length) {
        const event = events[index];
        console.log(`\nSelected: ${event.title}`);
        await testReminderForEvent(event.id);
        
        // After testing, show menu again
        const updatedEvents = await getUpcomingEvents();
        showEventMenu(updatedEvents);
      } else {
        console.log('Invalid selection. Please try again.');
        showEventMenu(events);
      }
    }
  });
}

async function main() {
  try {
    console.log('🔍 Loading upcoming events...');
    const events = await getUpcomingEvents();
    
    if (events.length === 0) {
      console.log('No upcoming events found in the next 7 days.');
      process.exit(0);
    }
    
    showEventMenu(events);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the test
console.log('🐦 Twitter Reminder System Test');
console.log('==============================');
main();
