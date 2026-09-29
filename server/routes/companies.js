// Company workspaces: create, settings, members, invitations and the role permissions matrix.
const express = require("express");
const { admin } = require("../lib/supabase");
const { HttpError, wrap, check, v, patch } = require("../lib/http");
const { perm, can, allPermissions } = require("../lib/auth");
const { meFor } = require("./auth");
const CAT = require("../../public/js/content/catalogs");

const top = express.Router();                         // /api/companies
const co = express.Router({ mergeParams: true });     // /api/c/:companyId

const ROLE_KEYS = CAT.ROLES.map(r => r.key);
const config = require("../lib/config");
const { securityLog } = require("../lib/log");
const { hasMfa } = require("../lib/security");

// Sends the invitation. People without an account get a Supabase invitation email (they set a password
// from the link); people who already have an account get an in-app notification.
async function deliverInvitation(req, inv){
  const prof = check(await admin.from("cff_profiles").select("user_id").eq("email", inv.email).limit(1), "lookup");
  if(prof[0]){
    await require("../lib/notify").notify(req.companyId, [prof[0].user_id], { kind: "invitation", title: "You're invited to join " + req.company.name,
      body: "Open CFF to accept the invitation.", link: "#/start", dedupe: "invite-" + inv.id + "-" + (inv.sent_count || 1) }, true);
    return { hasAccount: true, emailSent: false };
  }
  const r = await admin.auth.admin.inviteUserByEmail(inv.email, { redirectTo: config.appUrl + "/auth-callback.html", data: { invited_to: req.company.name } });
  if(r.error){
    // Already registered in Supabase Auth (e.g. never finished sign-up): they see it after logging in.
    if(!/already|exists|registered/i.test(r.error.message || "")) console.error("[CFF] invitation email:", r.error.message);
    return { hasAccount: false, emailSent: false };
  }
  return { hasAccount: false, emailSent: true };
}

// POST /api/companies { name, industry, city, description }
top.post("/", wrap(async (req, res) => {
  const b = req.body || {};
  const row = {
    name: v.str(b.name, "Company name", 160),
    industry: v.opt(b.industry, "Industry", 120),
    city: v.opt(b.city, "City", 120),
    description: v.opt(b.description, "Description", 2000),
    created_by: req.user.id
  };
  const c = check(await req.db.from("cff_companies").insert(row).select("id,name").single(), "create company");
  res.status(201).json({ company: c, me: await meFor(req.user) });
}));

// ---------- inside a company ----------
co.get("/", wrap(async (req, res) => {
  res.json({ company: req.company, role: req.role, experience: req.experience, member: req.member, perms: [...req.perms] });
}));

co.patch("/", perm("company.manage"), wrap(async (req, res) => {
  const b = req.body || {};
  const up = patch(b, {
    name: x => v.str(x, "Company name", 160), legal_name: x => v.opt(x, "Legal name", 200), industry: x => v.opt(x, "Industry", 120),
    description: x => v.opt(x, "Description", 2000), city: x => v.opt(x, "City", 120), country: x => v.opt(x, "Country", 80),
    settings: x => {
      const cur = req.company.settings || {};
      const next = { ...cur };
      if(x && x.enforce_readiness !== undefined) next.enforce_readiness = v.bool(x.enforce_readiness);
      if(x && x.require_mfa !== undefined){
        next.require_mfa = v.bool(x.require_mfa);
        // Don't let the owner lock themselves out: turn it on for yourself first.
        if(next.require_mfa && !cur.require_mfa && !hasMfa(req.user)) throw new HttpError(409, "Turn on two-step verification for your own account first (My profile → Account security).");
      }
      return next;
    }
  });
  const c = check(await req.db.from("cff_companies").update(up).eq("id", req.companyId).select("id,name,legal_name,industry,description,city,country,settings").single(), "update company");
  res.json({ company: c });
}));

co.post("/archive", perm("company.manage"), wrap(async (req, res) => {
  if(req.role !== "owner" && req.role !== "super_admin") throw new HttpError(403, "Only an owner can archive the company.");
  check(await req.db.from("cff_companies").update({ archived_at: new Date().toISOString() }).eq("id", req.companyId), "archive");
  res.json({ ok: true, me: await meFor(req.user) });
}));

