-- ============================================================
-- CFF — 001: original tables (per-user answers). Kept for existing data and as the migration source.
-- Safe to run more than once.
-- ============================================================

-- 1. Profiles: one row per user per portal (Businessman, Employee, Visitor).
--    Login emails and passwords are stored by Supabase Auth (auth.users);
--    this table stores the details entered on the Create account page.
create table if not exists public.cff_profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  portal      text not null check (portal in ('business','employee','visitor')),
  full_name   text not null,
  email       text not null,
  phone       text,
  extra       text,          -- company name / organization / reason for visiting
  created_at  timestamptz not null default now(),
  unique (user_id, portal)
);

-- 2. Answers to each sub-point of the 13 stages.
create table if not exists public.cff_point_answers (
  user_id     uuid not null references auth.users(id) on delete cascade,
  portal      text not null check (portal in ('business','employee','visitor')),
  point_id    text not null,           -- e.g. s1-0-2 = Stage 1, group 0, point 2
  answer      text not null default '',
  done        boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (user_id, portal, point_id)
);

-- 3. Values assessment: 13 questions × 3 answers.
create table if not exists public.cff_value_answers (
  user_id      uuid not null references auth.users(id) on delete cascade,
  portal       text not null check (portal in ('business','employee','visitor')),
  question_no  smallint not null check (question_no between 1 and 13),
  slot         smallint not null check (slot between 1 and 3),
  answer_text  text not null default '',
  value_slug   text,                   -- matched value, e.g. health_fitness
  domain       text,                   -- e.g. Physical
  updated_at   timestamptz not null default now(),
  primary key (user_id, portal, question_no, slot)
);

-- 4. "My highest values" conclusion.
create table if not exists public.cff_top_values (
  user_id     uuid not null references auth.users(id) on delete cascade,
  portal      text not null check (portal in ('business','employee','visitor')),
  top_values  text not null default '',
  updated_at  timestamptz not null default now(),
  primary key (user_id, portal)
);

-- 5. AI assistant chat history.
create table if not exists public.cff_ai_messages (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  portal      text not null check (portal in ('business','employee','visitor')),
  role        text not null check (role in ('user','assistant')),
  content     text not null,
  page        text,                    -- where the question was asked, e.g. "Stage 1 · Vision"
  created_at  timestamptz not null default now()
);
create index if not exists cff_ai_messages_user_idx on public.cff_ai_messages (user_id, portal, created_at desc);

-- 6. AI analysis shown on the Values results tab (one per person, portal and kind).
create table if not exists public.cff_ai_analysis (
  user_id       uuid not null references auth.users(id) on delete cascade,
  portal        text not null check (portal in ('business','employee','visitor')),
  kind          text not null default 'values',
  content       text not null,
  answers_hash  text,                  -- which answers the analysis was written from
  updated_at    timestamptz not null default now(),
  primary key (user_id, portal, kind)
);

create index if not exists cff_profiles_email_idx on public.cff_profiles (lower(email));

-- ------------------------------------------------------------
-- Row Level Security
-- The website's server uses the service_role key, which bypasses RLS.
-- These policies only let a signed-in user read/change their OWN rows
-- if you ever connect to Supabase directly from another app.
-- ------------------------------------------------------------
alter table public.cff_profiles      enable row level security;
alter table public.cff_point_answers enable row level security;
alter table public.cff_value_answers enable row level security;
alter table public.cff_top_values    enable row level security;
alter table public.cff_ai_messages   enable row level security;
alter table public.cff_ai_analysis   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['cff_profiles','cff_point_answers','cff_value_answers','cff_top_values','cff_ai_messages','cff_ai_analysis'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_own_rows') then
      execute format(
        'create policy %I on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
        t || '_own_rows', t);
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------
-- Handy view for you (admin): everyone who created an account.
-- Open it in Supabase → Table Editor → cff_accounts_overview
-- ------------------------------------------------------------
create or replace view public.cff_accounts_overview
with (security_invoker = true) as
select
  p.portal,
  p.full_name,
  p.email,
  p.phone,
  p.extra,
  p.created_at,
  (select count(*) from public.cff_point_answers a where a.user_id = p.user_id and a.portal = p.portal and a.done) as points_complete,
  (select count(*) from public.cff_value_answers v where v.user_id = p.user_id and v.portal = p.portal and v.answer_text <> '') as values_answered
from public.cff_profiles p
order by p.created_at desc;
