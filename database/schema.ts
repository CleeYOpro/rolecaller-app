import { date, integer, pgEnum, pgTable, text, timestamp, uuid, unique } from 'drizzle-orm/pg-core';

export const attendanceStatusEnum = pgEnum('attendance_status', ['present', 'absent', 'late']);

export const schools = pgTable('schools', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    password: text('password').notNull(),
    address: text('address'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const classes = pgTable('classes', {
    id: uuid('id').primaryKey().defaultRandom(), // UUID for class IDs
    schoolId: uuid('school_id').references(() => schools.id).notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
});

export const students = pgTable('students', {
    id: uuid('id').primaryKey().defaultRandom(),
    classId: uuid('class_id').references(() => classes.id).notNull(), // UUID reference to classes
    schoolId: uuid('school_id').references(() => schools.id).notNull(),
    name: text('name').notNull(),
    grade: text('grade').notNull(), // Changed from roll_number to grade
    createdAt: timestamp('created_at').defaultNow(),
});

export const attendance = pgTable('attendance', {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id').references(() => students.id).notNull(),
    classId: uuid('class_id').references(() => classes.id).notNull(), // UUID reference to classes
    status: attendanceStatusEnum('status').notNull(),
    date: date('date').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
    teacherName: text('teacher_name'),
}, (table) => ({
    uniqueStudentDate: unique().on(table.studentId, table.date),
}));