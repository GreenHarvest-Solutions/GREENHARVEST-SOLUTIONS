const fs = require('fs');
const path = require('path');
const { pool, connectDB } = require('./src/config/db');

async function run() {
  try {
    await connectDB();

    const migrationsDir = path.join(__dirname, 'src', 'database', 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration files in ${migrationsDir}\n`);

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      try {
        await pool.query(sql);
        console.log(`✓ Applied: ${file}`);
      } catch (err) {
        // Migration 006 is a live-patch repair migration that only applies to dirty schemas
        if (file.startsWith('006_')) {
          console.warn(`! Skipped/Notice on ${file} (live repair script): ${err.message}`);
        } else {
          console.error(`✗ Error applying ${file}:`, err.message);
          throw err;
        }
      }
    }

    console.log('\nAll migrations completed successfully.');
  } catch (error) {
    console.error('Migration runner failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
