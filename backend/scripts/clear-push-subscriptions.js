const { getDb } = require('../db');

async function clearPushSubscriptions() {
  try {
    const db = await getDb();
    
    // Clear the push_subscriptions table
    await db.run('DELETE FROM push_subscriptions');
    
    console.log('✅ Successfully cleared all push subscriptions');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing push subscriptions:', error);
    process.exit(1);
  }
}

clearPushSubscriptions();
