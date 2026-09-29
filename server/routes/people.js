// People: employees (Stage 12), employee content (SOPs, policies, training, announcements) with
// "I have read and understood" acknowledgements, and the employee's own dashboard.
const express = require("express");
const { admin } = require("../lib/supabase");
const { HttpError, wrap, check, v } = require("../lib/http");
const { perm, can } = require("../lib/auth");
const { crud } = require("../lib/crud");
const { notify, usersWithPerm } = require("../lib/notify");
const CAT = require("../../public/js/content/catalogs");
const { securityLog } = require("../lib/log");

const employees = express.Router({ mergeParams: true });   // /api/c/:companyId/employees
const content = express.Router({ mergeParams: true });     // /api/c/:companyId/content

const EMP_COLS = "id,user_id,full_name,email,phone,designation,department_id,reporting_manager_id,responsibilities,joined_on,status,created_at";
crud(employees, { path: "/", table: "cff_employees", cols: EMP_COLS, view: "employees.view", edit: "employees.manage", required: ["full_name"], labels: { full_name: "Full name" },
  order: [["full_name"]],
  fields: {
    full_name: x => v.str(x, "Full name", 120), email: x => (x ? v.email(x) : null), phone: x => v.phone(x), designation: x => v.opt(x, "Designation", 120),
    department_id: x => v.uuid(x, "Department", { optional: true }), reporting_manager_id: x => v.uuid(x, "Reporting manager", { optional: true }),
    responsibilities: x => v.text(x, "Responsibilities", 6000), joined_on: x => v.date(x, "Joined on"), status: x => v.oneOf(x, "Status", ["active","inactive"])
  },
  beforeSave: async (req, row, isNew, before) => { if(before && row.reporting_manager_id && row.reporting_manager_id === before.id) throw new HttpError(400, "An employee can't report to themselves."); },
  // Marking an employee inactive (left the company) switches off their login for this company at once;
  // marking them active again restores it. Only employee / viewer logins are changed this way.
  afterSave: async (req, row, isNew, before) => {
    if(isNew || !before || before.status === row.status || !row.user_id) return;
    const m = check(await admin.from("cff_company_members").select("id,role_key,status,status_reason").eq("company_id", req.companyId).eq("user_id", row.user_id).maybeSingle(), "member");
    if(!m || !["employee", "viewer"].includes(m.role_key)) return;
    const REASON = "Employee record marked inactive";
    let status = null;
    if(row.status === "inactive" && m.status === "active") status = "disabled";
    if(row.status === "active" && m.status === "disabled" && m.status_reason === REASON) status = "active";
    if(!status) return;
    check(await admin.from("cff_company_members").update({ status, status_changed_at: new Date().toISOString(), status_reason: status === "disabled" ? REASON : null }).eq("id", m.id), "member access");
    await admin.from("cff_activity_logs").insert({ company_id: req.companyId, user_id: req.user.id, actor_name: (req.member && req.member.display_name) || req.user.email,
      action: status === "disabled" ? "deactivated" : "reactivated", entity: "Member", entity_id: m.id, summary: row.full_name + (status === "disabled" ? " — access switched off (employee inactive)" : " — access restored") });
    securityLog("member_" + status, req, { memberId: m.id, via: "employee_status" });
  } });

// POST /employees/:id/invite — gives the employee a login (they accept after signing up with this email).
employees.post("/:id/invite", perm("employees.manage", "members.manage"), wrap(async (req, res) => {
  const id = v.uuid(req.params.id, "Employee");
  const e = check(await req.db.from("cff_employees").select("id,email,designation,user_id").eq("id", id).eq("company_id", req.companyId).maybeSingle(), "employee");
  if(!e) throw new HttpError(404, "Employee not found.");
  if(e.user_id) throw new HttpError(409, "This employee already has a login.");
  if(!e.email) throw new HttpError(400, "Add the employee's email first.");
  const pending = check(await req.db.from("cff_invitations").select("id,expires_at").eq("company_id", req.companyId).eq("email", e.email.toLowerCase()).is("accepted_at", null).is("revoked_at", null), "pending");
  if(pending.some(p => new Date(p.expires_at) > new Date())) throw new HttpError(409, "This employee already has a pending invitation. Use Resend in Members & invitations if they didn't receive it.");
  if(pending.length) check(await req.db.from("cff_invitations").update({ revoked_at: new Date().toISOString() }).in("id", pending.map(p => p.id)), "close expired");
  const inv = check(await req.db.from("cff_invitations").insert({ company_id: req.companyId, email: e.email.toLowerCase(), role_key: "employee", designation: e.designation,
    employee_id: e.id, invited_by: req.user.id, last_sent_at: new Date().toISOString() }).select("id,email,created_at,expires_at,sent_count").single(), "invite employee");
  const sent = await require("./companies").deliverInvitation(req, inv);
  res.status(201).json({ invitation: inv, ...sent });
}));

