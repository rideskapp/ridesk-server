-- Booking-centric financial control
-- Adds booking-level financial fields, booking payment ledger,
-- and category-level lesson associability toggle.

alter table public.product_categories
  add column if not exists associable_to_lessons boolean not null default true;

alter table public.bookings
  add column if not exists total_price numeric(10,2) not null default 0,
  add column if not exists discount_amount numeric(10,2) not null default 0,
  add column if not exists final_price numeric(10,2) not null default 0,
  add column if not exists amount_paid numeric(10,2) not null default 0,
  add column if not exists outstanding_amount numeric(10,2) not null default 0,
  add column if not exists payment_status text not null default 'unpaid';

create table if not exists public.booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  payment_date timestamptz not null,
  payment_method text,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_booking_payments_booking_id
  on public.booking_payments(booking_id);

create index if not exists idx_booking_payments_school_id
  on public.booking_payments(school_id);

create index if not exists idx_booking_payments_date
  on public.booking_payments(payment_date);
