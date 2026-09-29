// Readiness guidance: warnings, the recommended next step and missing information.
// Shared by the website and the server. It guides the founders; it only blocks approval
// when the company turns on "Enforce readiness rules" in Settings.
const READINESS = (() => {
  const KEY_POINTS = [["s1-0-0","Business idea",1],["s1-0-1","Vision",1],["s1-0-2","Mission",1],["s1-0-4","Purpose of the company",1],
                      ["s1-0-5","Problem being solved",1],["s1-0-6","Customer need",1],["s1-0-3","End goal",1]];

  // s = summary from the server: { stages: {1:{status,pct,answered,total}}, partners:{active,complete}, shares:{count,total},
  //   values:{approved,draft}, profile:{approved,drafts}, names:{selected,shortlisted}, brand:{started,assets}, plans:{count},
  //   compliance:{required,done,started}, people:{employees,departments}, kpis:{count}, keyAnswered:{pointId:true} }
  function evaluate(s, stages){
    const st = n => (s.stages && s.stages[n]) || { status: "not_started", pct: 0, answered: 0, total: 0 };
    const approved = n => st(n).status === "approved";
    const started = n => st(n).answered > 0 || st(n).status !== "not_started";
    const title = n => { const x = (stages || []).find(y => y.n === n); return x ? x.title : "Stage " + n; };
    const w = [];
    const add = (stage, text, link, level) => w.push({ stage, text, link, level: level || "warn" });

    if(((s.brand && (s.brand.started || s.brand.assets)) || started(9)) && !approved(6))
      add(9, "You are finalizing Brand Identity before Company Values are approved.", "cff/6");
    if(s.shares && s.shares.count > 0 && s.partners && s.partners.complete < s.partners.active)
      add(5, "Complete Partner Profiles before finalizing Shareholding.", "company/partners");
    if(s.shares && s.shares.count > 0 && Math.abs(s.shares.total - 100) > 0.001)
      add(5, "Shareholding adds up to " + (+s.shares.total.toFixed(3)) + "%. It must total exactly 100%.", "company/structure", "error");
    if(((s.compliance && s.compliance.started) || started(11)) && !approved(10))
      add(11, "Business Planning should be reviewed before Company Registration.", "cff/10");
    const notApproved16 = [1,2,3,4,5,6].filter(n => !approved(n));
    if(s.profile && (s.profile.drafts || s.profile.approved) && notApproved16.length)
      add(7, "The Master Profile is built from Stages 1–6, and " + notApproved16.length + " of them " + (notApproved16.length === 1 ? "is" : "are") + " not approved yet (Stage " + notApproved16.join(", ") + ").", "cff/" + notApproved16[0]);
    if(s.names && s.names.selected && !approved(7))
      add(8, "You selected a company name before the Master Company Profile is approved.", "company/profile");
    if(s.people && s.people.employees > 0 && !(s.values && s.values.approved))
      add(12, "Approve your company values before onboarding employees, so they learn the final values.", "company/values");
    if(s.partners && s.partners.active === 0 && (started(3) || started(4) || started(5)))
      add(3, "Add your partners so Stages 3, 4 and 5 can use their profiles.", "company/partners");
    if(approved(12) && s.kpis && s.kpis.count === 0)
      add(13, "Set up KPIs so you can start Stage 13 reviews.", "execution/kpis", "info");

    // Recommended next step: the first stage that is not approved yet.
    let next = null;
    for(let n = 1; n <= 13; n++){
      const x = st(n);
      if(x.status === "approved") continue;
      if(x.status === "ready_for_review") next = { stage: n, text: "Review and approve Stage " + n + ": " + title(n), link: "cff/" + n };
      else if(!x.answered) next = { stage: n, text: "Start Stage " + n + ": " + title(n), link: "cff/" + n };
      else next = { stage: n, text: "Continue Stage " + n + ": " + title(n) + " (" + x.pct + "% complete)", link: "cff/" + n };
      break;
    }
    if(!next) next = { stage: 13, text: "All 13 stages are approved. Keep reviewing KPIs and improving (Stage 13).", link: "execution/kpis" };

    const missing = [];
    KEY_POINTS.forEach(([id, label, n]) => { if(!(s.keyAnswered && s.keyAnswered[id])) missing.push({ stage: n, text: label + " is empty", link: "cff/" + n + "/" + id }); });
    if(s.partners && s.partners.active === 0) missing.push({ stage: 3, text: "No partners added yet", link: "company/partners" });
    if(s.values && !s.values.approved) missing.push({ stage: 6, text: "No approved company values yet", link: "company/values" });
    if(s.shares && s.shares.count === 0 && s.partners && s.partners.active > 0) missing.push({ stage: 5, text: "Shareholding not set", link: "company/structure" });
    if(!(s.profile && s.profile.approved)) missing.push({ stage: 7, text: "No approved Master Company Profile", link: "company/profile" });
    if(!(s.names && s.names.selected)) missing.push({ stage: 8, text: "No company name selected", link: "company/names" });
    return { warnings: w, next, missing };
  }

  // Warnings that belong to one stage (used to block approval when rules are enforced).
  function forStage(result, n){ return result.warnings.filter(x => x.stage === n && x.level !== "info"); }

  return { evaluate, forStage, KEY_POINTS };
})();

if(typeof module !== "undefined" && module.exports) module.exports = READINESS;
