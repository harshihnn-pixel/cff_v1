// Stage 7 — Master Company Profile: Generate → Review → Edit → Save draft → Approve → Final version.
// Every draft is a new version; approving one supersedes the previous final version. Approved versions can't be edited.
const express = require("express");
const { HttpError, wrap, check, v } = require("../lib/http");
const { perm, can } = require("../lib/auth");
const CAT = require("../../public/js/content/catalogs");

const r = express.Router({ mergeParams: true });   // /api/c/:companyId/profile
const KEYS = CAT.PROFILE_SECTIONS.map(s => s[0]);
const COLS = "id,version,status,source,content,note,created_by,created_at,updated_at,approved_by,approved_at";

// Where each section comes from in the earlier stages (point ids of the original CFF).
const SOURCES = {
  vision: ["s7-1-0","s1-0-1"], mission: ["s7-1-1","s1-0-2"], story: ["s7-1-2"], purpose: ["s7-1-3","s1-0-4"], problem: ["s1-0-5"],
  customer_need: ["s1-0-6"], services: ["s7-1-4","s1-0-0"], target_audience: ["s7-1-6"], positioning: ["s7-1-7"],
  customer_promise: ["s7-1-8","s6-0-2"], competitive_advantage: ["s7-1-9"], brand_personality: ["s7-1-10"],
  business_process: ["s7-1-11","s2-0-4","s2-0-0"], long_term_vision: ["s1-0-8","s1-0-7","s1-0-3"], social_contribution: ["s4-6-0","s4-6-1","s1-0-7"]
};

async function compile(req){
  const [ans, vals, names, brand] = await Promise.all([
    can(req, "cff.view") ? req.db.from("cff_answers").select("point_id,answer").eq("company_id", req.companyId) : { data: [] },
    req.db.from("cff_company_values").select("name,meaning,status").eq("company_id", req.companyId).order("sort"),
    can(req, "cff.view") ? req.db.from("cff_company_names").select("name,status").eq("company_id", req.companyId).eq("status", "selected") : { data: [] },
    req.db.from("cff_brand").select("fields").eq("company_id", req.companyId).maybeSingle()
  ]);
  const a = Object.fromEntries(check(ans, "answers").map(x => [x.point_id, (x.answer || "").trim()]));
  const out = {}, from = {};
  Object.entries(SOURCES).forEach(([k, ids]) => { const id = ids.find(i => a[i]); out[k] = id ? a[id] : ""; from[k] = id || null; });
  const values = check(vals, "values");
  const approvedVals = values.filter(x => x.status === "approved");
  out.values = (approvedVals.length ? approvedVals : values).map(x => "- " + x.name + (x.meaning ? ": " + x.meaning : "")).join("\n");
  from.values = values.length ? (approvedVals.length ? "approved company values" : "draft company values") : null;
  const sel = check(names, "names")[0];
  out.company_name = sel ? sel.name : req.company.name; from.company_name = sel ? "selected name (Stage 8)" : "company settings";
  const bf = (check(brand, "brand") || {}).fields || {};
  if(!out.brand_personality && bf.brand_personality){ out.brand_personality = bf.brand_personality; from.brand_personality = "brand identity (Stage 9)"; }
  return { content: out, sources: from };
}

r.get("/", perm("profile.view"), wrap(async (req, res) => {
  const rows = check(await req.db.from("cff_company_profiles").select(COLS).eq("company_id", req.companyId).order("version", { ascending: false }), "profiles");
  res.json({ versions: rows, approved: rows.find(x => x.status === "approved") || null, sections: CAT.PROFILE_SECTIONS,
             canEdit: can(req, "profile.edit"), canApprove: can(req, "cff.approve") });
}));

// GET /profile/compile — a draft built automatically from the earlier stages (no AI).
r.get("/compile", perm("profile.edit"), wrap(async (req, res) => res.json(await compile(req))));

async function nextVersion(req){
  const last = check(await req.db.from("cff_company_profiles").select("version").eq("company_id", req.companyId).order("version", { ascending: false }).limit(1), "versions");
  return (last[0] ? last[0].version : 0) + 1;
}

// POST /profile { content, source, note } — saves a new draft version (never touches the approved one).
r.post("/", perm("profile.edit"), wrap(async (req, res) => {
  const b = req.body || {};
  const content = v.textMap(b.content, KEYS, 8000);
  const row = { company_id: req.companyId, version: await nextVersion(req), status: "draft", content,
    source: v.oneOf(b.source, "Source", ["manual","ai","mixed"], { optional: true, default: "manual" }), note: v.opt(b.note, "Note", 500), created_by: req.user.id };
  const x = check(await req.db.from("cff_company_profiles").insert(row).select(COLS).single(), "save draft");
  res.status(201).json({ version: x });
}));

// PATCH /profile/:id { content, note } — edit a draft
r.patch("/:id", perm("profile.edit"), wrap(async (req, res) => {
  const id = v.uuid(req.params.id, "Version");
  const cur = check(await req.db.from("cff_company_profiles").select("status,content,source").eq("id", id).eq("company_id", req.companyId).maybeSingle(), "version");
  if(!cur) throw new HttpError(404, "Version not found.");
  if(cur.status !== "draft") throw new HttpError(409, "Only drafts can be edited. Create a new draft to change the approved profile.");
  const b = req.body || {};
  const up = {};
  if(b.content !== undefined){ up.content = { ...cur.content, ...v.textMap(b.content, KEYS, 8000) }; if(cur.source === "ai") up.source = "mixed"; }
  if(b.note !== undefined) up.note = v.opt(b.note, "Note", 500);
  const x = check(await req.db.from("cff_company_profiles").update(up).eq("id", id).select(COLS).single(), "edit draft");
  res.json({ version: x });
}));

r.post("/:id/approve", perm("cff.approve"), wrap(async (req, res) => {
  const id = v.uuid(req.params.id, "Version");
  const cur = check(await req.db.from("cff_company_profiles").select("status").eq("id", id).eq("company_id", req.companyId).maybeSingle(), "version");
  if(!cur) throw new HttpError(404, "Version not found.");
  if(cur.status !== "draft") throw new HttpError(409, "Only a draft can be approved.");
  const x = check(await req.db.from("cff_company_profiles").update({ status: "approved" }).eq("id", id).select(COLS).single(), "approve profile");
  res.json({ version: x });
}));

// POST /profile/:id/discard — set a draft aside (it stays in the history).
r.post("/:id/discard", perm("profile.edit"), wrap(async (req, res) => {
  const id = v.uuid(req.params.id, "Version");
  const x = check(await req.db.from("cff_company_profiles").update({ status: "superseded" }).eq("id", id).eq("company_id", req.companyId).eq("status", "draft").select("id"), "discard");
  if(!x.length) throw new HttpError(404, "Draft not found.");
  res.json({ ok: true });
}));

module.exports = r;
module.exports.compile = compile;