// Members
// The member list is for people who assign work or manage people. Employees and viewers don't get it.
const MEMBER_LIST = ["members.manage", "employees.manage", "employees.view", "tasks.view_all", "tasks.edit", "plans.edit", "compliance.edit", "kpis.edit", "content.manage", "partners.view"];
co.get("/members", perm(...MEMBER_LIST), wrap(async (req, res) => {
  const manage = can(req, "members.manage") || can(req, "employees.manage");
  const rows = check(await req.db.from("cff_company_members").select("id,user_id,role_key,display_name,email,designation,status,status_changed_at,status_reason,joined_at")
    .eq("company_id", req.companyId).in("status", manage ? ["active", "disabled"] : ["active"]).order("joined_at"), "members");
  const members = rows.map(m => ({ ...m, email: manage || m.user_id === req.user.id ? m.email : undefined }));
  let invitations = [];
  if(manage) invitations = check(await req.db.from("cff_invitations").select("id,email,role_key,designation,created_at,employee_id,expires_at,sent_count,last_sent_at")
    .eq("company_id", req.companyId).is("accepted_at", null).is("revoked_at", null).order("created_at", { ascending: false }), "invitations");
  res.json({ members, invitations, canManage: can(req, "members.manage") });
}));

// POST /members { email, role, designation } — sends an invitation (the person accepts it after logging in).
co.post("/members", perm("members.manage", "employees.manage"), wrap(async (req, res) => {
  const b = req.body || {};
  const email = v.email(b.email);
  const role = v.oneOf(b.role, "Role", ROLE_KEYS.filter(r => r !== "owner"));
  if(!can(req, "members.manage") && role !== "employee") throw new HttpError(403, "You can only invite employees.");
  const designation = v.opt(b.designation, "Designation", 120);
  const members = check(await req.db.from("cff_company_members").select("id,email,status").eq("company_id", req.companyId), "members");
  if(members.some(m => (m.email || "").toLowerCase() === email && m.status === "active")) throw new HttpError(409, "This person is already a member.");
  if(members.some(m => (m.email || "").toLowerCase() === email && m.status === "disabled")) throw new HttpError(409, "This person's access is deactivated. Reactivate them in the member list instead.");
  const pending = check(await req.db.from("cff_invitations").select("id,expires_at").eq("company_id", req.companyId).eq("email", email).is("accepted_at", null).is("revoked_at", null), "pending");
  if(pending.some(p => new Date(p.expires_at) > new Date())) throw new HttpError(409, "This person already has a pending invitation. Use Resend if they didn't receive it.");
  // An old, expired invitation is closed so a fresh one can be sent.
  if(pending.length) check(await req.db.from("cff_invitations").update({ revoked_at: new Date().toISOString() }).in("id", pending.map(p => p.id)), "close expired");
  const inv = check(await req.db.from("cff_invitations").insert({ company_id: req.companyId, email, role_key: role, designation,
    employee_id: v.uuid(b.employee_id, "Employee", { optional: true }), invited_by: req.user.id, last_sent_at: new Date().toISOString() }).select("id,email,role_key,designation,created_at,expires_at,sent_count").single(), "invite");
  const sent = await deliverInvitation(req, inv);
  res.status(201).json({ invitation: inv, ...sent });
}));

// PATCH /members/:id { role_key, designation, status: 'active' | 'disabled', reason }
// Deactivating keeps the person's history but ends their access at once (every request re-checks membership).
co.patch("/members/:id", perm("members.manage"), wrap(async (req, res) => {
  const id = v.uuid(req.params.id, "Member");
  const b = req.body || {};
  const up = patch(b, { role_key: x => v.oneOf(x, "Role", ROLE_KEYS), designation: x => v.opt(x, "Designation", 120), status: x => v.oneOf(x, "Status", ["active", "disabled"]) });
  const isOwner = req.role === "owner" || req.role === "super_admin";
  if(up.role_key === "owner" && !isOwner) throw new HttpError(403, "Only an owner can make someone an owner.");
  if(up.status !== undefined || up.role_key !== undefined){
    const target = check(await req.db.from("cff_company_members").select("user_id,role_key").eq("id", id).eq("company_id", req.companyId).maybeSingle(), "member");
    if(target && target.user_id === req.user.id) throw new HttpError(400, "You can't change your own role or access. Ask another owner.");
    if(target && target.role_key === "owner" && !isOwner) throw new HttpError(403, "Only an owner can change another owner's role or access.");
  }
  if(up.status !== undefined){ up.status_changed_at = new Date().toISOString(); up.status_reason = v.opt(b.reason, "Reason", 300); securityLog("member_" + up.status, req, { memberId: id }); }
  if(up.role_key !== undefined) securityLog("member_role_changed", req, { memberId: id, role: up.role_key });
  const m = check(await req.db.from("cff_company_members").update(up).eq("id", id).eq("company_id", req.companyId).select("id,role_key,designation,status").maybeSingle(), "update member");
  if(!m) throw new HttpError(404, "Member not found.");
  res.json({ member: m });
}));

