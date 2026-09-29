// CFF CORE: the original 13 stages, their sub-points, auto-saved answers, the approval workflow
// (Submit → Approve / Request changes → Reopen), readiness guidance and version history.
(function(){
"use strict";
const CFF = window.CFF;
const { $, $$, esc, I, toast, ring, bar, statusPill, pill, fmtDateTime, ago, notice, modal, confirmBox, pad, cut } = CFF.util;
const S = CFF.state, F = CFF.fw;

async function loadCff(){ const d = await CFF.api.c.get("/cff"); CFF.cache.stages = d.stages; CFF.cache.answers = d.answers; CFF.cache.cffPerms = { edit: d.canEdit, approve: d.canApprove }; return d; }
const pointStatus = (answers, id) => { const a = answers[id]; if(!a) return "todo"; if(a.done) return "done"; if((a.text || "").trim()) return "started"; return "todo"; };
const markEl = st => `<span class="mark ${st}" aria-label="${st === "done" ? "Complete" : st === "started" ? "In progress" : "Not started"}">${I.check}</span>`;
const stageStatus = (stages, n) => (stages[n] || {}).status || "not_started";
const pointHref = id => id === F.VALUES_POINT ? "#/values" : `#/cff/${F.POINTS[id].stage}/${id}`;
function stagePct(answers, n){ const ids = F.STAGE_POINTS[n]; const done = ids.filter(id => pointStatus(answers, id) === "done").length; return { done, total: ids.length, pct: Math.round(done / ids.length * 100) }; }

/* ---------- all stages ---------- */
CFF.route("cff", { title: "The 13 stages", perm: ["cff.view"], async render(el){
  const d = await loadCff();
  const rows = STAGES.map(s => { const pr = stagePct(d.answers, s.n); const st = stageStatus(d.stages, s.n);
    return `<a href="#/cff/${s.n}" class="srow"><span class="sn ${st === "approved" ? "done" : ""}">${pad(s.n)}</span>
      <span class="st">${esc(s.title)}<small class="muted">${pr.total} sub-points${CATALOGS.STAGE_TOOLS[s.n] ? " · " + esc(CATALOGS.STAGE_TOOLS[s.n].label) : ""}</small></span>
      <span class="sp">${bar(pr.pct, st === "approved" ? "good" : "")}<b class="num">${pr.pct}%</b></span><span class="ss">${statusPill(st)}</span></a>`; }).join("");
  el.innerHTML = CFF.pageHead({ label: "CFF core", title: INTRO.title, lead: esc(INTRO.subtitle) + ". The original framework: every stage, in order. Each stage is approved by the founders when it is complete." }) + `
    <section class="card flush"><div class="stage-table">${rows}</div></section>
    <section class="card intro"><div class="prose"><p class="big">${esc(INTRO.paragraphs[0])}</p><p>${esc(INTRO.paragraphs[1])}</p><p class="quote">${esc(INTRO.closing)}</p></div>
      <div class="jtiles" role="list">${INTRO.journey.map(([k, v]) => `<div class="jtile" role="listitem"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join("")}</div></section>
    <p class="muted prose">${esc(INTRO.summary)}</p>`;
}});

/* ---------- approval bar ---------- */
function approvalBar(n, st, perms){
  const s = st.status || "not_started";
  const btn = [];
  if(perms.edit && ["not_started", "draft", "in_progress", "reopened"].includes(s)) btn.push(`<button class="btn sm" data-act="submit">${I.flag} Submit for review</button>`);
  if(perms.approve && s !== "approved") btn.push(`<button class="btn sm ${s === "ready_for_review" ? "" : "secondary"}" data-act="approve">${I.check} Approve stage</button>`);
  if(perms.approve && s === "ready_for_review") btn.push(`<button class="btn secondary sm" data-act="request-changes">Request changes</button>`);
  if(perms.approve && s === "approved") btn.push(`<button class="btn secondary sm" data-act="reopen">Reopen</button>`);
  return `<div class="approval card"><div class="stack" style="gap:4px;min-width:0"><span class="label">Stage status</span><div class="row">${statusPill(s)}
    ${st.approved_at && s === "approved" ? `<span class="muted small">Approved ${esc(fmtDateTime(st.approved_at))}</span>` : st.submitted_at && s === "ready_for_review" ? `<span class="muted small">Submitted ${esc(ago(st.submitted_at))}</span>` : ""}</div>
    ${st.comment ? `<span class="muted small">“${esc(cut(st.comment, 160))}”</span>` : ""}</div>
    <div class="row">${btn.join("")}<button class="btn quiet sm" data-act="history">${I.history} History</button></div></div>`;
}
async function stageAction(n, act){
  if(act === "history") return showHistory(n);
  const titles = { submit: "Submit Stage " + n + " for review", approve: "Approve Stage " + n, "request-changes": "Request changes to Stage " + n, reopen: "Reopen Stage " + n };
  const notes = { submit: "Owners and approvers will be notified.", approve: "Approving locks this stage. A snapshot is kept in the history. It can be reopened later.",
    "request-changes": "Explain what needs to change. The stage goes back to In progress.", reopen: "Reopening unlocks the stage for editing. The approved snapshot stays in the history." };
  let warnings = "";
  if(act === "approve"){
    try{ const dd = await CFF.api.c.get("/dashboard"); const w = READINESS.forStage(dd.readiness, n); if(w.length) warnings = notice("Readiness guidance: " + w.map(x => esc(x.text)).join(" "), "bad"); }catch(e){}
  }
  const r = await modal({ title: titles[act], body: `<p class="muted">${esc(notes[act])}</p>${warnings}<div class="field"><label for="stc">Comment${act === "request-changes" ? " (required)" : " (optional)"}</label><textarea class="input" id="stc" rows="3" maxlength="2000"></textarea></div>`,
    actions: [{ label: "Cancel", value: null, kind: "secondary" }, { label: titles[act].split(" Stage")[0], submit: true, run: async d => {
      const comment = $("#stc", d).value.trim();
      if(act === "request-changes" && !comment) throw new Error("Write what needs to change.");
      return CFF.api.c.post(`/cff/stages/${n}/${act}`, { comment });
    } }] });
  if(r){ toast({ submit: "Submitted for review.", approve: "Stage approved.", "request-changes": "Changes requested.", reopen: "Stage reopened." }[act]); CFF.cache.stages = null; CFF.render(); CFF.refreshBell(); }
}
const ORDER_OF = ans => F.ORDER.filter(id => ans[id] && (ans[id].answer || "").trim()).map(id => [id, ans[id]]);
async function showHistory(n){
  const d = await CFF.api.c.get(`/cff/stages/${n}/history`);
  const L = { submit: "Submitted for review", approve: "Approved", request_changes: "Requested changes", reopen: "Reopened" };
  await modal({ title: "Stage " + n + " history", wide: true, body:
    `<h3>Reviews</h3>${d.reviews.length ? `<div class="timeline">${d.reviews.map(r => `<div><b>${esc(L[r.action] || r.action)}</b> by ${esc(r.actor_name || "a member")} <span class="muted small">${esc(fmtDateTime(r.created_at))}</span>${r.comment ? `<p class="muted">${esc(r.comment)}</p>` : ""}</div>`).join("")}</div>` : `<p class="muted">No reviews yet.</p>`}
     <h3 style="margin-top:16px">Approved snapshots</h3>${d.snapshots.length ? d.snapshots.map(s => { const ans = s.new_value || {};
      return `<details class="mini"><summary>Approved ${esc(fmtDateTime(s.changed_at))} by ${esc(s.changed_by_name || "a member")}</summary>${ORDER_OF(ans).map(([id, x]) => `<p><b>${esc((F.POINTS[id] || {}).title || id)}:</b> ${esc(x.answer)}</p>`).join("") || '<p class="muted">No answers in this snapshot.</p>'}</details>`; }).join("") : `<p class="muted">No approved snapshots yet.</p>`}` });
}

/* ---------- one stage ---------- */
CFF.route("cff/:n", { title: "Stage", perm: ["cff.view"], async render(el, p){
  const n = +p.n; const s = F.stageBy(n); if(!s) return CFF.go("#/cff");
  const d = await loadCff();
  const st = d.stages[n] || { status: "not_started" };
  const pr = stagePct(d.answers, n);
  const prev = F.stageBy(n - 1), next = F.stageBy(n + 1);
  let readiness = [];
  try{ const dd = await CFF.api.c.get("/dashboard"); readiness = dd.readiness.warnings.filter(w => w.stage === n); }catch(e){}
  const tool = CATALOGS.STAGE_TOOLS[n];
  const groups = s.groups.map((g, gi) => {
    const rows = g.points.map((pt, pi) => { const id = `s${n}-${gi}-${pi}`; const P = F.POINTS[id]; const stt = pointStatus(d.answers, id); const vp = id === F.VALUES_POINT;
      return `<a href="${pointHref(id)}">${markEl(stt)}<span style="min-width:0"><span class="t">${esc(P.title)}</span><span class="d">${esc(P.d)}</span></span>
        <span class="hide-sm">${vp ? pill("CFF Values Discovery Assessment", "accent") : stt === "done" ? pill("Complete", "good") : stt === "started" ? pill("In progress", "warn") : pill("Not started")}</span><span class="chev">${I.chev}</span></a>`; }).join("");
    return `<section class="card flush"><div class="card-head"><div class="stack" style="gap:2px"><h2>${esc(g.name)}</h2>${g.note ? `<span class="muted small">${esc(g.note)}</span>` : ""}</div><span class="muted small">${g.points.length} points</span></div><div class="list group-list">${rows}</div></section>`;
  }).join("");
  el.innerHTML = `<nav class="crumbs" aria-label="Breadcrumb"><a href="#/cff">CFF</a><span class="s">/</span><span>Stage ${n}</span></nav>
    <header class="stage-head"><div class="stage-badge"><small>STAGE</small><b>${pad(n)}</b></div>
      <div class="page-head"><h1>${esc(s.title)}</h1><p class="lead">${esc(s.intro)}</p>
        <div class="row" style="max-width:460px">${bar(pr.pct)}<span class="muted small" style="font-weight:650;white-space:nowrap">${pr.done} of ${pr.total} complete</span></div></div></header>
    ${approvalBar(n, st, { edit: d.canEdit, approve: d.canApprove })}
    ${readiness.length ? `<div class="wlist">${readiness.map(w => `<a class="wlink ${w.level === "error" ? "bad" : ""}" href="#/${esc(w.link)}">${I.warn}<span>${esc(w.text)}</span>${I.chev}</a>`).join("")}</div>` : ""}
    ${st.status === "approved" ? notice(`${I.lock} This stage is approved and locked. ${d.canApprove ? "Reopen it to make changes." : "Ask an approver to reopen it if something needs to change."}`) : ""}
    ${tool ? `<a class="card tool-card" href="#/${esc(tool.route)}"><span class="ic">${I.layers}</span><span class="stack" style="gap:2px;min-width:0"><b>${esc(tool.label)}</b><span class="muted small">A digital workspace for this stage (a CFF extension). Your answers below stay the core.</span></span>${I.arrow}</a>` : ""}
    ${s.sequence ? `<section class="card stack"><h3>The complete journey</h3><div class="seq">${s.sequence.map(x => `<span>${esc(x)}</span>`).join("<i>→</i>")}</div><p class="muted">Every stage should be documented.</p></section>` : ""}
    ${groups}
    ${s.closing ? `<p class="closing">${esc(s.closing)}</p>` : ""}
    <div id="stageAi"></div>
    <nav class="pager" aria-label="Stages">
      ${prev ? `<a href="#/cff/${prev.n}"><small>${I.back} Stage ${prev.n}</small><b>${esc(prev.title)}</b></a>` : `<a href="#/cff"><small>${I.back} Back</small><b>All stages</b></a>`}
      ${next ? `<a class="next" href="#/cff/${next.n}"><small>Stage ${next.n} ${I.arrow}</small><b>${esc(next.title)}</b></a>` : ""}
    </nav>`;
  $$(".approval [data-act]", el).forEach(b => b.addEventListener("click", () => stageAction(n, b.dataset.act).catch(e => toast(e.message, "bad"))));
  if(S.can("ai.use")) CFF.ai.outputCard($("#stageAi"), { kind: "stage_review", params: { stage: n }, subject: String(n), title: "AI stage review", button: "Review this stage",
    intro: "Before approving, ask the AI to look for missing information and inconsistencies with earlier stages." });
  CFF.ai.page({ label: `Stage ${n} · ${s.title}`, suggestions: ["Explain this stage in simple words", "Which point should we do first?", "Give me a real example of this stage"],
    context: () => `CURRENT PAGE: Stage ${n} "${s.title}". Status: ${st.status}. Intro: ${s.intro}\nPoints: ` + s.groups.map(g => g.name + ": " + g.points.map(x => x[0]).join(", ")).join(" | ") +
      "\nAnswers so far:\n" + F.STAGE_POINTS[n].filter(id => d.answers[id] && (d.answers[id].text || "").trim()).map(id => "- " + F.POINTS[id].title + ": " + cut(d.answers[id].text, 250)).join("\n") });
}});

/* ---------- one sub-point ---------- */
CFF.route("cff/:n/:point", { title: "CFF point", perm: ["cff.view"], async render(el, p){
  const id = p.point, P = F.POINTS[id];
  if(!P || P.stage !== +p.n) return CFF.go("#/cff/" + p.n);
  if(id === F.VALUES_POINT) return CFF.go("#/values");
  const d = await loadCff();
  const s = F.stageBy(P.stage); const a = d.answers[id] || {};
  const st = stageStatus(d.stages, P.stage);
  const locked = st === "approved", canEdit = d.canEdit && !locked;
  const ids = F.STAGE_POINTS[P.stage]; const idx = ids.indexOf(id); const prevId = ids[idx - 1], nextId = ids[idx + 1];
  let lastG = -1;
  const sibs = ids.map(x => { const Q = F.POINTS[x]; let h = "";
    if(Q.gi !== lastG && s.groups.length > 1){ h = `<div class="g">${esc(Q.group)}</div>`; lastG = Q.gi; }
    return h + `<a href="${pointHref(x)}" ${x === id ? 'aria-current="page"' : ""}>${markEl(pointStatus(d.answers, x))}<span>${esc(Q.title)}</span></a>`; }).join("");
  const nextStage = F.stageBy(P.stage + 1);
  const has = !!(a.text || "").trim();
  el.innerHTML = `<nav class="crumbs" aria-label="Breadcrumb"><a href="#/cff">CFF</a><span class="s">/</span><a href="#/cff/${P.stage}">Stage ${P.stage}: ${esc(s.title)}</a><span class="s">/</span><span>${esc(P.group)}</span></nav>
    <header class="page-head"><span class="label">Stage ${P.stage} · Point ${idx + 1} of ${ids.length} · ${statusPill(st).replace(/<[^>]+>/g, "")}</span><h1>${esc(P.title)}</h1></header>
    <div class="point-layout">
      <div class="stack" style="gap:20px;min-width:0">
        <section class="card stack"><h3>What this means</h3><p style="font-size:1.05rem">${esc(P.d)}</p>
          ${P.q.length ? `<h3 style="margin-top:6px">Questions to think about</h3><ol class="qs">${P.q.map(q => `<li>${esc(q)}</li>`).join("")}</ol>` : ""}</section>
        ${P.flag === "link-values" ? `<a class="card callout" href="#/values">${I.sparkle}<div class="stack" style="gap:4px"><b>Start from the CFF Values Discovery Assessment</b><span class="muted small">Your 13-question answers show which values matter most to you and your partners.</span></div></a>` : ""}
        <section class="card stack">
          <div class="row" style="justify-content:space-between"><label for="ptText"><h3>Your company's answer</h3></label>
            ${canEdit && S.can("ai.use") ? `<button class="btn secondary sm" type="button" data-ai-ask="${has ? "Review our answer for this point and suggest a stronger version." : "Help me write our answer for this point."}">${I.sparkle} ${has ? "Improve with AI" : "Help me write this"}</button>` : ""}</div>
          ${locked ? notice(`${I.lock} Stage ${P.stage} is approved, so this answer is locked.`) : !d.canEdit ? notice("You can read this answer. Your role can't edit the CFF.") : ""}
          <textarea class="input" id="ptText" rows="10" maxlength="20000" ${canEdit ? "" : "readonly"} placeholder="${canEdit ? "Write your answer here. It saves automatically." : ""}">${esc(a.text || "")}</textarea>
          <div class="row" style="justify-content:space-between">
            <label class="check"><input type="checkbox" id="ptDone" ${a.done ? "checked" : ""} ${canEdit ? "" : "disabled"}> Mark this point complete</label>
            <div class="row"><span class="save-state" data-save aria-live="polite">${a.updated ? "Last saved " + esc(ago(a.updated)) : "Not saved yet"}</span><button class="btn quiet sm" id="verBtn" type="button">${I.history} Versions</button></div>
          </div>
        </section>
        <nav class="pager" aria-label="Points">
          ${prevId ? `<a href="${pointHref(prevId)}"><small>${I.back} Previous</small><b>${esc(F.POINTS[prevId].title)}</b></a>` : `<a href="#/cff/${P.stage}"><small>${I.back} Back</small><b>Stage ${P.stage}</b></a>`}
          ${nextId ? `<a class="next" href="${pointHref(nextId)}"><small>Next ${I.arrow}</small><b>${esc(F.POINTS[nextId].title)}</b></a>`
            : nextStage ? `<a class="next" href="#/cff/${nextStage.n}"><small>Next stage ${I.arrow}</small><b>${esc(nextStage.title)}</b></a>` : `<a class="next" href="${CFF.home()}"><small>Finish ${I.arrow}</small><b>Dashboard</b></a>`}
        </nav>
      </div>
      <aside class="card flush sib" aria-label="Points in this stage"><div class="g">Stage ${P.stage} points</div>${sibs}</aside>
    </div>`;
  const ta = $("#ptText"), cb = $("#ptDone");
  const saver = CFF.saver("answer:" + id, v => CFF.api.c.put("/cff/answers/" + id, v).then(r => { CFF.cache.stages = null; return r; }), 700);
  const val = () => ({ text: ta.value, done: cb.checked });
  if(canEdit){
    ta.addEventListener("input", () => saver.queue(val()));
    cb.addEventListener("change", async () => { saver.queue(val()); if(await saver.flush()) toast(cb.checked ? "Marked complete" : "Marked not complete"); });
  }
  $("#verBtn").addEventListener("click", () => showVersions(id).catch(e => toast(e.message, "bad")));
  const others = F.STAGE_POINTS[P.stage].filter(x => x !== id && d.answers[x] && (d.answers[x].text || "").trim());
  CFF.ai.page({ label: `Stage ${P.stage} · ${P.title}`, insert: canEdit ? text => { ta.value = ta.value.trim() ? ta.value.replace(/\s+$/, "") + "\n\n" + text : text; ta.dispatchEvent(new Event("input")); ta.focus(); } : null,
    suggestions: ["Explain this point with an example", has ? "Review our answer and suggest a stronger version" : "Help me write our answer for this point", "What questions should we ask ourselves here?"],
    context: () => `CURRENT PAGE: Stage ${P.stage} "${s.title}" > ${P.group} > point "${P.title}".\nStage intro: ${s.intro}\nWhat this point means: ${P.d}\nGuiding questions: ${P.q.join(" / ")}\nThe current answer: ${ta.value.trim() ? cut(ta.value, 3000) : "(empty)"}` +
      (others.length ? `\nOther answers in Stage ${P.stage}:\n` + others.map(x => "- " + F.POINTS[x].title + ": " + cut(d.answers[x].text, 250)).join("\n") : "") +
      (P.stage > 1 && CFF.cache.answers ? "\nStage 1 answers:\n" + F.STAGE_POINTS[1].filter(x => d.answers[x] && (d.answers[x].text || "").trim()).map(x => "- " + F.POINTS[x].title + ": " + cut(d.answers[x].text, 200)).join("\n") : "") });
}});

async function showVersions(id){
  const d = await CFF.api.c.get("/cff/versions?key=" + encodeURIComponent(id));
  await modal({ title: "Version history · " + F.POINTS[id].title, wide: true, body: d.versions.length ? `<p class="muted small">Every saved change is kept. Changes made within a few minutes by the same person are grouped.</p><div class="timeline">${d.versions.map(v => `<div><div class="row" style="justify-content:space-between"><b>${esc(v.changed_by_name || "A member")}</b><span class="muted small">${esc(fmtDateTime(v.changed_at))}</span></div>
      <div class="diff"><div><span class="label">Previous</span><p>${esc(typeof v.old_value === "string" ? v.old_value : "") || '<span class="muted">(empty)</span>'}</p></div><div><span class="label">New</span><p>${esc(typeof v.new_value === "string" ? v.new_value : "") || '<span class="muted">(empty)</span>'}</p></div></div></div>`).join("")}</div>`
    : `<p class="muted">No earlier versions yet.</p>` });
}
CFF.cffHelpers = { loadCff, pointStatus, stagePct };
})();
