// CFF AI Assistant (Google Gemini): chat, history, and one-off tasks (analyses, drafts, suggestions).
// AI output is always kept separate from approved company information; people decide what to use.
const express = require("express");
const { HttpError, wrap, check, v } = require("../lib/http");
const { perm, can } = require("../lib/auth");
const { aiProblem, streamChat } = require("../lib/gemini");
const { aiRules, AI_TASKS } = require("../../public/js/content/ai-rules");
const ctx = require("../lib/aicontext");
const summary = require("../lib/summary");
const CAT = require("../../public/js/content/catalogs");

const r = express.Router({ mergeParams: true });   // /api/c/:companyId/ai

// Streams Gemini's answer to the browser as plain text. Returns { answer, complete } or null if the person left.
async function streamTo(req, res, system, messages){
  const problem = aiProblem();
  if(problem) throw new HttpError(503, problem);
  const ctl = new AbortController();
  res.on("close", () => { if(!res.writableEnded) ctl.abort(); });
  const stream = streamChat(system, messages, ctl.signal);
  let first;
  try{ first = await stream.next(); }
  catch(e){ if(e.name === "AbortError") return null; throw new HttpError(e.status || 502, e.message); }
  res.status(200);
  res.set({ "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" });
  let answer = "", complete = true;
  try{
    if(!first.done){ answer += first.value; res.write(first.value); }
    for await (const piece of stream){ answer += piece; res.write(piece); }
  }catch(e){
    complete = false;
    if(e.name !== "AbortError"){ const note = "\n\n(The answer was interrupted: " + e.message + ")"; answer += note; res.write(note); }
  }
  if(!res.writableEnded) res.end();
  return { answer, complete };
}

const system = (req, context) => aiRules(req.role) + "\n\n---\n" + ctx.companyLine(req) + "\n\nThe page the person is on and the information they can see:\n\n" + (context || "(nothing yet)");

r.get("/status", wrap(async (req, res) => { const p = aiProblem(); res.json({ ready: !p && can(req, "ai.use"), message: p || (can(req, "ai.use") ? "" : "Your role doesn't include the AI assistant.") }); }));

r.get("/history", perm("ai.use"), wrap(async (req, res) => {
  const rows = check(await req.db.from("cff_ai_chats").select("role,content,created_at").eq("company_id", req.companyId).eq("user_id", req.user.id)
    .order("created_at", { ascending: false }).limit(40), "chat history");
  res.json({ messages: rows.reverse().map(m => ({ role: m.role, content: m.content })) });
}));

r.delete("/history", perm("ai.use"), wrap(async (req, res) => {
  check(await req.db.from("cff_ai_chats").delete().eq("company_id", req.companyId).eq("user_id", req.user.id), "clear chat");
  res.json({ ok: true });
}));

// POST /ai/chat { messages: [{role, content}], context, label }
r.post("/chat", perm("ai.use"), wrap(async (req, res) => {
  const b = req.body || {};
  const messages = (Array.isArray(b.messages) ? b.messages : []).slice(-12)
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if(!messages.length || messages[messages.length - 1].role !== "user") throw new HttpError(400, "Type a question first.");
  const context = typeof b.context === "string" ? b.context.slice(0, 14000) : "";
  const label = typeof b.label === "string" ? b.label.slice(0, 200) : "";
  const out = await streamTo(req, res, system(req, context), messages);
  if(!out || !out.answer.trim()) return;
  const now = Date.now();
  const saved = await req.db.from("cff_ai_chats").insert([
    { company_id: req.companyId, user_id: req.user.id, role: "user", content: messages[messages.length - 1].content, page: label, created_at: new Date(now).toISOString() },
    { company_id: req.companyId, user_id: req.user.id, role: "assistant", content: out.answer, page: label, created_at: new Date(now + 1).toISOString() }]);
  if(saved.error) console.error("[CFF] save chat:", saved.error.message);
}));

