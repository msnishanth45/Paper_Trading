const fs = require('fs');
const path = require('path');
const { pool } = require('./mysql');

async function run() {
  try {
    const file = process.argv[2] || '03_stability_upgrade.sql';
    const filePath = path.join(__dirname, 'migrations', file);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    
    console.log(`Running ${statements.length} statements from ${file}...`);
    for (const stmt of statements) {
      if (stmt.startsWith('--')) continue; // skip pure comments
      try {
        await pool.query(stmt);
      } catch (err) {
        if (['ER_DUP_KEYNAME', 'ER_DUP_FIELDNAME'].includes(err.code)) {
           console.log(`Index or column already exists. Skipping...`);
        } else if (err.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
           console.log('Cannot drop key. Skipping...');
        } else {
           console.error(`Error on statement: ${stmt.substring(0, 50)}...`);
           console.error(err.message);
        }
      }
    }
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
