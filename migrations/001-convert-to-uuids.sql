-- Since we're changing the primary key types, we need to recreate the tables
-- First, drop foreign key constraints
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_student_id_students_id_fk;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_class_id_classes_id_fk;
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_class_id_classes_id_fk;
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_school_id_schools_id_fk;
ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_school_id_schools_id_fk;

-- Drop tables in the correct order
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS classes;
DROP TABLE IF EXISTS schools;

-- Recreate tables with proper UUID types
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"address" text,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL REFERENCES schools(id),
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL REFERENCES classes(id),
	"school_id" uuid NOT NULL REFERENCES schools(id),
	"name" text NOT NULL,
	"grade" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL REFERENCES students(id),
	"class_id" uuid NOT NULL REFERENCES classes(id),
	"status" "attendance_status" NOT NULL,
	"date" date NOT NULL,
	"updated_at" timestamp DEFAULT now(),
    UNIQUE(student_id, date)
);