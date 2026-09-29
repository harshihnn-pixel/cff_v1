// Stage 11 — Registration & Compliance Center (India, configurable), the compliance calendar,
// and private company documents with folders, access levels, versions and expiry dates.
(function(){
"use strict";
const CFF = window.CFF;
const { $, $$, esc, I, toast, notice, empty, pill, lblPill, formModal, confirmBox, opt, fmtDate, fmtDateTime, today, addDays, table, fileSize, modal, tabs, onTabs } = CFF.util;
const S = CFF.state;
const CAT = opt(CATALOGS.COMPLIANCE_CATEGORIES), APP = opt(CATALOGS.APPLICABILITY), DOCC = opt(CATALOGS.DOC_CATEGORIES), ACC = opt(CATALOGS.DOC_ACCESS);
const appTone = { required: "accent", not_required: "", pending_verification: "warn" };

async function members(){ if(!CFF.cache.members || CFF.cache.membersFor !== S.companyId){ const d = await CFF.api.c.get("/members").catch(() => ({ members: [] })); CFF.cache.members = d.members; CFF.cache.membersFor = S.companyId; } return CFF.cache.members; }

CFF.route("compliance/registration", { title: "Registration & compliance", perm: ["compliance.view"], async render(el){
  const [d, ms] = await Promise.all([CFF.api.c.get("/compliance"), members()]);
  const docs = S.can("documents.view") ? (await CFF.api.c.get("/documents").catch(() => ({ documents: [] }))).documents : [];
  const mName = Object.fromEntries(ms.map(m => [m.id, m.display_name]));
  const req = d.items.filter(x => x.applicability === "required"), done = req.filter(x => x.status === "approved").length;
  const pend = d.items.filter(x => x.applicability === "pending_verification").length;
  const t0 = today(), soon = addDays(t0, 30);
  const fields = [
    { k: "name", label: "Item", required: true, full: true }, { k: "category", label: "Category", type: "select", required: true, options: CATALOGS.COMPLIANCE_CATEGORIES, value: "other" },
    { k: "applicability", label: "Applies to us?", type: "select", required: true, options: CATALOGS.APPLICABILITY, value: "pending_verification" },
    { k: "status", label: "Status", type: "select", required: true, options: CATALOGS.COMPLIANCE_STATUSES, value: "not_started" },
    { k: "responsible_member_id", label: "Responsible person", type: "select", options: ms.map(m => [m.id, m.display_name]) }, { k: "responsible_name", label: "Or name (e.g. your CA)" },
    { k: "due_date", label: "Due date", type: "date" }, { k: "completion_date", label: "Completion date", type: "date" }, { k: "renewal_date", label: "Renewal date", type: "date" },
    { k: "registration_number", label: "Registration number" }, { k: "document_id", label: "Document", type: "select", options: docs.map(x => [x.id, x.name]) },
    { k: "notes", label: "Notes", type: "textarea", rows: 2 }];
  el.innerHTML = CFF.pageHead({ label: "Stage 11 · Company Registration & Compliance", title: "Registration & compliance", crumbs: S.can("cff.view") ? [["#/cff/11", "Stage 11"], [null, "Compliance"]] : null,
    lead: "A checklist for India. Mark each item Required, Not required or Pending verification for your business structure, state and industry.",
    actions: `<a class="btn secondary sm" href="#/compliance/calendar">${I.clock} Calendar</a>${d.canEdit ? `<button class="btn sm" id="addC">${I.plus} Add item</button>` : ""}` }) + `
    ${notice("General guidance only, not legal or tax advice. Confirm what applies to your company with a Chartered Accountant, Company Secretary or lawyer.")}
    <div class="kpis3 four card"><div><b class="num">${req.length}</b><span>required</span></div><div><b class="num">${done}</b><span>approved</span></div><div class="${pend ? "warn" : ""}"><b class="num">${pend}</b><span>to verify</span></div>
      <div class="${req.filter(x => x.status !== "approved" && x.due_date && x.due_date < t0).length ? "bad" : ""}"><b class="num">${req.filter(x => x.status !== "approved" && x.due_date && x.due_date < t0).length}</b><span>overdue</span></div></div>
    ${CATALOGS.COMPLIANCE_CATEGORIES.map(([ck, cl]) => { const list = d.items.filter(x => x.category === ck); if(!list.length) return "";
      return `<section class="card flush"><div class="card-head"><h2>${esc(cl)}</h2><span class="muted small">${list.length} items</span></div>${table(["Item", "Applies?", "Status", "Responsible", "Due / renewal", "Registration no.", ""], list.map(x => ({ attrs: `data-id="${esc(x.id)}"`, cells: [
        `<b>${esc(x.name)}</b>${x.hint ? `<span class="muted small block">${esc(x.hint)}</span>` : ""}`, pill(APP[x.applicability], appTone[x.applicability]), lblPill(CATALOGS.COMPLIANCE_STATUSES, x.status),
        esc(mName[x.responsible_member_id] || x.responsible_name || ""), [x.due_date && `<span class="${x.due_date < t0 && x.status !== "approved" ? "bad-t" : x.due_date <= soon ? "warn-t" : ""}">Due ${esc(fmtDate(x.due_date))}</span>`, x.renewal_date && `<span class="${x.renewal_date <= soon ? "warn-t" : ""}">Renew ${esc(fmtDate(x.renewal_date))}</span>`].filter(Boolean).join("<br>"),
        esc(x.registration_number || ""), `<div class="row nowrap">${x.document_id ? `<button class="icon-btn" data-doc aria-label="Open document">${I.file}</button>` : ""}${d.canEdit ? `<button class="icon-btn" data-edit aria-label="Edit">${I.edit}</button>` : ""}</div>`] })))}</section>`; }).join("")}`;
  const find = b => d.items.find(x => x.id === b.closest("[data-id]").dataset.id);
  $$("[data-edit]", el).forEach(b => b.addEventListener("click", () => { const it = find(b); formModal({ title: it.name, wide: true, fields, values: it, save: v => CFF.api.c.patch("/compliance/items/" + it.id, v),
    intro: it.hint ? `<p class="muted">${esc(it.hint)}</p>` : "",
    extraActions: [{ label: "Delete", kind: "danger", run: async () => { if(!await confirmBox("Delete this compliance item?", { ok: "Delete", danger: true })) return false; await CFF.api.c.del("/compliance/items/" + it.id); return "deleted"; } }] }).then(r => { if(r){ toast("Saved."); CFF.render(); } }); }));
  $$("[data-doc]", el).forEach(b => b.addEventListener("click", () => CFF.openDocument(find(b).document_id)));
  const ac = $("#addC"); if(ac) ac.addEventListener("click", () => formModal({ title: "Add compliance item", wide: true, fields, save: v => CFF.api.c.post("/compliance/items", v) }).then(r => { if(r){ toast("Added."); CFF.render(); } }));
  CFF.ai.page({ label: "Registration & compliance (Stage 11)", suggestions: ["Which registrations does a small private limited company usually need?", "Explain GST registration in simple words", "What should be on our compliance calendar?"],
    context: () => "CURRENT PAGE: Registration & compliance center (Stage 11, India).\n" + d.items.map(x => "- " + x.name + ": " + APP[x.applicability] + ", " + x.status.replace(/_/g, " ") + (x.due_date ? ", due " + x.due_date : "")).join("\n") + "\nAlways say that requirements must be confirmed with a CA/CS/lawyer." });
}});

CFF.route("compliance/calendar", { title: "Compliance calendar", perm: ["compliance.view"], async render(el){
  const [d, docs] = await Promise.all([CFF.api.c.get("/compliance"), S.can("documents.view") ? CFF.api.c.get("/documents").catch(() => ({ documents: [] })) : { documents: [] }]);
  const t0 = today();
  const ev = [];
  d.items.filter(x => x.applicability !== "not_required").forEach(x => {
    if(x.due_date && x.status !== "approved") ev.push({ date: x.due_date, title: x.name, kind: "Due", link: "compliance/registration" });
    if(x.renewal_date) ev.push({ date: x.renewal_date, title: x.name, kind: "Renewal", link: "compliance/registration" });
  });
  docs.documents.filter(x => x.expiry_date).forEach(x => ev.push({ date: x.expiry_date, title: x.name, kind: "Document expires", link: "compliance/documents" }));
  ev.sort((a, b) => a.date.localeCompare(b.date));
  const byMonth = {}; ev.forEach(e => { const k = e.date.slice(0, 7); (byMonth[k] = byMonth[k] || []).push(e); });
  el.innerHTML = CFF.pageHead({ label: "Compliance", title: "Compliance calendar", lead: "Every due date, renewal and document expiry in one place. Reminders appear in your notifications as dates approach." }) +
    (ev.length ? Object.entries(byMonth).map(([m, list]) => `<section class="card stack"><h2>${esc(new Date(m + "-01T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" }))}</h2>
      <div class="cal-list">${list.map(e => `<a class="cal-item ${e.date < t0 ? "past" : e.date <= addDays(t0, 30) ? "soon" : ""}" href="#/${e.link}"><span class="cal-date"><b>${new Date(e.date + "T00:00:00").getDate()}</b><small>${esc(new Date(e.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" }))}</small></span>
        <span class="stack" style="gap:2px;min-width:0"><b>${esc(e.title)}</b><span class="muted small">${esc(e.kind)}${e.date < t0 ? " · overdue" : ""}</span></span></a>`).join("")}</div></section>`).join("")
      : `<section class="card">${empty("Nothing scheduled", "Add due dates and renewal dates to compliance items, and expiry dates to documents.")}</section>`);
}});

/* ---------- documents ---------- */
CFF.openDocument = async (id, download, name) => {
  try{
    const b = await CFF.api.blob("/documents/" + id + "/file" + (download ? "" : "?inline=1"));
    if(download){ CFF.api.saveBlob(b, name || "document"); return; }
    const url = URL.createObjectURL(b); const w = window.open(url, "_blank");
    if(w) w.opener = null; else CFF.api.saveBlob(b, name || "document");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }catch(e){ toast(e.message, "bad"); }
};
CFF.route("compliance/documents", { title: "Documents", perm: ["documents.upload", "documents.manage", "compliance.view"], alt: "resources/documents", async render(el, p, q){
  const arch = q.archived === "1";
  const d = await CFF.api.c.get("/documents" + (arch ? "?archived=1" : ""));
  const list0 = arch ? d.documents.filter(x => x.archived_at) : d.documents;
  let folder = q.folder || "all";
  const t0 = today(), soon = addDays(t0, 30);
  const counts = {}; list0.forEach(x => { counts[x.category] = (counts[x.category] || 0) + 1; });
  el.innerHTML = CFF.pageHead({ label: "Compliance", title: "Documents", lead: "Private company files. Each document has an access level, and files are only served to people allowed to see them.",
    actions: d.canUpload && !arch ? `<button class="btn sm" id="upBtn">${I.upload} Upload</button>` : "" }) + `
    <div class="toolbar"><div class="chips" role="group" aria-label="Folders"><button class="chipf" data-f="all" aria-pressed="${folder === "all"}">All <span class="c">${list0.length}</span></button>${CATALOGS.DOC_CATEGORIES.filter(([k]) => counts[k]).map(([k, l]) => `<button class="chipf" data-f="${k}" aria-pressed="${folder === k}">${esc(l)} <span class="c">${counts[k]}</span></button>`).join("")}</div>
      <a class="link small" href="#/compliance/documents${arch ? "" : "?archived=1"}">${arch ? "Show current documents" : "Show archived and old versions"}</a></div>
    <div id="docBody"></div>`;
  const draw = () => {
    const list = list0.filter(x => folder === "all" || x.category === folder);
    $("#docBody").innerHTML = `<section class="card flush">${table(["Name", "Folder", "Access", "Version", "Expiry", "Uploaded", ""], list.map(x => ({ attrs: `data-id="${esc(x.id)}"`, cells: [
      `<b>${esc(x.name)}</b><span class="muted small block">${esc(x.description || "")}${x.size_bytes ? (x.description ? " · " : "") + fileSize(x.size_bytes) : ""}</span>`, esc(DOCC[x.category] || x.category), pill(ACC[x.access] ? ACC[x.access].split(",")[0].replace(" in the company", "") : x.access, x.access === "everyone" ? "" : "accent"),
      "v" + x.version, x.expiry_date ? `<span class="${x.expiry_date < t0 ? "bad-t" : x.expiry_date <= soon ? "warn-t" : ""}">${esc(fmtDate(x.expiry_date))}${x.expiry_date < t0 ? " · expired" : ""}</span>` : "", `${esc(fmtDate(x.uploaded_at))}<span class="muted small block">${esc(x.uploaded_by_name || "")}</span>`,
      `<div class="row nowrap">${/^(image\/(png|jpeg|webp|gif)|application\/pdf)$/.test(x.mime_type) ? `<button class="icon-btn" data-view aria-label="View">${I.eye}</button>` : ""}<button class="icon-btn" data-dl aria-label="Download">${I.download}</button>
        <button class="icon-btn" data-ver aria-label="Versions">${I.history}</button>${(d.canUpload || d.canManage) && !arch ? `<button class="icon-btn" data-newv aria-label="Upload new version">${I.upload}</button><button class="icon-btn" data-edit aria-label="Edit details">${I.edit}</button><button class="icon-btn" data-arch aria-label="Archive">${I.archive}</button>` : ""}
        ${arch && (d.canUpload || d.canManage) ? `<button class="btn quiet sm" data-restore>Restore</button>` : ""}</div>`] })),
      { empty: `<div class="pad">${empty("No documents here", d.canUpload ? "Upload incorporation papers, agreements, policies, SOPs and other company files." : "")}</div>` })}</section>`;
    const find = b => list.find(x => x.id === b.closest("[data-id]").dataset.id);
    $$("[data-view]").forEach(b => b.addEventListener("click", () => CFF.openDocument(find(b).id)));
    $$("[data-dl]").forEach(b => b.addEventListener("click", () => { const x = find(b); CFF.openDocument(x.id, true, x.name); }));
    $$("[data-ver]").forEach(b => b.addEventListener("click", async () => { const x = find(b); const v = await CFF.api.c.get("/documents/" + x.id + "/versions");
      modal({ title: "Versions · " + x.name, wide: true, body: table(["Version", "Name", "Uploaded", "By", ""], v.versions.map(y => [`v${y.version}`, esc(y.name), esc(fmtDateTime(y.uploaded_at)), esc(y.uploaded_by_name || ""), `<button class="btn quiet sm" data-dlv="${esc(y.id)}" data-n="${esc(y.name)}">${I.download} Download</button>`])),
        onOpen: dlg => $$("[data-dlv]", dlg).forEach(z => z.addEventListener("click", () => CFF.openDocument(z.dataset.dlv, true, z.dataset.n))) }); }));
    $$("[data-newv]").forEach(b => b.addEventListener("click", () => uploadDialog(d, find(b))));
    $$("[data-edit]").forEach(b => b.addEventListener("click", () => { const x = find(b); formModal({ title: "Edit details", values: x, fields: [
      { k: "name", label: "Name", required: true }, { k: "category", label: "Folder", type: "select", required: true, options: CATALOGS.DOC_CATEGORIES },
      { k: "access", label: "Who can see it", type: "select", required: true, options: CATALOGS.DOC_ACCESS.filter(([k]) => d.accessChoices.includes(k)) },
      { k: "expiry_date", label: "Expiry date", type: "date" }, { k: "description", label: "Description", maxlength: 1000 }], save: v => CFF.api.c.patch("/documents/" + x.id, v) }).then(r => { if(r){ toast("Saved."); CFF.render(); } }); }));
    $$("[data-arch]").forEach(b => b.addEventListener("click", async () => { const x = find(b); if(!await confirmBox("Archive “" + x.name + "”? It can be restored from the archive.", { ok: "Archive" })) return; await CFF.api.c.post("/documents/" + x.id + "/archive", {}).catch(e => toast(e.message, "bad")); CFF.render(); }));
    $$("[data-restore]").forEach(b => b.addEventListener("click", async () => { await CFF.api.c.post("/documents/" + find(b).id + "/archive", { restore: true }).catch(e => toast(e.message, "bad")); CFF.render(); }));
  };
  $$("[data-f]", el).forEach(b => b.addEventListener("click", () => { folder = b.dataset.f; $$("[data-f]", el).forEach(x => x.setAttribute("aria-pressed", x === b)); draw(); }));
  const ub = $("#upBtn"); if(ub) ub.addEventListener("click", () => uploadDialog(d, null, folder !== "all" ? folder : null));
  draw();
}});

function uploadDialog(d, prev, folder){
  return modal({ title: prev ? "New version of " + prev.name : "Upload a document", body: `<div class="form-grid">
      <div class="field full"><label for="upFile">File</label><input class="input" id="upFile" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.svg,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx" required><span class="hint">PDF, image, Word, Excel, PowerPoint, text or CSV · up to ${d.maxMb} MB</span></div>
      ${prev ? "" : `<div class="field"><label for="upCat">Folder</label><select class="input" id="upCat">${CATALOGS.DOC_CATEGORIES.map(([k, l]) => `<option value="${k}" ${k === (folder || "other") ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
      <div class="field"><label for="upAcc">Who can see it</label><select class="input" id="upAcc">${CATALOGS.DOC_ACCESS.filter(([k]) => d.accessChoices.includes(k)).map(([k, l]) => `<option value="${k}" ${k === "managers" ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>`}
      <div class="field"><label for="upExp">Expiry date (optional)</label><input class="input" id="upExp" type="date" value="${esc(prev && prev.expiry_date || "")}"></div>
      <div class="field"><label for="upDesc">Description (optional)</label><input class="input" id="upDesc" maxlength="1000" value="${esc(prev && prev.description || "")}"></div></div>`,
    actions: [{ label: "Cancel", value: null, kind: "secondary" }, { label: "Upload", submit: true, run: async dlg => {
      const f = $("#upFile", dlg).files[0]; if(!f) throw new Error("Choose a file to upload.");
      if(f.size > d.maxMb * 1048576) throw new Error("That file is " + fileSize(f.size) + ". The limit is " + d.maxMb + " MB.");
      if(!f.type) throw new Error("This file type isn't recognised. Upload a PDF, image, Word, Excel, PowerPoint, text or CSV file.");
      const params = { name: f.name, expiry_date: $("#upExp", dlg).value, description: $("#upDesc", dlg).value.trim() };
      if(!prev){ params.category = $("#upCat", dlg).value; params.access = $("#upAcc", dlg).value; }
      return CFF.api.upload(prev ? "/documents/" + prev.id + "/version" : "/documents", f, params);
    } }] }).then(r => { if(r){ toast("Uploaded."); CFF.render(); } });
}
})();
