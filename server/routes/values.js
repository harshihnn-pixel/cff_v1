// Values: each member's CFF Values Discovery Assessment, the team view (shared / different values)
// and the Final Company Values (Stage 6).
const express = require("express");
const { HttpError, wrap, check, v, patch } = require("../lib/http");
const { perm, can } = require("../lib/auth");

const r = express.Router({ mergeParams: true });   // /api/c/:companyId/values
const DOMAINS = ["Business","Intellectual","Relational","Financial","Physical","Spiritual","Creative","Environmental"];
const SLUG = /^[a-z_]{0,60}$/;

function shape(rows){
  const out = {};
  rows.forEach(x => { const q = x.question_no - 1; out[q] = out[q] || [{t:"",s:""},{t:"",s:""},{t:"",s:""}]; out[q][x.slot - 1] = { t: x.answer_text || "", s: x.value_slug || "" }; });
  return out;
}

// GET /values/me
r.get("/me", wrap(async (req, res) => {
  const [a, t, ai] = await Promise.all([
    req.db.from("cff_values_answers").select("question_no,slot,answer_text,value_slug").eq("company_id", req.companyId).eq("user_id", req.user.id),
    req.db.from("cff_values_top").select("top_values").eq("company_id", req.companyId).eq("user_id", req.user.id).maybeSingle(),
    req.db.from("cff_ai_outputs").select("content,input_hash,updated_at").eq("company_id", req.companyId).eq("user_id", req.user.id).eq("kind", "values_analysis").eq("subject", "").maybeSingle()
  ]);
  const an = check(ai, "analysis");
  res.json({ answers: shape(check(a, "values")), top: (check(t, "top") || {}).top_values || "",
             analysis: an ? { content: an.content, hash: an.input_hash || "", updated: Date.parse(an.updated_at) } : null });
}));

// PUT /values/me/:q { answers: [{t, s, d}] x3 }   q = 1..13
r.put("/me/:q", wrap(async (req, res) => {
  const q = v.int(req.params.q, "Question", 1, 13);
  const answers = Array.isArray((req.body || {}).answers) ? req.body.answers : null;
  if(!answers || answers.length !== 3) throw new HttpError(400, "Send exactly 3 answers.");
  const rows = answers.map((a, i) => {
    const slug = a && typeof a.s === "string" && SLUG.test(a.s) ? a.s : "";
    return { company_id: req.companyId, user_id: req.user.id, question_no: q, slot: i + 1, answer_text: v.text(a && a.t, "Answer", 300),
             value_slug: slug || null, domain: slug && DOMAINS.includes(a.d) ? a.d : null };
  });
  check(await req.db.from("cff_values_answers").upsert(rows, { onConflict: "company_id,user_id,question_no,slot" }), "save values");
  res.json({ ok: true });
}));

r.put("/me/top", wrap(async (req, res) => {
  const text = v.text((req.body || {}).text, "My highest values", 5000);
  check(await req.db.from("cff_values_top").upsert({ company_id: req.companyId, user_id: req.user.id, top_values: text }, { onConflict: "company_id,user_id" }), "save top values");
  res.json({ ok: true });
}));

// GET /values/team — every member's assessment, to find shared and different values (Stage 6)
r.get("/team", perm("partners.view"), wrap(async (req, res) => {
  const [a, t, m] = await Promise.all([
    req.db.from("cff_values_answers").select("user_id,question_no,slot,answer_text,value_slug").eq("company_id", req.companyId),
    req.db.from("cff_values_top").select("user_id,top_values").eq("company_id", req.companyId),
    req.db.from("cff_company_members").select("user_id,display_name,role_key").eq("company_id", req.companyId).eq("status", "active")
  ]);
  const byUser = {};
  check(a, "team values").forEach(x => { (byUser[x.user_id] = byUser[x.user_id] || []).push(x); });
  const tops = Object.fromEntries(check(t, "team top").map(x => [x.user_id, x.top_values]));
  const people = check(m, "members").filter(x => byUser[x.user_id] || tops[x.user_id])
    .map(x => ({ user_id: x.user_id, name: x.display_name, role: x.role_key, answers: shape(byUser[x.user_id] || []), top: tops[x.user_id] || "" }));
  res.json({ people });
}));

// ---------- Final company values ----------
const valueFields = {
  name: x => v.str(x, "Value name", 80), meaning: x => v.text(x, "Meaning", 2000), why_it_matters: x => v.text(x, "Why it matters", 2000),
  expected_behavior: x => v.text(x, "Expected behaviour", 3000), unacceptable_behavior: x => v.text(x, "Unacceptable behaviour", 3000),
  customer_promise: x => v.text(x, "Customer promise connection", 2000), sort: x => v.int(x, "Order", 0, 1000)
};
const COLS = "id,name,meaning,why_it_matters,expected_behavior,unacceptable_behavior,customer_promise,status,approved_by,approved_at,sort,updated_at";

r.get("/company", perm("values.view"), wrap(async (req, res) => {
  const rows = check(await req.db.from("cff_company_values").select(COLS).eq("company_id", req.companyId).order("sort").order("name"), "company values");
  res.json({ values: rows, canEdit: can(req, "values.edit") });
}));

r.post("/company", perm("values.edit"), wrap(async (req, res) => {
  const b = req.body || {};
  const row = { company_id: req.companyId, name: valueFields.name(b.name) };
  ["meaning","why_it_matters","expected_behavior","unacceptable_behavior","customer_promise"].forEach(k => { if(b[k] !== undefined) row[k] = valueFields[k](b[k]); });
  row.sort = b.sort !== undefined ? valueFields.sort(b.sort) : 100;
  const x = check(await req.db.from("cff_company_values").insert(row).select(COLS).single(), "add value");
  res.status(201).json({ value: x });
}));

// Editing an approved value puts it back to draft, so it has to be approved again.
r.patch("/company/:id", perm("values.edit"), wrap(async (req, res) => {
  const id = v.uuid(req.params.id, "Value");
  const up = patch(req.body || {}, valueFields);
  if(Object.keys(up).some(k => k !== "sort")) Object.assign(up, { status: "draft", approved_by: null, approved_at: null });
  const x = check(await req.db.from("cff_company_values").update(up).eq("id", id).eq("company_id", req.companyId).select(COLS).maybeSingle(), "edit value");
  if(!x) throw new HttpError(404, "Value not found, or Stage 6 is approved (reopen it to make changes).");
  res.json({ value: x });
}));

r.post("/company/:id/approve", perm("values.edit"), wrap(async (req, res) => {
  const id = v.uuid(req.params.id, "Value");
  const x = check(await req.db.from("cff_company_values").update({ status: "approved", approved_by: req.user.id, approved_at: new Date().toISOString() })
    .eq("id", id).eq("company_id", req.companyId).select(COLS).maybeSingle(), "approve value");
  if(!x) throw new HttpError(404, "Value not found, or Stage 6 is approved (reopen it to make changes).");
  res.json({ value: x });
}));

r.delete("/company/:id", perm("values.edit"), wrap(async (req, res) => {
  const id = v.uuid(req.params.id, "Value");
  const x = check(await req.db.from("cff_company_values").delete().eq("id", id).eq("company_id", req.companyId).select("id"), "delete value");
  if(!x.length) throw new HttpError(404, "Value not found, or Stage 6 is approved.");
  res.json({ ok: true });
}));

module.exports = r;
