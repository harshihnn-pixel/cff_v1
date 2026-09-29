// Stage 5 — company structure & ownership: departments, roles (positions), shareholding,
// decision authority and the accountability (RACI) matrix. Also the organisation chart data.
const express = require("express");
const { HttpError, wrap, check, v } = require("../lib/http");
const { perm, can } = require("../lib/auth");
const { crud } = require("../lib/crud");
const CAT = require("../../public/js/content/catalogs");

const r = express.Router({ mergeParams: true });   // /api/c/:companyId/structure
const LOCK5 = "Stage 5 is approved (reopen it to make changes).";

// Everything on the Structure page in one request.
r.get("/", perm("structure.view", "employees.view"), wrap(async (req, res) => {
  const q = t => req.db.from(t);
  const [d, p, a, x, pa, e, s] = await Promise.all([
    q("cff_departments").select("id,name,description,parent_id,sort").eq("company_id", req.companyId).order("sort").order("name"),
    can(req, "structure.view") ? q("cff_positions").select("*").eq("company_id", req.companyId).order("sort") : { data: [] },
    can(req, "structure.view") ? q("cff_decision_authority").select("*").eq("company_id", req.companyId).order("category").order("sort") : { data: [] },
    can(req, "structure.view") ? q("cff_raci").select("*").eq("company_id", req.companyId).order("sort") : { data: [] },
    can(req, "partners.view") ? q("cff_partners").select("id,full_name,designation,status").eq("company_id", req.companyId).eq("status", "active").order("created_at") : { data: [] },
    can(req, "employees.view") ? q("cff_employees").select("id,full_name,designation,department_id,reporting_manager_id,status").eq("company_id", req.companyId).eq("status", "active").order("full_name") : { data: [] },
    can(req, "partners.financial") ? q("cff_shareholding").select("*").eq("company_id", req.companyId) : { data: null }
  ]);
  res.json({
    departments: check(d, "departments"), positions: check(p, "positions"), authority: check(a, "authority"), raci: check(x, "raci"),
    partners: check(pa, "partners"), employees: check(e, "employees"), shareholding: s.data === null ? null : check(s, "shareholding"),
    can: { edit: can(req, "structure.edit"), financial: can(req, "partners.financial"), departments: can(req, "structure.edit") || can(req, "employees.manage") }
  });
}));

crud(r, { path: "/departments", table: "cff_departments", cols: "id,name,description,parent_id,sort", view: ["structure.view","employees.view"],
  edit: ["structure.edit","employees.manage"], removePerm: "structure.edit", required: ["name"], labels: { name: "Department name" }, order: [["sort"],["name"]],
  fields: { name: x => v.str(x, "Department name", 80), description: x => v.opt(x, "Description", 500), parent_id: x => v.uuid(x, "Parent department", { optional: true }), sort: x => v.int(x, "Order", 0, 1000) } });

// POST /structure/departments/standard — adds the usual departments that are missing.
r.post("/departments/standard", perm("structure.edit", "employees.manage"), wrap(async (req, res) => {
  const have = check(await req.db.from("cff_departments").select("name").eq("company_id", req.companyId), "departments").map(d => d.name.toLowerCase());
  const add = CAT.STANDARD_DEPARTMENTS.filter(n => !have.includes(n.toLowerCase())).map((name, i) => ({ company_id: req.companyId, name, sort: (i + 1) * 10 }));
  if(add.length) check(await req.db.from("cff_departments").insert(add), "add departments");
  res.json({ added: add.length });
}));

crud(r, { path: "/positions", table: "cff_positions", cols: "*", view: "structure.view", edit: "structure.edit", locked: LOCK5, required: ["designation"], labels: { designation: "Designation" }, order: [["sort"]],
  fields: {
    holder_type: x => v.oneOf(x, "Held by", ["partner","employee","vacant"]), partner_id: x => v.uuid(x, "Partner", { optional: true }),
    employee_id: x => v.uuid(x, "Employee", { optional: true }), holder_name: x => v.opt(x, "Name", 120), designation: x => v.str(x, "Designation", 120),
    department_id: x => v.uuid(x, "Department", { optional: true }), role: x => v.opt(x, "Role", 200), responsibilities: x => v.text(x, "Responsibilities", 4000),
    authority_level: x => v.oneOf(x, "Authority level", CAT.AUTHORITY_LEVELS.map(a => a[0]), { optional: true }), reports_to: x => v.uuid(x, "Reports to", { optional: true }),
    sort: x => v.int(x, "Order", 0, 1000)
  },
  beforeSave: async (req, row, isNew, before) => { if(row.reports_to && before && row.reports_to === before.id) throw new HttpError(400, "A role can't report to itself."); } });

