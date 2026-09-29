// Partners / founders (Stages 3 and 4): many partners per company, full profiles, archive and compare.
// Financial contribution is stored with the shareholding (Stage 5), so only people allowed to see
// financial information can see it.
const express = require("express");
const { HttpError, wrap, check, v } = require("../lib/http");
const { perm, can } = require("../lib/auth");
const CAT = require("../../public/js/content/catalogs");

const r = express.Router({ mergeParams: true });   // /api/c/:companyId/partners
const COLS = "id,user_id,full_name,designation,profile,status,created_at,updated_at";
const completeness = p => Math.round(CAT.PARTNER_KEYS.filter(k => ((p.profile || {})[k] || "").trim()).length / CAT.PARTNER_KEYS.length * 100);

r.get("/", perm("partners.view"), wrap(async (req, res) => {
  const [p, s, m] = await Promise.all([
    req.db.from("cff_partners").select(COLS).eq("company_id", req.companyId).order("created_at"),
    can(req, "partners.financial") ? req.db.from("cff_shareholding").select("partner_id,percent,financial_contribution,time_contribution").eq("company_id", req.companyId) : Promise.resolve({ data: [] }),
    req.db.from("cff_company_members").select("user_id,display_name").eq("company_id", req.companyId).eq("status", "active")
  ]);
  const shares = Object.fromEntries(check(s, "shares").map(x => [x.partner_id, x]));
  const partners = check(p, "partners").map(x => ({ ...x, completeness: completeness(x),
    financial: can(req, "partners.financial") ? (shares[x.id] || null) : undefined }));
  res.json({ partners, members: check(m, "members"), canEdit: can(req, "partners.edit"), canSeeFinancial: can(req, "partners.financial") });
}));

function readBody(b){
  const row = {};
  if(b.full_name !== undefined) row.full_name = v.str(b.full_name, "Full name", 120);
  if(b.designation !== undefined) row.designation = v.opt(b.designation, "Designation", 120);
  if(b.user_id !== undefined) row.user_id = v.uuid(b.user_id, "Linked member", { optional: true });
  if(b.profile !== undefined) row.profile = v.textMap(b.profile, CAT.PARTNER_KEYS, 5000);
  return row;
}

async function saveFinancial(req, partnerId, b){
  if(b.financial_contribution === undefined) return;
  if(!can(req, "partners.financial")) throw new HttpError(403, "You don't have permission to edit financial contributions.");
  check(await req.db.from("cff_shareholding").upsert({ company_id: req.companyId, partner_id: partnerId, financial_contribution: v.text(b.financial_contribution, "Financial contribution", 2000) },
    { onConflict: "company_id,partner_id" }), "financial contribution");
}

r.post("/", perm("partners.edit"), wrap(async (req, res) => {
  const b = req.body || {};
  const row = readBody(b);
  if(!row.full_name) throw new HttpError(400, "Full name is required.");
  row.company_id = req.companyId; row.created_by = req.user.id;
  const p = check(await req.db.from("cff_partners").insert(row).select(COLS).single(), "add partner");
  await saveFinancial(req, p.id, b);
  res.status(201).json({ partner: { ...p, completeness: completeness(p) } });
}));

r.patch("/:id", perm("partners.edit"), wrap(async (req, res) => {
  const id = v.uuid(req.params.id, "Partner");
  const b = req.body || {};
  const up = readBody(b);
  if(b.profile !== undefined){ // merge with the saved profile so partial saves don't wipe fields
    const cur = check(await req.db.from("cff_partners").select("profile").eq("id", id).eq("company_id", req.companyId).maybeSingle(), "partner");
    if(!cur) throw new HttpError(404, "Partner not found.");
    up.profile = { ...(cur.profile || {}), ...up.profile };
  }
  let p = null;
  if(Object.keys(up).length){
    p = check(await req.db.from("cff_partners").update(up).eq("id", id).eq("company_id", req.companyId).select(COLS).maybeSingle(), "edit partner");
    if(!p) throw new HttpError(404, "Partner not found, or Stage 4 is approved (reopen it to make changes).");
  }
  await saveFinancial(req, id, b);
  if(!p) p = check(await req.db.from("cff_partners").select(COLS).eq("id", id).maybeSingle(), "partner");
  res.json({ partner: { ...p, completeness: completeness(p) } });
}));

r.post("/:id/archive", perm("partners.edit"), wrap(async (req, res) => {
  const id = v.uuid(req.params.id, "Partner");
  const archive = (req.body || {}).restore ? "active" : "archived";
  const p = check(await req.db.from("cff_partners").update({ status: archive }).eq("id", id).eq("company_id", req.companyId).select(COLS).maybeSingle(), "archive partner");
  if(!p) throw new HttpError(404, "Partner not found, or Stage 4 is approved.");
  res.json({ partner: p });
}));

module.exports = r;
