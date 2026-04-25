-- ============================================================================
-- Description: Add lesson_color_scheme and custom_color_overrides to school_settings
-- ============================================================================

-- Add lesson_color_scheme column to school_settings
ALTER TABLE public.school_settings 
ADD COLUMN IF NOT EXISTS lesson_color_scheme VARCHAR(50) DEFAULT 'discipline';

-- Add custom_color_overrides column for future customizations
ALTER TABLE public.school_settings 
ADD COLUMN IF NOT EXISTS custom_color_overrides JSONB DEFAULT '{}'::jsonb;

-- Add CHECK constraint to ensure valid color scheme values
-- Drop constraint if it exists first (idempotent)
ALTER TABLE public.school_settings 
DROP CONSTRAINT IF EXISTS check_lesson_color_scheme;

ALTER TABLE public.school_settings 
ADD CONSTRAINT check_lesson_color_scheme 
CHECK (lesson_color_scheme IN ('discipline', 'student_level', 'category'));

-- Update existing records to have the default value if NULL
UPDATE public.school_settings 
SET lesson_color_scheme = 'discipline' 
WHERE lesson_color_scheme IS NULL;

-- Update existing records to have empty JSONB if NULL
UPDATE public.school_settings 
SET custom_color_overrides = '{}'::jsonb 
WHERE custom_color_overrides IS NULL;