crud(r, { path: "/authority", table: "cff_decision_authority", cols: "*", view: "structure.view", edit: "structure.edit", locked: LOCK5, required: ["category","decision"], labels: { decision: "Decision" }, order: [["category"],["sort"]],
  fields: { category: x => v.oneOf(x, "Category", CAT.AUTHORITY_CATEGORIES.map(a => a[0])), decision: x => v.str(x, "Decision", 300), decided_by: x => v.opt(x, "Decided by", 200),
    approval_needed: x => v.opt(x, "Approval needed from", 200), limit_note: x => v.opt(x, "Limit or condition", 300), sort: x => v.int(x, "Order", 0, 1000) } });

crud(r, { path: "/raci", table: "cff_raci", cols: "*", view: "structure.view", edit: "structure.edit", locked: LOCK5, required: ["task"], labels: { task: "Task or decision" }, order: [["sort"]],
  fields: { task: x => v.str(x, "Task or decision", 300), responsible: x => v.opt(x, "Responsible", 200), accountable: x => v.opt(x, "Accountable", 200),
    consulted: x => v.opt(x, "Consulted", 300), informed: x => v.opt(x, "Informed", 300), sort: x => v.int(x, "Order", 0, 1000) } });

// PUT /structure/shareholding { rows: [{ partner_id, percent, financial_contribution, time_contribution, responsibilities, long_term_commitment, value_contribution }] }
// The total may be below 100% while you are working on it, but never above; Stage 5 can only be approved at exactly 100%.
r.put("/shareholding", perm("partners.financial"), wrap(async (req, res) => {
  const list = Array.isArray((req.body || {}).rows) ? req.body.rows : null;
  if(!list) throw new HttpError(400, "Send the shareholding rows.");
  const st = check(await req.db.from("cff_stage_status").select("status").eq("company_id", req.companyId).eq("stage", 5).maybeSingle(), "stage 5");
  if(st && st.status === "approved") throw new HttpError(409, "Stage 5 is approved. Reopen it before changing the shareholding.");
  const partners = check(await req.db.from("cff_partners").select("id").eq("company_id", req.companyId), "partners").map(p => p.id);
  const rows = list.map(x => {
    const partner_id = v.uuid(x.partner_id, "Partner");
    if(!partners.includes(partner_id)) throw new HttpError(400, "Unknown partner.");
    return { company_id: req.companyId, partner_id, percent: v.num(x.percent === "" ? 0 : x.percent, "Shareholding %", { min: 0, max: 100 }),
      financial_contribution: v.text(x.financial_contribution, "Financial contribution", 2000), time_contribution: v.text(x.time_contribution, "Time contribution", 1000),
      responsibilities: v.text(x.responsibilities, "Responsibilities", 2000), long_term_commitment: v.text(x.long_term_commitment, "Long-term commitment", 1000),
      value_contribution: v.text(x.value_contribution, "Value contribution", 2000) };
  });
  const total = rows.reduce((a, b) => a + b.percent, 0);
  if(total > 100.0005) throw new HttpError(400, "Shareholding adds up to " + (+total.toFixed(3)) + "%. The total can't be more than 100%.");
  if(rows.length) check(await req.db.from("cff_shareholding").upsert(rows, { onConflict: "company_id,partner_id" }), "save shareholding");
  const saved = check(await req.db.from("cff_shareholding").select("*").eq("company_id", req.companyId), "shareholding");
  res.json({ shareholding: saved, total: +total.toFixed(3), complete: Math.abs(total - 100) < 0.001 });
}));

module.exports = r;
