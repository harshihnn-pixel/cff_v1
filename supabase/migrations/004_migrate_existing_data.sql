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
