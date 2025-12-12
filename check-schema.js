const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

async function checkSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Check all column types in our tables
    const result = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name IN ('students', 'attendance', 'classes', 'schools')
      ORDER BY table_name, ordinal_position
    `);

    console.log('Current database schema:');
    console.log('========================');
    let currentTable = '';
    result.rows.forEach(row => {
      if (row.table_name !== currentTable) {
        currentTable = row.table_name;
        console.log(`\n${currentTable}:`);
      }
      console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Check if there are any rows in the tables
    console.log('\n\nRow counts:');
    console.log('===========');
    const counts = await client.query(`
      SELECT 'students' as table_name, COUNT(*) as count FROM students
      UNION ALL
      SELECT 'attendance' as table_name, COUNT(*) as count FROM attendance
      UNION ALL
      SELECT 'classes' as table_name, COUNT(*) as count FROM classes
      UNION ALL
      SELECT 'schools' as table_name, COUNT(*) as count FROM schools
    `);
    
    counts.rows.forEach(row => {
      console.log(`${row.table_name}: ${row.count} rows`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkSchema();