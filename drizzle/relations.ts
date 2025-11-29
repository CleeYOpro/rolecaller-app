import { relations } from "drizzle-orm/relations";
import { attendance, classes, schools, students } from "./schema";

export const studentsRelations = relations(students, ({ one, many }) => ({
	school: one(schools, {
		fields: [students.schoolId],
		references: [schools.id]
	}),
	class: one(classes, {
		fields: [students.classId],
		references: [classes.id]
	}),
	attendances: many(attendance),
}));

export const schoolsRelations = relations(schools, ({ many }) => ({
	students: many(students),
	classes: many(classes),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
	students: many(students),
	school: one(schools, {
		fields: [classes.schoolId],
		references: [schools.id]
	}),
	attendances: many(attendance),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
	student: one(students, {
		fields: [attendance.studentId],
		references: [students.id]
	}),
	class: one(classes, {
		fields: [attendance.classId],
		references: [classes.id]
	}),
}));