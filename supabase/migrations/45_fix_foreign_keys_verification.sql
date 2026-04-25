-- Verify and fix foreign key constraints
-- First, let's check what foreign keys exist
-- Drop any remaining foreign key constraints to instructors table
ALTER TABLE "public"."lessons" DROP CONSTRAINT IF EXISTS "lessons_instructor_id_fkey";

-- Add the correct foreign key constraint to users table
ALTER TABLE "public"."lessons" 
ADD CONSTRAINT "lessons_instructor_id_fkey" 
FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE;

-- Also fix other tables
ALTER TABLE "public"."instructor_availability" DROP CONSTRAINT IF EXISTS "instructor_availability_instructor_id_fkey";
ALTER TABLE "public"."instructor_availability" 
ADD CONSTRAINT "instructor_availability_instructor_id_fkey" 
FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE "public"."instructor_rates" DROP CONSTRAINT IF EXISTS "instructor_rates_instructor_id_fkey";
ALTER TABLE "public"."instructor_rates" 
ADD CONSTRAINT "instructor_rates_instructor_id_fkey" 
FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE "public"."student_notes" DROP CONSTRAINT IF EXISTS "student_notes_instructor_id_fkey";
ALTER TABLE "public"."student_notes" 
ADD CONSTRAINT "student_notes_instructor_id_fkey" 
FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE SET NULL;
