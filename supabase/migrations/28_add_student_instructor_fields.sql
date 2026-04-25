-- Add student and instructor specific fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS medical_conditions TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS skill_level VARCHAR(20) CHECK (skill_level IN ('beginner', 'intermediate', 'advanced'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_disciplines TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS certifications TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_skill_level ON users(skill_level);
CREATE INDEX IF NOT EXISTS idx_users_is_primary ON users(is_primary);
CREATE INDEX IF NOT EXISTS idx_users_specialties ON users USING GIN(specialties);
CREATE INDEX IF NOT EXISTS idx_users_preferred_disciplines ON users USING GIN(preferred_disciplines);
