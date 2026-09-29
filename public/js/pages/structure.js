// Stage 5 — Company Structure & Ownership: shareholding (must total 100%), roles, decision authority,
// accountability matrix (RACI), departments and the organisation chart.
(function(){
"use strict";
const CFF = window.CFF;
const { $, $$, esc, I, toast, notice, empty, pill, tabs, onTabs, store, nl, opt } = CFF.util;
const S = CFF.state;
const LV = opt(CATALOGS.AUTHORITY_LEVELS), CATS = opt(CATALOGS.AUTHORITY_CATEGORIES);

async function load(){ return CFF.api.c.get("/structure"); }

CFF.route("company/structure", { title: "Structure & ownership", perm: ["structure.view"], async render(el, p, q){
  const d = await load();
  const stageLocked = CFF.cache.stages && CFF.cache.stages[5] && CFF.cache.stages[5].status === "approved";
  const T = [["shares", "Shareholding"], ["roles", "Roles"], ["authority", "Decision authority"], ["raci", "Accountability (RACI)"], ["departments", "Departments"], ["chart", "Organisation chart"]]
    .filter(([k]) => k !== "shares" || d.shareholding !== null);
  let tab = q.tab || store.get("cff:struct-tab") || T[0][0]; if(!T.some(t => t[0] === tab)) tab = T[0][0];
  el.innerHTML = CFF.pageHead({ label: "Stage 5 · Company Structure & Growth Roadmap", title: "Structure & ownership", crumbs: S.can("cff.view") ? [["#/cff/5", "Stage 5"], [null, "Structure"]] : null,
    lead: "Define who owns what, who does what, and who decides what. Stage 5 can only be approved when shareholding totals exactly 100%." }) +
    (stageLocked ? notice(`${I.lock} Stage 5 is approved, so structure and shareholding are locked. Reopen Stage 5 to change them.`) : "") +
    tabs(T, tab) + `<div id="tabBody" class="stack" style="gap:16px"></div>`;
  const draw = k => { store.set("cff:struct-tab", k); const b = $("#tabBody"); ({ shares, roles, authority, raci, departments, chart })[k](b, d, !stageLocked && d.can.edit); };
  onTabs(el, draw); draw(tab);
  CFF.ai.page({ label: "Company structure (Stage 5)", suggestions: ["Suggest a decision authority matrix for a small company", "What roles do we still need?", "Explain RACI with an example"],
    context: () => "CURRENT PAGE: Company structure & ownership (Stage 5).\nDepartments: " + d.departments.map(x => x.name).join(", ") + "\nRoles: " + d.positions.map(x => x.designation + (x.holder_name ? " (" + x.holder_name + ")" : "")).join(", ") +
      "\nDecision authority: " + d.authority.map(a => CATS[a.category] + ": " + a.decision + " → " + (a.decided_by || "")).join("; ") + "\nRACI rows: " + d.raci.length + "\nPartners: " + d.partners.map(x => x.full_name).join(", ") });
}});

/* ---------- shareholding ---------- */
function shares(el, d, edit){
  const edt = edit && d.can.financial;
  const byP = Object.fromEntries((d.shareholding || []).map(s => [s.partner_id, s]));
  if(!d.partners.length){ el.innerHTML = `<section class="card">${empty("Add partners first", "Shareholding is set per partner.", `<a class="btn" href="#/company/partners">Go to partners</a>`)}</section>`; return; }
  const F = [["percent", "Shareholding %"], ["financial_contribution", "Financial contribution"], ["time_contribution", "Time contribution"], ["responsibilities", "Responsibilities"], ["long_term_commitment", "Long-term commitment"], ["value_contribution", "Value contribution"]];
  el.innerHTML = `<section class="card stack"><div class="row" style="justify-content:space-between"><div class="stack" style="gap:2px"><h2>Shareholding</h2><span class="muted small">Visible only to people allowed to see financial information. Changes are kept in the version history.</span></div>
      <div class="total-box" id="totBox"></div></div>
    <div class="share-rows">${d.partners.map(pt => { const s = byP[pt.id] || {}; return `<div class="share-row card-in" data-p="${esc(pt.id)}"><div class="row" style="justify-content:space-between"><b>${esc(pt.full_name)}</b>
      <label class="pct"><span class="sr-only">Shareholding % for ${esc(pt.full_name)}</span><input class="input" type="number" min="0" max="100" step="0.01" data-f="percent" value="${s.percent != null ? Number(s.percent) : ""}" ${edt ? "" : "readonly"}> %</label></div>
      <div class="form-grid">${F.slice(1).map(([k, l]) => `<div class="field"><label>${esc(l)}<textarea class="input" rows="2" data-f="${k}" maxlength="2000" ${edt ? "" : "readonly"}>${esc(s[k] || "")}</textarea></label></div>`).join("")}</div></div>`; }).join("")}</div>
    ${edt ? `<div class="row"><button class="btn" id="saveShares">Save shareholding</button><span class="muted small">The total may be below 100% while you work on it, but not above.</span></div>` : ""}
    ${notice("CFF records what the founders decide. It does not recommend ownership splits, and the AI will not decide equity. Consider legal advice for your shareholders' agreement.")}</section>`;
  const total = () => $$("[data-f=percent]", el).reduce((a, i) => a + (Number(i.value) || 0), 0);
  const showTotal = () => { const t = +total().toFixed(3); const ok = Math.abs(t - 100) < 0.001;
    $("#totBox").innerHTML = `<span class="label">Total</span><b class="num ${ok ? "good" : t > 100 ? "bad" : "warn"}">${t}%</b>${ok ? pill("Equals 100%", "good") : pill(t > 100 ? "Over 100%" : "Must equal 100%", t > 100 ? "bad" : "warn")}`; };
  $$("[data-f=percent]", el).forEach(i => i.addEventListener("input", showTotal)); showTotal();
  const sb = $("#saveShares"); if(sb) sb.addEventListener("click", async () => {
    if(total() > 100.0005) return toast("The total can't be more than 100%.", "bad");
    const rows = $$(".share-row", el).map(r => { const o = { partner_id: r.dataset.p }; $$("[data-f]", r).forEach(i => { o[i.dataset.f] = i.dataset.f === "percent" ? (i.value === "" ? 0 : Number(i.value)) : i.value; }); return o; });
    sb.disabled = true;
    try{ const r = await CFF.api.c.put("/structure/shareholding", { rows }); toast(r.complete ? "Saved. Shareholding totals 100%." : "Saved. Total is " + r.total + "%."); d.shareholding = r.shareholding; CFF.cache.stages = null; }
    catch(e){ toast(e.message, "bad"); } finally{ sb.disabled = false; }
  });
}

/* ---------- roles ---------- */
function roles(el, d, edit){
  const pName = Object.fromEntries(d.partners.map(x => [x.id, x.full_name])), eName = Object.fromEntries(d.employees.map(x => [x.id, x.full_name]));
  const dName = Object.fromEntries(d.departments.map(x => [x.id, x.name])), posName = Object.fromEntries(d.positions.map(x => [x.id, x.designation]));
  const holder = x => x.holder_type === "partner" ? pName[x.partner_id] || x.holder_name : x.holder_type === "employee" ? eName[x.employee_id] || x.holder_name : x.holder_type === "vacant" ? "Vacant" : x.holder_name || "";
  CFF.crudList(el, { title: "Roles", intro: "Designations, who holds them, responsibilities, authority level and reporting lines.", path: "/structure/positions", items: d.positions, canEdit: edit, addLabel: "Add role",
    emptyTitle: "No roles yet", emptyText: "Add each role: e.g. CEO, CTO, Head of Operations.",
    cols: [["Designation", x => `<b>${esc(x.designation)}</b>`], ["Held by", x => esc(holder(x))], ["Department", x => esc(dName[x.department_id] || "")], ["Authority", x => esc(LV[x.authority_level] || "")],
      ["Reports to", x => esc(posName[x.reports_to] || "")], ["Responsibilities", x => nl(CFF.util.cut(x.responsibilities, 180))]],
    fieldsFor: it => [
      { k: "designation", label: "Designation", required: true }, { k: "holder_type", label: "Held by", type: "select", required: true, options: [["partner", "A partner"], ["employee", "An employee"], ["vacant", "Vacant"]], value: "partner" },
      { k: "partner_id", label: "Partner", type: "select", options: d.partners.map(x => [x.id, x.full_name]) }, { k: "employee_id", label: "Employee", type: "select", options: d.employees.map(x => [x.id, x.full_name]) },
      { k: "holder_name", label: "Name (if not listed)" }, { k: "department_id", label: "Department", type: "select", options: d.departments.map(x => [x.id, x.name]) },
      { k: "role", label: "Role summary" }, { k: "authority_level", label: "Authority level", type: "select", options: CATALOGS.AUTHORITY_LEVELS },
      { k: "reports_to", label: "Reports to", type: "select", options: d.positions.filter(x => !it || x.id !== it.id).map(x => [x.id, x.designation]) },
      { k: "responsibilities", label: "Responsibilities", type: "textarea", rows: 4, max: 4000 }] });
}

/* ---------- decision authority ---------- */
function authority(el, d, edit){
  CFF.crudList(el, { title: "Decision authority", intro: "Who decides what, in 8 areas: strategic, financial, operational, hiring, marketing, sales, legal and technology.", path: "/structure/authority",
    items: d.authority, canEdit: edit, addLabel: "Add decision", emptyTitle: "No decision rules yet", emptyText: "Example: Financial · Spend above ₹1 lakh · decided by CEO · approval from both founders.",
    cols: [["Area", x => pill(CATS[x.category] || x.category, "accent")], ["Decision", x => `<b>${esc(x.decision)}</b>`], ["Decided by", x => esc(x.decided_by || "")], ["Approval needed from", x => esc(x.approval_needed || "")], ["Limit / condition", x => esc(x.limit_note || "")]],
    fields: [{ k: "category", label: "Area", type: "select", required: true, options: CATALOGS.AUTHORITY_CATEGORIES }, { k: "decision", label: "Decision", required: true },
      { k: "decided_by", label: "Decided by" }, { k: "approval_needed", label: "Approval needed from" }, { k: "limit_note", label: "Limit or condition" }] });
}

/* ---------- RACI ---------- */
function raci(el, d, edit){
  CFF.crudList(el, { title: "Accountability matrix (RACI)", intro: "<b>R</b>esponsible does the work · <b>A</b>ccountable owns the result · <b>C</b>onsulted gives input · <b>I</b>nformed is kept up to date.", path: "/structure/raci",
    items: d.raci, canEdit: edit, addLabel: "Add row", emptyTitle: "No rows yet",
    cols: [["Task / decision", x => `<b>${esc(x.task)}</b>`], ["Responsible", x => esc(x.responsible || "")], ["Accountable", x => esc(x.accountable || "")], ["Consulted", x => esc(x.consulted || "")], ["Informed", x => esc(x.informed || "")]],
    fields: [{ k: "task", label: "Task or decision", required: true, full: true }, { k: "responsible", label: "Responsible" }, { k: "accountable", label: "Accountable" }, { k: "consulted", label: "Consulted" }, { k: "informed", label: "Informed" }] });
}

/* ---------- departments ---------- */
function departments(el, d){
  const canDept = d.can.departments;
  const count = id => d.employees.filter(e => e.department_id === id).length;
  CFF.crudList(el, { title: "Departments", intro: "Departments are shared by roles, employees, tasks and KPIs.", path: "/structure/departments", items: d.departments, canEdit: canDept, canDelete: d.can.edit, addLabel: "Add department",
    headActions: canDept ? `<button class="btn secondary sm" data-std>Add standard departments</button>` : "",
    emptyTitle: "No departments yet", emptyText: "Add the standard departments (Leadership, HR, Finance, Marketing, Sales, Operations, Technology, Legal, Customer Support) or your own.",
    cols: [["Department", x => `<b>${esc(x.name)}</b>`], ["Description", x => esc(x.description || "")], ["Parent", x => esc((d.departments.find(y => y.id === x.parent_id) || {}).name || "")], ["Employees", x => String(count(x.id))]],
    fieldsFor: it => [{ k: "name", label: "Department name", required: true }, { k: "description", label: "Description", maxlength: 500 },
      { k: "parent_id", label: "Part of", type: "select", options: d.departments.filter(x => !it || x.id !== it.id).map(x => [x.id, x.name]) }],
    bindActions: root => { const b = $("[data-std]", root); if(b) b.addEventListener("click", async () => { const r = await CFF.api.c.post("/structure/departments/standard"); toast(r.added ? r.added + " departments added." : "All standard departments already exist."); CFF.render(); }); } });
}
CFF.structureDepartments = departments;

/* ---------- organisation chart ---------- */
function chart(el, d){
  const pos = d.positions;
  const pName = Object.fromEntries(d.partners.map(x => [x.id, x.full_name])), eName = Object.fromEntries(d.employees.map(x => [x.id, x.full_name]));
  const dName = Object.fromEntries(d.departments.map(x => [x.id, x.name]));
  const who = x => x.holder_type === "partner" ? pName[x.partner_id] || x.holder_name : x.holder_type === "employee" ? eName[x.employee_id] || x.holder_name : x.holder_type === "vacant" ? "Vacant" : x.holder_name || "";
  const kids = id => pos.filter(x => (x.reports_to || null) === id);
  const seen = new Set();
  const node = x => { if(seen.has(x.id)) return ""; seen.add(x.id); const k = kids(x.id);
    return `<li><div class="org-node"><b>${esc(x.designation)}</b><span>${esc(who(x) || "—")}</span>${x.department_id ? `<small>${esc(dName[x.department_id] || "")}</small>` : ""}</div>${k.length ? `<ul>${k.map(node).join("")}</ul>` : ""}</li>`; };
  const roots = pos.filter(x => !x.reports_to || !pos.some(y => y.id === x.reports_to));
  const tree = roots.map(node).join("");
  el.innerHTML = `<section class="card stack"><h2>Organisation chart</h2><p class="muted small">Built from the roles and their “reports to” lines. On small screens it shows as an indented list.</p>
    ${pos.length ? `<div class="org"><ul>${tree}</ul></div>` : empty("No roles yet", "Add roles and who they report to in the Roles tab.")}</section>
    <section class="card stack"><h2>Departments</h2>${d.departments.length ? `<div class="chips">${d.departments.map(x => `<span class="chipf static">${esc(x.name)} <span class="c">${d.employees.filter(e => e.department_id === x.id).length}</span></span>`).join("")}</div>` : `<p class="muted">No departments yet.</p>`}</section>`;
}

CFF.route("people/departments", { title: "Departments", perm: ["structure.view", "employees.view"], async render(el){
  const d = await load();
  el.innerHTML = CFF.pageHead({ label: "People", title: "Departments", lead: "Departments organise roles, employees, tasks and KPIs." }) + `<div id="deps"></div>`;
  departments($("#deps"), d);
}});
})();
