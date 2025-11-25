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
    id: text('id').primaryKey(), // 5-digit number
    schoolId: uuid('school_id').references(() => schools.id).notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
});

export const students = pgTable('students', {
    id: uuid('id').primaryKey().defaultRandom(),
    classId: text('class_id').references(() => classes.id).notNull(),
    schoolId: uuid('school_id').references(() => schools.id).notNull(),
    name: text('name').notNull(),
    grade: text('grade').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
});

export const attendance = pgTable('attendance', {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id').references(() => students.id).notNull(),
    classId: text('class_id').references(() => classes.id).notNull(),
    status: attendanceStatusEnum('status').notNull(),
    date: date('date').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
    uniqueStudentDate: unique().on(table.studentId, table.date),
}));
