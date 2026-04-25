-- ============================================================================
-- Description: Add compensation_mode column to school_settings table
-- ============================================================================

-- Add compensation_mode column to school_settings
ALTER TABLE public.school_settings 
ADD COLUMN IF NOT EXISTS compensation_mode VARCHAR(20) DEFAULT 'fixed';

-- Add CHECK constraint to ensure valid compensation mode values
-- Drop constraint if it exists first (idempotent)
ALTER TABLE public.school_settings 
DROP CONSTRAINT IF EXISTS check_compensation_mode;

ALTER TABLE public.school_settings 
ADD CONSTRAINT check_compensation_mode 
CHECK (compensation_mode IN ('fixed', 'variable'));

-- Update existing records to have the default value if NULL
UPDATE public.school_settings 
SET compensation_mode = 'fixed' 
WHERE compensation_mode IS NULL;

