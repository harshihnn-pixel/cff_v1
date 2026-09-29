// The 13 CFF stages: answers, stage status and the approval workflow.
const express = require("express");
const { admin } = require("../lib/supabase");
const { HttpError, wrap, check, v } = require("../lib/http");
const { perm, can } = require("../lib/auth");
const { notify, usersWithPerm } = require("../lib/notify");
const summary = require("../lib/summary");
const READINESS = require("../../public/js/content/readiness");

const r = express.Router({ mergeParams: true });   // /api/c/:companyId/cff

const stageNo = x => v.int(x, "Stage", 1, 13);

async function stageRow(db, companyId, n){
  return check(await db.from("cff_stage_status").select("stage,status,submitted_by,submitted_at,approved_by,approved_at,comment").eq("company_id", companyId).eq("stage", n).maybeSingle(), "stage status");
}

// GET /cff — all answers and stage statuses
r.get("/", perm("cff.view"), wrap(async (req, res) => {
  const [ans, st] = await Promise.all([
    req.db.from("cff_answers").select("point_id,answer,done,updated_at,updated_by").eq("company_id", req.companyId),
    req.db.from("cff_stage_status").select("stage,status,submitted_at,approved_at,approved_by,comment,updated_at").eq("company_id", req.companyId)
  ]);
  const answers = {};
  check(ans, "answers").forEach(a => { answers[a.point_id] = { text: a.answer, done: a.done, updated: a.updated_at, by: a.updated_by }; });
  const stages = {};
  check(st, "stages").forEach(s => { stages[s.stage] = s; });
  res.json({ answers, stages, canEdit: can(req, "cff.edit"), canApprove: can(req, "cff.approve") });
}));

// PUT /cff/answers/:pointId { text, done }
r.put("/answers/:pointId", perm("cff.edit"), wrap(async (req, res) => {
  const p = summary.POINT[req.params.pointId];
  if(!p || p.id === summary.VALUES_POINT) throw new HttpError(404, "Unknown CFF point.");
  const b = req.body || {};
  const text = v.text(b.text, "Answer", 20000);
  const done = v.bool(b.done);
  const st = await stageRow(req.db, req.companyId, p.stage);
  if(st && st.status === "approved") throw new HttpError(409, "Stage " + p.stage + " is approved. Reopen it before making changes.", { code: "stage_locked" });
  const row = check(await req.db.from("cff_answers").upsert({ company_id: req.companyId, point_id: p.id, answer: text, done, updated_by: req.user.id },
    { onConflict: "company_id,point_id" }).select("point_id,answer,done,updated_at").single(), "save answer");
  // Move the stage from "not started" to draft / in progress automatically.
  const cur = st ? st.status : "not_started";
  if(["not_started","draft","in_progress"].includes(cur)){
    const all = check(await req.db.from("cff_answers").select("answer,done").eq("company_id", req.companyId).eq("stage", p.stage), "stage answers");
    const next = all.some(a => a.done) ? "in_progress" : all.some(a => (a.answer || "").trim()) ? "draft" : "not_started";
    if(next !== cur) check(await req.db.from("cff_stage_status").upsert({ company_id: req.companyId, stage: p.stage, status: next }, { onConflict: "company_id,stage" }), "stage status");
  }
  res.json({ answer: { text: row.answer, done: row.done, updated: row.updated_at } });
}));

// GET /cff/stages/:n/history — reviews and approved snapshots
r.get("/stages/:n/history", perm("cff.view"), wrap(async (req, res) => {
  const n = stageNo(req.params.n);
  const [appr, snaps] = await Promise.all([
    req.db.from("cff_stage_approvals").select("id,action,comment,actor_name,created_at").eq("company_id", req.companyId).eq("stage", n).order("created_at", { ascending: false }).limit(50),
    req.db.from("cff_versions").select("id,new_value,changed_by_name,changed_at").eq("company_id", req.companyId).eq("entity", "stage_snapshot").eq("entity_key", String(n)).order("changed_at", { ascending: false }).limit(20)
  ]);
  res.json({ reviews: check(appr, "reviews"), snapshots: check(snaps, "snapshots") });
}));

// GET /cff/versions?key=s1-0-1 — version history of one answer
r.get("/versions", perm("cff.view"), wrap(async (req, res) => {
  const key = String(req.query.key || "");
  if(!summary.POINT[key]) throw new HttpError(400, "Unknown CFF point.");
  const rows = check(await req.db.from("cff_versions").select("id,old_value,new_value,changed_by_name,changed_at").eq("company_id", req.companyId)
    .eq("entity", "answer").eq("entity_key", key).order("changed_at", { ascending: false }).limit(50), "versions");
  res.json({ versions: rows });
}));

