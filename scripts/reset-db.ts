import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function resetDatabase() {
    const client = await pool.connect();
    try {
        console.log('Dropping existing tables...');
        
        // Drop tables in correct order (respecting foreign keys)
        await client.query('DROP TABLE IF EXISTS attendance CASCADE');
        await client.query('DROP TABLE IF EXISTS attendance_records CASCADE');
        await client.query('DROP TABLE IF EXISTS students CASCADE');
        await client.query('DROP TABLE IF EXISTS classes CASCADE');
        await client.query('DROP TABLE IF EXISTS schools CASCADE');
        await client.query('DROP TYPE IF EXISTS attendance_status CASCADE');
        
        console.log('Database reset complete. You can now run: npx drizzle-kit push');
    } catch (error) {
        console.error('Error resetting database:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

resetDatabase()
    .then(() => {
        console.log('Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Failed:', error);
        process.exit(1);
    });

