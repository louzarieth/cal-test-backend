const cron = require('node-cron');
const { getDb, getRows, getRow } = require('../../db');
const { sendEventNotification } = require('./emailService');
const webpush = require('web-push');

// Initialize web-push with VAPID keys
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Store active timeouts to clear them if needed
const activeTimeouts = new Map();

/**
 * Send a browser push notification
 * @param {Object} user User object
 * @param {Object} event Event object
 * @param {string} timeBefore Time before event (e.g., '1 hour')
 */
const sendBrowserNotification = async (user, event, timeBefore) => {
  try {
    // Get all push subscriptions for this user
    const subscriptions = await getRows(
      'SELECT * FROM push_subscriptions WHERE user_id = ?',
      [user.id]
    );

    // Send notification to each subscription
    for (const subscription of subscriptions) {
      try {
        const payload = JSON.stringify({
          title: `Event Reminder: ${event.title}`,
          body: `Event starts in ${timeBefore}`,
          icon: '/icon-192x192.png',
          data: {
            url: '/calendar', // URL to open when notification is clicked
            eventId: event.id
          }
        });

        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: JSON.parse(subscription.keys)
          },
          payload
        );
      } catch (err) {
        console.error('Error sending push notification:', err);
        
        // If the subscription is no longer valid, remove it
        if (err.statusCode === 410) {
          await getDb().run(
            'DELETE FROM push_subscriptions WHERE endpoint = ?',
            [subscription.endpoint]
          );
        }
      }
    }
  } catch (error) {
    console.error('Error in sendBrowserNotification:', error);
  }
};

/**
 * Schedule notifications for an event for a specific user
 * @param {Object} event Event object
 * @param {Object} user User object with preferences
 */
const scheduleEventNotificationsForUser = async (event, user) => {
  const eventTime = new Date(event.start);
  const now = new Date();
  
  // Don't schedule notifications for past events
  if (eventTime < now) {
    return false;
  }

  try {
    console.log(`   👤 User: ${user.name} (${user.id})`);
    
    // Check if user has notifications enabled for this event type
    const db = await getDb();
    const eventType = event.event_type || 'default';
      );
      
      if (tenMinutesBefore > now && !existingReminder) {
        const timeout = setTimeout(() => {
          sendEventNotification([user], event, '10 minutes');
        }, tenMinutesBefore - now);
        
        activeTimeouts.set(`${event.id}-email-10m-${user.id}`, timeout);
      }
    }
  }
  
  // Schedule browser notifications if enabled
  if (preferences.notify_browser === 1) {
    // 1 hour before
    if (preferences.notify_1h_before === 1) {
      const oneHourBefore = new Date(eventTime.getTime() - 60 * 60 * 1000);
      if (oneHourBefore > now) {
        const timeout = setTimeout(() => {
          sendBrowserNotification(user, event, '1 hour');
        }, oneHourBefore - now);
        
        activeTimeouts.set(`${event.id}-browser-1h-${user.id}`, timeout);
      }
    }
    
    // 10 minutes before
    if (preferences.notify_10m_before === 1) {
      const tenMinutesBefore = new Date(eventTime.getTime() - 10 * 60 * 1000);
      if (tenMinutesBefore > now) {
        const timeout = setTimeout(() => {
          sendBrowserNotification(user, event, '10 minutes');
        }, tenMinutesBefore - now);
        
        activeTimeouts.set(`${event.id}-browser-10m-${user.id}`, timeout);
      }
    }
  }
};

/**
 * Schedule notifications for all upcoming events for all users
 */
