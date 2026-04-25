-- ============================================================================
-- Fix default lesson and payment statuses to only allow specific values
--              Lesson Status: waiting, confirmed
--              Payment Status: paid, not_paid, partially_paid
-- ============================================================================

-- Step 1: Update any lessons that reference unwanted lesson statuses
-- Set their lesson_status_id to NULL
UPDATE lessons
SET lesson_status_id = NULL
WHERE lesson_status_id IS NOT NULL
  AND lesson_status_id NOT IN (
    SELECT id FROM lesson_statuses WHERE name IN ('waiting', 'confirmed')
  );

-- Step 2: Update any lessons that reference unwanted payment statuses
-- Set their payment_status_id to NULL
UPDATE lessons
SET payment_status_id = NULL
WHERE payment_status_id IS NOT NULL
  AND payment_status_id NOT IN (
    SELECT id FROM payment_statuses WHERE name IN ('paid', 'not_paid', 'partially_paid')
  );

-- Step 3: Update schools with invalid default lesson statuses
UPDATE schools
SET default_lesson_status_id = NULL
WHERE default_lesson_status_id IS NOT NULL
  AND default_lesson_status_id NOT IN (
    SELECT id FROM lesson_statuses WHERE name IN ('waiting', 'confirmed')
  );

-- Step 4: Update schools with invalid default payment statuses
UPDATE schools
SET default_payment_status_id = NULL
WHERE default_payment_status_id IS NOT NULL
  AND default_payment_status_id NOT IN (
    SELECT id FROM payment_statuses WHERE name IN ('paid', 'not_paid', 'partially_paid')
  );

-- Step 5: Create "waiting" lesson status if it doesn't exist
INSERT INTO lesson_statuses (name, display_name, description, color, sort_order, is_active) 
VALUES 
('waiting', 'Waiting', 'Lesson is waiting for confirmation', '#F59E0B', 1, true)
ON CONFLICT (name) DO UPDATE 
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    color = EXCLUDED.color,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

-- Step 6: Ensure "confirmed" lesson status is active
UPDATE lesson_statuses 
SET is_active = true, sort_order = 2
WHERE name = 'confirmed';

-- Step 7: Delete all unwanted lesson statuses
DELETE FROM lesson_statuses 
WHERE name NOT IN ('waiting', 'confirmed');

-- Step 8: Rename "pending" payment status to "not_paid" if it exists, or create "not_paid"
-- First, check if "pending" exists and rename it
UPDATE payment_statuses
SET name = 'not_paid',
    display_name = 'Not Paid',
    description = 'Payment has not been received',
    color = '#DC2626',
    sort_order = 1,
    is_active = true
WHERE name = 'pending';

-- If "pending" didn't exist, create "not_paid"
INSERT INTO payment_statuses (name, display_name, description, color, sort_order, is_active) 
VALUES 
('not_paid', 'Not Paid', 'Payment has not been received', '#DC2626', 1, true)
ON CONFLICT (name) DO UPDATE 
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    color = EXCLUDED.color,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

-- Step 9: Ensure "paid" payment status is active
UPDATE payment_statuses 
SET is_active = true, sort_order = 2
WHERE name = 'paid';

-- Step 10: Ensure "partially_paid" payment status is active
UPDATE payment_statuses 
SET is_active = true, sort_order = 3
WHERE name = 'partially_paid';

-- Step 11: Delete all unwanted payment statuses
DELETE FROM payment_statuses 
WHERE name NOT IN ('paid', 'not_paid', 'partially_paid');

