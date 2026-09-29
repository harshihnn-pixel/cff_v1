// Stage 8 — candidate company names, and Stage 9 — Brand Identity Center (fields and logo files).
const express = require("express");
const config = require("../lib/config");
const { HttpError, wrap, check, v } = require("../lib/http");
const { perm, can } = require("../lib/auth");
const { crud } = require("../lib/crud");
const { storeFile } = require("./documents");
const CAT = require("../../public/js/content/catalogs");

const names = express.Router({ mergeParams: true });   // /api/c/:companyId/names
const brand = express.Router({ mergeParams: true });   // /api/c/:companyId/brand
const CHECK = CAT.CHECK_STATUSES.map(c => c[0]);
const LIST = CAT.NAME_CHECKLIST.map(c => c[0]);

crud(names, { path: "/", table: "cff_company_names", cols: "*", view: "cff.view", edit: "names.edit", locked: "Stage 8 is approved (reopen it to make changes).",
  required: ["name"], labels: { name: "Name" }, order: [["created_at"]],
  fields: {
    name: x => v.str(x, "Name", 120), meaning: x => v.text(x, "Meaning", 2000), purpose_link: x => v.text(x, "Connection with purpose", 2000),
    values_link: x => v.text(x, "Connection with values", 2000), memorability: x => v.int(x, "Memorability", 1, 5, { optional: true }),
    domain_status: x => v.oneOf(x, "Domain status", CHECK), social_status: x => v.oneOf(x, "Social username status", CHECK),
    trademark_status: x => v.oneOf(x, "Trademark status", CHECK), legal_status: x => v.oneOf(x, "Legal / registration status", CHECK),
    checklist: x => { const o = {}; LIST.forEach(k => { if(x && x[k] !== undefined) o[k] = v.bool(x[k]); }); return o; },
    notes: x => v.text(x, "Notes", 3000), status: x => v.oneOf(x, "Status", CAT.NAME_STATUSES.map(s => s[0]))
  },
  // Only one name can be "Selected".
  afterSave: async (req, row) => {
    if(row.status === "selected") check(await req.db.from("cff_company_names").update({ status: "shortlisted" }).eq("company_id", req.companyId).eq("status", "selected").neq("id", row.id), "one selected name");
  } });

brand.get("/", perm("brand.view"), wrap(async (req, res) => {
  const [b, a] = await Promise.all([
    req.db.from("cff_brand").select("fields,updated_at").eq("company_id", req.companyId).maybeSingle(),
    req.db.from("cff_brand_assets").select("kind,document_id,updated_at").eq("company_id", req.companyId)
  ]);
  res.json({ fields: (check(b, "brand") || {}).fields || {}, assets: check(a, "assets"), canEdit: can(req, "brand.edit"), maxMb: config.maxUploadMb });
}));

brand.put("/", perm("brand.edit"), wrap(async (req, res) => {
  const fields = v.textMap((req.body || {}).fields, CAT.BRAND_FIELDS.map(f => f[0]), 4000);
  const cur = check(await req.db.from("cff_brand").select("fields").eq("company_id", req.companyId).maybeSingle(), "brand");
  const merged = { ...((cur || {}).fields || {}), ...fields };
  const x = check(await req.db.from("cff_brand").upsert({ company_id: req.companyId, fields: merged }, { onConflict: "company_id" }).select("fields,updated_at").maybeSingle(), "save brand");
  if(!x) throw new HttpError(409, "Stage 9 is approved. Reopen it to make changes.");
  res.json({ fields: x.fields });
}));

// POST /brand/assets/:kind   body = image file (application/octet-stream), header X-File-Type
brand.post("/assets/:kind", perm("brand.edit"), express.raw({ type: "application/octet-stream", limit: config.maxUploadMb * 1024 * 1024 + 1024 }), wrap(async (req, res) => {
  const kind = v.oneOf(req.params.kind, "Logo type", CAT.BRAND_ASSETS.map(a => a[0]));
  const mime = String(req.get("x-file-type") || "");
  if(!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(mime)) throw new HttpError(400, "Upload the logo as PNG, JPG, WEBP, GIF or SVG.");
  const label = CAT.opt(CAT.BRAND_ASSETS)[kind];
  const doc = await storeFile(req, { name: v.str(req.query.name || label, "File name", 200), category: "brand", description: label, access: "everyone", expiry_date: null });
  const x = check(await req.db.from("cff_brand_assets").upsert({ company_id: req.companyId, kind, document_id: doc.id }, { onConflict: "company_id,kind" }).select("kind,document_id,updated_at").maybeSingle(), "save logo");
  if(!x) throw new HttpError(409, "Stage 9 is approved. Reopen it to make changes.");
  res.status(201).json({ asset: x });
}));

brand.delete("/assets/:kind", perm("brand.edit"), wrap(async (req, res) => {
  const kind = v.oneOf(req.params.kind, "Logo type", CAT.BRAND_ASSETS.map(a => a[0]));
  check(await req.db.from("cff_brand_assets").delete().eq("company_id", req.companyId).eq("kind", kind), "remove logo");
  res.json({ ok: true });
}));

module.exports = { names, brand };
