-- Remove unnecessary fields from user_invitations table
-- Since we now create users immediately, we only need basic tracking fields

-- Drop columns that are no longer needed
ALTER TABLE user_invitations DROP COLUMN IF EXISTS phone_number;
ALTER TABLE user_invitations DROP COLUMN IF EXISTS specialties;
ALTER TABLE user_invitations DROP COLUMN IF EXISTS languages;
ALTER TABLE user_invitations DROP COLUMN IF EXISTS hourly_rate;
ALTER TABLE user_invitations DROP COLUMN IF EXISTS commission_rate;
ALTER TABLE user_invitations DROP COLUMN IF EXISTS student_level;
ALTER TABLE user_invitations DROP COLUMN IF EXISTS preferred_disciplines;
ALTER TABLE user_invitations DROP COLUMN IF EXISTS date_of_birth;
ALTER TABLE user_invitations DROP COLUMN IF EXISTS emergency_contact;
ALTER TABLE user_invitations DROP COLUMN IF EXISTS emergency_phone;
ALTER TABLE user_invitations DROP COLUMN IF EXISTS medical_conditions;
ALTER TABLE user_invitations DROP COLUMN IF EXISTS preferred_language;
ALTER TABLE user_invitations DROP COLUMN IF EXISTS secondary_language;
ALTER TABLE user_invitations DROP COLUMN IF EXISTS special_needs;
ALTER TABLE user_invitations DROP COLUMN IF EXISTS special_needs_other;
ALTER TABLE user_invitations DROP COLUMN IF EXISTS height;
ALTER TABLE user_invitations DROP COLUMN IF EXISTS weight;

-- Keep only essential fields:
-- id, email, first_name, last_name, role, school_id, invited_by, invited_by_name, 
-- invitation_token, expires_at, is_used, user_id, created_at, updated_at
