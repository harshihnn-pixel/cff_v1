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
