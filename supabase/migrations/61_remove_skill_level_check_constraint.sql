-- ============================================================================
-- Remove CHECK constraint on skill_level to allow any student level slug
-- ============================================================================

-- Drop the CHECK constraint on skill_level 
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the constraint name for skill_level check
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'users'::regclass
      AND contype = 'c'
      AND conname LIKE '%skill_level%';
    
    -- Drop the constraint if found
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE users DROP CONSTRAINT ' || quote_ident(constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'No skill_level check constraint found';
    END IF;
END $$;

-- Increase size of skill_level column to accommodate longer slugs (like "instructor")
ALTER TABLE users 
ALTER COLUMN skill_level TYPE VARCHAR(50);

