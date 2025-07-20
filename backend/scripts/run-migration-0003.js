const { up } = require('../db/migrations/0003_update_user_preferences_id');

console.log('Starting migration 0003: Update user_preferences table to use id as primary key');

up()
  .then(() => {
    console.log('Migration completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