// ---------- Content ----------
const KINDS = CAT.CONTENT_KINDS.map(k => k[0]);
content.get("/", perm("content.view", "content.manage"), wrap(async (req, res) => {
  let q = req.db.from("cff_content").select("id,kind,title,body,department_id,requires_ack,published_by,published_at,updated_at").eq("company_id", req.companyId).is("archived_at", null);
  if(KINDS.includes(req.query.kind)) q = q.eq("kind", req.query.kind);
  const [items, acks] = await Promise.all([
    q.order("published_at", { ascending: false }),
    req.db.from("cff_acknowledgements").select("content_id,user_id,acknowledged_at").eq("company_id", req.companyId)
  ]);
  const a = check(acks, "acks");
  // People who don't manage content see items for everyone and for their own department.
  let myDept = null;
  if(!can(req, "content.manage")){ const e = check(await req.db.from("cff_employees").select("department_id").eq("company_id", req.companyId).eq("user_id", req.user.id).limit(1), "my department"); myDept = e[0] ? e[0].department_id : null; }
  const mine = new Set(a.filter(x => x.user_id === req.user.id).map(x => x.content_id));
  const counts = {}; a.forEach(x => { counts[x.content_id] = (counts[x.content_id] || 0) + 1; });
  res.json({ items: check(items, "content").filter(x => can(req, "content.manage") || !x.department_id || x.department_id === myDept).map(x => ({ ...x, acknowledged: mine.has(x.id), ack_count: can(req, "content.manage") ? (counts[x.id] || 0) : undefined })),
             canManage: can(req, "content.manage") });
}));
crud(content, { path: "/items", table: "cff_content", cols: "id,kind,title,body,department_id,requires_ack,published_by,published_at,updated_at", view: false, edit: "content.manage",
  required: ["kind","title"], labels: { kind: "Type", title: "Title" }, defaults: req => ({ published_by: req.user.id }),
  fields: { kind: x => v.oneOf(x, "Type", KINDS), title: x => v.str(x, "Title", 200), body: x => v.text(x, "Text", 30000),
    department_id: x => v.uuid(x, "Department", { optional: true }), requires_ack: x => v.bool(x) },
  afterSave: async (req, row, isNew) => {
    if(!isNew) return;
    // Only people who can read it: everyone with content access, or just that department for department content.
    const readers = new Set([...(await usersWithPerm(req.companyId, "content.view")), ...(await usersWithPerm(req.companyId, "content.manage"))]);
    let targets = [...readers];
    if(row.department_id){
      const inDept = new Set(((await admin.from("cff_employees").select("user_id").eq("company_id", req.companyId).eq("department_id", row.department_id)).data || []).map(e => e.user_id).filter(Boolean));
      const managers = new Set(await usersWithPerm(req.companyId, "content.manage"));
      targets = targets.filter(u => inDept.has(u) || managers.has(u));
    }
    const label = CAT.opt(CAT.CONTENT_KINDS)[row.kind] || "Update";
    const RES = { sop: "sops", policy: "policies", training: "training", announcement: "announcements" };
    await notify(req.companyId, targets.filter(u => u !== req.user.id), { kind: "content", title: "New " + label.replace(/s$/, "").toLowerCase() + ": " + row.title, link: "#/resources/" + (RES[row.kind] || "sops"), dedupe: "content-" + row.id });
  } });

content.post("/items/:id/archive", perm("content.manage"), wrap(async (req, res) => {
  const id = v.uuid(req.params.id, "Item");
  check(await req.db.from("cff_content").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("company_id", req.companyId), "archive content");
  res.json({ ok: true });
}));

// POST /content/items/:id/acknowledge — "I have read and understood."
content.post("/items/:id/acknowledge", perm("content.view"), wrap(async (req, res) => {
  const id = v.uuid(req.params.id, "Item");
  const c = check(await req.db.from("cff_content").select("id").eq("id", id).eq("company_id", req.companyId).maybeSingle(), "content");
  if(!c) throw new HttpError(404, "Not found.");
  check(await req.db.from("cff_acknowledgements").upsert({ content_id: id, company_id: req.companyId, user_id: req.user.id }, { onConflict: "content_id,user_id", ignoreDuplicates: true }), "acknowledge");
  res.json({ ok: true });
}));

// GET /content/items/:id/acknowledgements — who has read it (for HR / owners)
content.get("/items/:id/acknowledgements", perm("content.manage"), wrap(async (req, res) => {
  const id = v.uuid(req.params.id, "Item");
  const [acks, members] = await Promise.all([
    req.db.from("cff_acknowledgements").select("user_id,acknowledged_at").eq("content_id", id),
    req.db.from("cff_company_members").select("user_id,display_name,role_key").eq("company_id", req.companyId).eq("status", "active")
  ]);
  const got = Object.fromEntries(check(acks, "acks").map(a => [a.user_id, a.acknowledged_at]));
  res.json({ people: check(members, "members").map(m => ({ name: m.display_name, role: m.role_key, acknowledged_at: got[m.user_id] || null })) });
}));

module.exports = { employees, content };
