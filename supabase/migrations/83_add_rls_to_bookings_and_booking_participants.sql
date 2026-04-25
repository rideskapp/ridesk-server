-- ============================================================================
-- Migration: 83_add_rls_to_bookings_and_booking_participants.sql
-- Description: Enable Row Level Security on bookings and booking_participants
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. bookings
-- ----------------------------------------------------------------------------
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to bookings" ON public.bookings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "School admins and super admins can manage bookings" ON public.bookings
  FOR ALL TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR
    (auth.jwt() ->> 'role' = 'SCHOOL_ADMIN' AND school_id = (auth.jwt() ->> 'school_id')::UUID)
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR
    (auth.jwt() ->> 'role' = 'SCHOOL_ADMIN' AND school_id = (auth.jwt() ->> 'school_id')::UUID)
  );

-- ----------------------------------------------------------------------------
-- 2. booking_participants
-- ----------------------------------------------------------------------------
ALTER TABLE public.booking_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to booking_participants" ON public.booking_participants
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "School admins and super admins can manage booking_participants" ON public.booking_participants
  FOR ALL TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR
    (auth.jwt() ->> 'role' = 'SCHOOL_ADMIN' AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_participants.booking_id
        AND b.school_id = (auth.jwt() ->> 'school_id')::UUID
    ))
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'SUPER_ADMIN' OR
    (auth.jwt() ->> 'role' = 'SCHOOL_ADMIN' AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_participants.booking_id
        AND b.school_id = (auth.jwt() ->> 'school_id')::UUID
    ))
  );

-- ----------------------------------------------------------------------------
-- 3. GRANTs
-- ----------------------------------------------------------------------------
GRANT ALL ON public.bookings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;

GRANT ALL ON public.booking_participants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_participants TO authenticated;
