// Company documents: private file storage with categories, access levels, versions and expiry dates.
// Files live in a private Supabase Storage bucket. They are only served through this server, after the
// database (Row Level Security) confirms the person may see that document.
const express = require("express");
const crypto = require("crypto");
const config = require("../lib/config");
const { admin } = require("../lib/supabase");
const { HttpError, wrap, check, v, patch } = require("../lib/http");
const { perm, can } = require("../lib/auth");
const CAT = require("../../public/js/content/catalogs");
const { checkFile } = require("../lib/filecheck");
const { securityLog } = require("../lib/log");

const r = express.Router({ mergeParams: true });   // /api/c/:companyId/documents
const COLS = "id,name,category,description,mime_type,size_bytes,version,previous_id,expiry_date,access,uploaded_by,uploaded_at,archived_at";
const CATS = CAT.DOC_CATEGORIES.map(c => c[0]);
const ALLOWED = {
  "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg",
  "text/plain": "txt", "text/csv": "csv", "application/msword": "doc", "application/vnd.ms-excel": "xls", "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx"
};
// People can only give a document an access level they can see themselves.
const ACCESS_FOR = { owner: ["everyone","managers","founders","owner"], super_admin: ["everyone","managers","founders","owner"],
  founder: ["everyone","managers","founders"], manager: ["everyone","managers"], hr: ["everyone","managers"], employee: ["everyone"], viewer: ["everyone"] };

const safeName = n => String(n || "file").normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-").slice(0, 120) || "file";

async function withNames(req, rows){
  const ids = [...new Set(rows.map(x => x.uploaded_by).filter(Boolean))];
  if(!ids.length) return rows;
  const m = check(await req.db.from("cff_company_members").select("user_id,display_name").eq("company_id", req.companyId).in("user_id", ids), "names");
  const names = Object.fromEntries(m.map(x => [x.user_id, x.display_name]));
  return rows.map(x => ({ ...x, uploaded_by_name: names[x.uploaded_by] || "A member" }));
}

r.get("/", perm("documents.view", "brand.view"), wrap(async (req, res) => {
  let q = req.db.from("cff_documents").select(COLS).eq("company_id", req.companyId);
  if(req.query.category && CATS.includes(req.query.category)) q = q.eq("category", req.query.category);
  if(req.query.archived !== "1") q = q.is("archived_at", null);
  const rows = check(await q.order("uploaded_at", { ascending: false }).limit(1000), "documents");
  res.json({ documents: await withNames(req, rows), canUpload: can(req, "documents.upload"), canManage: can(req, "documents.manage"),
             accessChoices: ACCESS_FOR[req.role] || ["everyone"], maxMb: config.maxUploadMb });
}));

// Stores one file and its record. Used by uploads here and by brand logos.
async function storeFile(req, meta){
  const body = req.body;
  if(!Buffer.isBuffer(body) || !body.length) throw new HttpError(400, "Choose a file to upload.");
  if(body.length > config.maxUploadMb * 1024 * 1024) throw new HttpError(413, "The file is larger than " + config.maxUploadMb + " MB.");
  const mime = String(req.get("x-file-type") || "").toLowerCase().split(";")[0].trim();
  if(!ALLOWED[mime]) throw new HttpError(400, "This file type isn't allowed. Upload a PDF, image, Word, Excel, PowerPoint, text or CSV file.");
  const bad = checkFile(body, mime, meta.name);
  if(bad){ securityLog("upload_rejected", req, { mime, name: String(meta.name).slice(0, 80) }); throw new HttpError(400, bad); }
  const access = meta.access;
  if(!(ACCESS_FOR[req.role] || []).includes(access)) throw new HttpError(400, "You can't give a document that access level.");
  const path = req.companyId + "/" + crypto.randomUUID() + "/" + safeName(meta.name);
  const up = await admin.storage.from(config.bucket).upload(path, body, { contentType: mime, upsert: false });
  if(up.error){ console.error("[CFF] upload:", up.error.message); throw new HttpError(500, "The file could not be stored. Please try again."); }
  const row = { company_id: req.companyId, name: meta.name, category: meta.category, description: meta.description, storage_path: path, mime_type: mime,
    size_bytes: body.length, version: meta.version || 1, previous_id: meta.previous_id || null, expiry_date: meta.expiry_date, access, uploaded_by: req.user.id };
  const ins = await req.db.from("cff_documents").insert(row).select(COLS).single();
  if(ins.error){ await admin.storage.from(config.bucket).remove([path]); check(ins, "save document"); }
  return ins.data;
}

function readMeta(q){
  return {
    name: v.str(q.name, "File name", 200), category: v.oneOf(q.category, "Folder", CATS, { optional: true, default: "other" }),
    description: v.opt(q.description, "Description", 1000), access: v.oneOf(q.access, "Access", CAT.DOC_ACCESS.map(a => a[0]), { optional: true, default: "managers" }),
    expiry_date: v.date(q.expiry_date, "Expiry date")
  };
}

