-- ============================================================================
-- Description: Add default_currency column to school_settings table
-- ============================================================================

-- Add default_currency column to school_settings
ALTER TABLE public.school_settings
ADD COLUMN IF NOT EXISTS default_currency VARCHAR(3) DEFAULT 'EUR';

-- Optional: ensure existing records have a non-null value
UPDATE public.school_settings
SET default_currency = 'EUR'
WHERE default_currency IS NULL;

