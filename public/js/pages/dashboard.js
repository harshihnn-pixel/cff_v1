// Founder / Company Builder dashboard: progress through the 13 stages, approvals, decisions,
// missing information, partners, registration, milestones, tasks, KPIs, activity and AI recommendations.
(function(){
"use strict";
const CFF = window.CFF;
const { $, esc, I, ring, bar, statusPill, pill, fmtDate, ago, notice, empty, lblPill } = CFF.util;
const S = CFF.state;

const warnList = list => list.map(w => `<a class="wlink ${w.level === "error" ? "bad" : w.level === "info" ? "info" : ""}" href="#/${esc(w.link)}">${w.level === "info" ? I.info : I.warn}<span>${esc(w.text)}</span>${I.chev}</a>`).join("");

// The owner's view of people and operations: headcount, departments, managers & HR, access and invitations.
// (Owners see this here; they don't need the separate Manager or HR dashboards.)
function peopleCard(tm){
  const p = tm.people, m = tm.members;
  const R = CATALOGS.ROLE_LABEL;
  const stat = (n, l, href, bad) => `<a href="${href}" class="${bad ? "bad" : ""}"><b class="num">${n}</b><span>${l}</span></a>`;
  return `<div class="row" style="justify-content:space-between"><h2 id="pph">People & HR overview</h2><div class="row">${S.can("employees.view") ? `<a class="link small" href="#/people/employees">Employees</a>` : ""}${S.can("members.manage") ? `<a class="link small" href="#/settings?tab=members">Members & access</a>` : ""}</div></div>
    <div class="kpis3 four">${p ? stat(p.employees, "active employees", "#/people/employees") + stat(p.withoutLogin, "without a login", "#/people/employees") : ""}
      ${m ? stat(m.byRole.manager || 0, "managers", "#/settings?tab=members") + stat(m.byRole.hr || 0, "HR", "#/settings?tab=members") : ""}
      ${p && p.invitations !== null ? stat(p.invitations, "pending invitations", "#/settings?tab=members") : ""}${m && m.disabled ? stat(m.disabled, "deactivated", "#/settings?tab=members", true) : ""}</div>
    <div class="two">
      <div class="stack" style="gap:6px"><h3>Managers & HR</h3>${m && m.leaders.length ? `<div class="mini-list">${m.leaders.map(l => `<div class="li"><span class="avatar xs">${esc(CFF.util.initials(l.name))}</span><span class="stack" style="gap:0;min-width:0"><b>${esc(l.name)}</b><span class="muted small">${esc(R[l.role] || l.role)}${l.designation ? " · " + esc(l.designation) : ""}</span></span></div>`).join("")}</div>` : `<p class="muted">No managers or HR yet. ${S.can("members.manage") ? `<a class="link" href="#/settings?tab=members">Invite them</a>` : ""}</p>`}</div>
      <div class="stack" style="gap:6px"><h3>Departments</h3>${p && p.departments.length ? `<div class="mini-list">${p.departments.map(d => `<div class="row" style="justify-content:space-between"><span>${esc(d.name)}</span><b class="num">${d.count}</b></div>`).join("")}</div>` : `<p class="muted">No departments yet.</p>`}</div>
    </div>
    ${p && p.recent.length ? `<h3>Recently joined</h3><div class="mini-list">${p.recent.map(x => `<a href="#/people/employees"><b>${esc(x.name)}</b><span class="muted small">${esc([x.designation, x.department].filter(Boolean).join(" · "))}${x.joined_on ? " · joined " + esc(fmtDate(x.joined_on)) : ""}</span></a>`).join("")}</div>` : ""}`;
}

CFF.route("dashboard", { title: "Dashboard", perm: ["cff.view"], exps: ["business"], alt: () => CFF.home().slice(2), async render(el){
  const d = await CFF.api.c.get("/dashboard");
  CFF.cache.stages = Object.fromEntries(d.stages.map(s => [s.n, s]));
  const name = (S.me.profile.full_name || "").split(" ")[0];
  const o = d.overall, r = d.readiness;
  const stageRows = d.stages.map(s => `<a href="#/cff/${s.n}" class="srow"><span class="sn ${s.status === "approved" ? "done" : ""}">${s.n}</span>
      <span class="st">${esc(s.title)}</span><span class="sp">${bar(s.pct, s.status === "approved" ? "good" : "")}<b class="num">${s.pct}%</b></span><span class="ss">${statusPill(s.status)}</span></a>`).join("");
  const t = d.tasks;
  const quick = [
    ["cff/" + (r.next ? r.next.stage : 1), "Continue the CFF", "layers"],
    S.can("partners.edit") && ["company/partners", "Add a partner", "users"],
    S.can("tasks.edit") && ["execution/tasks?new=1", "Create a task", "check"],
    S.can("documents.upload") && ["compliance/documents", "Upload a document", "upload"],
    S.can("reports.view") && ["reports/master", "CFF Master Report", "file"],
    S.can("members.manage") && ["settings?tab=members", "Invite team members", "users"]
  ].filter(Boolean);
  el.innerHTML = `
    <section class="card hero">
      <div class="stack" style="gap:10px;min-width:0">
        <span class="label">Welcome, ${esc(name)} · ${esc(CATALOGS.ROLE_LABEL[S.role] || "")}</span>
        <h1>${esc(d.company.name)}</h1>
        <p class="lens">${esc(INTRO.subtitle)}. ${o.approved} of 13 stages approved · ${o.done} of ${o.total} sub-points complete.</p>
        ${r.next ? `<div class="next-step"><span class="label">Recommended next step</span><a class="btn" href="#/${esc(r.next.link)}">${esc(r.next.text)} ${I.arrow}</a></div>` : ""}
      </div>
      <div class="ring-wrap">${ring(o.pct / 100)}<span class="muted small">Overall CFF completion</span></div>
    </section>

    <div class="dash-grid">
      <section class="card flush span2" aria-labelledby="sph">
        <div class="card-head"><h2 id="sph">13-stage progress</h2><a class="link" href="#/cff">Open the framework</a></div>
        <div class="stage-table">${stageRows}</div>
      </section>

      <section class="card stack" aria-labelledby="aph"><h2 id="aph">Pending approvals</h2>
        ${d.pendingApprovals.length ? `<div class="mini-list">${d.pendingApprovals.map(a => `<a href="#/cff/${a.n}"><b>Stage ${a.n}: ${esc(a.title)}</b><span class="muted small">Ready for review</span></a>`).join("")}</div>` : `<p class="muted">Nothing is waiting for approval.</p>`}
        <h3>Pending decisions</h3>
        ${d.pendingDecisions.length ? `<div class="mini-list">${d.pendingDecisions.map(x => `<a href="#/${esc(x.link)}">${esc(x.text)}</a>`).join("")}</div>` : `<p class="muted">No open decisions.</p>`}
      </section>

      <section class="card stack" aria-labelledby="rdh"><h2 id="rdh">Readiness & missing information</h2>
        ${r.warnings.length ? `<div class="wlist">${warnList(r.warnings)}</div>` : notice("No readiness warnings. Keep going.", "good")}
        ${r.missing.length ? `<details class="mini"><summary>${r.missing.length} missing item${r.missing.length > 1 ? "s" : ""}</summary><div class="wlist">${warnList(r.missing.map(m => ({ ...m, level: "info" })))}</div></details>` : ""}
      </section>

      <section class="card stack" aria-labelledby="pth"><h2 id="pth">Partners</h2>
        <div class="kpis3"><div><b class="num">${d.partners.active}</b><span>active</span></div><div><b class="num">${d.partners.complete}</b><span>complete profiles</span></div>
        ${d.shares ? `<div><b class="num">${+d.shares.total.toFixed(2)}%</b><span>shares allocated</span></div>` : ""}</div>
        ${d.shares && d.shares.count && Math.abs(d.shares.total - 100) > 0.001 ? notice("Shareholding must total exactly 100% before Stage 5 can be approved.", "bad") : ""}
        ${S.can("partners.view") ? `<a class="link" href="#/company/partners">Manage partners</a>` : ""}
      </section>

      <section class="card stack" aria-labelledby="rgh"><h2 id="rgh">Registration status</h2>
        ${d.registration.required ? `<div class="row" style="justify-content:space-between"><span>${d.registration.done} of ${d.registration.required} required items approved</span><b class="num">${Math.round(d.registration.done / d.registration.required * 100)}%</b></div>${bar(d.registration.done / d.registration.required * 100)}`
          : `<p class="muted">Mark which registrations and licences apply to your company in the compliance center.</p>`}
        ${S.can("compliance.view") ? `<a class="link" href="#/compliance/registration">Open registration & compliance</a>` : ""}
      </section>

      <section class="card stack" aria-labelledby="msh"><h2 id="msh">Upcoming milestones</h2>
        ${d.milestones === null ? `<p class="muted">You don't have access to plans.</p>` : d.milestones.length ? `<div class="mini-list">${d.milestones.map(m => `<a href="#/execution/plans"><b>${esc(m.title)}</b><span class="muted small">${esc(fmtDate(m.deadline))} · ${m.progress}%</span></a>`).join("")}</div>` : `<p class="muted">No upcoming deadlines in your plans.</p>`}
      </section>

      <section class="card stack" aria-labelledby="tkh"><h2 id="tkh">Tasks</h2>
        <div class="kpis3 four"><a href="#/execution/tasks?tab=today"><b class="num">${t.today}</b><span>today</span></a><a href="#/execution/tasks?tab=upcoming"><b class="num">${t.upcoming}</b><span>next 7 days</span></a>
          <a href="#/execution/tasks?tab=overdue" class="${t.overdue ? "bad" : ""}"><b class="num">${t.overdue}</b><span>overdue</span></a><a href="#/execution/tasks"><b class="num">${t.open}</b><span>open</span></a></div>
        ${t.list.length ? `<div class="mini-list">${t.list.map(x => `<a href="#/execution/tasks"><b>${esc(x.title)}</b><span class="muted small">${x.due_date ? "Due " + esc(fmtDate(x.due_date)) : "No due date"}${x.assignee ? " · " + esc(x.assignee) : ""}</span></a>`).join("")}</div>` : `<p class="muted">No open tasks.</p>`}
      </section>

      <section class="card stack" aria-labelledby="kph"><h2 id="kph">KPIs</h2>
        ${d.kpis === null ? `<p class="muted">You don't have access to KPIs.</p>` : d.kpis.total ? `<div class="kpis3 four"><div><b class="num">${d.kpis.on_track}</b><span>on track</span></div><div><b class="num">${d.kpis.at_risk}</b><span>at risk</span></div><div class="${d.kpis.off_track ? "bad" : ""}"><b class="num">${d.kpis.off_track}</b><span>off track</span></div><div><b class="num">${d.kpis.no_data}</b><span>no data</span></div></div>
          <div class="mini-list">${d.kpis.items.map(k => `<a href="#/execution/kpis"><b>${esc(k.name)}</b><span class="muted small">${k.latest ? esc(k.latest.period) + ": " + esc(k.latest.actual ?? "—") + " " + esc(k.unit || "") : "No results yet"}</span></a>`).join("")}</div>`
          : `<p class="muted">No KPIs yet. Stage 13 turns into an ongoing review once you add them.</p>`}
      </section>

      ${S.can("employees.view", "members.manage") ? `<section class="card stack span2" id="peopleCard" aria-labelledby="pph"><h2 id="pph">People & HR overview</h2>${CFF.util.loading("Loading your team…")}</section>` : ""}

      <section class="card stack" aria-labelledby="qah"><h2 id="qah">Quick actions</h2>
        <div class="quick">${quick.map(([h, l, ic]) => `<a class="btn secondary" href="#/${h}">${I[ic] || ""}<span>${esc(l)}</span></a>`).join("")}</div>
      </section>

      <section class="card stack span2" aria-labelledby="ach"><div class="row" style="justify-content:space-between"><h2 id="ach">Recent activity</h2>${d.activity ? `<a class="link" href="#/activity">All activity</a>` : ""}</div>
        ${d.activity === null ? `<p class="muted">Activity history is visible to owners and founders.</p>` : d.activity.length ? `<div class="activity">${d.activity.map(a => `<div class="act"><span class="avatar xs">${esc(CFF.util.initials(a.actor_name))}</span><span><b>${esc(a.actor_name || "System")}</b> ${esc(a.summary || a.action)}</span><small class="muted">${esc(ago(a.created_at))}</small></div>`).join("")}</div>` : `<p class="muted">No activity yet.</p>`}
      </section>
    </div>
    <div id="recs"></div>

    <details class="card intro-card"><summary><b>About the Company Formation Framework</b><span class="muted small">The introduction and the car-journey idea</span></summary>
      <div class="intro"><div class="prose"><p class="big">${esc(INTRO.paragraphs[0])}</p><p>${esc(INTRO.paragraphs[1])}</p><p class="quote">${esc(INTRO.closing)}</p><p class="muted">${esc(INTRO.summary)}</p></div>
      <div class="jtiles" role="list">${INTRO.journey.map(([k, v]) => `<div class="jtile" role="listitem"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join("")}</div></div>
      <div class="arch compact">${CFF.ARCH.map(([t, x]) => `<div class="arch-card"><b>${esc(t)}</b><span>${esc(x)}</span></div>`).join("")}</div>
    </details>`;
  const pc = $("#peopleCard");
  if(pc) CFF.api.c.get("/team").then(tm => { if(!pc.isConnected) return; pc.innerHTML = peopleCard(tm); }).catch(e => { if(pc.isConnected) pc.innerHTML = `<h2>People & HR overview</h2>` + notice(esc(e.message), "bad"); });
  if(S.can("ai.use")) CFF.ai.outputCard($("#recs"), { kind: "recommendations", title: "AI recommendations", button: "Get recommendations",
    intro: "Get suggested next steps, missing information, possible inconsistencies between stages and questions to discuss. Nothing is changed automatically.",
    disclaimer: "Based on your CFF progress. The founders decide what to do." });
  else if(d.recommendations) $("#recs").innerHTML = `<section class="card ai-analysis"><h2>AI recommendations</h2><div class="ai-an-text">${CFF.util.md(d.recommendations.content)}</div></section>`;
  CFF.ai.page({ label: "Founder dashboard", suggestions: ["What should we focus on this week?", "Explain our readiness warnings", "Which stage is weakest and why?"],
    context: () => "CURRENT PAGE: Founder dashboard.\nOverall: " + o.pct + "% complete, " + o.approved + "/13 approved.\nStages: " + d.stages.map(s => s.n + ". " + s.title + " — " + s.status + " " + s.pct + "%").join("; ") +
      "\nReadiness warnings: " + (r.warnings.map(w => w.text).join(" ") || "none") + "\nMissing: " + r.missing.map(m => m.text).join("; ") + "\nOpen tasks: " + t.open + " (" + t.overdue + " overdue)." });
}});
})();
