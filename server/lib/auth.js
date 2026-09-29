// Who is asking, which company they are working in, and what they are allowed to do.
// The database's Row Level Security rules check the same permissions again on every query.
const { admin, forUser, problem } = require("./supabase");
const { HttpError, wrap, check, UUID } = require("./http");
const { securityLog } = require("./log");
const { aalOf, hasMfa } = require("./security");

const tokenCache = new Map();          // token -> { user, until }
const CACHE_MS = 60 * 1000;

function bearer(req){
  const h = req.get("authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

async function userFromToken(token){
  const hit = tokenCache.get(token);
  if(hit && hit.until > Date.now()) return hit.user;
  const { data, error } = await admin.auth.getUser(token);
  if(error || !data || !data.user) return null;
  tokenCache.set(token, { user: data.user, until: Date.now() + CACHE_MS });
  if(tokenCache.size > 5000) tokenCache.clear();
  return data.user;
}
const forgetToken = token => tokenCache.delete(token);
const forgetUser = userId => { for(const [k, v] of tokenCache) if(v.user && v.user.id === userId) tokenCache.delete(k); };

const requireUser = wrap(async (req, res, next) => {
  if(problem) throw new HttpError(503, problem);
  const token = bearer(req);
  if(!token) throw new HttpError(401, "Please log in.");
  const user = await userFromToken(token);
  if(!user) throw new HttpError(401, "Your session has ended. Please log in again.");
  // Two-step verification: once someone has turned it on, a password-only session (aal1) is not enough.
  if(hasMfa(user) && aalOf(token) !== "aal2") throw new HttpError(401, "Enter the code from your authenticator app to continue.", { code: "mfa_required" });
  req.user = user; req.token = token; req.db = forUser(token);
  next();
});

let catalogCache = null;
async function allPermissions(){
  if(catalogCache) return catalogCache;
  const rows = check(await admin.from("cff_permissions").select("key").order("sort"), "permissions");
  catalogCache = rows.map(r => r.key);
  return catalogCache;
}

async function isSuperAdmin(userId){
  const r = await admin.from("cff_super_admins").select("user_id").eq("user_id", userId).maybeSingle();
  return !!(r && r.data);
}

// Loads the company, the person's role and permissions. Mount after requireUser on /api/c/:companyId.
const requireCompany = wrap(async (req, res, next) => {
  const companyId = req.params.companyId;
  if(!UUID.test(companyId || "")) throw new HttpError(404, "Company not found.");
  const [member, company] = await Promise.all([
    req.db.from("cff_company_members").select("id,role_key,display_name,designation,status").eq("company_id", companyId).eq("user_id", req.user.id).maybeSingle(),
    req.db.from("cff_companies").select("id,name,legal_name,industry,description,city,country,settings,created_at,archived_at").eq("id", companyId).maybeSingle()
  ]);
  const m = check(member, "membership"), c = check(company, "company");
  let role = m && m.status === "active" ? m.role_key : null;
  if(!role && c && await isSuperAdmin(req.user.id)) role = "super_admin";
  if(!c || !role){
    securityLog("company_access_denied", req, { companyId });
    throw new HttpError(404, "Company not found, or you are not a member of it.");
  }
  // Company rule (optional): owners, founders and HR must use two-step verification.
  if(c.settings && c.settings.require_mfa && ["owner", "founder", "hr"].includes(role) && !hasMfa(req.user)){
    securityLog("mfa_setup_required", req, { companyId });
    throw new HttpError(403, "This company requires two-step verification for your role. Turn it on in My profile → Account security, then continue.", { code: "mfa_setup_required" });
  }
  let perms;
  if(role === "owner" || role === "super_admin") perms = await allPermissions();
  else perms = check(await req.db.from("cff_role_permissions").select("permission").eq("company_id", companyId).eq("role_key", role).eq("allowed", true), "role permissions").map(r => r.permission);
  req.company = c; req.companyId = companyId; req.role = role; req.member = m; req.perms = new Set(perms); req.experience = experienceOf(role);
  next();
});

const can = (req, p) => req.perms && req.perms.has(p);

// The experience a role gets (which dashboard and navigation). What each person can open is still decided
// by their permissions; the experience only decides the layout and their home page.
//   business   — Owner, Founder / Director (and Super Admin): the complete company-building system
//   operations — Manager: operational dashboard (plans, team tasks, KPIs) by permission
//   hr         — HR: people dashboard (employees, onboarding, SOPs, policies, training) by permission
//   employee   — Employee Portal: approved company information, my work, shared resources
//   viewer     — read-only approved company information
const EXPERIENCE = { owner: "business", super_admin: "business", founder: "business", manager: "operations", hr: "hr", employee: "employee", viewer: "viewer" };
const experienceOf = role => EXPERIENCE[role] || "viewer";

// Route guard: needs at least one of the listed permissions.
// "*" = any member of the company (the database still limits which rows they see).
const perm = (...keys) => (req, res, next) => {
  if(keys.includes("*") || keys.some(k => can(req, k))) return next();
  securityLog("permission_denied", req, { needed: keys.join("|") });
  next(new HttpError(403, "You don't have permission to do that."));
};

module.exports = { requireUser, requireCompany, perm, can, experienceOf, bearer, userFromToken, forgetToken, forgetUser, isSuperAdmin, allPermissions };
