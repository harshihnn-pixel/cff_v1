-- CFF – Company Formation & Growth OS: complete database setup (migrations 001–006 in order).
-- Safe to run on a new project or on the existing CFF database. It never deletes data, and it can be re-run.

-- ================= 001_base.sql =================
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

-- ================= 002_workspace_tables.sql =================
-- ============================================================
-- CFF 2.0 — Company Formation & Growth Operating System
-- 002: company workspace tables
-- Safe to run more than once: only creates what is missing. Never drops or deletes data.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Companies, members, roles, permissions ----------

create table if not exists public.cff_companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 1 and 160),
  legal_name    text,
  industry      text,
  description   text,
  city          text,
  country       text default 'India',
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  archived_at   timestamptz
);

-- Platform-wide administrators (set by you in SQL; see README).
create table if not exists public.cff_super_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- Catalog of permissions (what can be switched on or off per role).
create table if not exists public.cff_permissions (
  key          text primary key,
  label        text not null,
  section      text not null,
  sort         int not null default 0
);

-- Default permissions for each role; copied into every new company.
create table if not exists public.cff_default_role_permissions (
  role_key     text not null check (role_key in ('owner','founder','manager','hr','employee','viewer')),
  permission   text not null references public.cff_permissions(key) on delete cascade,
  primary key (role_key, permission)
);

-- Per-company permissions (the owner can change these in Settings).
create table if not exists public.cff_role_permissions (
  company_id   uuid not null references public.cff_companies(id) on delete cascade,
  role_key     text not null check (role_key in ('owner','founder','manager','hr','employee','viewer')),
  permission   text not null references public.cff_permissions(key) on delete cascade,
  allowed      boolean not null default true,
  primary key (company_id, role_key, permission)
);

create table if not exists public.cff_company_members (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.cff_companies(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role_key      text not null default 'employee' check (role_key in ('owner','founder','manager','hr','employee','viewer')),
  display_name  text,
  email         text,
  designation   text,
  status        text not null default 'active' check (status in ('active','removed')),
  invited_by    uuid references auth.users(id) on delete set null,
  joined_at     timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, user_id)
);
create index if not exists cff_members_user_idx on public.cff_company_members (user_id);

create table if not exists public.cff_invitations (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.cff_companies(id) on delete cascade,
  email         text not null,
  role_key      text not null check (role_key in ('founder','manager','hr','employee','viewer')),
  designation   text,
  employee_id   uuid,                      -- set when the invitation is for an employee record
  invited_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  accepted_by   uuid references auth.users(id) on delete set null,
  revoked_at    timestamptz
);
create index if not exists cff_invitations_email_idx on public.cff_invitations (lower(email)) where accepted_at is null and revoked_at is null;

-- ---------- CFF core: answers, stage status, approvals, versions ----------

create table if not exists public.cff_answers (
  company_id   uuid not null references public.cff_companies(id) on delete cascade,
  point_id     text not null check (point_id ~ '^s[0-9]{1,2}-[0-9]{1,2}-[0-9]{1,2}$'),
  stage        smallint generated always as ((substring(point_id from '^s([0-9]+)'))::smallint) stored,
  answer       text not null default '',
  done         boolean not null default false,
  updated_by   uuid references auth.users(id) on delete set null,
  updated_at   timestamptz not null default now(),
  primary key (company_id, point_id)
);

create table if not exists public.cff_stage_status (
  company_id    uuid not null references public.cff_companies(id) on delete cascade,
  stage         smallint not null check (stage between 1 and 13),
  status        text not null default 'not_started'
                check (status in ('not_started','draft','in_progress','ready_for_review','approved','reopened')),
  submitted_by  uuid references auth.users(id) on delete set null,
  submitted_at  timestamptz,
  approved_by   uuid references auth.users(id) on delete set null,
  approved_at   timestamptz,
  comment       text,
  updated_by    uuid references auth.users(id) on delete set null,
  updated_at    timestamptz not null default now(),
  primary key (company_id, stage)
);

create table if not exists public.cff_stage_approvals (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.cff_companies(id) on delete cascade,
  stage        smallint not null check (stage between 1 and 13),
  action       text not null check (action in ('submit','approve','request_changes','reopen')),
  comment      text,
  actor_id     uuid references auth.users(id) on delete set null default auth.uid(),
  actor_name   text,
  created_at   timestamptz not null default now()
);
create index if not exists cff_stage_approvals_idx on public.cff_stage_approvals (company_id, stage, created_at desc);

-- Version history for strategic information (written by triggers only).
create table if not exists public.cff_versions (
  id           bigint generated always as identity primary key,
  company_id   uuid not null references public.cff_companies(id) on delete cascade,
  entity       text not null,              -- 'answer', 'company_value', 'shareholding', 'stage_snapshot', ...
  entity_key   text not null,              -- e.g. point id, value id, stage number
  old_value    jsonb,
  new_value    jsonb,
  changed_by   uuid references auth.users(id) on delete set null,
  changed_by_name text,
  changed_at   timestamptz not null default now()
);
create index if not exists cff_versions_idx on public.cff_versions (company_id, entity, entity_key, changed_at desc);

-- ---------- Values: personal assessment (per member) and final company values ----------

