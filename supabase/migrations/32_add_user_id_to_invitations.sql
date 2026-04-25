-- Add user_id field to user_invitations table to link to created user
ALTER TABLE user_invitations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_user_invitations_user_id ON user_invitations(user_id);
