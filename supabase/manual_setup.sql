-- Run this once in Supabase Dashboard > SQL Editor for project hwrckmdtcdvpxtpwtsrj.
-- It creates the HireFit schema expected by the frontend and backend.

create extension if not exists pgcrypto;

do $$
begin
  create type public.pipeline_stage as enum ('new','reviewed','shortlisted','contacted','interviewing','offered','rejected','hired');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.match_tier as enum ('strong_fit','good_fit','possible_fit','not_fit');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.activity_action as enum ('called','sms_sent','email_sent','stage_changed','note');
exception when duplicate_object then null;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- USERS TABLE (allowed_emails)
--
-- This is the main user/login management table for HireFit.
-- The Admin Panel lets you create, update, and delete rows here.
-- Login flow:
--   1. Super Admin email+password is set via environment variables on Render.
--   2. All other users are stored here with a bcrypt-style hashed password.
-- Roles:
--   super_admin  → full access (set via env var, not editable in DB)
--   admin        → can manage jobs, candidates, and users
--   recruiter    → can manage jobs and candidates only
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.allowed_emails (
  email         text primary key,
  name          text,                                       -- display name (optional)
  password_hash text,                                      -- PBKDF2 hashed password set by admin
  role          text not null default 'recruiter',          -- super_admin | admin | recruiter
  is_active     boolean not null default true,              -- set false to disable login without deleting
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Auto-update updated_at on row change
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists allowed_emails_updated_at on public.allowed_emails;
create trigger allowed_emails_updated_at
  before update on public.allowed_emails
  for each row execute function public.set_updated_at();

-- Grants & RLS
grant select on public.allowed_emails to anon, authenticated;
grant all on public.allowed_emails to service_role;
alter table public.allowed_emails enable row level security;
drop policy if exists "Authenticated can read allow list" on public.allowed_emails;
create policy "Authenticated can read allow list" on public.allowed_emails
  for select to anon, authenticated using (true);

-- Seed the default super admin (email only; password comes from env var)
insert into public.allowed_emails(email, name, role)
values ('vikas.raiexp@gmail.com', 'Vikas Rai', 'super_admin')
on conflict (email) do update
  set name = excluded.name,
      role = excluded.role;

-- ─────────────────────────────────────────────────────────────────────────────
-- ALLOWLIST GUARD — only users in allowed_emails can sign in via Supabase Auth
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.enforce_email_allowlist()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.allowed_emails
    where lower(email) = lower(new.email)
      and is_active = true
  ) then
    raise exception 'Email % is not authorized to sign in to HireFit', new.email;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_email_allowlist_trigger on auth.users;
create trigger enforce_email_allowlist_trigger
  before insert on auth.users
  for each row execute function public.enforce_email_allowlist();

revoke execute on function public.enforce_email_allowlist() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- JOBS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.jobs (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  jd_text    text not null default '',
  is_active  boolean not null default true,   -- false = hidden from job board
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.jobs to anon, authenticated;
grant all on public.jobs to service_role;
alter table public.jobs enable row level security;
drop policy if exists "Auth users manage jobs" on public.jobs;
create policy "Auth users manage jobs" on public.jobs
  for all to anon, authenticated using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- CANDIDATES TABLE
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.candidates (
  id                      uuid primary key default gen_random_uuid(),
  job_id                  uuid not null references public.jobs(id) on delete cascade,
  name                    text not null,
  email                   text,
  phone                   text,
  current_location        text,
  preferred_locations     text,
  total_experience_years  numeric,
  current_company         text,
  current_designation     text,
  annual_salary_inr       numeric,
  notice_period           text,
  resume_headline         text,
  education_summary       text,
  naukri_profile_url      text,
  screening_answers       jsonb,
  pipeline_stage          public.pipeline_stage not null default 'new',
  resume_url              text,
  resume_text             text,
  created_at              timestamptz not null default now()
);

create index if not exists candidates_job_id_idx on public.candidates(job_id);
create index if not exists candidates_stage_idx  on public.candidates(pipeline_stage);
grant select, insert, update, delete on public.candidates to anon, authenticated;
grant all on public.candidates to service_role;
alter table public.candidates enable row level security;
drop policy if exists "Auth users manage candidates" on public.candidates;
create policy "Auth users manage candidates" on public.candidates
  for all to anon, authenticated using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- MATCH SCORES TABLE
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.match_scores (
  id                     uuid primary key default gen_random_uuid(),
  candidate_id           uuid not null unique references public.candidates(id) on delete cascade,
  overall_score          integer not null check (overall_score between 0 and 100),
  tier                   public.match_tier not null,
  domain_match_score     integer,
  experience_match_score integer,
  seniority_match_score  integer,
  strengths              text[] not null default '{}',
  gaps                   text[] not null default '{}',
  red_flags              text[] not null default '{}',
  ai_summary             text,
  scored_at              timestamptz not null default now()
);

create index if not exists match_scores_candidate_idx on public.match_scores(candidate_id);
grant select, insert, update, delete on public.match_scores to anon, authenticated;
grant all on public.match_scores to service_role;
alter table public.match_scores enable row level security;
drop policy if exists "Auth users manage match_scores" on public.match_scores;
create policy "Auth users manage match_scores" on public.match_scores
  for all to anon, authenticated using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- ACTIVITY LOG TABLE
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.activity_log (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  action       public.activity_action not null,
  notes        text,
  actor        text,
  created_at   timestamptz not null default now()
);

create index if not exists activity_log_candidate_idx
  on public.activity_log(candidate_id, created_at desc);
grant select, insert, update, delete on public.activity_log to anon, authenticated;
grant all on public.activity_log to service_role;
alter table public.activity_log enable row level security;
drop policy if exists "Auth users manage activity_log" on public.activity_log;
create policy "Auth users manage activity_log" on public.activity_log
  for all to anon, authenticated using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- STORAGE — Resume bucket
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do update set public = false;

drop policy if exists "Auth read resumes"   on storage.objects;
drop policy if exists "Auth insert resumes" on storage.objects;
drop policy if exists "Auth update resumes" on storage.objects;
drop policy if exists "Auth delete resumes" on storage.objects;
create policy "Auth read resumes"   on storage.objects for select to anon, authenticated using (bucket_id = 'resumes');
create policy "Auth insert resumes" on storage.objects for insert to anon, authenticated with check (bucket_id = 'resumes');
create policy "Auth update resumes" on storage.objects for update to anon, authenticated using (bucket_id = 'resumes') with check (bucket_id = 'resumes');
create policy "Auth delete resumes" on storage.objects for delete to anon, authenticated using (bucket_id = 'resumes');

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION HELPERS — Run these if you already have an older schema
-- (safe to run even on a fresh install — they use IF NOT EXISTS / DO NOTHING)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.jobs          add column if not exists is_active     boolean     not null default true;
alter table public.allowed_emails add column if not exists name          text;
alter table public.allowed_emails add column if not exists password_hash text;
alter table public.allowed_emails add column if not exists role          text        not null default 'recruiter';
alter table public.allowed_emails add column if not exists is_active     boolean     not null default true;
alter table public.allowed_emails add column if not exists updated_at    timestamptz not null default now();
