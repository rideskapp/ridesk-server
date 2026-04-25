-- Ensure booking payment_status values are constrained to supported states.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'payment_status'
  ) and not exists (
    select 1
    from pg_constraint
    where conname = 'booking_payment_status_check'
  ) then
    alter table public.bookings
      add constraint booking_payment_status_check
      check (
        payment_status in ('paid', 'partially_paid', 'unpaid', 'pending', 'overdue')
      );
  end if;
end $$;
