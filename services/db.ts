import { AttendanceStatus } from '@/constants/types';
import { db } from '@/database/client';
import { attendance, classes, schools, students } from '@/database/schema';
import { and, eq } from 'drizzle-orm';

export const dbService = {
    // Get Schools
    getSchools: async () => {
        return await db.select().from(schools);
    },

    // Get Classes
    getClasses: async (schoolId: string) => {
        return await db.select().from(classes).where(eq(classes.schoolId, schoolId));
    },

    // Get Students
    getStudents: async (classId: string) => {
        return await db.select().from(students).where(eq(students.classId, classId));
    },

    // Get Students by School
    getStudentsBySchool: async (schoolId: string, classId?: string) => {
        if (classId) {
            return await db.select().from(students).where(
                and(eq(students.schoolId, schoolId), eq(students.classId, classId))
            );
        }
        return await db.select().from(students).where(eq(students.schoolId, schoolId));
    },

    // Mark Attendance
    markAttendance: async (
        studentId: string,
        classId: string,
        date: string,
        status: AttendanceStatus
    ) => {
        // Check if record exists for this student, class, and date
        const existing = await db.select().from(attendance).where(
            and(
                eq(attendance.studentId, studentId),
                eq(attendance.classId, classId),
                eq(attendance.date, date)
            )
        );

        if (existing.length > 0) {
            // Update
            await db.update(attendance)
                .set({ status, updatedAt: new Date() })
                .where(eq(attendance.id, existing[0].id));
        } else {
            // Insert
            await db.insert(attendance).values({
                studentId,
                classId,
                date,
                status,
            });
        }
    },

    // Get Attendance
    getAttendance: async (classId: string, date: string) => {
        const records = await db
            .select()
            .from(attendance)
            .where(and(eq(attendance.classId, classId), eq(attendance.date, date)));

        // Convert to Record<studentId, status>
        const result: Record<string, AttendanceStatus> = {};
        records.forEach((r) => {
            result[r.studentId] = r.status as AttendanceStatus;
        });
        return result;
    },
};
