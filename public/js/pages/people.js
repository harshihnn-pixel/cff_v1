// CFF MANAGEMENT (people): employees (Stage 12), SOPs / policies / training / announcements with
// "I have read and understood" acknowledgements, and the Employee Portal dashboard.
(function(){
"use strict";
const CFF = window.CFF;
const { $, $$, esc, I, toast, notice, empty, pill, lblPill, formModal, confirmBox, opt, fmtDate, ago, table, tabs, onTabs, nl, bar, modal, md } = CFF.util;
const S = CFF.state;
const KIND = opt(CATALOGS.CONTENT_KINDS);

CFF.route("people/employees", { title: "Employees", perm: ["employees.view"], async render(el){
  const [d, st, mem] = await Promise.all([CFF.api.c.get("/employees"), CFF.api.c.get("/structure"), CFF.api.c.get("/members")]);
  const canEdit = S.can("employees.manage");
  const dName = Object.fromEntries(st.departments.map(x => [x.id, x.name])), eName = Object.fromEntries(d.items.map(x => [x.id, x.full_name]));
  const pendingByEmp = Object.fromEntries((mem.invitations || []).filter(i => i.employee_id).map(i => [i.employee_id, i]));
  el.innerHTML = CFF.pageHead({ label: "Stage 12 · Execution & Team Building", title: "Employees", crumbs: S.can("cff.view") ? [["#/cff/12", "Stage 12"], [null, "Employees"]] : null,
    lead: "Your team: designation, department, reporting manager and responsibilities. Invite employees to give them their own Employee Portal.",
    actions: `<a class="btn secondary sm" href="#/people/content">SOPs & training</a>` }) + `<div id="empList"></div>`;
  CFF.crudList($("#empList"), { title: "Team", path: "/employees", items: d.items, canEdit, addLabel: "Add employee",
    emptyTitle: "No employees yet", emptyText: "Add employees with their department, reporting manager and responsibilities.",
    cols: [["Name", x => `<b>${esc(x.full_name)}</b>${x.email ? `<span class="muted small block">${esc(x.email)}</span>` : ""}`], ["Designation", x => esc(x.designation || "")], ["Department", x => esc(dName[x.department_id] || "")],
      ["Reports to", x => esc(eName[x.reporting_manager_id] || "")], ["Login", x => x.user_id ? pill("Has login", "good") : pendingByEmp[x.id] ? pill("Invited", "info") : pill("No login")], ["Status", x => x.status === "active" ? pill("Active", "good") : pill("Inactive")]],
    actions: x => canEdit && !x.user_id && !pendingByEmp[x.id] ? `<button class="btn secondary sm" data-inv>Invite</button>` : "",
    fieldsFor: it => [{ k: "full_name", label: "Full name", required: true }, { k: "email", label: "Email", type: "email" }, { k: "phone", label: "Phone" }, { k: "designation", label: "Designation" },
      { k: "department_id", label: "Department", type: "select", options: st.departments.map(x => [x.id, x.name]) },
      { k: "reporting_manager_id", label: "Reporting manager", type: "select", options: d.items.filter(x => !it || x.id !== it.id).map(x => [x.id, x.full_name]) },
      { k: "joined_on", label: "Joined on", type: "date" }, { k: "status", label: "Status", type: "select", required: true, options: [["active", "Active"], ["inactive", "Inactive (left the company)"]], value: "active", hint: it && it.user_id ? "Inactive switches off this person's login for the company immediately. Setting Active again restores it." : "" },
      { k: "responsibilities", label: "Responsibilities", type: "textarea", rows: 4 }],
    bindActions: (root, items) => $$("[data-inv]", root).forEach(b => b.addEventListener("click", async () => { const x = items.find(i => i.id === b.closest("tr").dataset.id);
      if(!x.email) return toast("Add the employee's email first.", "bad");
      if(!await confirmBox(`Invite ${x.full_name} (${x.email}) to the Employee Portal? New people get an email to set their password; people who already use CFF see the invitation when they log in.`, { ok: "Invite" })) return;
      try{ const r = await CFF.api.c.post("/employees/" + x.id + "/invite"); toast(r.emailSent ? "Invitation emailed to " + x.email + ". It's valid for 14 days." : r.hasAccount ? "Invitation sent. They'll see it when they log in." : "Invitation created. Ask them to create an account with " + x.email + "."); CFF.render(); }catch(e){ toast(e.message, "bad"); } })) });
}});

/* ---------- SOPs, policies, training, announcements ---------- */
CFF.route("people/content", { title: "SOPs, policies & training", perm: ["content.manage"], alt: "resources/sops", async render(el, p, q){
  const [d, st] = await Promise.all([CFF.api.c.get("/content"), CFF.api.c.get("/structure").catch(() => ({ departments: [] }))]);
  let kind = q.kind || "all";
  const dName = Object.fromEntries(st.departments.map(x => [x.id, x.name]));
  const fields = [{ k: "kind", label: "Type", type: "select", required: true, options: CATALOGS.CONTENT_KINDS, value: "sop" }, { k: "title", label: "Title", required: true },
    { k: "department_id", label: "Department (optional)", type: "select", options: st.departments.map(x => [x.id, x.name]), blank: "Everyone" },
    { k: "requires_ack", label: "Ask people to confirm “I have read and understood”", type: "checkbox", full: true },
    { k: "body", label: "Text", type: "textarea", rows: 10, max: 30000 }];
  el.innerHTML = CFF.pageHead({ label: "Stage 12 · People", title: "SOPs, policies & training", lead: "Standard operating procedures, policies, training material and announcements for your team.",
    actions: d.canManage ? `<button class="btn sm" id="addC">${I.plus} New</button>` : "" }) + tabs([["all", "All"], ...CATALOGS.CONTENT_KINDS], kind) + `<div id="cBody"></div>`;
  const draw = () => {
    const list = d.items.filter(x => kind === "all" || x.kind === kind);
    $("#cBody").innerHTML = list.length ? `<div class="stack" style="gap:12px">${list.map(x => `<article class="card content-item" data-id="${esc(x.id)}"><div class="row" style="justify-content:space-between"><div class="stack" style="gap:2px;min-width:0"><span class="label">${esc(KIND[x.kind])}${x.department_id ? " · " + esc(dName[x.department_id] || "") : ""}</span><h3>${esc(x.title)}</h3></div>
      <div class="row">${x.requires_ack ? (x.acknowledged ? pill("Read and understood", "good") : `<button class="btn sm" data-ack>I have read and understood</button>`) : ""}${d.canManage ? `${x.requires_ack ? `<button class="btn quiet sm" data-acks>${x.ack_count || 0} confirmed</button>` : ""}<button class="icon-btn" data-edit aria-label="Edit">${I.edit}</button><button class="icon-btn" data-arch aria-label="Archive">${I.archive}</button>` : ""}</div></div>
      <details><summary class="muted small">Read · published ${esc(ago(x.published_at))}</summary><div class="prose content-body">${nl(x.body)}</div></details></article>`).join("")}</div>`
      : `<section class="card">${empty("Nothing here yet", d.canManage ? "Publish SOPs, policies, training and announcements for your team." : "")}</section>`;
    const find = b => d.items.find(x => x.id === b.closest("[data-id]").dataset.id);
    $$("[data-ack]").forEach(b => b.addEventListener("click", async () => { try{ await CFF.api.c.post("/content/items/" + find(b).id + "/acknowledge"); toast("Thank you. Your confirmation is recorded."); CFF.render(); }catch(e){ toast(e.message, "bad"); } }));
    $$("[data-acks]").forEach(b => b.addEventListener("click", async () => { const x = find(b); const r = await CFF.api.c.get("/content/items/" + x.id + "/acknowledgements");
      modal({ title: "Who has confirmed · " + x.title, body: table(["Name", "Role", "Confirmed"], r.people.map(pp => [esc(pp.name), esc(CATALOGS.ROLE_LABEL[pp.role] || pp.role), pp.acknowledged_at ? pill(fmtDate(pp.acknowledged_at), "good") : pill("Not yet")])) }); }));
    $$("[data-edit]").forEach(b => b.addEventListener("click", () => { const x = find(b); formModal({ title: "Edit", wide: true, fields, values: x, save: v => CFF.api.c.patch("/content/items/" + x.id, v) }).then(r => { if(r){ toast("Saved."); CFF.render(); } }); }));
    $$("[data-arch]").forEach(b => b.addEventListener("click", async () => { if(!await confirmBox("Archive this item? It will no longer be shown to employees.", { ok: "Archive" })) return; await CFF.api.c.post("/content/items/" + find(b).id + "/archive").catch(e => toast(e.message, "bad")); CFF.render(); }));
  };
  onTabs(el, k => { kind = k; draw(); });
  const ac = $("#addC"); if(ac) ac.addEventListener("click", () => formModal({ title: "New SOP, policy, training or announcement", wide: true, fields, values: { kind: kind === "all" ? "sop" : kind, requires_ack: true }, save: v => CFF.api.c.post("/content/items", v) }).then(r => { if(r){ toast("Published. Your team has been notified."); CFF.render(); } }));
  draw();
  CFF.ai.page({ label: "SOPs, policies & training", suggestions: ["Draft an SOP for handling customer complaints", "Write a short leave policy for a small company", "Create a 1-week onboarding plan"], context: () => "CURRENT PAGE: SOPs, policies, training and announcements. Existing: " + d.items.map(x => KIND[x.kind] + ": " + x.title).join("; ") });
}});

/* ---------- Employee Portal ---------- */
CFF.route("employee", { title: "My dashboard", async render(el){
  const d = await CFF.api.c.get("/overview");
  const c = d.company, me = d.me;
  const K = kind => d.content.filter(x => x.kind === kind);
  const item = x => `<article class="ci" data-id="${esc(x.id)}"><div class="row" style="justify-content:space-between"><b>${esc(x.title)}</b>${x.requires_ack ? (x.acknowledged ? pill("Read and understood", "good") : `<button class="btn sm" data-ack>I have read and understood</button>`) : ""}</div>
    <details><summary class="muted small">Read · ${esc(ago(x.published_at))}</summary><div class="prose content-body">${nl(x.body)}</div></details></article>`;
  const RES_LINK = { SOPs: "sops", Policies: "policies", Training: "training", Announcements: "announcements" };
  const sec = (title, list, emptyText) => `<section class="card stack"><div class="row" style="justify-content:space-between"><h2>${title}</h2>${list.length > 3 ? `<a class="link small" href="#/resources/${RES_LINK[title]}">See all ${list.length}</a>` : ""}</div>${list.length ? list.slice(0, 3).map(item).join("") : `<p class="muted">${emptyText}</p>`}</section>`;
  const pr = d.progress;
  el.innerHTML = `<section class="card hero emp-hero"><div class="stack" style="gap:8px;min-width:0"><span class="label">Employee Portal · ${esc(c.name)}</span><h1>Hello, ${esc((me.name || "").split(" ")[0])}</h1>
      <p class="lens">${esc(me.designation || CATALOGS.ROLE_LABEL[me.role] || "")}${me.department ? " · " + esc(me.department) : ""}${me.manager ? " · reports to " + esc(me.manager.full_name) : ""}</p></div>
    <div class="kpis3"><div><b class="num">${pr.tasks_done}/${pr.tasks_total}</b><span>tasks done</span></div><div><b class="num">${pr.acks_done}/${pr.acks_total}</b><span>documents confirmed</span></div></div></section>
    <div class="dash-grid">
      <section class="card stack span2"><h2>Company overview</h2>${c.source ? "" : `<p class="muted small">The founders haven't approved the company profile yet.</p>`}
        <div class="ov-grid">${[["Vision", c.vision], ["Mission", c.mission], ["Purpose", c.purpose]].map(([t, x]) => `<div class="stack" style="gap:4px"><span class="label">${t}</span><p>${x ? nl(x) : '<span class="muted">Not approved yet.</span>'}</p></div>`).join("")}</div>
        ${c.story ? `<details><summary><b>Company story</b></summary><p>${nl(c.story)}</p></details>` : ""}</section>
      <section class="card stack span2"><h2>Our values</h2>${d.values.length ? `<div class="val-grid">${d.values.map(v => `<div class="val-card"><b>${esc(v.name)}</b>${v.meaning ? `<p>${esc(v.meaning)}</p>` : ""}${v.expected_behavior ? `<p class="muted small"><b>In practice:</b> ${esc(v.expected_behavior)}</p>` : ""}</div>`).join("")}</div>` : `<p class="muted">Company values will appear here once they are approved.</p>`}</section>
      <section class="card stack"><h2>My role</h2><dl class="kv"><dt>Name</dt><dd>${esc(me.name || "")}</dd><dt>Designation</dt><dd>${esc(me.designation || "—")}</dd><dt>Department</dt><dd>${esc(me.department || "—")}</dd><dt>Reporting manager</dt><dd>${me.manager ? esc(me.manager.full_name) + (me.manager.designation ? ` <span class="muted small">(${esc(me.manager.designation)})</span>` : "") : "—"}</dd>
        <dt>Joining date</dt><dd>${me.joined_on ? esc(fmtDate(me.joined_on)) : "—"}</dd></dl><h3>My responsibilities</h3><p>${me.responsibilities ? nl(me.responsibilities) : '<span class="muted">Not written yet.</span>'}</p></section>
      <section class="card stack"><h2>My team${me.department ? " · " + esc(me.department) : ""}</h2>${(d.team || []).length ? `<div class="mini-list">${d.team.map(t => `<div class="li"><span class="avatar">${esc(CFF.util.initials(t.name))}</span><span class="stack" style="gap:2px;min-width:0"><b>${esc(t.name)}</b><span class="muted small">${esc(t.designation || "")}</span></span></div>`).join("")}</div>` : `<p class="muted">${me.department ? "No other colleagues in your department yet." : "You haven't been placed in a department yet."}</p>`}</section>
      <section class="card stack"><div class="row" style="justify-content:space-between"><h2>My tasks</h2><a class="link small" href="#/my/tasks">All my tasks</a></div>
        ${d.tasks.length ? `<div class="mini-list">${d.tasks.slice(0, 8).map(t => `<div class="task-row" data-id="${esc(t.id)}"><div class="stack" style="gap:2px;min-width:0"><b>${esc(t.title)}</b><span class="muted small">${t.due_date ? "Due " + esc(fmtDate(t.due_date)) + " · " : ""}${esc(opt(CATALOGS.TASK_STATUSES)[t.status])}</span>${bar(t.progress)}</div><button class="btn secondary sm" data-prog>Update</button></div>`).join("")}</div>` : `<p class="muted">No tasks assigned to you.</p>`}</section>
      <section class="card stack span2"><div class="row" style="justify-content:space-between"><h2>My KPIs</h2><a class="link small" href="#/my/kpis">Details</a></div>${d.kpis.length ? table(["KPI", "Target", "Latest", "Status"], d.kpis.map(k => [esc(k.name), esc((k.target ?? "—") + (k.unit ? " " + k.unit : "")), k.latest ? esc(k.latest.period + ": " + (k.latest.actual ?? "—")) : "No data", k.latest && k.latest.status ? lblPill([["on_track", "On track"], ["at_risk", "At risk"], ["off_track", "Off track"]], k.latest.status) : ""])) : `<p class="muted">No personal KPIs yet.</p>`}</section>
      ${sec("Announcements", K("announcement"), "No announcements.")}
      ${sec("SOPs", K("sop"), "No SOPs yet.")}
      ${sec("Policies", K("policy"), "No policies yet.")}
      ${sec("Training", K("training"), "No training yet.")}
      <section class="card stack span2"><div class="row" style="justify-content:space-between"><h2>Documents</h2><a class="link small" href="#/resources/documents">All documents</a></div>${d.documents.length ? `<div class="mini-list">${d.documents.map(x => `<button class="li doc-li" data-doc="${esc(x.id)}" data-n="${esc(x.name)}">${I.file}<span class="stack" style="gap:2px;text-align:left;min-width:0"><b>${esc(x.name)}</b><span class="muted small">${esc(opt(CATALOGS.DOC_CATEGORIES)[x.category] || "")}</span></span>${I.download}</button>`).join("")}</div>` : `<p class="muted">No shared documents.</p>`}</section>
      <section class="card stack"><h2>My values</h2><p class="muted">Take the CFF Values Discovery Assessment to see what matters most to you and how it connects with the company's values.</p><a class="btn secondary" href="#/values">${I.sparkle} Open my values assessment</a></section>
      ${S.can("ai.use") ? `<section class="card stack"><h2>AI help</h2><p class="muted">Ask about the company's vision and values, your responsibilities, an SOP or how to approach a task.</p><button class="btn" data-ai-ask="Explain how my role connects with our company's vision and values.">${I.sparkle} Ask the AI assistant</button></section>` : ""}
    </div>`;
  $$("[data-ack]", el).forEach(b => b.addEventListener("click", async () => { try{ await CFF.api.c.post("/content/items/" + b.closest("[data-id]").dataset.id + "/acknowledge"); toast("Thank you. Your confirmation is recorded."); CFF.render(); }catch(e){ toast(e.message, "bad"); } }));
  $$("[data-prog]", el).forEach(b => b.addEventListener("click", () => CFF.taskProgress(d.tasks.find(t => t.id === b.closest("[data-id]").dataset.id))));
  $$("[data-doc]", el).forEach(b => b.addEventListener("click", () => CFF.openDocument(b.dataset.doc, true, b.dataset.n)));
  CFF.ai.page({ label: "Employee Portal", suggestions: ["Explain our company's vision in simple words", "How do our values apply to my work?", "Help me plan my tasks for this week"],
    context: () => `CURRENT PAGE: Employee Portal. The person is an employee (not a founder).\nCompany: ${c.name}. Vision: ${c.vision}. Mission: ${c.mission}. Purpose: ${c.purpose}.\nValues: ${d.values.map(v => v.name + ": " + v.meaning).join("; ")}\nMy designation: ${me.designation}. Department: ${me.department}. Responsibilities: ${CFF.util.cut(me.responsibilities, 800)}\nMy tasks: ${d.tasks.map(t => t.title + " (" + t.status + ")").join("; ")}\nSOPs/policies: ${d.content.map(x => x.title).join("; ")}` });
}});
})();
