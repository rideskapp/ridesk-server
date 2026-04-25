-- ============================================================================
-- Migration: 06_create_school_calendar_table.sql
-- Description: Create school_calendar table for school-specific calendar events
-- Created: 2024-12-19
-- ============================================================================

-- Create school_calendar table
CREATE TABLE IF NOT EXISTS school_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('holiday', 'maintenance', 'special_event', 'closure', 'other')),
  start_date DATE NOT NULL,
  end_date DATE,
  "start_time" TIME,
  "end_time" TIME,
  is_all_day BOOLEAN NOT NULL DEFAULT false,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_pattern TEXT CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly', 'yearly')),
  recurrence_end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for school_calendar table
CREATE INDEX IF NOT EXISTS idx_school_calendar_school_id ON school_calendar(school_id);
CREATE INDEX IF NOT EXISTS idx_school_calendar_event_type ON school_calendar(event_type);
CREATE INDEX IF NOT EXISTS idx_school_calendar_start_date ON school_calendar(start_date);
CREATE INDEX IF NOT EXISTS idx_school_calendar_end_date ON school_calendar(end_date);
CREATE INDEX IF NOT EXISTS idx_school_calendar_is_active ON school_calendar(is_active);
CREATE INDEX IF NOT EXISTS idx_school_calendar_is_recurring ON school_calendar(is_recurring);

-- Create composite index for date range queries
CREATE INDEX IF NOT EXISTS idx_school_calendar_date_range 
ON school_calendar(school_id, start_date, end_date) 
WHERE is_active = true;

-- Create triggers for updated_at
CREATE TRIGGER update_school_calendar_updated_at 
  BEFORE UPDATE ON school_calendar 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) on school_calendar table
ALTER TABLE school_calendar ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for school_calendar table
CREATE POLICY "School calendar events are viewable by school members" ON school_calendar
  FOR SELECT USING (
    school_id IN (
      SELECT s.id FROM schools s WHERE s.id = school_calendar.school_id
    )
  );

CREATE POLICY "Only school admins can manage calendar events" ON school_calendar
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR 
    (auth.jwt() ->> 'role' = 'SCHOOL_ADMIN' AND 
     school_id = (auth.jwt() ->> 'school_id')::UUID
    )
  );

-- Create function to get calendar events for date range
CREATE OR REPLACE FUNCTION get_calendar_events(
  p_school_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  id UUID,
  school_id UUID,
  title VARCHAR(255),
  description TEXT,
  event_type TEXT,
  start_date DATE,
  end_date DATE,
  "start_time" TIME,
  "end_time" TIME,
  is_all_day BOOLEAN,
  is_recurring BOOLEAN,
  recurrence_pattern TEXT,
  recurrence_end_date DATE,
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sc.id,
    sc.school_id,
    sc.title,
    sc.description,
    sc.event_type,
    sc.start_date,
    sc.end_date,
    sc.start_time as "start_time",
    sc.end_time as "end_time",
    sc.is_all_day,
    sc.is_recurring,
    sc.recurrence_pattern,
    sc.recurrence_end_date,
    sc.is_active,
    sc.created_at,
    sc.updated_at
  FROM school_calendar sc
  WHERE sc.school_id = p_school_id
    AND sc.is_active = true
    AND (
      (sc.start_date <= p_end_date AND (sc.end_date IS NULL OR sc.end_date >= p_start_date))
      OR (sc.is_recurring = true AND sc.start_date <= p_end_date)
    )
  ORDER BY sc.start_date, sc.start_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if date is available for lessons
CREATE OR REPLACE FUNCTION is_date_available_for_lessons(
  p_school_id UUID,
  p_date DATE
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if there are any blocking calendar events for this date
  RETURN NOT EXISTS (
    SELECT 1 FROM school_calendar sc
    WHERE sc.school_id = p_school_id
      AND sc.is_active = true
      AND sc.event_type IN ('holiday', 'closure', 'maintenance')
      AND (
        (sc.is_all_day = true AND sc.start_date <= p_date AND (sc.end_date IS NULL OR sc.end_date >= p_date))
        OR (sc.is_all_day = false AND sc.start_date = p_date)
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get school operating hours
CREATE OR REPLACE FUNCTION get_school_operating_hours(p_school_id UUID)
RETURNS TABLE (
  open_hours_start TIME,
  open_hours_end TIME,
  disciplines TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.open_hours_start,
    s.open_hours_end,
    s.disciplines
  FROM schools s
  WHERE s.id = p_school_id AND s.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
