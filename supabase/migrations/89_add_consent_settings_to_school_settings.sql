-- ============================================================================
-- Migration: 89_add_consent_settings_to_school_settings.sql
-- Description: Add configurable consent checkbox settings to school_settings
-- Created: 2026-03-12
-- ============================================================================

-- Terms & Conditions customization
ALTER TABLE school_settings
  ADD COLUMN IF NOT EXISTS terms_conditions_url TEXT,
  ADD COLUMN IF NOT EXISTS terms_conditions_label JSONB DEFAULT NULL;

-- Custom checkbox 1
ALTER TABLE school_settings
  ADD COLUMN IF NOT EXISTS custom_checkbox_1_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_checkbox_1_label JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_checkbox_1_url TEXT,
  ADD COLUMN IF NOT EXISTS custom_checkbox_1_mandatory BOOLEAN NOT NULL DEFAULT true;

-- Custom checkbox 2
ALTER TABLE school_settings
  ADD COLUMN IF NOT EXISTS custom_checkbox_2_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_checkbox_2_label JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_checkbox_2_url TEXT,
  ADD COLUMN IF NOT EXISTS custom_checkbox_2_mandatory BOOLEAN NOT NULL DEFAULT true;
