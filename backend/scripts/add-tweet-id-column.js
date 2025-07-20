const { getDb } = require('../db');

async function addTweetIdColumn() {
  console.log('Checking if tweet_id column exists in event_reminders table...');
  
  try {
    const db = await getDb();
    
    // Check if the column already exists
    const columnInfo = await new Promise((resolve, reject) => {
      db.get(
        "SELECT name FROM pragma_table_info('event_reminders') WHERE name = 'tweet_id'",
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (columnInfo) {
      console.log('✅ tweet_id column already exists in event_reminders table');
      return true;
    }

    console.log('Adding tweet_id column to event_reminders table...');
    
    // Add the column
    await new Promise((resolve, reject) => {
      db.run(
        'ALTER TABLE event_reminders ADD COLUMN tweet_id TEXT',
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    console.log('✅ Successfully added tweet_id column to event_reminders table');
    return true;
  } catch (error) {
    console.error('❌ Error adding tweet_id column:', error);
    return false;
  }
}

// Run the function
addTweetIdColumn()
  .then(success => {
    if (success) {
      console.log('Database update completed successfully');
      process.exit(0);
    } else {
      console.error('Database update failed');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });
