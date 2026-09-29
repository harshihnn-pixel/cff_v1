// CFF AI Assistant (Google Gemini, through the server). The chat panel knows the company, the page
// and the person's role. It only suggests: drafts are inserted into a field only when the person
// clicks "Insert", and nothing is saved or approved by the AI.
(function(){
"use strict";
const CFF = window.CFF;
const { $, $$, esc, I, toast, md } = CFF.util;
const S = CFF.state;

const A = { open: false, turns: [], busy: false, ctl: null, owner: "", loadedFor: "", status: null, page: null, clearArmed: 0 };
const SUGGEST = {
  business: ["Where should we start?", "Summarise our progress so far", "What information is missing?"],
  operations: ["Help me plan my team's week", "How can we improve our KPIs?", "Explain our company values"],
  hr: ["Draft a 1-week onboarding plan", "Explain our company values", "What should a leave policy include?"],
  employee: ["Explain our company vision", "What are my responsibilities?", "Help me plan my assigned tasks"],
  viewer: ["Explain our company vision", "Explain our company values"]
};
const DEFAULT = () => ({ label: S.company ? S.company.name : "CFF", suggestions: SUGGEST[S.experience ? S.experience() : "business"] || SUGGEST.business, context: () => "" });

// Splits an answer into text and [[DRAFT]] blocks.
function parts(text){
  const out = []; const re = /\[\[DRAFT\]\]([\s\S]*?)(\[\[\/DRAFT\]\]|$)/g; let last = 0, m;
  while((m = re.exec(text))){ if(m.index > last) out.push({ kind: "text", body: text.slice(last, m.index) }); out.push({ kind: "draft", body: m[1].trim(), open: !m[2] }); last = re.lastIndex; if(!m[0]) break; }
  if(last < text.length) out.push({ kind: "text", body: text.slice(last) });
  return out.map(p => p.kind === "text" ? { ...p, body: p.body.replace(/\[\[?\/?D?R?A?F?T?\]?\]?$/, "") } : p);
}

function build(){
  if($("#aiPanel")) return;
  const fab = document.createElement("button");
  fab.className = "ai-fab"; fab.id = "aiFab"; fab.hidden = true; fab.type = "button";
  fab.innerHTML = `${I.sparkle}<span>Ask AI</span>`; fab.setAttribute("aria-label", "Open the AI assistant");
  const panel = document.createElement("aside");
  panel.className = "ai-panel"; panel.id = "aiPanel"; panel.setAttribute("aria-label", "CFF AI Assistant"); panel.hidden = true;
  panel.innerHTML = `
    <header class="ai-head">
      <span class="ai-mark">${I.sparkle}</span>
      <div class="ai-title"><b>CFF AI Assistant</b><span id="aiCtx"></span></div>
      <button class="icon-btn" id="aiClear" type="button" title="Clear chat" aria-label="Clear chat">${I.trash}</button>
      <button class="icon-btn" id="aiClose" type="button" title="Close" aria-label="Close assistant">${I.close}</button>
    </header>
    <div class="ai-body" id="aiBody" aria-live="polite"></div>
    <form class="ai-form" id="aiForm">
      <label class="sr-only" for="aiInput">Message</label>
      <textarea id="aiInput" rows="1" maxlength="2000" placeholder="Ask about your company, a stage or a question…"></textarea>
      <button class="btn ai-send" id="aiSend" type="submit" aria-label="Send">${I.send}</button>
    </form>
    <p class="ai-foot">AI suggests; you decide. It never changes company records. Check important details, and confirm legal, tax and ownership matters with a professional.</p>`;
  document.body.append(fab, panel);
  fab.addEventListener("click", () => open());
  $("#aiClose").addEventListener("click", close);
  $("#aiClear").addEventListener("click", clearChat);
  const input = $("#aiInput");
  input.addEventListener("input", grow);
  input.addEventListener("keydown", e => { if(e.key === "Enter" && !e.shiftKey && !e.isComposing){ e.preventDefault(); submit(); } });
  $("#aiForm").addEventListener("submit", e => { e.preventDefault(); submit(); });
  document.addEventListener("keydown", e => { if(e.key === "Escape" && A.open && !document.querySelector("dialog[open]")) close(); });
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-ai-ask]"); if(b){ e.preventDefault(); ask(b.getAttribute("data-ai-ask")); return; }
    const s = e.target.closest("[data-ai-suggest]"); if(s){ send(s.getAttribute("data-ai-suggest")); return; }
    const ins = e.target.closest("[data-ai-insert]"); if(ins){ insertDraft(+ins.dataset.turn, +ins.dataset.part); return; }
    const cp = e.target.closest("[data-ai-copy]"); if(cp) copyDraft(+cp.dataset.turn, +cp.dataset.part, cp);
  });
}
const grow = () => { const t = $("#aiInput"); t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 160) + "px"; };
const inApp = () => !!(S.company && document.body.classList.contains("in-app") && S.can("ai.use"));
const info = () => A.page || DEFAULT();