create table if not exists public.cff_values_answers (
  company_id   uuid not null references public.cff_companies(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  question_no  smallint not null check (question_no between 1 and 13),
  slot         smallint not null check (slot between 1 and 3),
  answer_text  text not null default '',
  value_slug   text,
  domain       text,
  updated_at   timestamptz not null default now(),
  primary key (company_id, user_id, question_no, slot)
);

create table if not exists public.cff_values_top (
  company_id   uuid not null references public.cff_companies(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  top_values   text not null default '',
  updated_at   timestamptz not null default now(),
  primary key (company_id, user_id)
);

create table if not exists public.cff_company_values (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references public.cff_companies(id) on delete cascade,
  name                   text not null check (char_length(name) between 1 and 80),
  meaning                text,
  why_it_matters         text,
  expected_behavior      text,
  unacceptable_behavior  text,
  customer_promise       text,
  status                 text not null default 'draft' check (status in ('draft','approved')),
  approved_by            uuid references auth.users(id) on delete set null,
  approved_at            timestamptz,
  sort                   int not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ---------- Partners (Stages 3 and 4) ----------

create table if not exists public.cff_partners (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.cff_companies(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,   -- linked login, if the partner is a member
  full_name    text not null check (char_length(full_name) between 1 and 120),
  designation  text,
  profile      jsonb not null default '{}'::jsonb,                 -- the partner profile fields
  status       text not null default 'active' check (status in ('active','archived')),
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists cff_partners_company_idx on public.cff_partners (company_id);

-- ---------- Structure (Stage 5) and organisation ----------

create table if not exists public.cff_departments (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.cff_companies(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 80),
  description  text,
  parent_id    uuid references public.cff_departments(id) on delete set null,
  sort         int not null default 0,
  created_at   timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists public.cff_employees (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.cff_companies(id) on delete cascade,
  user_id              uuid references auth.users(id) on delete set null,   -- set when the employee has a login
  full_name            text not null check (char_length(full_name) between 1 and 120),
  email                text,
  phone                text,
  designation          text,
  department_id        uuid references public.cff_departments(id) on delete set null,
  reporting_manager_id uuid references public.cff_employees(id) on delete set null,
  responsibilities     text,
  joined_on            date,
  status               text not null default 'active' check (status in ('active','inactive')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists cff_employees_company_idx on public.cff_employees (company_id);
create index if not exists cff_employees_user_idx on public.cff_employees (user_id);

create table if not exists public.cff_positions (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.cff_companies(id) on delete cascade,
  holder_type        text not null default 'partner' check (holder_type in ('partner','employee','vacant')),
  partner_id         uuid references public.cff_partners(id) on delete set null,
  employee_id        uuid references public.cff_employees(id) on delete set null,
  holder_name        text,
  designation        text not null,
  department_id      uuid references public.cff_departments(id) on delete set null,
  role               text,
  responsibilities   text,
  authority_level    text check (authority_level in ('board','executive','senior','middle','staff')),
  reports_to         uuid references public.cff_positions(id) on delete set null,
  sort               int not null default 0,
  created_at         timestamptz not null default now()
);

create table if not exists public.cff_shareholding (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references public.cff_companies(id) on delete cascade,
  partner_id             uuid not null references public.cff_partners(id) on delete cascade,
  percent                numeric(6,3) not null default 0 check (percent >= 0 and percent <= 100),
  financial_contribution text,
  time_contribution      text,
  responsibilities       text,
  long_term_commitment   text,
  value_contribution     text,
  updated_at             timestamptz not null default now(),
  unique (company_id, partner_id)
);

create table if not exists public.cff_decision_authority (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.cff_companies(id) on delete cascade,
  category         text not null check (category in ('strategic','financial','operational','hiring','marketing','sales','legal','technology')),
  decision         text not null,
  decided_by       text,
  approval_needed  text,
  limit_note       text,
  sort             int not null default 0,
  created_at       timestamptz not null default now()
);

create table if not exists public.cff_raci (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.cff_companies(id) on delete cascade,
  task         text not null,
  responsible  text,
  accountable  text,
  consulted    text,
  informed     text,
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);

-- ---------- Master profile (Stage 7), names (Stage 8), brand (Stage 9) ----------

create table if not exists public.cff_company_profiles (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.cff_companies(id) on delete cascade,
  version      int not null,
  status       text not null default 'draft' check (status in ('draft','approved','superseded')),
  source       text not null default 'manual' check (source in ('manual','ai','mixed')),
  content      jsonb not null default '{}'::jsonb,
  note         text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  approved_by  uuid references auth.users(id) on delete set null,
  approved_at  timestamptz,
  unique (company_id, version)
);

create table if not exists public.cff_company_names (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.cff_companies(id) on delete cascade,
  name               text not null check (char_length(name) between 1 and 120),
  meaning            text,
  purpose_link       text,
  values_link        text,
  memorability       smallint check (memorability between 1 and 5),
  domain_status      text not null default 'not_checked',
  social_status      text not null default 'not_checked',
  trademark_status   text not null default 'not_checked',
  legal_status       text not null default 'not_checked',
  checklist          jsonb not null default '{}'::jsonb,
  notes              text,
  status             text not null default 'considering' check (status in ('considering','shortlisted','rejected','selected')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.cff_brand (
  company_id   uuid primary key references public.cff_companies(id) on delete cascade,
  fields       jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

-- ---------- Documents ----------

create table if not exists public.cff_documents (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.cff_companies(id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 200),
  category       text not null default 'other' check (category in ('incorporation','legal','finance','tax','hr','partner_agreements','brand','marketing','sales','operations','compliance','sops','other')),
  description    text,
  storage_path   text not null,
  mime_type      text,
  size_bytes     bigint,
  version        int not null default 1,
  previous_id    uuid references public.cff_documents(id) on delete set null,
  expiry_date    date,
  access         text not null default 'managers' check (access in ('everyone','managers','founders','owner')),
  uploaded_by    uuid references auth.users(id) on delete set null,
  uploaded_at    timestamptz not null default now(),
  archived_at    timestamptz
);
create index if not exists cff_documents_company_idx on public.cff_documents (company_id, category);

create table if not exists public.cff_brand_assets (
  company_id    uuid not null references public.cff_companies(id) on delete cascade,
  kind          text not null check (kind in ('primary_logo','secondary_logo','icon','monochrome_logo','light_logo','dark_logo')),
  document_id   uuid not null references public.cff_documents(id) on delete cascade,
  updated_at    timestamptz not null default now(),
  primary key (company_id, kind)
);

-- ---------- Planning (Stage 10), tasks, compliance (Stage 11) ----------

create table if not exists public.cff_plan_items (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.cff_companies(id) on delete cascade,
  plan           text not null check (plan in ('launch','first_customer','marketing','sales','operations','financial','hiring','growth','risk','milestones','execution')),
  title          text not null check (char_length(title) between 1 and 200),
  description    text,
  category       text,
  owner_name     text,
  owner_member_id uuid references public.cff_company_members(id) on delete set null,
  priority       text not null default 'medium' check (priority in ('low','medium','high','critical')),
  start_date     date,
  deadline       date,
  status         text not null default 'not_started' check (status in ('not_started','planned','in_progress','blocked','completed','cancelled')),
  progress       smallint not null default 0 check (progress between 0 and 100),
  dependencies   text,
  notes          text,
  sort           int not null default 0,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists cff_plan_items_company_idx on public.cff_plan_items (company_id, plan);

create table if not exists public.cff_tasks (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.cff_companies(id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 200),
  stage            smallint check (stage between 1 and 13),
  department_id    uuid references public.cff_departments(id) on delete set null,
  assigned_to      uuid references public.cff_company_members(id) on delete set null,
  priority         text not null default 'medium' check (priority in ('low','medium','high','critical')),
  start_date       date,
  due_date         date,
  status           text not null default 'not_started' check (status in ('not_started','in_progress','blocked','completed','cancelled')),
  progress         smallint not null default 0 check (progress between 0 and 100),
  notes            text,
  attachment_id    uuid references public.cff_documents(id) on delete set null,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  completed_at     timestamptz
);
create index if not exists cff_tasks_company_idx on public.cff_tasks (company_id, status, due_date);
create index if not exists cff_tasks_assignee_idx on public.cff_tasks (assigned_to);

create table if not exists public.cff_compliance_items (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.cff_companies(id) on delete cascade,
  item_key             text,                                   -- catalog key, e.g. 'gst'; null for custom items
  name                 text not null,
  category             text not null default 'registration' check (category in ('structure','registration','tax','licence','agreement','insurance','statutory','other')),
  applicability        text not null default 'pending_verification' check (applicability in ('required','not_required','pending_verification')),
  status               text not null default 'not_started' check (status in ('not_started','in_progress','submitted','approved','rejected','expired','not_applicable')),
  responsible_member_id uuid references public.cff_company_members(id) on delete set null,
  responsible_name     text,
  due_date             date,
  completion_date      date,
  registration_number  text,
  renewal_date         date,
  document_id          uuid references public.cff_documents(id) on delete set null,
  notes                text,
  sort                 int not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (company_id, item_key)
);

-- ---------- Employee content: SOPs, policies, training, announcements ----------

create table if not exists public.cff_content (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.cff_companies(id) on delete cascade,
  kind            text not null check (kind in ('sop','policy','training','announcement')),
  title           text not null check (char_length(title) between 1 and 200),
  body            text not null default '',
  department_id   uuid references public.cff_departments(id) on delete set null,
  requires_ack    boolean not null default true,
  published_by    uuid references auth.users(id) on delete set null,
  published_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz
);

create table if not exists public.cff_acknowledgements (
  content_id       uuid not null references public.cff_content(id) on delete cascade,
  company_id       uuid not null references public.cff_companies(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade default auth.uid(),
  acknowledged_at  timestamptz not null default now(),
  primary key (content_id, user_id)
);

-- ---------- KPIs and reviews (Stage 13) ----------

create table if not exists public.cff_kpis (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.cff_companies(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 120),
  department_id   uuid references public.cff_departments(id) on delete set null,
  employee_id     uuid references public.cff_employees(id) on delete set null,   -- set for an employee KPI
  owner_name      text,
  unit            text,
  target          numeric,
  direction       text not null default 'higher' check (direction in ('higher','lower')),
  period_type     text not null default 'monthly' check (period_type in ('monthly','quarterly','annual')),
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.cff_kpi_results (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.cff_companies(id) on delete cascade,
  kpi_id             uuid not null references public.cff_kpis(id) on delete cascade,
  period             text not null,                 -- 2026-09, 2026-Q3 or 2026
  target             numeric,
  actual             numeric,
  status             text check (status in ('on_track','at_risk','off_track')),
  comments           text,
  corrective_action  text,
  recorded_by        uuid references auth.users(id) on delete set null,
  recorded_at        timestamptz not null default now(),
  unique (kpi_id, period)
);

create table if not exists public.cff_reviews (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.cff_companies(id) on delete cascade,
  review_type    text not null check (review_type in ('monthly','quarterly','annual')),
  period         text not null,
  sections       jsonb not null default '{}'::jsonb,   -- goals, customer feedback, challenges, improvements, ...
  summary        text,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (company_id, review_type, period)
);

-- ---------- Notifications, activity, AI ----------

create table if not exists public.cff_notifications (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid references public.cff_companies(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null,
  title        text not null,
  body         text,
  link         text,
  dedupe_key   text,
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  unique (user_id, dedupe_key)
);
create index if not exists cff_notifications_user_idx on public.cff_notifications (user_id, read_at, created_at desc);

create table if not exists public.cff_activity_logs (
  id           bigint generated always as identity primary key,
  company_id   uuid references public.cff_companies(id) on delete cascade,
  user_id      uuid,
  actor_name   text,
  action       text not null,
  entity       text not null,
  entity_id    text,
  summary      text,
  old_value    jsonb,
  new_value    jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists cff_activity_company_idx on public.cff_activity_logs (company_id, created_at desc);

create table if not exists public.cff_ai_chats (
  id           bigint generated always as identity primary key,
  company_id   uuid not null references public.cff_companies(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null check (role in ('user','assistant')),
  content      text not null,
  page         text,
  created_at   timestamptz not null default now()
);
create index if not exists cff_ai_chats_idx on public.cff_ai_chats (company_id, user_id, created_at desc);

-- AI outputs kept separate from approved company information.
create table if not exists public.cff_ai_outputs (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.cff_companies(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,     -- null = shared with the company
  kind         text not null,          -- 'values_analysis', 'partner_summary', 'recommendations', ...
  subject      text not null default '',
  content      text not null,
  input_hash   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists cff_ai_outputs_key on public.cff_ai_outputs (company_id, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, subject);

-- Migration bookkeeping (legacy per-user data → company workspaces).
create table if not exists public.cff_migration_log (
  user_id          uuid primary key,
  company_id       uuid,
  source_portal    text,
  points_copied    int,
  values_copied    int,
  chats_copied     int,
  migrated_at      timestamptz not null default now()
);

-- Company settings (e.g. enforce readiness rules). Added separately so older installs get it too.
alter table public.cff_companies add column if not exists settings jsonb not null default '{}'::jsonb;

-- ================= 003_security.sql =================
-- ============================================================
-- CFF 2.0 — 003: roles, permissions, database rules and Row Level Security
-- Safe to run more than once.
-- ============================================================

-- ---------- Permission catalog ----------
insert into public.cff_permissions (key, label, section, sort) values
  ('company.manage',     'Manage company settings',                  'Company',     10),
  ('members.manage',     'Add, change and remove members',           'Company',     11),
  ('cff.view',           'View the 13 CFF stages and answers',       'CFF',         20),
  ('cff.edit',           'Edit CFF answers and submit for review',   'CFF',         21),
  ('cff.approve',        'Approve, request changes, reopen stages',  'CFF',         22),
  ('partners.view',      'View partners and partner profiles',       'Partners',    30),
  ('partners.edit',      'Add and edit partners',                    'Partners',    31),
  ('partners.financial', 'See and edit shareholding and contributions','Partners',  32),
  ('structure.view',     'View structure, roles and authority',      'Structure',   40),
  ('structure.edit',     'Edit structure, roles and authority',      'Structure',   41),
  ('values.view',        'View company values',                      'Values',      50),
  ('values.edit',        'Edit and approve company values',          'Values',      51),
  ('profile.view',       'View the approved master company profile', 'Profile',     60),
  ('profile.edit',       'Create and edit master profile drafts',    'Profile',     61),
  ('names.edit',         'Manage candidate company names',           'Brand',       70),
  ('brand.view',         'View the brand identity',                  'Brand',       71),
  ('brand.edit',         'Edit the brand identity and logos',        'Brand',       72),
  ('plans.view',         'View plans and milestones',                'Execution',   80),
  ('plans.edit',         'Edit plans and milestones',                'Execution',   81),
  ('tasks.view_all',     'See all company tasks',                    'Execution',   82),
  ('tasks.edit',         'Create, assign and edit any task',         'Execution',   83),
  ('kpis.view',          'View company KPIs and reviews',            'Execution',   84),
  ('kpis.edit',          'Edit KPIs, results and reviews',           'Execution',   85),
  ('compliance.view',    'View registration and compliance',         'Compliance',  90),
  ('compliance.edit',    'Edit registration and compliance',         'Compliance',  91),
  ('documents.view',     'View documents they have access to',       'Compliance',  92),
  ('documents.upload',   'Upload documents',                         'Compliance',  93),
  ('documents.manage',   'Edit and archive any document',            'Compliance',  94),
  ('employees.view',     'View employees',                           'People',     100),
  ('employees.manage',   'Add and manage employees',                 'People',     101),
  ('content.view',       'Read SOPs, policies, training, announcements','People',  102),
  ('content.manage',     'Publish SOPs, policies, training, announcements','People',103),
  ('reports.view',       'View and export reports',                  'Reports',    110),
  ('activity.view',      'View the activity history',                'Reports',    111),
  ('ai.use',             'Use the AI assistant',                     'AI',         120)
on conflict (key) do update set label = excluded.label, section = excluded.section, sort = excluded.sort;

-- Default permissions per role (the owner always has everything).
insert into public.cff_default_role_permissions (role_key, permission)
select r, p from (values
  ('founder','cff.view'),('founder','cff.edit'),('founder','cff.approve'),
  ('founder','partners.view'),('founder','partners.edit'),('founder','partners.financial'),
  ('founder','structure.view'),('founder','structure.edit'),('founder','values.view'),('founder','values.edit'),
  ('founder','profile.view'),('founder','profile.edit'),('founder','names.edit'),('founder','brand.view'),('founder','brand.edit'),
  ('founder','plans.view'),('founder','plans.edit'),('founder','tasks.view_all'),('founder','tasks.edit'),
  ('founder','kpis.view'),('founder','kpis.edit'),('founder','compliance.view'),('founder','compliance.edit'),
  ('founder','documents.view'),('founder','documents.upload'),('founder','documents.manage'),
  ('founder','employees.view'),('founder','employees.manage'),('founder','content.view'),('founder','content.manage'),
  ('founder','reports.view'),('founder','activity.view'),('founder','ai.use'),

  ('manager','cff.view'),('manager','partners.view'),('manager','structure.view'),('manager','values.view'),
  ('manager','profile.view'),('manager','brand.view'),('manager','plans.view'),('manager','plans.edit'),
  ('manager','tasks.view_all'),('manager','tasks.edit'),('manager','kpis.view'),('manager','kpis.edit'),
  ('manager','compliance.view'),('manager','documents.view'),('manager','documents.upload'),
  ('manager','employees.view'),('manager','content.view'),('manager','reports.view'),('manager','ai.use'),

  ('hr','cff.view'),('hr','structure.view'),('hr','values.view'),('hr','profile.view'),('hr','brand.view'),
  ('hr','tasks.view_all'),('hr','tasks.edit'),('hr','kpis.view'),('hr','documents.view'),('hr','documents.upload'),
  ('hr','employees.view'),('hr','employees.manage'),('hr','content.view'),('hr','content.manage'),('hr','ai.use'),

  ('employee','values.view'),('employee','profile.view'),('employee','brand.view'),('employee','documents.view'),
  ('employee','content.view'),('employee','ai.use'),

  ('viewer','values.view'),('viewer','profile.view'),('viewer','brand.view')
) as d(r, p)
on conflict do nothing;

-- ---------- Helper functions (used by the rules below) ----------

create or replace function public.cff_is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.cff_super_admins where user_id = auth.uid());
$$;

create or replace function public.cff_my_role(p_company uuid) returns text
language sql stable security definer set search_path = public as $$
  select role_key from public.cff_company_members
  where company_id = p_company and user_id = auth.uid() and status = 'active';
$$;

create or replace function public.cff_is_member(p_company uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.cff_is_super_admin() or exists (
    select 1 from public.cff_company_members
    where company_id = p_company and user_id = auth.uid() and status = 'active');
$$;

create or replace function public.cff_has_perm(p_company uuid, p_perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.cff_is_super_admin()
      or exists (
        select 1 from public.cff_company_members m
        where m.company_id = p_company and m.user_id = auth.uid() and m.status = 'active'
          and (m.role_key = 'owner' or exists (
                select 1 from public.cff_role_permissions rp
                where rp.company_id = m.company_id and rp.role_key = m.role_key
                  and rp.permission = p_perm and rp.allowed)));
$$;

-- A stage is "open" for editing unless it has been approved.
create or replace function public.cff_stage_open(p_company uuid, p_stage int) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.cff_stage_status
                     where company_id = p_company and stage = p_stage and status = 'approved');
$$;

create or replace function public.cff_doc_access(p_company uuid, p_access text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.cff_is_super_admin() or case p_access
    when 'everyone' then public.cff_is_member(p_company)
    when 'managers' then public.cff_my_role(p_company) in ('owner','founder','manager','hr')
    when 'founders' then public.cff_my_role(p_company) in ('owner','founder')
    when 'owner'    then public.cff_my_role(p_company) = 'owner'
    else false end;
$$;

create or replace function public.cff_my_member_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.cff_company_members where user_id = auth.uid() and status = 'active';
$$;

create or replace function public.cff_my_employee_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.cff_employees where user_id = auth.uid();
$$;

create or replace function public.cff_actor_name(p_company uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select display_name from public.cff_company_members where company_id = p_company and user_id = auth.uid() limit 1),
    (select full_name from public.cff_profiles where user_id = auth.uid() order by created_at limit 1),
    case when auth.uid() is null then 'System' else 'A member' end);
$$;

-- ---------- Triggers ----------

create or replace function public.cff_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['cff_companies','cff_company_members','cff_answers','cff_stage_status','cff_values_answers','cff_values_top',
    'cff_company_values','cff_partners','cff_employees','cff_shareholding','cff_company_profiles','cff_company_names','cff_brand',
    'cff_brand_assets','cff_plan_items','cff_tasks','cff_compliance_items','cff_content','cff_kpis','cff_reviews','cff_ai_outputs'] loop
    if not exists (select 1 from pg_trigger where tgname = t || '_touch') then
      execute format('create trigger %I before update on public.%I for each row execute function public.cff_touch()', t || '_touch', t);
    end if;
  end loop;
end $$;

-- New company: add the creator as Owner and copy the default permissions.
create or replace function public.cff_company_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.cff_role_permissions (company_id, role_key, permission, allowed)
  select new.id, role_key, permission, true from public.cff_default_role_permissions
  on conflict do nothing;
  if new.created_by is not null then
    insert into public.cff_company_members (company_id, user_id, role_key, display_name, email, designation)
    select new.id, new.created_by, 'owner',
           coalesce((select full_name from public.cff_profiles where user_id = new.created_by order by created_at limit 1), u.email),
           u.email, 'Founder'
    from auth.users u where u.id = new.created_by
    on conflict (company_id, user_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists cff_company_created on public.cff_companies;
create trigger cff_company_created after insert on public.cff_companies for each row execute function public.cff_company_created();

-- Owners are protected: only an owner can give or remove the Owner role, and the last owner cannot leave.
create or replace function public.cff_member_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare owners int;
begin
  if auth.uid() is null then return coalesce(new, old); end if;   -- server maintenance / SQL editor
  if (tg_op in ('INSERT','UPDATE') and new.role_key = 'owner' and (tg_op = 'INSERT' or old.role_key <> 'owner'))
     or (tg_op in ('UPDATE','DELETE') and old.role_key = 'owner') then
    if public.cff_my_role(coalesce(new.company_id, old.company_id)) <> 'owner' and not public.cff_is_super_admin() then
      raise exception 'Only an owner can change the Owner role.' using errcode = '42501';
    end if;
  end if;
  if tg_op in ('UPDATE','DELETE') and old.role_key = 'owner' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role_key <> 'owner' or new.status <> 'active') then
    select count(*) into owners from public.cff_company_members
      where company_id = old.company_id and role_key = 'owner' and status = 'active' and id <> old.id;
    if owners = 0 then raise exception 'A company must keep at least one owner.' using errcode = '23514'; end if;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists cff_member_guard on public.cff_company_members;
create trigger cff_member_guard before insert or update or delete on public.cff_company_members for each row execute function public.cff_member_guard();

-- Stage status: approving or reopening needs the approve permission; submitting needs edit permission.
create or replace function public.cff_stage_status_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare old_status text := case when tg_op = 'UPDATE' then old.status else 'not_started' end;
begin
  if new.status is distinct from old_status then
    if auth.uid() is not null then
      if (new.status = 'approved' or old_status = 'approved' or new.status = 'reopened')
         and not public.cff_has_perm(new.company_id, 'cff.approve') then
        raise exception 'You do not have permission to approve or reopen stages.' using errcode = '42501';
      end if;
      if new.status in ('ready_for_review','in_progress','draft') and old_status <> 'approved'
         and not (public.cff_has_perm(new.company_id, 'cff.edit') or public.cff_has_perm(new.company_id, 'cff.approve')) then
        raise exception 'You do not have permission to change this stage.' using errcode = '42501';
      end if;
      if old_status = 'approved' and new.status <> 'reopened' then
        raise exception 'An approved stage must be reopened before it can change.' using errcode = '23514';
      end if;
    end if;
    if new.status = 'ready_for_review' then new.submitted_by := auth.uid(); new.submitted_at := now(); end if;
    if new.status = 'approved' then new.approved_by := auth.uid(); new.approved_at := now(); end if;
  end if;
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists cff_stage_status_guard on public.cff_stage_status;
create trigger cff_stage_status_guard before insert or update on public.cff_stage_status for each row execute function public.cff_stage_status_guard();

-- When a stage is approved, keep a snapshot of its answers in the version history.
create or replace function public.cff_stage_snapshot() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    insert into public.cff_versions (company_id, entity, entity_key, new_value, changed_by, changed_by_name)
    select new.company_id, 'stage_snapshot', new.stage::text,
           coalesce(jsonb_object_agg(a.point_id, jsonb_build_object('answer', a.answer, 'done', a.done)), '{}'::jsonb),
           auth.uid(), public.cff_actor_name(new.company_id)
    from public.cff_answers a where a.company_id = new.company_id and a.stage = new.stage;
  end if;
  return new;
end $$;
drop trigger if exists cff_stage_snapshot on public.cff_stage_status;
create trigger cff_stage_snapshot after insert or update on public.cff_stage_status for each row execute function public.cff_stage_snapshot();

-- Employees without "edit any task" may only update the progress fields of tasks assigned to them.
create or replace function public.cff_task_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then new.completed_at := now(); end if;
  if new.status <> 'completed' then new.completed_at := null; end if;
  if auth.uid() is not null and not public.cff_has_perm(new.company_id, 'tasks.edit') then
    if (new.title, new.stage, new.department_id, new.assigned_to, new.priority, new.start_date, new.due_date, new.attachment_id, new.company_id)
       is distinct from (old.title, old.stage, old.department_id, old.assigned_to, old.priority, old.start_date, old.due_date, old.attachment_id, old.company_id) then
      raise exception 'You can only update the status, progress and notes of your tasks.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists cff_task_guard on public.cff_tasks;
create trigger cff_task_guard before update on public.cff_tasks for each row execute function public.cff_task_guard();

-- Master profile: approving needs the approve permission; approving one version supersedes the previous one.
create or replace function public.cff_profile_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    if auth.uid() is not null and not public.cff_has_perm(new.company_id, 'cff.approve') then
      raise exception 'You do not have permission to approve the master profile.' using errcode = '42501';
    end if;
    new.approved_by := auth.uid(); new.approved_at := now();
  end if;
  if tg_op = 'UPDATE' and old.status in ('approved','superseded') and auth.uid() is not null
     and (new.content is distinct from old.content) then
    raise exception 'An approved profile cannot be edited. Create a new draft instead.' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists cff_profile_guard on public.cff_company_profiles;
create trigger cff_profile_guard before insert or update on public.cff_company_profiles for each row execute function public.cff_profile_guard();

create or replace function public.cff_profile_supersede() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' then
    update public.cff_company_profiles set status = 'superseded'
    where company_id = new.company_id and id <> new.id and status = 'approved';
  end if;
  return new;
end $$;
drop trigger if exists cff_profile_supersede on public.cff_company_profiles;
create trigger cff_profile_supersede after insert or update of status on public.cff_company_profiles for each row execute function public.cff_profile_supersede();

-- Version history for strategic information (answers, company values, shareholding).
-- Edits by the same person within 10 minutes are merged into one version, so auto-save does not flood the history.
create or replace function public.cff_version() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := coalesce(new.company_id, old.company_id);
  v_key text; v_old jsonb; v_new jsonb; recent bigint;
begin
  if tg_table_name = 'cff_answers' then
    v_key := coalesce(new.point_id, old.point_id);
    v_old := case when tg_op <> 'INSERT' then to_jsonb(old.answer) end;
    v_new := case when tg_op <> 'DELETE' then to_jsonb(new.answer) end;
  else
    v_key := coalesce(new.id, old.id)::text;
    v_old := case when tg_op <> 'INSERT' then to_jsonb(old) - 'updated_at' end;
    v_new := case when tg_op <> 'DELETE' then to_jsonb(new) - 'updated_at' end;
  end if;
  if v_old is not distinct from v_new then return coalesce(new, old); end if;
  select id into recent from public.cff_versions
   where company_id = v_company and entity = tg_argv[0] and entity_key = v_key
     and changed_by is not distinct from auth.uid() and changed_at > now() - interval '10 minutes'
   order by changed_at desc limit 1;
  if recent is not null then
    update public.cff_versions set new_value = v_new, changed_at = now() where id = recent;
  else
    insert into public.cff_versions (company_id, entity, entity_key, old_value, new_value, changed_by, changed_by_name)
    values (v_company, tg_argv[0], v_key, v_old, v_new, auth.uid(), public.cff_actor_name(v_company));
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists cff_answers_version on public.cff_answers;
create trigger cff_answers_version after insert or update or delete on public.cff_answers for each row execute function public.cff_version('answer');
drop trigger if exists cff_values_version on public.cff_company_values;
create trigger cff_values_version after insert or update or delete on public.cff_company_values for each row execute function public.cff_version('company_value');
drop trigger if exists cff_shares_version on public.cff_shareholding;
create trigger cff_shares_version after insert or update or delete on public.cff_shareholding for each row execute function public.cff_version('shareholding');

-- Activity log: written automatically for every change; members cannot edit or delete it.
create or replace function public.cff_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r jsonb := to_jsonb(coalesce(new, old));
  v_company uuid := case when tg_table_name = 'cff_companies' then (r->>'id')::uuid else (r->>'company_id')::uuid end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) - 'updated_at' end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) - 'updated_at' end;
  v_action text := case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end;
  v_label text := coalesce(r->>'name', r->>'title', r->>'full_name', r->>'point_id', r->>'task', r->>'decision',
                           case when r ? 'stage' then 'Stage ' || (r->>'stage') end, r->>'kind', r->>'email', '');
  v_id text := coalesce(r->>'id', r->>'point_id', r->>'stage', r->>'kind', r->>'partner_id');
  recent bigint;
begin
  if tg_op = 'UPDATE' and v_old is not distinct from v_new then return new; end if;
  if tg_table_name = 'cff_role_permissions' and auth.uid() is null then return coalesce(new, old); end if;  -- default permissions set up by the system
  if tg_table_name = 'cff_compliance_items' and tg_op = 'INSERT' and auth.uid() is null then return new; end if;  -- the standard checklist added by the system (logged once by the server)
  if tg_table_name = 'cff_stage_status' and tg_op <> 'DELETE' then v_action := replace(new.status, '_', ' '); end if;
  if tg_table_name = 'cff_stage_approvals' then v_action := replace(new.action, '_', ' '); v_label := 'Stage ' || new.stage; end if;
  -- merge rapid auto-save edits of the same record by the same person
  if tg_op = 'UPDATE' then
    select id into recent from public.cff_activity_logs
     where company_id is not distinct from v_company and entity = tg_argv[0] and entity_id is not distinct from v_id
       and action = 'updated' and user_id is not distinct from auth.uid() and created_at > now() - interval '10 minutes'
     order by created_at desc limit 1;
    if recent is not null then
      update public.cff_activity_logs set new_value = v_new, created_at = now() where id = recent;
      return new;
    end if;
  end if;
  insert into public.cff_activity_logs (company_id, user_id, actor_name, action, entity, entity_id, summary, old_value, new_value)
  values (v_company, auth.uid(), public.cff_actor_name(v_company), v_action, tg_argv[0], v_id, left(v_label, 200),
          case when tg_argv[1] = 'values' then v_old end, case when tg_argv[1] = 'values' then v_new end);
  return coalesce(new, old);
end $$;

do $$
declare
  spec text[];
  specs text[][] := array[
    ['cff_companies','Company','values'], ['cff_company_members','Member','values'], ['cff_invitations','Invitation','none'],
    ['cff_role_permissions','Permission','values'], ['cff_answers','CFF answer','values'], ['cff_stage_status','Stage status','values'],
    ['cff_stage_approvals','Stage review','none'], ['cff_company_values','Company value','values'], ['cff_partners','Partner','values'],
    ['cff_departments','Department','values'], ['cff_employees','Employee','values'], ['cff_positions','Role','values'],
    ['cff_shareholding','Shareholding','values'], ['cff_decision_authority','Decision authority','values'], ['cff_raci','Accountability','values'],
    ['cff_company_profiles','Master profile','none'], ['cff_company_names','Company name','values'], ['cff_brand','Brand identity','values'],
    ['cff_brand_assets','Logo','values'], ['cff_documents','Document','values'], ['cff_plan_items','Plan item','values'],
    ['cff_tasks','Task','values'], ['cff_compliance_items','Compliance item','values'], ['cff_content','Company content','none'],
    ['cff_kpis','KPI','values'], ['cff_kpi_results','KPI result','values'], ['cff_reviews','Review','none']];
begin
  foreach spec slice 1 in array specs loop
    execute format('drop trigger if exists %I on public.%I', spec[1] || '_audit', spec[1]);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.cff_audit(%L, %L)',
                   spec[1] || '_audit', spec[1], spec[2], spec[3]);
  end loop;
end $$;

-- ---------- Row Level Security ----------
-- Every company table is only visible to members of that company, and each action needs the matching permission.

do $$
declare t text;
begin
  foreach t in array array['cff_companies','cff_super_admins','cff_permissions','cff_default_role_permissions','cff_role_permissions',
    'cff_company_members','cff_invitations','cff_answers','cff_stage_status','cff_stage_approvals','cff_versions','cff_values_answers',
    'cff_values_top','cff_company_values','cff_partners','cff_departments','cff_employees','cff_positions','cff_shareholding',
    'cff_decision_authority','cff_raci','cff_company_profiles','cff_company_names','cff_brand','cff_documents','cff_brand_assets',
    'cff_plan_items','cff_tasks','cff_compliance_items','cff_content','cff_acknowledgements','cff_kpis','cff_kpi_results','cff_reviews',
    'cff_notifications','cff_activity_logs','cff_ai_chats','cff_ai_outputs','cff_migration_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    -- remove earlier versions of our policies so this file can be re-run
    perform 1;
    execute (select coalesce(string_agg(format('drop policy if exists %I on public.%I;', policyname, t), ' '), 'select 1')
             from pg_policies where schemaname = 'public' and tablename = t and policyname like 'cff\_%');
  end loop;
end $$;
grant usage on all sequences in schema public to authenticated;

-- Helper to create the usual four policies in one line.
create or replace function public.cff_policies(p_table text, p_select text, p_insert text, p_update text, p_delete text) returns void
language plpgsql as $$
begin
  if p_select is not null then execute format('create policy cff_sel on public.%I for select to authenticated using (%s)', p_table, p_select); end if;
  if p_insert is not null then execute format('create policy cff_ins on public.%I for insert to authenticated with check (%s)', p_table, p_insert); end if;
  if p_update is not null then execute format('create policy cff_upd on public.%I for update to authenticated using (%s) with check (%s)', p_table, p_update, p_update); end if;
  if p_delete is not null then execute format('create policy cff_del on public.%I for delete to authenticated using (%s)', p_table, p_delete); end if;
end $$;

do $$ begin
  perform public.cff_policies('cff_companies',
  'cff_is_member(id) or created_by = auth.uid()', 'created_by = auth.uid()', 'cff_has_perm(id, ''company.manage'')', null);
  perform public.cff_policies('cff_super_admins', 'user_id = auth.uid()', null, null, null);
  perform public.cff_policies('cff_permissions', 'true', null, null, null);
  perform public.cff_policies('cff_default_role_permissions', 'true', null, null, null);
  perform public.cff_policies('cff_role_permissions', 'cff_is_member(company_id)',
  'cff_has_perm(company_id, ''company.manage'')', 'cff_has_perm(company_id, ''company.manage'')', 'cff_has_perm(company_id, ''company.manage'')');
  perform public.cff_policies('cff_company_members', 'cff_is_member(company_id) or user_id = auth.uid()',
  'cff_has_perm(company_id, ''members.manage'')', 'cff_has_perm(company_id, ''members.manage'')', 'cff_has_perm(company_id, ''members.manage'')');
  perform public.cff_policies('cff_invitations', 'cff_has_perm(company_id, ''members.manage'') or cff_has_perm(company_id, ''employees.manage'')',
  'cff_has_perm(company_id, ''members.manage'') or (cff_has_perm(company_id, ''employees.manage'') and role_key = ''employee'')',
  'cff_has_perm(company_id, ''members.manage'') or (cff_has_perm(company_id, ''employees.manage'') and role_key = ''employee'')',
  'cff_has_perm(company_id, ''members.manage'')');

  perform public.cff_policies('cff_answers', 'cff_has_perm(company_id, ''cff.view'')',
  'cff_has_perm(company_id, ''cff.edit'') and cff_stage_open(company_id, stage)',
  'cff_has_perm(company_id, ''cff.edit'') and cff_stage_open(company_id, stage)', null);
  perform public.cff_policies('cff_stage_status', 'cff_has_perm(company_id, ''cff.view'')',
  'cff_has_perm(company_id, ''cff.edit'') or cff_has_perm(company_id, ''cff.approve'')',
  'cff_has_perm(company_id, ''cff.edit'') or cff_has_perm(company_id, ''cff.approve'')', null);
  perform public.cff_policies('cff_stage_approvals', 'cff_has_perm(company_id, ''cff.view'')',
  'actor_id = auth.uid() and (cff_has_perm(company_id, ''cff.edit'') or cff_has_perm(company_id, ''cff.approve''))', null, null);
  perform public.cff_policies('cff_versions',
  'cff_has_perm(company_id, ''cff.view'') and (entity <> ''shareholding'' or cff_has_perm(company_id, ''partners.financial''))', null, null, null);

  perform public.cff_policies('cff_values_answers', 'user_id = auth.uid() or cff_has_perm(company_id, ''partners.view'')',
  'user_id = auth.uid() and cff_is_member(company_id)', 'user_id = auth.uid() and cff_is_member(company_id)', 'user_id = auth.uid()');
  perform public.cff_policies('cff_values_top', 'user_id = auth.uid() or cff_has_perm(company_id, ''partners.view'')',
  'user_id = auth.uid() and cff_is_member(company_id)', 'user_id = auth.uid() and cff_is_member(company_id)', 'user_id = auth.uid()');
  perform public.cff_policies('cff_company_values',
  'cff_has_perm(company_id, ''values.edit'') or (cff_has_perm(company_id, ''values.view'') and status = ''approved'')',
  'cff_has_perm(company_id, ''values.edit'') and cff_stage_open(company_id, 6)',
  'cff_has_perm(company_id, ''values.edit'') and cff_stage_open(company_id, 6)',
  'cff_has_perm(company_id, ''values.edit'') and cff_stage_open(company_id, 6)');

  perform public.cff_policies('cff_partners', 'cff_has_perm(company_id, ''partners.view'')',
  'cff_has_perm(company_id, ''partners.edit'') and cff_stage_open(company_id, 4)',
  'cff_has_perm(company_id, ''partners.edit'') and cff_stage_open(company_id, 4)', null);
  perform public.cff_policies('cff_departments', 'cff_is_member(company_id)',
  'cff_has_perm(company_id, ''structure.edit'') or cff_has_perm(company_id, ''employees.manage'')',
  'cff_has_perm(company_id, ''structure.edit'') or cff_has_perm(company_id, ''employees.manage'')',
  'cff_has_perm(company_id, ''structure.edit'')');
  perform public.cff_policies('cff_employees', 'cff_has_perm(company_id, ''employees.view'') or user_id = auth.uid()',
  'cff_has_perm(company_id, ''employees.manage'')', 'cff_has_perm(company_id, ''employees.manage'')', 'cff_has_perm(company_id, ''employees.manage'')');
  perform public.cff_policies('cff_positions', 'cff_has_perm(company_id, ''structure.view'')',
  'cff_has_perm(company_id, ''structure.edit'') and cff_stage_open(company_id, 5)',
  'cff_has_perm(company_id, ''structure.edit'') and cff_stage_open(company_id, 5)',
  'cff_has_perm(company_id, ''structure.edit'') and cff_stage_open(company_id, 5)');
  perform public.cff_policies('cff_shareholding', 'cff_has_perm(company_id, ''partners.financial'')',
  'cff_has_perm(company_id, ''partners.financial'') and cff_stage_open(company_id, 5)',
  'cff_has_perm(company_id, ''partners.financial'') and cff_stage_open(company_id, 5)',
  'cff_has_perm(company_id, ''partners.financial'') and cff_stage_open(company_id, 5)');
  perform public.cff_policies('cff_decision_authority', 'cff_has_perm(company_id, ''structure.view'')',
  'cff_has_perm(company_id, ''structure.edit'') and cff_stage_open(company_id, 5)',
  'cff_has_perm(company_id, ''structure.edit'') and cff_stage_open(company_id, 5)',
  'cff_has_perm(company_id, ''structure.edit'') and cff_stage_open(company_id, 5)');
  perform public.cff_policies('cff_raci', 'cff_has_perm(company_id, ''structure.view'')',
  'cff_has_perm(company_id, ''structure.edit'') and cff_stage_open(company_id, 5)',
  'cff_has_perm(company_id, ''structure.edit'') and cff_stage_open(company_id, 5)',
  'cff_has_perm(company_id, ''structure.edit'') and cff_stage_open(company_id, 5)');

  perform public.cff_policies('cff_company_profiles',
  'cff_has_perm(company_id, ''profile.edit'') or (cff_has_perm(company_id, ''profile.view'') and status = ''approved'')',
  'cff_has_perm(company_id, ''profile.edit'')', 'cff_has_perm(company_id, ''profile.edit'')', null);
  perform public.cff_policies('cff_company_names', 'cff_has_perm(company_id, ''cff.view'')',
  'cff_has_perm(company_id, ''names.edit'') and cff_stage_open(company_id, 8)',
  'cff_has_perm(company_id, ''names.edit'') and cff_stage_open(company_id, 8)',
  'cff_has_perm(company_id, ''names.edit'') and cff_stage_open(company_id, 8)');
  perform public.cff_policies('cff_brand', 'cff_has_perm(company_id, ''brand.view'')',
  'cff_has_perm(company_id, ''brand.edit'') and cff_stage_open(company_id, 9)',
  'cff_has_perm(company_id, ''brand.edit'') and cff_stage_open(company_id, 9)', null);
  perform public.cff_policies('cff_brand_assets', 'cff_has_perm(company_id, ''brand.view'')',
  'cff_has_perm(company_id, ''brand.edit'') and cff_stage_open(company_id, 9)',
  'cff_has_perm(company_id, ''brand.edit'') and cff_stage_open(company_id, 9)',
  'cff_has_perm(company_id, ''brand.edit'') and cff_stage_open(company_id, 9)');

  perform public.cff_policies('cff_documents',
  '(cff_has_perm(company_id, ''documents.view'') and cff_doc_access(company_id, access)) or exists (select 1 from public.cff_brand_assets b where b.document_id = id and cff_has_perm(b.company_id, ''brand.view''))',
  'cff_has_perm(company_id, ''documents.upload'') and uploaded_by = auth.uid()',
  'cff_has_perm(company_id, ''documents.manage'') or (uploaded_by = auth.uid() and cff_has_perm(company_id, ''documents.upload''))', null);

  perform public.cff_policies('cff_plan_items', 'cff_has_perm(company_id, ''plans.view'')',
  'cff_has_perm(company_id, ''plans.edit'')', 'cff_has_perm(company_id, ''plans.edit'')', 'cff_has_perm(company_id, ''plans.edit'')');
  perform public.cff_policies('cff_tasks',
  'cff_has_perm(company_id, ''tasks.view_all'') or assigned_to in (select cff_my_member_ids())',
  'cff_has_perm(company_id, ''tasks.edit'')',
  'cff_has_perm(company_id, ''tasks.edit'') or assigned_to in (select cff_my_member_ids())',
  'cff_has_perm(company_id, ''tasks.edit'')');
  perform public.cff_policies('cff_compliance_items', 'cff_has_perm(company_id, ''compliance.view'')',
  'cff_has_perm(company_id, ''compliance.edit'')', 'cff_has_perm(company_id, ''compliance.edit'')', 'cff_has_perm(company_id, ''compliance.edit'')');

  perform public.cff_policies('cff_content', 'cff_has_perm(company_id, ''content.view'') or cff_has_perm(company_id, ''content.manage'')',
  'cff_has_perm(company_id, ''content.manage'')', 'cff_has_perm(company_id, ''content.manage'')', 'cff_has_perm(company_id, ''content.manage'')');
  perform public.cff_policies('cff_acknowledgements', 'user_id = auth.uid() or cff_has_perm(company_id, ''content.manage'')',
  'user_id = auth.uid() and cff_has_perm(company_id, ''content.view'')', null, null);

  perform public.cff_policies('cff_kpis', 'cff_has_perm(company_id, ''kpis.view'') or employee_id in (select cff_my_employee_ids())',
  'cff_has_perm(company_id, ''kpis.edit'')', 'cff_has_perm(company_id, ''kpis.edit'')', 'cff_has_perm(company_id, ''kpis.edit'')');
  perform public.cff_policies('cff_kpi_results',
  'cff_has_perm(company_id, ''kpis.view'') or kpi_id in (select k.id from public.cff_kpis k where k.employee_id in (select cff_my_employee_ids()))',
  'cff_has_perm(company_id, ''kpis.edit'')', 'cff_has_perm(company_id, ''kpis.edit'')', 'cff_has_perm(company_id, ''kpis.edit'')');
  perform public.cff_policies('cff_reviews', 'cff_has_perm(company_id, ''kpis.view'')',
  'cff_has_perm(company_id, ''kpis.edit'')', 'cff_has_perm(company_id, ''kpis.edit'')', null);

  perform public.cff_policies('cff_notifications', 'user_id = auth.uid()', null, 'user_id = auth.uid()', 'user_id = auth.uid()');
  perform public.cff_policies('cff_activity_logs', 'cff_has_perm(company_id, ''activity.view'')', null, null, null);
  perform public.cff_policies('cff_ai_chats', 'user_id = auth.uid() and cff_is_member(company_id)',
  'user_id = auth.uid() and cff_has_perm(company_id, ''ai.use'')', null, 'user_id = auth.uid()');
  perform public.cff_policies('cff_ai_outputs',
  '(user_id = auth.uid() or user_id is null) and cff_is_member(company_id)',
  '(user_id = auth.uid() or user_id is null) and cff_has_perm(company_id, ''ai.use'')',
  '(user_id = auth.uid() or user_id is null) and cff_has_perm(company_id, ''ai.use'')',
  '(user_id = auth.uid() or user_id is null) and cff_has_perm(company_id, ''ai.use'')');
end $$;
-- cff_migration_log: no policies = no access for signed-in users (only the server / SQL editor).

drop function if exists public.cff_policies(text, text, text, text, text);

-- ---------- Same-company references ----------
-- A record may only point to people, departments, documents etc. of its own company.
-- (Stops, for example, assigning a task to a member of a different company.)
create or replace function public.cff_same_company() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  spec text; col text; tbl text; val text; ok boolean;
  r jsonb := to_jsonb(new);
begin
  for i in 0 .. tg_nargs - 1 loop
    spec := tg_argv[i]; col := split_part(spec, ':', 1); tbl := split_part(spec, ':', 2);
    val := r->>col;
    continue when val is null;
    if tbl = '@member' then
      select exists (select 1 from public.cff_company_members where user_id = val::uuid and company_id = new.company_id) into ok;
    else
      execute format('select exists (select 1 from public.%I where id = $1 and company_id = $2)', tbl) into ok using val::uuid, new.company_id;
    end if;
    if not ok then
      raise exception 'That % belongs to a different company or no longer exists.', replace(replace(col, '_id', ''), '_', ' ') using errcode = '23503';
    end if;
  end loop;
  return new;
end $$;

do $$
declare
  spec text[];
  specs text[][] := array[
    ['cff_tasks',            'assigned_to:cff_company_members,department_id:cff_departments,attachment_id:cff_documents'],
    ['cff_plan_items',       'owner_member_id:cff_company_members'],
    ['cff_compliance_items', 'responsible_member_id:cff_company_members,document_id:cff_documents'],
    ['cff_employees',        'department_id:cff_departments,reporting_manager_id:cff_employees,user_id:@member'],
    ['cff_positions',        'partner_id:cff_partners,employee_id:cff_employees,department_id:cff_departments,reports_to:cff_positions'],
    ['cff_shareholding',     'partner_id:cff_partners'],
    ['cff_departments',      'parent_id:cff_departments'],
    ['cff_documents',        'previous_id:cff_documents'],
    ['cff_brand_assets',     'document_id:cff_documents'],
    ['cff_content',          'department_id:cff_departments'],
    ['cff_kpis',             'department_id:cff_departments,employee_id:cff_employees'],
    ['cff_kpi_results',      'kpi_id:cff_kpis'],
    ['cff_acknowledgements', 'content_id:cff_content'],
    ['cff_partners',         'user_id:@member'],
    ['cff_invitations',      'employee_id:cff_employees']];
  args text;
begin
  foreach spec slice 1 in array specs loop
    select string_agg(quote_literal(x), ',') into args from unnest(string_to_array(spec[2], ',')) x;
    execute format('drop trigger if exists %I on public.%I', spec[1] || '_same_company', spec[1]);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.cff_same_company(%s)',
                   spec[1] || '_same_company', spec[1], args);
  end loop;
end $$;

-- ================= 004_migrate_existing_data.sql =================
-- ============================================================
-- CFF 2.0 — 004: move existing answers into company workspaces
-- Safe and non-destructive:
--   1. Backs up the old tables (cff_backup_* copies) the first time it runs.
--   2. For every user who has saved answers, creates one company workspace ("My Company",
--      or the company name they typed when signing up) with that user as Owner.
--   3. Copies their answers, values assessment, "My highest values", AI analysis and chats into it.
--   4. Never deletes or changes the old tables. Users already migrated are skipped, so it can be re-run.
-- Check the result afterwards:  select * from public.cff_migration_report;
-- ============================================================

-- 1. Backups (only created once)
do $$
declare t text;
begin
  foreach t in array array['cff_profiles','cff_point_answers','cff_value_answers','cff_top_values','cff_ai_messages','cff_ai_analysis'] loop
    if to_regclass('public.' || t) is not null and to_regclass('public.cff_backup_' || t) is null then
      execute format('create table public.%I as table public.%I', 'cff_backup_' || t, t);
      execute format('alter table public.%I enable row level security', 'cff_backup_' || t);
      execute format('revoke all on public.%I from anon, authenticated', 'cff_backup_' || t);
    end if;
  end loop;
end $$;

-- 2 and 3. Migrate each user once
do $$
declare
  u record;
  v_portal text;
  v_company uuid;
  v_name text;
  n_points int; n_values int; n_chats int;
begin
  for u in
    select distinct user_id from (
      select user_id from public.cff_point_answers
      union select user_id from public.cff_value_answers
      union select user_id from public.cff_top_values
    ) x
    where user_id not in (select user_id from public.cff_migration_log)
      and exists (select 1 from auth.users au where au.id = x.user_id)
  loop
    -- Use the portal where this person saved the most (Businessman first when equal).
    select portal into v_portal from (
      select portal, count(*) as n from (
        select portal from public.cff_point_answers where user_id = u.user_id and (answer <> '' or done)
        union all select portal from public.cff_value_answers where user_id = u.user_id and answer_text <> ''
      ) a group by portal
    ) c order by n desc, (portal = 'business') desc limit 1;
    v_portal := coalesce(v_portal, 'business');

    -- Reuse a company this user already owns, otherwise create one.
    select m.company_id into v_company from public.cff_company_members m
      where m.user_id = u.user_id and m.role_key = 'owner' and m.status = 'active' order by m.joined_at limit 1;
    if v_company is null then
      select nullif(trim(extra), '') into v_name from public.cff_profiles
        where user_id = u.user_id and portal = 'business' limit 1;
      insert into public.cff_companies (name, created_by, description)
      values (coalesce(v_name, 'My Company'), u.user_id, 'Created automatically from your earlier CFF answers.')
      returning id into v_company;
    end if;

    insert into public.cff_answers (company_id, point_id, answer, done, updated_by, updated_at)
    select v_company, point_id, answer, done, u.user_id, updated_at
    from public.cff_point_answers where user_id = u.user_id and portal = v_portal
    on conflict (company_id, point_id) do nothing;
    get diagnostics n_points = row_count;

    insert into public.cff_values_answers (company_id, user_id, question_no, slot, answer_text, value_slug, domain, updated_at)
    select v_company, u.user_id, question_no, slot, answer_text, value_slug, domain, updated_at
    from public.cff_value_answers where user_id = u.user_id and portal = v_portal
    on conflict do nothing;
    get diagnostics n_values = row_count;

    insert into public.cff_values_top (company_id, user_id, top_values, updated_at)
    select v_company, u.user_id, top_values, updated_at from public.cff_top_values where user_id = u.user_id and portal = v_portal
    on conflict do nothing;

    insert into public.cff_ai_outputs (company_id, user_id, kind, subject, content, input_hash, updated_at)
    select v_company, u.user_id, 'values_analysis', '', content, answers_hash, updated_at
    from public.cff_ai_analysis where user_id = u.user_id and portal = v_portal and kind = 'values'
    on conflict do nothing;

    insert into public.cff_ai_chats (company_id, user_id, role, content, page, created_at)
    select v_company, u.user_id, role, content, page, created_at from public.cff_ai_messages where user_id = u.user_id
    order by created_at;
    get diagnostics n_chats = row_count;

    -- Mark stages that already have answers as "in progress".
    insert into public.cff_stage_status (company_id, stage, status)
    select distinct v_company, stage, 'in_progress' from public.cff_answers where company_id = v_company and (answer <> '' or done)
    on conflict do nothing;

    insert into public.cff_migration_log (user_id, company_id, source_portal, points_copied, values_copied, chats_copied)
    values (u.user_id, v_company, v_portal, n_points, n_values, n_chats);
  end loop;

  -- People who only created an account (no answers yet) get no automatic company;
  -- they are asked to create or join a company when they next log in.
end $$;

-- 4. Verification report (row counts before and after, per user)
create or replace view public.cff_migration_report as
select
  l.user_id,
  (select email from auth.users where id = l.user_id) as email,
  c.name as company,
  l.source_portal,
  (select count(*) from public.cff_point_answers p where p.user_id = l.user_id and p.portal = l.source_portal) as old_answers,
  (select count(*) from public.cff_answers a where a.company_id = l.company_id) as new_answers,
  (select count(*) from public.cff_value_answers v where v.user_id = l.user_id and v.portal = l.source_portal) as old_values,
  (select count(*) from public.cff_values_answers v where v.company_id = l.company_id and v.user_id = l.user_id) as new_values,
  (select role_key from public.cff_company_members m where m.company_id = l.company_id and m.user_id = l.user_id) as role,
  l.migrated_at
from public.cff_migration_log l left join public.cff_companies c on c.id = l.company_id;
revoke all on public.cff_migration_report from anon, authenticated;

-- ================= 005_role_experiences.sql =================
-- ============================================================
-- CFF 2.1 — 005: separate experiences per role (Business Owner / Manager / HR / Employee / Viewer)
-- Safe and non-destructive. Can be run more than once.
--   1. New default permissions for Manager, HR, Employee and Viewer. Owner and Founder are unchanged.
--   2. Existing companies: a role's permissions are updated ONLY if the owner never changed them
--      (they still equal the old defaults). Customised roles are left exactly as they are.
--   3. Members can no longer read other members' details (emails) unless their role needs it.
--   4. Shared AI results (partner analyses, recommendations) are only readable by people allowed to
--      see the underlying information.
-- ============================================================

-- 1 and 2. Default permissions
do $$
declare
  roles text[] := array['manager','hr','employee','viewer'];
  old_defaults jsonb := '{
    "manager":  ["ai.use","brand.view","cff.view","compliance.view","content.view","documents.upload","documents.view","employees.view","kpis.edit","kpis.view","partners.view","plans.edit","plans.view","profile.view","reports.view","structure.view","tasks.edit","tasks.view_all","values.view"],
    "hr":       ["ai.use","brand.view","cff.view","content.manage","content.view","documents.upload","documents.view","employees.manage","employees.view","kpis.view","profile.view","structure.view","tasks.edit","tasks.view_all","values.view"],
    "employee": ["ai.use","brand.view","content.view","documents.view","profile.view","values.view"],
    "viewer":   ["brand.view","profile.view","values.view"]
  }';
  new_defaults jsonb := '{
    "manager":  ["ai.use","content.view","documents.upload","documents.view","employees.view","kpis.edit","kpis.view","plans.view","tasks.edit","tasks.view_all"],
    "hr":       ["ai.use","content.manage","content.view","documents.upload","documents.view","employees.manage","employees.view","structure.view"],
    "employee": ["ai.use","content.view","documents.view"],
    "viewer":   []
  }';
  r text; c record; cur text[]; old_set text[]; new_set text[]; changed int := 0;
begin
  foreach r in array roles loop
    new_set := array(select jsonb_array_elements_text(new_defaults -> r) order by 1);
    old_set := array(select jsonb_array_elements_text(old_defaults -> r) order by 1);
    -- defaults used for new companies
    delete from public.cff_default_role_permissions where role_key = r and not (permission = any(new_set));
    insert into public.cff_default_role_permissions (role_key, permission) select r, p from unnest(new_set) p on conflict do nothing;
    -- existing companies whose role still has the old defaults
    for c in select id from public.cff_companies loop
      cur := array(select permission from public.cff_role_permissions
                   where company_id = c.id and role_key = r and allowed order by 1);
      if cur = old_set then
        delete from public.cff_role_permissions where company_id = c.id and role_key = r;
        insert into public.cff_role_permissions (company_id, role_key, permission, allowed)
          select c.id, r, p, true from unnest(new_set) p on conflict (company_id, role_key, permission) do update set allowed = true;
        changed := changed + 1;
      end if;
    end loop;
  end loop;
  raise notice 'CFF 005: updated % company role(s) to the new defaults (customised roles were not changed).', changed;
end $$;

-- 3. Member details: your own row, or people whose work needs the member list
drop policy if exists cff_sel on public.cff_company_members;
create policy cff_sel on public.cff_company_members for select to authenticated using (
  user_id = auth.uid()
  or public.cff_has_perm(company_id, 'members.manage') or public.cff_has_perm(company_id, 'employees.view')
  or public.cff_has_perm(company_id, 'employees.manage') or public.cff_has_perm(company_id, 'tasks.view_all')
  or public.cff_has_perm(company_id, 'tasks.edit') or public.cff_has_perm(company_id, 'plans.edit')
  or public.cff_has_perm(company_id, 'compliance.edit') or public.cff_has_perm(company_id, 'kpis.edit')
  or public.cff_has_perm(company_id, 'content.manage') or public.cff_has_perm(company_id, 'activity.view')
  or public.cff_has_perm(company_id, 'partners.view'));

-- 4. AI results: personal ones for their owner; shared ones only with the permission behind them
create or replace function public.cff_ai_output_allowed(p_company uuid, p_user uuid, p_kind text, p_subject text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.cff_is_member(p_company) and (
    p_user = auth.uid()
    or (p_user is null and (
         (p_kind in ('recommendations','stage_review') and public.cff_has_perm(p_company, 'cff.view'))
      or (p_kind in ('partner_summary','partner_strengths','values_alignment') and public.cff_has_perm(p_company, 'partners.view'))
      or (p_kind = 'partner_comparison' and public.cff_has_perm(p_company, 'partners.view')
          and (coalesce(p_subject, '') <> 'financial' or public.cff_has_perm(p_company, 'partners.financial')))
    )));
$$;
grant execute on function public.cff_ai_output_allowed(uuid, uuid, text, text) to authenticated;

drop policy if exists cff_sel on public.cff_ai_outputs;
drop policy if exists cff_ins on public.cff_ai_outputs;
drop policy if exists cff_upd on public.cff_ai_outputs;
drop policy if exists cff_del on public.cff_ai_outputs;
create policy cff_sel on public.cff_ai_outputs for select to authenticated using (public.cff_ai_output_allowed(company_id, user_id, kind, subject));
create policy cff_ins on public.cff_ai_outputs for insert to authenticated
  with check (public.cff_has_perm(company_id, 'ai.use') and public.cff_ai_output_allowed(company_id, user_id, kind, subject));
create policy cff_upd on public.cff_ai_outputs for update to authenticated
  using (public.cff_ai_output_allowed(company_id, user_id, kind, subject))
  with check (public.cff_has_perm(company_id, 'ai.use') and public.cff_ai_output_allowed(company_id, user_id, kind, subject));
create policy cff_del on public.cff_ai_outputs for delete to authenticated
  using (public.cff_has_perm(company_id, 'ai.use') and public.cff_ai_output_allowed(company_id, user_id, kind, subject));

-- Existing shared contribution comparisons may contain financial details: mark them so only
-- people who may see financial information can read them (they can be regenerated).
update public.cff_ai_outputs set subject = 'financial' where kind = 'partner_comparison' and user_id is null and coalesce(subject, '') = '';

-- ================= 006_production.sql =================
-- ============================================================
-- CFF 2.2 — 006: production hardening. Safe, non-destructive, can be run more than once.
--   1. Members can be deactivated (status 'disabled') without being removed — they lose access immediately.
--   2. Invitations expire (default 14 days) and can be resent.
--   3. Login activity (successful and failed logins, two-step verification) for the account security page.
--   4. Indexes for the foreign keys and filters the app uses most.
-- ============================================================

-- 1. Member status: active | disabled | removed
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.cff_company_members'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%status%';
  if c is not null then execute format('alter table public.cff_company_members drop constraint %I', c); end if;
  alter table public.cff_company_members add constraint cff_company_members_status_check check (status in ('active','disabled','removed'));
end $$;
alter table public.cff_company_members add column if not exists status_changed_at timestamptz;
alter table public.cff_company_members add column if not exists status_reason text;

-- 2. Invitation expiry
alter table public.cff_invitations add column if not exists expires_at timestamptz;
alter table public.cff_invitations add column if not exists sent_count int not null default 1;
alter table public.cff_invitations add column if not exists last_sent_at timestamptz;
update public.cff_invitations set expires_at = created_at + interval '14 days' where expires_at is null;
alter table public.cff_invitations alter column expires_at set default (now() + interval '14 days');
alter table public.cff_invitations alter column expires_at set not null;

-- 3. Login activity (written only by the server; each person can read their own)
create table if not exists public.cff_login_events (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id) on delete cascade,
  event       text not null check (event in ('login','login_failed','mfa_verified','mfa_failed','mfa_enabled','mfa_disabled','logout_all','password_changed','password_reset')),
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists cff_login_events_user_idx on public.cff_login_events (user_id, created_at desc);
alter table public.cff_login_events enable row level security;
drop policy if exists cff_sel on public.cff_login_events;
create policy cff_sel on public.cff_login_events for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.cff_login_events from anon, authenticated;
grant select on public.cff_login_events to authenticated;

-- 4. Indexes (company filters and foreign keys)
create index if not exists cff_members_company_idx      on public.cff_company_members (company_id, status);
create index if not exists cff_invitations_company_idx  on public.cff_invitations (company_id) where accepted_at is null and revoked_at is null;
create index if not exists cff_positions_company_idx    on public.cff_positions (company_id);
create index if not exists cff_authority_company_idx    on public.cff_decision_authority (company_id);
create index if not exists cff_raci_company_idx         on public.cff_raci (company_id);
create index if not exists cff_values_company_idx       on public.cff_company_values (company_id, status);
create index if not exists cff_names_company_idx        on public.cff_company_names (company_id);
create index if not exists cff_content_company_idx      on public.cff_content (company_id, kind) where archived_at is null;
create index if not exists cff_acks_user_idx            on public.cff_acknowledgements (company_id, user_id);
create index if not exists cff_kpis_company_idx         on public.cff_kpis (company_id);
create index if not exists cff_kpis_employee_idx        on public.cff_kpis (employee_id);
create index if not exists cff_kpi_results_company_idx  on public.cff_kpi_results (company_id, period desc);
create index if not exists cff_departments_company_idx  on public.cff_departments (company_id);
create index if not exists cff_employees_dept_idx       on public.cff_employees (company_id, department_id);
create index if not exists cff_documents_prev_idx       on public.cff_documents (previous_id);
create index if not exists cff_documents_expiry_idx     on public.cff_documents (company_id, expiry_date) where archived_at is null;
create index if not exists cff_compliance_company_idx   on public.cff_compliance_items (company_id);
create index if not exists cff_ai_outputs_company_idx   on public.cff_ai_outputs (company_id, kind);
create index if not exists cff_values_answers_user_idx  on public.cff_values_answers (company_id, user_id);
