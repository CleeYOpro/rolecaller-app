// database/localdb.ts  ← 100% WORKING IN 2025
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import * as SQLite from 'expo-sqlite';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

// THIS LINE IS CRITICAL — open with sync driver
const expoDb = SQLite.openDatabaseSync('rolecaller_local.db');

// THIS IS THE FIX — manually create tables ONCE at startup
expoDb.execSync(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS schools_local (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    password TEXT NOT NULL,
    address TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS classes_local (
    id TEXT PRIMARY KEY NOT NULL,
    school_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS students_local (
    id TEXT PRIMARY KEY NOT NULL,
    class_id TEXT NOT NULL,
    school_id TEXT NOT NULL,
    name TEXT NOT NULL,
    grade TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS attendance_local (
    id TEXT PRIMARY KEY NOT NULL,
    student_id TEXT NOT NULL,
    class_id TEXT NOT NULL,
    status TEXT NOT NULL,
    date TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    synced TEXT NOT NULL DEFAULT 'false',
    teacher_name TEXT
  );

  -- New table for teacher information
  CREATE TABLE IF NOT EXISTS teachers_local (
    id TEXT PRIMARY KEY NOT NULL,
    school_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_students_school ON students_local (school_id);
  CREATE INDEX IF NOT EXISTS idx_students_class ON students_local (class_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique ON attendance_local (student_id, date);
`);

console.log('Local SQLite tables created successfully on device');

export const localDb = drizzle(expoDb);

// Schema for Drizzle queries (must match above)
export const schoolsLocal = sqliteTable('schools_local', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    password: text('password').notNull(),
    address: text('address'),
    createdAt: text('created_at').notNull(),
});

export const classesLocal = sqliteTable('classes_local', {
    id: text('id').primaryKey(),
    schoolId: text('school_id').notNull(),
    name: text('name').notNull(),
    createdAt: text('created_at').notNull(),
});

export const studentsLocal = sqliteTable('students_local', {
    id: text('id').primaryKey(),
    classId: text('class_id').notNull(),
    schoolId: text('school_id').notNull(),
    name: text('name').notNull(),
    grade: text('grade').notNull(),
    createdAt: text('created_at').notNull(),
}, (t) => [
    index('idx_students_school').on(t.schoolId),
    index('idx_students_class').on(t.classId),
]);


export const attendanceLocal = sqliteTable('attendance_local', {
    id: text('id').primaryKey(),
    studentId: text('student_id').notNull(),
    classId: text('class_id').notNull(),
    status: text('status').notNull(),
    date: text('date').notNull(),
    updatedAt: text('updated_at').notNull(),
    synced: text('synced').notNull().default('false'),
    teacherName: text('teacher_name'),
}, (t) => [
    index('idx_attendance_unique').on(t.studentId, t.date),
]);

// New table for teacher information
export const teachersLocal = sqliteTable('teachers_local', {
    id: text('id').primaryKey(),
    schoolId: text('school_id').notNull(),
    name: text('name').notNull(),
    createdAt: text('created_at').notNull(),
});

export const generateUuid = () => uuidv4();