async function status(){
  if(A.status && A.status.company === S.companyId) return A.status;
  try{ const d = await CFF.api.c.get("/ai/status"); A.status = { ...d, company: S.companyId }; }
  catch(e){ A.status = { ready: false, message: e.message, company: S.companyId }; }
  return A.status;
}

async function open(){
  if(!inApp()) return;
  A.open = true; document.body.classList.add("ai-open");
  $("#aiPanel").hidden = false; $("#aiFab").hidden = true;
  refreshHeader(); await status(); ensureHistory(); renderBody();
  setTimeout(() => $("#aiInput").focus(), 30);
}
function close(){ A.open = false; document.body.classList.remove("ai-open"); $("#aiPanel").hidden = true; $("#aiFab").hidden = !inApp(); }
function ask(text){ open().then(() => { if(A.status && A.status.ready) send(text); }); }
function refreshHeader(){ const c = $("#aiCtx"); if(c) c.textContent = inApp() ? "Helping with: " + info().label : ""; }

async function ensureHistory(){
  if(A.loadedFor === A.owner || !(A.status && A.status.ready)) return;
  A.loadedFor = A.owner;
  try{ const d = await CFF.api.c.get("/ai/history"); if(!A.turns.length && d.messages.length){ A.turns = d.messages; renderBody(); } }catch(e){ /* history is optional */ }
}

function renderTurn(t, i){
  if(t.role === "user") return `<div class="ai-msg user"><div class="bubble">${esc(t.content).replace(/\n/g, "<br>")}</div></div>`;
  const canInsert = !!info().insert;
  let html = "";
  if(!t.content && t.pending) html = `<div class="ai-thinking"><span></span><span></span><span></span> Thinking…</div>`;
  parts(t.content || "").forEach((p, k) => {
    if(p.kind === "text"){ if(p.body.trim()) html += md(p.body); return; }
    html += `<div class="ai-draft"><div class="ai-draft-label">Draft for you to review</div><div class="ai-draft-body">${esc(p.body).replace(/\n/g, "<br>")}</div>
      ${p.open && t.pending ? "" : `<div class="ai-draft-actions">${canInsert ? `<button class="btn sm" type="button" data-ai-insert data-turn="${i}" data-part="${k}">${I.insert} ${esc(info().insertLabel || "Insert into my answer")}</button>` : ""}<button class="btn secondary sm" type="button" data-ai-copy data-turn="${i}" data-part="${k}">${I.copy} Copy</button></div>`}</div>`;
  });
  if(t.error) html += `<p class="ai-error">${esc(t.error)}</p>`;
  return `<div class="ai-msg bot">${html}</div>`;
}
function renderBody(){
  const body = $("#aiBody"); if(!body || !A.open) return;
  const input = $("#aiInput"), btn = $("#aiSend");
  if(!A.status || !A.status.ready){
    body.innerHTML = `<div class="ai-empty"><span class="ai-big">${I.sparkle}</span><h3>AI assistant</h3><p class="ai-off">${esc((A.status && A.status.message) || "Checking the AI assistant…")}</p></div>`;
    input.disabled = true; btn.disabled = true; return;
  }
  input.disabled = false; setBusyButton();
  const sug = info().suggestions || [];
  if(!A.turns.length){
    const name = ((S.me && S.me.profile && S.me.profile.full_name) || "").split(" ")[0];
    body.innerHTML = `<div class="ai-empty"><span class="ai-big">${I.sparkle}</span><h3>Hi ${esc(name || "there")}, how can I help?</h3>
      <p>I know your company's CFF progress, the page you're on and your role. I can explain questions, draft answers, find missing information and suggest plans. You review and approve everything.</p>
      <div class="ai-sugs">${sug.map(s => `<button class="chipf" type="button" data-ai-suggest="${esc(s)}">${esc(s)}</button>`).join("")}</div></div>`;
    return;
  }
  body.innerHTML = A.turns.map(renderTurn).join("") + (A.busy ? "" : `<div class="ai-sugs after">${sug.slice(0, 2).map(s => `<button class="chipf" type="button" data-ai-suggest="${esc(s)}">${esc(s)}</button>`).join("")}</div>`);
  body.scrollTop = body.scrollHeight;
}
function updateLast(){
  const body = $("#aiBody"); if(!body) return;
  const near = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
  const nodes = body.querySelectorAll(".ai-msg"); const last = nodes[nodes.length - 1]; const i = A.turns.length - 1;
  if(last && last.classList.contains("bot")) last.outerHTML = renderTurn(A.turns[i], i); else renderBody();
  if(near) body.scrollTop = body.scrollHeight;
}
function setBusyButton(){ const b = $("#aiSend"); if(!b) return; b.disabled = false; b.innerHTML = A.busy ? I.stop : I.send; b.setAttribute("aria-label", A.busy ? "Stop" : "Send"); b.classList.toggle("stop", A.busy); }

