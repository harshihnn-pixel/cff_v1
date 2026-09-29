// CFF Values Discovery Assessment (Stage 3 → Partner Resources → Values): 13 questions, 3 answers each,
// the answer bank with filters, results by value and domain, "my highest values", and the AI analysis.
// Each member of the company takes it for themselves; founders compare the results in Company Values.
(function(){
"use strict";
const CFF = window.CFF;
const { $, $$, esc, I, toast, ring, store, md, notice, ago } = CFF.util;
const S = CFF.state, F = CFF.fw;

let DATA = null;
const VS = Object.assign({ q: 0, tab: "answer", dom: "All", samplesOnly: false, resDom: "All" }, store.get("cff:vs") || {}, { search: "" });
const saveVS = () => store.set("cff:vs", { q: VS.q, tab: VS.tab, dom: VS.dom, samplesOnly: VS.samplesOnly, resDom: VS.resDom });
const filled = q => DATA.vals[q].filter(a => a.t.trim()).length;
function counts(){ let answers = 0, full = 0; for(let i = 0; i < 13; i++){ const a = filled(i); answers += a; if(a === 3) full++; } return { answers, full }; }
const savers = {};
function saveQuestion(q, now){
  const s = savers[q] || (savers[q] = CFF.saver("values:" + q, v => CFF.api.c.put("/values/me/" + (q + 1), { answers: v }), 700));
  s.queue(DATA.vals[q].map(a => ({ t: a.t, s: a.s, d: a.s ? F.SLUG_DOMAIN[a.s] : "" })));
  if(now) s.flush();
}
const dotC = d => `<span class="dot" style="background:${F.dColor(d)}"></span>`;

CFF.route("values", { title: "Values Discovery", async render(el){
  const d = await CFF.api.c.get("/values/me");
  DATA = { vals: {}, top: d.top || "", analysis: d.analysis };
  for(let q = 0; q < 13; q++){ const raw = d.answers[q] || []; DATA.vals[q] = [0, 1, 2].map(j => { const a = raw[j] || {}; const t = a.t || ""; return { t, s: a.s || F.detectValue(t, q) }; }); }
  const v = counts();
  el.innerHTML = `<nav class="crumbs" aria-label="Breadcrumb">${S.can("cff.view") ? `<a href="#/cff/3">Stage 3</a><span class="s">/</span><span>Partner Resources</span><span class="s">/</span>` : ""}<span>Values</span></nav>
    <header class="page-head row-head"><div class="stack" style="gap:6px"><span class="label">CFF Values Discovery Assessment</span><h1>The 13 questions that reveal your highest values</h1>
      <p class="lead">How you use your space, time, energy and money shows what truly matters to you. Give 3 answers to each question. Pick from the answer bank or write your own; each answer is matched to one of 38 values in 8 domains. Your answers are yours; founders see them when comparing partner values.</p></div>
      ${S.can("values.view") ? `<div class="row head-actions"><a class="btn secondary sm" href="#/company/values">Company values ${I.arrow}</a></div>` : ""}</header>
    <div class="row" style="justify-content:space-between">
      <div class="tabs" role="tablist"><button role="tab" data-tab="answer" aria-selected="${VS.tab === "answer"}">Answer the questions</button><button role="tab" data-tab="results" aria-selected="${VS.tab === "results"}">Your results</button></div>
      <div class="stack" style="gap:0;align-items:flex-end"><span class="muted" style="font-weight:650" id="vProg">${v.answers} / 39 answers · ${v.full} of 13 complete</span><span class="save-state" data-save aria-live="polite"></span></div>
    </div>
    <div id="vbody"></div>`;
  $$(".tabs [data-tab]", el).forEach(b => b.addEventListener("click", () => { VS.tab = b.dataset.tab; saveVS(); $$(".tabs [data-tab]", el).forEach(x => x.setAttribute("aria-selected", x === b)); draw(); }));
  draw();
  CFF.ai.page({ label: "Values Discovery", suggestions: VS.tab === "results" ? ["Explain my values results", "What do my top 3 values mean for our company?", "Which of my values could clash with a partner's?"] : ["Help me think about this question", "Give me more answer ideas for this question", "What do my answers say about me so far?"],
    context: () => "CURRENT PAGE: CFF Values Discovery Assessment (Stage 3 > Partner Resources > Values), " + (VS.tab === "results" ? "results tab" : "question " + (VS.q + 1) + ": " + VALUE_QUESTIONS[VS.q]) + ". 3 answers per question; each answer is matched to one of 38 values in 8 domains.\nMy answers:\n" +
      VALUE_QUESTIONS.map((q, i) => { const x = DATA.vals[i].filter(a => a.t.trim()); return "Q" + (i + 1) + " " + q + " -> " + (x.length ? x.map(a => a.t + (a.s ? " [" + F.vLabel(a.s) + ", " + F.SLUG_DOMAIN[a.s] + "]" : "")).join("; ") : "(not answered)"); }).join("\n") +
      (DATA.top.trim() ? "\nMy highest values (my notes): " + DATA.top.slice(0, 600) : "") });
}});

function draw(){ if(VS.tab === "results") drawResults(); else drawAnswer(); }
function refreshCounts(){
  const v = counts(); const p = $("#vProg"); if(p) p.textContent = `${v.answers} / 39 answers · ${v.full} of 13 complete`;
  $$(".step").forEach(s => { const q = +s.dataset.q, f = filled(q); s.classList.toggle("full", f === 3); s.classList.toggle("partial", f > 0 && f < 3); s.setAttribute("aria-label", `Question ${q + 1}, ${f} of 3 answered`); });
}
function goQuestion(q){ if(savers[VS.q]) savers[VS.q].flush(); VS.q = q; saveVS(); drawAnswer(); }

function drawAnswer(){
  const q = VS.q, A = DATA.vals[q];
  $("#vbody").innerHTML = `
    <nav class="stepper" aria-label="Questions">${VALUE_QUESTIONS.map((_, i) => `<button class="step" data-q="${i}" ${i === q ? 'aria-current="step"' : ""}>${i + 1}</button>`).join("")}</nav>
    <div class="vgrid">
      <section class="card qcard stack" style="gap:16px">
        <span class="label">Question ${q + 1} of 13</span><h2>${esc(VALUE_QUESTIONS[q])}</h2>
        <div class="think">${I.think}<span>Think again before you answer.</span></div>
        ${S.can("ai.use") ? `<button class="btn secondary sm" type="button" style="align-self:flex-start" data-ai-ask="Help me think about this question. Ask me a couple of simple questions and suggest a few honest answers I might give.">${I.sparkle} Ask AI about this question</button>` : ""}
        <div class="slots">${[0, 1, 2].map(j => `
          <div class="slot ${A[j].t.trim() ? "filled" : ""}"><span class="no">${j + 1}</span>
            <div><input class="input" id="ans-${j}" data-j="${j}" value="${esc(A[j].t)}" placeholder="Answer ${j + 1}" aria-label="Answer ${j + 1}" autocomplete="off" maxlength="300"><div class="meta" id="meta-${j}"></div></div>
            <button class="icon-btn clear" data-j="${j}" aria-label="Clear answer ${j + 1}" title="Clear">${I.x}</button></div>`).join("")}</div>
        <div class="qnav"><button class="btn secondary" id="qPrev" ${q === 0 ? "disabled" : ""}>${I.back} Previous</button>
          ${q < 12 ? `<button class="btn" id="qNext">Next question ${I.arrow}</button>` : `<button class="btn" id="qDone">See your results ${I.arrow}</button>`}</div>
      </section>
      <section class="card bank" aria-labelledby="bankh">
        <div class="bank-head"><h3 id="bankh">Answer bank</h3><span class="muted small" id="bankCount"></span></div>
        <div class="search">${I.search}<label class="sr-only" for="bankSearch">Search the answer bank</label><input class="input" id="bankSearch" type="search" placeholder="Search answers or words, e.g. gym, family" value="${esc(VS.search)}"></div>
        <div class="chips" id="domChips" role="group" aria-label="Filter by domain"></div>
        <label class="toggle"><input type="checkbox" id="smpOnly" ${VS.samplesOnly ? "checked" : ""}> Show only the top suggestions</label>
        <div class="sugs" id="sugs"></div>
      </section>
    </div>`;
  refreshCounts(); [0, 1, 2].forEach(drawMeta); drawBank();
  $$(".step").forEach(b => b.addEventListener("click", () => goQuestion(+b.dataset.q)));
  $$(".slot .input").forEach(inp => inp.addEventListener("input", () => {
    const j = +inp.dataset.j; DATA.vals[q][j] = { t: inp.value, s: F.detectValue(inp.value, q) };
    inp.closest(".slot").classList.toggle("filled", !!inp.value.trim()); drawMeta(j); refreshCounts(); markSugs(); saveQuestion(q);
  }));
  $$(".slot .clear").forEach(b => b.addEventListener("click", () => setSlot(+b.dataset.j, "", "")));
  $("#qPrev").addEventListener("click", () => goQuestion(Math.max(0, q - 1)));
  const nx = $("#qNext"); if(nx) nx.addEventListener("click", () => { goQuestion(q + 1); window.scrollTo({ top: $(".stepper").getBoundingClientRect().top + scrollY - 90 }); });
  const dn = $("#qDone"); if(dn) dn.addEventListener("click", () => { if(savers[q]) savers[q].flush(); VS.tab = "results"; saveVS(); $$(".tabs [data-tab]").forEach(x => x.setAttribute("aria-selected", x.dataset.tab === "results")); drawResults(); });
  let t; $("#bankSearch").addEventListener("input", e => { clearTimeout(t); t = setTimeout(() => { VS.search = e.target.value; drawBank(); }, 120); });
  $("#smpOnly").addEventListener("change", e => { VS.samplesOnly = e.target.checked; saveVS(); drawBank(); });
}
function drawMeta(j){
  const a = DATA.vals[VS.q][j]; const m = $("#meta-" + j); if(!m) return;
  if(!a.t.trim()){ m.innerHTML = ""; return; }
  m.innerHTML = a.s ? `<span>Value:</span><span class="vtag">${dotC(F.SLUG_DOMAIN[a.s])}${esc(F.vLabel(a.s))}</span><span>· ${esc(F.SLUG_DOMAIN[a.s])}</span>` : `<span>No value matched yet. Try a clearer word, or pick from the answer bank.</span>`;
}
function setSlot(j, t, s){
  const q = VS.q; DATA.vals[q][j] = { t, s };
  const inp = $("#ans-" + j); if(inp){ inp.value = t; inp.closest(".slot").classList.toggle("filled", !!t.trim()); }
  drawMeta(j); refreshCounts(); markSugs(); saveQuestion(q, true);
}
function bankMatches(){
  const term = VS.search.trim().toLowerCase();
  let rows = F.BANK.filter(b => b.q === VS.q);
  if(VS.samplesOnly) rows = rows.filter(b => b.sample);
  if(term) rows = rows.filter(b => b.t.toLowerCase().includes(term) || F.vLabel(b.s).toLowerCase().includes(term) || b.words.some(w => w.includes(term)));
  return rows;
}
function drawBank(){
  const base = bankMatches(); const c = {}; base.forEach(b => { c[b.d] = (c[b.d] || 0) + 1; });
  const chips = [["All", base.length], ...F.DOMAINS.filter(d => c[d]).map(d => [d, c[d]])];
  if(VS.dom !== "All" && !c[VS.dom]) chips.push([VS.dom, 0]);
  $("#domChips").innerHTML = chips.map(([d, n]) => `<button class="chipf" data-d="${esc(d)}" aria-pressed="${VS.dom === d}">${d !== "All" ? dotC(d) : ""}${esc(d)} <span class="c">${n}</span></button>`).join("");
  $$("#domChips .chipf").forEach(b => b.addEventListener("click", () => { VS.dom = b.dataset.d; saveVS(); drawBank(); }));
  const rows = (VS.dom === "All" ? base : base.filter(b => b.d === VS.dom)).sort((a, b) => (b.sample - a.sample) || a.t.localeCompare(b.t));
  $("#bankCount").textContent = `${rows.length} of ${F.BANK.filter(b => b.q === VS.q).length} answers`;
  $("#sugs").innerHTML = rows.length ? rows.map(b => `<button class="sug" data-i="${b.i}" aria-pressed="false"><span><span class="st">${esc(b.t)}</span><span class="sm">${dotC(b.d)}${esc(F.vLabel(b.s))} · ${esc(b.d)}${b.sample ? ' · <b style="color:var(--accent)">Top pick</b>' : ""}</span></span><span class="plus">${I.plus}</span></button>`).join("")
    : `<div class="empty">No answers match these filters. Clear the search or choose another domain, or type your own answer.</div>`;
  $$("#sugs .sug").forEach(b => b.addEventListener("click", () => pickSug(F.BANK[+b.dataset.i])));
  markSugs();
}
function markSugs(){
  const cur = DATA.vals[VS.q].map(a => a.t.trim().toLowerCase());
  $$("#sugs .sug").forEach(b => { const on = cur.includes(F.BANK[+b.dataset.i].t.toLowerCase()); b.setAttribute("aria-pressed", on); b.querySelector(".plus").innerHTML = on ? I.check : I.plus; });
}
function pickSug(b){
  const A = DATA.vals[VS.q]; const k = A.findIndex(a => a.t.trim().toLowerCase() === b.t.toLowerCase());
  if(k >= 0) return setSlot(k, "", "");
  const j = A.findIndex(a => !a.t.trim());
  if(j < 0) return toast("All 3 answers are filled. Clear one to choose another.");
  setSlot(j, b.t, b.s);
}

/* ---------- results ---------- */
function valuesHash(){ return CFF.util.hash(Array.from({ length: 13 }, (_, q) => DATA.vals[q].map(a => a.t.trim().toLowerCase()).join("|")).join("#")); }
function drawResults(){
  const T = F.tally(DATA.vals);
  if(!T.total){ $("#vbody").innerHTML = `<section class="card stack" style="align-items:flex-start"><h2>No answers yet</h2><p class="muted">Answer the 13 questions first. Your results show which values come up most often across your answers.</p><button class="btn" id="goAns">Start answering ${I.arrow}</button></section>`;
    $("#goAns").addEventListener("click", () => { VS.tab = "answer"; saveVS(); $$(".tabs [data-tab]").forEach(x => x.setAttribute("aria-selected", x.dataset.tab === "answer")); drawAnswer(); }); return; }
  if(VS.resDom !== "All" && !T.doms[VS.resDom]) VS.resDom = "All";
  const list = VS.resDom === "All" ? T.ranked : T.ranked.filter(v => v.d === VS.resDom);
  const max = Math.max(1, ...T.ranked.map(v => v.n)), dmax = Math.max(1, ...Object.values(T.doms));
  const chips = [["All", T.ranked.length], ...F.DOMAINS.filter(d => T.doms[d]).map(d => [d, T.ranked.filter(v => v.d === d).length])];
  const topNames = T.ranked.slice(0, 5).map(v => F.vLabel(v.s));
  $("#vbody").innerHTML = `
    <section class="card ai-analysis" aria-labelledby="aih"><div class="ai-an-head"><span class="ai-an-mark">${I.sparkle}</span>
      <div class="stack" style="gap:2px;flex:1;min-width:0"><h2 id="aih">AI analysis of your values</h2><span class="muted small">Written by AI from your ${T.total} answer${T.total > 1 ? "s" : ""}. It updates when you ask.</span></div>
      <div class="row" id="aiAnActions"></div></div><div class="ai-an-body" id="aiAnBody" aria-live="polite"></div></section>
    <div class="res-grid">
      <section class="card stack" aria-labelledby="rankh"><div class="stack" style="gap:4px"><h2 id="rankh">Your highest values</h2><p class="muted small">Values that come up in more of your answers rank higher. The numbers show how many answers point to each value.</p></div>
        <div class="chips" id="resChips" role="group" aria-label="Filter results by domain">${chips.map(([d, c]) => `<button class="chipf" data-d="${esc(d)}" aria-pressed="${VS.resDom === d}">${d !== "All" ? dotC(d) : ""}${esc(d)} <span class="c">${c}</span></button>`).join("")}</div>
        <div class="rank">${list.map(v => { const r = T.ranked.indexOf(v) + 1;
          return `<div class="rrow ${r <= 3 ? "top" : ""}" title="${esc(F.vLabel(v.s))}: ${v.n} answers, in questions ${[...v.qs].join(", ")}"><span class="rn">${r}</span>
            <span class="rv">${esc(F.vLabel(v.s))}<small>${dotC(v.d)}${esc(v.d)} · Q${[...v.qs].join(", Q")}</small></span>
            <span class="track"><i style="width:${Math.max(6, v.n / max * 100)}%;background:${F.dColor(v.d)}"></i></span><span class="rc">${v.n}</span></div>`; }).join("")}</div>
        ${T.unmatched ? `<p class="muted small">${T.unmatched} answer${T.unmatched > 1 ? "s" : ""} did not match a value. Edit them or pick from the answer bank to include them.</p>` : ""}</section>
      <div class="stack" style="gap:20px">
        <section class="card stack" aria-labelledby="domh"><h3 id="domh">Answers by domain</h3>
          <div>${F.DOMAINS.filter(d => T.doms[d]).sort((a, b) => T.doms[b] - T.doms[a]).map(d => `<div class="drow"><b>${dotC(d)}${esc(d)}</b><span class="track"><i style="width:${T.doms[d] / dmax * 100}%;background:${F.dColor(d)}"></i></span><span class="c">${T.doms[d]}</span></div>`).join("")}</div></section>
        <section class="card stack"><label for="topVals"><h3>My highest values</h3></label>
          <p class="muted small" style="margin-top:-6px">Look at your ranking and write your top values in order of importance.</p>
          <textarea class="input" id="topVals" rows="6" maxlength="5000" placeholder="1.&#10;2.&#10;3.">${esc(DATA.top || "")}</textarea>
          <div class="row"><button class="btn secondary sm" id="fillTop">Fill with my top ${topNames.length}</button></div></section>
      </div>
    </div>
    <details class="card flush answers"><summary>All your answers by question <span class="muted">${T.total} of 39</span></summary>
      ${CFF.util.table(["#", "Question", "Answers and values"], VALUE_QUESTIONS.map((qq, i) => [String(i + 1), esc(qq),
        DATA.vals[i].filter(a => a.t.trim()).map(a => `<div>${esc(a.t)} <span class="vtag">${a.s ? dotC(F.SLUG_DOMAIN[a.s]) + esc(F.vLabel(a.s)) : "no value matched"}</span></div>`).join("") || '<span class="muted">Not answered</span>']))}</details>`;
  $$("#resChips .chipf").forEach(b => b.addEventListener("click", () => { VS.resDom = b.dataset.d; saveVS(); drawResults(); }));
  renderAnalysis();
  const top = $("#topVals"); const ts = CFF.saver("values:top", text => CFF.api.c.put("/values/me/top", { text }), 700);
  top.addEventListener("input", () => { DATA.top = top.value; ts.queue(top.value); });
  $("#fillTop").addEventListener("click", () => { top.value = topNames.map((n, i) => `${i + 1}. ${n}`).join("\n"); DATA.top = top.value; ts.queue(top.value); ts.flush(); });
}

const AN = { busy: false, ctl: null, text: "", err: "" };
async function renderAnalysis(){
  const body = $("#aiAnBody"), act = $("#aiAnActions"); if(!body || !act) return;
  const st = S.can("ai.use") ? await CFF.ai.status() : { ready: false, message: "Your role doesn't include the AI assistant." };
  if(!$("#aiAnBody")) return;
  const saved = DATA.analysis;
  const thinking = `<div class="ai-thinking"><span></span><span></span><span></span> Reading your answers and writing your analysis…</div>`;
  if(AN.busy){ body.innerHTML = AN.text ? md(AN.text) : thinking; act.innerHTML = `<button class="btn secondary sm" id="anStop" type="button">Stop</button>`; $("#anStop").addEventListener("click", () => AN.ctl && AN.ctl.abort()); return; }
  let html = "", buttons = "";
  if(saved){
    const stale = saved.hash !== valuesHash();
    if(stale) html += notice("Your answers have changed since this analysis was written. Update it to include them.");
    html += `<div class="ai-an-text">${md(saved.content)}</div><p class="muted small">Written ${esc(ago(saved.updated))}. AI can make mistakes; use it as a starting point for your own reflection.</p>`;
    if(st.ready) buttons = `<button class="btn ${stale ? "" : "secondary"} sm" id="anRun" type="button">${I.sparkle} ${stale ? "Update analysis" : "Rewrite"}</button>`;
  } else if(!st.ready) html = notice(esc(st.message || "The AI isn't available right now."));
  else { html = `<p class="muted">Get a personal reading of your values: your top values, what they say about you, your strengths, what to watch out for, and what they mean for your company.</p>`; buttons = `<button class="btn sm" id="anRun" type="button">${I.sparkle} Write my AI analysis</button>`; }
  if(AN.err) html = `<p class="ai-error">${esc(AN.err)}</p>` + html;
  if(st.ready) buttons += `<button class="btn secondary sm" type="button" data-ai-ask="I have a question about my values analysis.">Ask a follow-up</button>`;
  body.innerHTML = html; act.innerHTML = buttons;
  const run = $("#anRun"); if(run) run.addEventListener("click", runAnalysis);
}
async function runAnalysis(){
  if(AN.busy) return;
  await Promise.all(Object.values(savers).map(s => s.flush()));
  const hash = valuesHash();
  AN.busy = true; AN.text = ""; AN.err = ""; AN.ctl = new AbortController(); renderAnalysis();
  try{
    const text = await CFF.ai.generate("values_analysis", { hash }, t => { AN.text = t; renderAnalysis(); }, AN.ctl.signal);
    if(/\(The answer was interrupted/.test(text)) AN.err = "The analysis was interrupted. Please try again.";
    else if(text.trim()) DATA.analysis = { content: text, hash, updated: Date.now() };
  }catch(e){ AN.err = e.name === "AbortError" ? "Stopped. Your previous analysis (if any) is kept." : e.message; }
  finally{ AN.busy = false; AN.ctl = null; renderAnalysis(); }
}
})();
