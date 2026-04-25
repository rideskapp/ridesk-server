-- ============================================================================
-- Migration: 90_add_custom_consent_fields_to_users.sql
-- Description: Add custom consent checkbox fields to users table
-- Created: 2026-03-12
-- ============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS consent_custom_1 BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS consent_custom_2 BOOLEAN DEFAULT NULL;
