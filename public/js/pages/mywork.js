// Personal, read-mostly views used by the Employee Portal (and by everyone for their own work):
// My tasks, My KPIs, shared SOPs / policies / training / announcements, shared documents,
// the approved company values and notifications. They only call endpoints that return the
// person's own or shared data — never the company management lists.
(function(){
"use strict";
const CFF = window.CFF;
const { $, $$, esc, I, toast, notice, empty, pill, lblPill, opt, fmtDate, ago, today, addDays, table, tabs, onTabs, nl, bar, fileSize } = CFF.util;
const S = CFF.state;
const PR = opt(CATALOGS.PRIORITIES), TST = opt(CATALOGS.TASK_STATUSES);
const prTone = { critical: "bad", high: "warn", medium: "info", low: "" };

/* ---------- My tasks ---------- */
CFF.route("my/tasks", { title: "My tasks", async render(el, p, q){
  const d = await CFF.api.c.get("/tasks/mine");
  const t0 = today(), t7 = addDays(t0, 7), open = x => !["completed", "cancelled"].includes(x.status);
  const TABS = { open: open, today: x => open(x) && x.due_date === t0, upcoming: x => open(x) && x.due_date > t0 && x.due_date <= t7, overdue: x => open(x) && x.due_date && x.due_date < t0, completed: x => x.status === "completed" };
  let tab = TABS[q.tab] ? q.tab : "open";
  el.innerHTML = CFF.pageHead({ label: "My work", title: "My tasks", lead: "Tasks assigned to you. Update the status, progress and notes as you work." }) +
    tabs([["open", "Open"], ["today", "Today"], ["upcoming", "Upcoming"], ["overdue", "Overdue"], ["completed", "Completed"]].map(([k, l]) => [k, l + " (" + d.items.filter(TABS[k]).length + ")"]), tab) + `<div id="myT"></div>`;
  const draw = () => {
    const list = d.items.filter(TABS[tab]);
    $("#myT").innerHTML = `<section class="card flush">${table(["Task", "Priority", "Start", "Due", "Status", "Progress", ""], list.map(x => ({ attrs: `data-id="${esc(x.id)}"`, cells: [
      `<b>${esc(x.title)}</b>${x.notes ? `<span class="muted small block">${esc(CFF.util.cut(x.notes, 120))}</span>` : ""}`, pill(PR[x.priority], prTone[x.priority]), esc(fmtDate(x.start_date)),
      x.due_date ? `<span class="${open(x) && x.due_date < t0 ? "bad-t" : ""}">${esc(fmtDate(x.due_date))}</span>` : "", lblPill(CATALOGS.TASK_STATUSES, x.status),
      `<span class="row nowrap">${bar(x.progress)}<span class="num small">${x.progress}%</span></span>`, `<button class="btn secondary sm" data-prog>Update</button>`] })),
      { empty: `<div class="pad">${empty(tab === "overdue" ? "Nothing overdue" : "No tasks here", tab === "open" ? "When someone assigns you a task, it appears here." : "")}</div>` })}</section>`;
    $$("[data-prog]", el).forEach(b => b.addEventListener("click", () => CFF.taskProgress(d.items.find(x => x.id === b.closest("[data-id]").dataset.id))));
  };
  onTabs(el, k => { tab = k; draw(); }); draw();
  CFF.ai.page({ label: "My tasks", suggestions: ["Help me plan my tasks for this week", "Which task should I do first?", "Break my biggest task into small steps"],
    context: () => "CURRENT PAGE: My tasks (only the tasks assigned to me).\n" + d.items.filter(open).map(x => "- " + x.title + " · " + TST[x.status] + " · " + x.progress + "%" + (x.due_date ? " · due " + x.due_date : "") + " · priority " + x.priority).join("\n") });
}});

/* ---------- My KPIs ---------- */
const STT = { on_track: ["On track", "good"], at_risk: ["At risk", "warn"], off_track: ["Off track", "bad"] };
CFF.route("my/kpis", { title: "My KPIs", async render(el){
  const d = await CFF.api.c.get("/kpis/mine");
  el.innerHTML = CFF.pageHead({ label: "My work", title: "My KPIs", lead: "The measures agreed for your role, with your latest results." }) +
    (d.items.length ? `<div class="kpi-cards">${d.items.map(k => { const r = k.results[0]; const t = r && r.target != null ? Number(r.target) : k.target != null ? Number(k.target) : null; const a = r && r.actual != null ? Number(r.actual) : null;
      const pct = t && a != null ? Math.max(0, Math.min(150, Math.round((k.direction === "lower" ? t / (a || 1) : a / t) * 100))) : null;
      return `<section class="card stack"><div class="row" style="justify-content:space-between"><h3>${esc(k.name)}</h3>${r && r.status ? pill(STT[r.status][0], STT[r.status][1]) : pill("No data yet")}</div>
        <dl class="kv tight"><dt>Target</dt><dd>${esc(t ?? "—")} ${esc(k.unit || "")}</dd><dt>Actual</dt><dd>${esc(a ?? "—")} ${esc(k.unit || "")}</dd><dt>Period</dt><dd>${esc(r ? r.period : k.period_type)}</dd></dl>
        ${pct != null ? `<div class="row small">${bar(Math.min(100, pct), pct >= 100 ? "good" : "")}<span class="num">${pct}%</span></div>` : ""}
        ${r && r.comments ? `<p class="muted small">${esc(r.comments)}</p>` : ""}
        ${k.results.length > 1 ? `<details class="mini"><summary>History</summary>${table(["Period", "Target", "Actual", "Status"], k.results.map(x => [esc(x.period), esc(x.target ?? ""), esc(x.actual ?? ""), x.status ? pill(STT[x.status][0], STT[x.status][1]) : ""]))}</details>` : ""}</section>`; }).join("")}</div>`
      : `<section class="card">${empty("No KPIs yet", "Your manager or HR sets the KPIs for your role. They'll appear here.")}</section>`);
  CFF.ai.page({ label: "My KPIs", suggestions: ["How can I improve my KPI results?", "Explain what my KPIs measure"],
    context: () => "CURRENT PAGE: My KPIs.\n" + d.items.map(k => "- " + k.name + ": target " + (k.target ?? "?") + " " + (k.unit || "") + (k.results[0] ? ", latest " + k.results[0].period + " actual " + k.results[0].actual : ", no results yet")).join("\n") });
}});

/* ---------- Shared resources (read) ---------- */
const RES = { sops: ["sop", "SOPs", "Standard operating procedures for your work."], policies: ["policy", "Policies", "Company policies: HR, leave, attendance, code of conduct and workplace rules."],
  training: ["training", "Training", "Onboarding and learning material."], announcements: ["announcement", "Announcements", "Company news and updates."] };
CFF.route("resources/:kind", { title: "Resources", perm: ["content.view", "content.manage", "documents.view"], async render(el, p){
  if(p.kind === "documents") return renderDocs(el);
  const R = RES[p.kind]; if(!R) return CFF.go("#/resources/sops");
  if(!S.can("content.view", "content.manage")) return CFF.noAccess(el);
  const d = await CFF.api.c.get("/content?kind=" + R[0]);
  el.innerHTML = CFF.pageHead({ label: "Resources", title: R[1], lead: R[2], actions: d.canManage ? `<a class="btn secondary sm" href="#/people/content">Manage content</a>` : "" }) +
    (d.items.length ? `<div class="stack" style="gap:12px">${d.items.map(x => `<article class="card content-item" data-id="${esc(x.id)}">
      <div class="row" style="justify-content:space-between"><div class="stack" style="gap:2px;min-width:0"><h3>${esc(x.title)}</h3><span class="muted small">Published ${esc(ago(x.published_at))}</span></div>
        ${x.requires_ack ? (x.acknowledged ? pill("Read and understood", "good") : `<button class="btn sm" data-ack>I have read and understood</button>`) : ""}</div>
      <details ${d.items.length === 1 ? "open" : ""}><summary class="muted small">Read</summary><div class="prose content-body">${nl(x.body)}</div></details>
      ${CFF.state.can("ai.use") ? `<button class="btn quiet sm" data-explain>${I.sparkle} Explain this</button>` : ""}</article>`).join("")}</div>`
      : `<section class="card">${empty("Nothing here yet", "When your company shares " + R[1].toLowerCase() + ", they appear here.")}</section>`);
  $$("[data-ack]", el).forEach(b => b.addEventListener("click", async () => { try{ await CFF.api.c.post("/content/items/" + b.closest("[data-id]").dataset.id + "/acknowledge"); toast("Thank you. Your confirmation is recorded."); CFF.render(); }catch(e){ toast(e.message, "bad"); } }));
  let focus = null;
  $$("[data-explain]", el).forEach(b => b.addEventListener("click", () => { focus = d.items.find(x => x.id === b.closest("[data-id]").dataset.id); CFF.ai.ask("Explain this " + R[1].replace(/s$/, "").toLowerCase() + " in simple words: what I need to do and why it matters."); }));
  CFF.ai.page({ label: R[1], suggestions: ["Explain this in simple words", "What does this mean for my daily work?"],
    context: () => "CURRENT PAGE: " + R[1] + " shared with me.\n" + (focus ? "The item I'm asking about: " + focus.title + "\n" + CFF.util.cut(focus.body, 5000) : d.items.map(x => "- " + x.title + ": " + CFF.util.cut(x.body, 400)).join("\n")) });
}});

async function renderDocs(el){
  if(!S.can("documents.view")) return CFF.noAccess(el);
  const d = await CFF.api.c.get("/documents");
  const DOCC = opt(CATALOGS.DOC_CATEGORIES);
  el.innerHTML = CFF.pageHead({ label: "Resources", title: "Documents", lead: "Documents shared with your role.", actions: d.canUpload || d.canManage ? `<a class="btn secondary sm" href="#/compliance/documents">Document library</a>` : "" }) +
    `<section class="card flush">${table(["Name", "Folder", "Updated", ""], d.documents.map(x => ({ attrs: `data-id="${esc(x.id)}" data-n="${esc(x.name)}"`, cells: [
      `<b>${esc(x.name)}</b>${x.description ? `<span class="muted small block">${esc(x.description)}</span>` : ""}`, esc(DOCC[x.category] || x.category), esc(fmtDate(x.uploaded_at)),
      `<div class="row nowrap">${/^(image\/(png|jpeg|webp|gif)|application\/pdf)$/.test(x.mime_type) ? `<button class="icon-btn" data-view aria-label="View ${esc(x.name)}">${I.eye}</button>` : ""}<button class="icon-btn" data-dl aria-label="Download ${esc(x.name)}">${I.download}</button></div>`] })),
      { empty: `<div class="pad">${empty("No documents shared with you yet", "")}</div>` })}</section>`;
  $$("[data-view]", el).forEach(b => b.addEventListener("click", () => CFF.openDocument(b.closest("[data-id]").dataset.id)));
  $$("[data-dl]", el).forEach(b => { const r = b.closest("[data-id]"); b.addEventListener("click", () => CFF.openDocument(r.dataset.id, true, r.dataset.n)); });
}

/* ---------- Company values (approved, read only) ---------- */
CFF.route("company/our-values", { title: "Company values", async render(el){
  const d = await CFF.api.c.get("/overview");
  el.innerHTML = CFF.pageHead({ label: "Company", title: "Our company values", lead: "The values the founders agreed and approved. They guide how we work with each other and with customers.",
    actions: `<a class="btn secondary sm" href="#/values">${I.sparkle} My values assessment</a>` }) +
    (d.values.length ? `<div class="val-list">${d.values.map(v => `<article class="card val-item"><h3>${esc(v.name)}</h3><dl class="kv">
      ${[["Meaning", v.meaning], ["Why it matters", v.why_it_matters], ["What it looks like", v.expected_behavior], ["What we don't do", v.unacceptable_behavior], ["Our promise to customers", v.customer_promise]].filter(r => r[1]).map(([l, t]) => `<dt>${esc(l)}</dt><dd>${nl(t)}</dd>`).join("")}</dl></article>`).join("")}</div>`
      : `<section class="card">${empty("Not approved yet", "The company values will appear here once the founders approve them.")}</section>`) +
    notice("Your personal values assessment is yours. It doesn't change the company values.");
  CFF.ai.page({ label: "Company values", suggestions: ["How do these values apply to my work?", "Give me an example of each value in action"],
    context: () => "CURRENT PAGE: Approved company values.\n" + d.values.map(v => "- " + v.name + ": " + (v.meaning || "") + (v.expected_behavior ? " Expected: " + v.expected_behavior : "")).join("\n") });
}});

/* ---------- Notifications ---------- */
CFF.route("notifications", { title: "Notifications", async render(el){
  const d = await CFF.api.c.get("/notifications");
  el.innerHTML = CFF.pageHead({ label: "Inbox", title: "Notifications", actions: d.unread ? `<button class="btn secondary sm" id="readAll">Mark all read</button>` : "" }) +
    (d.items.length ? `<section class="card flush"><div class="notif-list">${d.items.map(n => `<a class="nb-item ${n.read_at ? "" : "unread"}" href="${esc(n.link && n.link.startsWith("#/") ? n.link : CFF.home())}" data-id="${esc(n.id)}"><b>${esc(n.title)}</b>${n.body ? `<span>${esc(n.body)}</span>` : ""}<small>${esc(ago(n.created_at))}</small></a>`).join("")}</div></section>`
      : `<section class="card">${empty("You're all caught up", "Task assignments, due dates, new SOPs and announcements appear here.")}</section>`);
  const ra = $("#readAll"); if(ra) ra.addEventListener("click", async () => { await CFF.api.c.post("/notifications/read", {}); CFF.refreshBell(); CFF.render(); });
  $$(".nb-item.unread", el).forEach(a => a.addEventListener("click", () => CFF.api.c.post("/notifications/read", { ids: [a.dataset.id] }).then(CFF.refreshBell).catch(() => {})));
}});
})();
