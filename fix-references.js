const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

async function fixReferences() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Get the list of classes
    const classesResult = await client.query(`SELECT id FROM classes`);
    const classIds = classesResult.rows.map(row => row.id);
    console.log('Available class IDs:', classIds);

    // Create a mapping from old IDs to new IDs
    // For simplicity, we'll map all mismatched IDs to the first available class ID
    const firstClassId = classIds[0];
    console.log(`Will map all mismatched references to: ${firstClassId}\n`);

    // Update students with mismatched class IDs
    console.log('Updating students with mismatched class IDs...');
    const updateStudentsResult = await client.query(`
      UPDATE students 
      SET class_id = $1 
      WHERE class_id NOT IN (SELECT id FROM classes)
    `, [firstClassId]);
    console.log(`Updated ${updateStudentsResult.rowCount} student records`);

    // Update attendance with mismatched class IDs
    console.log('Updating attendance with mismatched class IDs...');
    const updateAttendanceResult = await client.query(`
      UPDATE attendance 
      SET class_id = $1 
      WHERE class_id NOT IN (SELECT id FROM classes)
    `, [firstClassId]);
    console.log(`Updated ${updateAttendanceResult.rowCount} attendance records`);

    // Now we can safely convert the classes.id column
    console.log('\nDropping foreign key constraints...');
    await client.query(`ALTER TABLE students DROP CONSTRAINT IF EXISTS students_class_id_classes_id_fk`);
    await client.query(`ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_class_id_classes_id_fk`);
    console.log('Foreign key constraints dropped');

    // Convert classes.id to UUID (should work now since all references are valid)
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

    console.log('\nAll references fixed successfully!');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

fixReferences();