-- ============================================================================
-- Migration: 79_add_compensation_paid_to_lessons.sql
-- Description: Add compensation_paid column to lessons table for tracking paid compensations
-- ============================================================================

-- Add compensation_paid column to lessons table
ALTER TABLE lessons 
ADD COLUMN IF NOT EXISTS compensation_paid BOOLEAN NOT NULL DEFAULT false;

-- Create index for faster queries on compensation_paid
CREATE INDEX IF NOT EXISTS idx_lessons_compensation_paid ON lessons(compensation_paid);

-- Create composite index for common compensation queries
CREATE INDEX IF NOT EXISTS idx_lessons_instructor_date_comp_paid ON lessons(instructor_id, date, compensation_paid);

-- Add comment to the column
COMMENT ON COLUMN lessons.compensation_paid IS 'Indicates whether the instructor compensation for this lesson has been paid';

