const express = require('express');
const router = express.Router();
const { getDb, getRow, getRows, runQuery } = require('../db');
const { format, startOfDay, endOfDay, parseISO, addMinutes, isBefore } = require('date-fns');
const { v4: uuidv4 } = require('uuid');

// Middleware to get or create user by email
const getCurrentUser = async (req, res, next) => {
  try {
    // Get email from request body or query params
    let email = req.body.email || req.query.email;
    
    // If no email in request, try to get it from the preferences data
    if (!email && req.body.preferences && req.body.preferences.email) {
      email = req.body.preferences.email;
    }
    
    // If still no email, use default
    if (!email) {
      email = 'default@example.com';
    }
    
    // Make sure email is a string and trim any whitespace
    email = String(email).trim().toLowerCase();
    
    // Try to get existing user by email
    let user = await getRow('SELECT * FROM users WHERE email = ?', [email]);
    
    // Create user if doesn't exist
    if (!user) {
      const userId = uuidv4();
      await runQuery(
        'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
        [userId, email, email.split('@')[0]]
      );
      
      // Create default preferences
      await runQuery(
        `INSERT INTO user_preferences (id, email, notify_email, notify_browser, notify_all_events, 
          email_1h_before, email_10m_before, browser_1h_before, browser_10m_before, 
          notify_new_events, created_at, updated_at) 
         VALUES (?, ?, 1, 1, 1, 1, 1, 1, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [userId, email]
      );
      
      user = { id: userId, email, name: email.split('@')[0] };
    }
    
    // Attach user to the request object
    req.user = user;
    console.log('DEBUG: User object attached to request in getCurrentUser:', JSON.stringify(req.user, null, 2));
    next();
  } catch (error) {
    console.error('Error in getCurrentUser middleware:', error);
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
};

// Apply middleware to all user-specific routes
router.use('/users/me', getCurrentUser);

/**
 * Get events within a date range
 * Query params:
 * - start: Start date (ISO string)
 * - end: End date (ISO string)
 */
router.get('/events', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ 
        success: false, 
        error: 'Start and end dates are required' 
      });
    }

    const startDate = parseISO(start);
    const endDate = parseISO(end);

    const events = await getRows(
      `SELECT 
        id, 
        event_id as id,
        title,
        description,
        start_time as start,
        end_time as end,
        created_at,
        updated_at
      FROM events 
      WHERE 
        start_time >= ? 
        AND end_time <= ?
        AND is_deleted = 0
      ORDER BY start_time`,
      [startDate.toISOString(), endDate.toISOString()]
    );

    res.json({
      success: true,
      data: events.map(event => ({
        ...event,
        allDay: !event.start.includes('T') // If no time component, it's an all-day event
      }))
    });

  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch events' 
    });
  }
});

/**
 * Get event by ID
 */
router.get('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await getRow(
      `SELECT 
        id, 
        event_id as id,
        title,
        description,
        start_time as start,
        end_time as end,
        created_at,
        updated_at
      FROM events 
      WHERE id = ? AND is_deleted = 0`,
      [id]
    );

    if (!event) {
      return res.status(404).json({ 
        success: false, 
        error: 'Event not found' 
      });
    }

    res.json({
      success: true,
      data: {
        ...event,
        allDay: !event.start.includes('T')
      }
    });

  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch event' 
    });
  }
});

/**
 * Get events for today
 */
router.get('/events/today', async (req, res) => {
  try {
    const today = new Date();
    const start = startOfDay(today).toISOString();
    const end = endOfDay(today).toISOString();

    const events = await getRows(
      `SELECT 
        id, 
        event_id as id,
        title,
        description,
        start_time as start,
        end_time as end,
        created_at,
        updated_at
      FROM events 
      WHERE 
        start_time >= ? 
        AND end_time <= ?
        AND is_deleted = 0
      ORDER BY start_time`,
      [start, end]
    );

    res.json({
      success: true,
      data: events.map(event => ({
        ...event,
        allDay: !event.start.includes('T')
      }))
    });

  } catch (error) {
    console.error('Error fetching today\'s events:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch today\'s events' 
    });
  }
});

/**
 * Get upcoming events (next 7 days)
 */
router.get('/events/upcoming', async (req, res) => {
  try {
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    const events = await getRows(
      `SELECT 
        id, 
        event_id as id,
        title,
        description,
        start_time as start,
        end_time as end,
        created_at,
        updated_at
      FROM events 
      WHERE 
        start_time >= ? 
        AND start_time <= ?
        AND is_deleted = 0
      ORDER BY start_time
      LIMIT 50`,
      [today.toISOString(), nextWeek.toISOString()]
    );

    res.json({
      success: true,
      data: events.map(event => ({
        ...event,
        allDay: !event.start.includes('T')
      }))
    });

  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch upcoming events' 
    });
  }
});

// User endpoints

/**
 * Get current user info
 */
router.get('/users/me', (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name
    }
  });
});

/**
 * Get user notification preferences
 */
// Get or update event type preferences for the current user
router.route('/users/me/event-preferences')
  // Get all event type preferences for the user
  .get(async (req, res) => {
    try {
      const eventPrefs = await getRows(
        `SELECT event_type as eventType, is_enabled as isEnabled 
         FROM user_event_preferences 
         WHERE user_id = ?`,
        [req.user.id]
      );

      res.json({
        success: true,
        data: eventPrefs
      });
    } catch (error) {
      console.error('Error fetching event preferences:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch event preferences' 
      });
    }
  })
  // Create or update an event type preference
  .post(async (req, res) => {
    try {
      const { eventType, isEnabled } = req.body;
      
      if (!eventType) {
        return res.status(400).json({ 
          success: false, 
          error: 'eventType is required' 
        });
      }

      // Check if preference already exists
      const existing = await getRow(
        'SELECT * FROM user_event_preferences WHERE user_id = ? AND event_type = ?',
        [req.user.id, eventType]
      );

      if (existing) {
        // Update existing preference
        await runQuery(
          'UPDATE user_event_preferences SET is_enabled = ? WHERE user_id = ? AND event_type = ?',
          [isEnabled ? 1 : 0, req.user.id, eventType]
        );
      } else {
        // Insert new preference
        await runQuery(
          'INSERT INTO user_event_preferences (user_id, event_type, is_enabled) VALUES (?, ?, ?)',
          [req.user.id, eventType, isEnabled ? 1 : 0]
        );
      }

      res.json({ 
        success: true,
        data: { eventType, isEnabled }
      });
    } catch (error) {
      console.error('Error updating event preference:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update event preference' 
      });
    }
  });

// Get user notification preferences
router.get('/users/me/preferences', async (req, res) => {
  try {
    const preferences = await getRow(
      'SELECT * FROM user_preferences WHERE email = ?',
      [req.user.id]
    );

    if (!preferences) {
      return res.status(404).json({
        success: false,
        error: 'Preferences not found'
      });
    }

    res.json({
      success: true,
      data: {
        notifyEmail: preferences.notify_email === 1,
        notifyBrowser: preferences.notify_browser === 1,
        notifyAllEvents: preferences.notify_all_events === 1,
        notify1hBefore: preferences.notify_1h_before === 1,
        notify10mBefore: preferences.notify_10m_before === 1,
        updatedAt: preferences.updated_at
      }
    });
  } catch (error) {
    console.error('Error getting user preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user preferences'
    });
  }
});

/**
 * Update user notification preferences
 */
router.put('/users/me/preferences', async (req, res) => {
  try {
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

    // Use the authenticated user's email from the middleware
    const userEmail = req.user.email;

    const existingPrefs = await getRow(
      'SELECT * FROM user_preferences WHERE email = ?',
      [userEmail]
    );

    const preferences = {
      notify_email,
      notify_browser,
      notify_all_events,
      email_1h_before,
      email_10m_before,
      browser_1h_before,
      browser_10m_before,
      notify_new_events
    };

    if (existingPrefs) {
      // UPDATE existing preferences
      const updateFields = [];
      const updateValues = [];

      for (const [key, value] of Object.entries(preferences)) {
        if (value !== undefined) {
          updateFields.push(`${key} = ?`);
          updateValues.push(value ? 1 : 0);
        }
      }

      if (updateFields.length > 0) {
        updateFields.push('updated_at = ?');
        updateValues.push(new Date().toISOString());
        updateValues.push(userEmail); // for the WHERE clause

        const query = `UPDATE user_preferences SET ${updateFields.join(', ')} WHERE email = ?`;
        await runQuery(query, updateValues);
      }
    } else {
      // INSERT new preferences
      const columns = ['email'];
      const values = [userEmail];
      const placeholders = ['?'];

      for (const [key, value] of Object.entries(preferences)) {
        if (value !== undefined) {
          columns.push(key);
          values.push(value ? 1 : 0);
          placeholders.push('?');
        }
      }

      const query = `INSERT INTO user_preferences (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
      await runQuery(query, values);
    }

    const updatedPrefs = await getRow(
      'SELECT * FROM user_preferences WHERE email = ?',
      [userEmail]
    );

    const response = {};
    if (updatedPrefs) {
      for (const [key, value] of Object.entries(updatedPrefs)) {
        if (['notify_email', 'notify_browser', 'notify_all_events', 'email_1h_before', 'email_10m_before', 'browser_1h_before', 'browser_10m_before', 'notify_new_events'].includes(key)) {
          response[key] = value === 1;
        } else {
          response[key] = value;
        }
      }
    }

    res.json({
      success: true,
      data: response,
      message: 'Preferences updated successfully'
    });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user preferences'
    });
  }
});

