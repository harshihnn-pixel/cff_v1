// Shared helpers for the website: DOM, escaping, icons, dates, toasts, dialogs, forms, tables and tiny markdown.
(function(){
"use strict";
const CFF = window.CFF = window.CFF || {};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = n => String(n).padStart(2, "0");
const cut = (t, n) => { t = String(t || "").trim(); return t.length > n ? t.slice(0, n) + "…" : t; };
const nl = t => esc(t).replace(/\n/g, "<br>");

const svg = (p, s = 18, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p}</svg>`;
const I = {
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 16, 2.2),
  back: svg('<path d="M19 12H5M11 18l-6-6 6-6"/>', 16, 2.2),
  chev: svg('<path d="M9 6l6 6-6 6"/>', 18, 2.2),
  down: svg('<path d="M6 9l6 6 6-6"/>', 16, 2.2),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 14, 3),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 16, 2.4),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>', 16, 2.2),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', 16, 2.2),
  business: svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>', 22),
  employee: svg('<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 17c.8-1.8 2.2-2.7 4-2.7s3.2.9 4 2.7"/>', 22),
  visitor: svg('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>', 22),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>', 20, 2.2),
  logout: svg('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/>'),
  think: svg('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>', 20),
  sparkle: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>', 16, 1.8),
  warn: svg('<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17h.01"/>', 18),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', 18),
  bell: svg('<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>', 19),
  home: svg('<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>'),
  building: svg('<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2"/>'),
  layers: svg('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'),
  target: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
  users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.3 3.3-5 6.5-5s5.7 1.7 6.5 5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.2 2.3 3.5 5"/>'),
  shield: svg('<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/>'),
  file: svg('<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/>'),
  chart: svg('<path d="M4 20V4M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', 18, 1.6),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>', 15),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', 15),
  upload: svg('<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>', 16),
  download: svg('<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>', 16),
  eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', 16),
  history: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>', 16),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', 15),
  print: svg('<path d="M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v7H7z"/>', 16),
  flag: svg('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', 16),
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>', 15),
  insert: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', 15, 2.2),
  send: svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 18, 2.4),
  stop: svg('<rect x="7" y="7" width="10" height="10" rx="2"/>', 16),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>', 18, 2.2),
  archive: svg('<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/>', 15),
  swap: svg('<path d="M7 7h13l-3-3M17 17H4l3 3"/>', 16)
};

/* ---------- dates ---------- */
const today = () => { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
function fmtDate(v){ if(!v) return ""; const d = new Date(String(v).length === 10 ? v + "T00:00:00" : v); return isNaN(d) ? String(v) : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
function fmtDateTime(v){ if(!v) return ""; const d = new Date(v); return isNaN(d) ? "" : d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }); }
function ago(v){
  if(!v) return ""; const s = (Date.now() - new Date(v).getTime()) / 1000;
  if(s < 60) return "just now"; if(s < 3600) return Math.floor(s / 60) + " min ago"; if(s < 86400) return Math.floor(s / 3600) + " h ago";
  if(s < 7 * 86400) return Math.floor(s / 86400) + " d ago"; return fmtDate(v);
}
const fileSize = n => n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(0) + " KB" : (n / 1048576).toFixed(1) + " MB";

/* ---------- toasts ---------- */
let toastT;
function toast(msg, kind){
  let t = $("#toast");
  if(!t){ t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite"); document.body.appendChild(t); }
  t.textContent = msg; t.dataset.kind = kind || ""; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, kind === "bad" ? 5200 : 2800);
}

/* ---------- dialogs ---------- */
// modal({ title, body, actions:[{label, value, kind:'secondary'|'danger', submit:true}], wide, onOpen(dialog) }) -> Promise<value|null>
function modal(o){
  return new Promise(resolve => {
    const d = document.createElement("dialog");
    d.className = "modal" + (o.wide ? " wide" : "");
    d.setAttribute("aria-labelledby", "mdl-title");
    const actions = (o.actions || [{ label: "Close", value: null, kind: "secondary" }]).map((a, i) =>
      `<button type="${a.submit ? "submit" : "button"}" class="btn ${a.kind || ""}" data-i="${i}">${esc(a.label)}</button>`).join("");
    d.innerHTML = `<form method="dialog" class="modal-in" novalidate>
      <header class="modal-head"><h2 id="mdl-title">${esc(o.title || "")}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${I.close}</button></header>
      <div class="modal-body">${o.body || ""}</div>
      <p class="alert" data-err role="alert" hidden></p>
      <footer class="modal-foot">${actions}</footer></form>`;
    document.body.appendChild(d);
    let done = false;
    const finish = v => { if(done) return; done = true; d.close(); d.remove(); resolve(v); };
    d.addEventListener("cancel", e => { e.preventDefault(); finish(null); });
    $("[data-close]", d).addEventListener("click", () => finish(null));
    const form = $("form", d);
    const run = async i => {
      const a = (o.actions || [])[i]; if(!a){ finish(null); return; }
      if(a.run){
        const err = $("[data-err]", d); err.hidden = true;
        const btns = $$(".modal-foot .btn", d); btns.forEach(b => b.disabled = true);
        try{ const v = await a.run(d); if(v === false){ btns.forEach(b => b.disabled = false); return; } finish(v === undefined ? a.value : v); }
        catch(e){ err.textContent = e.message || "Something went wrong. Please try again."; err.hidden = false; btns.forEach(b => b.disabled = false); }
        return;
      }
      finish(a.value === undefined ? true : a.value);
    };
    $$(".modal-foot .btn", d).forEach(b => { if(b.type === "button") b.addEventListener("click", () => run(+b.dataset.i)); });
    form.addEventListener("submit", e => { e.preventDefault(); const i = (o.actions || []).findIndex(a => a.submit); if(i >= 0) run(i); });
    d.showModal();
    if(o.onOpen) o.onOpen(d);
    const first = $("input:not([type=hidden]):not([disabled]),textarea,select", $(".modal-body", d));
    if(first) first.focus();
  });
}
const confirmBox = (message, o = {}) => modal({ title: o.title || "Please confirm", body: `<p>${esc(message)}</p>${o.extra || ""}`,
  actions: [{ label: "Cancel", value: false, kind: "secondary" }, { label: o.ok || "Confirm", value: true, kind: o.danger ? "danger" : "" }] }).then(v => !!v);
const alertBox = (title, message) => modal({ title, body: `<p>${esc(message)}</p>`, actions: [{ label: "OK", value: true }] });

/* ---------- forms ---------- */
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || "").trim());
// Same rule as the server: 7–15 digits; + ( ) - . and spaces allowed.
const phoneOk = p => { const t = String(p || "").trim(); const d = t.replace(/\D/g, ""); return /^\+?[0-9 ().-]+$/.test(t) && d.length >= 7 && d.length <= 15; };
// fields: [{ k, label, type:'text'|'textarea'|'select'|'date'|'number'|'checkbox'|'email', options:[[v,l]], required, hint, rows, min, max, step, full, placeholder, disabled }]
let uid = 0;
function formFields(fields, values = {}){
  return `<div class="form-grid">` + fields.map(f => {
    const id = "f" + (++uid) + "-" + f.k, v = values[f.k] == null ? (f.value == null ? "" : f.value) : values[f.k];
    const req = f.required ? " required" : "", dis = f.disabled ? " disabled" : "";
    const label = `<label for="${id}">${esc(f.label)}${f.required ? ' <span class="req" aria-hidden="true">*</span>' : ""}</label>`;
    const hint = f.hint ? `<span class="hint">${esc(f.hint)}</span>` : "";
    let input;
    if(f.type === "textarea") input = `<textarea class="input" id="${id}" name="${f.k}" rows="${f.rows || 3}"${req}${dis} placeholder="${esc(f.placeholder || "")}" maxlength="${f.max || 20000}">${esc(v)}</textarea>`;
    else if(f.type === "select") input = `<select class="input" id="${id}" name="${f.k}"${req}${dis}>${f.blank !== false && !f.required ? `<option value="">${esc(f.blank || "—")}</option>` : ""}${(f.options || []).map(([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(v) ? "selected" : ""}>${esc(ol)}</option>`).join("")}</select>`;
    else if(f.type === "checkbox") return `<label class="check ${f.full ? "full" : ""}"><input type="checkbox" name="${f.k}" ${v ? "checked" : ""}${dis}> ${esc(f.label)}</label>`;
    else input = `<input class="input" id="${id}" name="${f.k}" type="${f.type || "text"}" value="${esc(v)}"${req}${dis}${f.min != null ? ` min="${f.min}"` : ""}${f.max != null && f.type === "number" ? ` max="${f.max}"` : ""}${f.step ? ` step="${f.step}"` : ""} placeholder="${esc(f.placeholder || "")}"${f.type !== "number" && f.type !== "date" ? ` maxlength="${f.maxlength || 300}"` : ""}>`;
    return `<div class="field ${f.full || f.type === "textarea" ? "full" : ""}">${label}${input}${hint}</div>`;
  }).join("") + `</div>`;
}
// Reads a form's values. Empty text becomes "" (or null for select/date/number when nullBlank).
function readForm(root, fields){
  const out = {};
  fields.forEach(f => {
    const el = root.querySelector(`[name="${f.k}"]`); if(!el || f.disabled) return;
    if(f.type === "checkbox") out[f.k] = el.checked;
    else if(f.type === "number") out[f.k] = el.value === "" ? null : Number(el.value);
    else if(f.type === "select" || f.type === "date") out[f.k] = el.value === "" ? null : el.value;
    else out[f.k] = f.type === "password" ? el.value : el.value.trim();
    if(f.required && (out[f.k] === "" || out[f.k] === null)) throw new Error(f.label + " is required.");
    if(out[f.k] && (f.type === "email" || f.k === "email") && !emailOk(out[f.k])) throw new Error(f.label + ": enter a valid email address, like name@example.com.");
    if(out[f.k] && (f.type === "tel" || f.k === "phone") && !phoneOk(out[f.k])) throw new Error(f.label + ": enter a valid phone number, like +91 98765 43210.");
  });
  return out;
}
// Opens a form in a dialog and saves it. save(values) must return a promise; errors are shown in the dialog.
function formModal({ title, fields, values, save, ok, wide, intro, extraActions }){
  return modal({ title, wide, body: (intro || "") + formFields(fields, values || {}),
    actions: [...(extraActions || []), { label: "Cancel", value: null, kind: "secondary" }, { label: ok || "Save", submit: true, run: d => save(readForm(d, fields), d) }] });
}

/* ---------- small components ---------- */
const pill = (text, tone) => `<span class="pill ${tone || ""}">${esc(text)}</span>`;
function statusPill(key, map){
  const m = map || (CATALOGS.STAGE_STATUS);
  const x = m[key] || { label: String(key || "").replace(/_/g, " "), tone: "" };
  return pill(x.label, x.tone);
}
const opt = list => Object.fromEntries(list);
const toneFor = { completed: "good", approved: "good", on_track: "good", in_progress: "warn", at_risk: "warn", submitted: "info", planned: "info", blocked: "bad", off_track: "bad", rejected: "bad", expired: "bad", cancelled: "", not_applicable: "", not_started: "" };
const lblPill = (list, key) => pill(opt(list)[key] || String(key || "").replace(/_/g, " "), toneFor[key] || "");
function ring(f, size = 112, stroke = 10){
  f = Math.max(0, Math.min(1, f || 0));
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - f);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${Math.round(f * 100)}% complete"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--accent)" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-size="${size / 4.6}" font-weight="800" fill="var(--ink)" font-family="inherit">${Math.round(f * 100)}%</text></svg>`;
}
const bar = (pct, tone) => `<span class="bar ${tone || ""}" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></span>`;
const empty = (title, text, action) => `<div class="empty-state"><h3>${esc(title)}</h3>${text ? `<p class="muted">${esc(text)}</p>` : ""}${action || ""}</div>`;
const notice = (html, kind) => `<div class="notice ${kind || ""}">${kind === "bad" ? I.warn : kind === "good" ? I.check : I.info}<span>${html}</span></div>`;
const loading = text => `<div class="loading"><span class="spinner" aria-hidden="true"></span><span>${esc(text || "Loading…")}</span></div>`;

// Responsive table: on small screens each row becomes a card (labels from the header).
function table(head, rows, o = {}){
  if(!rows.length) return o.empty || empty("Nothing here yet", "");
  return `<div class="tbl-wrap"><table class="rtable ${o.cls || ""}"><thead><tr>${head.map(h => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>` +
    rows.map(r => `<tr${r.attrs ? " " + r.attrs : ""}>${(r.cells || r).map((c, i) => `<td data-label="${esc(head[i] || "")}">${c == null ? "" : c}</td>`).join("")}</tr>`).join("") + `</tbody></table></div>`;
}
// Adds search, sorting and pages to longer tables (every .rtable on the page, automatically).
// Works on the rows already in the table, so buttons inside rows keep working.
const PAGE = 25;
function enhanceTable(t){
  if(t.dataset.enhanced || t.closest(".no-enhance")) return;
  const tb = t.tBodies[0]; if(!tb) return;
  const rows = Array.from(tb.rows); if(rows.length < 2) return;
  t.dataset.enhanced = "1";
  const wrap = t.closest(".tbl-wrap") || t;
  let q = "", page = 0, sortCol = -1, dir = 1;
  const text = r => r.textContent.toLowerCase();
  let bar2 = null;
  if(rows.length > 8){
    bar2 = document.createElement("div"); bar2.className = "tbl-tools";
    bar2.innerHTML = `<input class="input sm" type="search" placeholder="Search this list…" aria-label="Search this list"><span class="muted tbl-count"></span><span class="tbl-pager"></span>`;
    wrap.parentNode.insertBefore(bar2, wrap);
    let tmr; bar2.querySelector("input").addEventListener("input", e => { clearTimeout(tmr); tmr = setTimeout(() => { q = e.target.value.trim().toLowerCase(); page = 0; draw(); }, 120); });
  }
  const heads = Array.from(t.tHead ? t.tHead.rows[0].cells : []);
  heads.forEach((th, i) => {
    if(!th.textContent.trim()) return;
    th.classList.add("sortable"); th.tabIndex = 0; th.setAttribute("aria-sort", "none"); th.title = "Sort by " + th.textContent.trim();
    const go = () => { dir = sortCol === i ? -dir : 1; sortCol = i; heads.forEach(h => h.setAttribute("aria-sort", "none")); th.setAttribute("aria-sort", dir > 0 ? "ascending" : "descending"); draw(true); };
    th.addEventListener("click", go); th.addEventListener("keydown", e => { if(e.key === "Enter" || e.key === " "){ e.preventDefault(); go(); } });
  });
  const val = (r, i) => { const c = r.cells[i]; const x = c ? c.textContent.trim() : ""; const n = Number(x.replace(/[₹,%\s]/g, "")); return x !== "" && !isNaN(n) ? n : (Date.parse(x) && /\d{4}/.test(x) ? Date.parse(x) : x.toLowerCase()); };
  function draw(resort){
    if(resort && sortCol >= 0){ const all = Array.from(tb.rows); all.sort((a, b) => { const x = val(a, sortCol), y = val(b, sortCol); return (x > y ? 1 : x < y ? -1 : 0) * dir; }); all.forEach(r => tb.appendChild(r)); }
    const all = Array.from(tb.rows), hits = all.filter(r => !q || text(r).includes(q));
    const pages = Math.max(1, Math.ceil(hits.length / PAGE)); page = Math.min(page, pages - 1);
    all.forEach(r => { r.hidden = true; });
    (bar2 ? hits.slice(page * PAGE, page * PAGE + PAGE) : hits).forEach(r => { r.hidden = false; });
    if(!bar2) return;
    bar2.querySelector(".tbl-count").textContent = hits.length === all.length ? all.length + " items" : hits.length + " of " + all.length;
    const pg = bar2.querySelector(".tbl-pager");
    pg.innerHTML = pages > 1 ? `<button class="btn ghost sm" type="button" data-p="-1" ${page ? "" : "disabled"}>Previous</button><span class="muted">Page ${page + 1} of ${pages}</span><button class="btn ghost sm" type="button" data-p="1" ${page < pages - 1 ? "" : "disabled"}>Next</button>` : "";
    pg.querySelectorAll("[data-p]").forEach(b => b.addEventListener("click", () => { page += Number(b.dataset.p); draw(); }));
  }
  draw();
}
function enhanceTables(root){ (root || document).querySelectorAll("table.rtable").forEach(t => { try{ enhanceTable(t); }catch(e){ /* a table that can't be enhanced still works */ } }); }

function tabs(list, current, attr = "data-tab"){
  return `<div class="tabs" role="tablist">${list.map(([k, l]) => `<button type="button" role="tab" ${attr}="${esc(k)}" aria-selected="${k === current}">${esc(l)}</button>`).join("")}</div>`;
}
function onTabs(root, cb, attr = "data-tab"){
  $$(`[${attr}]`, root).forEach(b => b.addEventListener("click", () => { $$(`[${attr}]`, root).forEach(x => x.setAttribute("aria-selected", x === b)); cb(b.getAttribute(attr)); }));
}

/* ---------- safe markdown (AI output) ---------- */
function inline(t){ return esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>"); }
function md(text){
  const lines = String(text || "").replace(/\r/g, "").split("\n"); let html = "", list = null, para = [];
  const flush = () => { if(para.length){ html += `<p>${para.map(inline).join("<br>")}</p>`; para = []; } };
  const closeList = () => { if(list){ html += `</${list}>`; list = null; } };
  for(const raw of lines){
    const line = raw.trimEnd();
    const ul = /^\s*[-*•]\s+(.*)/.exec(line), ol = /^\s*\d+[.)]\s+(.*)/.exec(line), h = /^(#{1,4})\s+(.*)/.exec(line);
    if(ul || ol){ flush(); const kind = ul ? "ul" : "ol"; if(list !== kind){ closeList(); html += `<${kind}>`; list = kind; } html += `<li>${inline((ul || ol)[1])}</li>`; }
    else if(h){ flush(); closeList(); html += `<h4 class="md-h">${inline(h[2])}</h4>`; }
    else if(!line.trim()){ flush(); closeList(); }
    else { closeList(); para.push(line); }
  }
  flush(); closeList(); return html;
}

/* ---------- misc ---------- */
function hash(src){ let h = 5381; for(let i = 0; i < src.length; i++) h = ((h << 5) + h + src.charCodeAt(i)) >>> 0; return h.toString(16); }
const store = {
  get(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
  del(k){ try{ localStorage.removeItem(k); }catch(e){} }
};
const initials = name => String(name || "?").split(/\s+/).filter(Boolean).map(x => x[0]).slice(0, 2).join("").toUpperCase();
const query = () => { const i = location.hash.indexOf("?"); return i < 0 ? {} : Object.fromEntries(new URLSearchParams(location.hash.slice(i + 1))); };

CFF.util = { $, $$, esc, pad, cut, nl, svg, I, today, addDays, fmtDate, fmtDateTime, ago, fileSize, toast, modal, confirmBox, alertBox, formFields, readForm, formModal,
  pill, statusPill, lblPill, opt, ring, bar, empty, notice, loading, table, tabs, onTabs, md, hash, store, initials, query, toneFor,
  emailOk, phoneOk, enhanceTables };
})();
