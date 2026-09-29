// Builds the smallest useful context for each AI request, from data the person is allowed to see.
// Never included: emails, phone numbers, passwords, keys, documents' contents or whole tables.
const summary = require("./summary");
const CAT = require("../../public/js/content/catalogs");
const { VALUE_LABELS } = require("../../public/js/content/bank");

const d = x => (x && x.data) || [];
const cut = (t, n) => { t = String(t || "").trim(); return t.length > n ? t.slice(0, n) + "…" : t; };

function companyLine(req){
  const c = req.company;
  return "Company: " + c.name + (c.industry ? " (" + c.industry + ")" : "") + (c.city ? ", " + c.city : "") + ". The person's role: " + (CAT.ROLE_LABEL[req.role] || req.role) + ".";
}

async function stageText(req, stages, per = 400){
  if(!req.perms.has("cff.view")) return "";
  const a = d(await req.db.from("cff_answers").select("point_id,answer,stage").eq("company_id", req.companyId).in("stage", stages));
  const by = Object.fromEntries(a.map(x => [x.point_id, (x.answer || "").trim()]));
  return stages.map(n => {
    const lines = summary.POINTS.filter(p => p.stage === n && by[p.id]).map(p => "- " + p.title + ": " + cut(by[p.id], per));
    const st = summary.STAGES.find(s => s.n === n);
    return lines.length ? "Stage " + n + " " + st.title + ":\n" + lines.join("\n") : "Stage " + n + " " + st.title + ": (nothing written yet)";
  }).join("\n\n");
}

function partnerText(p, financial){
  const lines = CAT.PARTNER_FIELDS.flatMap(g => g.fields).filter(([k]) => ((p.profile || {})[k] || "").trim()).map(([k, l]) => "- " + l + ": " + cut(p.profile[k], 350));
  if(financial){ if(financial.financial_contribution) lines.push("- Financial contribution: " + cut(financial.financial_contribution, 200)); if(financial.time_contribution) lines.push("- Time contribution: " + cut(financial.time_contribution, 200)); }
  return "Partner: " + p.full_name + (p.designation ? " — " + p.designation : "") + "\n" + (lines.length ? lines.join("\n") : "(profile is empty)");
}

async function valuesText(req, userId){
  const [a, t] = await Promise.all([
    req.db.from("cff_values_answers").select("user_id,question_no,slot,answer_text,value_slug,domain").eq("company_id", req.companyId).eq(userId ? "user_id" : "company_id", userId || req.companyId),
    req.db.from("cff_values_top").select("user_id,top_values").eq("company_id", req.companyId)
  ]);
  return { answers: d(a), tops: d(t) };
}

