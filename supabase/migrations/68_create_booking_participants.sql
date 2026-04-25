-- ============================================================================
-- Create booking_participants table
-- ============================================================================
create table if not exists public.booking_participants (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  student_id uuid not null,
  created_at timestamp with time zone not null default now()
);

-- Indexes
create index if not exists idx_booking_participants_booking on public.booking_participants(booking_id);
create index if not exists idx_booking_participants_student on public.booking_participants(student_id);

-- Foreign keys
alter table public.booking_participants
  add constraint fk_booking_participants_booking foreign key (booking_id) references public.bookings(id) on delete cascade;

alter table public.booking_participants
  add constraint fk_booking_participants_student foreign key (student_id) references public.users(id) on delete cascade;


