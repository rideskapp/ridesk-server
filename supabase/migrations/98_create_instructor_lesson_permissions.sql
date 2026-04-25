-- Per-instructor, per-school lesson edit permissions
create table if not exists public.instructor_lesson_permissions (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  can_edit_lessons boolean not null default false,
  created_by uuid null references public.users(id) on delete set null,
  updated_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instructor_lesson_permissions_unique unique (instructor_id, school_id)
);

create index if not exists idx_ilp_instructor_school
  on public.instructor_lesson_permissions (instructor_id, school_id);

create index if not exists idx_ilp_school
  on public.instructor_lesson_permissions (school_id);
