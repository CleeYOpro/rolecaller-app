import { db } from '@/database/client';
import { attendanceLocal, classesLocal, localDb, schoolsLocal, studentsLocal } from '@/database/localdb';
import { attendance, classes, schools, students } from '@/database/schema';
import { eq } from 'drizzle-orm';

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

export const syncPushAttendance = async (): Promise<{ success: number; errors: number }> => {
    const unsynced = await localDb
        .select()
        .from(attendanceLocal)
        .where(eq(attendanceLocal.synced, 'false'));

    if (unsynced.length === 0) {
        console.log('Nothing to sync');
        return { success: 0, errors: 0 };
    }

    let success = 0;
    let errors = 0;

    for (const att of unsynced) {
        try {
            await db.insert(attendance).values({
                studentId: att.studentId,
                classId: att.classId,
                date: att.date,
                status: att.status as "present" | "absent" | "late",
            }).onConflictDoUpdate({
                target: [attendance.studentId, attendance.classId, attendance.date], // ← FIXED
                set: {
                    status: att.status as "present" | "absent" | "late",
                    classId: att.classId,
                    updatedAt: new Date()
                },
            });

            await localDb.delete(attendanceLocal).where(eq(attendanceLocal.id, att.id));
            success++;
        } catch (err) {
            console.error('Failed to push attendance:', att.id, err);
            errors++;
        }
    }

    console.log(`Sync complete: ${success} succeeded, ${errors} failed`);
    return { success, errors };
};