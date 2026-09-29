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
