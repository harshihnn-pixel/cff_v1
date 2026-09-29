// Visitor Portal: what CFF is, how the 13 stages work, the benefits and a demo company.
// Completely separate from real company data: everything here is static, fictional example content.
(function(){
"use strict";
const CFF = window.CFF;
const { $, $$, esc, I, ring, bar, pill, statusPill, pad, nl, notice } = CFF.util;

const DEMO = {
  name: "Green Leaf Kitchens (demo)",
  industry: "Healthy meal subscriptions", city: "Hyderabad",
  vision: "Every working person in India eats a fresh, healthy home-style meal every day.",
  mission: "We cook and deliver affordable, nutritious lunches on time, every working day, using local ingredients.",
  purpose: "To make healthy eating the easy choice for busy people.",
  values: [["Health first", "We never compromise on the nutrition and freshness of our food."], ["Honesty", "Clear prices, clear ingredients, no hidden charges."], ["Reliability", "Lunch arrives on time, every time."], ["Care for local farmers", "We buy locally and pay fairly."]],
  stages: { 1: ["approved", 100], 2: ["approved", 100], 3: ["approved", 100], 4: ["approved", 100], 5: ["ready_for_review", 90], 6: ["approved", 100], 7: ["in_progress", 70], 8: ["in_progress", 60], 9: ["draft", 30], 10: ["draft", 20], 11: ["not_started", 0], 12: ["not_started", 0], 13: ["not_started", 0] },
  tasks: [["Finalise the menu for the first month", "In progress"], ["Shortlist 3 names and check trademarks manually", "Not started"], ["Meet a CA about the company structure", "Not started"]],
  plans: [["First customer strategy", "Offer a 1-week free trial to 3 office buildings"], ["Marketing plan", "Instagram page with daily menu photos"], ["Operations plan", "Central kitchen with 2 delivery partners"]]
};

// Public navigation only — the internal application sidebar is never shown to visitors.
function header(active){
  const signed = CFF.api.loggedIn();
  const link = (href, label, key) => `<a class="btn ${active === key ? "" : "quiet"} sm" href="${href}" ${active === key ? 'aria-current="page"' : ""}>${label}</a>`;
  return `<div class="visitor-bar"><a class="brand" href="#/visitor"><span class="logo">CFF</span>Visitor Portal</a>
    <nav class="row visitor-nav" aria-label="Visitor">${link("#/visitor", "About CFF", "about")}${link("#/visitor?s=stages", "13 Stages", "stages")}${link("#/visitor?s=benefits", "Benefits", "benefits")}${link("#/visitor/demo", "Demo Company", "demo")}
    ${signed ? `<a class="btn secondary sm" href="#/">My workspace</a>` : `<a class="btn secondary sm" href="#/login?portal=visitor">Login</a><a class="btn secondary sm" href="#/signup?portal=visitor">Create Account</a>`}
    <a class="btn sm" href="${signed ? "#/start?new=1" : "#/signup?portal=business"}">Start a Company</a></nav></div>`;
}

CFF.route("visitor", { public: true, portal: "visitor", title: "Visitor Portal", render(el, p, q){
  el.innerHTML = `<main class="home">${header(q.s || "about")}
    <header class="home-hero"><span class="label">What is CFF?</span><h1>${esc(INTRO.title)}: ${esc(INTRO.subtitle)}</h1><p>${esc(INTRO.paragraphs[0])}</p></header>
    <section class="card stack" id="problem"><h2>What problem CFF solves</h2>
      <p>Most companies are started in the wrong order: a name and a logo before a clear purpose, shares split before partners know what each brings, registration before a plan, and hiring before anyone has written down the values or the way work is done.</p>
      <p>CFF gives founders one clear, documented path from the idea to a registered, running and growing company — so partners stay aligned, decisions are recorded, and the team understands the vision from day one.</p></section>
    <section class="card intro"><div class="prose"><h2>The CFF journey</h2><p>${esc(INTRO.paragraphs[1])}</p><p class="quote">${esc(INTRO.closing)}</p></div>
      <div class="jtiles" role="list">${INTRO.journey.map(([k, v]) => `<div class="jtile" role="listitem"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join("")}</div></section>
    <section class="stack" id="stages"><h2>How the 13 stages work</h2><div class="stage-cards">${STAGES.map(s => `<details class="card stage-card"><summary><span class="sn">${pad(s.n)}</span><b>${esc(s.title)}</b></summary>
      <p class="muted">${esc(s.intro)}</p><ul>${s.groups.map(g => `<li><b>${esc(g.name)}:</b> ${esc(g.points.map(p => p[0]).join(", "))}</li>`).join("")}</ul></details>`).join("")}</div></section>
    <section class="stack" id="benefits"><h2>Benefits</h2><div class="arch">${[["One clear path", "From idea to a registered, running company, in the right order."], ["Founders aligned", "Partner profiles, values and structure agreed before money and equity questions get hard."],
      ["A living company", "Plans, tasks, compliance, team and KPIs continue after formation."], ["Everything documented", "A Master Report, version history and audit log for every decision."], ["AI that assists", "Explanations, drafts and reviews. You stay in control and approve everything."]].map(([t, d]) => `<div class="card arch-card"><b>${esc(t)}</b><span>${esc(d)}</span></div>`).join("")}</div></section>
    <section class="arch">${CFF.ARCH.map(([t, d]) => `<div class="card arch-card"><b>${esc(t)}</b><span>${esc(d)}</span></div>`).join("")}</section>
    <section class="card cta"><div class="stack" style="gap:6px"><h2>Try it</h2><p class="muted">Explore a demo company, or create an account and start your own company workspace.</p></div>
      <div class="row"><a class="btn secondary" href="#/visitor/demo">Try the demo</a><a class="btn" href="${CFF.api.loggedIn() ? "#/start?new=1" : "#/signup?portal=business"}">Start a company workspace ${I.arrow}</a></div></section>
  </main>`;
  if(q.s){ const t = $("#" + q.s); if(t) setTimeout(() => t.scrollIntoView({ block: "start" }), 30); }
}});

CFF.route("visitor/demo", { public: true, portal: "visitor", title: "Demo company", render(el){
  const approved = Object.values(DEMO.stages).filter(x => x[0] === "approved").length;
  const pct = Math.round(Object.values(DEMO.stages).reduce((a, x) => a + x[1], 0) / 13);
  el.innerHTML = `<main class="home">${header("demo")}
    ${notice("<b>Demo company – no real company information.</b> Everything on this page is fictional example content.")}
    <section class="card hero"><div class="stack" style="gap:8px;min-width:0"><span class="label">Demo · Founder dashboard</span><h1>${esc(DEMO.name)}</h1><p class="lens">${esc(DEMO.industry)} · ${esc(DEMO.city)} · ${approved} of 13 stages approved</p>
      <div class="next-step"><span class="label">Recommended next step</span><span class="btn" aria-disabled="true">Review and approve Stage 5: Company Structure &amp; Growth Roadmap</span></div></div>
      <div class="ring-wrap">${ring(pct / 100)}<span class="muted small">Overall CFF completion</span></div></section>
    <div class="dash-grid">
      <section class="card flush span2"><div class="card-head"><h2>13-stage progress</h2></div><div class="stage-table">${STAGES.map(s => { const [st, p] = DEMO.stages[s.n];
        return `<div class="srow"><span class="sn ${st === "approved" ? "done" : ""}">${s.n}</span><span class="st">${esc(s.title)}</span><span class="sp">${bar(p, st === "approved" ? "good" : "")}<b class="num">${p}%</b></span><span class="ss">${statusPill(st)}</span></div>`; }).join("")}</div></section>
      <section class="card stack"><h2>Vision, mission & purpose</h2><dl class="kv"><dt>Vision</dt><dd>${esc(DEMO.vision)}</dd><dt>Mission</dt><dd>${esc(DEMO.mission)}</dd><dt>Purpose</dt><dd>${esc(DEMO.purpose)}</dd></dl></section>
      <section class="card stack"><h2>Company values</h2><div class="val-grid">${DEMO.values.map(([n, m]) => `<div class="val-card"><b>${esc(n)}</b><p>${esc(m)}</p></div>`).join("")}</div></section>
      <section class="card stack"><h2>Plans (examples)</h2><div class="mini-list">${DEMO.plans.map(([t, d]) => `<div><b>${esc(t)}</b><span class="muted small block">${esc(d)}</span></div>`).join("")}</div></section>
      <section class="card stack"><h2>Tasks (examples)</h2><div class="mini-list">${DEMO.tasks.map(([t, s]) => `<div><b>${esc(t)}</b><span class="muted small block">${esc(s)}</span></div>`).join("")}</div></section>
      <section class="card stack span2"><h2>Try a question from Stage 1</h2><p class="muted">${esc(STAGES[0].groups[0].points[1][0])}: ${esc(STAGES[0].groups[0].points[1][1])}</p>
        <label for="demoAns" class="label">Your answer (not saved in the demo)</label><textarea class="input" id="demoAns" rows="3" placeholder="Try writing your own vision…"></textarea>
        <div class="row"><a class="btn" href="${CFF.api.loggedIn() ? "#/start?new=1" : "#/signup?portal=business"}">Start my own company workspace ${I.arrow}</a></div></section>
    </div>
    <p class="muted small">Partner financial contributions, ownership, private documents, internal decisions, employee details and financial plans are never shown in the Visitor Portal.</p>
  </main>`;
}});
})();
