-- Synchronize public.schools schema to expected shape
-- This script is idempotent and safe to run multiple times.

-- Ensure table exists (if your baseline creates it elsewhere, this is still safe)
create table if not exists public.schools (
  id uuid primary key,
  disciplines text[] default '{}'::text[],
  open_hours_start text,
  open_hours_end text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add all expected columns if missing
alter table public.schools
  add column if not exists name text,
  add column if not exists slug text,
  add column if not exists logo text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists website text,
  add column if not exists spot_name text,
  add column if not exists windguru_url text,
  add column if not exists open_hours_start text,
  add column if not exists open_hours_end text,
  add column if not exists disciplines text[],
  add column if not exists is_active boolean,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

comment on column public.schools.website is 'Public website URL for the school';

-- Useful index/constraint
create unique index if not exists schools_slug_unique on public.schools (slug);

-- Trigger to keep updated_at fresh (optional but helpful)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_schools_updated_at on public.schools;
create trigger trg_schools_updated_at
before update on public.schools
for each row execute function public.set_updated_at();


