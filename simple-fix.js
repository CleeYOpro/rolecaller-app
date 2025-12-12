const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

async function fixSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check current column types
    const checkResult = await client.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('students', 'attendance') 
      AND column_name = 'class_id'
    `);

    console.log('Current column types:');
    checkResult.rows.forEach(row => {
      console.log(`${row.column_name} in ${row.table_name}: ${row.data_type}`);
    });

    // Check sample data
    console.log('\nChecking sample data...');
    const sampleStudents = await client.query(`SELECT class_id FROM students LIMIT 3`);
    console.log('Sample class_id values in students:', sampleStudents.rows);

    // Drop foreign key constraints first
    console.log('\nDropping foreign key constraints...');
    await client.query(`ALTER TABLE students DROP CONSTRAINT IF EXISTS students_class_id_classes_id_fk`);
    await client.query(`ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_class_id_classes_id_fk`);
    console.log('Foreign key constraints dropped');

    // Add USING clause to properly convert text to uuid
    console.log('\nConverting columns with proper USING clause...');
    await client.query(`
      ALTER TABLE students 
      ALTER COLUMN class_id TYPE uuid USING NULLIF(TRIM(class_id), '')::uuid
    `);
    console.log('Converted students.class_id to UUID');

    await client.query(`
      ALTER TABLE attendance 
      ALTER COLUMN class_id TYPE uuid USING NULLIF(TRIM(class_id), '')::uuid
    `);
    console.log('Converted attendance.class_id to UUID');

    console.log('\nSchema fixed successfully!');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

fixSchema();