import { AttendanceStatus, Class, Student } from '@/constants/types';
import { api } from './api';
import { storage } from './storage';
import { syncPullSchoolData } from './offlineSync';
import { localDb, schoolsLocal, classesLocal, studentsLocal, attendanceLocal, generateUuid } from '@/database/localdb';
import { eq, and } from 'drizzle-orm';

export const attendanceService = {
    // Initialize Database (No-op for serverless)
    init: async () => {
        console.log('API service initialized');
    },

    // Check if teacher has downloaded offline data
    hasOfflineData: async (): Promise<boolean> => {
        try {
            const savedSchool = await storage.getSchool();
            if (!savedSchool) return false;

            const localSchool = await localDb
                .select()
                .from(schoolsLocal)
                .where(eq(schoolsLocal.id, savedSchool.id))
                .limit(1);

            return localSchool.length > 0;
        } catch (e) {
            console.warn('Failed to check offline data', e);
            return false;
        }
    },

    // Download school data for offline use
    downloadSchoolData: async (schoolId: string) => {
      await syncPullSchoolData(schoolId);
    },

    // Sync Data: Neon -> API (No-op, data is always from API)
    syncDataFromNeon: async (schoolId: string) => {
        console.log('Data is always synced via API');
    },

    // Get Classes (via API)
    getClasses: async (schoolId: string): Promise<Class[]> => {
      const local = await localDb.select().from(classesLocal).where(eq(classesLocal.schoolId, schoolId));
      if (local.length > 0) {
        return local.map(c => ({ id: c.id, schoolId: c.schoolId, name: c.name } as Class));
      }
      return await api.getClasses(schoolId); // fallback if somehow empty
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

    // Get Students (via API)
    getStudents: async (schoolId: string, classId: string): Promise<Student[]> => {
      const local = await localDb.select().from(studentsLocal)
        .where(and(eq(studentsLocal.schoolId, schoolId), eq(studentsLocal.classId, classId)));
      if (local.length > 0) {
        return local.map(s => ({ id: s.id, classId: s.classId, schoolId: s.schoolId, name: s.name, grade: s.grade } as Student));
      }
      return await api.getStudents(schoolId, classId);
    },

    // Mark Attendance (via API - pushes to Neon DB)
    markAttendance: async (
      studentId: string,
      classId: string,
      date: string,
      status: AttendanceStatus
    ) => {
      const existing = await localDb.select().from(attendanceLocal)
        .where(and(eq(attendanceLocal.studentId, studentId), eq(attendanceLocal.date, date)));

      if (existing.length > 0) {
        await localDb.update(attendanceLocal)
          .set({ status, updatedAt: new Date().toISOString(), synced: 'false' })
          .where(eq(attendanceLocal.id, existing[0].id));
      } else {
        await localDb.insert(attendanceLocal).values({
          id: generateUuid(),
          studentId,
          classId,
          status,
          date,
          updatedAt: new Date().toISOString(),
          synced: 'false',
        });
      }
    },

    // Sync Attendance: No-op (data is always via API)
    syncAttendanceToNeon: async () => {
      console.log('Data is always synced via API');
    },

    // Get Attendance (via API)
    getAttendance: async (classId: string, date: string): Promise<Record<string, AttendanceStatus>> => {
        try {
            return await api.getAttendance(classId, date);
        } catch (e) {
            console.error('Failed to fetch attendance from API', e);
            return {};
        }
    },

    // Get Local School ID (from Storage)
    getLocalSchoolId: async () => {
        const school = await storage.getSchool();
        return school ? school.id : null;
    }
};