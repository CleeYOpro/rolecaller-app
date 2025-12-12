import { AttendanceStatus, Class, School, Student } from '@/constants/types';
import { db } from '@/database/client';
import { attendance, classes, schools, students } from '@/database/schema';
import { isOnline } from '@/utils/connectivity';
import { and, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// Serverless: Direct database access via Neon HTTP
export const api = {
    // Schools
    getSchools: async (): Promise<School[]> => {
        const online = await isOnline();
        if (!online) throw new Error('No internet connection');
        try {
            console.log('Fetching schools from database...');
            const result = await db.select({
                id: schools.id,
                name: schools.name,
                email: schools.email,
                address: schools.address,
            }).from(schools);
            console.log('Successfully fetched schools:', result);
            return result.map(school => ({
                id: school.id,
                name: school.name,
                email: school.email,
                address: school.address
            }));
        } catch (err) {
            console.error('Failed to fetch schools:', err);
            throw new Error('Failed to fetch schools: ' + (err as Error).message);
        }
    },

    login: async (email: string, password: string): Promise<School> => {
        const online = await isOnline();
        if (!online) throw new Error('No internet connection');
        try {
            console.log(`Attempting login with email: ${email}`);
            const result = await db.select({
                id: schools.id,
                name: schools.name,
                email: schools.email,
                address: schools.address,
                password: schools.password,
            }).from(schools).where(eq(schools.email, email)).limit(1);

            if (result.length === 0) {
                console.log('No school found with email:', email);
                throw new Error('School not found');
            }

            const school = result[0];
            console.log('Found school:', school.name);

            if (school.password !== password) {
                console.log('Invalid password provided for school:', school.name);
                throw new Error('Invalid password');
            }

            // Don't return password
            const { password: _, ...schoolWithoutPassword } = school;
            console.log('Login successful for school:', school.name);
            return schoolWithoutPassword as School;
        } catch (err) {
            console.error('Login error:', err);
            throw err instanceof Error ? err : new Error('Login failed: ' + (err as Error).message);
        }
    },

    // Classes
    getClasses: async (schoolId: string): Promise<Class[]> => {
        const online = await isOnline();
        if (!online) throw new Error('No internet connection');
        try {
            console.log(`Fetching classes for schoolId: ${schoolId}`);
            const result = await db.select({
                id: classes.id,
                name: classes.name,
                schoolId: classes.schoolId,
            }).from(classes).where(eq(classes.schoolId, schoolId));

            console.log(`Successfully fetched ${result.length} classes`);
            return result as Class[];
        } catch (err) {
            console.error('Failed to fetch classes:', err);
            throw new Error('Failed to fetch classes: ' + (err as Error).message);
        }
    },

    addClass: async (name: string, schoolId: string): Promise<Class> => {
        const online = await isOnline();
        if (!online) throw new Error('No internet connection');
        try {
            console.log(`Adding class "${name}" to schoolId: ${schoolId}`);
            const result = await db.insert(classes).values({
                name,
                schoolId,
            }).returning();

            console.log('Successfully added class:', result[0]);
            return result[0] as Class;
        } catch (err) {
            console.error('Failed to add class:', err);
            throw new Error('Failed to add class: ' + (err as Error).message);
        }
    },

    deleteClass: async (id: string): Promise<void> => {
        const online = await isOnline();
        if (!online) throw new Error('No internet connection');
        try {
            console.log(`Deleting class with id: ${id}`);
            await db.delete(classes).where(eq(classes.id, id));
            console.log('Successfully deleted class');
        } catch (err) {
            console.error('Failed to delete class:', err);
            throw new Error('Failed to delete class: ' + (err as Error).message);
        }
    },

    // Students
    getStudents: async (schoolId: string, classId?: string): Promise<Student[]> => {
        const online = await isOnline();
        if (!online) throw new Error('No internet connection');
        try {
            console.log(`Fetching students for schoolId: ${schoolId}${classId ? `, classId: ${classId}` : ''}`);
            console.log(`Fetching students for schoolId: ${schoolId}${classId ? `, classId: ${classId}` : ''}`);

            const whereCondition = classId
                ? and(eq(students.schoolId, schoolId), eq(students.classId, classId))
                : eq(students.schoolId, schoolId);

            const result = await db.select({
                id: students.id,
                name: students.name,
                grade: students.grade,
                classId: students.classId,
                schoolId: students.schoolId,
            }).from(students).where(whereCondition);

            console.log(`Successfully fetched ${result.length} students`);
            return result as Student[];
        } catch (err) {
            console.error('Failed to fetch students:', err);
            throw new Error('Failed to fetch students: ' + (err as Error).message);
        }
    },

    addStudent: async (student: Omit<Student, 'id'> & { id: string }): Promise<void> => {
        const online = await isOnline();
        if (!online) throw new Error('No internet connection');
        try {
            if (!student.classId) throw new Error("Class ID is required for new students");

            console.log(`Adding student "${student.name}" to classId: ${student.classId}`);
            await db.insert(students).values({
                id: student.id,
                name: student.name,
                schoolId: student.schoolId,
                classId: student.classId,
                grade: student.grade || '',
            });
            console.log('Successfully added student');
        } catch (err) {
            console.error('Failed to add student:', err);
            throw new Error('Failed to add student: ' + (err as Error).message);
        }
    },

    uploadStudents: async (studentData: any[]): Promise<void> => {
        const online = await isOnline();
        if (!online) throw new Error('No internet connection');
        try {
            console.log(`Uploading ${studentData.length} students`);

            for (const s of studentData) {
                // Create class if it doesn't exist
                let classId = s.classId;
                if (s.class && !classId) {
                    const existingClass = await db.select().from(classes)
                        .where(and(eq(classes.schoolId, s.schoolId), eq(classes.name, s.class)))
                        .limit(1);

                    if (existingClass.length > 0) {
                        classId = existingClass[0].id;
                    } else {
                        // Create new class
                        const newClass = await db.insert(classes).values({
                            name: s.class,
                            schoolId: s.schoolId,
                        }).returning();
                        classId = newClass[0].id;
                    }
                }

                // Generate proper UUID for student if not provided
                const studentId = s.id || uuidv4();

                await db.insert(students).values({
                    id: studentId,
                    name: s.name,
                    classId: classId,
                    schoolId: s.schoolId,
                    grade: s.grade || s.standard || '',
                });
            }
        } catch (err) {
            console.error('Bulk upload error:', err);
            throw err instanceof Error ? err : new Error('Bulk upload failed: ' + (err as Error).message);
        }
    },

    updateStudent: async (student: Student): Promise<void> => {
        const online = await isOnline();
        if (!online) throw new Error('No internet connection');
        try {
            if (!student.classId) throw new Error("Class ID is required for updating student");

            await db.update(students)
                .set({
                    name: student.name,
                    classId: student.classId,
                    schoolId: student.schoolId,
                    grade: student.grade || '',
                })
                .where(eq(students.id, student.id));
        } catch (err) {
            console.error('Failed to update student:', err);
            throw new Error('Update failed: ' + (err as Error).message);
        }
    },

    deleteStudent: async (id: string): Promise<void> => {
        const online = await isOnline();
        if (!online) throw new Error('No internet connection');
        try {
            await db.delete(students).where(eq(students.id, id));
        } catch (err) {
            console.error('Failed to delete student:', err);
            throw new Error('Failed to delete student: ' + (err as Error).message);
        }
    },

    // Attendance
    getAttendance: async (classId: string, date: string): Promise<Record<string, AttendanceStatus>> => {
        const online = await isOnline();
        if (!online) throw new Error('No internet connection');
        try {
            const result = await db.select({
                studentId: attendance.studentId,
                status: attendance.status,
            }).from(attendance)
                .where(and(eq(attendance.classId, classId), eq(attendance.date, date)));

            const map: Record<string, AttendanceStatus> = {};
            result.forEach(r => {
                map[r.studentId] = r.status as AttendanceStatus;
            });
            return map;
        } catch (err) {
            console.error('Failed to fetch attendance:', err);
            throw new Error('Failed to fetch attendance: ' + (err as Error).message);
        }
    },

    getAllAttendance: async (classId: string): Promise<Record<string, Record<string, AttendanceStatus>>> => {
        const online = await isOnline();
        if (!online) throw new Error('No internet connection');
        try {
            const result = await db.select({
                studentId: attendance.studentId,
                date: attendance.date,
                status: attendance.status,
            }).from(attendance).where(eq(attendance.classId, classId));

            const map: Record<string, Record<string, AttendanceStatus>> = {};
            result.forEach(r => {
                const dateStr = r.date.toString().split('T')[0];
                if (!map[dateStr]) map[dateStr] = {};
                map[dateStr][r.studentId] = r.status as AttendanceStatus;
            });
            return map;
        } catch (err) {
            console.error('Failed to fetch all attendance:', err);
            throw new Error('Failed to fetch all attendance: ' + (err as Error).message);
        }
    },

    markAttendance: async (
        studentId: string,
        classId: string,
        date: string,
        status: AttendanceStatus,
        teacherName?: string
    ): Promise<void> => {
        const online = await isOnline();
        if (!online) throw new Error('No internet connection');
        try {
            // Check if record exists
            const existing = await db.select().from(attendance)
                .where(and(
                    eq(attendance.studentId, studentId),
                    eq(attendance.classId, classId),
                    eq(attendance.date, date)
                )).limit(1);

            if (existing.length > 0) {
                // Update
                await db.update(attendance)
                    .set({ status, updatedAt: new Date(), teacherName })
                    .where(eq(attendance.id, existing[0].id as string));
            } else {
                // Insert
                await db.insert(attendance).values({
                    studentId,
                    classId,
                    date,
                    status,
                    teacherName,
                });
            }
        } catch (err) {
            console.error('Failed to mark attendance:', err);
            throw err instanceof Error ? err : new Error('Failed to mark attendance: ' + (err as Error).message);
        }
    }
};