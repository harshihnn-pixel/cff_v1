// Routing and the application shell: top bar (company switcher, search, notifications, AI, theme),
// the role-based sidebar, and permission checks before any page is shown.
// The server checks every permission again; hiding a link here is only for convenience.
(function(){
"use strict";
const CFF = window.CFF;
const { $, $$, esc, I, toast, store, initials, loading, empty, notice } = CFF.util;
const S = CFF.state;

/* ---------- routes ---------- */
const ROUTES = [];
// CFF.route("cff/:n/:point", { title, perm:["cff.view"], public, noCompany, render(el, params, query) })
CFF.route = (pattern, def) => {
  const keys = [];
  const re = new RegExp("^" + pattern.split("/").map(p => p.startsWith(":") ? (keys.push(p.slice(1)), "([^/]+)") : p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("/") + "$");
  ROUTES.push({ pattern, re, keys, def });
};
const parse = () => { const h = (location.hash || "#/").replace(/^#\/?/, ""); const [path] = h.split("?"); return decodeURIComponent(path).replace(/\/+$/, ""); };
function match(path){
  for(const r of ROUTES){ const m = r.re.exec(path); if(m){ const params = {}; r.keys.forEach((k, i) => { params[k] = m[i + 1]; }); return { ...r, params }; } }
  return null;
}
CFF.go = h => { h = h.startsWith("#") ? h : "#/" + h.replace(/^\//, ""); if(location.hash === h) render(); else location.hash = h; };

/* ---------- theme & template ---------- */
const TEMPLATES = { clean: "Clean", studio: "Studio", classic: "Classic" };
function applyPrefs(){
  const t = store.get("cff:theme"); if(t) document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme");
  const tp = store.get("cff:template"); document.body.dataset.template = TEMPLATES[tp] ? tp : "clean";
}
const isDark = () => { const t = document.documentElement.getAttribute("data-theme"); if(t) return t === "dark"; return !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches); };
CFF.theme = { TEMPLATES, apply: applyPrefs, isDark,
  toggle(){ const n = isDark() ? "light" : "dark"; store.set("cff:theme", n); applyPrefs(); const b = $("#themeBtn"); if(b){ b.innerHTML = isDark() ? I.sun : I.moon; b.setAttribute("aria-label", "Switch to " + (isDark() ? "light" : "dark") + " mode"); } },
  setTemplate(k){ store.set("cff:template", k); applyPrefs(); } };

/* ---------- navigation (by role permissions) ---------- */
// Each experience gets its own navigation. Only items the person may open are rendered (never just disabled).
function navModel(){
  const can = S.can, exp = S.experience();
  const tidy = groups => groups.map(g => ({ ...g, items: g.items.filter(Boolean) })).filter(g => g.items.length);
  const stages = () => can("cff.view") ? [{ href: "cff", label: "All 13 stages", exact: true },
    ...STAGES.map(s => ({ href: "cff/" + s.n, label: s.title, n: s.n, status: (CFF.cache.stages || {})[s.n] }))] : [];
  const resources = [
    (can("content.view") || can("content.manage")) && { href: "resources/sops", label: "SOPs" },
    (can("content.view") || can("content.manage")) && { href: "resources/policies", label: "Policies" },
    (can("content.view") || can("content.manage")) && { href: "resources/training", label: "Training" },
    can("documents.view") && { href: "resources/documents", label: "Documents" },
    (can("content.view") || can("content.manage")) && { href: "resources/announcements", label: "Announcements" }
  ];
  const personal = [
    can("ai.use") && { action: "ai", label: "AI Assistant", icon: "sparkle" },
    { href: "notifications", label: "Notifications", icon: "bell" },
    { href: "settings", label: "My profile", icon: "gear" },
    { action: "logout", label: "Log out", icon: "logout" }
  ];

  // EMPLOYEE — "understand my company and do my work"
  if(exp === "employee") return tidy([
    { items: [{ href: "employee", label: "Dashboard", icon: "home" }] },
    { sec: "My work", items: [{ href: "my/tasks", label: "My tasks" }, { href: "my/kpis", label: "My KPIs" }] },
    { sec: "Company", items: [{ href: "company/overview", label: "Company overview" }, { href: "company/our-values", label: "Company values" }] },
    { sec: "Resources", items: resources },
    { sec: "My development", items: [{ href: "values", label: "My values assessment" }] },
    // anything extra the owner has explicitly granted to employees
    { sec: "Shared with me", items: [can("cff.view") && { href: "cff", label: "CFF (read)" }, can("plans.view") && { href: "execution/plans", label: "Plans" },
      can("kpis.view") && { href: "execution/kpis", label: "Company KPIs" }, can("reports.view") && { href: "reports/master", label: "Reports" }] },
    { sec: " ", items: personal }
  ]);
  // VIEWER — read-only approved information
  if(exp === "viewer") return tidy([
    { items: [{ href: "company/overview", label: "Company overview", icon: "building" }, { href: "company/our-values", label: "Company values", icon: "target" }] },
    { sec: "Shared with me", items: [...resources, can("profile.view") && { href: "company/profile", label: "Master profile" }, can("reports.view") && { href: "reports/master", label: "Reports" }] },
    { sec: " ", items: personal.filter(x => x && x.action !== "ai" || can("ai.use")) }
  ]);
  // MANAGER and HR — work-focused dashboards; everything else only by permission
  if(exp === "operations" || exp === "hr") return tidy([
    { items: [{ href: "team", label: exp === "hr" ? "HR dashboard" : "Operations dashboard", icon: "home" }] },
    { sec: "My work", items: [{ href: "my/tasks", label: "My tasks" }, { href: "my/kpis", label: "My KPIs" }] },
    { sec: "Company", items: [{ href: "company/overview", label: "Company overview" }, { href: can("values.view") ? "company/values" : "company/our-values", label: "Company values" },
      can("profile.view") && { href: "company/profile", label: "Master profile" }, can("partners.view") && { href: "company/partners", label: "Partners" },
      can("structure.view") && { href: "company/structure", label: exp === "hr" ? "Roles & structure" : "Structure" }, can("cff.view") && { href: "company/names", label: "Name selection" },
      can("brand.view") && { href: "company/brand", label: "Brand" }] },
    exp === "hr" ? { sec: "People", items: [
      can("employees.view") && { href: "people/employees", label: "Employees" }, (can("employees.view") || can("structure.view")) && { href: "people/departments", label: "Departments" },
      (can("members.manage") || can("employees.manage")) && { href: "settings?tab=members", label: "Invitations", alias: true },
      can("content.manage") && { href: "people/content", label: "SOPs, policies & training" }] } : null,
    { sec: "Execution", items: [can("plans.view") && { href: "execution/plans", label: "Plans" }, (can("tasks.view_all") || can("tasks.edit")) && { href: "execution/tasks", label: "Team tasks" },
      can("plans.view") && { href: "execution/milestones", label: "Milestones" }, can("kpis.view") && { href: "execution/kpis", label: "KPIs & reviews" }] },
    exp === "operations" ? { sec: "People", items: [(can("employees.view") || can("structure.view")) && { href: "people/departments", label: "Departments" },
      can("employees.view") && { href: "people/employees", label: "Team members" }, can("content.manage") && { href: "people/content", label: "SOPs, policies & training" }] } : null,
    { sec: "Resources", items: resources },
    { sec: "CFF", key: "cff", items: stages() },
    { sec: "Compliance", items: [can("compliance.view") && { href: "compliance/registration", label: "Registration" }, can("compliance.view") && { href: "compliance/calendar", label: "Compliance calendar" },
      (can("documents.upload") || can("documents.manage")) && { href: "compliance/documents", label: "Document library" }] },
    { sec: "Reports", items: [can("reports.view") && { href: "reports/master", label: "CFF Master Report" }, can("reports.view") && { href: "reports/progress", label: "Progress report" },
      (can("reports.view") || can("kpis.view")) && { href: "reports/kpi", label: "KPI report" }] },
    { sec: "My development", items: [{ href: "values", label: "My values assessment" }] },
    { sec: " ", items: [can("activity.view") && { href: "activity", label: "Activity", icon: "clock" }, ...personal] }
  ].filter(Boolean));
  // BUSINESS OWNER / FOUNDER — the complete company-building system
  return tidy([
    { items: [can("cff.view") ? { href: "dashboard", label: "Dashboard", icon: "home" } : { href: "team", label: "Dashboard", icon: "home" }] },
    { sec: "Company", items: [
      { href: "company/overview", label: "Overview" },
      can("profile.view") && { href: "company/profile", label: "Master Profile" },
      can("partners.view") && { href: "company/partners", label: "Partners & founders" },
      can("structure.view") && { href: "company/structure", label: "Structure & ownership" },
      can("values.view") && { href: "company/values", label: "Company values" },
      can("cff.view") && { href: "company/names", label: "Name selection" },
      can("brand.view") && { href: "company/brand", label: "Brand identity" }
    ] },
    { sec: "CFF", key: "cff", items: [...stages(), { href: "values", label: "Values Discovery", icon: "sparkle" }] },
    { sec: "Execution", items: [
      can("plans.view") && { href: "execution/plans", label: "Plans" },
      (can("tasks.view_all") || can("tasks.edit")) ? { href: "execution/tasks", label: "Tasks" } : { href: "my/tasks", label: "My tasks" },
      can("plans.view") && { href: "execution/milestones", label: "Milestones" },
      can("kpis.view") && { href: "execution/kpis", label: "KPIs" },
      can("kpis.view") && { href: "execution/kpis?tab=reviews", label: "Reviews", alias: true }
    ] },
    { sec: "People", items: [
      can("partners.view") && { href: "company/partners", label: "Partners", alias: true },
      (can("structure.view") || can("employees.view")) && { href: "people/departments", label: "Departments" },
      can("employees.view") && { href: "people/employees", label: "Employees" },
      (can("members.manage") || can("employees.manage")) && { href: "settings?tab=members", label: "Invitations", alias: true },
      can("structure.view") && { href: "company/structure?tab=roles", label: "Roles & responsibilities", alias: true },
      can("content.manage") ? { href: "people/content", label: "SOPs, policies & training" } : can("content.view") && { href: "resources/sops", label: "SOPs, policies & training" }
    ] },
    { sec: "Compliance", items: [
      can("compliance.view") && { href: "compliance/registration", label: "Registration & compliance" },
      can("compliance.view") && { href: "compliance/calendar", label: "Compliance calendar" },
      can("documents.view") && { href: "compliance/documents", label: "Documents" }
    ] },
    { sec: "Reports", items: [
      can("reports.view") && { href: "reports/master", label: "CFF Master Report" },
      can("reports.view") && { href: "reports/progress", label: "Progress report" },
      (can("reports.view") || can("kpis.view")) && { href: "reports/kpi", label: "KPI report" }
    ] },
    { sec: "Admin", items: [
      can("company.manage") && { href: "settings?tab=company", label: "Company settings", alias: true },
      (can("members.manage") || can("employees.manage")) && { href: "settings?tab=members", label: "Members", alias: true },
      (can("company.manage") || can("members.manage")) && { href: "settings?tab=permissions", label: "Roles & permissions", alias: true },
      can("activity.view") && { href: "activity", label: "Activity / audit log" }
    ] },
    { sec: " ", items: personal }
  ]);
}
// Home page after login and company selection, by experience.
CFF.home = () => {
  const exp = S.experience();
  if(exp === "business") return S.can("cff.view") ? "#/dashboard" : "#/team";
  if(exp === "operations" || exp === "hr") return "#/team";
  if(exp === "employee") return "#/employee";
  return "#/company/overview";
};
function sidebar(path){
  const collapsed = store.get("cff:nav-collapsed") || {};
  return navModel().map(g => {
    const items = g.items.map(it => {
      if(it.action) return `<button type="button" class="nav-a" data-nav-action="${it.action}">${it.icon ? `<span class="ni">${I[it.icon]}</span>` : ""}<span>${esc(it.label)}</span></button>`;
      const base = it.href.split("?")[0];
      const cur = !it.alias && (it.exact ? path === base : (path === base || path.startsWith(base + "/")));
      const st = it.status && it.status.status;
      const mark = it.n ? `<span class="sn ${st === "approved" ? "ok" : st && st !== "not_started" ? "wip" : ""}" title="${esc((CATALOGS.STAGE_STATUS[st] || {}).label || "")}">${it.n}</span>` : it.icon ? `<span class="ni">${I[it.icon]}</span>` : `<span class="ni dot"></span>`;
      return `<a class="nav-a" href="#/${it.href}" ${cur ? 'aria-current="page"' : ""}>${mark}<span>${esc(it.label)}</span></a>`;
    }).join("");
    if(!g.sec) return `<div class="nav-g">${items}</div>`;
    const closed = g.key && collapsed[g.key] && !path.startsWith("cff");
    return `<div class="nav-g">${g.sec.trim() ? `<button type="button" class="sec" data-sec="${esc(g.key || g.sec)}" aria-expanded="${!closed}">${esc(g.sec)}${g.key ? `<span class="chev-s">${I.down}</span>` : ""}</button>` : `<div class="sec-line"></div>`}<div class="nav-items" ${closed ? "hidden" : ""}>${items}</div></div>`;
  }).join("");
}

function topbar(){
  const u = S.me && S.me.user, p = S.me && S.me.profile;
  const companies = (S.me && S.me.companies) || [];
  const portal = CATALOGS.EXPERIENCE_LABEL[S.experience()] || "";
  return `<header class="topbar"><div class="topbar-in">
    <button class="icon-btn menu-btn" id="menuBtn" aria-label="Open menu" aria-controls="side" aria-expanded="false">${I.menu}</button>
    <a class="brand" href="${CFF.home()}" aria-label="CFF home"><span class="logo">CFF</span></a>
    <div class="co-switch">
      <label class="sr-only" for="coSel">Company workspace</label>
      <select id="coSel" class="input sm">${companies.map(c => `<option value="${esc(c.id)}" ${c.id === S.companyId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}<option value="__new">+ New company…</option></select>
      <span class="portal-name">${esc(portal)}${S.experience() === "business" ? " · " + esc(CATALOGS.ROLE_LABEL[S.role] || (S.role === "super_admin" ? "Super Admin" : "")) : ""}</span>
    </div>
    <span class="spacer"></span>
    <div class="gsearch" role="search">
      <label class="sr-only" for="gsearch">Search</label>
      <span class="gs-ic">${I.search}</span><input id="gsearch" class="input sm" type="search" placeholder="Search…" autocomplete="off" aria-controls="gsResults" aria-expanded="false">
      <div class="dropdown gs-results" id="gsResults" hidden></div>
    </div>
    ${S.can("ai.use") ? `<button class="btn secondary sm ai-top" id="aiTopBtn" type="button">${I.sparkle}<span>Ask AI</span></button>` : ""}
    <div class="bell-wrap"><button class="icon-btn" id="bellBtn" aria-label="Notifications" aria-haspopup="true" aria-expanded="false">${I.bell}<span class="badge" id="bellCount" hidden></span></button>
      <div class="dropdown notif" id="notifBox" hidden></div></div>
    <button class="icon-btn" id="themeBtn" aria-label="Switch to ${isDark() ? "light" : "dark"} mode">${isDark() ? I.sun : I.moon}</button>
    <div class="user-wrap"><button class="user" id="userBtn" aria-haspopup="true" aria-expanded="false"><span class="avatar">${esc(initials(p && p.full_name))}</span><span class="nm">${esc(p ? p.full_name : "")}</span></button>
      <div class="dropdown user-menu" id="userMenu" hidden>
        <div class="um-head"><b>${esc(p ? p.full_name : "")}</b><span class="muted">${esc(u ? u.email : "")}</span></div>
        <label class="um-row">Template <select id="tplSel" class="input sm">${Object.entries(TEMPLATES).map(([k, v]) => `<option value="${k}" ${k === document.body.dataset.template ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <a href="#/settings">Account & settings</a><a href="#/start">Switch or create company</a>
        <button type="button" id="logoutBtn">${I.logout} Log out</button>
      </div></div>
  </div></header>`;
}

function shell(path){
  return topbar() + `<div class="shell"><aside class="side" id="side" aria-label="Main navigation"><nav>${sidebar(path)}</nav></aside>
    <div class="scrim" id="scrim" hidden></div>
    <main class="content" id="main" tabindex="-1"><div class="page" id="page"></div></main></div>`;
}

function closeMenus(except){ ["#gsResults", "#notifBox", "#userMenu"].forEach(s => { const el = $(s); if(el && el !== except){ el.hidden = true; } });
  [["#bellBtn"], ["#userBtn"]].forEach(([b]) => { const x = $(b); if(x && (!except || !x.parentElement.contains(except))) x.setAttribute("aria-expanded", "false"); }); }

function bindShell(){
  $("#menuBtn").addEventListener("click", () => { const open = !document.body.classList.contains("nav-open"); document.body.classList.toggle("nav-open", open); $("#menuBtn").setAttribute("aria-expanded", open); $("#scrim").hidden = !open; });
  $("#scrim").addEventListener("click", () => { document.body.classList.remove("nav-open"); $("#scrim").hidden = true; });
  $("#themeBtn").addEventListener("click", CFF.theme.toggle);
  $("#tplSel").addEventListener("change", e => { CFF.theme.setTemplate(e.target.value); toast(TEMPLATES[e.target.value] + " template applied"); });
  $("#coSel").addEventListener("change", async e => {
    const v = e.target.value;
    if(v === "__new"){ e.target.value = S.companyId; CFF.go("#/start?new=1"); return; }
    await CFF.flushSaves();
    try{ await S.openCompany(v); CFF.cache.stages = null; toast("Switched to " + S.company.name); CFF.go(CFF.home()); }
    catch(err){ toast(err.message, "bad"); CFF.go("#/start"); }
  });
  $("#logoutBtn").addEventListener("click", CFF.logout);
  const ai = $("#aiTopBtn"); if(ai) ai.addEventListener("click", () => CFF.ai && CFF.ai.open());
  refreshNav();
  // user menu & notifications
  const toggle = (btn, box, onOpen) => btn.addEventListener("click", e => { e.stopPropagation(); const open = box.hidden; closeMenus(box); box.hidden = !open; btn.setAttribute("aria-expanded", open); if(open && onOpen) onOpen(); });
  toggle($("#userBtn"), $("#userMenu"));
  toggle($("#bellBtn"), $("#notifBox"), loadNotifications);
  // search
  const gs = $("#gsearch"), box = $("#gsResults"); let t, seq = 0;
  gs.addEventListener("input", () => { clearTimeout(t); t = setTimeout(async () => {
    const q = gs.value.trim(); if(q.length < 2){ box.hidden = true; gs.setAttribute("aria-expanded", "false"); return; }
    const my = ++seq;
    try{
      const d = await CFF.api.c.get("/search?q=" + encodeURIComponent(q)); if(my !== seq) return;
      box.innerHTML = d.groups.length ? d.groups.map(g => `<div class="gs-g"><div class="gs-h">${esc(g.label)}</div>${g.items.map(x => `<a href="#/${esc(x.link)}"><b>${esc(x.title)}</b><span>${esc(x.sub || "")}</span></a>`).join("")}</div>`).join("") : `<p class="muted gs-none">Nothing found for “${esc(q)}”.</p>`;
      closeMenus(box); box.hidden = false; gs.setAttribute("aria-expanded", "true");
    }catch(e){ box.innerHTML = `<p class="muted gs-none">${esc(e.message)}</p>`; box.hidden = false; }
  }, 250); });
  gs.addEventListener("keydown", e => { if(e.key === "Escape"){ box.hidden = true; gs.blur(); } if(e.key === "ArrowDown"){ const a = $("a", box); if(a){ e.preventDefault(); a.focus(); } } });
  box.addEventListener("click", () => { box.hidden = true; gs.value = ""; });
  refreshBell();
}
document.addEventListener("click", e => { if(!e.target.closest(".dropdown") && !e.target.closest("#gsearch")) closeMenus(); });
document.addEventListener("keydown", e => { if(e.key === "Escape") closeMenus(); });

/* ---------- notifications ---------- */
async function refreshBell(){
  if(!S.companyId) return;
  try{ const d = await CFF.api.c.get("/notifications"); setBell(d.unread); CFF.cache.notifs = d.items; }catch(e){ /* not important */ }
}
function setBell(n){ const b = $("#bellCount"); if(!b) return; b.hidden = !n; b.textContent = n > 9 ? "9+" : n; $("#bellBtn").setAttribute("aria-label", "Notifications" + (n ? ", " + n + " unread" : "")); }
async function loadNotifications(){
  const box = $("#notifBox"); box.innerHTML = loading();
  try{
    const d = await CFF.api.c.get("/notifications"); setBell(d.unread);
    box.innerHTML = `<div class="nb-head"><b>Notifications</b>${d.unread ? `<button class="link" type="button" id="nbRead">Mark all read</button>` : ""}</div>` +
      (d.items.length ? d.items.map(n => `<a class="nb-item ${n.read_at ? "" : "unread"}" href="${esc(n.link && n.link.startsWith("#/") ? n.link : "#/dashboard")}" data-id="${esc(n.id)}"><b>${esc(n.title)}</b>${n.body ? `<span>${esc(n.body)}</span>` : ""}<small>${esc(CFF.util.ago(n.created_at))}</small></a>`).join("")
        : `<p class="muted nb-none">You're all caught up.</p>`);
    const rd = $("#nbRead"); if(rd) rd.addEventListener("click", async e => { e.stopPropagation(); await CFF.api.c.post("/notifications/read", {}); loadNotifications(); });
    $$(".nb-item", box).forEach(a => a.addEventListener("click", () => { if(a.classList.contains("unread")) CFF.api.c.post("/notifications/read", { ids: [a.dataset.id] }).then(refreshBell).catch(() => {}); box.hidden = true; }));
  }catch(e){ box.innerHTML = `<p class="muted nb-none">${esc(e.message)}</p>`; }
}
CFF.refreshBell = refreshBell;

/* ---------- page helpers ---------- */
CFF.cache = {};
CFF.pageHead = ({ title, lead, label, crumbs, actions }) => `
  ${crumbs ? `<nav class="crumbs" aria-label="Breadcrumb">${crumbs.map(([h, l]) => h ? `<a href="${esc(h)}">${esc(l)}</a>` : `<span>${esc(l)}</span>`).join('<span class="s">/</span>')}</nav>` : ""}
  <header class="page-head row-head"><div class="stack" style="gap:6px;min-width:0">${label ? `<span class="label">${esc(label)}</span>` : ""}<h1>${esc(title)}</h1>${lead ? `<p class="lead">${lead}</p>` : ""}</div>
  ${actions ? `<div class="row head-actions">${actions}</div>` : ""}</header>`;
CFF.noAccess = el => { el.innerHTML = `<section class="card" role="alert">${empty("You don't have access to this page.", "Your role in this company doesn't include it. Ask the company owner if you need access.", `<a class="btn" href="${CFF.home()}">Go to my dashboard</a>`)}</section>`; };

/* ---------- rendering ---------- */
let renderSeq = 0, lastPath = null;
async function render(){
  const my = ++renderSeq;
  applyPrefs();
  document.body.classList.remove("nav-open");
  const path = parse();
  const r = match(path) || (path === "" ? null : { def: null });
  const app = $("#app");
  // Public pages (home, login, visitor portal) and the default route.
  if(!r || !r.def){
    if(!r){ // "#/" — home for visitors, dashboard when signed in with a company
      if(CFF.api.loggedIn()){ try{ if(!S.me) await S.loadMe(); }catch(e){ if(e.auth){ S.clear(); return CFF.go("#/login"); } }
        if(S.me){ if(!S.companyId || !S.me.companies.some(c => c.id === S.companyId)) return CFF.go("#/start"); if(!S.company) await S.openCompany(S.companyId).catch(() => null); if(S.company) return CFF.go(CFF.home()); return CFF.go("#/start"); } }
      return CFF.go("#/welcome");
    }
    // Unknown address: a clear "page not found" instead of silently jumping somewhere else.
    document.body.classList.remove("in-app"); if(CFF.ai) CFF.ai.leave();
    app.innerHTML = notFoundPage(); document.title = "Page not found · CFF"; return;
  }
  const def = r.def;
  if(my !== renderSeq) return;
  await CFF.flushSaves();
  document.body.dataset.portal = def.portal || (S.role ? (["employee", "viewer"].includes(S.experience()) ? "employee" : "business") : S.portal);
  if(def.public){
    document.body.classList.remove("in-app");
    if(CFF.ai) CFF.ai.leave();
    app.innerHTML = `<div id="page"></div>`;
    await def.render($("#page"), r.params, CFF.util.query());
    afterRender(path); return;
  }
  if(!CFF.api.loggedIn()){ store.set("cff:after-login", location.hash); return CFF.go("#/login"); }
  try{ if(!S.me) await S.loadMe(); }
  catch(e){ if(e.auth){ S.clear(); toast(e.message, "bad"); return CFF.go("#/login"); } app.innerHTML = errorPage(e); return bindRetry(); }
  if(def.noCompany){
    document.body.classList.remove("in-app"); if(CFF.ai) CFF.ai.leave();
    app.innerHTML = `<div id="page"></div>`;
    await def.render($("#page"), r.params, CFF.util.query()); afterRender(path); return;
  }
  if(!S.companyId || !S.me.companies.some(c => c.id === S.companyId)) return CFF.go("#/start");
  if(!S.company || S.company.id !== S.companyId){
    app.innerHTML = loading("Opening your company…");
    try{ await S.openCompany(S.companyId); }catch(e){ if(e.auth){ toast(e.message, "bad"); return CFF.go("#/login"); } toast(e.message, "bad");
      return CFF.go(e.code === "mfa_setup_required" ? "#/account?setup=1" : "#/start"); }
  }
  if(my !== renderSeq) return;
  document.body.dataset.portal = ["employee", "viewer"].includes(S.experience()) ? "employee" : "business";
  document.body.classList.add("in-app");
  if(S.can("cff.view") && !CFF.cache.stages) CFF.api.c.get("/cff").then(d => { CFF.cache.stages = d.stages; refreshNav(); }).catch(() => {});
  app.innerHTML = shell(path);
  bindShell();
  const el = $("#page");
  // Route protection: the page isn't loaded at all without permission. Pages with a personal
  // equivalent (e.g. company tasks → my tasks) send the person there instead.
  const blocked = (def.perm && !S.can(...def.perm)) || (def.exps && !def.exps.includes(S.experience()));
  if(blocked){
    const alt = typeof def.alt === "function" ? def.alt() : def.alt;
    if(alt){ location.replace("#/" + alt); return; }
    CFF.noAccess(el); afterRender(path); return;
  }
  el.innerHTML = loading();
  if(CFF.ai) CFF.ai.page(null);
  try{ await def.render(el, r.params, CFF.util.query()); }
  catch(e){
    if(my !== renderSeq) return;       // the person already moved on to another page
    if(e.auth){ toast(e.message, "bad"); return CFF.go("#/login"); }
    if(e.status === 404 && /Company not found/.test(e.message)){ S.company = null; toast(e.message, "bad"); return CFF.go("#/start"); }
    if(e.code === "mfa_setup_required"){ S.company = null; toast(e.message, "bad"); return CFF.go("#/account?setup=1"); }
    if(e.status === 403){ CFF.noAccess(el); afterRender(path); return; }
    console.error(e); el.innerHTML = errorPage(e); bindRetry();
  }
  afterRender(path);
}
// Redraws the sidebar (e.g. after stage statuses change).
function refreshNav(){
  const nav = $(".side nav"); if(!nav) return;
  nav.innerHTML = sidebar(parse());
  $$("[data-nav-action=ai]", nav).forEach(b => b.addEventListener("click", () => { document.body.classList.remove("nav-open"); CFF.ai && CFF.ai.open(); }));
  $$("[data-nav-action=logout]", nav).forEach(b => b.addEventListener("click", CFF.logout));
  $$(".sec[data-sec]", nav).forEach(b => b.addEventListener("click", () => {
    const items = b.nextElementSibling; const open = items.hidden; items.hidden = !open; b.setAttribute("aria-expanded", open);
    const c = store.get("cff:nav-collapsed") || {}; c[b.dataset.sec] = !open; store.set("cff:nav-collapsed", c);
  }));
}
CFF.refreshNav = refreshNav;
function afterRender(path){
  if(path !== lastPath){ window.scrollTo(0, 0); const m = $("#main") || $("#page"); if(m && lastPath !== null) m.focus({ preventScroll: true }); lastPath = path; }
  const def = (match(path) || {}).def || {};
  document.title = (typeof def.title === "function" ? def.title() : def.title || "CFF") + " · CFF – Company Formation & Growth OS";
  if(CFF.ai) CFF.ai.onRoute(path);
}
const notFoundPage = () => `<main class="home narrow"><section class="card stack" style="max-width:560px;margin:60px auto" role="alert"><span class="muted small">Error 404</span><h1>Page not found</h1>
  <p class="muted">The address may be mistyped, or the page has moved.</p><div class="row"><a class="btn" href="#/">Go to my dashboard</a><a class="btn secondary" href="#/welcome">CFF home</a></div></section></main>`;
const errorPage = e => `<section class="card stack" style="max-width:560px;margin:40px auto">${CFF.util.notice(esc(e.message || "Something went wrong."), "bad")}<div class="row"><button class="btn" id="retryBtn">Try again</button><a class="btn secondary" href="#/start">My companies</a></div></section>`;
const bindRetry = () => { const b = $("#retryBtn"); if(b) b.addEventListener("click", render); };
CFF.render = render;

CFF.logout = async () => {
  await CFF.flushSaves();
  await CFF.api.auth.logout();
  S.clear(); CFF.cache = {};
  if(CFF.ai) CFF.ai.reset();
  toast("You have logged out.");
  CFF.go("#/welcome");
};

window.addEventListener("hashchange", render);

// Last-resort error handling: never leave the person looking at a broken page without a message.
let lastErr = 0;
function unexpected(err){
  if(!err || err.name === "AbortError") return;
  console.error(err);
  if(Date.now() - lastErr < 4000) return; lastErr = Date.now();
  if(err instanceof CFF.api.ApiError){ if(err.auth && !CFF.api.loggedIn()){ toast("Your session has ended. Please log in again.", "bad"); return CFF.go("#/login"); } return toast(err.message, "bad"); }
  toast("Something went wrong. If it keeps happening, reload the page.", "bad");
}
window.addEventListener("error", e => { if(e.error) unexpected(e.error); });
window.addEventListener("unhandledrejection", e => unexpected(e.reason));

// Longer tables get search, sorting and pages automatically.
if(window.MutationObserver){ let t; new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => CFF.util.enhanceTables(document.getElementById("app")), 30); })
  .observe(document.getElementById("app") || document.body, { childList: true, subtree: true }); }
if(window.matchMedia){ try{ matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyPrefs); }catch(e){} }
CFF.start = () => { applyPrefs(); if(CFF.ai) CFF.ai.init(); render(); };
})();
