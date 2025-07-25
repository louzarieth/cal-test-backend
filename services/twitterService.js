const { TwitterApi } = require('twitter-api-v2');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { getDb, getRows, getRow, db } = require('../db');
const { format, addMinutes, isAfter } = require('date-fns');

class TwitterService {
  constructor() {
    this.client = null;
    this.isProcessing = false;  // Lock to prevent concurrent processing
    this.initialize();
  }

  initialize() {
    // Check for required environment variables
    const requiredVars = [
      'TWITTER_API_KEY',
      'TWITTER_API_SECRET',
      'TWITTER_ACCESS_TOKEN',
      'TWITTER_ACCESS_SECRET'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.warn(`Missing Twitter API credentials: ${missingVars.join(', ')}`);
      console.warn('Twitter posting will be disabled. Run the setup script to configure:');
      console.warn('node scripts/get-twitter-auth.js');
      return;
    }

    try {
      this.client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY,
        appSecret: process.env.TWITTER_API_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_SECRET
      });
      
      // Verify credentials on startup
      this.verifyCredentials()
        .then(username => {
          console.log(`✅ Twitter service initialized successfully (authenticated as @${username})`);
          this.startScheduler();
        })
        .catch(error => {
          console.error('❌ Failed to verify Twitter credentials:', error.message);
          console.log('Please run the setup script to re-authenticate:');
          console.log('node scripts/get-twitter-auth.js');
        });
      
    } catch (error) {
      console.error('Error initializing Twitter client:', error);
    }
  }

  async verifyCredentials() {
    if (!this.client) {
      throw new Error('Twitter client not initialized');
    }
    const user = await this.client.v2.me();
    return user.data.username;
  }

  /**
   * Post a tweet with optional media
   * @param {string} text - The tweet text
   * @param {string} [imagePath=null] - Optional path to an image to include
   * @param {number} [retryCount=0] - Internal counter for retry attempts
   * @returns {Promise<Object>} The posted tweet data
   */
  async postTweet(text, imagePath = null, retryCount = 0) {
    if (!this.client) {
      throw new Error('Twitter client not initialized. Check your API credentials.');
    }

    // Validate input
    if (!text || typeof text !== 'string') {
      throw new Error('Tweet text is required and must be a string');
    }
    
    // Truncate text if it's too long
    const MAX_TWEET_LENGTH = 280;
    if (text.length > MAX_TWEET_LENGTH) {
      console.warn(`Tweet text is too long (${text.length} chars), truncating...`);
      text = text.substring(0, MAX_TWEET_LENGTH - 3) + '...';
    }

    try {
      console.log(`Posting tweet (attempt ${retryCount + 1}/3)...`);
      console.log('Text length:', text.length);
      
      let mediaId = null;
      
      // Handle media upload if image path is provided
      if (imagePath) {
        try {
          console.log(`Uploading media: ${imagePath}`);
          
          // Verify the file exists and is readable
          if (!fs.existsSync(imagePath)) {
            throw new Error(`Image file not found: ${imagePath}`);
          }
          
          const stats = fs.statSync(imagePath);
          if (stats.size === 0) {
            throw new Error(`Image file is empty: ${imagePath}`);
          }
          
          // Check file size (Twitter has a 5MB limit for most accounts)
          const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
          if (stats.size > MAX_IMAGE_SIZE) {
            throw new Error(`Image file is too large (${(stats.size / 1024 / 1024).toFixed(2)}MB). Max size is 5MB.`);
          }
          
          // Upload the media
          mediaId = await this.client.v1.uploadMedia(imagePath);
          console.log(`✅ Media uploaded successfully! ID: ${mediaId}`);
          
        } catch (mediaError) {
          console.error('❌ Error uploading media, falling back to text-only tweet:', mediaError.message);
          // Continue with text-only tweet if media upload fails
          mediaId = null;
        }
      }
      
      // Post the tweet with or without media
      const tweetParams = { text };
      if (mediaId) {
        tweetParams.media = { media_ids: [mediaId] };
      }
      
      const tweet = await this.client.v2.tweet(tweetParams);
      
      console.log(`✅ Tweet posted successfully!`);
      console.log(`   ID: ${tweet.data.id}`);
      if (mediaId) {
        console.log(`   Media ID: ${mediaId}`);
      }
      
      return tweet.data;
      
    } catch (error) {
      // Handle rate limits
      if (error.rateLimit) {
        const resetTime = new Date(error.rateLimit.reset * 1000);
        const waitTime = resetTime - new Date() + 5000; // Add 5s buffer
        
        if (retryCount < 2) { // Max 3 attempts total (0, 1, 2)
          console.warn(`Rate limited. Waiting ${Math.ceil(waitTime/1000)}s before retry ${retryCount + 2}/3...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          return this.postTweet(text, imagePath, retryCount + 1);
        }
        
        throw new Error(`Rate limit exceeded. Next reset at ${resetTime}. ${error.message}`);
      }
      
      // Handle other Twitter API errors
      if (error.code) {
        console.error('Twitter API Error:');
        console.error(`  Code: ${error.code}`);
        console.error(`  Message: ${error.message}`);
        
        // Handle specific error codes with retries
        const retryableErrors = [
          'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ESOCKETTIMEDOUT', 'EPIPE', 'ENOTFOUND'
        ];
        
        if (retryableErrors.includes(error.code) && retryCount < 2) {
          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
          console.warn(`Retryable error (${error.code}), retrying in ${delay/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.postTweet(text, imagePath, retryCount + 1);
        }
        
        // Handle specific error cases
        if (error.code === 187) { // Duplicate status
          throw new Error('Duplicate tweet: You have already posted this content.');
        } else if (error.code === 186) { // Tweet too long
          throw new Error('Tweet is too long. Please reduce the length and try again.');
        } else if (error.code === 324) { // Invalid media
          throw new Error('Invalid media file. Please check the format and try again.');
        }
      }
      
      // For other errors, include more context in the error message
      const errorDetails = error.data ? JSON.stringify(error.data, null, 2) : error.message;
      const errorMessage = `Failed to post tweet: ${errorDetails}`;
      console.error(errorMessage);
      
      // For network errors, we might want to retry
      if (!error.code && retryCount < 2) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        console.warn(`Network error, retrying in ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.postTweet(text, imagePath, retryCount + 1);
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Get events that are starting soon
   * @param {number} [minutesAhead=15] - How many minutes ahead to look for events
   * @param {number} [reminderMinutes=10] - How many minutes before the event to send reminder
   * @returns {Promise<Array>} Array of upcoming events
   */
  async getUpcomingEvents(minutesAhead = 15, reminderMinutes = 10) {
    try {
      const now = new Date();
      const endTime = addMinutes(now, minutesAhead);
      const reminderTime = addMinutes(now, reminderMinutes);
      
      // Get events that start within the reminder window
      const events = await getRows(
        `SELECT e.* 
         FROM events e
         LEFT JOIN event_reminders er ON e.id = er.event_id AND er.reminder_minutes = ?
         WHERE e.start_time >= ? 
           AND e.start_time <= ?
           AND e.is_deleted = 0
           AND (er.id IS NULL OR er.sent_at IS NULL)
         ORDER BY e.start_time ASC`,
        [reminderMinutes, now.toISOString(), endTime.toISOString()]
      );
      
      console.log(`Found ${events.length} events starting in the next ${minutesAhead} minutes`);
      return events;
      
    } catch (error) {
      console.error('Error fetching upcoming events:', error);
      // Return empty array on error to prevent blocking the reminder system
      return [];
    }
  }

  formatEventTweet(event, reminderMinutes = 10) {
    try {
      const startTime = new Date(event.start_time);
      if (isNaN(startTime.getTime())) {
        throw new Error(`Invalid event start time: ${event.start_time}`);
      }
      
      // Format time in user's local timezone
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const formattedTime = format(startTime, "h:mm a 'UTC'x");
      const localFormattedTime = format(startTime, "h:mm a (zzz)", { timeZone });
      
      // Different messages based on reminder time
      let reminderText = '';
      if (reminderMinutes === 10) {
        reminderText = '10-Minute Reminder!';
      } else if (reminderMinutes === 60) {
        reminderText = '1-Hour Reminder!';
      } else {
        reminderText = `Reminder: ${reminderMinutes} minutes until event!`;
      }
      
      // Truncate description to fit in tweet (280 chars - template length)
      const templateLength = 150; // Approximate length of the template text
      const maxDescLength = 280 - templateLength - event.title.length - localFormattedTime.length;
      let description = event.description || 'Join us for an exciting event!';
      
      if (description.length > maxDescLength) {
        description = description.substring(0, maxDescLength - 3) + '...';
      }
      
      return `🟣 ${reminderText}
Get ready for the upcoming "${event.title}" at ${localFormattedTime}.

📋 ${description}

#Monad #Crypto #EventReminder`;
    } catch (error) {
      console.error('Error formatting tweet:', error);
      // Fallback to simple format if there's an error
      return `🔔 Reminder: ${event.title} starting soon! #Monad`;
    }
  }

  /**
   * Check for upcoming events and post reminders to Twitter
   * @param {number[]} [reminderMinutes=[10, 60]] - Array of minutes before event to send reminders
   * @returns {Promise<{success: boolean, posted: number, errors: number}>}
   */
  async checkAndPostReminders(reminderMinutes = [10]) {
    const results = {
      success: true,
      posted: 0,
      errors: 0,
      details: []
    };

    try {
      // Process each reminder time
      for (const minutes of reminderMinutes) {
        try {
          // Get events that need this specific reminder
          const events = await this.getUpcomingEvents(minutes + 5, minutes);
          
          if (events.length === 0) {
            console.log(`No events found for ${minutes}-minute reminder`);
            continue;
          }
          
          console.log(`Processing ${events.length} events for ${minutes}-minute reminder`);
          
          // Process each event
          for (const event of events) {
            if (!event || !event.title) {
              console.warn('Skipping invalid event:', event);
              continue;
            }
            
            try {
              // Format the tweet with the specific reminder time
              const tweetText = this.formatEventTweet(event, minutes);
              
              // Handle image if available
              let imagePath = event.imageUrl;
              if (!imagePath) {
                // Try to use default image if available
                const defaultImagePath = path.join(__dirname, '..', 'public', 'icons', 'twitter.png');
                if (fs.existsSync(defaultImagePath)) {
                  imagePath = defaultImagePath;
                }
              }
              
              // Post the tweet
              let tweetResult;
              if (imagePath && fs.existsSync(imagePath)) {
                tweetResult = await this.postTweet(tweetText, imagePath);
              } else {
                tweetResult = await this.postTweet(tweetText);
              }
              
              // Mark reminder as sent in database
              await db.run(`
                INSERT OR IGNORE INTO event_reminders 
                (event_id, reminder_minutes, sent_at)
                VALUES (?, ?, ?)
              `, [event.id, minutes, new Date().toISOString()]);
              
              // Log success
              console.log(`✅ Posted ${minutes}-min reminder for: ${event.title} (${event.id})`);
              results.posted++;
              results.details.push({
                eventId: event.id,
                title: event.title,
                reminderMinutes: minutes,
                success: true,
                tweetId: tweetResult?.id,
                timestamp: new Date().toISOString()
              });
              
              // Add a small delay between tweets to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 500));
              
            } catch (error) {
              console.error(`❌ Failed to post ${minutes}-min reminder for event ${event.id}:`, error.message);
              results.errors++;
              results.success = false;
              results.details.push({
                eventId: event.id,
                title: event.title,
                reminderMinutes: minutes,
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
              });
              
              // Implement exponential backoff for rate limits
              if (error.rateLimit) {
                const resetTime = new Date(error.rateLimit.reset * 1000);
                const waitTime = resetTime - new Date() + 5000; // Add 5s buffer
                console.warn(`Rate limited. Waiting until ${resetTime} (${Math.ceil(waitTime/1000)}s)`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
              }
            }
          }
          
        } catch (batchError) {
          console.error(`Error processing ${minutes}-minute reminders:`, batchError);
          results.errors++;
          results.success = false;
          // Add delay before next batch
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      return results;
      
    } catch (error) {
      console.error('Critical error in checkAndPostReminders:', error);
      return {
        success: false,
        posted: results.posted,
        errors: results.errors + 1,
        details: results.details,
        error: error.message
      };
    }
  }
  
  // Removed markReminderAsSent as we're no longer tracking Twitter reminders in the database

  /**
   * Schedule the next reminder for the upcoming event
   * @private
   */
  async _scheduleNextReminder() {
    // Prevent concurrent execution
    if (this.isProcessing) {
      console.log('Already processing reminders, skipping this check');
      return;
    }

    try {
      this.isProcessing = true;
      
      // Clear any existing timeout
      if (this.reminderTimeout) {
        clearTimeout(this.reminderTimeout);
        this.reminderTimeout = null;
      }

      // Find the next event that needs a reminder
      const nextEvent = await this._findNextEventNeedingReminder();
      
      if (!nextEvent) {
        console.log('⏭️  No upcoming events found. Will check again in 1 hour.');
        this.reminderTimeout = setTimeout(() => this._scheduleNextReminder(), 60 * 60 * 1000);
        return;
      }

      const now = new Date();
      const eventTime = new Date(nextEvent.start_time);
      const reminderTime = new Date(eventTime.getTime() - (10 * 60 * 1000));
      const timeUntilReminder = reminderTime - now;

      if (timeUntilReminder <= 0) {
        console.log(`⏰ Posting immediate reminder for event: ${nextEvent.title}`);
        await this.checkAndPostReminders([10]);
        // Add a small delay before next check
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log(`⏰ Next reminder scheduled for ${reminderTime.toISOString()} (${nextEvent.title})`);
        this.reminderTimeout = setTimeout(async () => {
          try {
            await this.checkAndPostReminders([10]);
          } catch (error) {
            console.error('Error posting reminder:', error);
          } finally {
            // Add a small delay before next check
            await new Promise(resolve => setTimeout(resolve, 1000));
            this._scheduleNextReminder();
          }
        }, timeUntilReminder);
        return; // Exit after setting timeout
      }
    } catch (error) {
      console.error('❌ Error in _scheduleNextReminder:', error);
      // Add delay before retry
      await new Promise(resolve => setTimeout(resolve, 5000));
    } finally {
      this.isProcessing = false;
    }
    
    // Schedule next check with a small delay
    this.reminderTimeout = setTimeout(() => this._scheduleNextReminder(), 1000);
  }

  /**
   * Find the next event that needs a reminder
   * @private
   */
  async _findNextEventNeedingReminder() {
    try {
      const now = new Date();
      const futureCutoff = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year from now
      
      // Get the database connection
      const db = await getDb();
      
      // Find events that start in the future and haven't had reminders sent yet
      const query = `
        SELECT e.* 
        FROM events e
        LEFT JOIN event_reminders er ON e.id = er.event_id AND er.reminder_minutes = 10
        WHERE e.start_time > ? 
          AND e.start_time <= ?
          AND e.is_deleted = 0
          AND er.id IS NULL
        ORDER BY e.start_time ASC
        LIMIT 1
      `;
      
      const row = await getRow(query, [now.toISOString(), futureCutoff.toISOString()]);
      
      if (row) {
        console.log(`Found event needing reminder: ${row.title} at ${row.start_time}`);
      } else {
        console.log('No events found needing reminders');
      }
      
      return row || null;
    } catch (error) {
      console.error('Error in _findNextEventNeedingReminder:', error);
      throw error;
    }
  }

  /**
   * Start the Twitter reminder scheduler
   * @param {Object} [options] - Scheduler options
   * @param {boolean} [options.runOnStart=true] - Whether to run immediately on start
   * @returns {Object} The scheduler instance
   */
  startScheduler(runOnStart = true) {
    if (this.scheduler) {
      console.log('Twitter scheduler is already running');
      return this.scheduler;
    }
    
    // Import cron for clock-based scheduling
    const cron = require('node-cron');
    
    this.scheduler = {
      start: () => {
        console.log('Twitter scheduler started');
        
        // Run at every 7th minute of the hour (same as browser/email)
        this.cronJob = cron.schedule('*/13 * * * *', () => {
          console.log('🔄 Running Twitter reminder check at:', new Date().toLocaleTimeString());
          // Clear any existing timeout
          if (this.reminderTimeout) {
            clearTimeout(this.reminderTimeout);
            this.reminderTimeout = null;
          }
          // Re-schedule the next reminder
          this._scheduleNextReminder().catch(console.error);
        });
        
        // Initial schedule
        this._scheduleNextReminder().catch(console.error);
      },
      stop: () => {
        if (this.reminderTimeout) {
          clearTimeout(this.reminderTimeout);
          this.reminderTimeout = null;
        }
        if (this.cronJob) {
          this.cronJob.stop();
          this.cronJob = null;
        }
        console.log('Twitter scheduler stopped');
      }
    };
    
    // Start the scheduling process
    if (runOnStart) {
      console.log('🚀 Starting Twitter reminder scheduler...');
      this.scheduler.start();
      this._scheduleNextReminder();
    }
    
    return this.scheduler;
  }
  
  /**
   * Stop the Twitter reminder scheduler
   * @returns {boolean} True if stopped successfully, false if not running
   */
  stopScheduler() {
    if (this.scheduler) {
      this.scheduler.stop();
      return true;
    }
    return false;
  }
  
  /**
   * Post a reminder for an event
   * @param {Object} event - The event object containing title, start time, and description
   * @param {string} [imagePath=null] - Optional path to an image to include with the tweet
   * @returns {Promise<Object>} The posted tweet data
   */
  async postEventReminder(event, imagePath = null) {
    if (!event) {
      throw new Error('Event object is required');
    }

    try {
      console.log(`Posting reminder for event: ${event.title || 'Untitled Event'}`);
      
      // Format the tweet text using the existing method
      const tweetText = this.formatEventTweet(event);
      
      // Post the tweet with or without an image
      const result = await this.postTweet(tweetText, imagePath);
      
      // Mark the reminder as sent (10 minutes before event)
      const reminderMinutes = 10; // Default to 10 minutes before
      await this.markReminderAsSent(event.id, reminderMinutes);
      
      console.log(`✅ Successfully posted reminder for event: ${event.title}`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to post reminder for event ${event.id || 'unknown'}:`, error.message);
      if (error.rateLimit) {
        console.error('Rate limit exceeded. Reset at:', new Date(error.rateLimit.reset * 1000));
      }
      throw error;
    }
  }

  // Test function to post a tweet immediately
  async testPostTweet() {
    try {
      console.log('Posting test tweet (without image)...');
      const testEvent = {
        title: 'Test Event - Please Ignore',
        start: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes from now
        description: 'This is a test event to verify Twitter integration. You can safely ignore this tweet.',
        id: 'test-'+Date.now()
      };
      
      const tweetText = this.formatEventTweet(testEvent);
      console.log('Tweet text:', tweetText);
      
      // Post without an image
      const result = await this.postTweet(tweetText);
      console.log('Test tweet posted successfully (without image):', result);
      return result;
    } catch (error) {
      console.error('Error posting test tweet:', error);
      throw error;
    }
  }
}

// Export the class directly for testing
module.exports = {
  TwitterService,
  // For backward compatibility
  twitterService: new TwitterService(),
  testPostTweet: function() { return new TwitterService().testPostTweet(); }
};
