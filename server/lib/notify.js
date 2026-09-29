// In-app notifications. Event notifications are created when something happens (task assigned,
// stage submitted...). Reminders (overdue tasks, renewals, expiring documents, KPI reviews) are
// checked when a person opens their dashboard or notifications, and each is created only once.
const { admin } = require("./supabase");

async function notify(companyId, userIds, n, skipMissingCompanyCheck){
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if(!ids.length || !admin) return;
  const rows = ids.map(user_id => ({ company_id: companyId, user_id, kind: n.kind, title: String(n.title).slice(0, 200), body: n.body ? String(n.body).slice(0, 500) : null,
    link: n.link || null, dedupe_key: n.dedupe ? n.dedupe + ":" + user_id : null }));
  const r = await admin.from("cff_notifications").upsert(rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });
  if(r.error) console.error("[CFF] notify:", r.error.message);
}

// Users in a company who have a permission (owners always count).
async function usersWithPerm(companyId, permission){
  const [members, perms] = await Promise.all([
    admin.from("cff_company_members").select("user_id,role_key").eq("company_id", companyId).eq("status", "active"),
    admin.from("cff_role_permissions").select("role_key").eq("company_id", companyId).eq("permission", permission).eq("allowed", true)
  ]);
  const roles = new Set(["owner", ...((perms.data || []).map(p => p.role_key))]);
  return (members.data || []).filter(m => roles.has(m.role_key)).map(m => m.user_id);
}

const today = () => new Date().toISOString().slice(0, 10);
const inDays = d => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
function lastPeriod(type){
  const now = new Date(); const y = now.getFullYear(), m = now.getMonth();
  if(type === "annual") return String(y - 1);
  if(type === "quarterly"){ const q = Math.floor(m / 3); return q === 0 ? (y - 1) + "-Q4" : y + "-Q" + q; }
  const d = new Date(y, m - 1, 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

// Creates reminder notifications for one person in one company (runs with their permissions).
async function sweep(req){
  const c = req.companyId, uid = req.user.id, db = req.db, can = p => req.perms.has(p);
  const tasks = [];
  if(can("cff.approve")) tasks.push(db.from("cff_stage_status").select("stage,submitted_at").eq("company_id", c).eq("status", "ready_for_review").then(r => (r.data || []).map(s => ({
    kind: "approval", title: "Stage " + s.stage + " is waiting for your approval", link: "#/cff/" + s.stage, dedupe: "review-" + s.stage + "-" + s.submitted_at }))));
  if(req.member) tasks.push(db.from("cff_tasks").select("id,title,due_date,status").eq("company_id", c).eq("assigned_to", req.member.id).lt("due_date", today())
    .not("status", "in", "(completed,cancelled)").then(r => (r.data || []).map(t => ({ kind: "task_overdue", title: "Overdue task: " + t.title, body: "Was due " + t.due_date, link: "#/my/tasks", dedupe: "overdue-" + t.id + "-" + t.due_date }))));
  if(can("compliance.view")) tasks.push(db.from("cff_compliance_items").select("id,name,due_date,renewal_date,status,applicability").eq("company_id", c).neq("applicability", "not_required").then(r => (r.data || []).flatMap(i => {
    const out = [];
    if(i.renewal_date && i.renewal_date <= inDays(30)) out.push({ kind: "compliance", title: "Renewal " + (i.renewal_date < today() ? "overdue" : "coming up") + ": " + i.name, body: "Renewal date " + i.renewal_date, link: "#/compliance/registration", dedupe: "renew-" + i.id + "-" + i.renewal_date });
    if(i.due_date && i.due_date <= inDays(14) && !["approved","not_applicable"].includes(i.status)) out.push({ kind: "compliance", title: "Compliance due: " + i.name, body: "Due " + i.due_date, link: "#/compliance/registration", dedupe: "due-" + i.id + "-" + i.due_date });
    return out; })));
  if(can("documents.upload") || can("documents.manage")) tasks.push(db.from("cff_documents").select("id,name,expiry_date").eq("company_id", c).is("archived_at", null).lte("expiry_date", inDays(30)).then(r => (r.data || []).map(d => ({
    kind: "document", title: "Document " + (d.expiry_date < today() ? "expired" : "expiring") + ": " + d.name, body: "Expiry date " + d.expiry_date, link: "#/compliance/documents", dedupe: "docexp-" + d.id + "-" + d.expiry_date }))));
  if(can("kpis.edit")) tasks.push(Promise.all([
    db.from("cff_kpis").select("id,name,period_type").eq("company_id", c).eq("active", true),
    db.from("cff_kpi_results").select("kpi_id,period").eq("company_id", c)
  ]).then(([k, r]) => { const have = new Set((r.data || []).map(x => x.kpi_id + "|" + x.period));
    return (k.data || []).filter(x => !have.has(x.id + "|" + lastPeriod(x.period_type))).map(x => ({ kind: "kpi", title: "KPI review due: " + x.name, body: "Add the result for " + lastPeriod(x.period_type), link: "#/execution/kpis", dedupe: "kpi-" + x.id + "-" + lastPeriod(x.period_type) })); }));
  if(can("cff.edit")) tasks.push(db.from("cff_stage_status").select("stage,status").eq("company_id", c).then(r => {
    const done = (r.data || []).filter(s => s.status === "approved").length;
    if(done >= 13) return [];
    const week = new Date(); const wk = week.getFullYear() + "-" + Math.ceil((((week - new Date(week.getFullYear(), 0, 1)) / 864e5) + 1) / 7);
    return [{ kind: "cff_incomplete", title: "CFF is " + Math.round(done / 13 * 100) + "% approved", body: done + " of 13 stages approved. Keep going.", link: "#/dashboard", dedupe: "cff-incomplete-" + wk }];
  }));
  const lists = await Promise.all(tasks.map(p => p.catch(e => { console.error("[CFF] sweep:", e.message); return []; })));
  const all = lists.flat();
  for(const n of all) await notify(c, [uid], n);
}

module.exports = { notify, usersWithPerm, sweep, lastPeriod };
