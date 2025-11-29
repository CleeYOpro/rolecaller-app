export type AttendanceStatus = "present" | "absent" | "late";

export type Student = {
    id: string;
    name: string;
    grade?: string;
    classId?: string; // This will now be a UUID
    schoolId: string;
};

export type School = {
    id: string;
    name: string;
    email: string;
    password?: string;
};

export type Class = {
    id: string; // This will now be a UUID
    name: string;
    schoolId: string;
};
// Add to constants/types.ts
export type AttendanceLocal = {
    id: string;
    studentId: string;
    classId: string;
    status: AttendanceStatus;
    date: string;
    updatedAt: string;
    synced: 'true' | 'false';
};

export type ClassAssignments = Record<string, string[]>; // classId -> [studentId]

export type AttendanceMap = Record<
    string, // classId (now UUID)
    Record<
        string, // YYYY-MM-DD date
        Record<string, AttendanceStatus> // studentId -> status
    >
>;