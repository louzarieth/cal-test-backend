const cron = require('node-cron');
const { refreshAndScheduleNext } = require('../utils/calendarUtils');
const { TwitterService } = require('../services/twitterService');
const { getDb } = require('../db');
const { setupDatabase } = require('../db/setup');

// Create an instance of TwitterService
const twitterService = new TwitterService();

// Timezone to use for scheduling (use your local timezone)
const TIMEZONE = 'Europe/London';

/**
 * Initialize and start all scheduled tasks
 */
async function startScheduledTasks() {
  console.log('🚀 Starting scheduled tasks...');
  
  try {
    // Ensure database connection is established
    await getDb();
    
    // Start calendar refresh and schedule next refresh
    console.log('🔄 Starting calendar refresh...');
    await refreshAndScheduleNext();
    
    // TwitterService initializes itself in the constructor
    if (twitterService.client) {
      console.log('✅ Twitter reminder scheduler started');
    } else {
      console.warn('⚠️ Twitter client not initialized - check your Twitter API credentials');
    }
    
    console.log('✅ All scheduled tasks started');
    
    // Return a function to stop all scheduled tasks
    return async () => {
      console.log('🛑 Stopping all scheduled tasks...');
      twitterScheduler.stop();
      // We don't need to stop the cron job as it's a persistent process
    };
    
  } catch (error) {
    console.error('❌ Failed to start scheduled tasks:', error);
    process.exit(1);
  }
}

// If this file is run directly, start the scheduler
if (require.main === module) {
  startScheduledTasks()
    .then(() => {
      console.log('Scheduler is running. Press Ctrl+C to exit.');
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\nShutting down gracefully...');
        process.exit(0);
      });
      
      process.on('SIGTERM', async () => {
        console.log('\nReceived SIGTERM. Shutting down...');
        process.exit(0);
      });
    })
    .catch(error => {
      console.error('Failed to start scheduler:', error);
      process.exit(1);
    });
}

module.exports = {
  startScheduledTasks
};
