const { startScheduler } = require('../services/notification/scheduler');

console.log('🚀 Starting notification scheduler...');

// Start the scheduler
startScheduler()
  .then(() => {
    console.log('✅ Notification scheduler is running');    
    console.log('\nPress Ctrl+C to stop the scheduler');
  })
  .catch(error => {
    console.error('❌ Failed to start notification scheduler:', error);
    process.exit(1);
  });

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping notification scheduler...');
  process.exit(0);
});
