// Manager (operations) and HR dashboards. Built from GET /team, which only returns the blocks
// the person's permissions allow, plus the approved company overview everyone may read.
(function(){
"use strict";
const CFF = window.CFF;
const { $, esc, I, pill, bar, fmtDate, ago, nl, empty, notice } = CFF.util;
const S = CFF.state;

CFF.route("team", { title: "Dashboard", async render(el){
  const [d, ov] = await Promise.all([CFF.api.c.get("/team"), CFF.api.c.get("/overview")]);
  const hr = d.experience === "hr";
  const c = ov.company, me = ov.me;
  const name = (S.me.profile.full_name || "").split(" ")[0];
  const card = (title, body, link, linkLabel) => `<section class="card stack"><div class="row" style="justify-content:space-between"><h2>${title}</h2>${link ? `<a class="link small" href="#/${link}">${esc(linkLabel || "Open")}</a>` : ""}</div>${body}</section>`;
  const blocks = [];
  // People (HR first)
  if(d.people) blocks.push(card("People", `<div class="kpis3"><div><b class="num">${d.people.employees}</b><span>employees</span></div><div class="${d.people.withoutLogin ? "warn" : ""}"><b class="num">${d.people.withoutLogin}</b><span>without a login</span></div>
      ${d.people.invitations != null ? `<div><b class="num">${d.people.invitations}</b><span>pending invitations</span></div>` : ""}</div>
    ${d.people.departments.length ? `<div class="chips">${d.people.departments.map(x => `<span class="chipf static">${esc(x.name)} <span class="c">${x.count}</span></span>`).join("")}</div>` : `<p class="muted small">No departments yet.</p>`}
    ${d.people.recent.length ? `<h3>Recently joined</h3><div class="mini-list">${d.people.recent.map(x => `<div><b>${esc(x.name)}</b><span class="muted small">${esc([x.designation, x.department, x.joined_on && "joined " + fmtDate(x.joined_on)].filter(Boolean).join(" · "))}</span></div>`).join("")}</div>` : ""}`, "people/employees", "Employees"));
  if(d.content) blocks.push(card("Onboarding, SOPs & policies", d.content.needingAck.length ? `<p class="muted small">Items people must confirm (“I have read and understood”):</p><div class="mini-list">${d.content.needingAck.map(x => `<div><b>${esc(x.title)}</b><span class="row small">${bar(x.of ? x.acks / x.of * 100 : 0)}<span class="num">${x.acks}/${x.of}</span></span></div>`).join("")}</div>`
    : `<p class="muted">${d.content.items ? d.content.items + " published items. None need confirmation." : "Nothing published yet. Add SOPs, policies, training and announcements."}</p>`, "people/content", "Manage content"));
  if(d.teamTasks){ const t = d.teamTasks; blocks.push(card("Team tasks", `<div class="kpis3 four"><a href="#/execution/tasks?tab=today"><b class="num">${t.today}</b><span>today</span></a><a href="#/execution/tasks?tab=upcoming"><b class="num">${t.upcoming}</b><span>next 7 days</span></a>
      <a href="#/execution/tasks?tab=overdue" class="${t.overdue ? "bad" : ""}"><b class="num">${t.overdue}</b><span>overdue</span></a><a href="#/execution/tasks"><b class="num">${t.open}</b><span>open</span></a></div>
    ${t.list.length ? `<div class="mini-list">${t.list.map(x => `<div><b>${esc(x.title)}</b><span class="muted small">${x.due_date ? (x.due_date < CFF.util.today() ? "Overdue · " : "Due ") + esc(fmtDate(x.due_date)) : "No due date"}${x.assignee ? " · " + esc(x.assignee) : ""}</span></div>`).join("")}</div>` : ""}`, "execution/tasks", "All tasks")); }
  if(d.plans) blocks.push(card("Plans & milestones", `<div class="kpis3"><div><b class="num">${d.plans.open}</b><span>open items</span></div><div class="${d.plans.blocked ? "bad" : ""}"><b class="num">${d.plans.blocked}</b><span>blocked</span></div><div class="${d.plans.overdue ? "warn" : ""}"><b class="num">${d.plans.overdue}</b><span>past deadline</span></div></div>
    ${d.plans.milestones.length ? `<div class="mini-list">${d.plans.milestones.map(m => `<div><b>${esc(m.title)}</b><span class="muted small">${m.deadline ? esc(fmtDate(m.deadline)) + " · " : ""}${m.progress}%</span></div>`).join("")}</div>` : ""}`, "execution/plans", "Plans"));
  if(d.kpis) blocks.push(card("KPIs", d.kpis.total ? `<div class="kpis3 four"><div><b class="num">${d.kpis.on_track}</b><span>on track</span></div><div><b class="num">${d.kpis.at_risk}</b><span>at risk</span></div><div class="${d.kpis.off_track ? "bad" : ""}"><b class="num">${d.kpis.off_track}</b><span>off track</span></div><div><b class="num">${d.kpis.no_data}</b><span>no data</span></div></div>
    <div class="mini-list">${d.kpis.items.map(k => `<div><b>${esc(k.name)}</b><span class="muted small">${esc(k.department || "")}${k.latest ? (k.department ? " · " : "") + esc(k.latest.period) + ": " + esc(k.latest.actual ?? "—") + " " + esc(k.unit || "") : ""}</span></div>`).join("")}</div>` : `<p class="muted">No KPIs yet.</p>`, "execution/kpis", "KPIs & reviews"));
  if(d.compliance) blocks.push(card("Compliance", `<p>${d.compliance.done} of ${d.compliance.required} required items approved.</p>${d.compliance.dueSoon.length ? `<div class="mini-list">${d.compliance.dueSoon.map(x => `<div><b>${esc(x.name)}</b><span class="muted small">${esc(fmtDate(x.due_date || x.renewal_date))}</span></div>`).join("")}</div>` : ""}`, "compliance/registration", "Compliance"));
  if(d.activity) blocks.push(card("Recent activity", d.activity.length ? `<div class="activity">${d.activity.map(a => `<div class="act"><span class="avatar xs">${esc(CFF.util.initials(a.actor_name))}</span><span><b>${esc(a.actor_name || "System")}</b> ${esc(a.action)} ${esc(a.entity)}${a.summary ? ": " + esc(CFF.util.cut(a.summary, 60)) : ""}</span><small class="muted">${esc(ago(a.created_at))}</small></div>`).join("")}</div>` : `<p class="muted">No activity yet.</p>`, "activity", "All activity"));
  const quick = [
    hr && S.can("employees.manage") && ["people/employees", "Add an employee", "users"],
    hr && S.can("content.manage") && ["people/content", "Publish an SOP or policy", "file"],
    !hr && S.can("tasks.edit") && ["execution/tasks?new=1", "Assign a task", "check"],
    !hr && S.can("kpis.edit") && ["execution/kpis", "Record KPI results", "chart"],
    ["my/tasks", "My tasks", "clock"]
  ].filter(Boolean);
  el.innerHTML = `<section class="card hero"><div class="stack" style="gap:8px;min-width:0"><span class="label">${esc(CATALOGS.EXPERIENCE_LABEL[d.experience] || "")} · ${esc(d.company.name)}</span><h1>Hello, ${esc(name || "there")}</h1>
      <p class="lens">${esc(me.designation || CATALOGS.ROLE_LABEL[d.role] || "")}${me.department ? " · " + esc(me.department) : ""}</p>
      <div class="quick">${quick.map(([h, l, ic]) => `<a class="btn secondary" href="#/${h}">${I[ic] || ""}<span>${esc(l)}</span></a>`).join("")}</div></div>
      ${d.myTasks ? `<div class="kpis3" style="min-width:200px;grid-template-columns:1fr"><a href="#/my/tasks"><b class="num">${d.myTasks.length}</b><span>my open tasks</span></a></div>` : ""}</section>
    <section class="card stack"><h2>Company overview</h2>${c.source ? "" : `<p class="muted small">Shown once the founders approve the company profile.</p>`}
      <div class="ov-grid">${[["Vision", c.vision], ["Mission", c.mission], ["Purpose", c.purpose]].map(([t, x]) => `<div class="stack" style="gap:4px"><span class="label">${t}</span><p>${x ? nl(x) : '<span class="muted">Not approved yet.</span>'}</p></div>`).join("")}</div>
      ${ov.values.length ? `<div class="chips">${ov.values.map(v => `<span class="chipf static">${esc(v.name)}</span>`).join("")}</div>` : ""}</section>
    ${blocks.length ? `<div class="dash-grid">${blocks.join("")}</div>` : notice("Your role doesn't include any management areas yet. Ask the company owner to give your role the permissions you need.")}`;
  CFF.ai.page({ label: hr ? "HR dashboard" : "Operations dashboard", suggestions: hr ? ["Draft a 1-week onboarding plan", "Write a simple leave policy", "What should our employee handbook include?"] : ["Which tasks need attention first?", "How can we fix off-track KPIs?", "Plan next week for my team"],
    context: () => "CURRENT PAGE: " + (hr ? "HR" : "Manager / operations") + " dashboard.\nVision: " + (c.vision || "") + "\n" + (d.teamTasks ? "Team tasks: " + d.teamTasks.open + " open, " + d.teamTasks.overdue + " overdue.\n" : "") +
      (d.kpis ? "KPIs: " + d.kpis.on_track + " on track, " + d.kpis.at_risk + " at risk, " + d.kpis.off_track + " off track.\n" : "") + (d.people ? "Employees: " + d.people.employees + ".\n" : "") });
}});
})();
