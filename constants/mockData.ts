import { AttendanceMap, Class, ClassAssignments, School, Student } from './types';

export const MOCK_SCHOOLS: School[] = [
    { id: 'school-1', name: 'Greenwood High', email: 'admin@greenwood.edu' },
    { id: 'school-2', name: 'Riverside Academy', email: 'admin@riverside.edu' },
];

export const MOCK_CLASSES: Class[] = [
    { id: 'class-1', name: 'Grade 5A', schoolId: 'school-1' },
    { id: 'class-2', name: 'Grade 10B', schoolId: 'school-1' },
];

export const MOCK_STUDENTS: Student[] = [
    { id: '10001', name: 'Alice Johnson', grade: '5', classId: 'class-1', schoolId: 'school-1' },
    { id: '10002', name: 'Bob Smith', grade: '5', classId: 'class-1', schoolId: 'school-1' },
    { id: '10003', name: 'Charlie Brown', grade: '10', classId: 'class-2', schoolId: 'school-1' },
];

export const MOCK_ASSIGNMENTS: ClassAssignments = {
    'class-1': ['10001', '10002'],
    'class-2': ['10003'],
};

export const MOCK_ATTENDANCE: AttendanceMap = {
    'class-1': {
        '2023-10-26': {
            '10001': 'present',
            '10002': 'absent',
        },
    },
};
