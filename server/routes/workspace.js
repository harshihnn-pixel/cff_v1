// Dashboards, the employee overview, activity history, notifications and global search.
const express = require("express");
const { admin } = require("../lib/supabase");
const { HttpError, wrap, check, v } = require("../lib/http");
const { perm, can } = require("../lib/auth");
const { sweep } = require("../lib/notify");
const summary = require("../lib/summary");
const CAT = require("../../public/js/content/catalogs");

const r = express.Router({ mergeParams: true });   // /api/c/:companyId
const today = () => new Date().toISOString().slice(0, 10);
const plusDays = d => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const data = x => (x && x.data) || [];

// GET /dashboard — Founder / Company Builder dashboard
r.get("/dashboard", perm("cff.view"), wrap(async (req, res) => {
  await sweep(req).catch(e => console.error("[CFF] sweep:", e.message));
  const db = req.db, c = req.companyId;
  const s = await summary.build(db, c);
  const memberId = req.member && req.member.id;
  const [milestones, tasks, kpis, results, activity, unread, recs, members] = await Promise.all([
    can(req, "plans.view") ? db.from("cff_plan_items").select("id,title,plan,deadline,status,progress").eq("company_id", c).not("status", "in", "(completed,cancelled)").gte("deadline", today()).order("deadline").limit(6) : null,
    db.from("cff_tasks").select("id,title,due_date,status,priority,assigned_to,stage").eq("company_id", c).not("status", "in", "(completed,cancelled)").order("due_date").limit(500),
    can(req, "kpis.view") ? db.from("cff_kpis").select("id,name,target,unit").eq("company_id", c).eq("active", true) : null,
    can(req, "kpis.view") ? db.from("cff_kpi_results").select("kpi_id,period,actual,status").eq("company_id", c).order("period", { ascending: false }).limit(500) : null,
    can(req, "activity.view") ? db.from("cff_activity_logs").select("id,actor_name,action,entity,summary,created_at").eq("company_id", c).order("created_at", { ascending: false }).limit(10) : null,
    db.from("cff_notifications").select("id", { count: "exact", head: true }).eq("user_id", req.user.id).eq("company_id", c).is("read_at", null),
    db.from("cff_ai_outputs").select("content,updated_at").eq("company_id", c).is("user_id", null).eq("kind", "recommendations").eq("subject", "").maybeSingle(),
    db.from("cff_company_members").select("id,display_name").eq("company_id", c).eq("status", "active")
  ]);
  const names = Object.fromEntries(data(members).map(m => [m.id, m.display_name]));
  const t = data(tasks);
  const latest = {}; data(results).forEach(x => { if(!latest[x.kpi_id]) latest[x.kpi_id] = x; });
  const kp = data(kpis).map(k => ({ ...k, latest: latest[k.id] || null }));
  res.json({
    company: req.company, role: req.role,
    stages: summary.STAGES.map(st => ({ n: st.n, title: st.title, ...s.stages[st.n] })),
    overall: s.overall, readiness: s.readiness,
    pendingApprovals: summary.STAGES.filter(st => s.stages[st.n].status === "ready_for_review").map(st => ({ n: st.n, title: st.title, submitted_at: s.stages[st.n].submitted_at })),
    pendingDecisions: [
      ...(s.names.shortlisted && !s.names.selected ? [{ text: s.names.shortlisted + " shortlisted name" + (s.names.shortlisted > 1 ? "s" : "") + " waiting for a final choice", link: "company/names" }] : []),
      ...(s.values.draft ? [{ text: s.values.draft + " company value" + (s.values.draft > 1 ? "s" : "") + " waiting for approval", link: "company/values" }] : []),
      ...(s.profile.drafts ? [{ text: "Master profile draft waiting for review", link: "company/profile" }] : [])
    ],
    partners: s.partners, registration: s.compliance, shares: can(req, "partners.financial") ? s.shares : null,
    milestones: milestones ? data(milestones) : null,
    tasks: {
      mine: t.filter(x => x.assigned_to === memberId).slice(0, 8),
      today: t.filter(x => x.due_date === today()).length,
      upcoming: t.filter(x => x.due_date && x.due_date > today() && x.due_date <= plusDays(7)).length,
      overdue: t.filter(x => x.due_date && x.due_date < today()).length,
      open: t.length,
      list: t.slice(0, 6).map(x => ({ ...x, assignee: names[x.assigned_to] || null }))
    },
    kpis: kpis ? { total: kp.length, on_track: kp.filter(k => k.latest && k.latest.status === "on_track").length,
                   at_risk: kp.filter(k => k.latest && k.latest.status === "at_risk").length, off_track: kp.filter(k => k.latest && k.latest.status === "off_track").length,
                   no_data: kp.filter(k => !k.latest).length, items: kp.slice(0, 6) } : null,
    activity: activity ? data(activity) : null,
    unread: (unread && unread.count) || 0,
    recommendations: recs && recs.data ? recs.data : null
  });
}));

