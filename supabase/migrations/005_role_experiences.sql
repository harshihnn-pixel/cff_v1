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
