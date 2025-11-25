import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function migrateClassId() {
    const client = await pool.connect();
    try {
        console.log('🔄 Starting migration: UUID class IDs → 5-digit text IDs...');
        
        await client.query('BEGIN');
        
        // 1. Drop foreign key constraints
        console.log('1. Dropping foreign key constraints...');
        await client.query(`
            ALTER TABLE attendance 
            DROP CONSTRAINT IF EXISTS attendance_class_id_classes_id_fk;
        `);
        await client.query(`
            ALTER TABLE students 
            DROP CONSTRAINT IF EXISTS students_class_id_classes_id_fk;
        `);
        
        // 2. Create temporary columns for new class IDs
        console.log('2. Creating temporary columns...');
        await client.query(`
            ALTER TABLE classes 
            ADD COLUMN IF NOT EXISTS new_id TEXT;
        `);
        await client.query(`
            ALTER TABLE students 
            ADD COLUMN IF NOT EXISTS new_class_id TEXT;
        `);
        await client.query(`
            ALTER TABLE attendance 
            ADD COLUMN IF NOT EXISTS new_class_id TEXT;
        `);
        
        // 3. Generate 5-digit IDs for existing classes and update references
        console.log('3. Generating new class IDs and updating references...');
        const classesResult = await client.query('SELECT id, name, school_id FROM classes');
        
        for (const cls of classesResult.rows) {
            // Generate a unique 5-digit ID
            let newClassId: string;
            let exists = true;
            while (exists) {
                newClassId = Math.floor(10000 + Math.random() * 90000).toString();
                const check = await client.query('SELECT id FROM classes WHERE new_id = $1', [newClassId]);
                exists = check.rows.length > 0;
            }
            
            // Update class with new ID
            await client.query('UPDATE classes SET new_id = $1 WHERE id = $2', [newClassId, cls.id]);
            
            // Update students referencing this class
            await client.query(
                'UPDATE students SET new_class_id = $1 WHERE class_id = $2',
                [newClassId, cls.id]
            );
            
            // Update attendance referencing this class
            await client.query(
                'UPDATE attendance SET new_class_id = $1 WHERE class_id = $2',
                [newClassId, cls.id]
            );
            
            console.log(`   ✓ Migrated class "${cls.name}" (${cls.id} → ${newClassId})`);
        }
        
        // 4. Drop old columns and rename new ones
        console.log('4. Replacing old columns with new ones...');
        await client.query('ALTER TABLE classes DROP CONSTRAINT classes_pkey CASCADE');
        await client.query('ALTER TABLE classes DROP COLUMN id');
        await client.query('ALTER TABLE classes RENAME COLUMN new_id TO id');
        await client.query('ALTER TABLE classes ADD PRIMARY KEY (id)');
        
        await client.query('ALTER TABLE students DROP COLUMN class_id');
        await client.query('ALTER TABLE students RENAME COLUMN new_class_id TO class_id');
        
        await client.query('ALTER TABLE attendance DROP COLUMN class_id');
        await client.query('ALTER TABLE attendance RENAME COLUMN new_class_id TO class_id');
        
        // 5. Recreate foreign key constraints
        console.log('5. Recreating foreign key constraints...');
        await client.query(`
            ALTER TABLE students 
            ADD CONSTRAINT students_class_id_classes_id_fk 
            FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
        `);
        await client.query(`
            ALTER TABLE attendance 
            ADD CONSTRAINT attendance_class_id_classes_id_fk 
            FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
        `);
        
        // 6. Change roll_number to grade if needed
        console.log('6. Migrating roll_number to grade...');
        const hasGrade = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'students' AND column_name = 'grade'
        `);
        
        if (hasGrade.rows.length === 0) {
            await client.query('ALTER TABLE students ADD COLUMN grade TEXT');
            await client.query('UPDATE students SET grade = roll_number::TEXT WHERE roll_number IS NOT NULL');
            await client.query('ALTER TABLE students DROP COLUMN IF EXISTS roll_number');
        }
        
        await client.query('COMMIT');
        console.log('✅ Migration completed successfully!');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

migrateClassId()
    .then(() => {
        console.log('✅ Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Failed:', error);
        process.exit(1);
    });

