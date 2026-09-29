// Builds the CFF Master Report (22 sections) from company data the person is allowed to see.
// By default only approved information is included; operational records (plans, tasks, compliance,
// employees, KPIs) are live data and are always shown. The same structure feeds the web preview and Word export.
const summary = require("./summary");
const CAT = require("../../public/js/content/catalogs");

const d = x => (x && x.data) || [];
const one = x => (x && x.data) || null;
const lbl = (list, k) => CAT.opt(list)[k] || k || "";

async function build(req, includeDrafts){
  const db = req.db, c = req.companyId, can = p => req.perms.has(p);
  const s = await summary.build(db, c);
  const approved = n => s.stages[n].status === "approved";
  const show = n => includeDrafts || approved(n);
  const q = t => db.from(t);
  const [ans, partners, depts, positions, authority, raci, shares, values, profile, brand, assets, names, plans, comp, emps, kpis, results, tasks, members] = await Promise.all([
    can("cff.view") ? q("cff_answers").select("point_id,answer").eq("company_id", c) : null,
    can("partners.view") ? q("cff_partners").select("id,full_name,designation,profile,status").eq("company_id", c).eq("status", "active").order("created_at") : null,
    q("cff_departments").select("id,name,description").eq("company_id", c).order("sort"),
    can("structure.view") ? q("cff_positions").select("*").eq("company_id", c).order("sort") : null,
    can("structure.view") ? q("cff_decision_authority").select("*").eq("company_id", c).order("category") : null,
    can("structure.view") ? q("cff_raci").select("*").eq("company_id", c).order("sort") : null,
    can("partners.financial") ? q("cff_shareholding").select("*").eq("company_id", c) : null,
    q("cff_company_values").select("*").eq("company_id", c).order("sort"),
    q("cff_company_profiles").select("content,status,version,approved_at").eq("company_id", c).in("status", includeDrafts ? ["approved","draft"] : ["approved"]).order("version", { ascending: false }).limit(1),
    q("cff_brand").select("fields").eq("company_id", c).maybeSingle(),
    q("cff_brand_assets").select("kind").eq("company_id", c),
    can("cff.view") ? q("cff_company_names").select("name,status,meaning").eq("company_id", c) : null,
    can("plans.view") ? q("cff_plan_items").select("*").eq("company_id", c).order("plan").order("sort") : null,
    can("compliance.view") ? q("cff_compliance_items").select("*").eq("company_id", c).order("sort") : null,
    can("employees.view") ? q("cff_employees").select("full_name,designation,department_id,status").eq("company_id", c).eq("status", "active").order("full_name") : null,
    can("kpis.view") ? q("cff_kpis").select("*").eq("company_id", c).eq("active", true) : null,
    can("kpis.view") ? q("cff_kpi_results").select("*").eq("company_id", c).order("period", { ascending: false }) : null,
    q("cff_tasks").select("title,due_date,status,priority,assigned_to").eq("company_id", c).not("status", "in", "(completed,cancelled)").order("due_date").limit(40),
    q("cff_company_members").select("id,display_name").eq("company_id", c)
  ]);
  const A = Object.fromEntries(d(ans).map(x => [x.point_id, (x.answer || "").trim()]));
  const P = (d(profile)[0] || {}).content || {};
  const B = (one(brand) || {}).fields || {};
  const memberName = Object.fromEntries(d(members).map(m => [m.id, m.display_name]));
  const deptName = Object.fromEntries(d(depts).map(x => [x.id, x.name]));
  const partnerName = Object.fromEntries(d(partners).map(x => [x.id, x.full_name]));

  const excluded = n => ({ type: "note", text: "Not included: Stage " + n + " is not approved yet. Turn on \"Include drafts\" to see it." });
  const stageAnswers = (n, filter) => {
    if(!can("cff.view")) return [{ type: "note", text: "You don't have access to the CFF answers." }];
    if(!show(n)) return [excluded(n)];
    const kv = summary.POINTS.filter(p => p.stage === n && p.flag !== "values" && (!filter || filter(p))).filter(p => A[p.id]).map(p => [p.title, A[p.id]]);
    return kv.length ? [{ type: "kv", rows: kv }] : [{ type: "note", text: "Nothing written yet." }];
  };
  const pick = (profileKey, n, pointIds) => {
    if(P[profileKey]) return [{ type: "p", text: P[profileKey] }];
    const id = pointIds.find(i => A[i]);
    if(id && show(n)) return [{ type: "p", text: A[id] }];
    return [{ type: "note", text: id ? "Written but not approved yet." : "Not written yet." }];
  };
  const planItems = key => d(plans).filter(x => x.plan === key);
  const planTable = list => list.length ? [{ type: "table", head: ["Item", "Status", "Owner", "Deadline", "Progress"],
    rows: list.map(x => [x.title, lbl(CAT.PLAN_STATUSES, x.status), x.owner_name || memberName[x.owner_member_id] || "", x.deadline || "", x.progress + "%"]) }] : [{ type: "note", text: "No items yet." }];
  const latest = {}; d(results).forEach(x => { if(!latest[x.kpi_id]) latest[x.kpi_id] = x; });
  const vals = d(values).filter(x => includeDrafts || x.status === "approved");

  const sections = [];
  const add = (title, blocks) => sections.push({ n: sections.length + 1, title, blocks });

  add("Executive Summary", [
    { type: "kv", rows: [["Company", P.company_name || req.company.name], ["Industry", req.company.industry || ""], ["CFF progress", s.overall.pct + "% of sub-points complete, " + s.overall.approved + " of 13 stages approved"],
      ["Partners", String(s.partners.active)], ["Employees", String(s.people.employees)], ["Recommended next step", s.readiness.next ? s.readiness.next.text : ""]] },
    ...(P.vision || (show(1) && A["s1-0-1"]) ? [{ type: "p", text: "Vision: " + (P.vision || A["s1-0-1"]) }] : [])
  ]);
  add("Company Foundation", stageAnswers(1));
  add("Vision", pick("vision", 1, ["s7-1-0","s1-0-1"]));
  add("Mission", pick("mission", 1, ["s7-1-1","s1-0-2"]));
  add("Purpose", pick("purpose", 1, ["s7-1-3","s1-0-4"]));
  add("Business Process", [{ type: "list", items: ["Business Idea → Product/Service Creation → Customer Acquisition → Customer Experience → Business Operations → Growth → Expansion → Long-Term Vision"] }, ...stageAnswers(2)]);
  add("Resources", stageAnswers(3));
  add("Founders / Partners", !partners ? [{ type: "note", text: "You don't have access to partner profiles." }] : !d(partners).length ? [{ type: "note", text: "No partners added yet." }] :
    d(partners).flatMap(p => [{ type: "h", text: p.full_name + (p.designation ? " — " + p.designation : "") },
      { type: "kv", rows: CAT.PARTNER_FIELDS.flatMap(g => g.fields).filter(([k]) => ((p.profile || {})[k] || "").trim()).slice(0, 12).map(([k, l]) => [l, p.profile[k]]) }]));
  add("Company Structure", !show(5) ? [excluded(5)] : [
    { type: "h", text: "Roles" }, d(positions).length ? { type: "table", head: ["Designation", "Held by", "Department", "Authority", "Responsibilities"],
      rows: d(positions).map(x => [x.designation, x.holder_name || partnerName[x.partner_id] || (x.holder_type === "vacant" ? "Vacant" : ""), deptName[x.department_id] || "", lbl(CAT.AUTHORITY_LEVELS, x.authority_level), x.responsibilities || ""]) } : { type: "note", text: "No roles yet." },
    { type: "h", text: "Decision authority" }, d(authority).length ? { type: "table", head: ["Category", "Decision", "Decided by", "Approval needed", "Limit"],
      rows: d(authority).map(x => [lbl(CAT.AUTHORITY_CATEGORIES, x.category), x.decision, x.decided_by || "", x.approval_needed || "", x.limit_note || ""]) } : { type: "note", text: "No decision authority set yet." },
    { type: "h", text: "Accountability matrix (RACI)" }, d(raci).length ? { type: "table", head: ["Task / decision", "Responsible", "Accountable", "Consulted", "Informed"],
      rows: d(raci).map(x => [x.task, x.responsible || "", x.accountable || "", x.consulted || "", x.informed || ""]) } : { type: "note", text: "No accountability matrix yet." },
    ...stageAnswers(5, p => p.group === "Define the roadmap")
  ]);
  add("Shareholding", !shares ? [{ type: "note", text: "Shareholding is only shown to people who may see financial information." }] : !show(5) ? [excluded(5)] :
    d(shares).length ? [{ type: "table", head: ["Partner", "Shareholding", "Financial contribution", "Time contribution", "Long-term commitment"],
      rows: d(shares).map(x => [partnerName[x.partner_id] || "Partner", Number(x.percent) + "%", x.financial_contribution || "", x.time_contribution || "", x.long_term_commitment || ""]) },
      { type: "p", text: "Total: " + d(shares).reduce((a, b) => a + Number(b.percent), 0) + "%" }] : [{ type: "note", text: "Not set yet." }]);
  add("Company Values", vals.length ? vals.map(x => ({ type: "kv", title: x.name + (x.status !== "approved" ? " (draft)" : ""), rows: [["Meaning", x.meaning], ["Why it matters", x.why_it_matters],
    ["Expected behaviour", x.expected_behavior], ["Unacceptable behaviour", x.unacceptable_behavior], ["Customer promise", x.customer_promise]].filter(r => r[1]) })) : [{ type: "note", text: "No approved company values yet." }]);
  add("Master Company Profile", Object.keys(P).length ? [{ type: "kv", rows: CAT.PROFILE_SECTIONS.filter(([k]) => (P[k] || "").trim()).map(([k, l]) => [l, P[k]]) },
    ...(d(profile)[0] && d(profile)[0].status === "draft" ? [{ type: "note", text: "This is a draft version (not approved)." }] : [])] : [{ type: "note", text: "No approved Master Company Profile yet." }]);
  add("Brand Identity", !show(9) && !includeDrafts ? [excluded(9)] : [
    { type: "kv", rows: CAT.BRAND_FIELDS.filter(([k]) => (B[k] || "").trim()).map(([k, l]) => [l, B[k]]) },
    { type: "p", text: "Logo files: " + (d(assets).length ? d(assets).map(a => lbl(CAT.BRAND_ASSETS, a.kind)).join(", ") : "none uploaded") },
    ...(names ? [{ type: "p", text: "Selected company name: " + ((d(names).find(n => n.status === "selected") || {}).name || "not selected yet") }] : [])
  ]);
  add("Business Plans", !plans ? [{ type: "note", text: "You don't have access to plans." }] :
    CAT.PLAN_TYPES.filter(([k]) => !["risk","milestones","execution"].includes(k)).flatMap(([k, l]) => planItems(k).length ? [{ type: "h", text: l }, ...planTable(planItems(k))] : []).concat(d(plans).length ? [] : [{ type: "note", text: "No plans yet." }]));
  add("Registration & Compliance", !comp ? [{ type: "note", text: "You don't have access to compliance." }] : [{ type: "table", head: ["Item", "Applies?", "Status", "Responsible", "Due / renewal", "Registration no."],
    rows: d(comp).filter(x => x.applicability !== "not_required").map(x => [x.name, lbl(CAT.APPLICABILITY, x.applicability), lbl(CAT.COMPLIANCE_STATUSES, x.status), x.responsible_name || memberName[x.responsible_member_id] || "",
      [x.due_date, x.renewal_date].filter(Boolean).join(" / "), x.registration_number || ""]) }, { type: "note", text: "General guidance only. Confirm requirements with a Chartered Accountant, Company Secretary or lawyer." }]);
  add("Departments", d(depts).length ? [{ type: "table", head: ["Department", "Description", "Employees"], rows: d(depts).map(x => [x.name, x.description || "", emps ? String(d(emps).filter(e => e.department_id === x.id).length) : "—"]) }] : [{ type: "note", text: "No departments yet." }]);
  add("Employees", !emps ? [{ type: "note", text: "You don't have access to employee details." }] : d(emps).length ? [{ type: "table", head: ["Name", "Designation", "Department"], rows: d(emps).map(x => [x.full_name, x.designation || "", deptName[x.department_id] || ""]) }] : [{ type: "note", text: "No employees yet." }]);
  add("Execution Plan", plans ? [...planTable([...planItems("launch"), ...planItems("execution")]), { type: "p", text: "Open tasks: " + d(tasks).length }] : [{ type: "note", text: "You don't have access to plans." }]);
  add("KPIs", !kpis ? [{ type: "note", text: "You don't have access to KPIs." }] : d(kpis).length ? [{ type: "table", head: ["KPI", "Target", "Latest actual", "Period", "Status"],
    rows: d(kpis).map(k => { const l = latest[k.id]; return [k.name, (k.target ?? "") + (k.unit ? " " + k.unit : ""), l ? String(l.actual ?? "") : "", l ? l.period : "", l && l.status ? l.status.replace(/_/g, " ") : "no data"]; }) }] : [{ type: "note", text: "No KPIs yet." }]);
  add("Risks", plans ? planTable(planItems("risk")) : [{ type: "note", text: "You don't have access to plans." }]);
  add("Pending Actions", [
    { type: "list", items: [
      ...summary.STAGES.filter(st => s.stages[st.n].status !== "approved").map(st => "Stage " + st.n + " " + st.title + ": " + lbl(Object.entries(CAT.STAGE_STATUS).map(([k, x]) => [k, x.label]), s.stages[st.n].status)),
      ...s.readiness.warnings.map(w => w.text), ...s.readiness.missing.slice(0, 10).map(m => m.text) ] },
    d(tasks).length ? { type: "table", head: ["Open task", "Due", "Priority", "Assigned to"], rows: d(tasks).slice(0, 25).map(t => [t.title, t.due_date || "", t.priority, memberName[t.assigned_to] || ""]) } : { type: "note", text: "No open tasks." }
  ]);
  add("Growth Roadmap", [...stageAnswers(5, p => ["Business Stages","Company Growth Stages"].includes(p.title)),
    ...(plans ? [{ type: "h", text: "Growth strategy" }, ...planTable(planItems("growth")), { type: "h", text: "Milestones" }, ...planTable(planItems("milestones"))] : []),
    ...stageAnswers(13, p => p.group === "Upgrade the company")]);

  return { company: P.company_name || req.company.name, generated_at: new Date().toISOString(), include_drafts: !!includeDrafts,
           progress: s.overall, stages: summary.STAGES.map(st => ({ n: st.n, title: st.title, status: s.stages[st.n].status, pct: s.stages[st.n].pct })), sections };
}

module.exports = { build };
