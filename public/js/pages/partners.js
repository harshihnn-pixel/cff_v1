// Partners / founders (Stages 3 and 4): many profiles per company, auto-saved profile fields,
// archive / restore, side-by-side comparison, and AI summary / strengths / contribution comparison.
// AI never decides ownership or equity.
(function(){
"use strict";
const CFF = window.CFF;
const { $, $$, esc, I, toast, notice, empty, pill, bar, formModal, confirmBox, nl, cut, modal } = CFF.util;
const S = CFF.state;
const FIELDS = CATALOGS.PARTNER_FIELDS;
const ALL = FIELDS.flatMap(g => g.fields);

CFF.route("company/partners", { title: "Partners", perm: ["partners.view"], async render(el, p, q){
  const d = await CFF.api.c.get("/partners");
  const showArch = q.archived === "1";
  const list = d.partners.filter(x => showArch ? x.status === "archived" : x.status === "active");
  const archived = d.partners.filter(x => x.status === "archived").length;
  el.innerHTML = CFF.pageHead({ label: "Stages 3 & 4 · Partners", title: "Partners & founders",
    lead: "One profile for every partner: their journey, resources (Stage 3), experience and vision (Stage 4). Profiles feed the company structure, values and master profile.",
    actions: `${d.partners.filter(x => x.status === "active").length > 1 ? `<button class="btn secondary sm" id="cmpBtn">${I.swap} Compare</button>` : ""}${d.canEdit ? `<button class="btn sm" id="addP">${I.plus} Add partner</button>` : ""}` }) + `
    <div class="row" style="justify-content:space-between"><div class="tabs" role="tablist"><a role="tab" class="tab-a" href="#/company/partners" aria-selected="${!showArch}">Active</a><a role="tab" class="tab-a" href="#/company/partners?archived=1" aria-selected="${showArch}">Archived (${archived})</a></div></div>
    ${list.length ? `<div class="p-grid">${list.map(x => `<a class="card p-card" href="#/company/partners/${esc(x.id)}"><span class="avatar lg">${esc(CFF.util.initials(x.full_name))}</span>
      <div class="stack" style="gap:4px;min-width:0"><b>${esc(x.full_name)}</b><span class="muted small">${esc(x.designation || "Partner")}</span>
      <div class="row small">${bar(x.completeness)}<span class="num">${x.completeness}%</span></div><span class="muted small">profile complete${x.user_id ? " · has a login" : ""}</span></div></a>`).join("")}</div>`
      : `<section class="card">${empty(showArch ? "No archived partners" : "No partners yet", showArch ? "" : "Add every founder or partner. You can link each profile to their login later.", d.canEdit && !showArch ? `<button class="btn" id="addP2">${I.plus} Add the first partner</button>` : "")}</section>`}
    <div id="cmpAi"></div>`;
  const add = () => formModal({ title: "Add a partner", fields: [
      { k: "full_name", label: "Full name", required: true, maxlength: 120 }, { k: "designation", label: "Designation", placeholder: "e.g. Co-founder, CEO" },
      { k: "user_id", label: "Linked member (optional)", type: "select", options: d.members.map(m => [m.user_id, m.display_name]), hint: "Link the profile to a member of this workspace." }],
    save: v => CFF.api.c.post("/partners", v) }).then(r => { if(r){ toast("Partner added."); CFF.go("#/company/partners/" + r.partner.id); } });
  ["#addP", "#addP2"].forEach(s => { const b = $(s); if(b) b.addEventListener("click", add); });
  const cb = $("#cmpBtn"); if(cb) cb.addEventListener("click", () => compare(d.partners.filter(x => x.status === "active"), d.canSeeFinancial));
  if(S.can("ai.use") && d.partners.filter(x => x.status === "active").length > 1) CFF.ai.outputCard($("#cmpAi"), { kind: "partner_comparison", subject: d.canSeeFinancial ? "financial" : "", title: "AI contribution comparison", button: "Compare contributions",
    intro: "Compare what each partner brings: skills, expertise, experience, network and time" + (d.canSeeFinancial ? ", and money" : "") + ". It suggests areas of responsibility and questions to discuss.",
    disclaimer: "This is not a recommendation on shareholding or ownership. Those decisions belong to the founders." });
  CFF.ai.page({ label: "Partners", suggestions: ["What should a strong partner profile include?", "Which gaps do our partners have together?"],
    context: () => "CURRENT PAGE: Partners list.\n" + list.map(x => x.full_name + " (" + (x.designation || "partner") + ", " + x.completeness + "% complete)").join("\n") });
}});

function compare(partners, fin){
  const pick = partners.slice(0, 4);
  const rows = [["Designation", ...pick.map(x => esc(x.designation || ""))], ...ALL.map(([k, l]) => [esc(l), ...pick.map(x => nl(cut((x.profile || {})[k] || "", 400)) || '<span class="muted">—</span>')])];
  if(fin) rows.push(["Financial contribution", ...pick.map(x => esc((x.financial || {}).financial_contribution || "—"))]);
  modal({ title: "Compare partners", wide: true, body: (partners.length > 4 ? `<p class="muted small">Showing the first 4 partners.</p>` : "") +
    `<div class="tbl-wrap"><table class="cmp"><thead><tr><th scope="col">Field</th>${pick.map(x => `<th scope="col">${esc(x.full_name)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => i ? `<td>${c}</td>` : `<th scope="row">${c}</th>`).join("")}</tr>`).join("")}</tbody></table></div>` });
}

CFF.route("company/partners/:id", { title: "Partner profile", perm: ["partners.view"], async render(el, p){
  const d = await CFF.api.c.get("/partners");
  const x = d.partners.find(y => y.id === p.id); if(!x){ el.innerHTML = `<section class="card">${empty("Partner not found", "", `<a class="btn" href="#/company/partners">Back to partners</a>`)}</section>`; return; }
  const locked = CFF.cache.stages && CFF.cache.stages[4] && CFF.cache.stages[4].status === "approved";
  const edit = d.canEdit && !locked;
  const prof = x.profile || {};
  el.innerHTML = CFF.pageHead({ crumbs: [["#/company/partners", "Partners"], [null, x.full_name]], label: x.status === "archived" ? "Archived partner" : "Partner profile", title: x.full_name,
    lead: esc(x.designation || "Partner") + " · " + x.completeness + "% of the profile complete",
    actions: `<span class="save-state" data-save aria-live="polite"></span>${d.canEdit ? `<button class="btn secondary sm" id="editBasics">${I.edit} Name & role</button><button class="btn quiet sm" id="archBtn">${I.archive} ${x.status === "archived" ? "Restore" : "Archive"}</button>` : ""}` }) + `
    ${locked ? notice(`${I.lock} Stage 4 is approved, so partner profiles are locked.`) : ""}
    <div class="partner-layout">
      <div class="stack" style="gap:16px;min-width:0">
        ${FIELDS.map(g => `<section class="card stack"><h2>${esc(g.group)}</h2><div class="form-grid">${g.fields.map(([k, l]) => `<div class="field full"><label for="pp-${k}">${esc(l)}</label>
          <textarea class="input" id="pp-${k}" data-k="${k}" rows="2" maxlength="5000" ${edit ? "" : "readonly"}>${esc(prof[k] || "")}</textarea></div>`).join("")}</div></section>`).join("")}
        ${d.canSeeFinancial ? `<section class="card stack"><h2>Financial contribution</h2><p class="muted small">Only people allowed to see financial information can see this. Shareholding itself is set in Structure (Stage 5).</p>
          <div class="field full"><label for="pp-fin">Financial contribution</label><textarea class="input" id="pp-fin" rows="2" maxlength="2000" ${edit ? "" : "readonly"}>${esc((x.financial || {}).financial_contribution || "")}</textarea></div></section>` : ""}
      </div>
      <div class="stack" style="gap:16px;min-width:0"><div id="aiSum"></div><div id="aiStr"></div></div>
    </div>`;
  if(edit){
    const s = CFF.saver("partner:" + x.id, body => CFF.api.c.patch("/partners/" + x.id, body), 900);
    let changed = {};
    $$("textarea[data-k]", el).forEach(t => t.addEventListener("input", () => { changed[t.dataset.k] = t.value; s.queue({ profile: { ...changed } }); }));
    const fin = $("#pp-fin"); if(fin){ const fs = CFF.saver("partner-fin:" + x.id, v => CFF.api.c.patch("/partners/" + x.id, { financial_contribution: v }), 900); fin.addEventListener("input", () => fs.queue(fin.value)); }
  }
  const eb = $("#editBasics"); if(eb) eb.addEventListener("click", () => formModal({ title: "Name & role", values: x, fields: [
      { k: "full_name", label: "Full name", required: true }, { k: "designation", label: "Designation" },
      { k: "user_id", label: "Linked member", type: "select", options: d.members.map(m => [m.user_id, m.display_name]) }],
    save: v => CFF.api.c.patch("/partners/" + x.id, v) }).then(r => { if(r){ toast("Saved."); CFF.render(); } }));
  const ab = $("#archBtn"); if(ab) ab.addEventListener("click", async () => {
    const restore = x.status === "archived";
    if(!restore && !await confirmBox("Archive " + x.full_name + "? The profile is kept and can be restored.", { ok: "Archive" })) return;
    try{ await CFF.api.c.post("/partners/" + x.id + "/archive", { restore }); toast(restore ? "Partner restored." : "Partner archived."); CFF.go("#/company/partners"); }catch(e){ toast(e.message, "bad"); }
  });
  if(S.can("ai.use")){
    CFF.ai.outputCard($("#aiSum"), { kind: "partner_summary", params: { partnerId: x.id }, subject: x.id, title: "AI partner summary", button: "Summarise", intro: "A structured summary of this profile, with missing information and questions to discuss." });
    CFF.ai.outputCard($("#aiStr"), { kind: "partner_strengths", params: { partnerId: x.id }, subject: x.id, title: "AI strength analysis", button: "Analyse strengths", intro: "Top strengths, best-fit responsibilities and development areas, based on the profile." });
  }
  let focus = null;
  $$("textarea[data-k]", el).forEach(t => t.addEventListener("focus", () => { focus = t; }));
  CFF.ai.page({ label: "Partner · " + x.full_name, suggestions: ["Help me fill in the empty fields", "Write my entrepreneurial journey from my notes", "What questions should we ask this partner?"],
    insert: edit ? text => { const t = focus || $("textarea[data-k]", el); t.value = t.value.trim() ? t.value + "\n\n" + text : text; t.dispatchEvent(new Event("input")); t.focus(); } : null, insertLabel: "Insert into the selected field",
    context: () => "CURRENT PAGE: Partner profile of " + x.full_name + " (" + (x.designation || "partner") + ").\n" + ALL.map(([k, l]) => "- " + l + ": " + cut(($("#pp-" + k) || {}).value || "", 300)).join("\n") + (focus ? "\nThe field being edited: " + (ALL.find(f => f[0] === focus.dataset.k) || [])[1] : "") });
}});
})();
