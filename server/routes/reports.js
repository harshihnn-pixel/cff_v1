// Reports: CFF Master Report (preview JSON and Word export), Progress report and KPI report.
const express = require("express");
const { wrap, check } = require("../lib/http");
const { perm } = require("../lib/auth");
const report = require("../lib/report");
const docx = require("../lib/docx");
const summary = require("../lib/summary");
const CAT = require("../../public/js/content/catalogs");

const r = express.Router({ mergeParams: true });   // /api/c/:companyId/reports

r.get("/master", perm("reports.view"), wrap(async (req, res) => {
  res.json(await report.build(req, req.query.drafts === "1"));
}));

// Word (.docx) export of the Master Report.
r.get("/master.docx", perm("reports.view"), wrap(async (req, res) => {
  const rep = await report.build(req, req.query.drafts === "1");
  const blocks = [{ type: "title", text: "CFF Master Report — " + rep.company },
    { type: "note", text: "Generated " + new Date(rep.generated_at).toLocaleString("en-IN") + (rep.include_drafts ? " · includes draft (unapproved) information" : " · approved information only") }];
  rep.sections.forEach(s => {
    blocks.push({ type: "h1", text: s.n + ". " + s.title });
    s.blocks.forEach(b => blocks.push(b.type === "h" ? { type: "h2", text: b.text } : b));
  });
  const buf = docx.build(blocks);
  const file = ("CFF-Master-Report-" + rep.company).replace(/[^\w\-]+/g, "-").replace(/-+/g, "-").slice(0, 80) + ".docx";
  res.set({ "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": 'attachment; filename="' + file + '"',
            "Content-Length": buf.length, "Cache-Control": "private, no-store" });
  res.end(buf);
}));

// Progress report: every stage with status, completion and review history.
r.get("/progress", perm("reports.view"), wrap(async (req, res) => {
  const s = await summary.build(req.db, req.companyId);
  const reviews = check(await req.db.from("cff_stage_approvals").select("stage,action,comment,actor_name,created_at").eq("company_id", req.companyId).order("created_at", { ascending: false }).limit(200), "reviews");
  res.json({ overall: s.overall, readiness: s.readiness,
    stages: summary.STAGES.map(st => ({ n: st.n, title: st.title, ...s.stages[st.n], reviews: reviews.filter(x => x.stage === st.n).slice(0, 5) })) });
}));

// KPI report: every KPI with its full result history.
r.get("/kpi", perm("reports.view", "kpis.view"), wrap(async (req, res) => {
  const [k, rs, d] = await Promise.all([
    req.db.from("cff_kpis").select("*").eq("company_id", req.companyId).order("name"),
    req.db.from("cff_kpi_results").select("*").eq("company_id", req.companyId).order("period"),
    req.db.from("cff_departments").select("id,name").eq("company_id", req.companyId)
  ]);
  const dept = Object.fromEntries(check(d, "departments").map(x => [x.id, x.name]));
  const results = check(rs, "results");
  res.json({ kpis: check(k, "kpis").map(x => ({ ...x, department: dept[x.department_id] || "", results: results.filter(r => r.kpi_id === x.id) })) });
}));

module.exports = r;
