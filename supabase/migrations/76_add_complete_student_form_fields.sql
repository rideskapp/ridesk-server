-- ============================================================================
-- Migration: 76_add_complete_student_form_fields.sql
-- Description: Add all required fields for complete student form implementation
-- Created: 2024-12-20
-- ============================================================================


ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS nationality VARCHAR(100);

ALTER TABLE users ADD COLUMN IF NOT EXISTS weight INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS height INTEGER;

ALTER TABLE users ADD COLUMN IF NOT EXISTS can_swim BOOLEAN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_sport VARCHAR(50) 
  CHECK (primary_sport IN ('surf', 'kitesurf', 'wingfoil', 'foil') OR primary_sport IS NULL);

ALTER TABLE users ADD COLUMN IF NOT EXISTS riding_background TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_days TEXT[] DEFAULT '{}';

ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_time_slots TEXT[] DEFAULT '{}';

ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_lesson_types TEXT[] DEFAULT '{}';

ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(50);

ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_physical_condition BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_terms_conditions BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_gdpr BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_photos_videos BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_marketing BOOLEAN DEFAULT false;

-- comments for documentation
COMMENT ON COLUMN users.whatsapp_number IS 'WhatsApp phone number with country code (mandatory for students)';
COMMENT ON COLUMN users.nationality IS 'Student nationality';
COMMENT ON COLUMN users.weight IS 'Student weight in kg';
COMMENT ON COLUMN users.height IS 'Student height in cm';
COMMENT ON COLUMN users.can_swim IS 'Whether the student can swim (yes/no)';
COMMENT ON COLUMN users.primary_sport IS 'Primary sport preference: surf, kitesurf, wingfoil, or foil';
COMMENT ON COLUMN users.riding_background IS 'Short text about student riding experience';
COMMENT ON COLUMN users.preferred_days IS 'Array of preferred days (monday, tuesday, etc.)';
COMMENT ON COLUMN users.preferred_time_slots IS 'Array of preferred time slots (morning, afternoon)';
COMMENT ON COLUMN users.preferred_lesson_types IS 'Array of preferred lesson types (private, semi-private, group)';
COMMENT ON COLUMN users.preferred_language IS 'Preferred language for lessons';
COMMENT ON COLUMN users.consent_physical_condition IS 'Consent: I confirm that I am in good physical condition to practice water sports';
COMMENT ON COLUMN users.consent_terms_conditions IS 'Consent: I accept the Terms & Conditions and Liability Waiver';
COMMENT ON COLUMN users.consent_gdpr IS 'Consent: I give consent to the processing of my personal data (GDPR)';
COMMENT ON COLUMN users.consent_photos_videos IS 'Consent: I authorize the use of photos/videos for promotional purposes (optional)';
COMMENT ON COLUMN users.consent_marketing IS 'Consent: I agree to receive marketing communications and promotions (optional)';

