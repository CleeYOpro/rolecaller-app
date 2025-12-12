const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

async function fixClassesId() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // First, check what data we have in classes.id
    console.log('\nChecking current classes.id values...');
    const classesResult = await client.query(`SELECT id, name FROM classes`);
    console.log('Current classes:');
    classesResult.rows.forEach(row => {
      console.log(`  ${row.id}: ${row.name}`);
    });

    // Check if there are any foreign key references that need to be updated
    console.log('\nChecking foreign key references...');

    // Drop foreign key constraints first
    console.log('\nDropping foreign key constraints...');
    await client.query(`ALTER TABLE students DROP CONSTRAINT IF EXISTS students_class_id_classes_id_fk`);
    await client.query(`ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_class_id_classes_id_fk`);
    console.log('Foreign key constraints dropped');

    // Now alter the column type - they're already valid UUIDs stored as text
    console.log('\nConverting classes.id to UUID...');
    await client.query(`ALTER TABLE classes ALTER COLUMN id TYPE uuid USING id::uuid`);
    console.log('Converted classes.id to UUID');

    // Recreate foreign key constraints
    console.log('\nRecreating foreign key constraints...');
    await client.query(`
      ALTER TABLE students 
      ADD CONSTRAINT students_class_id_classes_id_fk 
      FOREIGN KEY (class_id) REFERENCES classes(id)
    `);
    await client.query(`
      ALTER TABLE attendance 
      ADD CONSTRAINT attendance_class_id_classes_id_fk 
      FOREIGN KEY (class_id) REFERENCES classes(id)
    `);
    console.log('Foreign key constraints recreated');

    console.log('\nClasses.id column fixed successfully!');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

fixClassesId();