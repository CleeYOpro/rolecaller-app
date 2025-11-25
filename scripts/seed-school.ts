import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function seedSchool() {
    const client = await pool.connect();
    try {
        // Check if schools exist
        const res = await client.query('SELECT count(*) FROM schools');
        const count = parseInt(res.rows[0].count);
        
        if (count === 0) {
            console.log('Seeding default school...');
            const result = await client.query(`
                INSERT INTO schools (id, name, email, password, address)
                VALUES (gen_random_uuid(), 'Greenwood High', 'admin@greenwood.edu', 'password', '123 Main St')
                RETURNING id, name, email
            `);
            console.log('✅ Default school seeded:', result.rows[0]);
        } else {
            console.log(`✅ Schools already exist (${count} schools)`);
            const schools = await client.query('SELECT id, name, email FROM schools LIMIT 5');
            console.log('Existing schools:', schools.rows);
        }
    } catch (error) {
        console.error('❌ Error seeding school:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

seedSchool()
    .then(() => {
        console.log('Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Failed:', error);
        process.exit(1);
    });