const scheduleAllUpcomingEvents = async () => {
  try {
    console.log('🔍 [Scheduler] Starting to schedule upcoming events...');
    const db = await getDb();
    
    // Get all events that haven't ended yet
    const now = new Date();
    console.log(`⏰ [Scheduler] Current time: ${now.toISOString()}`);
    
    // First, get all event types that have interested users
    let eventTypesWithInterest = [];
    try {
      const query = `
        SELECT DISTINCT event_type 
        FROM user_event_preferences 
        WHERE is_enabled = 1
      `;
      console.log('ℹ️ [Scheduler] Fetching event types with interest...');
      eventTypesWithInterest = await db.all(query);
      console.log(`ℹ️ [Scheduler] Found ${eventTypesWithInterest.length} event types with interest`);
    } catch (error) {
      console.error('❌ [Scheduler] Error fetching event types with interest:', error);
      return [];
    }
    
    // If no specific event types have preferences, get all events
    // Otherwise, only get events of types that have interested users
    try {
      let events = [];
      const nowIso = now.toISOString();
      
      // Extract just the event type strings from the results
      const eventTypes = eventTypesWithInterest && eventTypesWithInterest.length > 0 
        ? eventTypesWithInterest.map(e => e.event_type).filter(Boolean)
        : [];
      
      if (eventTypes.length === 0) {
        // No specific preferences, get all upcoming events
        console.log('ℹ️ [Scheduler] No specific event preferences found, getting all upcoming events');
        const query = `
          SELECT e.* FROM events e 
          WHERE e.end_time > ? AND e.is_deleted = 0
          ORDER BY e.start_time ASC
        `;
        console.log(`ℹ️ [Scheduler] Executing query for all events after ${nowIso}`);
        events = await db.all(query, [nowIso]);
      } else {
        // Only get events of types that have interested users
        console.log(`ℹ️ [Scheduler] Found ${eventTypes.length} event types with interested users`);
        const placeholders = eventTypes.map(() => '?').join(',');
        
        const query = `
          SELECT e.* FROM events e 
          WHERE e.end_time > ? AND e.is_deleted = 0 
          AND (e.event_type IS NULL OR e.event_type IN (${placeholders}))
          ORDER BY e.start_time ASC
        `;
        
        // Combine all parameters
        const queryParams = [nowIso, ...eventTypes];
        
        console.log(`ℹ️ [Scheduler] Executing query for ${eventTypes.length} event types`);
        events = await db.all(query, queryParams);
      }
      
      console.log(`ℹ️ [Scheduler] Found ${events.length} events to process`);
      if (events.length > 0) {
        console.log(`ℹ️ [Scheduler] First event: ${events[0].title} (ID: ${events[0].id}) at ${events[0].start}`);
      }
      
      return events;
    } catch (error) {
      console.error('❌ [Scheduler] Error fetching events:', error);
      return [];
    }
    
    console.log(`📅 [Scheduler] Found ${events.length} upcoming events`);
      
    if (events.length === 0) {
      console.log('ℹ️ [Scheduler] No upcoming events found that match user preferences');
      return;
    }
      
    // Log the first few events for debugging
    events.slice(0, Math.min(3, events.length)).forEach((event, index) => {
      console.log(`📌 [Scheduler] Event #${index + 1}: "${event.title}" at ${event.start_time} (ID: ${event.id}, Type: ${event.event_type || 'none'})`);
    });
    if (events.length > 3) {
      console.log(`ℹ️ [Scheduler] ...and ${events.length - 3} more events`);
    }
    
    // Get all users with notification preferences
    console.log('👥 [Scheduler] Fetching users with notification preferences...');
    const users = await db.all(
      `SELECT u.id, u.email, u.name,
              up.notify_email, up.notify_browser, 
              up.notify_all_events, up.notify_1h_before, up.notify_10m_before
       FROM users u
       JOIN user_preferences up ON u.email = up.email
       WHERE u.is_active = 1`
    );
      
    console.log(`👥 [Scheduler] Found ${users.length} active users with notification preferences`);
      
    if (users.length === 0) {
      console.log('❌ [Scheduler] No active users with notification preferences found');
      return;
    }
      
    // Log user notification preferences for debugging
    users.slice(0, Math.min(3, users.length)).forEach((user, index) => {
      console.log(`👤 [Scheduler] User #${index + 1}: ${user.email} (ID: ${user.id})`);
      console.log(`   - Email notifications: ${user.notify_email ? '✅' : '❌'}`);
      console.log(`   - 1h before: ${user.notify_1h_before ? '✅' : '❌'}`);
      console.log(`   - 10m before: ${user.notify_10m_before ? '✅' : '❌'}`);
    });
    if (users.length > 3) {
      console.log(`ℹ️ [Scheduler] ...and ${users.length - 3} more users`);
    }
    
    console.log(`Scheduling notifications for ${users.length} users`);
    
    // Schedule notifications for each event and user combination
    let totalScheduled = 0;
    for (const event of events) {
      console.log(`\n📅 Processing event: ${event.title} (ID: ${event.id}, Type: ${event.event_type || 'none'})`);
      let eventScheduled = 0;
      
      for (const user of users) {
        const scheduled = await scheduleEventNotificationsForUser(event, user);
        if (scheduled) {
          eventScheduled++;
          totalScheduled++;
        }
      }
      
      console.log(`   ✓ Scheduled ${eventScheduled} notifications for this event`);
    }
    
    console.log(`\n✅ Total scheduled: ${totalScheduled} notifications for ${events.length} events`);
    return totalScheduled;
    console.log(`Scheduled notifications for ${events.length} events`);
  } catch (error) {
    console.error('Error scheduling event notifications:', error);
  }
};



