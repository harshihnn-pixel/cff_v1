// CFF REPORTING: the CFF Master Report (preview, print, save as PDF, Word), progress report,
// KPI report and the activity / audit log.
(function(){
"use strict";
const CFF = window.CFF;
const { $, $$, esc, I, toast, notice, empty, pill, statusPill, fmtDate, fmtDateTime, ago, table, nl, bar } = CFF.util;
const S = CFF.state;

function blockHtml(b){
  switch(b.type){
    case "h": return `<h3>${esc(b.text)}</h3>`;
    case "p": return `<p>${nl(b.text)}</p>`;
    case "note": return `<p class="muted rep-note">${esc(b.text)}</p>`;
    case "list": return `<ul>${(b.items || []).map(i => `<li>${esc(i)}</li>`).join("")}</ul>`;
    case "kv": return (b.title ? `<h3>${esc(b.title)}</h3>` : "") + (b.rows && b.rows.length ? `<dl class="kv">${b.rows.map(r => `<dt>${esc(r[0])}</dt><dd>${nl(r[1])}</dd>`).join("")}</dl>` : "");
    case "table": return table(b.head, (b.rows || []).map(r => r.map(c => nl(c))));
    default: return "";
  }
}

CFF.route("reports/master", { title: "CFF Master Report", perm: ["reports.view"], async render(el, p, q){
  const drafts = q.drafts === "1";
  const r = await CFF.api.c.get("/reports/master" + (drafts ? "?drafts=1" : ""));
  el.innerHTML = `<div class="no-print">${CFF.pageHead({ label: "Reports", title: "CFF Master Report", lead: "One document with the company's complete formation journey. By default only approved information is included.",
    actions: `<label class="toggle"><input type="checkbox" id="drafts" ${drafts ? "checked" : ""}> Include drafts</label><button class="btn secondary sm" id="printBtn">${I.print} Print / Save as PDF</button><button class="btn sm" id="docxBtn">${I.download} Word</button>` })}
      ${drafts ? notice("This preview includes draft (unapproved) information. Drafts are marked where they appear.", "bad") : ""}</div>
    <article class="report card">
      <header class="rep-head"><span class="label">CFF – Company Formation &amp; Growth Operating System</span><h1>CFF Master Report</h1><h2>${esc(r.company)}</h2>
        <p class="muted">Generated ${esc(fmtDateTime(r.generated_at))} · ${r.include_drafts ? "includes drafts" : "approved information only"} · ${r.progress.pct}% complete · ${r.progress.approved} of 13 stages approved</p></header>
      <nav class="rep-toc" aria-label="Contents"><b>Contents</b><ol>${r.sections.map(s => `<li><a href="#rep-${s.n}" data-toc="${s.n}">${esc(s.title)}</a></li>`).join("")}</ol></nav>
      ${r.sections.map(s => `<section class="rep-sec" id="rep-${s.n}"><h2>${s.n}. ${esc(s.title)}</h2>${s.blocks.map(blockHtml).join("")}</section>`).join("")}
      <footer class="rep-foot muted small">Registration and compliance information is general guidance. Confirm with a Chartered Accountant, Company Secretary or lawyer.</footer>
    </article>`;
  $("#drafts").addEventListener("change", e => CFF.go("#/reports/master" + (e.target.checked ? "?drafts=1" : "")));
  $("#printBtn").addEventListener("click", () => { toast("Choose “Save as PDF” as the printer to get a PDF."); setTimeout(() => window.print(), 300); });
  $("#docxBtn").addEventListener("click", async () => { const b = $("#docxBtn"); b.disabled = true;
    try{ const blob = await CFF.api.blob("/reports/master.docx" + (drafts ? "?drafts=1" : "")); CFF.api.saveBlob(blob, "CFF-Master-Report-" + r.company.replace(/[^\w-]+/g, "-") + ".docx"); toast("Word document downloaded."); }
    catch(e){ toast(e.message, "bad"); } finally{ b.disabled = false; } });
  $$("[data-toc]", el).forEach(a => a.addEventListener("click", e => { e.preventDefault(); const t = $("#rep-" + a.dataset.toc); if(t) t.scrollIntoView({ block: "start" }); }));
  CFF.ai.page({ label: "CFF Master Report", suggestions: ["Summarise our company in five sentences", "What are the biggest gaps in this report?"],
    context: () => "CURRENT PAGE: CFF Master Report (" + (drafts ? "with drafts" : "approved only") + ").\n" + r.sections.map(s => s.n + ". " + s.title + ": " + s.blocks.map(b => b.text || (b.rows || []).map(x => x.join(": ")).join("; ") || (b.items || []).join("; ")).join(" ").slice(0, 400)).join("\n") });
}});

CFF.route("reports/progress", { title: "Progress report", perm: ["reports.view"], async render(el){
  const r = await CFF.api.c.get("/reports/progress");
  const L = { submit: "Submitted", approve: "Approved", request_changes: "Changes requested", reopen: "Reopened" };
  el.innerHTML = `<div class="no-print">${CFF.pageHead({ label: "Reports", title: "Progress report", lead: "Every stage of the framework: status, completion and the latest reviews.", actions: `<button class="btn secondary sm" id="printBtn">${I.print} Print / Save as PDF</button>` })}</div>
    <article class="report card"><header class="rep-head"><h1>Progress report</h1><h2>${esc(S.company.name)}</h2><p class="muted">${r.overall.pct}% of sub-points complete · ${r.overall.approved} of 13 stages approved · ${esc(fmtDateTime(new Date()))}</p></header>
      ${table(["Stage", "Status", "Complete", "Latest review"], r.stages.map(s => [`<a href="#/cff/${s.n}">${s.n}. ${esc(s.title)}</a>`, statusPill(s.status), `<span class="row nowrap">${bar(s.pct)}<span class="num small">${s.pct}%</span></span>`,
        s.reviews.length ? `${esc(L[s.reviews[0].action] || s.reviews[0].action)} by ${esc(s.reviews[0].actor_name || "")} <span class="muted small">${esc(fmtDate(s.reviews[0].created_at))}</span>${s.reviews[0].comment ? `<span class="muted small block">“${esc(s.reviews[0].comment)}”</span>` : ""}` : '<span class="muted">—</span>']))}
      ${r.readiness.warnings.length ? `<h2>Readiness warnings</h2><ul>${r.readiness.warnings.map(w => `<li>${esc(w.text)}</li>`).join("")}</ul>` : ""}
      ${r.readiness.missing.length ? `<h2>Missing information</h2><ul>${r.readiness.missing.map(w => `<li>${esc(w.text)}</li>`).join("")}</ul>` : ""}</article>`;
  $("#printBtn").addEventListener("click", () => window.print());
}});

CFF.route("reports/kpi", { title: "KPI report", perm: ["reports.view", "kpis.view"], async render(el){
  const r = await CFF.api.c.get("/reports/kpi");
  const ST = { on_track: ["On track", "good"], at_risk: ["At risk", "warn"], off_track: ["Off track", "bad"] };
  el.innerHTML = `<div class="no-print">${CFF.pageHead({ label: "Reports", title: "KPI report", lead: "All KPIs with their full result history.", actions: `<button class="btn secondary sm" id="printBtn">${I.print} Print / Save as PDF</button>` })}</div>
    <article class="report card"><header class="rep-head"><h1>KPI report</h1><h2>${esc(S.company.name)}</h2><p class="muted">${esc(fmtDateTime(new Date()))}</p></header>
      ${r.kpis.length ? r.kpis.map(k => `<section class="rep-sec"><h3>${esc(k.name)} <span class="muted small">${esc([k.department, k.owner_name, k.period_type].filter(Boolean).join(" · "))}</span></h3>
        ${table(["Period", "Target", "Actual", "Variance", "Status", "Comments", "Corrective action"], k.results.slice().reverse().map(x => [esc(x.period), esc((x.target ?? "") + (k.unit ? " " + k.unit : "")), esc((x.actual ?? "") + (k.unit ? " " + k.unit : "")),
          esc(x.target != null && x.actual != null ? (+(x.actual - x.target).toFixed(2)) : ""), x.status ? pill(ST[x.status][0], ST[x.status][1]) : "", esc(x.comments || ""), esc(x.corrective_action || "")]), { empty: `<p class="muted">No results yet.</p>` })}</section>`).join("")
        : empty("No KPIs yet", "Add KPIs in Execution → KPIs.")}</article>`;
  $("#printBtn").addEventListener("click", () => window.print());
}});

/* ---------- activity / audit log ---------- */
CFF.route("activity", { title: "Activity", perm: ["activity.view"], async render(el){
  let items = [], more = true, entity = "";
  el.innerHTML = CFF.pageHead({ label: "Audit history", title: "Activity", lead: "Every change in this company: who, what and when, with old and new values. The log can't be edited or deleted." }) + `
    <div class="toolbar"><label for="entF" class="sr-only">Filter</label><select class="input sm" id="entF"><option value="">Everything</option>${["CFF answer", "Stage status", "Stage review", "Partner", "Shareholding", "Role", "Decision authority", "Accountability", "Department", "Company value", "Master profile", "Company name", "Brand identity", "Logo", "Document", "Plan item", "Task", "Compliance item", "Employee", "Company content", "KPI", "KPI result", "Review", "Member", "Invitation", "Permission", "Company"].map(x => `<option>${x}</option>`).join("")}</select></div>
    <section class="card flush"><div id="actList" class="act-list"></div><div class="pad"><button class="btn secondary sm" id="moreBtn">Load more</button></div></section>`;
  const fmt = v => v == null ? "" : typeof v === "string" ? v : JSON.stringify(v, null, 1).slice(0, 1200);
  const draw = () => {
    $("#actList").innerHTML = items.length ? items.map(a => `<div class="act-row"><span class="avatar xs">${esc(CFF.util.initials(a.actor_name))}</span><div class="stack" style="gap:2px;min-width:0">
      <span><b>${esc(a.actor_name || "System")}</b> ${esc(a.action)} <b>${esc(a.entity)}</b>${a.summary ? ": " + esc(CFF.util.cut(a.summary, 140)) : ""}</span>
      <span class="muted small">${esc(fmtDateTime(a.created_at))}</span>
      ${a.old_value || a.new_value ? `<details class="mini"><summary>Details</summary><div class="diff"><div><span class="label">Before</span><pre>${esc(fmt(a.old_value)) || "—"}</pre></div><div><span class="label">After</span><pre>${esc(fmt(a.new_value)) || "—"}</pre></div></div></details>` : ""}</div></div>`).join("")
      : `<div class="pad">${empty("No activity yet", "")}</div>`;
    $("#moreBtn").hidden = !more;
  };
  const load = async reset => {
    if(reset){ items = []; more = true; }
    const last = items[items.length - 1];
    const r = await CFF.api.c.get("/activity?limit=50" + (last ? "&before=" + encodeURIComponent(last.created_at) : "") + (entity ? "&entity=" + encodeURIComponent(entity) : ""));
    items = items.concat(r.items); more = r.items.length === 50; draw();
  };
  $("#moreBtn").addEventListener("click", () => load(false).catch(e => toast(e.message, "bad")));
  $("#entF").addEventListener("change", e => { entity = e.target.value; load(true).catch(x => toast(x.message, "bad")); });
  await load(true);
}});
})();