/**
 * Get user event type preferences
 */
// Define routes for event preferences
router.route('/users/me/event-preferences')
  // Get all event type preferences for the user
  .get(async (req, res) => {
    try {
      const eventPreferences = await getRows(
        'SELECT event_type, is_enabled FROM user_event_preferences WHERE user_id = ?',
        [req.user.id]
      );

      res.json({
        success: true,
        data: eventPreferences
      });
    } catch (error) {
      console.error('Error getting event preferences:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get event preferences'
      });
    }
  })
  // Update user event type preferences
  .put(async (req, res) => {
    try {
      const { eventType, isEnabled } = req.body;
      const email = req.user.email; // Get email from the authenticated user

      if (!eventType) {
        return res.status(400).json({
          success: false,
          error: 'eventType is required'
        });
      }

      // Update or insert the preference
      await runQuery(
        `INSERT INTO user_event_preferences 
         (user_id, event_type, is_enabled, updated_at)
         VALUES ((SELECT id FROM users WHERE email = ?), ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id, event_type) 
         DO UPDATE SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP`,
        [email, eventType, isEnabled ? 1 : 0, isEnabled ? 1 : 0]
      );

      res.json({
        success: true,
        message: 'Event preference updated successfully'
      });
    } catch (error) {
      console.error('Error updating event preference:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update event preference'
      });
    }
  });

