# Twitter API Setup Guide

## Prerequisites
- Node.js installed
- Twitter Developer Account with an app created
- App must have "Read and Write" permissions

## Setup Instructions

1. **Install Dependencies** (if not already installed):
   ```bash
   npm install twitter-api-v2 dotenv
   ```

2. **Configure Environment Variables**
   - Copy `.env.example` to `.env` if you haven't already
   - Add your Twitter API credentials from the developer portal:
     ```
     TWITTER_API_KEY=your_api_key_here
     TWITTER_API_SECRET=your_api_secret_here
     ```

3. **Authorize Twitter Account**
   - Run the auth script to get the authorization URL:
     ```bash
     node scripts/get-twitter-auth.js
     ```
   - Open the provided URL in your browser
   - Log in with the Twitter account you want to post from (Account 2)
   - You'll receive a PIN code - keep this safe

4. **Get Access Tokens**
   - Run the token script with the PIN:
     ```bash
     node scripts/get-access-tokens.js YOUR_PIN
     ```
   - This will output the access token and secret
   - Update your `.env` file with these values:
     ```
     TWITTER_ACCESS_TOKEN=your_access_token_here
     TWITTER_ACCESS_SECRET=your_access_secret_here
     ```

5. **Test the Integration**
   - Restart your server to load the new environment variables
   - The Twitter service should now be able to post from the authorized account

## Troubleshooting

### Common Issues
- **403 Forbidden**: Ensure your app has "Read and Write" permissions in the Twitter Developer Portal
- **Invalid or expired token**: Generate new tokens if they expire
- **PIN not working**: Make sure to use the PIN immediately after generation

### Security Notes
- Never commit your `.env` file to version control
- Keep your API keys and access tokens secure
- Regenerate tokens if they are compromised
