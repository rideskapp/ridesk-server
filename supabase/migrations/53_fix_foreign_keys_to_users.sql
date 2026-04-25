-- ============================================================================
-- Migration: 99_fix_foreign_keys_to_users.sql
-- Description: Fix foreign key constraints to reference users table instead of separate students/instructors tables
-- Created: 2025-01-20
-- ============================================================================

-- DROP TRIGGER IF EXISTS trigger_update_instructor_schools_updated_at ON instructor_schools;
-- DROP POLICY IF EXISTS "Service role full access to instructor_schools" ON instructor_schools;
-- DROP POLICY IF EXISTS "Instructors can view their school assignments" ON instructor_schools;
-- DROP POLICY IF EXISTS "School admins can manage their school instructors" ON instructor_schools;

-- Drop existing foreign key constraints
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_student_id_fkey;
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_instructor_id_fkey;
ALTER TABLE lesson_participants DROP CONSTRAINT IF EXISTS lesson_participants_student_id_fkey;

-- Add new foreign key constraints pointing to users table
ALTER TABLE lessons
ADD CONSTRAINT lessons_student_id_fkey
FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE lessons
ADD CONSTRAINT lessons_instructor_id_fkey
FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE lesson_participants
ADD CONSTRAINT lesson_participants_student_id_fkey
FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;

-- Update the instructor_schools table to reference users instead of instructors
ALTER TABLE instructor_schools DROP CONSTRAINT IF EXISTS instructor_schools_instructor_id_fkey;
ALTER TABLE instructor_schools
ADD CONSTRAINT instructor_schools_instructor_id_fkey
FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE;

-- Update instructor_availability table to reference users instead of instructors
ALTER TABLE instructor_availability DROP CONSTRAINT IF EXISTS instructor_availability_instructor_id_fkey;
ALTER TABLE instructor_availability
ADD CONSTRAINT instructor_availability_instructor_id_fkey
FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE;
