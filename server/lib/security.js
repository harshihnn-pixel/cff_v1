// Account security helpers: two-step verification level, login activity and per-email login throttling.
const { admin } = require("./supabase");

// The "aal" claim of a Supabase access token: aal1 = password only, aal2 = password + two-step code.
// The token has already been validated by Supabase (auth.getUser) before this is read.
function aalOf(token){
  try{ const p = JSON.parse(Buffer.from(String(token).split(".")[1], "base64url").toString("utf8")); return p.aal || "aal1"; }
  catch(e){ return "aal1"; }
}
const verifiedFactors = user => ((user && user.factors) || []).filter(f => f.status === "verified");
const hasMfa = user => verifiedFactors(user).length > 0;

// Login activity, readable by the person on their Account security page. Never stores passwords or tokens.
async function loginEvent(userId, event, req){
  if(!admin || !userId) return;
  const ua = String((req && req.get && req.get("user-agent")) || "").slice(0, 300);
  const r = await admin.from("cff_login_events").insert({ user_id: userId, event, ip: req ? String(req.ip || "").slice(0, 60) : null, user_agent: ua || null });
  if(r.error) console.error("[CFF] login event:", r.error.message);
}
async function userIdForEmail(email){
  if(!admin) return null;
  const r = await admin.from("cff_profiles").select("user_id").eq("email", String(email).toLowerCase()).limit(1);
  return r.data && r.data[0] ? r.data[0].user_id : null;
}

// After 5 failed logins for one email within 15 minutes, that email is paused for 15 minutes
// (in addition to the per-IP rate limit). Kept in memory; resets when the server restarts.
const fails = new Map();
const WINDOW = 15 * 60 * 1000, MAX_FAILS = 5;
function loginLocked(email){
  const f = fails.get(email); if(!f) return 0;
  const recent = f.filter(t => Date.now() - t < WINDOW); fails.set(email, recent);
  return recent.length >= MAX_FAILS ? Math.ceil((WINDOW - (Date.now() - recent[0])) / 60000) : 0;
}
function loginFailed(email){ const f = (fails.get(email) || []).filter(t => Date.now() - t < WINDOW); f.push(Date.now()); fails.set(email, f); if(fails.size > 10000) fails.clear(); }
const loginSucceeded = email => fails.delete(email);

module.exports = { aalOf, hasMfa, verifiedFactors, loginEvent, userIdForEmail, loginLocked, loginFailed, loginSucceeded };
