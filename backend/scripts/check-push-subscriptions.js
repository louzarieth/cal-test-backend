const { getDb } = require('../db');
const fs = require('fs');
const path = require('path');

async function checkPushSubscriptions() {
  try {
    // Check database file location
    const dbPath = path.join(__dirname, '../db/database.sqlite');
    console.log('🔍 Database file path:', dbPath);
    console.log('📂 Database file exists:', fs.existsSync(dbPath));
    
    // Get database instance
    const db = await getDb();
    
    // Check if table exists
    const tableCheck = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='push_subscriptions'"
    );
    
    if (!tableCheck) {
      console.log('❌ push_subscriptions table does not exist');
      return;
    }
    
    console.log('✅ push_subscriptions table exists');
    
    // Count rows
    const count = await db.get('SELECT COUNT(*) as count FROM push_subscriptions');
    console.log(`📊 Number of rows in push_subscriptions: ${count.count}`);
    
    // Show first few rows
    const rows = await db.all('SELECT * FROM push_subscriptions LIMIT 3');
    console.log('🔍 First few rows:');
    console.log(JSON.stringify(rows, null, 2));
    
  } catch (error) {
    console.error('❌ Error checking push subscriptions:', error);
  } finally {
    process.exit(0);
  }
}

checkPushSubscriptions();
