const cron = require('node-cron');
const { getDb, getRows, getRow } = require('../../db');
const { sendEventNotification } = require('./emailService');
const webpush = require('web-push');

// Track database readiness
let isDatabaseReady = false;
const dbReadyCallbacks = [];

/**
 * Wait for database to be ready
 * @returns {Promise<void>}
 */
function waitForDatabase() {
  return new Promise((resolve) => {
    if (isDatabaseReady) {
      resolve();
      return;
    }
    dbReadyCallbacks.push(resolve);
  });
}

/**
 * Mark database as ready
 */
function markDatabaseReady() {
  isDatabaseReady = true;
  while (dbReadyCallbacks.length) {
    const callback = dbReadyCallbacks.shift();
    callback();
  }
}

// Store active timeouts to prevent duplicate scheduling
const activeTimeouts = new Map();

// Send a browser push notification
const sendBrowserNotification = async (user, event, timeBefore) => {
  try {
    const db = await getDb();
    
    // Get the user's push subscription
    const util = require('util');
    const allAsync = util.promisify(db.all).bind(db);
    const subscriptions = await allAsync(
      'SELECT * FROM push_subscriptions WHERE user_id = ?',
      [user.id]
    );
    
    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No push subscriptions found for user ${user.id}`);
      return;
    }
    
    const payload = JSON.stringify({
      title: `Event Reminder: ${event.title}`,
      body: `${event.title} starts in ${timeBefore}`,
      icon: '/icon-192x192.png',
      data: {
        url: `/event/${event.id}`
      }
    });

    let sentCount = 0;
    for (const subscription of subscriptions) {
      console.log('DEBUG: Subscription row for user', user.id, subscription);
      if (!subscription.keys) {
        console.error(`Push subscription keys missing for user ${user.id}, skipping.`);
        continue;
      }
      let parsedKeys;
      try {
        parsedKeys = JSON.parse(subscription.keys);
      } catch (err) {
        console.error(`Invalid push subscription keys for user ${user.id}:`, subscription.keys);
        continue;
      }
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: parsedKeys
          },
          payload
        );
        sentCount++;
        console.log(`Sent browser notification to ${user.email} for event ${event.id}`);
      } catch (error) {
        console.error('Error sending browser notification:', error);
        // If the subscription is no longer valid, remove it
        if (error.statusCode === 410) {
          console.log('Removing expired push subscription');
          await db.run(
            'DELETE FROM push_subscriptions WHERE endpoint = ?',
            [subscription.endpoint]
          );
        }
      }
    }
    if (sentCount === 0) {
      console.log(`No valid push notifications sent for user ${user.id}`);
    }

  } catch (error) {
    console.error('Error sending browser notification:', error);
    
    // If the subscription is no longer valid, remove it
    if (error.statusCode === 410) {
      console.log('Removing expired push subscription');
      await db.run(
        'DELETE FROM push_subscriptions WHERE user_id = ?',
        [user.id]
      );
    }
  }
};

// Schedule notifications for an event for a specific user
const scheduleEventNotificationsForUser = async (event, user) => {
  try {
    console.log(`   👤 User: ${user.name} (${user.id})`);
    
    // Check if user has notifications enabled for this event type
    const db = await getDb();
    const eventType = event.event_type || 'default';
    
    // Get user's preferences for this event type
    const preferences = await db.get(
      `SELECT * FROM user_event_preferences 
       WHERE user_id = ? AND event_type = ?`,
      [user.id, eventType]
    );
    
    // If no specific preferences for this event type, use default preferences
    const useDefault = !preferences;
    const notificationPrefs = preferences || user;
    
    // Log the user and event details in the requested format
    console.log(`user: ${user.email}`);
    console.log(`event title: ${eventType}`);
    console.log(`event enabled: ${preferences ? (preferences.is_enabled ? 'Yes' : 'No') : 'No specific preferences'}`);
    console.log(`browser notification: ${notificationPrefs.notify_browser ? 'Enabled' : 'Disabled'}`);
    console.log(`10min browser reminder: ${notificationPrefs.browser_10m_before ? 'Enabled' : 'Disabled'}`);
    console.log(`1h browser reminder: ${notificationPrefs.browser_1h_before ? 'Enabled' : 'Disabled'}`);
    
    // Check if notifications are enabled for this user and event type
    const notificationsEnabled = notificationPrefs.notify_email || notificationPrefs.notify_browser;
    if (!notificationsEnabled) {
      console.log(`   ⚠️ Skipping - all notifications disabled for user`);
      return false;
    }
    
    // Check if we should notify for this event based on user preferences
    // If no specific preferences exist, assume enabled (use default)
    // If preferences exist, check is_enabled flag
    const shouldNotify = useDefault || (preferences && preferences.is_enabled);
    
    if (!shouldNotify) {
      console.log(`   ⚠️ Skipping - notifications disabled for event type: ${eventType}`);
      return false;
    }
    
    let scheduledAny = false;
    const scheduledTimes = [];
    
    // Schedule email notifications if enabled
    if (notificationPrefs.notify_email) {
      // 1 hour before notification
      if (notificationPrefs.notify_1h_before) {
        const scheduled = await scheduleNotification(event, user, '1h', 'email');
        if (scheduled) {
          scheduledAny = true;
          scheduledTimes.push('1h (email)');
        }
      }
      
      // 10 minutes before notification
      if (notificationPrefs.notify_10m_before) {
        const scheduled = await scheduleNotification(event, user, '10m', 'email');
        if (scheduled) {
          scheduledAny = true;
          scheduledTimes.push('10m (email)');
        }
      }
    }
    
    // Schedule browser notifications if enabled and user has a subscription
    if (notificationPrefs.notify_browser) {
      // Check if user has an active push subscription
      const subscription = await db.get(
        `SELECT * FROM push_subscriptions WHERE user_id = ?`,
        [user.id]
      );
      
      if (subscription) {
        // 1 hour before notification
        if (notificationPrefs.notify_1h_before) {
          const scheduled = await scheduleNotification(event, user, '1h', 'browser');
          if (scheduled) {
            scheduledAny = true;
            scheduledTimes.push('1h (browser)');
          }
        }
        
        // 10 minutes before notification
        if (notificationPrefs.notify_10m_before) {
          const scheduled = await scheduleNotification(event, user, '10m', 'browser');
          if (scheduled) {
            scheduledAny = true;
            scheduledTimes.push('10m (browser)');
          }
        }
      } else {
        console.log(`   ℹ️ Browser notifications enabled but no active push subscription`);
      }
    }
    
    if (scheduledAny) {
      console.log(`   ✅ Scheduled notifications: ${scheduledTimes.join(', ')}`);
    } else {
      console.log(`   ⚠️ No notifications scheduled (check preferences and event timing)`);
    }
    
    return scheduledAny;
  } catch (error) {
    console.error('Error in scheduleEventNotificationsForUser:', error);
    return false;
  }
};

// Schedule a single notification
const scheduleNotification = async (event, user, timeBefore, type) => {
  try {
    const eventTime = new Date(event.start_time);
    const now = new Date();
    
    // Calculate when to send the notification
    const minutes = timeBefore === '1h' ? 60 : 10;
    const notificationTime = new Date(eventTime.getTime() - minutes * 60 * 1000);
    
    // Don't schedule notifications in the past
    if (notificationTime < now) {
      console.log(`   ⏩ Skipping ${timeBefore} ${type} notification - would have been at ${notificationTime.toISOString()}`);
      return false;
    }
    
    // Check if this reminder was already sent
    const reminderType = `${type}_${timeBefore}`;
    const existingReminder = await getRow(
      'SELECT id FROM event_reminders WHERE event_id = ? AND user_id = ? AND reminder_type = ? AND sent_at IS NOT NULL',
      [event.id, user.id, reminderType]
    );
    
    if (existingReminder) {
      console.log(`   ℹ️ ${type.toUpperCase()} reminder already sent for event ${event.id} (${timeBefore} before)`);
      return false;
    }
    
    // Calculate delay in milliseconds
    const delay = notificationTime - now;
    
    // Create a timeout for the notification
    const timeout = setTimeout(async () => {
      try {
        if (type === 'email') {
          await sendEventNotification([user], event, timeBefore);
        } else if (type === 'browser') {
          await sendBrowserNotification(user, event, timeBefore);
        }
        
        // Mark the reminder as sent
        const db = await getDb();
        await db.run(
          'UPDATE event_reminders SET sent_at = CURRENT_TIMESTAMP WHERE event_id = ? AND user_id = ? AND reminder_type = ?',
          [event.id, user.id, reminderType]
        );
        
        console.log(`✅ Sent ${type} notification for event ${event.id} to ${user.email} (${timeBefore} before)`);
      } catch (error) {
        console.error(`Error sending ${type} notification:`, error);
      }
    }, delay);
    
    // Store the timeout so we can clear it later if needed
    const timeoutKey = `${event.id}-${user.id}-${type}-${timeBefore}`;
    activeTimeouts.set(timeoutKey, timeout);
    
    // Save the reminder in the database
    const db = await getDb();
    await db.run(
      `INSERT OR IGNORE INTO event_reminders 
       (event_id, user_id, reminder_type, reminder_minutes, scheduled_at) 
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [event.id, user.id, reminderType, minutes]
    );
    
    console.log(`   ⏰ Scheduled ${type} notification for ${event.title} at ${notificationTime.toISOString()}`);
    return true;
  } catch (error) {
    console.error('Error in scheduleNotification:', error);
    return false;
  }
};

