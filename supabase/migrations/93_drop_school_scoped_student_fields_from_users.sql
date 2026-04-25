-- ============================================================================
-- Migration: 93_drop_school_scoped_student_fields_from_users.sql
-- Description: Remove student school-scoped profile fields from users table
--              after moving source of truth to student_schools
-- ============================================================================

ALTER TABLE users
  DROP COLUMN IF EXISTS skill_level,
  DROP COLUMN IF EXISTS preferred_disciplines,
  DROP COLUMN IF EXISTS primary_sport,
  DROP COLUMN IF EXISTS riding_background,
  DROP COLUMN IF EXISTS preferred_days,
  DROP COLUMN IF EXISTS preferred_time_slots,
  DROP COLUMN IF EXISTS preferred_lesson_types,
  DROP COLUMN IF EXISTS preferred_language,
  DROP COLUMN IF EXISTS consent_physical_condition,
  DROP COLUMN IF EXISTS consent_terms_conditions,
  DROP COLUMN IF EXISTS consent_gdpr,
  DROP COLUMN IF EXISTS consent_photos_videos,
  DROP COLUMN IF EXISTS consent_marketing,
  DROP COLUMN IF EXISTS consent_custom_1,
  DROP COLUMN IF EXISTS consent_custom_2,
  DROP COLUMN IF EXISTS arrival_date,
  DROP COLUMN IF EXISTS departure_date,
  DROP COLUMN IF EXISTS stay_notes,
  DROP COLUMN IF EXISTS notes;
