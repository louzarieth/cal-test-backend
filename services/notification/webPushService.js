const webpush = require('web-push');
const { getDb } = require('../../db');

// Initialize web-push with VAPID keys
const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL || 'monad@flypass.io';

// Validate VAPID keys
if (!publicVapidKey || !privateVapidKey) {
  console.warn('VAPID keys are not set. Browser notifications will not work.');
  console.warn('Please set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_EMAIL in your .env file.');
} else {
  webpush.setVapidDetails(
    `mailto:${vapidEmail}`,
    publicVapidKey,
    privateVapidKey
  );
  console.log('Web Push service initialized with VAPID keys');
}

/**
 * Send a browser notification to a specific subscription
 * @param {Object} subscription Push subscription object
 * @param {Object} payload Notification payload
 */
const sendNotification = async (subscription, payload) => {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    console.log('Browser notification sent successfully');
    return { success: true };
  } catch (error) {
    console.error('Error sending browser notification:', error);
    
    // If the subscription is no longer valid, remove it from the database
    if (error.statusCode === 410) {
      console.log('Subscription has expired or is no longer valid');
      await removeSubscription(subscription);
    }
    
    return { success: false, error: error.message };
  }
};

/**
 * Send browser notifications to multiple users for an upcoming event
 * @param {Array} users Array of user objects with push subscriptions
 * @param {Object} event Event object
 * @param {string} timeBefore Time before event (e.g., '1 hour')
 */
const sendEventBrowserNotifications = async (users, event, timeBefore) => {
  if (!Array.isArray(users) || users.length === 0) {
    console.log('No users to send browser notifications to');
    return { success: true, sent: 0 };
  }

  const eventTime = new Date(event.start);
  const notification = {
    title: `🔔 Reminder: ${event.title}`,
    body: `Starts ${timeBefore} at ${eventTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    icon: '/icons/calendar-192x192.png',
    badge: '/icons/calendar-192x192.png',
    data: {
      url: ``,
      eventId: event.id,
      timestamp: Date.now()
    },
    actions: [
      { action: 'view', title: 'View Event' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    vibrate: [200, 100, 200],
    requireInteraction: true
  };

  let sentCount = 0;
  const results = [];

  // Send notifications to all users in parallel
  await Promise.all(users.map(async (user) => {
    if (!user.pushSubscription) {
      console.log(`User ${user.id} has no push subscription`);
      return;
    }

    try {
      const result = await sendNotification(user.pushSubscription, notification);
      if (result.success) {
        sentCount++;
      }
      results.push({
        userId: user.id,
        success: result.success,
        error: result.error
      });
    } catch (error) {
      console.error(`Error sending notification to user ${user.id}:`, error);
      results.push({
        userId: user.id,
        success: false,
        error: error.message
      });
    }
  }));

  console.log(`Sent ${sentCount} browser notifications for event ${event.id}`);
  return {
    success: sentCount > 0,
    sent: sentCount,
    total: users.length,
    results
  };
};

/**
 * Send a browser notification for an upcoming event
 * @param {Object} user User object with push subscription
 * @param {Object} event Event object
 * @param {string} timeBefore Time before event (e.g., '1 hour')
 */
const sendEventBrowserNotification = async (user, event, timeBefore) => {
  if (!user.pushSubscription) {
    console.log('User has no push subscription');
    return { success: false, error: 'No push subscription' };
  }
  
  const { title, start, end, description } = event;
  const eventDate = new Date(start);
  const endDate = new Date(end);
  
  const notificationPayload = {
    notification: {
      title: `🔔 ${title} starts in ${timeBefore}`,
      body: `${eventDate.toLocaleTimeString()} - ${endDate.toLocaleTimeString()}`,
      icon: '/notification-icon.png',
      data: {
        url: window.location.href,
        eventId: event.id
      },
      actions: [
        { action: 'view', title: 'View Event' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    }
  };
  
  return sendNotification(user.pushSubscription, notificationPayload);
};

/**
 * Save a push subscription to the database
 * @param {string} userId User ID
 * @param {Object} subscription Push subscription object
 */
const saveSubscription = async (userId, subscription) => {
  try {
    const db = await getDb();
    await db.run(
      'INSERT OR REPLACE INTO push_subscriptions (user_id, subscription, created_at) VALUES (?, ?, ?)',
      [userId, JSON.stringify(subscription), new Date().toISOString()]
    );
    return { success: true };
  } catch (error) {
    console.error('Error saving push subscription:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Remove a push subscription from the database
 * @param {Object} subscription Push subscription object
 */
const removeSubscription = async (subscription) => {
  try {
    const db = await getDb();
    await db.run(
      'DELETE FROM push_subscriptions WHERE subscription = ?',
      [JSON.stringify(subscription)]
    );
    return { success: true };
  } catch (error) {
    console.error('Error removing push subscription:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get the public VAPID key for the client
 * @returns {string} The public VAPID key
 */
const getVapidPublicKey = () => publicVapidKey;

/**
 * Check if push notifications are supported and configured
 * @returns {boolean} True if push notifications are available
 */
const isPushSupported = () => {
  return !!(publicVapidKey && privateVapidKey);
};

module.exports = {
  sendNotification,
  sendEventBrowserNotification: sendEventBrowserNotifications, // Updated to use the new group function
  sendEventBrowserNotifications, // New function for multiple users
  saveSubscription,
  removeSubscription,
  getVapidPublicKey,
  isPushSupported
};