/**
 * Register browser push subscription
 */
router.post('/users/me/push-subscriptions', async (req, res) => {
  try {
    // Log the incoming request
    console.log('=== PUSH SUBSCRIPTION REQUEST ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('User:', req.user);
    console.log('==============================');

    // Get the subscription data from the request
    const { endpoint, keys, email } = req.body;
    
    if (!endpoint) {
      const errorMsg = 'Invalid push subscription data: endpoint is required';
      console.error(errorMsg);
      return res.status(400).json({
        success: false,
        error: errorMsg
      });
    }
    
    if (!email) {
      const errorMsg = 'Email is required for push subscription';
      console.error(errorMsg);
      return res.status(400).json({
        success: false,
        error: errorMsg
      });
    }
    
    // Find or create user with the provided email
    let user = await getRow('SELECT * FROM users WHERE email = ?', [email]);
    
    if (!user) {
      console.log(`Creating new user with email: ${email}`);
      const userId = uuidv4();
      await runQuery(
        'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
        [userId, email, email.split('@')[0]]
      );
      
      // Create default preferences for the new user
      await runQuery(
        `INSERT INTO user_preferences (email) VALUES (?)`,
        [email]
      );
      
      user = { id: userId, email, name: email.split('@')[0] };
    }
    
    console.log(`Using user for push subscription:`, user);
    
    if (!endpoint) {
      const errorMsg = 'Invalid push subscription data: endpoint is required';
      console.error(errorMsg);
      return res.status(400).json({
        success: false,
        error: errorMsg
      });
    }

    // Use the user ID from the user we found or created
    const userId = user.id;
    console.log(`Using user ID for push subscription: ${userId}`);

    try {
      // Stringify the keys object for storage
      const keyJson = keys ? JSON.stringify(keys) : '{}';
      
      console.log('Processing push subscription for user:', userId);
      console.log('Endpoint:', endpoint);
      console.log('Key (first 50 chars):', keyJson.substring(0, 50) + '...');

      try {
        // Check if subscription already exists for this endpoint
        console.log('Checking for existing subscription with endpoint:', endpoint);
        const existingSub = await getRow(
          'SELECT id FROM push_subscriptions WHERE endpoint = ?', 
          [endpoint]
        );

        if (existingSub) {
          // Update existing subscription
          console.log('Updating existing subscription for endpoint:', endpoint);
          const updateSql = `
            UPDATE push_subscriptions 
            SET user_id = ?, 
                keys = ?, 
                created_at = CURRENT_TIMESTAMP 
            WHERE endpoint = ?
          `;
          
          console.log('Update SQL:', updateSql);
          console.log('Update params:', [userId, keyJson, endpoint]);
          
          await runQuery(updateSql, [
            userId,
            keyJson,
            endpoint
          ]);
        } else {
          // Insert new subscription
          console.log('Creating new subscription for endpoint:', endpoint);
          const insertSql = `
            INSERT INTO push_subscriptions 
            (user_id, endpoint, keys, created_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          `;
          
          console.log('Insert SQL:', insertSql);
          console.log('Insert params:', [userId, endpoint, keyJson]);
          
          await runQuery(insertSql, [
            userId,
            endpoint,
            keyJson
          ]);
        }
      } catch (dbError) {
        console.error('Database error in push subscription:', dbError);
        throw dbError; // Re-throw to be caught by the outer catch
      }

      console.log('Push subscription saved successfully for user ID:', userId);
      res.json({
        success: true,
        message: 'Push subscription registered successfully'
      });
    } catch (dbError) {
      console.error('Database error in push subscription:', dbError);
      throw dbError; // Will be caught by the outer catch
    }
  } catch (error) {
    console.error('Error in push subscription endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register push subscription',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Remove browser push subscription
 */
router.delete('/users/me/push-subscriptions', async (req, res) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        error: 'Endpoint is required'
      });
    }

    await runQuery(
      'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
      [req.user.id, endpoint]
    );

    res.json({
      success: true,
      message: 'Push subscription removed successfully'
    });
  } catch (error) {
    console.error('Error removing push subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove push subscription'
    });
  }
});

module.exports = router;
