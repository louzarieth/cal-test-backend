require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { setupDatabase } = require('./db/setup');
const scheduler = require('./services/scheduler');
const twitterService = require('./services/twitterService');
const { refreshAndScheduleNext } = require('./utils/calendarUtils');
const apiRoutes = require('./routes/api');
const notificationRoutes = require('./routes/notifications');
const { getDb } = require('./db');

const PORT = process.env.PORT || 3001;

// Import notification scheduler
const { initScheduler } = require('./services/notification/debugScheduler');

const app = express();

// Track database initialization status
let isDatabaseReady = false;

/**
 * Check if database is ready by verifying required tables exist
 */
async function checkDatabaseReady() {
  if (isDatabaseReady) return true;
  
  try {
    const db = await getDb();
    // Check if required tables exist
    const tables = await new Promise((resolve, reject) => {
      db.all(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'events', 'user_preferences', 'user_event_preferences')",
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
    
    if (tables.length >= 4) {
      isDatabaseReady = true;
      console.log('✅ Database is ready');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error checking database status:', error);
    return false;
  }
}

/**
 * Initialize services in the correct order
 */
async function initializeServices() {
  try {
    console.log('🔄 Initializing database...');
    await setupDatabase();
    
    // Wait for database to be ready
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!(await checkDatabaseReady()) && attempts < maxAttempts) {
      console.log('⏳ Waiting for database to be ready...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    if (!isDatabaseReady) {
      throw new Error('Database initialization timed out');
    }
    
    // Now that database is ready, initialize the scheduler
    console.log('🚀 Initializing notification scheduler...');
    initScheduler();
    
    // Twitter service is already initialized via its constructor when imported
    // The twitterService export is already an instance of TwitterService
    if (process.env.TWITTER_API_KEY && process.env.TWITTER_API_SECRET) {
      // The scheduler is started automatically by the TwitterService constructor
      // We don't need to do anything else here
      console.log('🐦 Twitter service initialization in progress...');
    } else {
      console.warn('⚠️  Twitter API keys not configured. Twitter reminders will not work.');
    }
    
    // Start calendar refresh and scheduling
    console.log('🔄 Starting calendar refresh and scheduling...');
    await refreshAndScheduleNext();
    
    // Start the server
    await startServer();
    
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    process.exit(1);
  }
}

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static('public'));

// API Routes
app.use('/api', apiRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  
  // Handle SPA routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' 
      ? err.message 
      : 'Internal server error'
  });
});

// Start server
async function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
      resolve(server);
    });
  });
}


// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  // Close server & exit process
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Close server & exit process
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  // Close server & exit process
  process.exit(0);
});

// Start the application
initializeServices().catch(error => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});
