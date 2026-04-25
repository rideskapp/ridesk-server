-- ============================================================================
-- Migration: 04_create_instructor_rates_table.sql
-- Description: Create instructor_rates table for compensation tracking
-- Created: 2024-12-19
-- ============================================================================

-- Create instructor_rates table
CREATE TABLE IF NOT EXISTS instructor_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  discipline TEXT NOT NULL CHECK (discipline IN ('kite', 'surf', 'wing')),
  rate_type TEXT NOT NULL CHECK (rate_type IN ('hourly', 'lesson', 'percentage')),
  rate_value DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for instructor_rates table
CREATE INDEX IF NOT EXISTS idx_instructor_rates_instructor_id ON instructor_rates(instructor_id);
CREATE INDEX IF NOT EXISTS idx_instructor_rates_discipline ON instructor_rates(discipline);
CREATE INDEX IF NOT EXISTS idx_instructor_rates_rate_type ON instructor_rates(rate_type);
CREATE INDEX IF NOT EXISTS idx_instructor_rates_is_active ON instructor_rates(is_active);

-- Create unique constraint for active rates per instructor per discipline
CREATE UNIQUE INDEX IF NOT EXISTS idx_instructor_rates_unique_active 
ON instructor_rates(instructor_id, discipline) 
WHERE is_active = true;

-- Create triggers for updated_at
CREATE TRIGGER update_instructor_rates_updated_at 
  BEFORE UPDATE ON instructor_rates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) on instructor_rates table
ALTER TABLE instructor_rates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for instructor_rates table
CREATE POLICY "Instructor rates are viewable by school members" ON instructor_rates
  FOR SELECT USING (
    instructor_id IN (
      SELECT i.id FROM instructors i 
      WHERE i.school_id IN (
        SELECT s.id FROM schools s WHERE s.id = i.school_id
      )
    )
  );

CREATE POLICY "Only school admins can manage instructor rates" ON instructor_rates
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR 
    (auth.jwt() ->> 'role' = 'SCHOOL_ADMIN' AND 
     instructor_id IN (
       SELECT i.id FROM instructors i 
       WHERE i.school_id = (auth.jwt() ->> 'school_id')::UUID
     )
    )
  );

-- Create function to get instructor rate
CREATE OR REPLACE FUNCTION get_instructor_rate(
  p_instructor_id UUID,
  p_discipline TEXT
)
RETURNS TABLE (
  id UUID,
  instructor_id UUID,
  discipline TEXT,
  rate_type TEXT,
  rate_value DECIMAL(10,2),
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ir.id,
    ir.instructor_id,
    ir.discipline,
    ir.rate_type,
    ir.rate_value,
    ir.is_active,
    ir.created_at,
    ir.updated_at
  FROM instructor_rates ir
  WHERE ir.instructor_id = p_instructor_id 
    AND ir.discipline = p_discipline 
    AND ir.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to calculate instructor compensation
CREATE OR REPLACE FUNCTION calculate_instructor_compensation(
  p_instructor_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  instructor_id UUID,
  total_lessons INTEGER,
  total_hours DECIMAL(10,2),
  total_compensation DECIMAL(10,2),
  discipline_breakdown JSONB
) AS $$
DECLARE
  compensation_data JSONB := '{}';
  discipline_comp JSONB;
  total_comp DECIMAL(10,2) := 0;
  total_lessons INTEGER := 0;
  total_hours DECIMAL(10,2) := 0;
BEGIN
  -- Get lessons for the instructor in the date range
  FOR discipline_comp IN
    SELECT 
      l.discipline,
      COUNT(*) as lesson_count,
      SUM(l.duration) as total_duration,
      AVG(ir.rate_value) as avg_rate,
      SUM(l.duration * ir.rate_value) as discipline_compensation
    FROM lessons l
    JOIN instructor_rates ir ON ir.instructor_id = l.instructor_id 
      AND ir.discipline = l.discipline 
      AND ir.is_active = true
    WHERE l.instructor_id = p_instructor_id
      AND l.date >= p_start_date
      AND l.date <= p_end_date
      AND l.lesson_status_id IN (
        SELECT id FROM lesson_statuses WHERE name = 'confirmed'
      )
    GROUP BY l.discipline
  LOOP
    compensation_data := compensation_data || jsonb_build_object(
      discipline_comp.discipline,
      jsonb_build_object(
        'lessons', discipline_comp.lesson_count,
        'hours', discipline_comp.total_duration,
        'rate', discipline_comp.avg_rate,
        'compensation', discipline_comp.discipline_compensation
      )
    );
    
    total_lessons := total_lessons + discipline_comp.lesson_count;
    total_hours := total_hours + discipline_comp.total_duration;
    total_comp := total_comp + discipline_comp.discipline_compensation;
  END LOOP;
  
  RETURN QUERY
  SELECT 
    p_instructor_id,
    total_lessons,
    total_hours,
    total_comp,
    compensation_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
