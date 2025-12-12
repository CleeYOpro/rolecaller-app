const { Client } = require('pg');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');

dotenv.config();

async function fixSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check if the columns are already UUID type
    const checkResult = await client.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('students', 'attendance', 'classes') 
      AND column_name IN ('class_id', 'id')
    `);

    console.log('Current column types:');
    checkResult.rows.forEach(row => {
      console.log(`${row.column_name} in ${row.table_name}: ${row.data_type}`);
    });

    // Check what kind of data we have in the class_id columns
    console.log('\nChecking existing data samples...');
    const sampleStudents = await client.query(`SELECT DISTINCT class_id FROM students LIMIT 5`);
    console.log('Sample class_id values in students:', sampleStudents.rows);

    const sampleAttendance = await client.query(`SELECT DISTINCT class_id FROM attendance LIMIT 5`);
    console.log('Sample class_id values in attendance:', sampleAttendance.rows);

    // Drop foreign key constraints first
    console.log('\nDropping foreign key constraints...');

    try {
      await client.query(`ALTER TABLE students DROP CONSTRAINT IF EXISTS students_class_id_classes_id_fk`);
      console.log('Dropped students_class_id_classes_id_fk constraint');
    } catch (error) {
      console.log('No students_class_id_classes_id_fk constraint to drop');
    }

    try {
      await client.query(`ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_class_id_classes_id_fk`);
      console.log('Dropped attendance_class_id_classes_id_fk constraint');
    } catch (error) {
      console.log('No attendance_class_id_classes_id_fk constraint to drop');
    }

    // Since the data isn't UUID, we need to create a mapping from old IDs to new UUIDs
    console.log('\nCreating mapping for class IDs...');

    // Get all distinct class IDs from both tables
    const classIdsResult = await client.query(`
      SELECT DISTINCT class_id FROM (
        SELECT class_id FROM students 
        UNION 
        SELECT class_id FROM attendance
      ) AS all_class_ids
      WHERE class_id IS NOT NULL AND TRIM(class_id) != ''
    `);

    const classIdMap = {};
    classIdsResult.rows.forEach(row => {
      // Generate a new UUID for each old ID
      classIdMap[row.class_id] = uuidv4();
    });

    console.log(`Found ${Object.keys(classIdMap).length} distinct class IDs to convert`);

    // Update the data with new UUIDs
    console.log('\nUpdating class_id values in students table...');
    for (const [oldId, newId] of Object.entries(classIdMap)) {
      await client.query(
        `UPDATE students SET class_id = $1 WHERE class_id = $2`,
        [newId, oldId]
      );
    }

    console.log('Updating class_id values in attendance table...');
    for (const [oldId, newId] of Object.entries(classIdMap)) {
      await client.query(
        `UPDATE attendance SET class_id = $1 WHERE class_id = $2`,
        [newId, oldId]
      );
    }

    // Now alter columns to UUID type
    console.log('\nConverting class_id columns to UUID type...');

    await client.query(`ALTER TABLE students ALTER COLUMN class_id TYPE uuid USING class_id::uuid`);
    console.log('Successfully converted students.class_id to UUID');

    await client.query(`ALTER TABLE attendance ALTER COLUMN class_id TYPE uuid USING class_id::uuid`);
    console.log('Successfully converted attendance.class_id to UUID');

    // Also update the classes table IDs - but first we need to update the references
    console.log('\nUpdating classes table IDs...');
    const classesResult = await client.query(`SELECT id FROM classes`);

    // Create mapping for classes
    const classesMapping = {};
    for (const row of classesResult.rows) {
      classesMapping[row.id] = uuidv4();
    }

    // Update all references to classes first
    for (const [oldId, newId] of Object.entries(classesMapping)) {
      await client.query(`UPDATE students SET class_id = $1 WHERE class_id = $2`, [newId, oldId]);
      await client.query(`UPDATE attendance SET class_id = $1 WHERE class_id = $2`, [newId, oldId]);
    }

    // Now update the primary keys in classes table
    for (const [oldId, newId] of Object.entries(classesMapping)) {
      await client.query(`UPDATE classes SET id = $1 WHERE id = $2`, [newId, oldId]);
    }

    // Update classes.id column to UUID type
    await client.query(`ALTER TABLE classes ALTER COLUMN id TYPE uuid USING id::uuid`);
    console.log('Successfully converted classes.id to UUID');

    // Recreate foreign key constraints
    console.log('\nRecreating foreign key constraints...');
    await client.query(`
      ALTER TABLE students 
      ADD CONSTRAINT students_class_id_classes_id_fk 
      FOREIGN KEY (class_id) REFERENCES classes(id)
    `);
    console.log('Recreated students_class_id_classes_id_fk constraint');

    await client.query(`
      ALTER TABLE attendance 
      ADD CONSTRAINT attendance_class_id_classes_id_fk 
      FOREIGN KEY (class_id) REFERENCES classes(id)
    `);
    console.log('Recreated attendance_class_id_classes_id_fk constraint');

    console.log('\nSchema fixed successfully!');
  } catch (error) {
    console.error('Error fixing schema:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await client.end();
  }
}

fixSchema();