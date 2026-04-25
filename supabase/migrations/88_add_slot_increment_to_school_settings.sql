-- ============================================================================
-- Description: Add slot_increment_minutes column to school_settings table
-- This will be used to control the minimum lesson time increment per school
-- (e.g. 30 or 60 minutes).
-- ============================================================================

ALTER TABLE public.school_settings
ADD COLUMN IF NOT EXISTS slot_increment_minutes INTEGER NOT NULL DEFAULT 60;

-- Ensure existing records have a sane default
UPDATE public.school_settings
SET slot_increment_minutes = 60
WHERE slot_increment_minutes IS NULL;

