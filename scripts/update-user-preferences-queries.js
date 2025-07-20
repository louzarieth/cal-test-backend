// Script to update all queries that reference user_id in user_preferences
const fs = require('fs');
const path = require('path');

// Files that need to be updated
const filesToUpdate = [
  'services/notification/notificationScheduler.js',
  'scripts/test-email-notifications.js',
  'scripts/schedule-email-reminders.js',
  'scripts/list-notification-preferences.js',
  'scripts/init-user-preferences.js',
  'scripts/check-upcoming-notifications.js',
  'scripts/check-next-email.js',
  'routes/api.js',
  'routes/notifications.js'
];

// Patterns to search and replace
const replacements = [
  {
    pattern: /JOIN\s+user_preferences\s+up\s+ON\s+u\.id\s*=\s*up\.user_id/gi,
    replacement: 'JOIN user_preferences up ON u.email = up.email'
  },
  {
    pattern: /SELECT\s+\*\s+FROM\s+user_preferences\s+WHERE\s+user_id\s*=\s*\?/gi,
    replacement: 'SELECT * FROM user_preferences WHERE email = ?'
  },
  {
    pattern: /INSERT\s+INTO\s+user_preferences\s*\([^)]*\buser_id\b[^)]*\)/gi,
    replacement: 'INSERT INTO user_preferences (email, notify_email, notify_browser, notify_all_events, email_1h_before, email_10m_before, browser_1h_before, browser_10m_before, notify_new_events, created_at, updated_at)'
  },
  {
    pattern: /VALUES\s*\([^)]*\?[^)]*\)/gi,
    replacement: 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
  },
  {
    pattern: /UPDATE\s+user_preferences\s+SET\s+user_id\s*=\s*\?/gi,
    replacement: 'UPDATE user_preferences SET email = ?'
  },
  {
    pattern: /,\s*user_id\s*,\s*/gi,
    replacement: ', email,'
  },
  {
    pattern: /,\s*user_id\s*=\s*\?/gi,
    replacement: ', email = ?'
  }
];

// Process each file
filesToUpdate.forEach(filePath => {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (fs.existsSync(fullPath)) {
    console.log(`Updating ${filePath}...`);
    
    try {
      // Read the file
      let content = fs.readFileSync(fullPath, 'utf8');
      let updated = false;
      
      // Apply all replacements
      replacements.forEach(({ pattern, replacement }) => {
        if (pattern.test(content)) {
          updated = true;
          content = content.replace(pattern, replacement);
        }
      });
      
      // Write the file back if changes were made
      if (updated) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`✅ Updated ${filePath}`);
      } else {
        console.log(`ℹ️  No changes needed for ${filePath}`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
    }
  } else {
    console.log(`⚠️  File not found: ${filePath}`);
  }
});

console.log('\nUpdate complete! Please review the changes and test thoroughly.');
