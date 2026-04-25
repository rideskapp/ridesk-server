-- ============================================================================
-- Remove CHECK constraint on lessons.level to allow any level values
-- ============================================================================

-- Drop the CHECK constraint on level column
ALTER TABLE public.lessons 
DROP CONSTRAINT IF EXISTS lessons_level_check;

-- Increase VARCHAR length to allow longer level names (from 20 to 50)
ALTER TABLE public.lessons 
ALTER COLUMN level TYPE VARCHAR(50);

