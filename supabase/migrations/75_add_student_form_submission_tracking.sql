-- ============================================================================
-- Migration: 75_add_student_form_submission_tracking.sql
-- Description: Add form_submitted_at field to track student form submissions
-- ============================================================================

-- Add form_submitted_at field to user_invitations table
ALTER TABLE user_invitations 
ADD COLUMN IF NOT EXISTS form_submitted_at TIMESTAMP WITH TIME ZONE;

-- index for better performance when checking form submission status
CREATE INDEX IF NOT EXISTS idx_user_invitations_form_submitted_at 
ON user_invitations(form_submitted_at) 
WHERE form_submitted_at IS NOT NULL;

-- comment
COMMENT ON COLUMN user_invitations.form_submitted_at IS 'Timestamp when student form was submitted (null if not submitted yet)';
