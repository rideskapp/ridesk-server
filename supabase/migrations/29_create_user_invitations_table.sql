-- ============================================================================
-- Migration: 29_create_user_invitations_table.sql
-- Description: Create user_invitations table for school-centric user creation
-- Created: 2024-12-19
-- ============================================================================

-- Create user_invitations table
CREATE TABLE IF NOT EXISTS user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  role VARCHAR(20) CHECK (role IN ('INSTRUCTOR', 'USER')) NOT NULL,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by_name VARCHAR(255) NOT NULL,
  invitation_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  -- Instructor-specific fields
  specialties TEXT[],
  languages TEXT[],
  hourly_rate DECIMAL(10, 2),
  commission_rate DECIMAL(5, 4),
  -- Student-specific fields
  student_level VARCHAR(20) CHECK (student_level IN ('beginner', 'intermediate', 'advanced')),
  preferred_language VARCHAR(50),
  secondary_language VARCHAR(50),
  special_needs TEXT[],
  special_needs_other TEXT,
  height INTEGER,
  weight INTEGER,
  phone_number VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_school_id ON user_invitations(school_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_expires_at ON user_invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_invitations_is_used ON user_invitations(is_used);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_user_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_invitations_updated_at
  BEFORE UPDATE ON user_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_user_invitations_updated_at();

-- Enable RLS on user_invitations
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_invitations
CREATE POLICY "Service role full access to user_invitations" ON user_invitations
  FOR ALL USING (true);

CREATE POLICY "School admins can manage their school invitations" ON user_invitations
  FOR ALL USING (
    school_id IN (
      SELECT id FROM schools 
      WHERE id IN (
        SELECT school_id FROM users 
        WHERE id = auth.uid() AND role = 'SCHOOL_ADMIN'
      )
    )
  );

CREATE POLICY "Invited users can view their own invitation" ON user_invitations
  FOR SELECT USING (
    invitation_token IN (
      SELECT unnest(string_to_array(current_setting('request.jwt.claims', true)::json->>'invitation_token', ','))
    )
  );

-- Add comments
COMMENT ON TABLE user_invitations IS 'Stores user invitations sent by school admins';
COMMENT ON COLUMN user_invitations.invitation_token IS 'Unique token for invitation acceptance';
COMMENT ON COLUMN user_invitations.expires_at IS 'When the invitation expires (typically 7 days)';
COMMENT ON COLUMN user_invitations.is_used IS 'Whether the invitation has been used to create an account';
