-- ============================================================================
-- Add category_id to instructor_rates table for category-based compensation
-- ============================================================================

-- Add category_id column (nullable initially for backward compatibility)
ALTER TABLE instructor_rates 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES product_categories(id) ON DELETE CASCADE;

-- Make discipline column nullable since we're moving to category-based rates
ALTER TABLE instructor_rates 
ALTER COLUMN discipline DROP NOT NULL;

-- Drop the CHECK constraint on discipline (allow any value or NULL)
ALTER TABLE instructor_rates 
DROP CONSTRAINT IF EXISTS instructor_rates_discipline_check;

-- Create index for category_id
CREATE INDEX IF NOT EXISTS idx_instructor_rates_category_id ON instructor_rates(category_id);

-- Drop old unique constraint on (instructor_id, discipline)
DROP INDEX IF EXISTS idx_instructor_rates_unique_active;

CREATE UNIQUE INDEX IF NOT EXISTS idx_instructor_rates_unique_active 
ON instructor_rates(instructor_id, category_id) 
WHERE is_active = true AND category_id IS NOT NULL;

