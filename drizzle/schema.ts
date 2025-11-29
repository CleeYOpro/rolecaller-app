import { pgTable, foreignKey, uuid, text, timestamp, unique, date, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const attendanceStatus = pgEnum("attendance_status", ['present', 'absent', 'late'])


export const students = pgTable("students", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	grade: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	schoolId: uuid("school_id").notNull(),
	classId: text("class_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.schoolId],
			foreignColumns: [schools.id],
			name: "students_school_id_schools_id_fk"
		}),
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "students_class_id_classes_id_fk"
		}),
]);

export const schools = pgTable("schools", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	password: text().notNull(),
	address: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const classes = pgTable("classes", {
	schoolId: uuid("school_id").notNull(),
	name: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	id: text().primaryKey().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.schoolId],
			foreignColumns: [schools.id],
			name: "classes_school_id_schools_id_fk"
		}),
]);

export const attendance = pgTable("attendance", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	studentId: uuid("student_id").notNull(),
	status: attendanceStatus().notNull(),
	date: date().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	classId: text("class_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [students.id],
			name: "attendance_student_id_students_id_fk"
		}),
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "attendance_class_id_classes_id_fk"
		}),
	unique("attendance_student_id_date_unique").on(table.studentId, table.date),
]);
