// Stage 8 — Company Name Selection and Stage 9 — Brand Identity Center.
// CFF never claims a name is available: every check is done by the founders and marked here.
(function(){
"use strict";
const CFF = window.CFF;
const { $, $$, esc, I, toast, notice, empty, pill, formModal, confirmBox, opt, nl, fileSize } = CFF.util;
const S = CFF.state;
const CHECK = opt(CATALOGS.CHECK_STATUSES), NST = opt(CATALOGS.NAME_STATUSES);
const checkTone = { available: "good", taken: "bad", manual_verification_required: "warn", not_checked: "", not_applicable: "" };
const checkPill = k => pill(CHECK[k || "not_checked"] || "Not checked", checkTone[k || "not_checked"]);

CFF.route("company/names", { title: "Name selection", perm: ["cff.view"], async render(el){
  const d = await CFF.api.c.get("/names");
  const canEdit = S.can("names.edit") && !(CFF.cache.stages && CFF.cache.stages[8] && CFF.cache.stages[8].status === "approved");
  const sel = d.items.find(n => n.status === "selected");
  const fields = [
    { k: "name", label: "Name", required: true, maxlength: 120 }, { k: "status", label: "Status", type: "select", required: true, options: CATALOGS.NAME_STATUSES, value: "considering" },
    { k: "meaning", label: "Meaning", type: "textarea", rows: 2 }, { k: "purpose_link", label: "Connection with the company's purpose", type: "textarea", rows: 2 },
    { k: "values_link", label: "Connection with the company's values", type: "textarea", rows: 2 }, { k: "memorability", label: "Memorability (1–5)", type: "number", min: 1, max: 5 },
    { k: "domain_status", label: "Domain", type: "select", required: true, options: CATALOGS.CHECK_STATUSES, value: "not_checked" },
    { k: "social_status", label: "Social usernames", type: "select", required: true, options: CATALOGS.CHECK_STATUSES, value: "not_checked" },
    { k: "trademark_status", label: "Trademark", type: "select", required: true, options: CATALOGS.CHECK_STATUSES, value: "not_checked" },
    { k: "legal_status", label: "Legal / company registration", type: "select", required: true, options: CATALOGS.CHECK_STATUSES, value: "not_checked" },
    ...CATALOGS.NAME_CHECKLIST.map(([k, l]) => ({ k: "chk_" + k, label: l, type: "checkbox" })),
    { k: "notes", label: "Notes", type: "textarea", rows: 2 }];
  const toBody = v => { const o = { ...v, checklist: {} }; CATALOGS.NAME_CHECKLIST.forEach(([k]) => { o.checklist[k] = !!v["chk_" + k]; delete o["chk_" + k]; }); return o; };
  const withChecks = n => ({ ...n, ...Object.fromEntries(CATALOGS.NAME_CHECKLIST.map(([k]) => ["chk_" + k, !!(n.checklist || {})[k]])) });
  el.innerHTML = CFF.pageHead({ label: "Stage 8 · Company Name Selection", title: "Name selection", crumbs: [["#/cff/8", "Stage 8"], [null, "Names"]],
    lead: "Collect candidate names, check each one, shortlist and select the final name.",
    actions: canEdit ? `<button class="btn sm" id="addName">${I.plus} Add a name</button>` : "" }) +
    notice("<b>Manual verification required.</b> CFF does not check availability automatically and never claims a name is available. Check the MCA name search (RUN / SPICe+), the IP India trademark search, domain registrars and each social platform yourself, then record the result here.") +
    (sel ? `<section class="card selected-name"><span class="label">Selected name</span><h2>${esc(sel.name)}</h2>${sel.meaning ? `<p class="muted">${esc(sel.meaning)}</p>` : ""}</section>` : "") +
    (d.items.length ? `<div class="name-grid">${d.items.map(n => { const ck = n.checklist || {}; const done = CATALOGS.NAME_CHECKLIST.filter(([k]) => ck[k]).length;
      return `<article class="card name-card ${n.status}" data-id="${esc(n.id)}"><div class="row" style="justify-content:space-between"><h3>${esc(n.name)}</h3>${pill(NST[n.status], n.status === "selected" ? "good" : n.status === "shortlisted" ? "accent" : n.status === "rejected" ? "bad" : "")}</div>
        ${n.meaning ? `<p class="muted small">${esc(n.meaning)}</p>` : ""}
        <dl class="kv tight"><dt>Domain</dt><dd>${checkPill(n.domain_status)}</dd><dt>Social</dt><dd>${checkPill(n.social_status)}</dd><dt>Trademark</dt><dd>${checkPill(n.trademark_status)}</dd><dt>Legal</dt><dd>${checkPill(n.legal_status)}</dd>
          ${n.memorability ? `<dt>Memorability</dt><dd>${"★".repeat(n.memorability)}${"☆".repeat(5 - n.memorability)}</dd>` : ""}</dl>
        <span class="muted small">Checklist: ${done} of ${CATALOGS.NAME_CHECKLIST.length} checked</span>
        ${canEdit ? `<div class="row">${n.status !== "selected" ? `<button class="btn sm secondary" data-select>Select this name</button>` : ""}<button class="btn quiet sm" data-edit>${I.edit} Edit</button><button class="icon-btn" data-del aria-label="Delete">${I.trash}</button></div>` : ""}</article>`; }).join("")}</div>`
      : `<section class="card">${empty("No names yet", "Add the names you're considering. For each, note its meaning and how it connects with your purpose and values.")}</section>`);
  const ab = $("#addName"); if(ab) ab.addEventListener("click", () => formModal({ title: "Add a name", fields, wide: true, save: v => CFF.api.c.post("/names", toBody(v)) }).then(r => { if(r){ toast("Name added."); CFF.render(); } }));
  $$(".name-card", el).forEach(c => { const n = d.items.find(x => x.id === c.dataset.id);
    const e = $("[data-edit]", c); if(e) e.addEventListener("click", () => formModal({ title: "Edit " + n.name, fields, wide: true, values: withChecks(n), save: v => CFF.api.c.patch("/names/" + n.id, toBody(v)) }).then(r => { if(r){ toast("Saved."); CFF.render(); } }));
    const s = $("[data-select]", c); if(s) s.addEventListener("click", async () => {
      const unchecked = ["domain_status", "trademark_status", "legal_status"].filter(k => n[k] !== "available" && n[k] !== "not_applicable");
      if(!await confirmBox(`Select “${n.name}” as the company name?` + (unchecked.length ? " Some checks aren't marked as available yet — verify them manually before registering." : ""), { ok: "Select" })) return;
      try{ await CFF.api.c.patch("/names/" + n.id, { status: "selected" }); toast("Name selected."); CFF.render(); }catch(x){ toast(x.message, "bad"); } });
    const dl = $("[data-del]", c); if(dl) dl.addEventListener("click", async () => { if(!await confirmBox("Delete “" + n.name + "”?", { ok: "Delete", danger: true })) return; await CFF.api.c.del("/names/" + n.id).catch(x => toast(x.message, "bad")); CFF.render(); });
  });
  CFF.ai.page({ label: "Name selection (Stage 8)", suggestions: ["Suggest 5 name ideas that fit our purpose and values", "What makes a company name memorable?", "How do we check name availability in India?"],
    context: () => "CURRENT PAGE: Company name selection (Stage 8). Candidates: " + (d.items.map(n => n.name + " (" + n.status + ")" + (n.meaning ? ": " + n.meaning : "")).join("; ") || "none") + ". Remember: never claim a name is available; say it must be verified manually." });
}});

/* ---------- Brand identity center ---------- */
CFF.route("company/brand", { title: "Brand identity", perm: ["brand.view"], async render(el){
  const d = await CFF.api.c.get("/brand");
  const locked = CFF.cache.stages && CFF.cache.stages[9] && CFF.cache.stages[9].status === "approved";
  const edit = d.canEdit && !locked;
  const asset = Object.fromEntries(d.assets.map(a => [a.kind, a]));
  el.innerHTML = CFF.pageHead({ label: "Stage 9 · Logo & Brand Identity Creation", title: "Brand identity center", crumbs: S.can("cff.view") ? [["#/cff/9", "Stage 9"], [null, "Brand"]] : null,
    lead: "Your logos, colours, typography, personality and voice in one place.", actions: `<span class="save-state" data-save aria-live="polite"></span>` }) +
    (locked ? notice(`${I.lock} Stage 9 is approved, so the brand is locked.`) : "") + `
    <section class="card stack"><h2>Logos</h2><p class="muted small">PNG, JPG, WEBP, GIF or SVG, up to ${d.maxMb} MB. Logos are stored privately with your company documents.</p>
      <div class="logo-grid">${CATALOGS.BRAND_ASSETS.map(([k, l]) => `<div class="logo-slot" data-kind="${k}"><div class="logo-prev ${k === "dark_logo" ? "dark" : ""}" id="lp-${k}">${asset[k] ? `<span class="muted small">Loading…</span>` : `<span class="muted small">No file</span>`}</div>
        <b>${esc(l)}</b>${edit ? `<div class="row"><label class="btn secondary sm file-btn">${I.upload} ${asset[k] ? "Replace" : "Upload"}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" data-up="${k}" class="sr-only"></label>${asset[k] ? `<button class="icon-btn" data-rm="${k}" aria-label="Remove ${esc(l)}">${I.trash}</button>` : ""}</div>` : ""}</div>`).join("")}</div></section>
    <section class="card stack"><h2>Brand guidelines</h2><div class="form-grid">${CATALOGS.BRAND_FIELDS.map(([k, l]) => `<div class="field ${["usage_guidelines", "brand_dos", "brand_donts", "color_psychology", "logo_meaning"].includes(k) ? "full" : ""}"><label for="bf-${k}">${esc(l)}</label>
      <textarea class="input" id="bf-${k}" data-k="${k}" rows="${k === "tagline" ? 1 : 3}" maxlength="4000" ${edit ? "" : "readonly"}>${esc(d.fields[k] || "")}</textarea></div>`).join("")}</div></section>`;
  // previews (fetched with the login token; shown as private blob URLs)
  CATALOGS.BRAND_ASSETS.forEach(async ([k]) => { const a = asset[k]; if(!a) return;
    try{ const b = await CFF.api.blob("/documents/" + a.document_id + "/file?inline=1"); const url = URL.createObjectURL(b); const box = $("#lp-" + k); if(box) box.innerHTML = `<img src="${url}" alt="${esc(opt(CATALOGS.BRAND_ASSETS)[k])}">`; }
    catch(e){ const box = $("#lp-" + k); if(box) box.innerHTML = `<span class="muted small">Can't show preview</span>`; } });
  if(edit){
    const s = CFF.saver("brand", fields => CFF.api.c.put("/brand", { fields }), 900);
    $$("textarea[data-k]", el).forEach(t => t.addEventListener("input", () => s.queue(Object.fromEntries($$("textarea[data-k]", el).map(x => [x.dataset.k, x.value])))));
    $$("[data-up]", el).forEach(inp => inp.addEventListener("change", async () => {
      const f = inp.files[0]; if(!f) return;
      if(f.size > d.maxMb * 1048576) return toast("That file is " + fileSize(f.size) + ". The limit is " + d.maxMb + " MB.", "bad");
      CFF.saveState("Uploading…");
      try{ await CFF.api.upload("/brand/assets/" + inp.dataset.up, f, { name: f.name }); CFF.saveState("Saved", "good"); toast("Logo uploaded."); CFF.render(); }
      catch(e){ CFF.saveState("Upload failed", "bad"); toast("Upload failed. " + e.message, "bad"); }
    }));
    $$("[data-rm]", el).forEach(b => b.addEventListener("click", async () => { if(!await confirmBox("Remove this logo from the brand? The file stays in Documents (Brand folder).", { ok: "Remove" })) return;
      await CFF.api.c.del("/brand/assets/" + b.dataset.rm).catch(e => toast(e.message, "bad")); CFF.render(); }));
  }
  let focus = null; $$("textarea[data-k]", el).forEach(t => t.addEventListener("focus", () => { focus = t; }));
  CFF.ai.page({ label: "Brand identity (Stage 9)", suggestions: ["Suggest a tagline that fits our values", "Describe a brand voice for us", "What colours fit our brand personality?"],
    insert: edit ? text => { const t = focus || $("#bf-tagline"); t.value = t.value.trim() ? t.value + "\n" + text : text; t.dispatchEvent(new Event("input")); t.focus(); } : null, insertLabel: "Insert into the selected field",
    context: () => "CURRENT PAGE: Brand identity center (Stage 9).\n" + CATALOGS.BRAND_FIELDS.map(([k, l]) => l + ": " + CFF.util.cut(($("#bf-" + k) || {}).value || "", 200)).join("\n") });
}});
})();
