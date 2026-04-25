-- ============================================================================
-- Create bookings table
-- ============================================================================
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  product_id uuid not null,
  total_minutes integer not null default 0,
  remaining_minutes integer not null default 0,
  start_date date not null,
  end_date date not null,
  status text not null default 'active',
  notes text default '',
  created_by uuid not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Indexes
create index if not exists idx_bookings_school on public.bookings(school_id);
create index if not exists idx_bookings_product on public.bookings(product_id);
create index if not exists idx_bookings_dates on public.bookings(start_date, end_date);

-- Foreign keys
alter table public.bookings
  add constraint fk_bookings_school foreign key (school_id) references public.schools(id) on delete cascade;

alter table public.bookings
  add constraint fk_bookings_product foreign key (product_id) references public.products(id) on delete restrict;

alter table public.bookings
  add constraint fk_bookings_created_by foreign key (created_by) references public.users(id) on delete set null;

-- Trigger to update updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_bookings_set_updated_at on public.bookings;
create trigger trg_bookings_set_updated_at
before update on public.bookings
for each row
execute procedure public.set_updated_at();


