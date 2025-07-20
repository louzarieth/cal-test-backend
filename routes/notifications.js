const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { isPushSupported, getVapidPublicKey } = require('../services/notification/webPushService');

// Get VAPID public key for client
router.get('/vapid-public-key', (req, res) => {
  console.log('[API] VAPID public key request received');
  
  if (!isPushSupported()) {
    const errorMsg = 'Push notifications are not configured on the server';
    console.error('[API]', errorMsg);
    return res.status(503).json({ 
      success: false, 
      error: errorMsg
    });
  }
  
  const publicKey = getVapidPublicKey();
  console.log('[API] Sending VAPID public key:', publicKey ? 'Key exists' : 'Key is missing');
  
  if (!publicKey) {
    const errorMsg = 'VAPID public key is not configured';
    console.error('[API]', errorMsg);
    return res.status(500).json({
      success: false,
      error: errorMsg
    });
  }
  
  res.json({
    success: true,
    publicKey: publicKey
  });
});

// Subscribe to push notifications
router.post('/subscribe', async (req, res) => {
  try {
    const { userId, subscription } = req.body;
    
    if (!userId || !subscription) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: userId and subscription are required' 
      });
    }

    const db = await getDb();
    
    // Check if subscription already exists
    const existing = await db.get(
      'SELECT * FROM push_subscriptions WHERE endpoint = ?',
      [subscription.endpoint]
    );

    if (existing) {
      // Update existing subscription
      await db.run(
        `UPDATE push_subscriptions 
         SET keys = ?, email = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE endpoint = ?`,
        [JSON.stringify(subscription.keys), userId, subscription.endpoint]
      );
    } else {
      // Insert new subscription
      await db.run(
        `INSERT INTO push_subscriptions 
         (user_id, endpoint, keys, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [userId, subscription.endpoint, JSON.stringify(subscription.keys)]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to subscribe to push notifications' 
    });
  }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', async (req, res) => {
  try {
    const { userId, subscription } = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required field: subscription.endpoint' 
      });
    }

    const db = await getDb();
    
    await db.run(
      'DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?',
      [subscription.endpoint, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to unsubscribe from push notifications' 
    });
  }
});

// Send a test notification to the current user
router.post('/test', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required field: userId' 
      });
    }

    const db = await getDb();
    
    // Get user's push subscription
    const subscription = await db.get(
      'SELECT * FROM push_subscriptions WHERE user_id = ?',
      [userId]
    );

    if (!subscription) {
      return res.status(404).json({ 
        success: false, 
        error: 'No push subscription found for this user' 
      });
    }

    // Import webPushService here to avoid circular dependencies
    const { sendNotification } = require('../services/notification/webPushService');
    
    // Send test notification
    await sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: JSON.parse(subscription.keys)
      },
      {
        title: 'Test Notification',
        body: 'This is a test notification from the calendar app!',
        icon: '/icons/calendar-192x192.png',
        data: {
          url: '/',
          timestamp: Date.now()
        }
      }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error sending test notification:', error);
    
    // Handle specific error cases
    if (error.statusCode === 410) {
      // Subscription is no longer valid - remove it
      const db = await getDb();
      await db.run(
        'DELETE FROM push_subscriptions WHERE endpoint = ?',
        [error.endpoint]
      );
      
      return res.status(410).json({ 
        success: false, 
        error: 'Push subscription has expired. Please refresh the page and try again.' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send test notification' 
    });
  }
});

// Get user's notification preferences
router.get('/users/me/preferences', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required in query parameters'
      });
    }
    
    const db = await getDb();
    
    // Get user preferences
    const preferences = await db.get(
      `SELECT * FROM user_preferences 
       WHERE email = ?`,
      [email]
    );

    if (!preferences) {
      return res.status(404).json({
        success: false,
        error: 'Preferences not found'
      });
    }

    // Format the response to match frontend expectations
    const response = {
      email: preferences.email,
      notify_email: preferences.notify_email === 1,
      notify_browser: preferences.notify_browser === 1,
      notify_all_events: preferences.notify_all_events === 1,
      email_1h_before: preferences.email_1h_before === 1,
      email_10m_before: preferences.email_10m_before === 1,
      browser_1h_before: preferences.browser_1h_before === 1,
      browser_10m_before: preferences.browser_10m_before === 1,
      notify_new_events: preferences.notify_new_events === 1
    };

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get notification preferences',
      details: error.message
    });
  }
});

// Update user's notification preferences
router.put('/users/me/preferences', async (req, res) => {
  let db;
  try {
    console.log('Received preferences update request:', JSON.stringify(req.body, null, 2));
    
    const { 
      email,
      notify_email,
      notify_browser,
      notify_all_events,
      email_1h_before,
      email_10m_before,
      browser_1h_before,
      browser_10m_before,
      notify_new_events
    } = req.body;
    
    if (!email) {
      console.error('Email is required');
      return res.status(400).json({ 
        success: false, 
        error: 'Email is required' 
      });
    }
    
    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.error('Invalid email format:', email);
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }
    
    db = await getDb();
    
    // Check if the table exists
    const tableInfo = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='user_preferences'"
    );
    
    if (!tableInfo) {
      console.error('Table user_preferences does not exist');
      return res.status(500).json({
        success: false,
        error: 'Database table not found',
        details: 'user_preferences table does not exist'
      });
    }
    
    // Get table schema for debugging
    const tableSchema = await db.all(
      "PRAGMA table_info(user_preferences)"
    );
    console.log('Table schema:', tableSchema);
    
    try {
      // Prepare the SQL query and parameters
      const query = `
        INSERT INTO user_preferences (
          email, 
          notify_email, 
          notify_browser, 
          notify_all_events,
          email_1h_before,
          email_10m_before,
          browser_1h_before,
          browser_10m_before,
          notify_new_events,
          email_notifications_enabled,
          browser_notifications_enabled,
          twitter_notifications_enabled,
          reminder_minutes,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(email) 
        DO UPDATE SET 
          notify_email = excluded.notify_email,
          notify_browser = excluded.notify_browser,
          notify_all_events = excluded.notify_all_events,
          email_1h_before = excluded.email_1h_before,
          email_10m_before = excluded.email_10m_before,
          browser_1h_before = excluded.browser_1h_before,
          browser_10m_before = excluded.browser_10m_before,
          notify_new_events = excluded.notify_new_events,
          email_notifications_enabled = excluded.email_notifications_enabled,
          browser_notifications_enabled = excluded.browser_notifications_enabled,
          twitter_notifications_enabled = excluded.twitter_notifications_enabled,
          reminder_minutes = excluded.reminder_minutes,
          updated_at = CURRENT_TIMESTAMP
      `;
      
      // Convert boolean values to 1/0 for SQLite and set default values for new fields
      const params = [
        email,
        Boolean(notify_email) ? 1 : 0,
        Boolean(notify_browser) ? 1 : 0,
        Boolean(notify_all_events) ? 1 : 0,
        Boolean(email_1h_before) ? 1 : 0,
        Boolean(email_10m_before) ? 1 : 0,
        Boolean(browser_1h_before) ? 1 : 0,
        Boolean(browser_10m_before) ? 1 : 0,
        Boolean(notify_new_events) ? 1 : 0,
        // Default values for new fields
        Boolean(notify_email) ? 1 : 0, // email_notifications_enabled
        Boolean(notify_browser) ? 1 : 0, // browser_notifications_enabled
        1, // twitter_notifications_enabled (default to true)
        60 // reminder_minutes (default to 60)
      ];
      
      console.log('Executing SQL:', query);
      console.log('With parameters:', params);
      
      // Execute the query
      console.log('Executing query with params:', { query, params });
      
      try {
        const result = await db.run(query, params);
        console.log('Query result:', result);
        
        // Get the updated preferences to return
        const updatedPrefs = await db.get(
          'SELECT * FROM user_preferences WHERE email = ?', 
          [email]
        );
        
        if (!updatedPrefs) {
          console.error('Failed to retrieve updated preferences for email:', email);
          return res.status(500).json({
            success: false,
            error: 'Failed to retrieve updated preferences',
            details: 'Preferences were saved but could not be retrieved'
          });
        }
        
        console.log('Successfully updated preferences:', updatedPrefs);
        
        // Format the response to ensure consistent boolean values
        const formattedPrefs = {
          email: updatedPrefs.email,
          notify_email: updatedPrefs.notify_email === 1,
          notify_browser: updatedPrefs.notify_browser === 1,
          notify_all_events: updatedPrefs.notify_all_events === 1,
          email_1h_before: updatedPrefs.email_1h_before === 1,
          email_10m_before: updatedPrefs.email_10m_before === 1,
          browser_1h_before: updatedPrefs.browser_1h_before === 1,
          browser_10m_before: updatedPrefs.browser_10m_before === 1,
          notify_new_events: updatedPrefs.notify_new_events === 1,
          email_notifications_enabled: updatedPrefs.email_notifications_enabled === 1,
          browser_notifications_enabled: updatedPrefs.browser_notifications_enabled === 1,
          twitter_notifications_enabled: updatedPrefs.twitter_notifications_enabled === 1,
          reminder_minutes: updatedPrefs.reminder_minutes || 60
        };
        
        res.json({ 
          success: true,
          message: 'Preferences updated successfully',
          data: formattedPrefs
        });
      } catch (queryError) {
        console.error('Query execution error:', queryError);
        console.error('Error details:', {
          code: queryError.code,
          message: queryError.message,
          stack: queryError.stack
        });
        
        // Try to get more details about the table structure
        try {
          const tableInfo = await db.all('PRAGMA table_info(user_preferences)');
          console.error('Current table structure:', tableInfo);
        } catch (e) {
          console.error('Could not get table info:', e);
        }
        
        throw queryError;
      }
    } catch (error) {
      console.error('Database error:', error);
      console.error('Error stack:', error.stack);
      console.error('Error code:', error.code);
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        code: error.code,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to update preferences',
        details: error.message,
        code: error.code
      });
    }
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update notification preferences' 
    });
  }
});

module.exports = router;
