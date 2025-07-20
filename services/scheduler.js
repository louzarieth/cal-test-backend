const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');
const { getDb } = require('../db');
const { setupDatabase } = require('../db/setup');
const { TwitterService } = require('./twitterService');

class Scheduler {
  constructor() {
    this.scheduledJobs = new Map();
  }

  /**
   * Initialize the scheduler and set up the daily sync job
   */
  async init() {
    try {
      // Ensure database is set up
      await setupDatabase();
      
      // Initialize Twitter service and start reminder scheduler
      this.twitterService = new TwitterService();
      this.twitterService.startScheduler({ runOnStart: true });
      
      // Schedule daily sync at midnight
      this.scheduleDailySync();
      
      // Also run an initial sync
      await this.runSync();
      
      console.log('✅ Scheduler initialized with Twitter reminders and daily sync');
    } catch (error) {
      console.error('❌ Failed to initialize scheduler:', error);
      throw error;
    }
  }

  /**
   * Schedule the daily sync job
   */
  scheduleDailySync() {
    // Run at 00:00 every day
    const job = cron.schedule('0 0 * * *', async () => {
      console.log('🔄 Running scheduled sync job...');
      try {
        await this.runSync();
      } catch (error) {
        console.error('❌ Error in scheduled sync:', error);
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    this.scheduledJobs.set('dailySync', job);
    console.log('⏰ Daily sync scheduled to run at midnight UTC');
  }

  /**
   * Run the sync process
   */
  async runSync() {
    try {
      // This would be replaced with your actual sync logic
      // For now, we'll just log that the sync would run
      console.log('🔄 Running calendar sync...');
      
      // In a real implementation, you would call your sync service here
      // const syncService = new CalendarSyncService(calendarId, apiKey);
      // const result = await syncService.startSync();
      
      // For now, we'll just log a success message
      console.log('✅ Sync completed successfully');
      return { success: true };
      
    } catch (error) {
      console.error('❌ Sync failed:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    for (const [name, job] of this.scheduledJobs) {
      job.stop();
      console.log(`⏹️ Stopped job: ${name}`);
    }
    this.scheduledJobs.clear();
  }
}

// Create a singleton instance
const scheduler = new Scheduler();

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Stopping scheduler...');
  scheduler.stop();
  
  // Close database connection using the proper closeDb function
  try {
    const { closeDb } = require('../db');
    await closeDb();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error closing database:', error);
  }
  
  process.exit(0);
});

module.exports = scheduler;