// Returns { context, prompt-extra } for a task, or throws if the person may not run it.
async function forTask(req, kind, params){
  const out = [companyLine(req)];
  const { VALUE_QUESTIONS } = require("../../public/js/content/data");
  if(kind === "values_analysis"){
    const { answers, tops } = await valuesText(req, req.user.id);
    out.push("My answers to the 13 values questions (answer [matched value, domain]):");
    VALUE_QUESTIONS.forEach((q, i) => {
      const x = answers.filter(a => a.question_no === i + 1 && (a.answer_text || "").trim());
      out.push("Q" + (i + 1) + " " + q + " -> " + (x.length ? x.map(a => a.answer_text + (a.value_slug ? " [" + (VALUE_LABELS[a.value_slug] || a.value_slug) + ", " + (a.domain || "") + "]" : "")).join("; ") : "(not answered)"));
    });
    const mine = tops.find(t => t.user_id === req.user.id);
    if(mine && mine.top_values) out.push("My own 'highest values' notes: " + cut(mine.top_values, 600));
  }
  if(["partner_summary","partner_strengths"].includes(kind)){
    const p = (await req.db.from("cff_partners").select("id,full_name,designation,profile").eq("company_id", req.companyId).eq("id", params.partnerId).maybeSingle()).data;
    if(!p) throw Object.assign(new Error("Partner not found."), { status: 404 });
    out.push(partnerText(p, null));
    out.push(await stageText(req, [1], 250));
  }
  if(kind === "partner_comparison"){
    const ps = d(await req.db.from("cff_partners").select("id,full_name,designation,profile").eq("company_id", req.companyId).eq("status", "active").order("created_at"));
    if(ps.length < 2) throw Object.assign(new Error("Add at least two partners to compare them."), { status: 400 });
    const fin = req.perms.has("partners.financial") ? Object.fromEntries(d(await req.db.from("cff_shareholding").select("partner_id,financial_contribution,time_contribution").eq("company_id", req.companyId)).map(x => [x.partner_id, x])) : {};
    ps.forEach(p => out.push(partnerText(p, fin[p.id])));
    out.push(await stageText(req, [1], 200));
  }
  if(kind === "values_alignment"){
    const { answers, tops } = await valuesText(req, null);
    const members = d(await req.db.from("cff_company_members").select("user_id,display_name").eq("company_id", req.companyId));
    const name = Object.fromEntries(members.map(m => [m.user_id, m.display_name || "Member"]));
    const people = [...new Set(answers.map(a => a.user_id))];
    if(!people.length) throw Object.assign(new Error("No one has answered the values questions yet."), { status: 400 });
    people.forEach(u => {
      const counts = {}; answers.filter(a => a.user_id === u && a.value_slug).forEach(a => { counts[a.value_slug] = (counts[a.value_slug] || 0) + 1; });
      const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s, n]) => (VALUE_LABELS[s] || s) + " (" + n + ")");
      const t = tops.find(x => x.user_id === u);
      out.push(name[u] + ": values from answers — " + (ranked.join(", ") || "none matched") + (t && t.top_values ? ". Their own top values: " + cut(t.top_values, 300) : ""));
    });
    out.push(await stageText(req, [1], 200));
  }
  if(kind === "master_profile"){
    out.push(await stageText(req, [1,2,3,4,5,6,7], 350));
    const vals = d(await req.db.from("cff_company_values").select("name,meaning,status").eq("company_id", req.companyId).order("sort"));
    if(vals.length) out.push("Company values:\n" + vals.map(v => "- " + v.name + (v.meaning ? ": " + cut(v.meaning, 200) : "") + (v.status !== "approved" ? " (draft)" : "")).join("\n"));
    const b = (await req.db.from("cff_brand").select("fields").eq("company_id", req.companyId).maybeSingle()).data;
    if(b && b.fields){ const f = b.fields; out.push("Brand: " + ["tagline","brand_personality","brand_voice"].filter(k => f[k]).map(k => k.replace(/_/g, " ") + ": " + cut(f[k], 200)).join("; ")); }
    const n = d(await req.db.from("cff_company_names").select("name,status").eq("company_id", req.companyId).eq("status", "selected"));
    if(n[0]) out.push("Selected company name: " + n[0].name);
  }
  if(kind === "plan_suggestions"){
    out.push(await stageText(req, [1,2,5,10], 250));
    const items = d(await req.db.from("cff_plan_items").select("title,plan").eq("company_id", req.companyId).eq("plan", params.plan));
    if(items.length) out.push("Items already in this plan (don't repeat them): " + items.map(i => i.title).join("; "));
  }
  if(kind === "recommendations"){
    const s = await summary.build(req.db, req.companyId);
    out.push("Progress: " + s.overall.pct + "% of sub-points complete; " + s.overall.approved + " of 13 stages approved.");
    out.push("Stages: " + summary.STAGES.map(st => st.n + ". " + st.title + " — " + s.stages[st.n].status.replace(/_/g, " ") + ", " + s.stages[st.n].pct + "%").join("; "));
    out.push("Partners: " + s.partners.active + " (" + s.partners.complete + " with complete profiles). Company values approved: " + s.values.approved + ". Master profile approved: " + (s.profile.approved ? "yes" : "no") +
      ". Name selected: " + (s.names.selected ? "yes" : "no") + ". Plan items: " + s.plans.count + ". Employees: " + s.people.employees + ". KPIs: " + s.kpis.count + ".");
    if(s.readiness.warnings.length) out.push("Readiness warnings: " + s.readiness.warnings.map(w => w.text).join(" "));
    out.push(await stageText(req, [1,2,5,6], 180));
  }
  if(kind === "stage_review"){
    const n = params.stage;
    out.push(await stageText(req, n > 1 ? [1, n] : [1], 400));
  }
  return out.filter(Boolean).join("\n\n").slice(0, 16000);
}

module.exports = { forTask, companyLine };
