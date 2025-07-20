const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'calendar.db');

// Open the database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
    process.exit(1);
  }
  console.log('Connected to the SQLite database.');
});

// Function to get all tables
const getTables = () => {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      (err, tables) => {
        if (err) return reject(err);
        resolve(tables.map(t => t.name));
      }
    );
  });
};

// Function to get table info
const getTableInfo = (tableName) => {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
      if (err) return reject(err);
      resolve(columns);
    });
  });
};

// Function to get foreign key info
const getForeignKeyInfo = (tableName) => {
  return new Promise((resolve) => {
    db.all(`PRAGMA foreign_key_list(${tableName})`, (err, fks) => {
      // Ignore errors as some tables might not have foreign keys
      resolve(fks || []);
    });
  });
};

// Main function to inspect the database
const inspectDatabase = async () => {
  try {
    const tables = await getTables();
    const schema = {};

    for (const table of tables) {
      const columns = await getTableInfo(table);
      const foreignKeys = await getForeignKeyInfo(table);
      
      schema[table] = {
        description: getTableDescription(table),
        columns: {},
        foreignKeys: foreignKeys.map(fk => ({
          from: fk.from,
          to: `${fk.table}.${fk.to}`,
          onDelete: fk.on_delete,
          onUpdate: fk.on_update
        }))
      };

      for (const col of columns) {
        schema[table].columns[col.name] = {
          type: col.type,
          notnull: col.notnull === 1,
          default: col.dflt_value,
          pk: col.pk === 1,
          description: getColumnDescription(table, col.name)
        };
      }
    }

    console.log(JSON.stringify(schema, null, 2));
    
  } catch (error) {
    console.error('Error inspecting database:', error);
  } finally {
    db.close();
  }
};

// Helper functions for descriptions
function getTableDescription(tableName) {
  const descriptions = {
    'users': 'Stores user account information',
    'events': 'Stores calendar events',
    'user_preferences': 'Stores user notification preferences',
    'user_event_preferences': 'Tracks which event types users have enabled for notifications',
    'push_subscriptions': 'Stores push notification subscription details for browser notifications',
    'event_reminders': 'Tracks scheduled reminders for events',
    'migrations': 'Tracks which database migrations have been applied'
  };
  return descriptions[tableName] || 'No description available';
}

function getColumnDescription(tableName, columnName) {
  const descriptions = {
    'users': {
      'id': 'Unique identifier for the user',
      'email': 'User\'s email address (must be unique)',
      'name': 'User\'s display name',
      'created_at': 'Timestamp when the user account was created',
      'updated_at': 'Timestamp when the user account was last updated',
      'is_active': 'Flag indicating if the user account is active (1) or deactivated (0)'
    },
    'events': {
      'id': 'Unique identifier for the event',
      'title': 'Title/name of the event',
      'description': 'Detailed description of the event (may contain HTML)',
      'start': 'Start date/time of the event in ISO format',
      'end': 'End date/time of the event in ISO format',
      'event_type': 'Category or type of the event (e.g., meeting, reminder, holiday)',
      'html_link': 'URL to the event in the original calendar',
      'created_at': 'Timestamp when the event was created',
      'updated_at': 'Timestamp when the event was last updated',
      'is_deleted': 'Flag indicating if the event is marked as deleted (1) or active (0)'
    },
    'user_preferences': {
      'id': 'Unique identifier for the preference record',
      'user_id': 'Reference to the user',
      'notify_email': 'Whether email notifications are enabled (1) or disabled (0)',
      'notify_browser': 'Whether browser notifications are enabled (1) or disabled (0)',
      'notify_all_events': 'Whether to notify for all event types (1) or only selected ones (0)',
      'email_1h_before': 'Send email notification 1 hour before event (1) or not (0)',
      'email_10m_before': 'Send email notification 10 minutes before event (1) or not (0)',
      'browser_1h_before': 'Show browser notification 1 hour before event (1) or not (0)',
      'browser_10m_before': 'Show browser notification 10 minutes before event (1) or not (0)',
      'notify_new_events': 'Automatically enable notifications for new event types (1) or not (0)',
      'created_at': 'Timestamp when the preference was created',
      'updated_at': 'Timestamp when the preference was last updated'
    },
    'user_event_preferences': {
      'id': 'Unique identifier for the event preference record',
      'user_id': 'Reference to the user',
      'event_type': 'Type/category of the event',
      'is_enabled': 'Whether notifications are enabled (1) or disabled (0) for this event type',
      'created_at': 'Timestamp when the preference was created',
      'updated_at': 'Timestamp when the preference was last updated'
    },
    'push_subscriptions': {
      'id': 'Unique identifier for the subscription',
      'user_id': 'Reference to the user',
      'endpoint': 'URL endpoint for the push subscription',
      'keys': 'JSON string containing encryption keys for the push subscription',
      'created_at': 'Timestamp when the subscription was created',
      'updated_at': 'Timestamp when the subscription was last updated'
    },
    'event_reminders': {
      'id': 'Unique identifier for the reminder',
      'event_id': 'Reference to the event',
      'user_id': 'Reference to the user who should receive the reminder',
      'reminder_type': 'Type of reminder (email, browser, etc.)',
      'reminder_minutes': 'Minutes before the event to send the reminder (e.g., 10, 60)',
      'scheduled_at': 'When the reminder is scheduled to be sent',
      'sent_at': 'When the reminder was actually sent (NULL if not sent yet)',
      'status': 'Status of the reminder (pending, sent, failed)',
      'created_at': 'Timestamp when the reminder was created',
      'updated_at': 'Timestamp when the reminder was last updated'
    },
    'migrations': {
      'id': 'Unique identifier for the migration',
      'name': 'Name of the migration file',
      'run_on': 'When the migration was executed'
    }
  };

  return (descriptions[tableName] && descriptions[tableName][columnName]) || 'No description available';
}

// Run the inspection
inspectDatabase();