// GET /overview — the Employee portal (and the company overview everyone can see).
r.get("/overview", perm("*"), wrap(async (req, res) => {
  const db = req.db, c = req.companyId;
  const [prof, vals, brand, assets, emp, depts, content, acks, docs, stage1] = await Promise.all([
    // Approved company information is for every member, so the server reads only the approved rows and fields
    // (drafts and other versions are never returned here).
    admin.from("cff_company_profiles").select("content,approved_at").eq("company_id", c).eq("status", "approved").maybeSingle(),
    admin.from("cff_company_values").select("id,name,meaning,why_it_matters,expected_behavior,unacceptable_behavior,customer_promise").eq("company_id", c).eq("status", "approved").order("sort"),
    can(req, "brand.view") ? db.from("cff_brand").select("fields").eq("company_id", c).maybeSingle() : null,
    can(req, "brand.view") ? db.from("cff_brand_assets").select("kind,document_id").eq("company_id", c) : null,
    db.from("cff_employees").select("id,full_name,designation,department_id,reporting_manager_id,responsibilities,joined_on").eq("company_id", c).eq("user_id", req.user.id).maybeSingle(),
    db.from("cff_departments").select("id,name").eq("company_id", c),
    can(req, "content.view") ? db.from("cff_content").select("id,kind,title,body,department_id,requires_ack,published_at").eq("company_id", c).is("archived_at", null).order("published_at", { ascending: false }) : null,
    db.from("cff_acknowledgements").select("content_id").eq("company_id", c).eq("user_id", req.user.id),
    can(req, "documents.view") ? db.from("cff_documents").select("id,name,category,mime_type,uploaded_at,expiry_date").eq("company_id", c).eq("access", "everyone").is("archived_at", null).order("uploaded_at", { ascending: false }).limit(50) : null,
    admin.from("cff_stage_status").select("status").eq("company_id", c).eq("stage", 1).maybeSingle()
  ]);
  const p = (prof && prof.data && prof.data.content) || {};   // only name, vision, mission, purpose and story are used below
  const company = { name: p.company_name || req.company.name, vision: p.vision || "", mission: p.mission || "", purpose: p.purpose || "", story: p.story || "", source: prof && prof.data ? "profile" : null };
  // No approved master profile yet: show the approved Stage 1 vision, mission and purpose (only those three fields).
  if(!company.source && stage1 && stage1.data && stage1.data.status === "approved"){
    const a = data(await admin.from("cff_answers").select("point_id,answer").eq("company_id", c).in("point_id", ["s1-0-1","s1-0-2","s1-0-4"]));
    const m = Object.fromEntries(a.map(x => [x.point_id, x.answer]));
    Object.assign(company, { vision: m["s1-0-1"] || "", mission: m["s1-0-2"] || "", purpose: m["s1-0-4"] || "", source: "stage1" });
  }
  const e = emp && emp.data;
  const deptName = Object.fromEntries(data(depts).map(d => [d.id, d.name]));
  let manager = null;
  if(e && e.reporting_manager_id){
    const mg = await admin.from("cff_employees").select("full_name,designation").eq("id", e.reporting_manager_id).eq("company_id", c).maybeSingle();
    manager = mg.data || null;
  }
  const memberId = req.member && req.member.id;
  // My department: only colleagues' names and designations (no contact or private details).
  const teamRows = e && e.department_id ? data(await admin.from("cff_employees").select("full_name,designation,user_id").eq("company_id", c).eq("department_id", e.department_id).eq("status", "active").order("full_name").limit(50)) : [];
  const [tasks, kpis] = await Promise.all([
    memberId ? db.from("cff_tasks").select("id,title,due_date,status,progress,priority,notes,stage").eq("company_id", c).eq("assigned_to", memberId).order("due_date") : null,
    e ? db.from("cff_kpis").select("id,name,target,unit,period_type,direction").eq("company_id", c).eq("employee_id", e.id).eq("active", true) : null
  ]);
  const kpiIds = data(kpis).map(k => k.id);
  const results = kpiIds.length ? data(await db.from("cff_kpi_results").select("kpi_id,period,actual,target,status").in("kpi_id", kpiIds).order("period", { ascending: false })) : [];
  const acked = new Set(data(acks).map(a => a.content_id));
  // SOPs, policies and training for a department are shown to that department (managers of content see all).
  const myDept = e && e.department_id;
  const items = content ? data(content).filter(x => can(req, "content.manage") || !x.department_id || x.department_id === myDept).map(x => ({ ...x, acknowledged: acked.has(x.id) })) : [];
  const t = data(tasks);
  const needAck = items.filter(x => x.requires_ack);
  res.json({
    company, values: data(vals), brand: brand && brand.data ? { tagline: brand.data.fields.tagline || "", personality: brand.data.fields.brand_personality || "" } : null,
    logo: assets ? (data(assets).find(a => a.kind === "primary_logo") || null) : null,
    me: { name: (e && e.full_name) || (req.member && req.member.display_name) || req.user.email, role: req.role, designation: (e && e.designation) || (req.member && req.member.designation) || "",
          department: e && e.department_id ? deptName[e.department_id] || "" : "", manager, responsibilities: e ? e.responsibilities || "" : "", joined_on: e ? e.joined_on : null, employee: !!e },
    team: teamRows.filter(x => x.user_id !== req.user.id).map(x => ({ name: x.full_name, designation: x.designation || "" })),
    tasks: t, kpis: data(kpis).map(k => ({ ...k, latest: results.find(x => x.kpi_id === k.id) || null, history: results.filter(x => x.kpi_id === k.id).slice(0, 6) })),
    content: items, documents: docs ? data(docs) : [],
    progress: { tasks_done: t.filter(x => x.status === "completed").length, tasks_total: t.length,
                acks_done: needAck.filter(x => x.acknowledged).length, acks_total: needAck.length }
  });
}));

