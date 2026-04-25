-- ============================================================================
-- Migration: 12_create_payment_statuses_table.sql
-- Description: Create payment_statuses table for tracking payment states
-- Created: 2024-12-19
-- ============================================================================

-- Create payment_statuses table
CREATE TABLE IF NOT EXISTS payment_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#6B7280', -- Hex color code
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for payment_statuses table
CREATE INDEX IF NOT EXISTS idx_payment_statuses_name ON payment_statuses(name);
CREATE INDEX IF NOT EXISTS idx_payment_statuses_is_active ON payment_statuses(is_active);
CREATE INDEX IF NOT EXISTS idx_payment_statuses_sort_order ON payment_statuses(sort_order);

-- Create triggers for updated_at
CREATE TRIGGER update_payment_statuses_updated_at 
  BEFORE UPDATE ON payment_statuses 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) on payment_statuses table
ALTER TABLE payment_statuses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for payment_statuses table
CREATE POLICY "Payment statuses are viewable by everyone" ON payment_statuses
  FOR SELECT USING (is_active = true);

CREATE POLICY "Only SUPER_ADMIN can manage payment statuses" ON payment_statuses
  FOR ALL USING (auth.jwt() ->> 'role' = 'SUPER_ADMIN');

-- Insert default payment statuses
INSERT INTO payment_statuses (name, display_name, description, color, sort_order) VALUES
('pending', 'Pending Payment', 'Payment is pending and not yet received', '#F59E0B', 1),
('paid', 'Paid', 'Payment has been received and confirmed', '#10B981', 2),
('partially_paid', 'Partially Paid', 'Partial payment has been received', '#3B82F6', 3),
('overdue', 'Overdue', 'Payment is past due date', '#DC2626', 4),
('cancelled', 'Cancelled', 'Payment has been cancelled', '#6B7280', 5),
('refunded', 'Refunded', 'Payment has been refunded', '#8B5CF6', 6),
('failed', 'Failed', 'Payment attempt failed', '#7C2D12', 7),
('processing', 'Processing', 'Payment is being processed', '#F97316', 8),
('disputed', 'Disputed', 'Payment is under dispute', '#EF4444', 9),
('waived', 'Waived', 'Payment has been waived', '#059669', 10)
ON CONFLICT (name) DO NOTHING;

-- Create function to get active payment statuses
CREATE OR REPLACE FUNCTION get_active_payment_statuses()
RETURNS TABLE (
  id UUID,
  name VARCHAR(50),
  display_name VARCHAR(100),
  description TEXT,
  color VARCHAR(7),
  is_active BOOLEAN,
  sort_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ps.id,
    ps.name,
    ps.display_name,
    ps.description,
    ps.color,
    ps.is_active,
    ps.sort_order,
    ps.created_at,
    ps.updated_at
  FROM payment_statuses ps
  WHERE ps.is_active = true
  ORDER BY ps.sort_order, ps.display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get payment status by name
CREATE OR REPLACE FUNCTION get_payment_status_by_name(p_name VARCHAR(50))
RETURNS TABLE (
  id UUID,
  name VARCHAR(50),
  display_name VARCHAR(100),
  description TEXT,
  color VARCHAR(7),
  is_active BOOLEAN,
  sort_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ps.id,
    ps.name,
    ps.display_name,
    ps.description,
    ps.color,
    ps.is_active,
    ps.sort_order,
    ps.created_at,
    ps.updated_at
  FROM payment_statuses ps
  WHERE ps.name = p_name AND ps.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update payment status
CREATE OR REPLACE FUNCTION update_payment_status(
  p_lesson_id UUID,
  p_status_name VARCHAR(50)
)
RETURNS BOOLEAN AS $$
DECLARE
  status_id UUID;
BEGIN
  -- Get status ID
  SELECT id INTO status_id
  FROM payment_statuses
  WHERE name = p_status_name AND is_active = true;
  
  IF status_id IS NULL THEN
    RAISE EXCEPTION 'Payment status not found: %', p_status_name;
  END IF;
  
  -- Update lesson payment status
  UPDATE lessons 
  SET payment_status_id = status_id, updated_at = NOW()
  WHERE id = p_lesson_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get payment status statistics
CREATE OR REPLACE FUNCTION get_payment_status_statistics(
  p_school_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  status_name VARCHAR(50),
  status_display_name VARCHAR(100),
  status_color VARCHAR(7),
  lesson_count BIGINT,
  total_amount DECIMAL(12,2),
  percentage DECIMAL(5,2)
) AS $$
DECLARE
  total_lessons BIGINT := 0;
  total_amount DECIMAL(12,2) := 0;
BEGIN
  -- Get total lessons count and amount
  SELECT COUNT(*), COALESCE(SUM(price), 0) INTO total_lessons, total_amount
  FROM lessons l
  WHERE l.school_id = p_school_id
    AND (p_start_date IS NULL OR l.date >= p_start_date)
    AND (p_end_date IS NULL OR l.date <= p_end_date);
  
  -- Return statistics
  RETURN QUERY
  SELECT 
    ps.name,
    ps.display_name,
    ps.color,
    COUNT(l.id) as lesson_count,
    COALESCE(SUM(l.price), 0) as total_amount,
    CASE 
      WHEN total_lessons > 0 THEN ROUND((COUNT(l.id)::DECIMAL / total_lessons * 100), 2)
      ELSE 0
    END as percentage
  FROM payment_statuses ps
  LEFT JOIN lessons l ON l.payment_status_id = ps.id
    AND l.school_id = p_school_id
    AND (p_start_date IS NULL OR l.date >= p_start_date)
    AND (p_end_date IS NULL OR l.date <= p_end_date)
  WHERE ps.is_active = true
  GROUP BY ps.id, ps.name, ps.display_name, ps.color, ps.sort_order
  ORDER BY ps.sort_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get overdue payments
CREATE OR REPLACE FUNCTION get_overdue_payments(
  p_school_id UUID,
  p_days_overdue INTEGER DEFAULT 7
)
RETURNS TABLE (
  lesson_id UUID,
  student_id UUID,
  student_first_name VARCHAR(50),
  student_last_name VARCHAR(50),
  student_email VARCHAR(255),
  instructor_id UUID,
  instructor_first_name VARCHAR(50),
  instructor_last_name VARCHAR(50),
  discipline TEXT,
  date DATE,
  "time" TIME,
  duration INTEGER,
  price DECIMAL(10,2),
  currency VARCHAR(3),
  days_overdue INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id as lesson_id,
    s.id as student_id,
    s.first_name as student_first_name,
    s.last_name as student_last_name,
    s.email as student_email,
    i.id as instructor_id,
    i.first_name as instructor_first_name,
    i.last_name as instructor_last_name,
    l.discipline,
    l.date,
    l.time as "time",
    l.duration,
    l.price,
    'EUR' as currency,
    (CURRENT_DATE - l.date) as days_overdue
  FROM lessons l
  JOIN lesson_participants lp ON lp.lesson_id = l.id
  JOIN students s ON s.id = lp.student_id
  JOIN instructors i ON i.id = l.instructor_id
  JOIN payment_statuses ps ON ps.id = l.payment_status_id
  WHERE l.school_id = p_school_id
    AND ps.name = 'overdue'
    AND l.date < CURRENT_DATE - INTERVAL '1 day' * p_days_overdue
  ORDER BY l.date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
