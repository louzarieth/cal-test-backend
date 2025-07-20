const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');

// Get all migration files in order
const migrationFiles = fs.readdirSync(migrationsDir)
  .filter(file => file.endsWith('.js'))
  .sort();

console.log(`Found ${migrationFiles.length} migration(s) to run`);

// Run each migration in sequence
async function runMigrations() {
  for (const file of migrationFiles) {
    console.log(`\nRunning migration: ${file}`);
    
    try {
      // Run the migration script using Node.js
      const migrationPath = path.join(migrationsDir, file);
      await new Promise((resolve, reject) => {
        const child = exec(`node ${migrationPath}`, (error, stdout, stderr) => {
          if (error) {
            console.error(`Error running migration ${file}:`, error);
            reject(error);
            return;
          }
          console.log(stdout);
          if (stderr) console.error(stderr);
          resolve();
        });
        
        // Log output in real-time
        child.stdout.pipe(process.stdout);
        child.stderr.pipe(process.stderr);
      });
      
      console.log(`✅ Successfully ran migration: ${file}`);
    } catch (error) {
      console.error(`❌ Failed to run migration ${file}:`, error);
      process.exit(1);
    }
  }
  
  console.log('\n🎉 All migrations completed successfully!');
  process.exit(0);
}

// Run the migrations
runMigrations();