// GET /team — the Manager (operations) and HR dashboards. Each block is only returned with its permission.
r.get("/team", perm("*"), wrap(async (req, res) => {
  await sweep(req).catch(e => console.error("[CFF] sweep:", e.message));
  const db = req.db, c = req.companyId, memberId = req.member && req.member.id, t0 = today(), t7 = plusDays(7);
  const [tasks, mine, plans, kpis, results, emps, depts, invites, content, acks, members, comp, activity] = await Promise.all([
    can(req, "tasks.view_all") ? db.from("cff_tasks").select("id,title,due_date,status,priority,assigned_to,progress").eq("company_id", c).not("status", "in", "(completed,cancelled)").order("due_date").limit(500) : null,
    memberId ? db.from("cff_tasks").select("id,title,due_date,status,progress").eq("company_id", c).eq("assigned_to", memberId).not("status", "in", "(completed,cancelled)").order("due_date").limit(50) : null,
    can(req, "plans.view") ? db.from("cff_plan_items").select("id,title,plan,deadline,status,progress").eq("company_id", c).not("status", "in", "(completed,cancelled)").order("deadline").limit(300) : null,
    can(req, "kpis.view") ? db.from("cff_kpis").select("id,name,target,unit,department_id").eq("company_id", c).eq("active", true) : null,
    can(req, "kpis.view") ? db.from("cff_kpi_results").select("kpi_id,period,actual,status").eq("company_id", c).order("period", { ascending: false }).limit(500) : null,
    can(req, "employees.view") ? db.from("cff_employees").select("id,full_name,designation,department_id,joined_on,user_id,status").eq("company_id", c).eq("status", "active").order("joined_on", { ascending: false }) : null,
    can(req, "employees.view") || can(req, "structure.view") ? db.from("cff_departments").select("id,name").eq("company_id", c).order("sort") : null,
    can(req, "employees.manage") || can(req, "members.manage") ? db.from("cff_invitations").select("id,email,role_key,created_at").eq("company_id", c).is("accepted_at", null).is("revoked_at", null) : null,
    can(req, "content.manage") ? db.from("cff_content").select("id,kind,title,requires_ack,published_at").eq("company_id", c).is("archived_at", null).order("published_at", { ascending: false }).limit(50) : null,
    can(req, "content.manage") ? db.from("cff_acknowledgements").select("content_id").eq("company_id", c) : null,
    can(req, "content.manage") || can(req, "tasks.view_all") ? db.from("cff_company_members").select("id,display_name").eq("company_id", c).eq("status", "active") : null,
    can(req, "compliance.view") ? db.from("cff_compliance_items").select("name,applicability,status,due_date,renewal_date").eq("company_id", c).neq("applicability", "not_required") : null,
    can(req, "activity.view") ? db.from("cff_activity_logs").select("id,actor_name,action,entity,summary,created_at").eq("company_id", c).order("created_at", { ascending: false }).limit(8) : null
  ]);
  const names = Object.fromEntries(data(members).map(m => [m.id, m.display_name]));
  const deptName = Object.fromEntries(data(depts).map(d => [d.id, d.name]));
  const out = { experience: req.experience, role: req.role, company: { id: req.company.id, name: req.company.name } };
  if(tasks){ const t = data(tasks); out.teamTasks = { open: t.length, today: t.filter(x => x.due_date === t0).length, upcoming: t.filter(x => x.due_date > t0 && x.due_date <= t7).length,
    overdue: t.filter(x => x.due_date && x.due_date < t0).length, list: t.filter(x => x.due_date && x.due_date < t0).concat(t.filter(x => !(x.due_date && x.due_date < t0))).slice(0, 8).map(x => ({ ...x, assignee: names[x.assigned_to] || null })) }; }
  if(mine) out.myTasks = data(mine).slice(0, 6);
  if(plans){ const p = data(plans); out.plans = { open: p.length, blocked: p.filter(x => x.status === "blocked").length, overdue: p.filter(x => x.deadline && x.deadline < t0).length,
    milestones: p.filter(x => x.plan === "milestones" || x.deadline).filter(x => !x.deadline || x.deadline >= t0).slice(0, 6) }; }
  if(kpis){ const latest = {}; data(results).forEach(x => { if(!latest[x.kpi_id]) latest[x.kpi_id] = x; });
    const kp = data(kpis).map(k => ({ ...k, department: deptName[k.department_id] || "", latest: latest[k.id] || null }));
    out.kpis = { total: kp.length, on_track: kp.filter(k => k.latest && k.latest.status === "on_track").length, at_risk: kp.filter(k => k.latest && k.latest.status === "at_risk").length,
      off_track: kp.filter(k => k.latest && k.latest.status === "off_track").length, no_data: kp.filter(k => !k.latest).length, items: kp.slice(0, 8) }; }
  if(emps){ const e = data(emps); out.people = { employees: e.length, withoutLogin: e.filter(x => !x.user_id).length, recent: e.slice(0, 5).map(x => ({ name: x.full_name, designation: x.designation, department: deptName[x.department_id] || "", joined_on: x.joined_on })),
    departments: data(depts).map(d => ({ name: d.name, count: e.filter(x => x.department_id === d.id).length })), invitations: invites ? data(invites).length : null }; }
  if(content){ const ackCount = {}; data(acks).forEach(a => { ackCount[a.content_id] = (ackCount[a.content_id] || 0) + 1; });
    const total = Math.max(0, data(members).length - 1);
    out.content = { items: data(content).length, needingAck: data(content).filter(x => x.requires_ack).slice(0, 6).map(x => ({ ...x, acks: ackCount[x.id] || 0, of: total })) }; }
  if(comp){ const cs = data(comp); out.compliance = { required: cs.filter(x => x.applicability === "required").length, done: cs.filter(x => x.applicability === "required" && x.status === "approved").length,
    dueSoon: cs.filter(x => (x.due_date && x.due_date <= plusDays(30) && x.status !== "approved") || (x.renewal_date && x.renewal_date <= plusDays(30))).slice(0, 5) }; }
  if(activity) out.activity = data(activity);
  if(can(req, "members.manage") || can(req, "employees.manage") || can(req, "employees.view")){
    const ms = data(await db.from("cff_company_members").select("display_name,role_key,designation,status").eq("company_id", c).in("status", ["active", "disabled"]));
    out.members = { byRole: Object.fromEntries(CAT.ROLES.map(r => [r.key, ms.filter(m => m.role_key === r.key && m.status === "active").length])), disabled: ms.filter(m => m.status === "disabled").length,
      leaders: ms.filter(m => ["manager", "hr"].includes(m.role_key) && m.status === "active").map(m => ({ name: m.display_name, role: m.role_key, designation: m.designation || "" })) };
  }
  res.json(out);
}));

