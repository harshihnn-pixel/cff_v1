// Index of the original 13-stage Company Formation Framework (CFF CORE) and the values taxonomy
// used by the CFF Values Discovery Assessment. Content comes from content/data.js and content/bank.js.
(function(){
"use strict";
const CFF = window.CFF;

const POINTS = {}, STAGE_POINTS = {};
STAGES.forEach(s => {
  STAGE_POINTS[s.n] = [];
  s.groups.forEach((g, gi) => g.points.forEach((p, pi) => {
    const id = `s${s.n}-${gi}-${pi}`;
    POINTS[id] = { id, stage: s.n, gi, pi, group: g.name, title: p[0], d: p[1], q: [p[2], p[3]].filter(Boolean), flag: p[4] || "" };
    STAGE_POINTS[s.n].push(id);
  }));
});
const ORDER = STAGES.flatMap(s => STAGE_POINTS[s.n]);
const VALUES_POINT = ORDER.find(id => POINTS[id].flag === "values");
const stageBy = n => STAGES.find(s => s.n === +n);

/* ---------- values taxonomy ---------- */
const DOMAINS = VALUE_DOMAINS;
const dColor = d => `var(--d${DOMAINS.indexOf(d) + 1})`;
const BANK = ANSWER_BANK.map(([q, t, s, d, w, smp], i) => ({ i, q: q - 1, t, s, d, words: w.split(",").map(x => x.trim().toLowerCase()).filter(Boolean), sample: !!smp }));
const SLUG_DOMAIN = {}; BANK.forEach(b => { SLUG_DOMAIN[b.s] = b.d; });
const vLabel = s => VALUE_LABELS[s] || String(s || "").replace(/_/g, " ");
const KEYWORDS = {};
BANK.forEach(b => { const k = KEYWORDS[b.s] || (KEYWORDS[b.s] = new Set()); b.words.forEach(w => w.length >= 3 && k.add(w)); });
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const KW_RE = {}; Object.entries(KEYWORDS).forEach(([s, set]) => { KW_RE[s] = Array.from(set).map(w => new RegExp("(^|[^a-z])" + reEsc(w) + "(s|es)?($|[^a-z])")); });
// Matches a typed answer to one of the 38 values using the answer bank's similar words.
function detectValue(text, q){
  const t = (text || "").trim().toLowerCase(); if(!t) return "";
  const exact = BANK.find(b => b.t.toLowerCase() === t); if(exact) return exact.s;
  const inQ = new Set(BANK.filter(b => b.q === q).map(b => b.s));
  let best = "", score = 0;
  for(const s in KW_RE){
    let sc = 0; for(const re of KW_RE[s]) if(re.test(t)) sc++;
    if(sc && inQ.has(s)) sc += .5;
    if(sc > score){ score = sc; best = s; }
  }
  return best;
}
// Ranks values across a person's answers: { ranked:[{s,d,n,qs}], doms:{}, unmatched, total }
function tally(vals){
  const out = {}, doms = {}; let unmatched = 0, total = 0;
  for(let q = 0; q < 13; q++) (vals[q] || []).forEach(a => {
    if(!a || !(a.t || "").trim()) return; total++;
    if(!a.s){ unmatched++; return; }
    const v = out[a.s] || (out[a.s] = { s: a.s, d: SLUG_DOMAIN[a.s], n: 0, qs: new Set() }); v.n++; v.qs.add(q + 1);
    doms[v.d] = (doms[v.d] || 0) + 1;
  });
  const ranked = Object.values(out).sort((a, b) => b.n - a.n || b.qs.size - a.qs.size || vLabel(a.s).localeCompare(vLabel(b.s)));
  return { ranked, doms, unmatched, total };
}

CFF.fw = { POINTS, STAGE_POINTS, ORDER, VALUES_POINT, stageBy, TOTAL: ORDER.length,
  DOMAINS, dColor, BANK, SLUG_DOMAIN, vLabel, detectValue, tally };
})();