// Schedule notifications for the next upcoming event
const scheduleNextEvent = async () => {
  try {
    // Wait for database to be ready
    await waitForDatabase();
    const currentTime = new Date();
    console.log('🔍 [Scheduler] Finding next event to schedule...');
    const db = await getDb();
    const now = new Date();
    
    // Clear any existing timeouts
    for (const [key, timeout] of activeTimeouts.entries()) {
      clearTimeout(timeout);
      activeTimeouts.delete(key);
    }
    
    // First, get all event types that have interested users
    let eventTypesWithInterest = [];
    try {
      console.log('ℹ️ [Scheduler] Fetching event types with interest...');
      
      // First, check if the table exists
      const tableCheck = await db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='user_event_preferences'"
      );
      
      if (!tableCheck) {
        console.error('❌ [Scheduler] user_event_preferences table does not exist!');
        return [];
      }
      
      // Now query the table with direct SQL execution for better error handling
      try {
        const query = `
          SELECT DISTINCT event_type 
          FROM user_event_preferences 
          WHERE is_enabled = 1
        `;
        
        console.log('ℹ️ [Scheduler] Executing query:', query);
        
        // Execute with callback to catch any SQL errors
        eventTypesWithInterest = await new Promise((resolve, reject) => {
          db.all(query, [], (err, rows) => {
            if (err) {
              console.error('❌ [Scheduler] SQL Error in event types query:', err);
              reject(err);
              return;
            }
            console.log(`ℹ️ [Scheduler] Query returned ${rows.length} rows`);
            resolve(rows);
          });
        });
        
        console.log(`ℹ️ [Scheduler] Query result:`, JSON.stringify({
          rowCount: eventTypesWithInterest ? eventTypesWithInterest.length : 0,
          sample: eventTypesWithInterest && eventTypesWithInterest.length > 0 
            ? eventTypesWithInterest[0] 
            : 'No results',
          allEventTypes: eventTypesWithInterest && eventTypesWithInterest.length > 0
            ? eventTypesWithInterest.map(et => et.event_type).slice(0, 10)
            : 'No event types',
          firstFewRows: eventTypesWithInterest && eventTypesWithInterest.length > 0
            ? eventTypesWithInterest.slice(0, 3)
            : []
        }, null, 2));
        
      } catch (error) {
        console.error('❌ [Scheduler] Error in event types query:', error);
        // Try a simpler query to see if we can get any data
        try {
          console.log('ℹ️ [Scheduler] Trying simple query: SELECT * FROM user_event_preferences LIMIT 3');
          const simpleResult = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM user_event_preferences LIMIT 3', [], (err, rows) => {
              if (err) {
                console.error('❌ [Scheduler] Simple query failed:', err);
                reject(err);
                return;
              }
              resolve(rows);
            });
          });
          console.log('ℹ️ [Scheduler] Simple query result:', JSON.stringify(simpleResult, null, 2));
        } catch (simpleError) {
          console.error('❌ [Scheduler] Simple query also failed:', simpleError);
        }
        
        throw error; // Re-throw to be caught by the outer try/catch
      }
      
      // Also log the first few event types with interest for debugging
      if (eventTypesWithInterest && eventTypesWithInterest.length > 0) {
        console.log('ℹ️ [Scheduler] First 5 event types with interest:', 
          eventTypesWithInterest.slice(0, 5).map(e => e.event_type));
      } else {
        console.log('ℹ️ [Scheduler] No event types with interest found');
      }
    } catch (error) {
      console.error('❌ [Scheduler] Error fetching event types with interest:', error);
      return [];
    }
    
    // Get the next upcoming event
    // Calculate the time 11 minutes from now
    const minEventTime = new Date(now.getTime() + 11 * 60 * 1000);
    const minEventIso = minEventTime.toISOString();
    let nextEvent = null;
    
    try {
      // First, check if the events table exists
      const tableCheck = await new Promise((resolve, reject) => {
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='events'", (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      if (!tableCheck) {
        console.error('❌ [Scheduler] events table does not exist!');
        return false;
      }
      
      // Get the next upcoming event at least 11 minutes from now
      const query = `
        SELECT e.* FROM events e 
        WHERE e.start_time > ? AND e.is_deleted = 0
        ORDER BY e.start_time ASC
        LIMIT 1
      `;
      
      console.log(`ℹ️ [Scheduler] Finding next event after (min 11min): ${minEventIso}`);
      
      nextEvent = await new Promise((resolve, reject) => {
        db.get(query, [minEventIso], (err, row) => {
          if (err) {
            console.error('❌ [Scheduler] SQL Error in next event query:', err);
            reject(err);
            return;
          }
          resolve(row);
        });
      });
      
      if (!nextEvent) {
        console.log('ℹ️ [Scheduler] No upcoming events found');
        return false;
      }
      
      console.log(`ℹ️ [Scheduler] Found next event: ${nextEvent.title} at ${nextEvent.start_time}`);
      
      // Step 1: Get all users who have enabled this event type (using event title as event_type)
      const eventType = nextEvent.title || 'default';
      console.log(`\n🔍 [Scheduler] Step 1: Finding users who enabled event: "${eventType}"`);
      
      // First get all users who have this event (title) enabled
      const usersWithEventType = await new Promise((resolve, reject) => {
        const query = `
          SELECT DISTINCT up.*, uep.is_enabled
          FROM user_preferences up
          LEFT JOIN user_event_preferences uep ON up.id = uep.user_id AND uep.event_type = ?
          WHERE uep.is_enabled = 1 
        `;
        db.all(query, [eventType], (err, rows) => {
          if (err) {
            console.error('❌ [Scheduler] Error fetching users with event type:', err);
            reject(err);
            return;
          }
          resolve(rows || []);
        });
      });
      
      console.log(`✅ [Scheduler] Found ${usersWithEventType.length} users who enabled event type '${eventType}'`);
      if (usersWithEventType.length > 0) {
        usersWithEventType.forEach(u => {
          console.log(`   - ${u.email} | is_enabled=${u.is_enabled !== undefined && u.is_enabled !== null ? u.is_enabled : 'null'}`);
        });
      }
      
      // Step 2 (EMAIL): Filter users who have email notifications enabled
      const usersWithEmailEnabled = usersWithEventType.filter(user => user.notify_email === 1);
      console.log(`\n🔍 [Scheduler] Step 2 (EMAIL): Filtering for users with email notifications enabled`);
      console.log(`✅ [Scheduler] ${usersWithEmailEnabled.length} of ${usersWithEventType.length} users have email notifications enabled`);
      if (usersWithEmailEnabled.length > 0) {
        console.log('   - ' + usersWithEmailEnabled.map(u => u.email).join('\n   - '));
      }

      // Step 3 (EMAIL): Split users into reminder groups
      const emailUsers1hReminder = usersWithEmailEnabled.filter(u => u.email_1h_before === 1);
      const emailUsers10mReminder = usersWithEmailEnabled.filter(u => u.email_10m_before === 1);
      const emailUsersWithNoReminders = usersWithEmailEnabled.filter(u => !u.email_1h_before && !u.email_10m_before);

      console.log(`\n📊 [Scheduler] EMAIL Notification Groups:`);
      console.log(`   1️⃣ ${emailUsers1hReminder.length} users for 1h email reminder`);
      console.log(`   ⏰ ${emailUsers10mReminder.length} users for 10m email reminder`);
      if (emailUsersWithNoReminders.length > 0) {
        console.log(`   ❌ ${emailUsersWithNoReminders.length} users with no email reminders enabled`);
        console.log('   - ' + emailUsersWithNoReminders.map(u => u.email).join('\n   - '));
      }

      // --- EMAIL notification scheduling moved below after time calculations ---
      
      // Step 2: Filter users who have browser notifications enabled
      const usersWithBrowserEnabled = usersWithEventType.filter(user => user.notify_browser === 1);
      console.log(`\n🔍 [Scheduler] Step 2: Filtering for users with browser notifications enabled`);
      console.log(`✅ [Scheduler] ${usersWithBrowserEnabled.length} of ${usersWithEventType.length} users have browser notifications enabled`);
      if (usersWithBrowserEnabled.length > 0) {
        console.log('   - ' + usersWithBrowserEnabled.map(u => u.email).join('\n   - '));
      }
      
      // Step 3: Filter users with valid push subscriptions and reminder preferences
      const usersWithPushSubs = await Promise.all(
        usersWithBrowserEnabled.map(async (user) => {
          const pushSub = await new Promise((resolve) => {
            db.get(
              'SELECT * FROM push_subscriptions WHERE user_id = ?',
              [user.id],
              (err, row) => resolve(row || null)
            );
          });
          
          return {
            ...user,
            pushSub,
            hasValidPushSub: pushSub && pushSub.keys && pushSub.endpoint,
            reminder1h: user.browser_1h_before === 1,
            reminder10m: user.browser_10m_before === 1
          };
        })
      );
      
      // Filter out users without valid push subscriptions
      const validUsers = usersWithPushSubs.filter(u => u.hasValidPushSub);
      const usersWithoutPushSubs = usersWithPushSubs.filter(u => !u.hasValidPushSub);
      
      console.log(`\n🔍 [Scheduler] Step 3: Checking push subscriptions`);
      console.log(`✅ [Scheduler] ${validUsers.length} users have valid push subscriptions`);
      if (usersWithoutPushSubs.length > 0) {
        console.log(`   ❌ ${usersWithoutPushSubs.length} users have no valid push subscription:`);
        console.log('   - ' + usersWithoutPushSubs.map(u => u.email).join('\n   - '));
      }
      
      // Step 4: Split users into reminder groups
      const users1hReminder = validUsers.filter(u => u.reminder1h);
      const users10mReminder = validUsers.filter(u => u.reminder10m);
      const usersWithNoReminders = validUsers.filter(u => !u.reminder1h && !u.reminder10m);
      
      console.log(`\n📊 [Scheduler] Final Notification Groups:`);
      console.log(`   1️⃣ ${users1hReminder.length} users for 1h reminder`);
      console.log(`   ⏰ ${users10mReminder.length} users for 10m reminder`);
      if (usersWithNoReminders.length > 0) {
        console.log(`   ❌ ${usersWithNoReminders.length} users with no reminders enabled`);
        console.log('   - ' + usersWithNoReminders.map(u => u.email).join('\n   - '));
      }
      
      // Prepare the final users list in the expected format
      const users = validUsers.map(user => ({
        ...user,
        keys: user.pushSub?.keys,
        endpoint: user.pushSub?.endpoint,
        reason: 'Eligible for notifications'
      }));
      
      // Use the pre-filtered groups
      const oneHourUsers = users1hReminder;
      const tenMinUsers = users10mReminder;
      const bothUsers = oneHourUsers.filter(u1 => 
        tenMinUsers.some(u2 => u1.id === u2.id)
      ).length;
      
      console.log('\n👥 FINAL NOTIFICATION SUMMARY:');
      console.log('   ┌───────────────────────────────────────────────');
      console.log(`   │ Total eligible users: ${validUsers.length}`);
      console.log(`   │ 1h before:  ${oneHourUsers.length} users`);
      console.log(`   │ 10m before: ${tenMinUsers.length} users`);
      console.log(`   │ Both:       ${bothUsers} users`);
      console.log('   └───────────────────────────────────────────────\n');
      
      // Schedule notifications for 1h before
      const eventTime = new Date(nextEvent.start_time);
      const oneHourBefore = new Date(eventTime.getTime() - 60 * 60 * 1000);
      const tenMinutesBefore = new Date(eventTime.getTime() - 10 * 60 * 1000);

      // --- EMAIL notification scheduling (moved here, after time calculations) ---
      if (emailUsers1hReminder.length > 0 && oneHourBefore > currentTime) {
        const delay = oneHourBefore - currentTime;
        const scheduleTime = new Date(currentTime.getTime() + delay);
        console.log('⏰ SCHEDULING 1H EMAIL NOTIFICATIONS:');
        console.log('   ┌───────────────────────────────────────────────');
        console.log(`   │ When:    ${scheduleTime.toLocaleString()} (in ${Math.round(delay/60000)} minutes)`);
        console.log(`   │ Users:   ${emailUsers1hReminder.length}`);
        console.log(`   │ Event:   ${nextEvent.title.substring(0, 20)}...`);
        console.log('   └───────────────────────────────────────────────\n');
        const timeout = setTimeout(async () => {
          console.log('🔔 SENDING 1H EMAIL NOTIFICATIONS:');
          console.log('   ┌───────────────────────────────────────────────');
          console.log(`   │ Event: ${nextEvent.title}`);
          console.log(`   │ Time:  ${new Date().toLocaleString()}`);
          console.log(`   │ Users: ${emailUsers1hReminder.length}`);
          try {
            await sendEventNotification(emailUsers1hReminder, nextEvent, '1 hour', {
              to: 'noreply@monad.calendar',
              bcc: emailUsers1hReminder.map(u => u.email)
            });
            console.log(`   │ Successfully sent to: ${emailUsers1hReminder.length} users`);
          } catch (err) {
            console.error(`   ❌ Failed to send 1h email notifications:`, err.message);
          }
          console.log('   └───────────────────────────────────────────────\n');
        }, delay);
        activeTimeouts.set(`event-${nextEvent.id}-1h-email`, timeout);
      }

      if (emailUsers10mReminder.length > 0 && tenMinutesBefore > currentTime) {
        const delay = tenMinutesBefore - currentTime;
        const scheduleTime = new Date(currentTime.getTime() + delay);
        console.log('⏰ SCHEDULING 10M EMAIL NOTIFICATIONS:');
        console.log('   ┌───────────────────────────────────────────────');
        console.log(`   │ When:    ${scheduleTime.toLocaleString()} (in ${Math.round(delay/60000)} minutes)`);
        console.log(`   │ Users:   ${emailUsers10mReminder.length}`);
        console.log(`   │ Event:   ${nextEvent.title.substring(0, 20)}...`);
        console.log('   └───────────────────────────────────────────────\n');
        const timeout = setTimeout(async () => {
          console.log('🔔 SENDING 10M EMAIL NOTIFICATIONS:');
          console.log('   ┌───────────────────────────────────────────────');
          console.log(`   │ Event: ${nextEvent.title}`);
          console.log(`   │ Time:  ${new Date().toLocaleString()}`);
          console.log(`   │ Users: ${emailUsers10mReminder.length}`);
          try {
            await sendEventNotification(emailUsers10mReminder, nextEvent, '10 minutes', {
              to: 'noreply@monad.calendar',
              bcc: emailUsers10mReminder.map(u => u.email)
            });
            console.log(`   │ Successfully sent to: ${emailUsers10mReminder.length} users`);
          } catch (err) {
            console.error(`   ❌ Failed to send 10m email notifications:`, err.message);
          }
          console.log('   └───────────────────────────────────────────────\n');
        }, delay);
        activeTimeouts.set(`event-${nextEvent.id}-10m-email`, timeout);
      }

      // --- END EMAIL notification scheduling ---

      if (oneHourUsers.length > 0 && oneHourBefore > currentTime) {
        const delay = oneHourBefore - currentTime;
        const scheduleTime = new Date(currentTime.getTime() + delay);
        
        console.log('⏰ SCHEDULING 1H NOTIFICATIONS:');
        console.log('   ┌───────────────────────────────────────────────');
        console.log(`   │ When:    ${scheduleTime.toLocaleString()} (in ${Math.round(delay/60000)} minutes)`);
        console.log(`   │ Users:   ${oneHourUsers.length}`);
        console.log(`   │ Event:   ${nextEvent.title.substring(0, 20)}...`);
        console.log('   └───────────────────────────────────────────────\n');
        
        const timeout = setTimeout(async () => {
          console.log('🔔 SENDING 1H NOTIFICATIONS:');
          console.log('   ┌───────────────────────────────────────────────');
          console.log(`   │ Event: ${nextEvent.title}`);
          console.log(`   │ Time:  ${new Date().toLocaleString()}`);
          console.log(`   │ Users: ${oneHourUsers.length}`);
          
          let successCount = 0;
          for (const user of oneHourUsers) {
            try {
              await sendBrowserNotification(user, nextEvent, '1 hour');
              successCount++;
            } catch (err) {
              console.error(`   ❌ Failed to notify user ${user.id}:`, err.message);
            }
          }
          
          console.log(`   │ Successfully sent to: ${successCount}/${oneHourUsers.length} users`);
          console.log('   └───────────────────────────────────────────────\n');
        }, delay);
        
        activeTimeouts.set(`event-${nextEvent.id}-1h`, timeout);
      }
      
      if (tenMinUsers.length > 0 && tenMinutesBefore > currentTime) {
        const delay = tenMinutesBefore - currentTime;
        const scheduleTime = new Date(currentTime.getTime() + delay);
        
        console.log('⏰ SCHEDULING 10M NOTIFICATIONS:');
        console.log('   ┌───────────────────────────────────────────────');
        console.log(`   │ When:    ${scheduleTime.toLocaleString()} (in ${Math.round(delay/60000)} minutes)`);
        console.log(`   │ Users:   ${tenMinUsers.length}`);
        console.log(`   │ Event:   ${nextEvent.title.substring(0, 20)}...`);
        console.log('   └───────────────────────────────────────────────\n');
        
        const timeout = setTimeout(async () => {
          console.log('🔔 SENDING 10M NOTIFICATIONS:');
          console.log('   ┌───────────────────────────────────────────────');
          console.log(`   │ Event: ${nextEvent.title}`);
          console.log(`   │ Time:  ${new Date().toLocaleString()}`);
          console.log(`   │ Users: ${tenMinUsers.length}`);
          
          let successCount = 0;
          for (const user of tenMinUsers) {
            try {
              await sendBrowserNotification(user, nextEvent, '10 minutes');
              successCount++;
            } catch (err) {
              console.error(`   ❌ Failed to notify user ${user.id}:`, err.message);
            }
          }
          
          console.log(`   │ Successfully sent to: ${successCount}/${tenMinUsers.length} users`);
          console.log('   └───────────────────────────────────────────────\n');
          
          // After sending 10m notifications, schedule the next event
          console.log('🔄 Looking for next event...');
          setTimeout(scheduleNextEvent, 1000);
        }, delay);
        
        activeTimeouts.set(`event-${nextEvent.id}-10m`, timeout);
      } else {
        // If no 10m notifications to send, schedule the next event after a short delay
        setTimeout(scheduleNextEvent, 1000);
      }
      
      return true;
    } catch (error) {
      console.error('❌ [Scheduler] Error finding next event:', error);
      return false;
    }
  } catch (error) {
    console.error('❌ [Scheduler] Error in scheduleNextEvent:', error);
    return false;
  }
};

