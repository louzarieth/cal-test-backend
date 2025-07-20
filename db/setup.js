const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { format } = require('date-fns');

const dbPath = path.join(__dirname, 'calendar.db');

function setupDatabase() {
  console.log('Setting up database...');
  
  // Open the database connection
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database', err);
      return;
    }
    console.log('Connected to the SQLite database.');
  });

  // Wrap database operations in a promise
  return new Promise((resolve, reject) => {
    // Enable foreign keys
    db.serialize(() => {
      // Enable foreign keys
      db.run('PRAGMA foreign_keys = ON');

      // Create users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT,
          is_active INTEGER DEFAULT 1
        )`, (err) => {
          if (err) {
            console.error('Error creating users table', err);
            return reject(err);
          }
          console.log('Users table created or already exists');
          
          // Create events table
          db.run(`
            CREATE TABLE IF NOT EXISTS events (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              description TEXT,
              start TEXT NOT NULL,
              end TEXT NOT NULL,
              event_type TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT,
              is_deleted INTEGER DEFAULT 0
            )`, (err) => {
              if (err) {
                console.error('Error creating events table', err);
                return reject(err);
              }
              console.log('Events table created or already exists');
              
              // Create user_preferences table
              db.run(`
                CREATE TABLE IF NOT EXISTS user_preferences (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  user_id TEXT NOT NULL,
                  notify_email BOOLEAN DEFAULT 1,
                  notify_browser BOOLEAN DEFAULT 1,
                  notify_all_events BOOLEAN DEFAULT 1,
                  notify_1h_before BOOLEAN DEFAULT 1,
                  notify_10m_before BOOLEAN DEFAULT 1,
                  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                  updated_at TEXT,
                  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                  UNIQUE(user_id)
                )`, (err) => {
                  if (err) {
                    console.error('Error creating user_preferences table', err);
                    return reject(err);
                  }
                  console.log('User preferences table created or already exists');
                  
                  // Create user_event_preferences table
                  db.run(`
                    CREATE TABLE IF NOT EXISTS user_event_preferences (
                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                      user_id TEXT NOT NULL,
                      event_type TEXT NOT NULL,
                      is_enabled BOOLEAN DEFAULT 1,
                      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                      updated_at TEXT,
                      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                      UNIQUE(user_id, event_type)
                    )`, (err) => {
                      if (err) {
                        console.error('Error creating user_event_preferences table', err);
                        return reject(err);
                      }
                      console.log('User event preferences table created or already exists');
                      
                      // Create push_subscriptions table
                      db.run(`
                        CREATE TABLE IF NOT EXISTS push_subscriptions (
                          id INTEGER PRIMARY KEY AUTOINCREMENT,
                          user_id TEXT NOT NULL,
                          endpoint TEXT NOT NULL,
                          keys TEXT NOT NULL,
                          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                          UNIQUE(endpoint)
                        )`, (err) => {
                          if (err) {
                            console.error('Error creating push_subscriptions table', err);
                            return reject(err);
                          }
                          console.log('Push subscriptions table created or already exists');
                          
                          // Create sync_logs table
                          db.run(`
                            CREATE TABLE IF NOT EXISTS sync_logs (
                              id INTEGER PRIMARY KEY AUTOINCREMENT,
                              sync_time DATETIME NOT NULL,
                              status TEXT NOT NULL,
                              events_added INTEGER DEFAULT 0,
                              events_updated INTEGER DEFAULT 0,
                              error_message TEXT,
                              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                              CHECK (status IN ('in_progress', 'completed', 'failed'))
                            )`, (err) => {
                              if (err) {
                                console.error('Error creating sync_logs table', err);
                                return reject(err);
                              }
                              console.log('Sync logs table created or already exists');
                              
                              // Create indexes
                              db.serialize(() => {
                                db.run('CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type)')
                                  .run('CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time)')
                                  .run('CREATE INDEX IF NOT EXISTS idx_events_is_deleted ON events(is_deleted)')
                                  .run('CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON sync_logs(created_at)', 
                                    (err) => {
                                      if (err) {
                                        console.error('Error creating indexes:', err);
                                        return reject(err);
                                      }
                                      console.log('All indexes created or already exist');
                                      resolve();
                                    });
                              });
                            });
                        });
                    });
                });
            });
        });
    });
  });
}

// Run the setup if this file is executed directly
if (require.main === module) {
  setupDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Failed to set up database:', error);
      process.exit(1);
    });
}

module.exports = { setupDatabase };
