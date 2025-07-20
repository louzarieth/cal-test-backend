require('dotenv').config();
const { setupDatabase } = require('../db/setup');
const { getDb } = require('../db');
const CalendarSyncService = require('../services/calendar/syncService');

async function testSync() {
  try {
    console.log('🔍 Testing calendar sync...');
    
    // Ensure database is set up
    await setupDatabase();
    
    // Initialize sync service
    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!calendarId || !apiKey) {
      throw new Error('Missing required environment variables: GOOGLE_CALENDAR_ID and GOOGLE_API_KEY must be set');
    }
    
    const syncService = new CalendarSyncService(calendarId, apiKey);
    
    // Run the sync
    console.log('🔄 Starting sync...');
    const result = await syncService.startSync();
    
    if (result.success) {
      console.log('✅ Sync completed successfully');
      console.log(`📊 Added: ${result.stats.added}, Updated: ${result.stats.updated}`);
      
      // Get sync log details
      const syncLog = await syncService.getSyncLog(result.syncLogId);
      console.log('📝 Sync log:', {
        id: syncLog.id,
        status: syncLog.status,
        eventsAdded: syncLog.events_added,
        eventsUpdated: syncLog.events_updated,
        syncTime: syncLog.sync_time
      });
      
      // List recent syncs
      const recentSyncs = await syncService.getRecentSyncLogs(5);
      console.log('\n🕒 Recent syncs:');
      recentSyncs.forEach(log => {
        console.log(`- [${log.status}] ${log.sync_time} - Added: ${log.events_added}, Updated: ${log.events_updated}`);
      });
      
    } else {
      console.error('❌ Sync failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error during sync test:', error);
  } finally {
    // Close the database connection
    const db = await getDb().catch(() => null);
    if (db) {
      await db.close().catch(console.error);
    }
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testSync()
    .then(() => console.log('\n✨ Test completed!'))
    .catch(console.error);
}

module.exports = { testSync };
