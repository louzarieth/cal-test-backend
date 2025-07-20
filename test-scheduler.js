require('dotenv').config();
const { initScheduler } = require('./services/notification/debugScheduler');

console.log('🚀 Starting scheduler in test mode...');

// Initialize the scheduler
initScheduler();

// Keep the process running
setInterval(() => {}, 1 << 30);
