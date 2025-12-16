import { School } from '@/constants/types';
import { db } from '@/database/client';
import { attendanceLocal, classesLocal, localDb, schoolsLocal, studentsLocal, teachersLocal } from '@/database/localdb';
import { classes, schools, students } from '@/database/schema';
import { eq, sql } from 'drizzle-orm';
import { api } from './api';

// New function to sync ALL schools (credentials) to local DB
export const syncSchoolsToLocal = async (schoolsData: School[]) => {
    console.log(`Syncing ${schoolsData.length} schools to local DB...`);
    try {
        for (const s of schoolsData) {
            await localDb.insert(schoolsLocal).values({
                id: s.id,
                name: s.name,
                email: s.email,
                password: s.password || '', // Password might be missing if typing is strict, but API provides it now
                address: s.address,
                createdAt: new Date().toISOString(), // We don't have this from API getSchools but it's fine
            }).onConflictDoUpdate({
                target: schoolsLocal.id,
                set: {
                    name: s.name,
                    email: s.email,
                    password: s.password || '',
                    address: s.address,
                }
            });
        }
        console.log('Schools synced successfully');
    } catch (err) {
        console.error('Failed to sync schools locally:', err);
    }
};

export const syncPullSchoolData = async (schoolId: string) => {
    console.log('Starting sync pull for school:', schoolId);

    try {
        // 1. Clear existing local data for all tables to ensure proper school isolation
        // NOTE: We do NOT clear schoolsLocal here anymore, because we want to keep
        // credentials for other schools available for offline login.
        // Schools are managed by syncSchoolsToLocal or updated individually.
        // We also do NOT clear teachersLocal as it contains device-wide teacher info.
        // We also do NOT clear attendanceLocal as it may contain unsynced attendance data.

        await localDb.delete(classesLocal).where(sql`1=1`);
        await localDb.delete(studentsLocal).where(sql`1=1`);
        // await localDb.delete(schoolsLocal).where(sql`1=1`); <--- REMOVED
        // await localDb.delete(teachersLocal).where(sql`1=1`); <--- REMOVED
        // await localDb.delete(attendanceLocal).where(sql`1=1`); <--- REMOVED

        // 2. Fetch from Neon
        const schoolRes = await db.select().from(schools).where(eq(schools.id, schoolId));
        const classesRes = await db.select().from(classes).where(eq(classes.schoolId, schoolId));
        const studentsRes = await db.select().from(students).where(eq(students.schoolId, schoolId));

        if (schoolRes.length === 0) {
            console.error('School not found online');
            return;
        }

        const school = schoolRes[0];

        // 3. Save to SQLite
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

        // Get teacher name from local database (any teacher name, not specific to school)
        let teacherName = null;
        try {
            // Get any teacher from the local database
            const localTeacherRecords = await localDb
                .select()
                .from(teachersLocal)
                .limit(1);

            if (localTeacherRecords.length > 0) {
                teacherName = localTeacherRecords[0].name;
                console.log(`Using local teacher name: ${teacherName}`);
            }
        } catch (err) {
            console.warn('Could not get local teacher name:', err);
        }

        // Process each class separately
        for (const classId of Object.keys(recordsByClass)) {
            const classRecords = recordsByClass[classId];

            // Push to API
            try {
                // Process each record individually using markAttendance
                for (const record of classRecords) {
                    await api.markAttendance(
                        record.studentId,
                        record.classId,
                        record.date,
                        record.status as any,
                        teacherName || undefined
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