// Clear all scheduled notifications for an event and user
const clearEventNotificationsForUser = (eventId, userId) => {
  // Clear any existing timeouts for this event and user
  for (const [key, timeout] of activeTimeouts.entries()) {
    if (key.startsWith(`${eventId}-${userId}-`)) {
      clearTimeout(timeout);
      activeTimeouts.delete(key);
    }
  }
};

// Clear all scheduled notifications for an event
const clearEventNotifications = (eventId) => {
  // Clear any existing timeouts for this event
  for (const [key, timeout] of activeTimeouts.entries()) {
    if (key.startsWith(`${eventId}-`)) {
      clearTimeout(timeout);
      activeTimeouts.delete(key);
    }
  }
};

// Clear all scheduled notifications for a user
const clearUserNotifications = (userId) => {
  // Clear any existing timeouts for this user
  for (const [key, timeout] of activeTimeouts.entries()) {
    if (key.startsWith(`user-${userId}-`)) {
      clearTimeout(timeout);
      activeTimeouts.delete(key);
    }
  }
  
  // Clear any database records for this user
  const db = getDb();
  db.run('DELETE FROM push_subscriptions WHERE user_id = ?', [userId], (err) => {
    if (err) {
      console.error(`❌ [Scheduler] Error clearing push subscriptions for user ${userId}:`, err);
    } else {
      console.log(`✅ [Scheduler] Cleared all push subscriptions for user ${userId}`);
    }
  });
};

