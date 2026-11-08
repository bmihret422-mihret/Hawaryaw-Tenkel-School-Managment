const { execSync } = require('child_process');
const path = require('path');
const seed = require('./seed-data');

async function setup() {
  console.log('====================================================');
  console.log(' School Management System - Database Setup');
  console.log('====================================================');

  try {
    console.log('[Setup] 1. Applying Oracle DDL schema (tables, sequences, triggers)...');
    const schemaPath = path.resolve(__dirname, '..', 'config', 'schema.sql');
    
    // Run schema.sql via SQL*Plus
    const sqlCmd = `echo @"${schemaPath}"\nexit | sqlplus -s SCHOOL_DB/School123@localhost:1521/XE`;
    execSync(sqlCmd, { stdio: 'inherit', shell: 'powershell.exe' });
    console.log('[Setup] Schema applied successfully.');

    console.log('[Setup] 2. Populating realistic initial seed data...');
    await seed();
    console.log('[Setup] Full database initialization complete!');
  } catch (err) {
    console.error('[Setup Failed]:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  setup();
}

module.exports = setup;
