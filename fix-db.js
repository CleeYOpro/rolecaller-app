const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

async function fixDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Fix students table
    console.log('Fixing students table...');
    await client.query(`
      ALTER TABLE students 
      ALTER COLUMN class_id TYPE uuid 
      USING NULLIF(class_id, '')::uuid
    `);

    // Fix attendance table
    console.log('Fixing attendance table...');
    await client.query(`
      ALTER TABLE attendance 
      ALTER COLUMN class_id TYPE uuid 
      USING NULLIF(class_id, '')::uuid
    `);

    console.log('Database fixed successfully!');
  } catch (err) {
    console.error('Error fixing database:', err);
  } finally {
    await client.end();
  }
}

fixDatabase();