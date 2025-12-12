const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

async function checkMismatches() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Check class IDs in students table
    console.log('Class IDs in students table:');
    const studentClasses = await client.query(`
      SELECT DISTINCT class_id FROM students ORDER BY class_id
    `);
    studentClasses.rows.forEach(row => {
      console.log(`  ${row.class_id}`);
    });

    // Check class IDs in attendance table
    console.log('\nClass IDs in attendance table:');
    const attendanceClasses = await client.query(`
      SELECT DISTINCT class_id FROM attendance ORDER BY class_id
    `);
    attendanceClasses.rows.forEach(row => {
      console.log(`  ${row.class_id}`);
    });

    // Check class IDs in classes table
    console.log('\nClass IDs in classes table:');
    const classes = await client.query(`
      SELECT id FROM classes ORDER BY id
    `);
    classes.rows.forEach(row => {
      console.log(`  ${row.id}`);
    });

    // Check for mismatches
    console.log('\nChecking for mismatches...');

    // Find student class IDs that don't exist in classes table
    const mismatchedStudents = await client.query(`
      SELECT DISTINCT s.class_id 
      FROM students s 
      LEFT JOIN classes c ON s.class_id = c.id 
      WHERE c.id IS NULL
    `);

    if (mismatchedStudents.rows.length > 0) {
      console.log('\nMismatched class IDs in students table:');
      mismatchedStudents.rows.forEach(row => {
        console.log(`  ${row.class_id}`);
      });
    } else {
      console.log('\nNo mismatched class IDs in students table');
    }

    // Find attendance class IDs that don't exist in classes table
    const mismatchedAttendance = await client.query(`
      SELECT DISTINCT a.class_id 
      FROM attendance a 
      LEFT JOIN classes c ON a.class_id = c.id 
      WHERE c.id IS NULL
    `);

    if (mismatchedAttendance.rows.length > 0) {
      console.log('\nMismatched class IDs in attendance table:');
      mismatchedAttendance.rows.forEach(row => {
        console.log(`  ${row.class_id}`);
      });
    } else {
      console.log('\nNo mismatched class IDs in attendance table');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkMismatches();