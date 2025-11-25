import 'dotenv/config';
import { db } from '../database/client';
import { classes, schools, students } from '../database/schema';
import { dbService } from '../services/db';

async function test() {
    console.log('Testing Neon DB connection...');

    // Use UUIDs or let DB generate them? 
    // Schema has defaultRandom(), so we can let DB generate IDs or provide them if we want specific ones for testing.
    // For testing, it's easier to capture the generated IDs.

    try {
        // 1. Create School
        console.log('Creating school...');
        const schoolRes = await db.insert(schools).values({
            name: 'Test School',
            address: '123 Test Lane'
        }).returning();
        const schoolId = schoolRes[0].id;
        console.log('School created:', schoolId);

        // 2. Create Class
        console.log('Creating class...');
        const classRes = await db.insert(classes).values({
            name: 'Test Class',
            schoolId: schoolId,
        }).returning();
        const classId = classRes[0].id;
        console.log('Class created:', classId);

        // 3. Create Student
        console.log('Creating student...');
        const studentRes = await db.insert(students).values({
            name: 'Test Student',
            classId: classId,
            rollNumber: 1
        }).returning();
        const studentId = studentRes[0].id;
        console.log('Student created:', studentId);

        // 4. Mark Attendance
        console.log('Marking attendance...');
        await dbService.markAttendance(studentId, classId, '2024-01-01', 'present');

        // 5. Verify Attendance
        console.log('Verifying attendance...');
        const records = await dbService.getAttendance(classId, '2024-01-01');
        console.log('Attendance records:', records);

        if (records[studentId] === 'present') {
            console.log('SUCCESS: Attendance marked and retrieved correctly.');
        } else {
            console.error('FAILURE: Attendance mismatch.');
        }

        // Cleanup (optional, maybe keep to see in studio)
        // await db.delete(attendance).where(eq(attendance.classId, classId));
        // await db.delete(students).where(eq(students.classId, classId));
        // await db.delete(classes).where(eq(classes.schoolId, schoolId));
        // await db.delete(schools).where(eq(schools.id, schoolId));

    } catch (e) {
        console.error('Test failed:', e);
    }
}

test();
