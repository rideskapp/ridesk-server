-- Add missing fields to user_invitations table
ALTER TABLE user_invitations ADD COLUMN IF NOT EXISTS preferred_disciplines TEXT[] DEFAULT '{}';
ALTER TABLE user_invitations ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE user_invitations ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(100);
ALTER TABLE user_invitations ADD COLUMN IF NOT EXISTS emergency_phone VARCHAR(20);
ALTER TABLE user_invitations ADD COLUMN IF NOT EXISTS medical_conditions TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_invitations_preferred_disciplines ON user_invitations USING GIN(preferred_disciplines);
CREATE INDEX IF NOT EXISTS idx_user_invitations_date_of_birth ON user_invitations(date_of_birth);
