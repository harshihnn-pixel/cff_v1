// Company progress summary: per-stage completion, status and the inputs for readiness guidance.
const { STAGES } = require("../../public/js/content/data");
const CAT = require("../../public/js/content/catalogs");
const READINESS = require("../../public/js/content/readiness");

const POINTS = [];                       // [{ id, stage, title, group, d }]
STAGES.forEach(s => s.groups.forEach((g, gi) => g.points.forEach((p, pi) => POINTS.push({ id: `s${s.n}-${gi}-${pi}`, stage: s.n, title: p[0], d: p[1], group: g.name, flag: p[4] || "" }))));
const POINT = Object.fromEntries(POINTS.map(p => [p.id, p]));
const STAGE_TOTAL = Object.fromEntries(STAGES.map(s => [s.n, POINTS.filter(p => p.stage === s.n).length]));
const VALUES_POINT = POINTS.find(p => p.flag === "values").id;

const rows = r => (r && r.data) || [];

// db = a Supabase client (the person's, so they only see what they may see; or admin for checks).
async function build(db, companyId){
  const q = t => db.from(t);
  const [ans, st, partners, shares, values, profiles, names, brand, assets, plans, comp, emps, depts, kpis, valuesAns] = await Promise.all([
    q("cff_answers").select("point_id,answer,done,stage").eq("company_id", companyId),
    q("cff_stage_status").select("stage,status,submitted_at,approved_at,comment").eq("company_id", companyId),
    q("cff_partners").select("id,profile,status").eq("company_id", companyId).eq("status", "active"),
    q("cff_shareholding").select("percent").eq("company_id", companyId),
    q("cff_company_values").select("status").eq("company_id", companyId),
    q("cff_company_profiles").select("status").eq("company_id", companyId),
    q("cff_company_names").select("status").eq("company_id", companyId),
    q("cff_brand").select("fields").eq("company_id", companyId),
    q("cff_brand_assets").select("kind").eq("company_id", companyId),
    q("cff_plan_items").select("id").eq("company_id", companyId),
    q("cff_compliance_items").select("applicability,status").eq("company_id", companyId),
    q("cff_employees").select("id").eq("company_id", companyId).eq("status", "active"),
    q("cff_departments").select("id").eq("company_id", companyId),
    q("cff_kpis").select("id").eq("company_id", companyId).eq("active", true),
    q("cff_values_answers").select("user_id,answer_text").eq("company_id", companyId)
  ]);
  const answers = rows(ans);
  const statusRows = Object.fromEntries(rows(st).map(s => [s.stage, s]));
  const stages = {};
  STAGES.forEach(s => {
    const a = answers.filter(x => x.stage === s.n);
    const done = a.filter(x => x.done).length + (s.n === 3 && rows(valuesAns).filter(x => x.answer_text).length >= 39 ? 1 : 0);
    const answered = a.filter(x => (x.answer || "").trim() || x.done).length;
    const total = STAGE_TOTAL[s.n];
    const sr = statusRows[s.n] || {};
    stages[s.n] = { status: sr.status || "not_started", pct: Math.round(Math.min(done, total) / total * 100), done: Math.min(done, total), answered, total,
                    submitted_at: sr.submitted_at || null, approved_at: sr.approved_at || null, comment: sr.comment || null };
  });
  const complete = p => CAT.PARTNER_KEYS.filter(k => ((p.profile || {})[k] || "").trim()).length / CAT.PARTNER_KEYS.length >= 0.6;
  const sh = rows(shares);
  const fields = (rows(brand)[0] || {}).fields || {};
  const cs = rows(comp);
  const s = {
    stages,
    partners: { active: rows(partners).length, complete: rows(partners).filter(complete).length },
    shares: { count: sh.filter(x => Number(x.percent) > 0).length, total: sh.reduce((a, b) => a + Number(b.percent || 0), 0) },
    values: { approved: rows(values).filter(v => v.status === "approved").length, draft: rows(values).filter(v => v.status === "draft").length },
    profile: { approved: rows(profiles).some(p => p.status === "approved"), drafts: rows(profiles).filter(p => p.status === "draft").length },
    names: { selected: rows(names).some(n => n.status === "selected"), shortlisted: rows(names).filter(n => n.status === "shortlisted").length, total: rows(names).length },
    brand: { started: Object.values(fields).some(x => (x || "").trim()), assets: rows(assets).length },
    plans: { count: rows(plans).length },
    compliance: { required: cs.filter(c => c.applicability === "required").length, done: cs.filter(c => c.applicability === "required" && c.status === "approved").length,
                  started: cs.some(c => c.status !== "not_started" || c.applicability !== "pending_verification") },
    people: { employees: rows(emps).length, departments: rows(depts).length },
    kpis: { count: rows(kpis).length },
    keyAnswered: Object.fromEntries(answers.filter(a => (a.answer || "").trim()).map(a => [a.point_id, true]))
  };
  const done = Object.values(stages).reduce((a, x) => a + x.done, 0);
  const total = POINTS.length;
  s.overall = { done, total, pct: Math.round(done / total * 100), approved: Object.values(stages).filter(x => x.status === "approved").length };
  s.readiness = READINESS.evaluate(s, STAGES);
  return s;
}

module.exports = { build, POINTS, POINT, STAGE_TOTAL, VALUES_POINT, STAGES };
