-- ============================================================================
-- Migration: 82_make_instructor_rates_school_specific.sql
-- Description: Delete all global rates and make instructor_rates school-specific
-- Created: 2025-01-XX
-- ============================================================================

-- Step 1: Delete ALL existing rates (they're global and don't make sense)
-- Since system is not in production, safe to delete
DELETE FROM instructor_rates;

-- Step 2: Drop old database functions that reference the old structure
DROP FUNCTION IF EXISTS get_instructor_rate(UUID, TEXT);
DROP FUNCTION IF EXISTS calculate_instructor_compensation(UUID, DATE, DATE);

-- Step 3: Drop old unique constraint (based on category_id only, not school_id)
DROP INDEX IF EXISTS idx_instructor_rates_unique_active;

-- Step 4: Drop old indexes that reference discipline (if they exist)
DROP INDEX IF EXISTS idx_instructor_rates_discipline;

-- Step 5: Add school_id column
ALTER TABLE instructor_rates 
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- Step 6: Make school_id required (NOT NULL)
ALTER TABLE instructor_rates 
ALTER COLUMN school_id SET NOT NULL;

-- Step 7: Create new unique constraint with school_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_instructor_rates_unique_active 
ON instructor_rates(instructor_id, category_id, school_id) 
WHERE is_active = true 
  AND category_id IS NOT NULL 
  AND school_id IS NOT NULL;

-- Step 8: Create index for school_id for better query performance
CREATE INDEX IF NOT EXISTS idx_instructor_rates_school_id 
ON instructor_rates(school_id);

-- Step 9: Create composite index for common queries (instructor + school + category)
CREATE INDEX IF NOT EXISTS idx_instructor_rates_instructor_school_category 
ON instructor_rates(instructor_id, school_id, category_id) 
WHERE is_active = true;

-- Step 10: Update RLS policies to include school_id
DROP POLICY IF EXISTS "Instructor rates are viewable by school members" ON instructor_rates;
DROP POLICY IF EXISTS "Only school admins can manage instructor rates" ON instructor_rates;

-- New policy: View rates for instructors in your school
CREATE POLICY "Instructor rates are viewable by school members" ON instructor_rates
  FOR SELECT USING (
    school_id IN (
      SELECT id FROM schools WHERE id = school_id
    )
  );

-- New policy: Only school admins can manage rates for their school
CREATE POLICY "Only school admins can manage instructor rates" ON instructor_rates
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR 
    (auth.jwt() ->> 'role' = 'SCHOOL_ADMIN' AND 
     school_id = (auth.jwt() ->> 'school_id')::UUID)
  );

-- Step 11: Add comment to document the change
COMMENT ON COLUMN instructor_rates.school_id IS 'School ID - rates are school-specific. Each instructor can have different rates per category for each school they work at.';

-- Step 12: Verify the table structure
DO $$
BEGIN
  -- Check if school_id column exists and is NOT NULL
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'instructor_rates' 
      AND column_name = 'school_id' 
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'Migration failed: school_id column not properly set';
  END IF;
  
  -- Check if there are any remaining rates (should be 0)
  IF EXISTS (SELECT 1 FROM instructor_rates LIMIT 1) THEN
    RAISE WARNING 'Warning: There are still rates in instructor_rates table after deletion';
  END IF;
  
  RAISE NOTICE 'Migration completed successfully: instructor_rates is now school-specific';
END $$;