// Which permission each task needs, and whether its result is saved for everyone in the company or just this person.
const TASKS = {
  values_analysis:    { perm: "ai.use",        shared: false },
  partner_summary:    { perm: "partners.view", shared: true },
  partner_strengths:  { perm: "partners.view", shared: true },
  partner_comparison: { perm: "partners.view", shared: true },
  values_alignment:   { perm: "partners.view", shared: true },
  master_profile:     { perm: "profile.edit",  shared: false, noSave: true },   // reviewed and saved as a profile draft by the person
  plan_suggestions:   { perm: "plans.edit",    shared: false, noSave: true },   // the person picks which items to add
  recommendations:    { perm: "cff.view",      shared: true },
  stage_review:       { perm: "cff.view",      shared: true }
};

// POST /ai/generate { kind, partnerId, plan, stage, hash }
r.post("/generate", perm("ai.use"), wrap(async (req, res) => {
  const b = req.body || {};
  const kind = v.oneOf(b.kind, "Task", Object.keys(TASKS));
  const t = TASKS[kind];
  if(!can(req, t.perm)) throw new HttpError(403, "You don't have permission to do that.");
  const params = {};
  let subject = "", instruction;
  if(kind === "partner_summary" || kind === "partner_strengths"){ params.partnerId = v.uuid(b.partnerId, "Partner"); subject = params.partnerId; }
  if(kind === "plan_suggestions"){ params.plan = v.oneOf(b.plan, "Plan", CAT.PLAN_TYPES.map(p => p[0])); subject = params.plan; instruction = AI_TASKS.plan_suggestions.prompt(CAT.opt(CAT.PLAN_TYPES)[params.plan].toLowerCase()); }
  if(kind === "stage_review"){ params.stage = v.int(b.stage, "Stage", 1, 13); subject = String(params.stage); instruction = AI_TASKS.stage_review.prompt("Stage " + params.stage + ": " + summary.STAGES.find(s => s.n === params.stage).title); }
  // A comparison written with financial details is stored separately, so only people who may see money can read it.
  if(kind === "partner_comparison") subject = can(req, "partners.financial") ? "financial" : "";
  if(kind === "master_profile") instruction = AI_TASKS.master_profile.prompt(CAT.PROFILE_SECTIONS);
  if(!instruction) instruction = AI_TASKS[kind].prompt();
  let context;
  try{ context = await ctx.forTask(req, kind, params); }
  catch(e){ if(e.status) throw new HttpError(e.status, e.message); throw e; }
  const out = await streamTo(req, res, system(req, context), [{ role: "user", content: instruction }]);
  if(!out || !out.complete || !out.answer.trim() || t.noSave) return;
  const row = { company_id: req.companyId, user_id: t.shared ? null : req.user.id, kind, subject, content: out.answer,
                input_hash: typeof b.hash === "string" ? b.hash.slice(0, 64) : null, updated_at: new Date().toISOString() };
  const existing = check(await (t.shared ? req.db.from("cff_ai_outputs").select("id").eq("company_id", req.companyId).is("user_id", null)
    : req.db.from("cff_ai_outputs").select("id").eq("company_id", req.companyId).eq("user_id", req.user.id)).eq("kind", kind).eq("subject", subject).maybeSingle(), "find output");
  const saved = existing ? await req.db.from("cff_ai_outputs").update(row).eq("id", existing.id) : await req.db.from("cff_ai_outputs").insert(row);
  if(saved.error) console.error("[CFF] save AI output:", saved.error.message);
}));

// GET /ai/outputs?kind=&subject=
r.get("/outputs", perm("ai.use", "cff.view", "partners.view"), wrap(async (req, res) => {
  let q = req.db.from("cff_ai_outputs").select("id,user_id,kind,subject,content,input_hash,updated_at").eq("company_id", req.companyId);
  if(req.query.kind) q = q.eq("kind", String(req.query.kind).slice(0, 40));
  if(req.query.subject !== undefined) q = q.eq("subject", String(req.query.subject).slice(0, 80));
  const rows = check(await q.order("updated_at", { ascending: false }).limit(100), "AI outputs");
  res.json({ items: rows.filter(x => !x.user_id || x.user_id === req.user.id) });
}));

module.exports = r;
