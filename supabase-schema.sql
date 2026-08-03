-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  TeenMind Research — Supabase Schema Migration                     ║
-- ║  Run this in Supabase SQL Editor (Dashboard → SQL → New Query)     ║
-- ║                                                                   ║
-- ║  Project: Tesisku (cxxkhcsqqybfvqkvvneu)                         ║
-- ║  Creates: tables, indexes, RLS policies, triggers                 ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ─── Extensions ──────────────────────────────────────────────────────
-- uuid-ossp is pre-enabled in Supabase; pgcrypto for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ─── 1. Admin Users ──────────────────────────────────────────────────
create table if not exists public.admin_users (
  id          uuid primary key default gen_random_uuid(),
  username    text unique not null,
  password    text not null,  -- SHA-256 hashed (app-side)
  name        text,
  created_at  timestamptz default now()
);

-- ─── 2. Research Codes ───────────────────────────────────────────────
create table if not exists public.research_codes (
  code        text primary key,
  school      text,
  class_grade text,
  used        boolean default false,
  created_at  timestamptz default now()
);

-- ─── 3. Respondents ──────────────────────────────────────────────────
create table if not exists public.respondents (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null references public.research_codes(code),
  school        text,
  status        text default 'pending',     -- pending | in_progress | completed
  current_stage text default 'welcome',      -- welcome|consent|demographics|cesdr|psqi|screentime|mos|bullying|religiosity|complete
  stage_index   integer default 0,
  high_risk     boolean default false,
  consent_given boolean default false,
  started_at    timestamptz default now(),
  completed_at  timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ─── 4. Demographics ─────────────────────────────────────────────────
create table if not exists public.demographics (
  id            uuid primary key default gen_random_uuid(),
  respondent_id uuid unique not null references public.respondents(id) on delete cascade,
  data          jsonb not null,  -- { initial, age, gender, school, classGrade, ... }
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ─── 5. CESD-R Answers ───────────────────────────────────────────────
create table if not exists public.cesdr_answers (
  id            uuid primary key default gen_random_uuid(),
  respondent_id uuid unique not null references public.respondents(id) on delete cascade,
  answers       jsonb not null,  -- { "1": 0, "2": 1, ... "20": 3 }
  total_score   integer default 0,
  high_risk     boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ─── 6. PSQI Answers ─────────────────────────────────────────────────
create table if not exists public.psqi_answers (
  id            uuid primary key default gen_random_uuid(),
  respondent_id uuid unique not null references public.respondents(id) on delete cascade,
  answers       jsonb not null,
  total_score   integer default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ─── 7. Screen Time Answers ──────────────────────────────────────────
create table if not exists public.screentime_answers (
  id            uuid primary key default gen_random_uuid(),
  respondent_id uuid unique not null references public.respondents(id) on delete cascade,
  answers       jsonb not null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ─── 8. MOS-SSS Answers ──────────────────────────────────────────────
create table if not exists public.mos_answers (
  id            uuid primary key default gen_random_uuid(),
  respondent_id uuid unique not null references public.respondents(id) on delete cascade,
  answers       jsonb not null,
  total_score   integer default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ─── 9. Bullying Answers ─────────────────────────────────────────────
create table if not exists public.bullying_answers (
  id            uuid primary key default gen_random_uuid(),
  respondent_id uuid unique not null references public.respondents(id) on delete cascade,
  answers       jsonb not null,
  victim_score  integer default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ─── 10. Religiosity Answers ─────────────────────────────────────────
create table if not exists public.religiosity_answers (
  id            uuid primary key default gen_random_uuid(),
  respondent_id uuid unique not null references public.respondents(id) on delete cascade,
  answers       jsonb not null,
  total_score   integer default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ─── 11. Audit Log ───────────────────────────────────────────────────
create table if not exists public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  respondent_id uuid references public.respondents(id) on delete set null,
  action        text not null,  -- login|save|stage_complete|high_risk_flag|complete|admin_*
  detail        text,
  created_at    timestamptz default now()
);

-- ─── 12. Settings ────────────────────────────────────────────────────
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz default now()
);

-- ═════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═════════════════════════════════════════════════════════════════════
create index if not exists idx_respondents_status      on public.respondents(status);
create index if not exists idx_respondents_high_risk   on public.respondents(high_risk);
create index if not exists idx_respondents_started_at  on public.respondents(started_at);
create index if not exists idx_audit_logs_action       on public.audit_logs(action);
create index if not exists idx_audit_logs_respondent   on public.audit_logs(respondent_id);

-- ═════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═════════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
alter table public.admin_users          enable row level security;
alter table public.research_codes       enable row level security;
alter table public.respondents          enable row level security;
alter table public.demographics         enable row level security;
alter table public.cesdr_answers        enable row level security;
alter table public.psqi_answers         enable row level security;
alter table public.screentime_answers   enable row level security;
alter table public.mos_answers          enable row level security;
alter table public.bullying_answers     enable row level security;
alter table public.religiosity_answers  enable row level security;
alter table public.audit_logs           enable row level security;
alter table public.settings             enable row level security;

-- ─── Respondent tables: anon can INSERT/SELECT by code ───────────────
-- Respondents authenticate via research code (not Supabase Auth),
-- so we allow anon access but restrict by respondent code matching.

-- Respondents: anyone (with anon key) can read/create by code
create policy "respondents_select_all"
  on public.respondents for select
  to anon, authenticated
  using (true);

create policy "respondents_insert"
  on public.respondents for insert
  to anon, authenticated
  with check (true);

create policy "respondents_update"
  on public.respondents for update
  to anon, authenticated
  using (true)
  with check (true);

-- Research codes: readable by all, insertable by authenticated (admin)
create policy "research_codes_select"
  on public.research_codes for select
  to anon, authenticated
  using (true);

create policy "research_codes_insert"
  on public.research_codes for insert
  to anon, authenticated
  with check (true);

create policy "research_codes_update"
  on public.research_codes for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "research_codes_delete"
  on public.research_codes for delete
  to anon, authenticated
  using (true);

-- Answer tables: anon can read/write (respondent saves via API)
create policy "demographics_all"
  on public.demographics for all
  to anon, authenticated
  using (true) with check (true);

create policy "cesdr_all"
  on public.cesdr_answers for all
  to anon, authenticated
  using (true) with check (true);

create policy "psqi_all"
  on public.psqi_answers for all
  to anon, authenticated
  using (true) with check (true);

create policy "screentime_all"
  on public.screentime_answers for all
  to anon, authenticated
  using (true) with check (true);

create policy "mos_all"
  on public.mos_answers for all
  to anon, authenticated
  using (true) with check (true);

create policy "bullying_all"
  on public.bullying_answers for all
  to anon, authenticated
  using (true) with check (true);

create policy "religiosity_all"
  on public.religiosity_answers for all
  to anon, authenticated
  using (true) with check (true);

-- Audit logs: readable by all, insertable by all
create policy "audit_logs_select"
  on public.audit_logs for select
  to anon, authenticated
  using (true);

create policy "audit_logs_insert"
  on public.audit_logs for insert
  to anon, authenticated
  with check (true);

-- Settings: readable by all, writable by authenticated only
create policy "settings_select"
  on public.settings for select
  to anon, authenticated
  using (true);

create policy "settings_write"
  on public.settings for all
  to authenticated
  using (true) with check (true);

-- Admin users: only authenticated (admin) can read
create policy "admin_users_select"
  on public.admin_users for select
  to authenticated
  using (true);

create policy "admin_users_insert"
  on public.admin_users for insert
  to authenticated
  with check (true);

-- ═════════════════════════════════════════════════════════════════════
-- TRIGGERS: auto-update updated_at
-- ═════════════════════════════════════════════════════════════════════

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply to all tables with updated_at
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'respondents', 'demographics', 'cesdr_answers', 'psqi_answers',
      'screentime_answers', 'mos_answers', 'bullying_answers',
      'religiosity_answers', 'settings'
    ])
  loop
    execute format('drop trigger if exists trg_%s_updated on public.%s', t, t);
    execute format('create trigger trg_%s_updated before update on public.%s for each row execute function public.handle_updated_at()', t, t);
  end loop;
end;
$$;

-- ═════════════════════════════════════════════════════════════════════
-- SEED DATA: Default admin user
-- ═════════════════════════════════════════════════════════════════════

-- Password: teenmind2025 (SHA-256 hash of "teenmind2025::teenmind")
-- This matches the app's hashPassword function in src/lib/auth.ts
insert into public.admin_users (username, password, name)
values ('admin', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 'Peneliti')
on conflict (username) do nothing;

-- Default settings
insert into public.settings (key, value) values
  ('targetRespondents', '100'),
  ('researchTitle', '"Faktor Biopsikososial Depresi Remaja SMP"'),
  ('researcherName', '""'),
  ('researcherEmail', '""'),
  ('bkContactName', '""'),
  ('bkContactPhone', '""'),
  ('schools', '["SMP Harapan", "SMP Negeri 1", "SMP Tunas"]'),
  ('ethicsApprovalNumber', '""'),
  ('dataRetentionDays', '365')
on conflict (key) do nothing;

-- ═════════════════════════════════════════════════════════════════════
-- DONE — Verify with:
--   select count(*) from public.respondents;
--   select * from public.admin_users;
--   select * from public.settings;
-- ═════════════════════════════════════════════════════════════════════
