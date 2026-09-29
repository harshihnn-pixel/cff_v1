// Company pages: Overview, Company Values (Stage 6: shared and different values → final approved values)
// and the Master Company Profile generator (Stage 7: Generate → Review → Edit → Save draft → Approve).
(function(){
"use strict";
const CFF = window.CFF;
const { $, $$, esc, I, toast, notice, empty, pill, fmtDateTime, ago, md, modal, confirmBox, formModal, nl, cut } = CFF.util;
const S = CFF.state, F = CFF.fw;

/* ---------- Overview (everyone in the company) ---------- */
CFF.route("company/overview", { title: "Company overview", async render(el){
  const d = await CFF.api.c.get("/overview");
  const c = d.company;
  el.innerHTML = CFF.pageHead({ label: "Company overview", title: c.name, lead: c.source ? (c.source === "profile" ? "From the approved Master Company Profile." : "From the approved Stage 1 answers.") : "Shown here once the founders approve the company's vision and profile." }) + `
    <div class="ov-grid">
      ${[["Vision", c.vision], ["Mission", c.mission], ["Purpose", c.purpose]].map(([t, x]) => `<section class="card stack"><span class="label">${t}</span><p class="big">${x ? nl(x) : '<span class="muted">Not approved yet.</span>'}</p></section>`).join("")}
    </div>
    ${c.story ? `<section class="card stack"><h2>Our story</h2><p>${nl(c.story)}</p></section>` : ""}
    <section class="card stack"><h2>Our values</h2>${d.values.length ? `<div class="val-grid">${d.values.map(v => `<div class="val-card"><b>${esc(v.name)}</b>${v.meaning ? `<p>${esc(v.meaning)}</p>` : ""}${v.expected_behavior ? `<p class="muted small"><b>What it looks like:</b> ${esc(v.expected_behavior)}</p>` : ""}</div>`).join("")}</div>` : `<p class="muted">The company values haven't been approved yet.</p>`}</section>
    ${d.brand && (d.brand.tagline || d.brand.personality) ? `<section class="card stack"><h2>Brand</h2>${d.brand.tagline ? `<p class="big">“${esc(d.brand.tagline)}”</p>` : ""}${d.brand.personality ? `<p class="muted">${esc(d.brand.personality)}</p>` : ""}</section>` : ""}`;
  CFF.ai.page({ label: "Company overview", suggestions: ["Explain our vision in simple words", "How do our values show up in daily work?"],
    context: () => `CURRENT PAGE: Company overview.\nVision: ${c.vision}\nMission: ${c.mission}\nPurpose: ${c.purpose}\nValues: ${d.values.map(v => v.name + ": " + v.meaning).join("; ")}` });
}});

/* ---------- Company values (Stage 6) ---------- */
const VAL_FIELDS = [
  { k: "name", label: "Value name", required: true, maxlength: 80 },
  { k: "meaning", label: "Meaning", type: "textarea", rows: 2, max: 2000 },
  { k: "why_it_matters", label: "Why it matters", type: "textarea", rows: 2, max: 2000 },
  { k: "expected_behavior", label: "Expected behaviour", type: "textarea", rows: 2, max: 3000 },
  { k: "unacceptable_behavior", label: "Unacceptable behaviour", type: "textarea", rows: 2, max: 3000 },
  { k: "customer_promise", label: "Connection with the customer promise", type: "textarea", rows: 2, max: 2000 }
];
function teamAnalysis(people){
  const per = people.map(p => { const T = F.tally(p.answers); return { name: p.name, top: T.ranked.slice(0, 6).map(v => v.s), T }; });
  const count = {}; per.forEach(p => p.top.forEach(s => { count[s] = (count[s] || []).concat(p.name); }));
  const shared = Object.entries(count).filter(([, who]) => who.length >= Math.max(2, Math.ceil(per.length / 2))).sort((a, b) => b[1].length - a[1].length);
  const unique = Object.entries(count).filter(([, who]) => who.length === 1 && per.length > 1);
  return { per, shared, unique };
}
CFF.route("company/values", { title: "Company values", perm: ["values.view"], alt: "company/our-values", async render(el){
  const [vals, team] = await Promise.all([CFF.api.c.get("/values/company"), S.can("partners.view") ? CFF.api.c.get("/values/team") : Promise.resolve(null)]);
  const canEdit = vals.canEdit;
  const stageLocked = CFF.cache.stages && CFF.cache.stages[6] && CFF.cache.stages[6].status === "approved";
  const A = team ? teamAnalysis(team.people) : null;
  el.innerHTML = CFF.pageHead({ label: "Stage 6 · Company Values", title: "Company values", crumbs: S.can("cff.view") ? [["#/cff/6", "Stage 6"], [null, "Company values"]] : null,
    lead: "Start from each partner's CFF Values Discovery Assessment, find the values you share and where you differ, then agree and approve the final company values.",
    actions: `<a class="btn secondary sm" href="#/values">${I.sparkle} My values assessment</a>${canEdit ? `<button class="btn sm" id="addVal">${I.plus} Add value</button>` : ""}` }) + `
    ${stageLocked ? notice(`${I.lock} Stage 6 is approved, so the company values are locked. Reopen Stage 6 to change them.`) : ""}
    ${A ? `<section class="card stack"><h2>Partner values</h2>
      ${A.per.length ? `<div class="team-vals">${A.per.map(p => `<div class="tv"><b>${esc(p.name)}</b><div class="chips">${p.top.map(s => `<span class="vtag"><span class="dot" style="background:${F.dColor(F.SLUG_DOMAIN[s])}"></span>${esc(F.vLabel(s))}</span>`).join("") || '<span class="muted small">No matched values yet</span>'}</div><span class="muted small">${p.T.total} of 39 answers</span></div>`).join("")}</div>
        <div class="two-col"><div class="stack"><h3>Shared values</h3>${A.shared.length ? `<ul>${A.shared.map(([s, who]) => `<li><b>${esc(F.vLabel(s))}</b> <span class="muted small">— ${esc(who.join(", "))}</span></li>`).join("")}</ul>` : `<p class="muted">No shared values yet${A.per.length < 2 ? " (at least two people need to answer)" : ""}.</p>`}</div>
        <div class="stack"><h3>Different values</h3>${A.unique.length ? `<ul>${A.unique.slice(0, 10).map(([s, who]) => `<li><b>${esc(F.vLabel(s))}</b> <span class="muted small">— only ${esc(who[0])}</span></li>`).join("")}</ul><p class="muted small">Differences aren't bad. Discuss how they may show up in decisions.</p>` : `<p class="muted">None found.</p>`}</div></div>`
      : `<p class="muted">No one has answered the values questions yet. Ask each partner to complete the CFF Values Discovery Assessment.</p>`}</section><div id="alignAi"></div>` : ""}
    <section class="stack"><h2>Final company values</h2>
      ${vals.values.length ? `<div class="val-list">${vals.values.map(v => `<article class="card val-item" data-id="${esc(v.id)}">
        <div class="row" style="justify-content:space-between"><h3>${esc(v.name)}</h3><div class="row">${v.status === "approved" ? pill("Approved", "good") : pill("Draft", "info")}
          ${canEdit && !stageLocked ? `${v.status !== "approved" ? `<button class="btn sm" data-approve>${I.check} Approve</button>` : ""}<button class="btn secondary sm" data-edit>${I.edit} Edit</button><button class="icon-btn" data-del aria-label="Delete ${esc(v.name)}">${I.trash}</button>` : ""}</div></div>
        <dl class="kv">${VAL_FIELDS.slice(1).filter(f => v[f.k]).map(f => `<dt>${esc(f.label)}</dt><dd>${nl(v[f.k])}</dd>`).join("")}</dl>
        ${v.status === "approved" && v.approved_at ? `<span class="muted small">Approved ${esc(fmtDateTime(v.approved_at))}</span>` : ""}</article>`).join("")}</div>`
        : `<section class="card">${empty("No company values yet", "Add the values you agreed on. Each one gets a meaning, why it matters, expected behaviour and its link to your customer promise.", canEdit ? `<button class="btn" id="addVal2">${I.plus} Add the first value</button>` : "")}</section>`}
    </section>`;
  const add = () => formModal({ title: "Add a company value", fields: VAL_FIELDS, save: v => CFF.api.c.post("/values/company", v) }).then(r => { if(r){ toast("Value added as a draft."); CFF.render(); } });
  ["#addVal", "#addVal2"].forEach(s => { const b = $(s); if(b) b.addEventListener("click", add); });
  $$(".val-item").forEach(card => {
    const v = vals.values.find(x => x.id === card.dataset.id);
    const e = $("[data-edit]", card); if(e) e.addEventListener("click", () => formModal({ title: "Edit " + v.name, fields: VAL_FIELDS, values: v,
      intro: v.status === "approved" ? notice("Editing an approved value puts it back to draft, so it needs approving again. The old version is kept in the history.") : "",
      save: x => CFF.api.c.patch("/values/company/" + v.id, x) }).then(r => { if(r){ toast("Saved."); CFF.render(); } }));
    const a = $("[data-approve]", card); if(a) a.addEventListener("click", async () => { if(!await confirmBox("Approve “" + v.name + "” as a final company value?", { ok: "Approve" })) return; await CFF.api.c.post("/values/company/" + v.id + "/approve").catch(x => toast(x.message, "bad")); CFF.render(); });
    const dl = $("[data-del]", card); if(dl) dl.addEventListener("click", async () => { if(!await confirmBox("Delete the value “" + v.name + "”?", { ok: "Delete", danger: true })) return; await CFF.api.c.del("/values/company/" + v.id).catch(x => toast(x.message, "bad")); CFF.render(); });
  });
  if(A && S.can("ai.use") && $("#alignAi")) CFF.ai.outputCard($("#alignAi"), { kind: "values_alignment", title: "AI values alignment", button: "Compare our values",
    intro: "The AI compares everyone's values, finds shared and conflicting values, and suggests candidate company values. You decide and approve the final values.", disclaimer: "Suggestions only — the founders choose the company values." });
  CFF.ai.page({ label: "Company values (Stage 6)", suggestions: ["Suggest company values from our partners' values", "Write the meaning and expected behaviour for one of our values", "How do we handle different values between partners?"],
    insert: null, context: () => "CURRENT PAGE: Company values (Stage 6).\nFinal values: " + (vals.values.map(v => v.name + " (" + v.status + "): " + cut(v.meaning, 160)).join("; ") || "none yet") +
      (A ? "\nPartner values: " + A.per.map(p => p.name + ": " + p.top.map(F.vLabel).join(", ")).join(" | ") : "") });
}});

/* ---------- Master Company Profile (Stage 7) ---------- */
const SECTIONS = CATALOGS.PROFILE_SECTIONS;
function parseAi(text){
  const out = {}; const byLabel = Object.fromEntries(SECTIONS.map(([k, l]) => [l.toLowerCase(), k]));
  let cur = null;
  String(text || "").split("\n").forEach(line => {
    const h = /^#{1,4}\s*(.+?)\s*$/.exec(line);
    if(h){ const k = byLabel[h[1].replace(/[*:]/g, "").trim().toLowerCase()]; cur = k || null; if(k) out[k] = ""; return; }
    if(cur) out[cur] += line + "\n";
  });
  Object.keys(out).forEach(k => { out[k] = out[k].trim(); });
  return out;
}
function editor(content, sources){
  return `<div class="profile-edit">${SECTIONS.map(([k, l]) => `<div class="field full"><label for="pf-${k}">${esc(l)}${sources && sources[k] ? ` <span class="muted small">· from ${esc(/^s\d/.test(sources[k]) ? "Stage " + sources[k].split("-")[0].slice(1) + ": " + ((F.POINTS[sources[k]] || {}).title || "") : sources[k])}</span>` : ""}</label>
    <textarea class="input" id="pf-${k}" data-k="${k}" rows="${["values", "business_process", "story"].includes(k) ? 5 : 3}" maxlength="8000">${esc(content[k] || "")}</textarea></div>`).join("")}</div>`;
}
const readEditor = root => Object.fromEntries($$("textarea[data-k]", root).map(t => [t.dataset.k, t.value.trim()]));
function profileView(v){ return `<dl class="kv profile-view">${SECTIONS.filter(([k]) => (v.content[k] || "").trim()).map(([k, l]) => `<dt>${esc(l)}</dt><dd>${nl(v.content[k])}</dd>`).join("") || '<p class="muted">Empty.</p>'}</dl>`; }

CFF.route("company/profile", { title: "Master Company Profile", perm: ["profile.view"], async render(el, p, q){
  const d = await CFF.api.c.get("/profile");
  const draft = d.versions.find(v => v.status === "draft");
  const ap = d.approved;
  const mode = q.edit && draft && d.canEdit ? "edit" : "view";
  el.innerHTML = CFF.pageHead({ label: "Stage 7 · Company Master Profile", title: "Master Company Profile", crumbs: S.can("cff.view") ? [["#/cff/7", "Stage 7"], [null, "Master profile"]] : null,
    lead: "Generated from your earlier CFF stages. Generate → review → edit → save a draft → approve. Approved versions are never overwritten; every version is kept.",
    actions: d.canEdit && !draft ? `<button class="btn secondary sm" id="genCompile">${I.layers} Build from CFF answers</button>${S.can("ai.use") ? `<button class="btn sm" id="genAi">${I.sparkle} Generate with AI</button>` : ""}` : "" }) + `
    <div id="genArea"></div>
    ${draft ? `<section class="card stack draft-card"><div class="row" style="justify-content:space-between"><div class="stack" style="gap:2px"><h2>Draft · version ${draft.version}</h2><span class="muted small">${esc(draft.source === "ai" ? "Written by AI" : draft.source === "mixed" ? "AI draft, edited" : "Built from CFF answers")} · updated ${esc(ago(draft.updated_at))}</span></div>
      <div class="row">${mode === "edit" ? `<span class="save-state" data-save aria-live="polite"></span><a class="btn secondary sm" href="#/company/profile">Done editing</a>` : d.canEdit ? `<a class="btn secondary sm" href="#/company/profile?edit=1">${I.edit} Edit draft</a><button class="btn quiet sm" id="discard">Discard draft</button>` : ""}
        ${d.canApprove && mode !== "edit" ? `<button class="btn sm" id="approveDraft">${I.check} Approve as final</button>` : ""}</div></div>
      ${mode === "edit" ? editor(draft.content) : profileView(draft)}</section>` : ""}
    <section class="card stack"><div class="row" style="justify-content:space-between"><h2>${ap ? "Final version · v" + ap.version : "Final version"}</h2>${ap ? pill("Approved " + fmtDateTime(ap.approved_at), "good") : ""}</div>
      ${ap ? profileView(ap) : `<p class="muted">No approved profile yet. Build a draft from your CFF answers or with AI, review it, then approve it.</p>`}</section>
    <section class="card flush"><div class="card-head"><h2>Version history</h2></div>${CFF.util.table(["Version", "Status", "Source", "Created", "Approved", ""], d.versions.map(v => [
      "v" + v.version, v.status === "approved" ? pill("Final", "good") : v.status === "draft" ? pill("Draft", "info") : pill("Previous"), esc(v.source), esc(fmtDateTime(v.created_at)), esc(v.approved_at ? fmtDateTime(v.approved_at) : "—"),
      `<button class="btn quiet sm" data-view="${esc(v.id)}">${I.eye} View</button>`]), { empty: `<p class="muted pad">No versions yet.</p>` })}</section>`;
  $$("[data-view]", el).forEach(b => b.addEventListener("click", () => { const v = d.versions.find(x => x.id === b.dataset.view);
    const cmp = ap && v.id !== ap.id ? `<details class="mini"><summary>Compare with the final version (v${ap.version})</summary>${SECTIONS.filter(([k]) => (v.content[k] || "") !== (ap.content[k] || "")).map(([k, l]) => `<div class="diff"><div><span class="label">${esc(l)} · v${v.version}</span><p>${nl(v.content[k] || "") || '<span class="muted">(empty)</span>'}</p></div><div><span class="label">v${ap.version}</span><p>${nl(ap.content[k] || "") || '<span class="muted">(empty)</span>'}</p></div></div>`).join("") || '<p class="muted">No differences.</p>'}</details>` : "";
    modal({ title: "Master profile · v" + v.version, wide: true, body: profileView(v) + cmp }); }));
  if(draft && mode === "edit"){
    const s = CFF.saver("profile:" + draft.id, content => CFF.api.c.patch("/profile/" + draft.id, { content }), 900);
    $$("textarea[data-k]", el).forEach(t => t.addEventListener("input", () => s.queue(readEditor(el))));
    CFF.ai.page({ label: "Master profile draft", suggestions: ["Improve our mission statement", "Write a short company story from our answers", "Which sections are weak or missing?"],
      insert: text => { const f = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.k ? document.activeElement : $("textarea[data-k]", el); f.value = f.value.trim() ? f.value + "\n\n" + text : text; f.dispatchEvent(new Event("input")); }, insertLabel: "Insert into the selected section",
      context: () => "CURRENT PAGE: Master Company Profile draft (Stage 7).\n" + SECTIONS.map(([k, l]) => l + ": " + cut(($("#pf-" + k) || {}).value || "", 300)).join("\n") });
  } else CFF.ai.page({ label: "Master Company Profile", suggestions: ["What's missing from our profile?", "Is our profile consistent with our values?"], context: () => "CURRENT PAGE: Master Company Profile.\n" + (ap ? SECTIONS.map(([k, l]) => l + ": " + cut(ap.content[k], 250)).join("\n") : "No approved profile yet.") });
  const ad = $("#approveDraft"); if(ad) ad.addEventListener("click", async () => {
    if(!await confirmBox(ap ? `Approve draft v${draft.version} as the final profile? It replaces the current final version (v${ap.version}), which is kept in the history.` : `Approve draft v${draft.version} as the final Master Company Profile?`, { ok: "Approve" })) return;
    try{ await CFF.api.c.post("/profile/" + draft.id + "/approve"); toast("Master profile approved."); CFF.render(); }catch(e){ toast(e.message, "bad"); }
  });
  const dc = $("#discard"); if(dc) dc.addEventListener("click", async () => { if(!await confirmBox("Discard this draft? It stays in the version history.", { ok: "Discard", danger: true })) return; await CFF.api.c.post("/profile/" + draft.id + "/discard").catch(e => toast(e.message, "bad")); CFF.render(); });
  const gc = $("#genCompile"); if(gc) gc.addEventListener("click", async () => { const c = await CFF.api.c.get("/profile/compile"); review(el, c.content, "manual", c.sources, ap); });
  const ga = $("#genAi"); if(ga) ga.addEventListener("click", () => generateAi(el, ap));
}});

// Review step before anything is saved.
function review(el, content, source, sources, ap){
  const area = $("#genArea");
  area.innerHTML = `<section class="card stack review-card"><div class="row" style="justify-content:space-between"><div class="stack" style="gap:2px"><h2>Review the generated profile</h2><span class="muted small">Nothing is saved yet. Edit anything, then save it as a draft.${ap ? " The approved version stays unchanged." : ""}</span></div>
    <div class="row"><button class="btn secondary sm" id="revCancel">Cancel</button><button class="btn sm" id="revSave">Save as draft</button></div></div>${editor(content, sources)}</section>`;
  area.scrollIntoView({ block: "start" });
  $("#revCancel").addEventListener("click", () => { area.innerHTML = ""; });
  $("#revSave").addEventListener("click", async () => {
    try{ await CFF.api.c.post("/profile", { content: readEditor(area), source }); toast("Draft saved. Review it and approve when ready."); CFF.render(); }catch(e){ toast(e.message, "bad"); }
  });
}
async function generateAi(el, ap){
  const area = $("#genArea"); let ctl = new AbortController();
  area.innerHTML = `<section class="card ai-analysis"><div class="ai-an-head"><span class="ai-an-mark">${I.sparkle}</span><h2 style="flex:1">Writing a draft profile…</h2><button class="btn secondary sm" id="aiStop">Stop</button></div><div class="ai-an-body" id="aiLive"><div class="ai-thinking"><span></span><span></span><span></span> Reading your CFF answers…</div></div></section>`;
  $("#aiStop").addEventListener("click", () => ctl.abort());
  try{
    const text = await CFF.ai.generate("master_profile", {}, t => { const b = $("#aiLive"); if(b) b.innerHTML = md(t); }, ctl.signal);
    const content = parseAi(text);
    if(!Object.keys(content).length) throw new Error("The AI answer couldn't be read. Please try again.");
    review(el, content, "ai", null, ap);
  }catch(e){ area.innerHTML = notice(esc(e.name === "AbortError" ? "Stopped." : e.message), "bad"); }
}
})();
