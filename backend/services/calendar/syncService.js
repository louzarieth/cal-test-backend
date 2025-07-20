const { google } = require('googleapis');
const { getDb, runQuery, getRow, getRows } = require('../../db');
const { format, addDays, startOfDay } = require('date-fns');

class CalendarSyncService {
  constructor(calendarId, apiKey) {
    this.calendar = google.calendar({ version: 'v3', auth: apiKey });
    this.calendarId = calendarId;
  }

  /**
   * Start a new sync process
   * @returns {Promise<{success: boolean, syncLogId?: number, error?: string}>}
   */
  async startSync() {
    const db = await getDb();
    let syncLogId;
    
    try {
      // Start transaction
      await db.run('BEGIN TRANSACTION');

      // Create sync log
      const syncLog = await db.run(
        'INSERT INTO sync_logs (sync_time, status) VALUES (?, ?)',
        [new Date().toISOString(), 'in_progress']
      );
      syncLogId = syncLog.lastID;

      // Get events from Google Calendar
      const now = new Date();
      const tomorrow = addDays(startOfDay(now), 1);

      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: now.toISOString(),
        timeMax: tomorrow.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      let added = 0;
      let updated = 0;
      const eventIds = [];

      // Process each event
      for (const event of events) {
        if (!event.id) continue;
        
        eventIds.push(event.id);
        
        const existingEvent = await db.get(
          'SELECT * FROM events WHERE event_id = ?',
          [event.id]
        );

        if (existingEvent) {
          // Update existing event
          await db.run(
            `UPDATE events 
             SET title = ?, description = ?, start_time = ?, end_time = ?, 
                 updated_at = ?, is_deleted = 0
             WHERE event_id = ?`,
            [
              event.summary || 'No Title',
              event.description || '',
              event.start.dateTime || event.start.date,
              event.end.dateTime || event.end.date,
              new Date().toISOString(),
              event.id
            ]
          );
          updated++;
        } else {
          // Insert new event
          await db.run(
            `INSERT INTO events 
             (event_id, title, description, start_time, end_time)
             VALUES (?, ?, ?, ?, ?)`,
            [
              event.id,
              event.summary || 'No Title',
              event.description || '',
              event.start.dateTime || event.start.date,
              event.end.dateTime || event.end.date
            ]
          );
          added++;
        }
      }

      // Mark old events as deleted
      if (eventIds.length > 0) {
        await db.run(
          `UPDATE events 
           SET is_deleted = 1, updated_at = ?
           WHERE event_id NOT IN (${eventIds.map(() => '?').join(',')})`,
          [new Date().toISOString(), ...eventIds]
        );
      }

      // Update sync log
      await db.run(
        'UPDATE sync_logs SET status = ?, events_added = ?, events_updated = ? WHERE id = ?',
        ['completed', added, updated, syncLogId]
      );

      await db.run('COMMIT');
      
      return { 
        success: true, 
        syncLogId,
        stats: { added, updated }
      };
      
    } catch (error) {
      await db.run('ROLLBACK');
      console.error('❌ Sync failed:', error);
      
      if (syncLogId) {
        await db.run(
          'UPDATE sync_logs SET status = ?, error_message = ? WHERE id = ?',
          ['failed', error.message, syncLogId]
        );
      }
      
      return { 
        success: false, 
        error: error.message,
        syncLogId
      };
    }
  }

  /**
   * Get sync log by ID
   * @param {number} logId 
   * @returns {Promise<Object>}
   */
  async getSyncLog(logId) {
    return getRow('SELECT * FROM sync_logs WHERE id = ?', [logId]);
  }

  /**
   * Get recent sync logs
   * @param {number} limit 
   * @returns {Promise<Array>}
   */
  async getRecentSyncLogs(limit = 10) {
    return getRows(
      'SELECT * FROM sync_logs ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
  }
}

module.exports = CalendarSyncService;