function submit(){
  if(A.busy){ if(A.ctl) A.ctl.abort(); return; }
  const input = $("#aiInput"); const text = input.value.trim(); if(!text) return;
  input.value = ""; grow(); send(text);
}
async function send(text){
  if(A.busy || !text || !text.trim() || !(A.status && A.status.ready)) return;
  if(!A.open) await open();
  const pi = info(); let context = "";
  try{ context = pi.context ? await pi.context() : ""; }catch(e){ context = ""; }
  A.turns.push({ role: "user", content: text.trim() });
  const history = A.turns.filter(t => t.content).slice(-12).map(t => ({ role: t.role, content: t.content }));
  const reply = { role: "assistant", content: "", pending: true };
  A.turns.push(reply); A.busy = true; A.ctl = new AbortController(); renderBody();
  try{
    reply.content = await CFF.api.stream("/ai/chat", { messages: history, context: String(context || "").slice(0, 14000), label: pi.label }, full => { reply.content = full; updateLast(); }, A.ctl.signal);
  }catch(e){
    if(e.name === "AbortError"){ if(!reply.content) reply.error = "Stopped."; }
    else reply.error = e.message || "The AI couldn't answer right now. Please try again.";
  }finally{
    reply.pending = false; A.busy = false; A.ctl = null;
    if(!reply.content && !reply.error) reply.error = "No answer came back. Please try again.";
    renderBody();
  }
}
const draftText = (ti, pi) => { const t = A.turns[ti]; const p = t && parts(t.content)[pi]; return p ? p.body : ""; };
function insertDraft(ti, pi){
  const text = draftText(ti, pi); const ins = info().insert; if(!text || !ins) return;
  if(ins(text) !== false){ toast("Added. Review it before it's saved."); if(window.matchMedia("(max-width: 880px)").matches) close(); }
}
async function copyDraft(ti, pi, btn){
  try{ await navigator.clipboard.writeText(draftText(ti, pi)); btn.lastChild.textContent = " Copied"; }
  catch(e){ const body = btn.closest(".ai-draft").querySelector(".ai-draft-body"); const r = document.createRange(); r.selectNodeContents(body); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast("Text selected. Press Ctrl+C to copy."); }
}
async function clearChat(){
  if(!A.turns.length || A.busy) return;
  if(Date.now() - A.clearArmed > 3000){ A.clearArmed = Date.now(); toast("Click the bin again to clear this chat."); return; }
  A.clearArmed = 0;
  try{ await CFF.api.c.del("/ai/history"); }catch(e){ toast("Couldn't clear the chat. " + e.message, "bad"); return; }
  A.turns = []; renderBody(); toast("Chat cleared.");
}

