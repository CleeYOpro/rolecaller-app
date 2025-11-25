import * as dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkAndSeed() {
    const client = await pool.connect();
    try {
        console.log('🔍 Checking schools table...');

        // Check if schools exist
        const res = await client.query('SELECT count(*) FROM schools');
        const count = parseInt(res.rows[0].count);
        console.log(`📊 Found ${count} schools in database`);

        if (count === 0) {
            console.log('🌱 Seeding default school...');
            const insertResult = await client.query(`
                INSERT INTO schools (id, name, email, password, address)
                VALUES (gen_random_uuid(), 'Greenwood High', 'admin@greenwood.edu', 'password', '123 Main St')
                RETURNING id, name, email
            `);
            console.log('✅ School seeded successfully:', insertResult.rows[0]);
        } else {
            const schools = await client.query('SELECT id, name, email FROM schools');
            console.log('✅ Existing schools:');
            schools.rows.forEach((school, i) => {
                console.log(`   ${i + 1}. ${school.name} (${school.email}) - ID: ${school.id}`);
            });
        }
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

checkAndSeed()
    .then(() => {
        console.log('✅ Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Failed:', error);
        process.exit(1);
    });

