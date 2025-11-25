import { AttendanceStatus, Class, Student } from '@/constants/types';
import { api } from './api';
import { storage } from './storage';

export const attendanceService = {
    // Initialize Database (No-op for serverless)
    init: async () => {
        console.log('API service initialized');
    },

    // Sync Data: Neon -> API (No-op, data is always from API)
    syncDataFromNeon: async (schoolId: string) => {
        console.log('Data is always synced via API');
    },

    // Get Classes (via API)
    getClasses: async (schoolId: string): Promise<Class[]> => {
        try {
            return await api.getClasses(schoolId);
        } catch (e) {
            console.error('Failed to fetch classes from API', e);
            return [];
        }
    },

    // Get Students (via API)
    getStudents: async (schoolId: string, classId: string): Promise<Student[]> => {
        try {
            return await api.getStudents(schoolId, classId);
        } catch (e) {
            console.error('Failed to fetch students from API', e);
            return [];
        }
    },

    // Mark Attendance (via API - pushes to Neon DB)
    markAttendance: async (
        studentId: string,
        classId: string,
        date: string,
        status: AttendanceStatus
    ) => {
        try {
            await api.markAttendance(studentId, classId, date, status);
            console.log(`Attendance marked for ${studentId}: ${status}`);
        } catch (e) {
            console.error('Failed to mark attendance via API', e);
            throw e;
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