co.delete("/members/:id", perm("members.manage"), wrap(async (req, res) => {
  const id = v.uuid(req.params.id, "Member");
  const target = check(await req.db.from("cff_company_members").select("user_id,role_key").eq("id", id).eq("company_id", req.companyId).maybeSingle(), "member");
  if(target && target.user_id === req.user.id) throw new HttpError(400, "You can't remove yourself. Ask another owner.");
  if(target && target.role_key === "owner" && req.role !== "owner" && req.role !== "super_admin") throw new HttpError(403, "Only an owner can remove another owner.");
  securityLog("member_removed", req, { memberId: id });
  const m = check(await req.db.from("cff_company_members").update({ status: "removed" }).eq("id", id).eq("company_id", req.companyId).select("id").maybeSingle(), "remove member");
  if(!m) throw new HttpError(404, "Member not found.");
  res.json({ ok: true });
}));

// POST /invitations/:id/resend — sends it again and extends it by 14 days.
co.post("/invitations/:id/resend", perm("members.manage", "employees.manage"), wrap(async (req, res) => {
  const id = v.uuid(req.params.id, "Invitation");
  const cur = check(await req.db.from("cff_invitations").select("id,email,role_key,sent_count,accepted_at,revoked_at").eq("id", id).eq("company_id", req.companyId).maybeSingle(), "invitation");
  if(!cur || cur.accepted_at || cur.revoked_at) throw new HttpError(404, "This invitation is no longer pending.");
  if(!can(req, "members.manage") && cur.role_key !== "employee") throw new HttpError(403, "You can only manage employee invitations.");
  if((cur.sent_count || 1) >= 10) throw new HttpError(429, "This invitation has been sent many times. Check the email address, or cancel it and invite again.");
  const inv = check(await req.db.from("cff_invitations").update({ expires_at: new Date(Date.now() + 14 * 864e5).toISOString(), sent_count: (cur.sent_count || 1) + 1, last_sent_at: new Date().toISOString() })
    .eq("id", id).select("id,email,role_key,expires_at,sent_count").single(), "resend");
  const sent = await deliverInvitation(req, inv);
  res.json({ invitation: inv, ...sent });
}));

co.delete("/invitations/:id", perm("members.manage", "employees.manage"), wrap(async (req, res) => {
  const id = v.uuid(req.params.id, "Invitation");
  const cur = check(await req.db.from("cff_invitations").select("role_key").eq("id", id).eq("company_id", req.companyId).maybeSingle(), "invitation");
  if(!cur) throw new HttpError(404, "Invitation not found.");
  if(!can(req, "members.manage") && cur.role_key !== "employee") throw new HttpError(403, "You can only manage employee invitations.");
  check(await req.db.from("cff_invitations").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("company_id", req.companyId), "revoke");
  res.json({ ok: true });
}));

// Role permissions matrix
co.get("/permissions", perm("company.manage", "members.manage"), wrap(async (req, res) => {
  const [catalog, rows] = await Promise.all([
    admin.from("cff_permissions").select("key,label,section,sort").order("sort"),
    req.db.from("cff_role_permissions").select("role_key,permission,allowed").eq("company_id", req.companyId)
  ]);
  const matrix = {};
  CAT.ROLES.forEach(r => { matrix[r.key] = {}; });
  check(rows, "matrix").forEach(r => { matrix[r.role_key][r.permission] = r.allowed; });
  check(catalog, "catalog").forEach(p => { matrix.owner[p.key] = true; });
  res.json({ roles: CAT.ROLES, catalog: catalog.data, matrix, canEdit: can(req, "company.manage") });
}));

// PUT /permissions { matrix: { role: { permission: true|false } } }  (Owner role always has everything.)
co.put("/permissions", perm("company.manage"), wrap(async (req, res) => {
  const matrix = (req.body || {}).matrix;
  if(!matrix || typeof matrix !== "object") throw new HttpError(400, "Send the permissions to save.");
  const keys = await allPermissions();
  const rows = [];
  ROLE_KEYS.filter(r => r !== "owner").forEach(role => {
    const m = matrix[role]; if(!m) return;
    keys.forEach(k => { if(Object.prototype.hasOwnProperty.call(m, k)) rows.push({ company_id: req.companyId, role_key: role, permission: k, allowed: v.bool(m[k]) }); });
  });
  if(!rows.length) throw new HttpError(400, "Nothing to update.");
  check(await req.db.from("cff_role_permissions").upsert(rows, { onConflict: "company_id,role_key,permission" }), "save permissions");
  res.json({ ok: true, saved: rows.length });
}));

module.exports = { top, co, deliverInvitation };
