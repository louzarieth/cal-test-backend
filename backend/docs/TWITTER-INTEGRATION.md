# Twitter Integration for Monad Calendar

This document outlines the Twitter integration for the Monad Calendar application, which allows automatic posting of event reminders to Twitter.

## Features

- Post event reminders to Twitter 10 minutes before events
- Support for including images with tweets
- Rate limiting and error handling
- Database tracking of sent reminders to prevent duplicates
- Configurable scheduling

## Setup

### Prerequisites

1. Twitter Developer Account with API access
2. Required environment variables (add to `.env`):

```
TWITTER_API_KEY=your_api_key_here
TWITTER_API_SECRET=your_api_secret_here
TWITTER_ACCESS_TOKEN=your_access_token_here
TWITTER_ACCESS_SECRET=your_access_secret_here
```

### Database

Run the migration to create the required table:

```bash
node scripts/run-migration.js 20240301_add_event_reminders_table
```

## Usage

### Initialization

```javascript
const { TwitterService } = require('./services/twitterService');
const twitterService = new TwitterService();
```

### Posting a Tweet

```javascript
// Simple text tweet
try {
  const tweet = await twitterService.postTweet('Hello from Monad Calendar!');
  console.log('Tweet posted:', tweet.id);
} catch (error) {
  console.error('Failed to post tweet:', error.message);
}

// Tweet with an image
try {
  const tweet = await twitterService.postTweet(
    'Check out this event!',
    '/path/to/image.jpg'
  );
  console.log('Tweet with image posted:', tweet.id);
} catch (error) {
  console.error('Failed to post tweet with image:', error.message);
}
```

### Scheduling Event Reminders

```javascript
// Start the reminder scheduler
const scheduler = twitterService.startScheduler({
  schedule: '*/5 * * * *', // Check every 5 minutes
  runOnStart: true // Run immediately on start
});

// To stop the scheduler
// scheduler.stop();
```

### Formatting Event Tweets

```javascript
const tweetText = twitterService.formatEventTweet({
  id: 'event-123',
  title: 'Monad Community Call',
  description: 'Join us for our weekly community call!',
  start_time: '2023-04-01T14:00:00Z'
}, 10); // 10-minute reminder
```

## Testing

Run the test script to verify the Twitter integration:

```bash
node scripts/test-twitter-service.js
```

## Error Handling

The service includes comprehensive error handling for:
- Rate limiting with automatic retry after cooldown
- Invalid or missing credentials
- Network errors with exponential backoff
- Invalid tweet content or media
- Duplicate tweets

## Best Practices

1. **Rate Limiting**: The service respects Twitter's rate limits and includes backoff/retry logic.
2. **Error Logging**: All errors are logged with detailed information for debugging.
3. **Idempotency**: The system tracks sent reminders to prevent duplicate postings.
4. **Configuration**: All timing and behavior can be configured via method parameters or environment variables.

## Troubleshooting

### Common Issues

1. **Authentication Errors**:
   - Verify your API keys and access tokens
   - Ensure the Twitter app has the correct permissions

2. **Rate Limiting**:
   - The service should handle rate limits automatically, but you may need to wait if you hit limits
   - Check logs for rate limit reset times

3. **Media Upload Failures**:
   - Ensure the image file exists and is accessible
   - Check that the file size is under Twitter's limits (5MB for most accounts)
   - Verify the image format is supported (JPEG, PNG, or GIF)

For additional help, check the logs or contact support.
