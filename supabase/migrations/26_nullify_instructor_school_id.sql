-- Migration: Migrate instructor school assignments to many-to-many relationship
-- Description: Move existing instructor-school relationships from users.school_id 
-- to the instructor_schools junction table, then nullify school_id for instructors

-- Step 1: Create instructor_schools entries for existing instructor-school relationships
INSERT INTO instructor_schools (
  instructor_id, 
  school_id, 
  is_primary, 
  hourly_rate, 
  commission_rate, 
  is_active, 
  created_at, 
  updated_at
)
SELECT 
  u.id as instructor_id,
  u.school_id,
  true as is_primary, -- Set as primary since it was their only school
  NULL as hourly_rate, -- No existing rate data
  NULL as commission_rate, -- No existing rate data
  true as is_active,
  u.created_at,
  u.updated_at
FROM users u
WHERE u.role = 'INSTRUCTOR' 
  AND u.school_id IS NOT NULL
  AND NOT EXISTS (
    -- Avoid duplicates if migration is run multiple times
    SELECT 1 FROM instructor_schools is_rel 
    WHERE is_rel.instructor_id = u.id 
      AND is_rel.school_id = u.school_id
  );

-- Step 2: Set school_id to null for all instructors
UPDATE users 
SET school_id = NULL 
WHERE role = 'INSTRUCTOR' 
  AND school_id IS NOT NULL;

-- Step 3: Add a comment explaining the change
COMMENT ON COLUMN users.school_id IS 'School ID for direct assignment. For instructors, use instructor_schools table instead.';

-- Step 4: Log the migration results
DO $$
DECLARE
  migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count 
  FROM instructor_schools 
  WHERE is_primary = true;
  
  RAISE NOTICE 'Migration completed: % instructor-school relationships migrated to instructor_schools table', migrated_count;
END $$;
