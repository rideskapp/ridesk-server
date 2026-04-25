-- ============================================================================
-- Migration: 94_restore_users_notes_for_instructors.sql
-- Description: Restore users.notes after migration 93 so instructor profile
--              notes/bio updates remain functional.
-- ============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN users.notes IS
  'Instructor profile notes/bio only; student school-scoped notes are stored on student_schools.notes.';
