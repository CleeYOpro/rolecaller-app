-- Handle the conversion from text to UUID for class_id columns
-- We need to use USING clause to specify how to convert the data

-- For students table
ALTER TABLE students 
ALTER COLUMN class_id TYPE uuid USING class_id::uuid;

-- For attendance table
ALTER TABLE attendance 
ALTER COLUMN class_id TYPE uuid USING class_id::uuid;