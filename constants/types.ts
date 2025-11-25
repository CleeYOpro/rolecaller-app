export type AttendanceStatus = "present" | "absent" | "late";

export type Student = {
    id: string;
    name: string;
    grade?: string;
    classId?: string;
    schoolId: string;
};

export type School = {
    id: string;
    name: string;
    email: string;
    password?: string;
};

export type Class = {
    id: string;
    name: string;
    schoolId: string;
};

export type ClassAssignments = Record<string, string[]>; // classId -> [studentId]

export type AttendanceMap = Record<
    string, // classId
    Record<
        string, // YYYY-MM-DD date
        Record<string, AttendanceStatus> // studentId -> status
    >
>;