// One-off AI task (analysis, draft, suggestions). Streams the text; the server saves shared results.
async function generate(kind, params, onText, signal){
  const st = await status();
  if(!st.ready) throw new Error(st.message || "The AI assistant isn't available right now.");
  return CFF.api.stream("/ai/generate", { kind, ...(params || {}) }, onText, signal);
}

// A reusable "AI output" card: shows the saved result, and lets the person (re)generate it.
// opts: { kind, params, subject, title, intro, button, el, disclaimer }
async function outputCard(el, o){
  if(!el) return;
  const st = await status();
  let saved = null;
  if(st.ready || S.can("cff.view")){
    try{ const d = await CFF.api.c.get("/ai/outputs?kind=" + encodeURIComponent(o.kind) + "&subject=" + encodeURIComponent(o.subject || "")); saved = d.items[0] || null; }catch(e){ saved = null; }
  }
  let busy = false, ctl = null, text = "", err = "";
  const draw = () => {
    if(!el.isConnected) return;
    const body = busy ? (text ? md(text) : `<div class="ai-thinking"><span></span><span></span><span></span> Writing…</div>`)
      : saved ? `<div class="ai-an-text">${md(saved.content)}</div><p class="muted small">Written by AI ${esc(CFF.util.ago(saved.updated_at))}. A starting point for discussion — not a decision.</p>`
      : `<p class="muted">${esc(o.intro || "")}</p>`;
    el.innerHTML = `<section class="card ai-analysis"><div class="ai-an-head"><span class="ai-an-mark">${I.sparkle}</span>
      <div class="stack" style="gap:2px;flex:1;min-width:0"><h2>${esc(o.title)}</h2>${o.disclaimer ? `<span class="muted small">${esc(o.disclaimer)}</span>` : ""}</div>
      <div class="row">${busy ? `<button class="btn secondary sm" data-stop type="button">Stop</button>` : st.ready ? `<button class="btn ${saved ? "secondary" : ""} sm" data-run type="button">${I.sparkle} ${saved ? "Rewrite" : esc(o.button || "Generate")}</button>` : ""}</div></div>
      <div class="ai-an-body">${err ? `<p class="ai-error">${esc(err)}</p>` : ""}${!st.ready && !saved ? CFF.util.notice(esc(st.message || "The AI assistant isn't available.")) : body}</div></section>`;
    const r = $("[data-run]", el); if(r) r.addEventListener("click", run);
    const s = $("[data-stop]", el); if(s) s.addEventListener("click", () => ctl && ctl.abort());
  };
  const run = async () => {
    busy = true; text = ""; err = ""; ctl = new AbortController(); draw();
    try{
      const out = await generate(o.kind, o.params, t => { text = t; draw(); }, ctl.signal);
      if(/\(The answer was interrupted/.test(out)) err = "The answer was interrupted. Please try again.";
      else saved = { content: out, updated_at: new Date().toISOString() };
    }catch(e){ err = e.name === "AbortError" ? "Stopped." : e.message; }
    finally{ busy = false; ctl = null; draw(); }
  };
  draw();
}

CFF.ai = {
  init(){ build(); },
  open, close, ask, generate, outputCard, status,
  // Pages describe themselves: { label, suggestions, context: async () => text, insert(text), insertLabel }
  page(p){ A.page = p; refreshHeader(); if(A.open && !A.turns.length && !A.busy) renderBody(); },
  onRoute(){
    const owner = inApp() ? S.companyId + "|" + (S.me && S.me.user.id) : "";
    if(owner !== A.owner){ if(A.ctl) A.ctl.abort(); A.turns = []; A.loadedFor = ""; A.owner = owner; A.status = null; }
    if(!inApp()){ if(A.open) close(); const f = $("#aiFab"); if(f) f.hidden = true; return; }
    if(!A.open) $("#aiFab").hidden = false;
    refreshHeader(); if(A.open && !A.busy) renderBody();
  },
  leave(){ if(A.open) close(); const f = $("#aiFab"); if(f) f.hidden = true; },
  reset(){ A.turns = []; A.owner = ""; A.loadedFor = ""; A.status = null; }
};
})();
