ALTER TABLE "students" ADD COLUMN "school_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "grade" text NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN "roll_number";--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_id_date_unique" UNIQUE("student_id","date");