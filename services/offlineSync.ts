// services/offlineSync.ts
import { db } from '@/database/client'; // Your Neon DB
import { attendanceLocal, classesLocal, localDb, schoolsLocal, studentsLocal } from '@/database/localdb';
import * as schema from '@/database/schema'; // Your Postgres schema
import { eq, sql } from 'drizzle-orm';
import { storage } from './storage';

// 1. PULL: Download school data (classes + students) to SQLite
export const syncPullSchoolData = async (schoolId: string): Promise<void> => {
    if (!schoolId) throw new Error('School ID required for sync');

    try {
        console.log(`🔄 Pulling data for school ${schoolId}...`);

        // Clear old local data first (no duplicates)
        await localDb.delete(classesLocal).where(sql`1=1`);
        await localDb.delete(studentsLocal).where(sql`1=1`);

        // Fetch school details (for password/offline login)
        const school = await db.query.schools.findFirst({
            where: (schools, { eq }) => eq(schools.id, schoolId),
        });
        if (!school) throw new Error('School not found');

        // Insert school locally
        await localDb.insert(schoolsLocal).values({
            id: school.id,
            name: school.name,
            email: school.email,
            password: school.password, // Store for offline auth
            address: school.address || null,
            createdAt: school.createdAt?.toISOString() || new Date().toISOString(),
        });

        // Fetch and insert classes
        const classes = await db.query.classes.findMany({
            where: (classes, { eq }) => eq(classes.schoolId, schoolId),
        });
        if (classes.length > 0) {
            await localDb.insert(classesLocal).values(
                classes.map(c => ({
                    id: c.id,
                    schoolId: c.schoolId,
                    name: c.name,
                    createdAt: c.createdAt?.toISOString() || new Date().toISOString(),
                }))
            );
        }

        // Fetch and insert students
        const students = await db.query.students.findMany({
            where: (students, { eq }) => eq(students.schoolId, schoolId),
        });
        if (students.length > 0) {
            await localDb.insert(studentsLocal).values(
                students.map(s => ({
                    id: s.id,
                    classId: s.classId,
                    schoolId: s.schoolId,
                    name: s.name,
                    grade: s.grade,
                    createdAt: s.createdAt?.toISOString() || new Date().toISOString(),
                }))
            );
        }

        // Update last sync
        await storage.saveLastSync();
        console.log(`✅ Pulled ${classes.length} classes + ${students.length} students`);

    } catch (error) {
        console.error('❌ Pull sync failed:', error);
        throw error;
    }
};

// 2. PUSH: Upload unsynced attendance to Neon
export const syncPushAttendance = async (): Promise<{ success: number; errors: number }> => {
    try {
        console.log('📤 Pushing offline attendance...');

        // Get unsynced local attendance
        const unsynced = await localDb.select().from(attendanceLocal).where(eq(attendanceLocal.synced, 'false'));
        if (unsynced.length === 0) {
            console.log('Nothing to sync');
            return { success: 0, errors: 0 };
        }

        let success = 0;
        let errors = 0;

        for (const localAtt of unsynced) {
            try {
                // Check for conflict in Neon (unique studentId + date)
                const existing = await db.query.attendance.findFirst({
                    where: (att, { and, eq }) =>
                        and(eq(att.studentId, localAtt.studentId), eq(att.date, localAtt.date)),
                });

                if (existing) {
                    // Conflict: Update existing (or skip/logic as needed)
                    await db
                        .update(schema.attendance)
                        .set({
                            status: localAtt.status as any,
                            updatedAt: new Date()
                        })
                        .where(eq(schema.attendance.id, existing.id));
                    console.log(`🔄 Updated existing: ${localAtt.studentId} on ${localAtt.date}`);
                } else {
                    // No conflict: Insert new
                    await db.insert(schema.attendance).values({
                        studentId: localAtt.studentId,
                        classId: localAtt.classId,
                        status: localAtt.status as any,
                        date: localAtt.date,
                        updatedAt: new Date(localAtt.updatedAt),
                    });
                    console.log(`➕ Inserted new: ${localAtt.studentId} on ${localAtt.date}`);
                }

                // Mark as synced locally
                await localDb
                    .update(attendanceLocal)
                    .set({ synced: 'true' })
                    .where(eq(attendanceLocal.id, localAtt.id));

                success++;
            } catch (err) {
                console.error(`❌ Failed to sync ${localAtt.studentId}:`, err);
                errors++;
            }
        }

        console.log(`✅ Push complete: ${success} success, ${errors} errors`);
        return { success, errors };

    } catch (error) {
        console.error('❌ Push sync failed:', error);
        throw error;
    }
};