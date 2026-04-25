-- ============================================================================
-- Remove CHECK constraint on lessons.discipline to allow any discipline values
-- ============================================================================

-- Drop the CHECK constraint on discipline column
ALTER TABLE public.lessons 
DROP CONSTRAINT IF EXISTS lessons_discipline_check;

-- Increase VARCHAR length to allow longer discipline names (from 20 to 100)
ALTER TABLE public.lessons 
ALTER COLUMN discipline TYPE VARCHAR(100);

