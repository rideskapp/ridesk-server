-- amount_paid is derived from booking_payments history
-- and should not be stored on bookings.
alter table public.bookings
  drop column if exists amount_paid;
