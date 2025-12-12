import { db } from '@/database/client';
import { attendanceLocal, classesLocal, localDb, schoolsLocal, studentsLocal, teachersLocal } from '@/database/localdb';
import { classes, schools, students } from '@/database/schema';
import { eq } from 'drizzle-orm';
import { api } from './api';

export const syncPullSchoolData = async (schoolId: string) => {
    console.log('Starting sync pull for school:', schoolId);

    try {
        // 1. Fetch from Neon
        const schoolRes = await db.select().from(schools).where(eq(schools.id, schoolId));
        const classesRes = await db.select().from(classes).where(eq(classes.schoolId, schoolId));
        const studentsRes = await db.select().from(students).where(eq(students.schoolId, schoolId));

        if (schoolRes.length === 0) {
            console.error('School not found online');
            return;
        }

        const school = schoolRes[0];

        // 2. Save to SQLite
        // Save School
        await localDb.insert(schoolsLocal).values({
            id: school.id,
            name: school.name,
            email: school.email,
            password: school.password,
            address: school.address,
            createdAt: school.createdAt ? new Date(school.createdAt).toISOString() : new Date().toISOString(),
        }).onConflictDoUpdate({
            target: schoolsLocal.id,
            set: {
                name: school.name,
                email: school.email,
                password: school.password,
                address: school.address,
            }
        });

        // Save Classes
        for (const c of classesRes) {
            await localDb.insert(classesLocal).values({
                id: c.id,
                schoolId: c.schoolId,
                name: c.name,
                createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
            }).onConflictDoUpdate({
                target: classesLocal.id,
                set: { name: c.name }
            });
        }

        // Save Students
        for (const s of studentsRes) {
            await localDb.insert(studentsLocal).values({
                id: s.id,
                classId: s.classId,
                schoolId: s.schoolId,
                name: s.name,
                grade: s.grade,
                createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
            }).onConflictDoUpdate({
                target: studentsLocal.id,
                set: {
                    name: s.name,
                    grade: s.grade,
                    classId: s.classId
                }
            });
        }

        console.log(`Synced: 1 school, ${classesRes.length} classes, ${studentsRes.length} students`);

    } catch (e) {
        console.error('SYNC PULL ERROR:', e);
        throw e;
    }
};

// Push all unsynced attendance records with teacher name
export const syncPushAttendance = async () => {
    try {
        console.log('Starting attendance sync...');

        // Get all unsynced attendance records
        const unsynced = await localDb.select().from(attendanceLocal).where(eq(attendanceLocal.synced, 'false'));
        console.log(`Found ${unsynced.length} unsynced records`);

        if (unsynced.length === 0) {
            console.log('No unsynced records to push');
            return { success: true, pushed: 0 };
        }

        // Group records by class to efficiently get teacher names
        const recordsByClass: Record<string, typeof unsynced> = {};
        unsynced.forEach(record => {
            if (!recordsByClass[record.classId]) {
                recordsByClass[record.classId] = [];
            }
            recordsByClass[record.classId].push(record);
        });

        let pushedCount = 0;

        // Process each class separately
        for (const classId of Object.keys(recordsByClass)) {
            const classRecords = recordsByClass[classId];

            // Get the school ID for this class
            const classInfo = await localDb.select().from(classesLocal).where(eq(classesLocal.id, classId)).limit(1);
            if (classInfo.length === 0) {
                console.warn(`Could not find class with ID: ${classId}`);
                continue;
            }

            const schoolId = classInfo[0].schoolId;

            // Get teacher name for this school
            let teacherName = null;
            try {
                const teacherRecords = await localDb
                    .select()
                    .from(teachersLocal)
                    .where(eq(teachersLocal.schoolId, schoolId))
                    .limit(1);

                if (teacherRecords.length > 0) {
                    teacherName = teacherRecords[0].name;
                }
            } catch (err) {
                console.warn('Could not get teacher name:', err);
            }

            // Prepare records with teacher name for this class
            const recordsWithTeacher = classRecords.map(record => ({
                ...record,
                teacherName
            }));

            // Push to API
            try {
                // Process each record individually using markAttendance
                for (const record of recordsWithTeacher) {
                    await api.markAttendance(
                        record.studentId,
                        record.classId,
                        record.date,
                        record.status as any,
                        record.teacherName || undefined
                    );
                }
                console.log(`Pushed ${classRecords.length} records for class ${classId} with teacher: ${teacherName}`);
                pushedCount += classRecords.length;
            } catch (err) {
                console.error(`Failed to push records for class ${classId}:`, err);
                // Continue with other classes even if one fails
            }
        }

        // Mark all successfully pushed records as synced
        // In a production app, you might want to be more selective about this
        for (const record of unsynced) {
            try {
                await localDb.update(attendanceLocal)
                    .set({ synced: 'true' })
                    .where(eq(attendanceLocal.id, record.id));
            } catch (err) {
                console.warn(`Failed to mark record ${record.id} as synced:`, err);
            }
        }

        console.log(`Successfully pushed ${pushedCount} attendance records`);
        return { success: true, pushed: pushedCount };
    } catch (err) {
        console.error('Fatal error during attendance sync:', err);
        return { success: false, error: (err as Error).message };
    }
};