const { getDb } = require('../db');
const { format } = require('date-fns');

async function checkUpcomingNotifications() {
  try {
    const db = await getDb();
    const now = new Date();
    
    // Get all upcoming events in the next 24 hours
    let events = [];
    try {
      // First, check if we can connect to the database
      const db = await getDb();
      if (!db) {
        console.error('❌ Error: Could not connect to the database');
        return;
      }

      // Try to get events in the next 24 hours
      const result = await db.all(
        `SELECT e.* 
         FROM events e 
         WHERE e.end > ? 
         AND e.start <= datetime(?, '+24 hours')
         AND (e.is_deleted = 0 OR e.is_deleted IS NULL)
         ORDER BY e.start ASC`,
        [now.toISOString(), now.toISOString()]
      ) || [];
      
      // Ensure we have an array, even if empty
      events = Array.isArray(result) ? result : [];
      
      if (events.length === 0) {
        console.log('ℹ️ No events found in the next 24 hours.');
        
        // Try to get any future events
        try {
          const allEvents = await db.all(
            `SELECT id, title, start, end, event_type 
             FROM events 
             WHERE (is_deleted = 0 OR is_deleted IS NULL)
             AND end > ? 
             ORDER BY start ASC 
             LIMIT 5`,
            [now.toISOString()]
          ) || [];
          
          if (allEvents && allEvents.length > 0) {
            console.log('\n📅 Next upcoming events:');
            allEvents.forEach(evt => {
              console.log(`- ${evt.title} (ID: ${evt.id})`);
              console.log(`  Type:   ${evt.event_type || 'N/A'}`);
              console.log(`  Start:  ${evt.start}`);
              console.log(`  End:    ${evt.end}\n`);
            });
          } else {
            console.log('ℹ️ No upcoming events found in the database.');
          }
        } catch (e) {
          console.error('⚠️ Error fetching all events:', e.message);
        }
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      events = [];
    }

    if (!events || events.length === 0) {
      console.log('No upcoming events in the next 24 hours.');
      
      // Show all events in the database for debugging
      const allEvents = await db.all('SELECT id, title, start, end FROM events ORDER BY start ASC') || [];
      console.log('\nAll events in database:');
      allEvents.forEach(evt => {
        console.log(`- ${evt.title} (ID: ${evt.id})`);
        console.log(`  Start: ${evt.start}`);
        console.log(`  End:   ${evt.end}`);
      });
      
      return;
    }

    console.log(`\n📅 Found ${events.length} upcoming events in the next 24 hours:\n`);
    
    for (const event of events) {
      const eventTime = new Date(event.start);
      const timeUntil = Math.round((eventTime - now) / (60 * 1000)); // in minutes
      
      console.log(`📌 Event: ${event.title}`);
      console.log(`   📅 Date: ${format(eventTime, 'yyyy-MM-dd HH:mm')} (in ~${timeUntil} minutes)`);
      console.log(`   🔗 ID: ${event.id}`);
      
      // Get users who should be notified about this event
      const users = await db.all(
        `SELECT u.id, u.email, u.name,
                up.notify_email, up.notify_browser, 
                up.notify_1h_before, up.notify_10m_before
         FROM users u
         JOIN user_preferences up ON u.email = up.email
         WHERE u.is_active = 1
         AND (up.notify_all_events = 1 OR EXISTS (
           SELECT 1 FROM user_event_preferences uep 
           WHERE uep.user_id = u.id 
           AND uep.event_type = ? 
           AND uep.is_enabled = 1
         ))`,
        [event.event_type || '']
      );

      if (users.length === 0) {
        console.log('   👤 No users to notify for this event');
      } else {
        console.log(`   👤 ${users.length} users will be notified:`);
        users.forEach(user => {
          const notifications = [];
          if (user.notify_email) {
            if (user.notify_1h_before) notifications.push('email (1h before)');
            if (user.notify_10m_before) notifications.push('email (10m before)');
          }
          if (user.notify_browser) {
            if (user.notify_1h_before) notifications.push('browser (1h before)');
            if (user.notify_10m_before) notifications.push('browser (10m before)');
          }
          console.log(`      - ${user.name} <${user.email}>: ${notifications.join(', ') || 'no notifications'}`);
        });
      }
      
      // Calculate notification times
      const oneHourBefore = new Date(eventTime.getTime() - 60 * 60 * 1000);
      const tenMinutesBefore = new Date(eventTime.getTime() - 10 * 60 * 1000);
      
      console.log('   ⏰ Next notification times:');
      if (oneHourBefore > now) {
        console.log(`      - 1 hour before: ~${Math.round((oneHourBefore - now) / (60 * 1000))} minutes from now (${format(oneHourBefore, 'HH:mm')})`);
      }
      if (tenMinutesBefore > now) {
        console.log(`      - 10 minutes before: ~${Math.round((tenMinutesBefore - now) / (60 * 1000))} minutes from now (${format(tenMinutesBefore, 'HH:mm')})`);
      }
      
      console.log(''); // Add spacing between events
    }
    
  } catch (error) {
    console.error('Error checking upcoming notifications:', error);
  } finally {
    process.exit(0);
  }
}

checkUpcomingNotifications();
