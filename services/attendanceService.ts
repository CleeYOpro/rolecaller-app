import { AttendanceStatus, Class, Student } from '@/constants/types';
import { attendanceLocal, classesLocal, generateUuid, localDb, schoolsLocal, studentsLocal, teachersLocal } from '@/database/localdb';
import { and, eq, sql } from 'drizzle-orm';
import { api } from './api';
import { syncPullSchoolData, syncPushAttendance } from './offlineSync';
import { storage } from './storage';

export const attendanceService = {
  // Download fresh data (only when user clicks button)
  downloadSchoolData: async (schoolId: string) => {
    await syncPullSchoolData(schoolId);
  },

  // Push offline attendance
  pushOfflineAttendance: async () => {
    return await syncPushAttendance();
  },

  // Always try local first → fallback to API only if local is empty
  getClasses: async (schoolId: string): Promise<Class[]> => {
    try {
      const local = await localDb.select().from(classesLocal).where(eq(classesLocal.schoolId, schoolId));
      if (local.length > 0) {
        return local.map(c => ({ id: c.id, schoolId: c.schoolId, name: c.name } as Class));
      }
    } catch (e) {
      console.warn('No local classes, falling back to API');
    }
    return await api.getClasses(schoolId);
  },

  // Get All Students across all classes (via API)
  getAllStudents: async (schoolId: string): Promise<Student[]> => {
    try {
      // Get all students by not passing a specific classId
      return await api.getStudents(schoolId);
    } catch (e) {
      console.error('Failed to fetch all students from API', e);
      return [];
    }
  },

  getStudents: async (schoolId: string, classId: string): Promise<Student[]> => {
    try {
      const local = await localDb.select().from(studentsLocal)
        .where(and(eq(studentsLocal.schoolId, schoolId), eq(studentsLocal.classId, classId)));
      if (local.length > 0) {
        return local.map(s => ({ id: s.id, classId: s.classId, schoolId: s.schoolId, name: s.name, grade: s.grade } as Student));
      }
    } catch (e) {
      console.warn('No local students, falling back');
    }
    return await api.getStudents(schoolId, classId);
  },

  // ALWAYS save to SQLite — never to Neon directly
  markAttendance: async (studentId: string, classId: string, date: string, status: AttendanceStatus) => {
    try {
      // Get the school ID for this class
      const classRecords = await localDb.select().from(classesLocal).where(eq(classesLocal.id, classId)).limit(1);
      let schoolId = '';
      if (classRecords.length > 0) {
        schoolId = classRecords[0].schoolId;
      }

      const existing = await localDb.select()
        .from(attendanceLocal)
        .where(and(eq(attendanceLocal.studentId, studentId), eq(attendanceLocal.date, date)));

      if (existing.length > 0) {
        await localDb.update(attendanceLocal)
          .set({
            status,
            updatedAt: new Date().toISOString(),
            synced: 'false'   // ← ALWAYS false until sync button is pressed
          })
          .where(eq(attendanceLocal.id, existing[0].id));
      } else {
        await localDb.insert(attendanceLocal).values({
          id: generateUuid(),
          studentId,
          classId,
          status,
          date,
          updatedAt: new Date().toISOString(),
          synced: 'false'   // ← ALWAYS false
        });
      }

      // Optional: show toast that it's queued
      console.log('Attendance saved offline — will sync when you press Push & Pull');
      console.log('Attendance saved to SQLite — synced: false');
    } catch (err: any) {
      console.error('MARK ATTENDANCE ERROR:', err);
      throw new Error(err.message || 'Failed to save attendance');
    }
  },

  // Get attendance — local unsynced first
  getAttendance: async (classId: string, date: string): Promise<Record<string, AttendanceStatus>> => {
    try {
      const local = await localDb.select().from(attendanceLocal)
        .where(and(eq(attendanceLocal.classId, classId), eq(attendanceLocal.date, date)));

      if (local.length > 0) {
        const map: Record<string, AttendanceStatus> = {};
        local.forEach(a => { map[a.studentId] = a.status as AttendanceStatus; });
        return map;
      }
    } catch (e) { /* ignore */ }

    // Only fallback to API if nothing local
    return await api.getAttendance(classId, date);
  },

  // For login screen: does user have offline data?
  hasOfflineData: async (): Promise<boolean> => {
    const saved = await storage.getSchool();
    if (!saved) return false;
    try {
      const result = await localDb.select().from(schoolsLocal).where(eq(schoolsLocal.id, saved.id)).limit(1);
      return result.length > 0;
    } catch {
      return false;
    }
  },

  getUnsyncedCount: async (): Promise<number> => {
    try {
      const result = await localDb.select({ count: sql<number>`count(*)` })
        .from(attendanceLocal)
        .where(eq(attendanceLocal.synced, 'false'));
      return result[0]?.count || 0;
    } catch (err) {
      console.error('Failed to get unsynced count:', err);
      return 0;
    }
  },

  // Save teacher name 
  saveTeacherName: async (schoolId: string, teacherName: string) => {
    try {
      // Check if a teacher name exists for this school
      const existing = await localDb.select()
        .from(teachersLocal)
        .where(eq(teachersLocal.schoolId, schoolId))
        .limit(1);

      if (existing.length > 0) {
        // Update existing record
        await localDb.update(teachersLocal)
          .set({
            name: teacherName,
            createdAt: new Date().toISOString()
          })
          .where(eq(teachersLocal.schoolId, schoolId));
        console.log(`Teacher name updated: ${teacherName}`);
      } else {
        // Insert new record
        const teacherId = generateUuid();
        await localDb.insert(teachersLocal).values({
          id: teacherId,
          schoolId,
          name: teacherName,
          createdAt: new Date().toISOString()
        });
        console.log(`Teacher name saved with ID ${teacherId}: ${teacherName}`);
      }
    } catch (err) {
      console.error('Failed to save teacher name:', err);
    }
  },

  // Get teacher name 
  getTeacherName: async (schoolId: string): Promise<string | null> => {
    try {
      const result = await localDb.select()
        .from(teachersLocal)
        .where(eq(teachersLocal.schoolId, schoolId))
        .limit(1);

      if (result.length > 0) {
        console.log(`Retrieved teacher name: ${result[0].name}`);
        return result[0].name;
      }
      console.log(`No teacher name found for school ${schoolId}`);
      return null;
    } catch (err) {
      console.error('Failed to get teacher name:', err);
      return null;
    }
  }
};