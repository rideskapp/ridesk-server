-- ============================================================================
-- Add default_max_participants column to product_categories table
-- ============================================================================

-- Add default_max_participants column to product_categories table
ALTER TABLE product_categories
ADD COLUMN IF NOT EXISTS default_max_participants INTEGER DEFAULT 1;

-- Update all existing records to have default value of 1
-- This ensures all existing records get the value even if column was added without default
UPDATE product_categories
SET default_max_participants = 1
WHERE default_max_participants IS NULL OR default_max_participants < 1;