// Run the scheduler every 15 minutes to catch any missed events
cron.schedule('*/11 * * * *', () => {
  const now = new Date();
  console.log('\n' + '='.repeat(60));
  console.log(`🔔 PERIODIC CHECK - ${now.toLocaleString()}`);
  console.log('='.repeat(60));
  
  scheduleNextEvent()
    .then(success => {
      if (success) {
        console.log('✅ Scheduled next event notifications');
      } else {
        console.log('ℹ️ No upcoming events found, will check again later');
      }
      console.log('='.repeat(60) + '\n');
      return null;
    })
    .catch(err => {
      console.error('❌ Error in scheduled check:', err);
      console.log('='.repeat(60) + '\n');
      return null;
    });
});

// Clean up on process exit
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping scheduler...');
  // Clear all timeouts on exit
  for (const timeout of activeTimeouts.values()) {
    clearTimeout(timeout);
  }
  activeTimeouts.clear();
  process.exit(0);
});

// Initialize the notification scheduler
const initScheduler = () => {
  try {
    // Set VAPID details for web push
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(
        'mailto:' + (process.env.VAPID_EMAIL || 'monad@flypass.io'),
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
      
      console.log('🔑 VAPID keys configured successfully');
      console.log('   - Email:', process.env.VAPID_EMAIL || 'monad@flypass.io');
      console.log('   - Public Key:', process.env.VAPID_PUBLIC_KEY.substring(0, 12) + '...');
      console.log('   - Private Key: *** (hidden) ***');
    } else {
      console.warn('⚠️  VAPID keys not configured. Browser notifications will not work.');
    }

    console.log('🚀 Starting notification scheduler...');
    
    // Mark database as ready when the first query succeeds
    const checkDbReady = async () => {
      try {
        const db = await getDb();
        
        // Use the promisified version of db.get
        const util = require('util');
        const getAsync = util.promisify(db.get).bind(db);
        
        try {
          await getAsync("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
          
          console.log('✅ Database is ready for scheduler');
          markDatabaseReady();
          
          // Initial check for events to schedule
          console.log('🔍 [Scheduler] Finding next event to schedule...');
          await scheduleNextEvent();
          
          // Also run an immediate check in case we're starting up and need to catch up
          console.log('🔍 [Scheduler] Running immediate notification check...');
          try {
            const success = await scheduleNextEvent();
            if (success) {
              console.log('✅ Immediate check completed');
            } else {
              console.log('ℹ️ No events to schedule immediately');
            }
          } catch (err) {
            console.error('❌ [Scheduler] Error in immediate check:', err);
          }
        } catch (err) {
          console.log('⏳ Database not ready yet, retrying...', err.message);
          setTimeout(checkDbReady, 1000);
        }
      } catch (error) {
        console.error('❌ Error getting database connection:', error);
        // Retry after a delay
        setTimeout(checkDbReady, 1000);
      }
    };
    
    // Start checking if database is ready
    checkDbReady();
    
  } catch (error) {
    console.error('❌ Error initializing notification scheduler:', error);
  }
};

// Export the initialization function and other utilities
module.exports = {
  initScheduler,
  scheduleEventNotificationsForUser,
  clearEventNotifications,
  clearEventNotificationsForUser,
  clearUserNotifications,
  activeTimeouts,
  clearTimeouts: () => {
    for (const timeout of activeTimeouts.values()) {
      clearTimeout(timeout);
    }
    activeTimeouts.clear();
  }
};
