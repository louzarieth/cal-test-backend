const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const webpush = require('web-push');
const { getDb } = require('../db');

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('Error: VAPID keys are not set in environment variables');
  console.log('Please make sure your .env file contains VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY');
  process.exit(1);
}

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  'mailto:test@example.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

async function sendTestNotification() {
  try {
    console.log('Starting to send test notifications...');
    
    // Get the database instance
    const db = await getDb();
    
    // Get all active push subscriptions
    const subscriptions = await new Promise((resolve, reject) => {
      db.all(
        `SELECT ps.*, u.email 
         FROM push_subscriptions ps
         JOIN users u ON ps.user_id = u.id
         WHERE u.is_active = 1`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    if (subscriptions.length === 0) {
      console.log('No active push subscriptions found.');
      return;
    }

    console.log(`Found ${subscriptions.length} active push subscriptions.`);
    
    // Send test notification to each subscription
    for (const sub of subscriptions) {
      try {
        const payload = JSON.stringify({
          title: 'Test Notification',
          body: `Hello! This is a test notification sent at ${new Date().toLocaleTimeString()}`,
          icon: '/icon-192x192.png',
          timestamp: Date.now()
        });

        // Parse the keys if they're stored as a JSON string
        let subscriptionKeys;
        try {
          subscriptionKeys = typeof sub.keys === 'string' ? JSON.parse(sub.keys) : sub.keys;
        } catch (e) {
          console.error(`❌ Failed to parse subscription keys for ${sub.id}:`, e.message);
          return;
        }

        if (!subscriptionKeys || !subscriptionKeys.p256dh || !subscriptionKeys.auth) {
          console.error(`❌ Invalid subscription keys for ${sub.id}:`, subscriptionKeys);
          return;
        }

        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: subscriptionKeys.p256dh,
            auth: subscriptionKeys.auth
          }
        };

        console.log('Sending notification to:', {
          endpoint: sub.endpoint,
          keys: {
            p256dh: subscriptionKeys.p256dh.substring(0, 10) + '...',
            auth: subscriptionKeys.auth.substring(0, 5) + '...'
          }
        });

        await webpush.sendNotification(pushSubscription, payload);
        
        console.log(`✅ Test notification sent to ${sub.email || 'unknown user'}`);
      } catch (error) {
        console.error(`❌ Failed to send notification to subscription ${sub.id}:`, error.message);
        
        // If the subscription is no longer valid, remove it
        if (error.statusCode === 410) {
          console.log(`Removing expired subscription for user ${sub.email || 'unknown'}`);
          await new Promise((resolve, reject) => {
            db.run('DELETE FROM push_subscriptions WHERE id = ?', [sub.id], (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        }
      }
    }
    
    console.log('Test notifications sent successfully!');
  } catch (error) {
    console.error('Error sending test notifications:', error);
  } finally {
    // Close the database connection
    const db = await getDb();
    await new Promise(resolve => db.close(resolve));
    process.exit(0);
  }
}

// Run the function
sendTestNotification();
