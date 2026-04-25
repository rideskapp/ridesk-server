-- ============================================================================
-- Migration: 87_add_pending_payment_status.sql
-- Description: Reintroduce a 'pending' payment status so it appears in the UI
--              and can be used by reporting logic.
-- ============================================================================

-- Create or update the 'pending' payment status
INSERT INTO payment_statuses (name, display_name, description, color, sort_order, is_active)
VALUES
  ('pending', 'Pending', 'Payment is pending', '#F59E0B', 4, true)
ON CONFLICT (name) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  description  = EXCLUDED.description,
  color        = EXCLUDED.color,
  sort_order   = EXCLUDED.sort_order,
  is_active    = true;