// POST /documents?name=&category=&access=&description=&expiry_date=   body = the file (application/octet-stream), header X-File-Type = its type
r.post("/", perm("documents.upload"), express.raw({ type: "application/octet-stream", limit: config.maxUploadMb * 1024 * 1024 + 1024 }), wrap(async (req, res) => {
  const doc = await storeFile(req, readMeta(req.query));
  res.status(201).json({ document: (await withNames(req, [doc]))[0] });
}));

// POST /documents/:id/version — upload a new version; the previous one is archived but kept.
r.post("/:id/version", perm("documents.upload"), express.raw({ type: "application/octet-stream", limit: config.maxUploadMb * 1024 * 1024 + 1024 }), wrap(async (req, res) => {
  const id = v.uuid(req.params.id, "Document");
  const prev = check(await req.db.from("cff_documents").select(COLS).eq("id", id).eq("company_id", req.companyId).maybeSingle(), "document");
  if(!prev) throw new HttpError(404, "Document not found.");
  const meta = { name: v.str(req.query.name || prev.name, "File name", 200), category: prev.category, description: v.opt(req.query.description || prev.description, "Description", 1000),
    access: prev.access, expiry_date: v.date(req.query.expiry_date || prev.expiry_date, "Expiry date"), version: prev.version + 1, previous_id: prev.id };
  const doc = await storeFile(req, meta);
  const arch = await req.db.from("cff_documents").update({ archived_at: new Date().toISOString() }).eq("id", prev.id).select("id");
  if(arch.error) console.error("[CFF] archive previous version:", arch.error.message);
  res.status(201).json({ document: (await withNames(req, [doc]))[0] });
}));

// GET /documents/:id/file — download (or ?inline=1 to show images and PDFs)
r.get("/:id/file", wrap(async (req, res) => {
  const id = v.uuid(req.params.id, "Document");
  const d = check(await req.db.from("cff_documents").select("id,name,mime_type,storage_path").eq("id", id).eq("company_id", req.companyId).maybeSingle(), "document");
  if(!d) throw new HttpError(404, "Document not found, or you don't have access to it.");
  const dl = await admin.storage.from(config.bucket).download(d.storage_path);
  if(dl.error || !dl.data){ console.error("[CFF] download:", dl.error && dl.error.message); throw new HttpError(404, "The file could not be found in storage."); }
  const buf = Buffer.from(await dl.data.arrayBuffer());
  const inline = req.query.inline === "1" && /^(image\/(png|jpeg|webp|gif)|application\/pdf)$/.test(d.mime_type || "");
  const ext = ALLOWED[d.mime_type] || "bin";
  const file = safeName(d.name).replace(/\.[a-z0-9]{2,5}$/i, "") + "." + ext;
  res.set({ "Content-Type": d.mime_type || "application/octet-stream", "Content-Length": buf.length, "Cache-Control": "private, no-store",
    "Content-Disposition": (inline ? "inline" : "attachment") + '; filename="' + file + '"', "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'" });
  res.end(buf);
}));

r.get("/:id/versions", perm("documents.view"), wrap(async (req, res) => {
  const id = v.uuid(req.params.id, "Document");
  const chain = []; let cur = id;
  for(let i = 0; i < 50 && cur; i++){
    const d = check(await req.db.from("cff_documents").select(COLS).eq("id", cur).eq("company_id", req.companyId).maybeSingle(), "version");
    if(!d) break; chain.push(d); cur = d.previous_id;
  }
  res.json({ versions: await withNames(req, chain) });
}));

r.patch("/:id", perm("documents.upload", "documents.manage"), wrap(async (req, res) => {
  const id = v.uuid(req.params.id, "Document");
  const up = patch(req.body || {}, {
    name: x => v.str(x, "File name", 200), category: x => v.oneOf(x, "Folder", CATS), description: x => v.opt(x, "Description", 1000),
    expiry_date: x => v.date(x, "Expiry date"), access: x => { const a = v.oneOf(x, "Access", CAT.DOC_ACCESS.map(a => a[0])); if(!(ACCESS_FOR[req.role] || []).includes(a)) throw new HttpError(400, "You can't give a document that access level."); return a; }
  });
  const d = check(await req.db.from("cff_documents").update(up).eq("id", id).eq("company_id", req.companyId).select(COLS).maybeSingle(), "edit document");
  if(!d) throw new HttpError(404, "Document not found, or you can't edit it.");
  res.json({ document: (await withNames(req, [d]))[0] });
}));

r.post("/:id/archive", perm("documents.upload", "documents.manage"), wrap(async (req, res) => {
  const id = v.uuid(req.params.id, "Document");
  const restore = !!(req.body || {}).restore;
  const d = check(await req.db.from("cff_documents").update({ archived_at: restore ? null : new Date().toISOString() }).eq("id", id).eq("company_id", req.companyId).select("id"), "archive document");
  if(!d.length) throw new HttpError(404, "Document not found, or you can't change it.");
  res.json({ ok: true });
}));

module.exports = r;
module.exports.storeFile = storeFile;
module.exports.readMeta = readMeta;
