// Stage 13 — KPIs (company and employee), results per period (history kept), and monthly /
// quarterly / annual reviews covering every Stage 13 area.
const express = require("express");
const { HttpError, wrap, check, v } = require("../lib/http");
const { perm, can } = require("../lib/auth");
const { crud } = require("../lib/crud");
const CAT = require("../../public/js/content/catalogs");
const { notify } = require("../lib/notify");

const r = express.Router({ mergeParams: true });   // /api/c/:companyId/kpis
const PERIOD = { monthly: /^\d{4}-(0[1-9]|1[0-2])$/, quarterly: /^\d{4}-Q[1-4]$/, annual: /^\d{4}$/ };

// GET /kpis/mine — the signed-in person's own KPIs (linked to their employee record) with their results.
r.get("/mine", wrap(async (req, res) => {
  const emp = check(await req.db.from("cff_employees").select("id").eq("company_id", req.companyId).eq("user_id", req.user.id), "my employee record").map(e => e.id);
  if(!emp.length) return res.json({ items: [] });
  const k = check(await req.db.from("cff_kpis").select("id,name,unit,target,direction,period_type,active").eq("company_id", req.companyId).in("employee_id", emp).eq("active", true).order("name"), "my kpis");
  const ids = k.map(x => x.id);
  const rs = ids.length ? check(await req.db.from("cff_kpi_results").select("kpi_id,period,target,actual,status,comments").in("kpi_id", ids).order("period", { ascending: false }), "my results") : [];
  res.json({ items: k.map(x => ({ ...x, results: rs.filter(y => y.kpi_id === x.id).slice(0, 12) })) });
}));

crud(r, { path: "/", table: "cff_kpis", cols: "*", view: "kpis.view", edit: "kpis.edit", required: ["name"], labels: { name: "KPI name" }, order: [["name"]],
  fields: {
    name: x => v.str(x, "KPI name", 120), department_id: x => v.uuid(x, "Department", { optional: true }), employee_id: x => v.uuid(x, "Employee", { optional: true }),
    owner_name: x => v.opt(x, "Owner", 120), unit: x => v.opt(x, "Unit", 40), target: x => v.num(x, "Target", { optional: true }),
    direction: x => v.oneOf(x, "Better when", ["higher","lower"]), period_type: x => v.oneOf(x, "Period", ["monthly","quarterly","annual"]), active: x => v.bool(x)
  } });

function autoStatus(kpi, target, actual){
  if(target === null || actual === null || target === 0) return null;
  const ratio = kpi.direction === "lower" ? target / actual : actual / target;
  return ratio >= 1 ? "on_track" : ratio >= 0.9 ? "at_risk" : "off_track";
}

// GET /kpis/results?kpi_id=  (all results, newest first; history is kept)
r.get("/results/all", perm("kpis.view"), wrap(async (req, res) => {
  let q = req.db.from("cff_kpi_results").select("*").eq("company_id", req.companyId);
  if(req.query.kpi_id) q = q.eq("kpi_id", v.uuid(req.query.kpi_id, "KPI"));
  res.json({ results: check(await q.order("period", { ascending: false }).limit(2000), "results") });
}));

// PUT /kpis/:id/results/:period { target, actual, status, comments, corrective_action }
r.put("/:id/results/:period", perm("kpis.edit"), wrap(async (req, res) => {
  const id = v.uuid(req.params.id, "KPI");
  const kpi = check(await req.db.from("cff_kpis").select("id,target,direction,period_type").eq("id", id).eq("company_id", req.companyId).maybeSingle(), "kpi");
  if(!kpi) throw new HttpError(404, "KPI not found.");
  const period = String(req.params.period);
  if(!PERIOD[kpi.period_type].test(period)) throw new HttpError(400, "Period must look like " + { monthly: "2026-09", quarterly: "2026-Q3", annual: "2026" }[kpi.period_type] + ".");
  const b = req.body || {};
  const target = b.target !== undefined ? v.num(b.target, "Target", { optional: true }) : (kpi.target === null ? null : Number(kpi.target));
  const actual = v.num(b.actual, "Actual", { optional: true });
  const status = b.status ? v.oneOf(b.status, "Status", ["on_track","at_risk","off_track"]) : autoStatus(kpi, target, actual);
  const row = { company_id: req.companyId, kpi_id: id, period, target, actual, status, comments: v.text(b.comments, "Comments", 3000),
    corrective_action: v.text(b.corrective_action, "Corrective action", 3000), recorded_by: req.user.id, recorded_at: new Date().toISOString() };
  const x = check(await req.db.from("cff_kpi_results").upsert(row, { onConflict: "kpi_id,period" }).select("*").single(), "save result");
  // Tell the employee when a result is recorded for their KPI.
  const k2 = check(await req.db.from("cff_kpis").select("name,employee_id").eq("id", id).maybeSingle(), "kpi owner");
  if(k2 && k2.employee_id){
    const e = check(await req.db.from("cff_employees").select("user_id").eq("id", k2.employee_id).maybeSingle(), "kpi employee");
    if(e && e.user_id && e.user_id !== req.user.id) await notify(req.companyId, [e.user_id], { kind: "kpi", title: "KPI update: " + k2.name, body: period + (status ? " · " + status.replace(/_/g, " ") : ""), link: "#/my/kpis", dedupe: "kpires-" + id + "-" + period + "-" + Date.now() });
  }
  res.json({ result: x });
}));

// Reviews
r.get("/reviews/all", perm("kpis.view"), wrap(async (req, res) => {
  res.json({ reviews: check(await req.db.from("cff_reviews").select("*").eq("company_id", req.companyId).order("period", { ascending: false }).limit(200), "reviews"),
             sections: CAT.REVIEW_SECTIONS, canEdit: can(req, "kpis.edit") });
}));

// PUT /kpis/reviews { review_type, period, sections: { goals: "...", ... }, summary }
r.put("/reviews", perm("kpis.edit"), wrap(async (req, res) => {
  const b = req.body || {};
  const type = v.oneOf(b.review_type, "Review type", ["monthly","quarterly","annual"]);
  const period = String(b.period || "");
  if(!PERIOD[type].test(period)) throw new HttpError(400, "Period must look like " + { monthly: "2026-09", quarterly: "2026-Q3", annual: "2026" }[type] + ".");
  const cur = check(await req.db.from("cff_reviews").select("sections").eq("company_id", req.companyId).eq("review_type", type).eq("period", period).maybeSingle(), "review");
  const sections = { ...((cur || {}).sections || {}), ...v.textMap(b.sections, CAT.REVIEW_SECTIONS.map(s => s[0]), 6000) };
  const x = check(await req.db.from("cff_reviews").upsert({ company_id: req.companyId, review_type: type, period, sections, summary: v.text(b.summary, "Summary", 6000), created_by: req.user.id },
    { onConflict: "company_id,review_type,period" }).select("*").single(), "save review");
  res.json({ review: x });
}));

module.exports = r;