/**
 * Clear all scheduled notifications for an event and user
 * @param {string} eventId Event ID
 * @param {string} userId User ID
 */
const clearEventNotificationsForUser = (eventId, userId) => {
  // Find all timeouts for this event and user
  for (const [key, timeout] of activeTimeouts.entries()) {
    if (key.startsWith(`${eventId}-`) && key.endsWith(`-${userId}`)) {
      clearTimeout(timeout);
      activeTimeouts.delete(key);
    }
  }
};

/**
 * Clear all scheduled notifications for an event
 * @param {string} eventId Event ID
 */
const clearEventNotifications = (eventId) => {
  // Find all timeouts for this event
  for (const [key, timeout] of activeTimeouts.entries()) {
    if (key.startsWith(eventId)) {
      clearTimeout(timeout);
      activeTimeouts.delete(key);
    }
  }
};

/**
 * Clear all scheduled notifications for a user
 * @param {string} userId User ID
 */
const clearUserNotifications = (userId) => {
  // Find all timeouts for this user
  for (const [key, timeout] of activeTimeouts.entries()) {
    if (key.endsWith(`-${userId}`)) {
      clearTimeout(timeout);
      activeTimeouts.delete(key);
    }
  }
};

// Run the scheduler every 15 minutes to catch any missed events
cron.schedule('*/15 * * * *', () => {
  console.log('🔔 [Scheduler] Running scheduled notification check...');
  scheduleAllUpcomingEvents()
    .then(() => console.log('✅ [Scheduler] Notification check completed'))
    .catch(err => console.error('❌ [Scheduler] Error in notification check:', err));
});

// Initial schedule (with a small delay to let the server start up)
setTimeout(() => {
  console.log('🚀 [Scheduler] Starting initial notification scheduling...');
  scheduleAllUpcomingEvents()
    .then(() => console.log('✅ [Scheduler] Initial scheduling completed'))
    .catch(err => console.error('❌ [Scheduler] Error in initial scheduling:', err));
}, 10000);

// Also run immediately for debugging
console.log('🔍 [Scheduler] Running immediate notification check...');
scheduleAllUpcomingEvents()
  .then(() => console.log('✅ [Scheduler] Immediate check completed'))
  .catch(err => console.error('❌ [Scheduler] Error in immediate check:', err));

module.exports = {
  scheduleEventNotificationsForUser,
  clearEventNotifications,
  clearEventNotificationsForUser,
  clearUserNotifications,
  scheduleAllUpcomingEvents,
};
