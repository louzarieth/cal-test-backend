const { getDb, runQuery, getRows } = require('../db');
const { addDays, startOfDay, endOfDay, format, isAfter, parseISO } = require('date-fns');
const https = require('node:https');

const GOOGLE_API_KEY = 'AIzaSyCEpcJdO5FPDoNT49qaaqVXq9INsphQSQE';
const CALENDAR_ID = 'df80381b3317c2ce323ec7376a93dd57fbaa8e733452e576b56ace1656198c31@group.calendar.google.com';

// Helper function to make HTTPS requests
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Request failed with status code ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Fetches all future events from Google Calendar
 * @returns {Promise<Array>} Array of future events
 */
async function fetchEventsFromGoogleCalendar() {
  try {
    // Get current time and calculate 1 year in the future
    const now = new Date();
    const oneYearLater = new Date(now);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    
    // Convert to ISO strings in UTC
    const timeMin = now.toISOString();
    const timeMax = oneYearLater.toISOString();

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?` +
      `key=${GOOGLE_API_KEY}&` +
      `timeMin=${timeMin}&` +
      `timeMax=${timeMax}&` +
      `singleEvents=true&` +
      `orderBy=startTime&` +
      `maxResults=2500`;

    console.log(`Fetching future events from ${timeMin} to ${timeMax}`);
    const data = await httpsGet(url);
    
    if (!data.items) {
      console.log('No future events found in the response');
      return [];
    }

    console.log(`Found ${data.items.length} future events from Google Calendar`);
    return data.items;
  } catch (error) {
    console.error('Error fetching events from Google Calendar:', error);
    throw error;
  }
}

/**
 * Removes all past events from the database
 */
async function removePastEvents() {
  try {
    const now = new Date();
    const nowStr = format(now, 'yyyy-MM-dd');
    console.log(`Removing all past events (before ${nowStr}) from database`);
    
    // First, delete related reminders for past events
    await runQuery(
      `DELETE FROM event_reminders 
       WHERE event_id IN (SELECT id FROM events WHERE datetime(start_time) < ?)`,
      [now.toISOString()]
    );
    
    // Then delete the past events
    const result = await runQuery(
      'DELETE FROM events WHERE datetime(start_time) < ?',
      [now.toISOString()]
    );
    
    console.log(`Removed ${result.changes} past events and their reminders`);
    return result.changes;
  } catch (error) {
    console.error('Error removing past events:', error);
    throw error;
  }
}

/**
 * Saves events to the database
 * @param {Array} events - Array of events to save
 */
async function saveEvents(events) {
  if (events.length === 0) {
    console.log('No events to save');
    return 0;
  }
  
  try {
    const now = new Date().toISOString();
    let savedCount = 0;
    
    for (const event of events) {
      try {
        // First, check if this is a new event (by checking if the event_id exists)
        const existingEvent = await getRows('SELECT 1 FROM events WHERE event_id = ?', [event.id]);
        
        await runQuery(
          `INSERT INTO events (
            event_id, title, description, start_time, end_time, event_type, created_at, updated_at, html_link
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(event_id) DO UPDATE SET
            title = excluded.title,
            description = excluded.description,
            start_time = excluded.start_time,
            end_time = excluded.end_time,
            event_type = excluded.event_type,
            updated_at = excluded.updated_at,
            html_link = excluded.html_link,
            is_deleted = 0`,
          [
            event.id,
            event.summary || 'Untitled Event',
            event.description || '',
            event.start.dateTime || event.start.date,
            event.end.dateTime || event.end.date,
            event.eventType || 'default',
            now,
            now,
            event.htmlLink || ''
          ]
        );
        
        // If this is a new event, check if we need to auto-enable its type for users
        if (!existingEvent || existingEvent.length === 0) {
          const eventType = event.eventType || 'default';
          console.log(`🔔 New event type detected: ${eventType}, checking for users with notify_new_events enabled`);
          
          try {
            // Find all users who want to be notified about new events
            const usersToEnable = await getRows(
              `SELECT id FROM user_preferences WHERE notify_new_events = 1`
            );
            
            if (usersToEnable && usersToEnable.length > 0) {
              console.log(`✅ Found ${usersToEnable.length} users to enable for new event type: ${eventType}`);
              
              // Enable this event type for each user
              for (const user of usersToEnable) {
                try {
                  await runQuery(
                    `INSERT OR REPLACE INTO user_event_preferences 
                     (user_id, event_type, is_enabled) 
                     VALUES (?, ?, 1)`,
                    [user.id, eventType]
                  );
                } catch (err) {
                  console.error(`❌ Error enabling event type ${eventType} for user ${user.id}:`, err);
                }
              }
              
              console.log(`✅ Successfully enabled ${eventType} for ${usersToEnable.length} users`);
            } else {
              console.log('ℹ️ No users with notify_new_events enabled found');
            }
          } catch (err) {
            console.error('❌ Error processing new event type auto-enable:', err);
          }
        }
        
        savedCount++;
      } catch (error) {
        console.error(`Error saving event ${event.id}:`, error);
      }
    }
    
    console.log(`Successfully saved ${savedCount} events`);
    return savedCount;
  } catch (error) {
    console.error('Error saving events:', error);
    throw error;
  }
}

/**
 * Refreshes calendar data for a specific date
 * @param {Date} date - The date to refresh data for
 */
async function refreshCalendarForDate(date) {
  try {
    console.log(`Refreshing calendar data for: ${format(date, 'yyyy-MM-dd')}`);
    
    // Remove old events for this date (if any)
    await removeOldEvents(date);
    
    // Fetch and save new events
    const events = await fetchEventsFromGoogleCalendar(date);
    const savedCount = await saveEvents(events);
    
    console.log(`Refreshed ${savedCount} events for ${format(date, 'yyyy-MM-dd')}`);
    return { success: true, eventsProcessed: savedCount };
  } catch (error) {
    console.error('Error refreshing calendar data:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Refreshes calendar data for today and schedules the next refresh for midnight
 */
async function refreshAndScheduleNext() {
  try {
    // Get current time
    const now = new Date();
    
    // Remove all past events
    await removePastEvents();
    
    // Fetch and save all future events
    const events = await fetchEventsFromGoogleCalendar();
    await saveEvents(events);
    
    // Schedule next refresh for midnight
    const tomorrow = addDays(now, 1);
    const midnight = new Date(tomorrow);
    midnight.setHours(0, 0, 0, 0);
    
    const millisecondsUntilMidnight = midnight - now;
    
    console.log(`Scheduling next refresh for midnight (${millisecondsUntilMidnight}ms from now)`);
    setTimeout(() => refreshAndScheduleNext(), millisecondsUntilMidnight);
    
    return true;
  } catch (error) {
    console.error('Error refreshing calendar data:', error);
    return false;
  }
}

module.exports = {
  refreshAndScheduleNext,
  fetchEventsFromGoogleCalendar,
  removePastEvents,
  saveEvents
};
