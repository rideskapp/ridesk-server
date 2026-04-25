-- ============================================================================
-- Migration: 92_add_student_profile_fields_to_student_schools.sql
-- Description: Store student school-scoped profile fields on student_schools
--              and backfill values from users
-- ============================================================================

ALTER TABLE student_schools
  ADD COLUMN IF NOT EXISTS skill_level TEXT,
  ADD COLUMN IF NOT EXISTS preferred_disciplines TEXT[],
  ADD COLUMN IF NOT EXISTS primary_sport TEXT,
  ADD COLUMN IF NOT EXISTS riding_background TEXT,
  ADD COLUMN IF NOT EXISTS preferred_days TEXT[],
  ADD COLUMN IF NOT EXISTS preferred_time_slots TEXT[],
  ADD COLUMN IF NOT EXISTS preferred_lesson_types TEXT[],
  ADD COLUMN IF NOT EXISTS preferred_language TEXT[],
  ADD COLUMN IF NOT EXISTS consent_physical_condition BOOLEAN,
  ADD COLUMN IF NOT EXISTS consent_terms_conditions BOOLEAN,
  ADD COLUMN IF NOT EXISTS consent_gdpr BOOLEAN,
  ADD COLUMN IF NOT EXISTS consent_photos_videos BOOLEAN,
  ADD COLUMN IF NOT EXISTS consent_marketing BOOLEAN,
  ADD COLUMN IF NOT EXISTS consent_custom_1 BOOLEAN,
  ADD COLUMN IF NOT EXISTS consent_custom_2 BOOLEAN,
  ADD COLUMN IF NOT EXISTS arrival_date DATE,
  ADD COLUMN IF NOT EXISTS departure_date DATE,
  ADD COLUMN IF NOT EXISTS stay_notes TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS consented_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS consent_terms_version TEXT;

-- Backfill only active memberships; for multi-school users prioritize primary membership rows.
WITH ranked_memberships AS (
  SELECT
    ss.id AS student_school_id,
    ROW_NUMBER() OVER (
      PARTITION BY ss.student_id
      ORDER BY ss.is_primary DESC, ss.created_at ASC
    ) AS rn
  FROM student_schools ss
  WHERE ss.is_active = true
)
UPDATE student_schools ss
SET
  skill_level = COALESCE(ss.skill_level, u.skill_level),
  preferred_disciplines = COALESCE(ss.preferred_disciplines, u.preferred_disciplines),
  primary_sport = COALESCE(ss.primary_sport, u.primary_sport),
  riding_background = COALESCE(ss.riding_background, u.riding_background),
  preferred_days = COALESCE(ss.preferred_days, u.preferred_days),
  preferred_time_slots = COALESCE(ss.preferred_time_slots, u.preferred_time_slots),
  preferred_lesson_types = COALESCE(ss.preferred_lesson_types, u.preferred_lesson_types),
  preferred_language = COALESCE(ss.preferred_language, u.preferred_language),
  consent_physical_condition = COALESCE(ss.consent_physical_condition, u.consent_physical_condition),
  consent_terms_conditions = COALESCE(ss.consent_terms_conditions, u.consent_terms_conditions),
  consent_gdpr = COALESCE(ss.consent_gdpr, u.consent_gdpr),
  consent_photos_videos = COALESCE(ss.consent_photos_videos, u.consent_photos_videos),
  consent_marketing = COALESCE(ss.consent_marketing, u.consent_marketing),
  consent_custom_1 = COALESCE(ss.consent_custom_1, u.consent_custom_1),
  consent_custom_2 = COALESCE(ss.consent_custom_2, u.consent_custom_2),
  arrival_date = COALESCE(ss.arrival_date, u.arrival_date),
  departure_date = COALESCE(ss.departure_date, u.departure_date),
  stay_notes = COALESCE(ss.stay_notes, u.stay_notes),
  notes = COALESCE(ss.notes, u.notes),
  updated_at = NOW()
FROM users u, ranked_memberships rm
WHERE u.id = ss.student_id
  AND rm.student_school_id = ss.id
  AND u.role = 'USER'
  AND rm.rn = 1;