// GET /activity?before=ISO&limit=50
r.get("/activity", perm("activity.view"), wrap(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  let q = req.db.from("cff_activity_logs").select("id,user_id,actor_name,action,entity,entity_id,summary,old_value,new_value,created_at").eq("company_id", req.companyId);
  if(req.query.before){ const b = String(req.query.before); if(!isNaN(Date.parse(b))) q = q.lt("created_at", b); }
  if(req.query.entity) q = q.eq("entity", String(req.query.entity).slice(0, 60));
  const rows = check(await q.order("created_at", { ascending: false }).limit(limit), "activity");
  // Hide financial values from people who may not see them.
  const safe = rows.map(x => (x.entity === "Shareholding" && !can(req, "partners.financial")) ? { ...x, old_value: null, new_value: null } : x);
  res.json({ items: safe });
}));

// Notifications
r.get("/notifications", perm("*"), wrap(async (req, res) => {
  await sweep(req).catch(e => console.error("[CFF] sweep:", e.message));
  const rows = check(await req.db.from("cff_notifications").select("id,kind,title,body,link,created_at,read_at").eq("user_id", req.user.id).eq("company_id", req.companyId)
    .order("created_at", { ascending: false }).limit(60), "notifications");
  res.json({ items: rows, unread: rows.filter(x => !x.read_at).length });
}));
r.post("/notifications/read", perm("*"), wrap(async (req, res) => {
  const ids = Array.isArray((req.body || {}).ids) ? req.body.ids.slice(0, 200).map(x => v.uuid(x, "Notification")) : null;
  let q = req.db.from("cff_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", req.user.id).eq("company_id", req.companyId).is("read_at", null);
  if(ids) q = q.in("id", ids);
  check(await q, "mark read");
  res.json({ ok: true });
}));

