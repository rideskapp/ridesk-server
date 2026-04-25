-- ============================================================================
-- Add booking_id column to lessons table to link lessons with bookings
-- ============================================================================
ALTER TABLE public.lessons
ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL;

-- Create index on booking_id for performance
CREATE INDEX IF NOT EXISTS idx_lessons_booking_id ON public.lessons(booking_id);

-- Add comment to column
COMMENT ON COLUMN public.lessons.booking_id IS 'Reference to the booking from which this lesson hours are deducted';

