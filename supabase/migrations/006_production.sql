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
