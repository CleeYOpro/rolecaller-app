import { AttendanceStatus, Class, School, Student } from '@/constants/types';
import { db } from '@/database/client';
import { attendance, classes, schools, students } from '@/database/schema';
import { and, eq } from 'drizzle-orm';

// Serverless: Direct database access via Neon HTTP
export const api = {
    // Schools
    getSchools: async (): Promise<School[]> => {
        try {
            const result = await db.select({
                id: schools.id,
                name: schools.name,
                email: schools.email,
                address: schools.address,
            }).from(schools);
            return result as School[];
        } catch (err) {
            console.error('Failed to fetch schools:', err);
            throw new Error('Failed to fetch schools');
        }
    },

    login: async (email: string, password: string): Promise<School> => {
        try {
            const result = await db.select({
                id: schools.id,
                name: schools.name,
                email: schools.email,
                address: schools.address,
                password: schools.password,
            }).from(schools).where(eq(schools.email, email)).limit(1);

            if (result.length === 0) {
                throw new Error('School not found');
            }

            const school = result[0];
            if (school.password !== password) {
                throw new Error('Invalid password');
            }

            // Don't return password
            const { password: _, ...schoolWithoutPassword } = school;
            return schoolWithoutPassword as School;
        } catch (err) {
            console.error('Login error:', err);
            throw err instanceof Error ? err : new Error('Login failed');
        }
    },

    // Classes
    getClasses: async (schoolId: string): Promise<Class[]> => {
        try {
            const result = await db.select({
                id: classes.id,
                name: classes.name,
                schoolId: classes.schoolId,
            }).from(classes).where(eq(classes.schoolId, schoolId));
            return result;
        } catch (err) {
            console.error('Failed to fetch classes:', err);
            throw new Error('Failed to fetch classes');
        }
    },

    addClass: async (name: string, schoolId: string): Promise<Class> => {
        try {
            // Generate a 5-digit class ID
            const classId = Math.floor(10000 + Math.random() * 90000).toString();
            
            const result = await db.insert(classes).values({
                id: classId,
                name,
                schoolId,
            }).returning();
            return result[0];
        } catch (err) {
            console.error('Failed to add class:', err);
            throw new Error('Failed to add class');
        }
    },

    deleteClass: async (id: string): Promise<void> => {
        try {
            await db.delete(classes).where(eq(classes.id, id));
        } catch (err) {
            console.error('Failed to delete class:', err);
            throw new Error('Failed to delete class');
        }
    },

    // Students
    getStudents: async (schoolId: string, classId?: string): Promise<Student[]> => {
        try {
            let conditions = eq(students.schoolId, schoolId);
            if (classId) {
                conditions = and(eq(students.schoolId, schoolId), eq(students.classId, classId))!;
            }
            
            const result = await db.select({
                id: students.id,
                name: students.name,
                classId: students.classId,
                schoolId: students.schoolId,
                grade: students.grade,
            }).from(students).where(conditions);
            
            return result.map(s => ({
                id: s.id,
                name: s.name,
                classId: s.classId,
                schoolId: s.schoolId,
                grade: s.grade,
            }));
        } catch (err) {
            console.error('Failed to fetch students:', err);
            throw new Error('Failed to fetch students');
        }
    },

    addStudent: async (student: Student): Promise<Student> => {
        try {
            const result = await db.insert(students).values({
                name: student.name,
                classId: student.classId!,
                schoolId: student.schoolId,
                grade: student.grade || '',
            }).returning();
            return result[0];
        } catch (err) {
            console.error('Failed to add student:', err);
            throw err instanceof Error ? err : new Error('Failed to add student');
        }
    },

    uploadStudents: async (studentsList: any[]): Promise<void> => {
        try {
            for (const s of studentsList) {
                let classId = s.classId;
                
                // Create class if it doesn't exist
                if (s.class && !classId) {
                    const existingClass = await db.select().from(classes)
                        .where(and(eq(classes.schoolId, s.schoolId), eq(classes.name, s.class)))
                        .limit(1);
                    
                    if (existingClass.length > 0) {
                        classId = existingClass[0].id;
                    } else {
                        // Generate a 5-digit class ID
                        const newClassId = Math.floor(10000 + Math.random() * 90000).toString();
                        const newClass = await db.insert(classes).values({
                            id: newClassId,
                            name: s.class,
                            schoolId: s.schoolId,
                        }).returning();
                        classId = newClass[0].id;
                    }
                }
                
                await db.insert(students).values({
                    name: s.name,
                    classId: classId,
                    schoolId: s.schoolId,
                    grade: s.grade || s.standard || '',
                });
            }
        } catch (err) {
            console.error('Bulk upload error:', err);
            throw err instanceof Error ? err : new Error('Bulk upload failed');
        }
    },

    updateStudent: async (student: Student): Promise<void> => {
        try {
            await db.update(students)
                .set({
                    name: student.name,
                    classId: student.classId,
                    schoolId: student.schoolId,
                    grade: student.grade,
                })
                .where(eq(students.id, student.id));
        } catch (err) {
            console.error('Failed to update student:', err);
            throw new Error('Update failed');
        }
    },

    deleteStudent: async (id: string): Promise<void> => {
        try {
            await db.delete(students).where(eq(students.id, id));
        } catch (err) {
            console.error('Failed to delete student:', err);
            throw new Error('Failed to delete student');
        }
    },

    // Attendance
    getAttendance: async (classId: string, date: string): Promise<Record<string, AttendanceStatus>> => {
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
            throw new Error('Failed to fetch attendance');
        }
    },

    getAllAttendance: async (classId: string): Promise<Record<string, Record<string, AttendanceStatus>>> => {
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
            throw new Error('Failed to fetch all attendance');
        }
    },

    markAttendance: async (studentId: string, classId: string, date: string, status: AttendanceStatus): Promise<void> => {
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
        } catch (err) {
            console.error('Failed to mark attendance:', err);
            throw err instanceof Error ? err : new Error('Failed to mark attendance');
        }
    }
};