async function record(req, n, action, comment){
  const name = (req.member && req.member.display_name) || req.user.email;
  check(await req.db.from("cff_stage_approvals").insert({ company_id: req.companyId, stage: n, action, comment: comment || null, actor_id: req.user.id, actor_name: name }), "record review");
}
async function setStatus(req, n, status, comment){
  check(await req.db.from("cff_stage_status").upsert({ company_id: req.companyId, stage: n, status, comment: comment || null }, { onConflict: "company_id,stage" }), "stage status");
}

// POST /cff/stages/:n/submit { comment }
r.post("/stages/:n/submit", perm("cff.edit"), wrap(async (req, res) => {
  const n = stageNo(req.params.n);
  const comment = v.opt((req.body || {}).comment, "Comment", 2000);
  const st = await stageRow(req.db, req.companyId, n);
  if(st && st.status === "approved") throw new HttpError(409, "This stage is already approved.");
  if(st && st.status === "ready_for_review") throw new HttpError(409, "This stage is already waiting for review.");
  await setStatus(req, n, "ready_for_review", comment);
  await record(req, n, "submit", comment);
  const approvers = (await usersWithPerm(req.companyId, "cff.approve")).filter(u => u !== req.user.id);
  await notify(req.companyId, approvers, { kind: "approval", title: "Stage " + n + " is ready for review", body: comment || "Submitted by " + ((req.member && req.member.display_name) || req.user.email), link: "#/cff/" + n, dedupe: "submitted-" + n + "-" + Date.now() });
  res.json({ stage: await stageRow(req.db, req.companyId, n) });
}));

// POST /cff/stages/:n/approve { comment }
r.post("/stages/:n/approve", perm("cff.approve"), wrap(async (req, res) => {
  const n = stageNo(req.params.n);
  const comment = v.opt((req.body || {}).comment, "Comment", 2000);
  const st = await stageRow(req.db, req.companyId, n);
  if(st && st.status === "approved") throw new HttpError(409, "This stage is already approved.");
  // Hard rule from the framework: shareholding must total 100% before Stage 5 is approved.
  const s = await summary.build(admin, req.companyId);
  if(n === 5 && s.shares.count > 0 && Math.abs(s.shares.total - 100) > 0.001)
    throw new HttpError(409, "Shareholding adds up to " + (+s.shares.total.toFixed(3)) + "%. It must total exactly 100% before Stage 5 can be approved.");
  if(req.company.settings && req.company.settings.enforce_readiness){
    const blocking = READINESS.forStage(s.readiness, n);
    if(blocking.length) throw new HttpError(409, "Readiness rules are enforced for this company: " + blocking.map(b => b.text).join(" "), { code: "readiness" });
  }
  await setStatus(req, n, "approved", comment);
  await record(req, n, "approve", comment);
  if(st && st.submitted_by && st.submitted_by !== req.user.id)
    await notify(req.companyId, [st.submitted_by], { kind: "approval", title: "Stage " + n + " was approved", body: comment || "", link: "#/cff/" + n, dedupe: "approved-" + n + "-" + Date.now() });
  res.json({ stage: await stageRow(req.db, req.companyId, n) });
}));

// POST /cff/stages/:n/request-changes { comment }  (comment required)
r.post("/stages/:n/request-changes", perm("cff.approve"), wrap(async (req, res) => {
  const n = stageNo(req.params.n);
  const comment = v.str((req.body || {}).comment, "Comment", 2000);
  const st = await stageRow(req.db, req.companyId, n);
  if(!st || st.status !== "ready_for_review") throw new HttpError(409, "Changes can only be requested for a stage that is waiting for review.");
  await setStatus(req, n, "in_progress", comment);
  await record(req, n, "request_changes", comment);
  if(st.submitted_by && st.submitted_by !== req.user.id)
    await notify(req.companyId, [st.submitted_by], { kind: "approval", title: "Changes requested on Stage " + n, body: comment, link: "#/cff/" + n, dedupe: "changes-" + n + "-" + Date.now() });
  res.json({ stage: await stageRow(req.db, req.companyId, n) });
}));

// POST /cff/stages/:n/reopen { comment }
r.post("/stages/:n/reopen", perm("cff.approve"), wrap(async (req, res) => {
  const n = stageNo(req.params.n);
  const comment = v.opt((req.body || {}).comment, "Comment", 2000);
  const st = await stageRow(req.db, req.companyId, n);
  if(!st || st.status !== "approved") throw new HttpError(409, "Only an approved stage can be reopened.");
  await setStatus(req, n, "reopened", comment);
  await record(req, n, "reopen", comment);
  res.json({ stage: await stageRow(req.db, req.companyId, n) });
}));

module.exports = r;
