// CFF EXECUTION: structured plans (Stage 10) in Kanban / Table / Timeline views, milestones,
// company tasks (Today / Upcoming / Overdue / Completed) and AI plan suggestions (reviewed before adding).
(function(){
"use strict";
const CFF = window.CFF;
const { $, $$, esc, I, toast, notice, empty, pill, lblPill, formModal, confirmBox, opt, fmtDate, today, addDays, table, tabs, onTabs, store, bar, modal, nl } = CFF.util;
const S = CFF.state;
const PT = opt(CATALOGS.PLAN_TYPES), PST = opt(CATALOGS.PLAN_STATUSES), TST = opt(CATALOGS.TASK_STATUSES), PR = opt(CATALOGS.PRIORITIES);
const prTone = { critical: "bad", high: "warn", medium: "info", low: "" };

function planFields(members){ return [
  { k: "plan", label: "Plan", type: "select", required: true, options: CATALOGS.PLAN_TYPES }, { k: "title", label: "Title", required: true, maxlength: 200 },
  { k: "description", label: "Description", type: "textarea", rows: 3 }, { k: "category", label: "Category" },
  { k: "owner_member_id", label: "Owner", type: "select", options: members.map(m => [m.id, m.display_name]) }, { k: "owner_name", label: "Owner (if not a member)" },
  { k: "priority", label: "Priority", type: "select", required: true, options: CATALOGS.PRIORITIES, value: "medium" }, { k: "status", label: "Status", type: "select", required: true, options: CATALOGS.PLAN_STATUSES, value: "not_started" },
  { k: "start_date", label: "Start date", type: "date" }, { k: "deadline", label: "Deadline", type: "date" },
  { k: "progress", label: "Progress %", type: "number", min: 0, max: 100, value: 0 }, { k: "dependencies", label: "Dependencies", type: "textarea", rows: 2 }, { k: "notes", label: "Notes", type: "textarea", rows: 2 }]; }

async function members(){ if(!CFF.cache.members || CFF.cache.membersFor !== S.companyId){ const d = await CFF.api.c.get("/members").catch(() => ({ members: [] })); CFF.cache.members = d.members; CFF.cache.membersFor = S.companyId; } return CFF.cache.members; }

function plansPage(milestones){ return async (el, p, q) => {
  const [d, ms] = await Promise.all([CFF.api.c.get("/plans"), members()]);
  const canEdit = S.can("plans.edit");
  const mName = Object.fromEntries(ms.map(m => [m.id, m.display_name]));
  let plan = milestones ? "milestones" : (q.plan || store.get("cff:plan") || "all");
  let view = store.get("cff:plan-view") || "kanban";
  el.innerHTML = CFF.pageHead({ label: milestones ? "Execution · Milestones" : "Stage 10 · Company Planning", title: milestones ? "Milestones" : "Plans", crumbs: S.can("cff.view") ? [["#/cff/10", "Stage 10"], [null, milestones ? "Milestones" : "Plans"]] : null,
    lead: milestones ? "Key milestones on the way to your vision, with owners and deadlines." : "Structured plans instead of text: launch, first customers, marketing, sales, operations, finance, hiring, growth, risk, milestones and the stage-wise execution plan.",
    actions: `${canEdit && S.can("ai.use") ? `<button class="btn secondary sm" id="aiPlan">${I.sparkle} Suggest items with AI</button>` : ""}${canEdit ? `<button class="btn sm" id="addItem">${I.plus} Add item</button>` : ""}` }) + `
    <div class="toolbar">${milestones ? "" : `<label class="sr-only" for="planSel">Plan</label><select class="input sm" id="planSel"><option value="all">All plans</option>${CATALOGS.PLAN_TYPES.map(([k, l]) => `<option value="${k}" ${plan === k ? "selected" : ""}>${esc(l)} (${d.items.filter(x => x.plan === k).length})</option>`).join("")}</select>`}
      ${tabs([["kanban", "Kanban"], ["table", "Table"], ["timeline", "Timeline"]], view, "data-view")}</div>
    <div id="planBody"></div>`;
  const items = () => d.items.filter(x => plan === "all" || x.plan === plan);
  const edit = it => formModal({ title: it ? "Edit plan item" : "Add plan item", wide: true, fields: planFields(ms), values: it || { plan: plan === "all" ? "launch" : plan },
    save: v => it ? CFF.api.c.patch("/plans/" + it.id, v) : CFF.api.c.post("/plans", v),
    extraActions: it && canEdit ? [{ label: "Delete", kind: "danger", run: async () => { if(!await confirmBox("Delete this plan item?", { ok: "Delete", danger: true })) return false; await CFF.api.c.del("/plans/" + it.id); return "deleted"; } }] : [] })
    .then(r => { if(r){ toast(r === "deleted" ? "Deleted." : "Saved."); CFF.render(); } });
  const draw = () => {
    const list = items(), b = $("#planBody");
    if(!list.length){ b.innerHTML = `<section class="card">${empty("No items yet", milestones ? "Add milestones such as “First paying customer” or “Company registered”." : "Add items to this plan, or let the AI suggest some for you to review.")}</section>`; return; }
    if(view === "kanban"){
      b.innerHTML = `<div class="kanban">${CATALOGS.PLAN_STATUSES.map(([k, l]) => { const col = list.filter(x => x.status === k); return `<section class="kcol" aria-label="${esc(l)}"><h3>${esc(l)} <span class="muted">${col.length}</span></h3>
        ${col.map(x => `<article class="kcard" data-id="${esc(x.id)}"><button class="kc-title" data-open>${esc(x.title)}</button><span class="muted small">${esc(PT[x.plan])}</span>
          <div class="row small">${pill(PR[x.priority], prTone[x.priority])}${x.deadline ? `<span class="${x.deadline < today() && !["completed", "cancelled"].includes(x.status) ? "bad-t" : "muted"}">${esc(fmtDate(x.deadline))}</span>` : ""}</div>
          ${bar(x.progress)}${canEdit ? `<label class="sr-only" for="mv-${x.id}">Move</label><select class="input xs" id="mv-${x.id}" data-move>${CATALOGS.PLAN_STATUSES.map(([sk, sl]) => `<option value="${sk}" ${sk === x.status ? "selected" : ""}>${esc(sl)}</option>`).join("")}</select>` : ""}</article>`).join("")}</section>`; }).join("")}</div>`;
    } else if(view === "table"){
      b.innerHTML = `<section class="card flush">${table(["Item", "Plan", "Owner", "Priority", "Start", "Deadline", "Status", "Progress"], list.map(x => ({ attrs: `data-id="${esc(x.id)}"`, cells: [
        `<button class="link" data-open>${esc(x.title)}</button>`, esc(PT[x.plan]), esc(mName[x.owner_member_id] || x.owner_name || ""), pill(PR[x.priority], prTone[x.priority]), esc(fmtDate(x.start_date)), esc(fmtDate(x.deadline)), lblPill(CATALOGS.PLAN_STATUSES, x.status), `<span class="row nowrap">${bar(x.progress)}<span class="num small">${x.progress}%</span></span>`] })))}</section>`;
    } else {
      const dated = list.filter(x => x.start_date || x.deadline);
      if(!dated.length){ b.innerHTML = `<section class="card">${empty("No dates yet", "Add start dates and deadlines to see the timeline.")}</section>`; return; }
      const days = s => new Date(s + "T00:00:00").getTime() / 864e5;
      const min = Math.min(...dated.map(x => days(x.start_date || x.deadline))), max = Math.max(...dated.map(x => days(x.deadline || x.start_date))) + 1;
      const span = Math.max(1, max - min), pos = s => ((days(s) - min) / span * 100);
      const months = []; const d0 = new Date(min * 864e5); d0.setDate(1); for(let m = new Date(d0); m.getTime() / 864e5 <= max; m.setMonth(m.getMonth() + 1)) months.push(new Date(m));
      const todayPos = pos(today());
      b.innerHTML = `<section class="card timeline-card"><div class="tl"><div class="tl-scale">${months.map(m => { const iso = m.toISOString().slice(0, 10); const l = Math.max(0, pos(iso)); return l <= 100 ? `<span style="left:${l}%">${m.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })}</span>` : ""; }).join("")}</div>
        ${dated.sort((a, c) => (a.start_date || a.deadline).localeCompare(c.start_date || c.deadline)).map(x => { const s = x.start_date || x.deadline, e = x.deadline || x.start_date; const l = pos(s), w = Math.max(1.5, pos(e) - l + 100 / span);
          return `<div class="tl-row" data-id="${esc(x.id)}"><button class="tl-label link" data-open>${esc(x.title)}</button><div class="tl-track">${todayPos >= 0 && todayPos <= 100 ? `<i class="tl-today" style="left:${todayPos}%"></i>` : ""}<span class="tl-bar ${x.status}" style="left:${l}%;width:${Math.min(100 - l, w)}%" title="${esc(fmtDate(s))} – ${esc(fmtDate(e))} · ${esc(PST[x.status])}"><i style="width:${x.progress}%"></i></span></div></div>`; }).join("")}</div>
        <p class="muted small">Bars run from start date to deadline; the darker part shows progress. The vertical line is today.</p></section>`;
    }
    $$("[data-open]", b).forEach(x => x.addEventListener("click", () => edit(d.items.find(i => i.id === x.closest("[data-id]").dataset.id))));
    $$("[data-move]", b).forEach(s => s.addEventListener("change", async () => { const id = s.closest("[data-id]").dataset.id;
      try{ const r = await CFF.api.c.patch("/plans/" + id, { status: s.value }); Object.assign(d.items.find(i => i.id === id), r.item); draw(); toast("Moved to " + PST[s.value] + "."); }catch(e){ toast(e.message, "bad"); } }));
  };
  const ps = $("#planSel"); if(ps) ps.addEventListener("change", () => { plan = ps.value; store.set("cff:plan", plan); draw(); });
  onTabs(el, v => { view = v; store.set("cff:plan-view", v); draw(); }, "data-view");
  const ai = $("#addItem"); if(ai) ai.addEventListener("click", () => edit(null));
  const ap = $("#aiPlan"); if(ap) ap.addEventListener("click", () => suggest(plan === "all" ? "launch" : plan));
  draw();
  CFF.ai.page({ label: milestones ? "Milestones" : "Plans (Stage 10)", suggestions: ["What's missing from our plans?", "Which items are at risk?", "Suggest a first-customer strategy"],
    context: () => "CURRENT PAGE: " + (milestones ? "Milestones" : "Plans (Stage 10), showing " + (plan === "all" ? "all plans" : PT[plan])) + ".\n" + items().slice(0, 60).map(x => "- [" + PT[x.plan] + "] " + x.title + " · " + PST[x.status] + " · " + x.progress + "%" + (x.deadline ? " · due " + x.deadline : "")).join("\n") });
}; }
async function suggest(plan){
  let ctl = new AbortController(), text = "";
  const r = await modal({ title: "AI suggestions · " + PT[plan], wide: true, body: `<div class="field"><label for="sgPlan">Plan</label><select class="input" id="sgPlan">${CATALOGS.PLAN_TYPES.map(([k, l]) => `<option value="${k}" ${k === plan ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
      <div id="sgBody" class="stack"><p class="muted">The AI suggests items based on your CFF answers. Nothing is added until you choose.</p></div>`,
    onOpen: d => {
      const run = async () => { ctl.abort(); ctl = new AbortController(); const box = $("#sgBody", d); box.innerHTML = `<div class="ai-thinking"><span></span><span></span><span></span> Thinking…</div>`;
        try{ text = await CFF.ai.generate("plan_suggestions", { plan: $("#sgPlan", d).value }, null, ctl.signal);
          const m = /\[[\s\S]*\]/.exec(text); const list = m ? JSON.parse(m[0]) : [];
          if(!Array.isArray(list) || !list.length) throw new Error("The AI didn't return suggestions. Try again.");
          box.innerHTML = `<p class="muted small">Tick the items to add. You can edit them afterwards.</p>` + list.slice(0, 12).map((x, i) => `<label class="sg-item"><input type="checkbox" data-sg="${i}" checked><span><b>${esc(x.title || "")}</b><span class="muted small">${esc(x.description || "")}</span>${pill(PR[x.priority] || "Medium", prTone[x.priority])}</span></label>`).join("");
          box.dataset.list = JSON.stringify(list.slice(0, 12));
        }catch(e){ if(e.name !== "AbortError") box.innerHTML = notice(esc(e.message.includes("JSON") ? "The AI answer couldn't be read. Try again." : e.message), "bad"); } };
      $("#sgPlan", d).addEventListener("change", run); run();
    },
    actions: [{ label: "Cancel", value: null, kind: "secondary" }, { label: "Add selected items", submit: true, run: async d => {
      const box = $("#sgBody", d); if(!box.dataset.list) throw new Error("Wait for the suggestions first.");
      const list = JSON.parse(box.dataset.list); const pick = $$("[data-sg]", box).filter(c => c.checked).map(c => list[+c.dataset.sg]);
      if(!pick.length) throw new Error("Tick at least one item.");
      const planKey = $("#sgPlan", d).value;
      return CFF.api.c.post("/plans/bulk", { items: pick.map(x => ({ plan: planKey, title: String(x.title || "").slice(0, 200), description: String(x.description || "").slice(0, 4000), priority: PR[x.priority] ? x.priority : "medium" })) });
    } }] });
  ctl.abort();
  if(r){ toast(r.items.length + " item" + (r.items.length > 1 ? "s" : "") + " added."); CFF.render(); }
}
CFF.route("execution/plans", { title: "Plans", perm: ["plans.view"], render: plansPage(false) });
CFF.route("execution/milestones", { title: "Milestones", perm: ["plans.view"], render: plansPage(true) });

/* ---------- tasks ---------- */
CFF.route("execution/tasks", { title: "Tasks", perm: ["tasks.view_all", "tasks.edit"], alt: "my/tasks", async render(el, p, q){
  const [d, ms, st] = await Promise.all([CFF.api.c.get("/tasks"), S.can("members.manage", "employees.manage", "employees.view", "tasks.view_all", "tasks.edit") ? members() : Promise.resolve([]), S.can("structure.view", "employees.view") ? CFF.api.c.get("/structure").catch(() => null) : null]);
  const canEdit = S.can("tasks.edit"), me = S.member && S.member.id;
  const mName = Object.fromEntries(ms.map(m => [m.id, m.display_name]));
  const depts = st ? st.departments : [];
  const dName = Object.fromEntries(depts.map(x => [x.id, x.name]));
  const docs = S.can("documents.view") ? (await CFF.api.c.get("/documents").catch(() => ({ documents: [] }))).documents : [];
  let tab = q.tab || "open", mine = !canEdit || q.mine === "1";
  const t0 = today(), t7 = addDays(t0, 7);
  const open = x => !["completed", "cancelled"].includes(x.status);
  const TABS = { open: x => open(x), today: x => open(x) && x.due_date === t0, upcoming: x => open(x) && x.due_date > t0 && x.due_date <= t7, overdue: x => open(x) && x.due_date && x.due_date < t0, completed: x => x.status === "completed", all: () => true };
  const fields = [
    { k: "title", label: "Task", required: true, full: true, maxlength: 200 }, { k: "stage", label: "CFF stage", type: "select", options: STAGES.map(s => [s.n, s.n + ". " + s.title]) },
    { k: "department_id", label: "Department", type: "select", options: depts.map(x => [x.id, x.name]) }, { k: "assigned_to", label: "Assigned to", type: "select", options: ms.map(m => [m.id, m.display_name]) },
    { k: "priority", label: "Priority", type: "select", required: true, options: CATALOGS.PRIORITIES, value: "medium" }, { k: "status", label: "Status", type: "select", required: true, options: CATALOGS.TASK_STATUSES, value: "not_started" },
    { k: "start_date", label: "Start date", type: "date" }, { k: "due_date", label: "Due date", type: "date" }, { k: "progress", label: "Progress %", type: "number", min: 0, max: 100, value: 0 },
    { k: "attachment_id", label: "Attachment (from Documents)", type: "select", options: docs.map(x => [x.id, x.name]) }, { k: "notes", label: "Notes", type: "textarea", rows: 3 }];
  el.innerHTML = CFF.pageHead({ label: "Execution", title: "Tasks", lead: canEdit ? "Company tasks with owners, due dates and progress. People see the tasks assigned to them." : "Your tasks. Update the status, progress and notes as you work.",
    actions: canEdit ? `<button class="btn sm" id="addTask">${I.plus} New task</button>` : "" }) + `
    <div class="toolbar">${tabs([["open", "Open"], ["today", "Today"], ["upcoming", "Upcoming"], ["overdue", "Overdue"], ["completed", "Completed"], ["all", "All"]].map(([k, l]) => [k, l + " (" + d.items.filter(x => TABS[k](x) && (!mine || x.assigned_to === me)).length + ")"]), tab)}
      ${canEdit ? `<label class="toggle"><input type="checkbox" id="mineOnly" ${mine ? "checked" : ""}> Only my tasks</label>` : ""}</div>
    <div id="taskBody"></div>`;
  const draw = () => {
    const list = d.items.filter(x => TABS[tab](x) && (!mine || x.assigned_to === me));
    $("#taskBody").innerHTML = `<section class="card flush">${table(["Task", "Stage", "Department", "Assigned to", "Priority", "Due", "Status", "Progress", ""], list.map(x => ({ attrs: `data-id="${esc(x.id)}"`, cells: [
      `<b>${esc(x.title)}</b>${x.notes ? `<span class="muted small block">${esc(CFF.util.cut(x.notes, 90))}</span>` : ""}`, x.stage ? "Stage " + x.stage : "", esc(dName[x.department_id] || ""), esc(mName[x.assigned_to] || "—"), pill(PR[x.priority], prTone[x.priority]),
      x.due_date ? `<span class="${open(x) && x.due_date < t0 ? "bad-t" : ""}">${esc(fmtDate(x.due_date))}</span>` : "", lblPill(CATALOGS.TASK_STATUSES, x.status), `<span class="row nowrap">${bar(x.progress)}<span class="num small">${x.progress}%</span></span>`,
      `<div class="row nowrap">${x.attachment_id ? `<button class="icon-btn" data-att aria-label="Open attachment">${I.file}</button>` : ""}${canEdit ? `<button class="icon-btn" data-edit aria-label="Edit">${I.edit}</button><button class="icon-btn" data-del aria-label="Delete">${I.trash}</button>` : x.assigned_to === me ? `<button class="btn secondary sm" data-prog>Update</button>` : ""}</div>`] })),
      { empty: `<div class="pad">${empty(tab === "overdue" ? "Nothing overdue" : "No tasks here", tab === "open" && canEdit ? "Create a task and assign it to someone." : "")}</div>` })}</section>`;
    const find = b => d.items.find(x => x.id === b.closest("[data-id]").dataset.id);
    $$("[data-edit]").forEach(b => b.addEventListener("click", () => { const it = find(b); formModal({ title: "Edit task", wide: true, fields, values: it, save: v => CFF.api.c.patch("/tasks/" + it.id, v) }).then(r => { if(r){ toast("Saved."); CFF.render(); } }); }));
    $$("[data-del]").forEach(b => b.addEventListener("click", async () => { const it = find(b); if(!await confirmBox("Delete “" + it.title + "”?", { ok: "Delete", danger: true })) return; await CFF.api.c.del("/tasks/" + it.id).catch(e => toast(e.message, "bad")); CFF.render(); }));
    $$("[data-prog]").forEach(b => b.addEventListener("click", () => progress(find(b))));
    $$("[data-att]").forEach(b => b.addEventListener("click", () => CFF.openDocument(find(b).attachment_id)));
  };
  onTabs(el, k => { tab = k; draw(); });
  const mo = $("#mineOnly"); if(mo) mo.addEventListener("change", () => { mine = mo.checked; draw(); });
  const at = $("#addTask"); if(at) at.addEventListener("click", () => formModal({ title: "New task", wide: true, fields, save: v => CFF.api.c.post("/tasks", v) }).then(r => { if(r){ toast("Task created."); CFF.render(); } }));
  draw();
  if(q.new === "1" && at) at.click();
  CFF.ai.page({ label: "Tasks", suggestions: ["Which tasks should we do first?", "Break a big task into smaller steps"], context: () => "CURRENT PAGE: Tasks.\n" + d.items.filter(open).slice(0, 50).map(x => "- " + x.title + " · " + TST[x.status] + (x.due_date ? " · due " + x.due_date : "") + (x.assigned_to ? " · " + (mName[x.assigned_to] || "") : "")).join("\n") });
}});
function progress(t){
  return formModal({ title: "Update: " + t.title, values: t, fields: [{ k: "status", label: "Status", type: "select", required: true, options: CATALOGS.TASK_STATUSES }, { k: "progress", label: "Progress %", type: "number", min: 0, max: 100 }, { k: "notes", label: "Notes", type: "textarea", rows: 3 }],
    save: v => CFF.api.c.patch("/tasks/" + t.id + "/progress", v) }).then(r => { if(r){ toast("Updated."); CFF.render(); } });
}
CFF.taskProgress = progress;
})();
