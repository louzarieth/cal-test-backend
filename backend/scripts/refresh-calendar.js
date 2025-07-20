const { getDb, runQuery, getRows } = require('../db');
const { addDays, startOfDay, endOfDay, format } = require('date-fns');
const https = require('https');

// Google Calendar API configuration
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
  if (!events || events.length === 0) {
    console.log('No events to save');
    return { success: true, eventsProcessed: 0 };
  }

  console.log('Getting database connection...');
  const db = await getDb();
  
  try {
    console.log('Starting database transaction...');
    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    let eventsProcessed = 0;
    
    for (const event of events) {
      try {
        console.log(`\n--- Processing event: ${event.summary || 'No Title'} (${event.id}) ---`);
        
        // Skip events without a valid start time
        if (!event.start || (!event.start.dateTime && !event.start.date)) {
          console.warn('Skipping event with invalid start time:', event.id);
          continue;
        }
        
        // Check if event already exists in the database
        console.log('Checking if event exists in database...');
        let existingEvent = null;
        try {
          existingEvent = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM events WHERE event_id = ?', [event.id], (err, row) => {
              if (err) {
                console.error('Error checking for existing event:', err);
                reject(err);
              } else {
                console.log('Existing event check complete');
                resolve(row || null);
              }
            });
          });
        } catch (err) {
          console.error('Error in existing event check:', err);
          throw err;
        }
        
        if (existingEvent) {
          console.log(`Event exists in database. Current updated_at: ${existingEvent.updated_at}, New updated_at: ${event.updated}`);
          
          if (existingEvent.updated_at === event.updated) {
            console.log(`Skipping unchanged event: ${event.summary || 'No Title'} (${event.id})`);
            continue;
          }
          
          console.log('Event has been updated, will be replaced.');
        } else {
          console.log('Event does not exist in database, will be inserted.');
        }
        
        const eventData = {
          event_id: event.id,
          title: event.summary || 'No Title',
          description: event.description || '',
          start_time: event.start.dateTime || `${event.start.date}T00:00:00.000Z`,
          end_time: event.end.dateTime || `${event.end.date}T23:59:59.999Z`,
          // Removed location field as it's not needed for online events
          html_link: event.htmlLink || '',
          created_at: event.created || new Date().toISOString(),
          updated_at: event.updated || new Date().toISOString(),
          is_deleted: 0,
          event_type: event.eventType || 'default'
        };
        
        console.log('Prepared event data:', JSON.stringify(eventData, null, 2));
        
        // Insert or update event
        console.log('Executing SQL query...');
        await new Promise((resolve, reject) => {
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO events (
              event_id, title, description, start_time, end_time, 
              html_link, created_at, updated_at, is_deleted, event_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          
          stmt.run(
            eventData.event_id,
            eventData.title,
            eventData.description,
            eventData.start_time,
            eventData.end_time,
            eventData.html_link,
            eventData.created_at,
            eventData.updated_at,
            eventData.is_deleted,
            eventData.event_type,
            function(err) {
              stmt.finalize();
              if (err) reject(err);
              else {
                console.log(`✅ Successfully saved event: ${eventData.title} (${eventData.event_id})`);
                eventsProcessed++;
                resolve();
              }
            }
          );
        });
        
      } catch (error) {
        console.error(`❌ Error processing event ${event.id}:`, error);
        // Continue with the next event even if one fails
        continue;
      }
    }
    
    console.log('Committing transaction...');
    await new Promise((resolve, reject) => {
      db.run('COMMIT', (err) => {
        if (err) reject(err);
        else {
          console.log(`✅ Successfully committed transaction. Processed ${eventsProcessed} of ${events.length} events`);
          resolve();
        }
      });
    });
    
    return { success: true, eventsProcessed };
    
  } catch (error) {
    console.error('❌ Error in database operation:', error);
    
    try {
      console.log('Attempting to rollback transaction...');
      await new Promise((resolve, reject) => {
        db.run('ROLLBACK', (err) => {
          if (err) {
            console.error('Error rolling back transaction:', err);
            reject(err);
          } else {
            console.log('✅ Successfully rolled back transaction');
            resolve();
          }
        });
      });
    } catch (rollbackError) {
      console.error('❌ Error during rollback:', rollbackError);
    }
    
    throw error;
    
  } finally {
    if (db) {
      console.log('Closing database connection...');
      await new Promise((resolve) => {
        db.close((err) => {
          if (err) console.error('Error closing database:', err);
          else console.log('✅ Database connection closed');
          resolve();
        });
      });
    }
  }
}

/**
 * Main function to refresh calendar data
 */
async function refreshCalendarData() {
  const now = new Date();
  
  console.log('Starting calendar data refresh...');
  console.log(`Current time: ${format(now, 'yyyy-MM-dd HH:mm:ss')}`);
  
  try {
    // Remove all past events
    console.log(`\n=== CLEANING UP PAST EVENTS ===`);
    const removedPast = await removePastEvents();
    
    // Fetch and save all future events
    console.log('\n=== FETCHING FUTURE EVENTS ===');
    const futureEvents = await fetchEventsFromGoogleCalendar();
    console.log(`Found ${futureEvents.length} future events`);
    
    if (futureEvents.length > 0) {
      console.log('First future event sample:', {
        id: futureEvents[0].id,
        summary: futureEvents[0].summary,
        start: futureEvents[0].start,
        end: futureEvents[0].end
      });
    }
    
    const saveResult = await saveEvents(futureEvents);
    
    console.log(`\nCalendar data refresh complete. Processed ${saveResult.eventsProcessed} future events.`);
    console.log(`Removed ${removedPast} past events from database.`);
    
    return { 
      success: true, 
      eventsProcessed: saveResult.eventsProcessed,
      removedPastEvents: removedPast
    };
  } catch (error) {
    console.error('Error refreshing calendar data:', error);
    return { 
      success: false, 
      error: error.message,
      stack: error.stack 
    };
  }
}

// Run the script if executed directly
if (require.main === module) {
  refreshCalendarData()
    .then(({ success, eventsProcessed, error }) => {
      if (success) {
        console.log(`✅ Successfully refreshed calendar data. Processed ${eventsProcessed} events.`);
        process.exit(0);
      } else {
        console.error('❌ Failed to refresh calendar data:', error);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Unhandled error in refresh-calendar:', error);
      process.exit(1);
    });
}

module.exports = {
  refreshCalendarData,
  fetchEventsFromGoogleCalendar,
  removePastEvents,
  saveEvents
};
