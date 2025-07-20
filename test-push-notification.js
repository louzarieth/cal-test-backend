// test-push-notification.js
// Script to test sending a browser push notification to all push_subscriptions in the database

const webpush = require('web-push');
const { getDb } = require('./db');
require('dotenv').config();

(async () => {
  const db = await getDb();

  // Set up VAPID keys
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'monad@flypass.io'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const subscriptions = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM push_subscriptions', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  if (!subscriptions || subscriptions.length === 0) {
    console.log('No push subscriptions found in the database.');
    process.exit(0);
  }

  const payload = JSON.stringify({
    title: '🔔 Test Notification',
    body: 'This is a test push notification.',
    icon: '/icon-192x192.png',
    data: { url: '/' }
  });

  for (const sub of subscriptions) {
    if (!sub.endpoint || !sub.keys) {
      console.error(`Skipping subscription with missing endpoint or keys:`, sub);
      continue;
    }
    let parsedKeys;
    try {
      parsedKeys = JSON.parse(sub.keys);
    } catch (err) {
      console.error(`Invalid keys for subscription (id=${sub.id || sub.user_id}):`, sub.keys);
      continue;
    }
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: parsedKeys
      }, payload);
      console.log(`✅ Push notification sent to endpoint: ${sub.endpoint}`);
    } catch (err) {
      console.error(`❌ Failed to send notification to endpoint: ${sub.endpoint}`);
      if (err.body) {
        console.error('Error body:', err.body);
      }
      console.error(err.message);
    }
  }

  console.log('Test complete.');
  process.exit(0);
})();
