// Accounts: sign up (with email confirmation), log in, forgot / reset password, profile and invitations.
const express = require("express");
const config = require("../lib/config");
const { admin, authClient, problem } = require("../lib/supabase");
const { HttpError, wrap, check, v } = require("../lib/http");
const { requireUser, forgetToken, forgetUser, isSuperAdmin } = require("../lib/auth");
const { securityLog } = require("../lib/log");
const { aalOf, hasMfa, verifiedFactors, loginEvent, userIdForEmail, loginLocked, loginFailed, loginSucceeded } = require("../lib/security");

const pub = express.Router();      // /api/auth  (no login needed)
const me = express.Router();       // /api/me    (login needed)

const CALLBACK = () => config.appUrl + "/auth-callback.html";
const sessionOut = s => ({ access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at });
const needDb = () => { if(problem) throw new HttpError(503, problem); };

// Everything the website needs to know about the signed-in person.
async function meFor(user){
  const [profiles, members, invites, superAdmin] = await Promise.all([
    admin.from("cff_profiles").select("full_name,phone,portal,created_at").eq("user_id", user.id).order("created_at"),
    admin.from("cff_company_members").select("company_id,role_key,designation,status").eq("user_id", user.id).neq("status", "removed"),
    admin.from("cff_invitations").select("id,company_id,role_key,designation,created_at,expires_at").eq("email", user.email.toLowerCase()).is("accepted_at", null).is("revoked_at", null),
    isSuperAdmin(user.id)
  ]);
  const all = check(members, "members") || [];
  const ms = all.filter(m => m.status === "active"), off = all.filter(m => m.status === "disabled");
  const inv = check(invites, "invitations") || [];
  const ids = [...new Set([...all.map(m => m.company_id), ...inv.map(i => i.company_id)])];
  const companies = ids.length ? check(await admin.from("cff_companies").select("id,name,archived_at").in("id", ids), "companies") : [];
  const byId = Object.fromEntries(companies.map(c => [c.id, c]));
  const prof = (check(profiles, "profiles") || [])[0] || {};
  return {
    user: { id: user.id, email: user.email, confirmed: !!user.email_confirmed_at },
    profile: { full_name: prof.full_name || (user.user_metadata && user.user_metadata.full_name) || user.email.split("@")[0], phone: prof.phone || "", portal: prof.portal || "business" },
    companies: ms.filter(m => byId[m.company_id] && !byId[m.company_id].archived_at)
      .map(m => ({ id: m.company_id, name: byId[m.company_id].name, role: m.role_key, designation: m.designation }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    invitations: inv.filter(i => byId[i.company_id]).map(i => ({ id: i.id, company_id: i.company_id, company: byId[i.company_id].name, role: i.role_key, designation: i.designation,
      expires_at: i.expires_at, expired: !!(i.expires_at && new Date(i.expires_at) < new Date()) })),
    deactivated: off.filter(m => byId[m.company_id]).map(m => byId[m.company_id].name),   // companies where this person's access is switched off
    mfa: hasMfa(user),
    superAdmin
  };
}

async function ensureProfile(user, portal, name, phone){
  const row = { user_id: user.id, portal: ["business","employee","visitor"].includes(portal) ? portal : "business",
                full_name: name || (user.user_metadata && user.user_metadata.full_name) || user.email.split("@")[0], email: user.email, phone: phone || null };
  const r = await admin.from("cff_profiles").upsert(row, { onConflict: "user_id,portal", ignoreDuplicates: true });
  if(r.error) console.error("[CFF] profile:", r.error.message);
}

// POST /api/auth/signup { name, email, password, phone, portal }
pub.post("/signup", wrap(async (req, res) => {
  needDb();
  const b = req.body || {};
  const name = v.str(b.name, "Full name", 120);
  if(name.length < 2) throw new HttpError(400, "Enter your full name.");
  const email = v.email(b.email);
  const password = v.password(b.password, email);
  const phone = v.phone(b.phone);
  const portal = v.oneOf(b.portal, "Portal", ["business","employee","visitor"], { optional: true, default: "business" });

  const { data, error } = await authClient().auth.signUp({ email, password, options: { emailRedirectTo: CALLBACK(), data: { full_name: name } } });
  const exists = (error && (error.status === 422 || /already/i.test(error.message || ""))) ||
                 (data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0);
  if(error && !exists){ console.error("[CFF] signup:", error.message); throw new HttpError(400, /password/i.test(error.message) ? error.message : "Could not create the account. Please try again."); }
  if(exists){
    // Don't reveal whether an email is registered.
    return res.status(200).json({ needsConfirmation: true, message: "If this email is new, we've sent a confirmation link. If you already have an account, log in or reset your password. Invited by a company? Open the invitation email to set your password, or use “Forgot password”." });
  }
  await ensureProfile(data.user, portal, name, phone);
  if(data.session) return res.status(201).json({ session: sessionOut(data.session), me: await meFor(data.user) });
  res.status(201).json({ needsConfirmation: true, message: "We've sent a confirmation link to " + email + ". Open it to activate your account, then log in." });
}));

// When the account has two-step verification, a password login only gives a first-step session.
// The website then asks for the 6-digit code (POST /api/auth/mfa).
function mfaPending(session, user){
  const f = verifiedFactors(user)[0];
  return { mfaRequired: true, factorId: f.id, pending: sessionOut(session), message: "Enter the 6-digit code from your authenticator app." };
}

// POST /api/auth/login { email, password }
pub.post("/login", wrap(async (req, res) => {
  needDb();
  const b = req.body || {};
  const email = v.email(b.email);
  if(typeof b.password !== "string" || !b.password) throw new HttpError(400, "Enter your password.");
  const wait = loginLocked(email);
  if(wait){ securityLog("login_locked", req, { email }); throw new HttpError(429, "Too many failed attempts for this account. Try again in " + wait + " minute" + (wait > 1 ? "s" : "") + ", or reset your password."); }
  const { data, error } = await authClient().auth.signInWithPassword({ email, password: b.password });
  if(error || !data || !data.session){
    if(error && (error.code === "email_not_confirmed" || /not confirmed/i.test(error.message || "")))
      throw new HttpError(403, "Please confirm your email first. Open the link we sent you, or ask for a new one.", { code: "email_not_confirmed" });
    loginFailed(email);
    securityLog("login_failed", req, { email });
    await loginEvent(await userIdForEmail(email), "login_failed", req);
    throw new HttpError(401, "Email or password is incorrect. Check both and try again.");
  }
  loginSucceeded(email);
  if(hasMfa(data.user)) return res.json(mfaPending(data.session, data.user));
  await loginEvent(data.user.id, "login", req);
  res.json({ session: sessionOut(data.session), me: await meFor(data.user) });
}));

// POST /api/auth/mfa { access_token, refresh_token, factorId, code } — second step of logging in.
pub.post("/mfa", wrap(async (req, res) => {
  needDb();
  const b = req.body || {};
  const code = String(b.code || "").replace(/\s+/g, "");
  if(!/^\d{6}$/.test(code)) throw new HttpError(400, "Enter the 6-digit code from your authenticator app.");
  const c = authClient();
  const set = await c.auth.setSession({ access_token: String(b.access_token || "").slice(0, 4000), refresh_token: String(b.refresh_token || "").slice(0, 4000) });
  if(set.error) throw new HttpError(401, "Your login has expired. Please log in again.");
  const { data: who } = await admin.auth.getUser(String(b.access_token || ""));
  const userId = who && who.user && who.user.id;
  const r = await c.auth.mfa.challengeAndVerify({ factorId: v.uuid(b.factorId, "Authenticator"), code });
  if(r.error || !r.data || !r.data.access_token){
    await loginEvent(userId, "mfa_failed", req); securityLog("mfa_failed", req, { userId });
    throw new HttpError(401, "That code didn't work. Check the time on your phone and try the newest code.", { code: "mfa_invalid" });
  }
  await loginEvent(userId, "mfa_verified", req);
  const { data: u2 } = await admin.auth.getUser(r.data.access_token);
  res.json({ session: { access_token: r.data.access_token, refresh_token: r.data.refresh_token, expires_at: r.data.expires_at || Math.floor(Date.now() / 1000) + (r.data.expires_in || 3600) }, me: await meFor(u2.user) });
}));

// POST /api/auth/refresh { refresh_token }
pub.post("/refresh", wrap(async (req, res) => {
  needDb();
  const token = typeof (req.body || {}).refresh_token === "string" ? req.body.refresh_token.slice(0, 4000) : "";
  if(!token) throw new HttpError(401, "Please log in again.");
  const { data, error } = await authClient().auth.refreshSession({ refresh_token: token });
  if(error || !data || !data.session) throw new HttpError(401, "Your session has ended. Please log in again.");
  res.json({ session: sessionOut(data.session) });
}));

// POST /api/auth/logout
pub.post("/logout", wrap(async (req, res) => {
  const h = req.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if(admin && token){ forgetToken(token); await admin.auth.admin.signOut(token).catch(() => {}); }
  res.json({ ok: true });
}));

// POST /api/auth/forgot { email } — always answers the same way, so it can't be used to discover accounts.
pub.post("/forgot", wrap(async (req, res) => {
  needDb();
  const email = v.email((req.body || {}).email);
  const { error } = await authClient().auth.resetPasswordForEmail(email, { redirectTo: CALLBACK() });
  if(error) console.error("[CFF] forgot password:", error.message);
  securityLog("password_reset_requested", req, { email });
  res.json({ ok: true, message: "If an account exists for " + email + ", we've emailed a link to reset the password." });
}));

// POST /api/auth/resend { email } — sends the confirmation email again.
pub.post("/resend", wrap(async (req, res) => {
  needDb();
  const email = v.email((req.body || {}).email);
  const { error } = await authClient().auth.resend({ type: "signup", email, options: { emailRedirectTo: CALLBACK() } });
  if(error) console.error("[CFF] resend:", error.message);
  res.json({ ok: true, message: "If this account still needs confirming, we've sent a new link to " + email + "." });
}));

// POST /api/auth/reset { access_token, password } — from the link in the reset email.
pub.post("/reset", wrap(async (req, res) => {
  needDb();
  const b = req.body || {};
  const token = typeof b.access_token === "string" ? b.access_token.slice(0, 4000) : "";
  const { data, error } = token ? await admin.auth.getUser(token) : { data: null, error: true };
  if(error || !data || !data.user) throw new HttpError(400, "This reset link has expired. Ask for a new one.");
  const password = v.password(b.password, data.user.email);
  const up = await admin.auth.admin.updateUserById(data.user.id, { password });
  if(up.error){ console.error("[CFF] reset:", up.error.message); throw new HttpError(400, "Could not change the password. Ask for a new reset link."); }
  forgetToken(token);
  // People who joined through an invitation email get their profile here (with the name they typed, if any).
  const invName = b.name ? v.str(b.name, "Full name", 120) : undefined;
  await ensureProfile(data.user, invName ? "employee" : "business", invName);
  await loginEvent(data.user.id, "password_reset", req);
  securityLog("password_reset_done", { user: data.user, ip: req.ip, originalUrl: req.originalUrl });
  res.json({ ok: true, message: "Your password has been changed. You can log in now." });
}));

// POST /api/auth/session { access_token, refresh_token } — after clicking the email confirmation link.
pub.post("/session", wrap(async (req, res) => {
  needDb();
  const b = req.body || {};
  const { data, error } = await admin.auth.getUser(String(b.access_token || "").slice(0, 4000));
  if(error || !data || !data.user) throw new HttpError(400, "This link has expired. Log in or ask for a new link.");
  await ensureProfile(data.user, "business");
  const sess = { access_token: b.access_token, refresh_token: b.refresh_token, expires_at: Number(b.expires_at) || null };
  if(hasMfa(data.user) && aalOf(b.access_token) !== "aal2") return res.json(mfaPending(sess, data.user));
  res.json({ session: sess, me: await meFor(data.user) });
}));

// ---------- signed-in account ----------
me.use(requireUser);

me.get("/", wrap(async (req, res) => res.json(await meFor(req.user))));

me.patch("/", wrap(async (req, res) => {
  const b = req.body || {};
  const name = v.str(b.full_name, "Full name", 120);
  const phone = v.phone(b.phone);
  await ensureProfile(req.user, "business", name, phone);
  check(await admin.from("cff_profiles").update({ full_name: name, phone }).eq("user_id", req.user.id), "profile");
  check(await admin.from("cff_company_members").update({ display_name: name }).eq("user_id", req.user.id), "member names");
  res.json(await meFor(req.user));
}));

// POST /api/me/password { current_password, new_password }
me.post("/password", wrap(async (req, res) => {
  const b = req.body || {};
  const check1 = await authClient().auth.signInWithPassword({ email: req.user.email, password: String(b.current_password || "") });
  if(check1.error){ securityLog("password_change_failed", req); throw new HttpError(400, "Your current password is not correct."); }
  const password = v.password(b.new_password, req.user.email);
  const up = await admin.auth.admin.updateUserById(req.user.id, { password });
  if(up.error) throw new HttpError(400, "Could not change the password. Please try again.");
  securityLog("password_changed", req);
  await loginEvent(req.user.id, "password_changed", req);
  res.json({ ok: true, message: "Password changed." });
}));

// POST /api/me/invitations/:id/accept — join a company you were invited to.
me.post("/invitations/:id/accept", wrap(async (req, res) => {
  const id = v.uuid(req.params.id, "Invitation");
  if(!req.user.email_confirmed_at) throw new HttpError(403, "Confirm your email address first, then accept the invitation.");
  const inv = check(await admin.from("cff_invitations").select("*").eq("id", id).maybeSingle(), "invitation");
  if(!inv || inv.accepted_at || inv.revoked_at || inv.email.toLowerCase() !== req.user.email.toLowerCase())
    throw new HttpError(404, "This invitation is no longer available. It may have been cancelled or already used.");
  if(inv.expires_at && new Date(inv.expires_at) < new Date())
    throw new HttpError(410, "This invitation has expired. Ask the company to send you a new one.", { code: "invitation_expired" });
  const disabled = check(await admin.from("cff_company_members").select("status").eq("company_id", inv.company_id).eq("user_id", req.user.id).maybeSingle(), "member status");
  if(disabled && disabled.status === "disabled") throw new HttpError(403, "Your access to this company has been deactivated. Contact the company owner.");
  const prof = check(await admin.from("cff_profiles").select("full_name").eq("user_id", req.user.id).limit(1), "profile");
  const name = (prof[0] && prof[0].full_name) || req.user.email;
  const existing = check(await admin.from("cff_company_members").select("id,status").eq("company_id", inv.company_id).eq("user_id", req.user.id).maybeSingle(), "member");
  if(existing) check(await admin.from("cff_company_members").update({ status: "active", role_key: inv.role_key, designation: inv.designation }).eq("id", existing.id), "rejoin");
  else check(await admin.from("cff_company_members").insert({ company_id: inv.company_id, user_id: req.user.id, role_key: inv.role_key,
    display_name: name, email: req.user.email, designation: inv.designation, invited_by: inv.invited_by }), "join");
  if(inv.employee_id) check(await admin.from("cff_employees").update({ user_id: req.user.id }).eq("id", inv.employee_id).eq("company_id", inv.company_id), "link employee");
  check(await admin.from("cff_invitations").update({ accepted_at: new Date().toISOString(), accepted_by: req.user.id }).eq("id", id), "accept");
  res.json(await meFor(req.user));
}));

me.post("/invitations/:id/decline", wrap(async (req, res) => {
  const id = v.uuid(req.params.id, "Invitation");
  const inv = check(await admin.from("cff_invitations").select("id,email").eq("id", id).maybeSingle(), "invitation");
  if(inv && inv.email.toLowerCase() === req.user.email.toLowerCase())
    check(await admin.from("cff_invitations").update({ revoked_at: new Date().toISOString() }).eq("id", id), "decline");
  res.json(await meFor(req.user));
}));

// ---------- account security ----------
// GET /api/me/security — two-step verification status and recent login activity (the person's own).
me.get("/security", wrap(async (req, res) => {
  const ev = check(await req.db.from("cff_login_events").select("event,ip,user_agent,created_at").eq("user_id", req.user.id).order("created_at", { ascending: false }).limit(20), "login activity");
  res.json({ mfa: { enabled: hasMfa(req.user), factors: verifiedFactors(req.user).map(f => ({ id: f.id, name: f.friendly_name || "Authenticator app", created_at: f.created_at })) },
             events: ev });
}));

// MFA management needs the person's own session (access + refresh token) on the auth client.
async function sessionClient(req){
  const rt = String((req.body || {}).refresh_token || "").slice(0, 4000);
  if(!rt) throw new HttpError(400, "Please log in again, then try once more.");
  const c = authClient();
  const r = await c.auth.setSession({ access_token: req.token, refresh_token: rt });
  if(r.error) throw new HttpError(401, "Your session has ended. Please log in again.");
  return c;
}

// POST /api/me/mfa/enroll { refresh_token } — starts setup: returns a QR code and secret for the authenticator app.
me.post("/mfa/enroll", wrap(async (req, res) => {
  if(hasMfa(req.user)) throw new HttpError(409, "Two-step verification is already on.");
  const c = await sessionClient(req);
  const r = await c.auth.mfa.enroll({ factorType: "totp", friendlyName: "CFF " + new Date().toISOString().slice(0, 10), issuer: "CFF" });
  if(r.error || !r.data){ console.error("[CFF] mfa enroll:", r.error && r.error.message); throw new HttpError(400, "Two-step verification couldn't be started. Check that MFA (TOTP) is enabled in Supabase Authentication, then try again."); }
  res.json({ factorId: r.data.id, qr: r.data.totp.qr_code, secret: r.data.totp.secret });
}));

// POST /api/me/mfa/verify { refresh_token, factorId, code } — finishes setup; returns a new (verified) session.
me.post("/mfa/verify", wrap(async (req, res) => {
  const code = String((req.body || {}).code || "").replace(/\s+/g, "");
  if(!/^\d{6}$/.test(code)) throw new HttpError(400, "Enter the 6-digit code from your authenticator app.");
  const c = await sessionClient(req);
  const r = await c.auth.mfa.challengeAndVerify({ factorId: v.uuid((req.body || {}).factorId, "Authenticator"), code });
  if(r.error || !r.data || !r.data.access_token) throw new HttpError(400, "That code didn't work. Check the time on your phone and try the newest code.");
  forgetUser(req.user.id);
  await loginEvent(req.user.id, "mfa_enabled", req); securityLog("mfa_enabled", req);
  res.json({ ok: true, session: { access_token: r.data.access_token, refresh_token: r.data.refresh_token, expires_at: r.data.expires_at || Math.floor(Date.now() / 1000) + (r.data.expires_in || 3600) } });
}));

// POST /api/me/mfa/disable { refresh_token, factorId } — needs a session verified with the code (aal2).
me.post("/mfa/disable", wrap(async (req, res) => {
  const factorId = v.uuid((req.body || {}).factorId, "Authenticator");
  if(!verifiedFactors(req.user).some(f => f.id === factorId)) throw new HttpError(404, "Authenticator not found.");
  const ms = check(await admin.from("cff_company_members").select("role_key,company_id").eq("user_id", req.user.id).eq("status", "active"), "memberships")
    .filter(m => ["owner", "founder", "hr"].includes(m.role_key));
  const cos = ms.length ? check(await admin.from("cff_companies").select("id,name,settings").in("id", ms.map(m => m.company_id)), "companies") : [];
  const needs = cos.filter(c => c.settings && c.settings.require_mfa);
  if(needs.length) throw new HttpError(409, "You can't turn off two-step verification: " + needs.map(c => c.name).join(", ") + " requires it for your role.");
  const c = await sessionClient(req);
  const r = await c.auth.mfa.unenroll({ factorId });
  if(r.error){ console.error("[CFF] mfa unenroll:", r.error.message); throw new HttpError(400, "Couldn't turn off two-step verification. Log out, log in again with your code, and try once more."); }
  forgetUser(req.user.id);
  await loginEvent(req.user.id, "mfa_disabled", req); securityLog("mfa_disabled", req);
  res.json({ ok: true });
}));

// POST /api/me/logout-all — ends every session of this account on every device.
me.post("/logout-all", wrap(async (req, res) => {
  const r = await admin.auth.admin.signOut(req.token, "global");
  if(r && r.error){ console.error("[CFF] logout all:", r.error.message); throw new HttpError(500, "Couldn't log out other devices. Please try again."); }
  forgetUser(req.user.id);
  await loginEvent(req.user.id, "logout_all", req); securityLog("logout_all", req);
  res.json({ ok: true, message: "You have been logged out on all devices." });
}));

module.exports = { pub, me, meFor };
