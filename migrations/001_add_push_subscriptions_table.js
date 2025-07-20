const { getDb } = require('../db');

async function up() {
  const db = await getDb();
  
  // Create push_subscriptions table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      subscription TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, subscription)
    )
  `);
  
  console.log('Created push_subscriptions table');
}

async function down() {
  const db = await getDb();
  await db.exec('DROP TABLE IF EXISTS push_subscriptions');
  console.log('Dropped push_subscriptions table');
}

module.exports = { up, down };
