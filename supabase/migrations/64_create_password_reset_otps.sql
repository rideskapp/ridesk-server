-- ============================================================================
-- Create password_reset_otps table for password reset functionality
-- ============================================================================

-- Create password_reset_otps table
CREATE TABLE IF NOT EXISTS password_reset_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  otp VARCHAR(255) NOT NULL, -- Hashed OTP stored in database
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email ON password_reset_otps(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_expires_at ON password_reset_otps(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_is_used ON password_reset_otps(is_used);

-- Create composite index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email_expires ON password_reset_otps(email, expires_at) WHERE is_used = false;

-- Enable RLS on password_reset_otps
ALTER TABLE password_reset_otps ENABLE ROW LEVEL SECURITY;

-- RLS Policies for password_reset_otps
-- Service role has full access (for backend operations)
CREATE POLICY "Service role full access to password_reset_otps" ON password_reset_otps
  FOR ALL USING (true);

-- Add comments
COMMENT ON TABLE password_reset_otps IS 'Stores password reset OTP codes for email verification';
COMMENT ON COLUMN password_reset_otps.otp IS 'Hashed OTP code (6-digit numeric)';
COMMENT ON COLUMN password_reset_otps.expires_at IS 'When the OTP expires (typically 10 minutes)';
COMMENT ON COLUMN password_reset_otps.is_used IS 'Whether the OTP has been used for password reset';

