-- School Calendar schema: weekly base availability + special-date exceptions (per school)

create extension if not exists pgcrypto;

-- 1) Weekly base availability
create table if not exists public.school_availability (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, weekday)
);

-- 2) Special date exceptions
create table if not exists public.school_special_dates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  date date not null,
  is_available boolean not null default true,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, date)
);

-- Updated_at triggers
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_school_availability_updated on public.school_availability;
create trigger trg_school_availability_updated
before update on public.school_availability
for each row execute function public.set_updated_at();

drop trigger if exists trg_school_special_dates_updated on public.school_special_dates;
create trigger trg_school_special_dates_updated
before update on public.school_special_dates
for each row execute function public.set_updated_at();

-- Seed helper to ensure 7 weekday rows exist (Mon=0 .. Sun=6)
create or replace function public.ensure_weekly_defaults(p_school_id uuid)
returns void as $$
declare
  d int;
begin
  for d in 0..6 loop
    insert into public.school_availability (school_id, weekday, is_available)
    values (p_school_id, d, true)
    on conflict (school_id, weekday) do nothing;
  end loop;
end;
$$ language plpgsql;


-- Enable Row Level Security and add read policies for authenticated users
alter table public.school_availability enable row level security;
alter table public.school_special_dates enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='school_availability' and policyname='read_availability_authenticated'
  ) then
    create policy read_availability_authenticated
      on public.school_availability
      for select
      to authenticated
      using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='school_special_dates' and policyname='read_special_dates_authenticated'
  ) then
    create policy read_special_dates_authenticated
      on public.school_special_dates
      for select
      to authenticated
      using (true);
  end if;
end $$;

