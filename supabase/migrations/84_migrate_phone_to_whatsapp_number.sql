-- ============================================================================
-- Migration: 84_migrate_phone_to_whatsapp_number.sql
-- Description: Migrate phone_number values to whatsapp_number for all users
-- Created: 2025-01-26
-- ============================================================================

-- Copy phone_number to whatsapp_number where whatsapp_number is NULL
-- This ensures we don't overwrite existing whatsapp_number values
UPDATE users
SET whatsapp_number = phone_number
WHERE phone_number IS NOT NULL 
  AND phone_number != ''
  AND (whatsapp_number IS NULL OR whatsapp_number = '');

-- Add comment to clarify the migration
COMMENT ON COLUMN users.whatsapp_number IS 'WhatsApp phone number with country code (used for all users - migrated from phone_number)';