// GET /search?q= — searches everything this person is allowed to see.
r.get("/search", perm("*"), wrap(async (req, res) => {
  const term = String(req.query.q || "").trim().slice(0, 80);
  if(term.length < 2) return res.json({ groups: [] });
  const like = "%" + term.replace(/[%_\\]/g, m => "\\" + m) + "%";
  const lc = term.toLowerCase();
  const db = req.db, c = req.companyId;
  const jobs = [];
  const add = (label, promise, map) => jobs.push(Promise.resolve(promise).then(x => ({ label, items: data(x).map(map) })).catch(() => ({ label, items: [] })));
  if(can(req, "cff.view")){
    jobs.push(Promise.resolve({ label: "CFF questions", items: summary.POINTS.filter(p => (p.title + " " + p.d).toLowerCase().includes(lc)).slice(0, 8)
      .map(p => ({ title: p.title, sub: "Stage " + p.stage + " · " + p.group, link: "cff/" + p.stage + "/" + p.id })) }));
    add("Answers", db.from("cff_answers").select("point_id,answer").eq("company_id", c).ilike("answer", like).limit(8),
      x => ({ title: (summary.POINT[x.point_id] || {}).title || x.point_id, sub: "Stage " + (summary.POINT[x.point_id] || {}).stage + " · " + x.answer.slice(0, 90), link: "cff/" + (summary.POINT[x.point_id] || {}).stage + "/" + x.point_id }));
  }
  if(can(req, "partners.view")) add("Partners", db.from("cff_partners").select("id,full_name,designation").eq("company_id", c).ilike("full_name", like).limit(8), x => ({ title: x.full_name, sub: x.designation || "Partner", link: "company/partners/" + x.id }));
  if(can(req, "employees.view")) add("Employees", db.from("cff_employees").select("id,full_name,designation").eq("company_id", c).ilike("full_name", like).limit(8), x => ({ title: x.full_name, sub: x.designation || "Employee", link: "people/employees" }));
  const allTasks = can(req, "tasks.view_all") || can(req, "tasks.edit");
  let tq = db.from("cff_tasks").select("id,title,due_date,status").eq("company_id", c).ilike("title", like);
  if(!allTasks) tq = req.member ? tq.eq("assigned_to", req.member.id) : null;
  if(tq) add(allTasks ? "Tasks" : "My tasks", tq.limit(8), x => ({ title: x.title, sub: (x.status || "").replace(/_/g, " ") + (x.due_date ? " · due " + x.due_date : ""), link: allTasks ? "execution/tasks" : "my/tasks" }));
  if(can(req, "content.view") || can(req, "content.manage")){
    const RES = { sop: "resources/sops", policy: "resources/policies", training: "resources/training", announcement: "resources/announcements" };
    const contentRows = (async () => {
      const rows = data(await db.from("cff_content").select("id,kind,title,department_id").eq("company_id", c).is("archived_at", null).ilike("title", like).limit(20));
      if(can(req, "content.manage")) return { data: rows.slice(0, 8) };
      const e = data(await db.from("cff_employees").select("department_id").eq("company_id", c).eq("user_id", req.user.id).limit(1));
      const mine = e[0] ? e[0].department_id : null;
      return { data: rows.filter(x => !x.department_id || x.department_id === mine).slice(0, 8) };
    })();
    add("SOPs, policies & training", contentRows, x => ({ title: x.title, sub: CAT.opt(CAT.CONTENT_KINDS)[x.kind] || x.kind, link: can(req, "content.manage") ? "people/content" : RES[x.kind] || "resources/sops" }));
  }
  // Approved company values (read-only information every member may see).
  {
    add("Company values", admin.from("cff_company_values").select("name,meaning").eq("company_id", c).eq("status", "approved").ilike("name", like).limit(5),
      x => ({ title: x.name, sub: (x.meaning || "Company value").slice(0, 90), link: can(req, "values.view") ? "company/values" : "company/our-values" }));
  }
  const docLink = can(req, "documents.upload") || can(req, "documents.manage") || can(req, "compliance.view") ? "compliance/documents" : "resources/documents";
  if(can(req, "documents.view")) add("Documents", db.from("cff_documents").select("id,name,category").eq("company_id", c).is("archived_at", null).ilike("name", like).limit(8), x => ({ title: x.name, sub: CAT.opt(CAT.DOC_CATEGORIES)[x.category] || x.category, link: docLink }));
  if(can(req, "plans.view")) add("Plans", db.from("cff_plan_items").select("id,title,plan,status").eq("company_id", c).ilike("title", like).limit(8), x => ({ title: x.title, sub: CAT.opt(CAT.PLAN_TYPES)[x.plan], link: "execution/plans" }));
  if(can(req, "kpis.view")) add("KPIs", db.from("cff_kpis").select("id,name,unit").eq("company_id", c).ilike("name", like).limit(8), x => ({ title: x.name, sub: "KPI" + (x.unit ? " · " + x.unit : ""), link: "execution/kpis" }));
  else {
    const emp = data(await db.from("cff_employees").select("id").eq("company_id", c).eq("user_id", req.user.id)).map(e => e.id);
    if(emp.length) add("My KPIs", db.from("cff_kpis").select("id,name,unit").eq("company_id", c).in("employee_id", emp).ilike("name", like).limit(8), x => ({ title: x.name, sub: "KPI" + (x.unit ? " · " + x.unit : ""), link: "my/kpis" }));
  }
  const groups = (await Promise.all(jobs)).filter(g => g.items.length);
  res.json({ groups });
}));

module.exports = r;
