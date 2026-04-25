-- ============================================================================
-- Add default lesson status and payment status to schools table
-- ============================================================================

-- Add default_lesson_status_id column to schools table
ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS default_lesson_status_id UUID REFERENCES lesson_statuses(id) ON DELETE SET NULL;

-- Add default_payment_status_id column to schools table
ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS default_payment_status_id UUID REFERENCES payment_statuses(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_schools_default_lesson_status_id ON schools(default_lesson_status_id);
CREATE INDEX IF NOT EXISTS idx_schools_default_payment_status_id ON schools(default_payment_status_id);

-- Add comments for documentation
COMMENT ON COLUMN schools.default_lesson_status_id IS 'Default lesson status ID for new lessons created at this school';
COMMENT ON COLUMN schools.default_payment_status_id IS 'Default payment status ID for new lessons created at this school';

