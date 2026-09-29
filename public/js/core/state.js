// Who is signed in, which company workspace is open, their role and permissions,
// plus the auto-save helper used on every editable page (Saving… / Saved / Save failed).
(function(){
"use strict";
const CFF = window.CFF;
const { store, $$, toast } = CFF.util;

const state = CFF.state = {
  me: null,            // { user, profile, companies, invitations, superAdmin }
  companyId: store.get("cff:company") || null,
  company: null, role: null, perms: new Set(), member: null,
  portal: store.get("cff:portal") || "business"
};

state.can = (...keys) => keys.some(k => k === "*" || state.perms.has(k));
// business | operations | hr | employee | viewer  (see catalogs.js). Owner and Founder only are "business".
state.experience = () => CATALOGS.EXPERIENCE[state.role] || "viewer";
state.isFounderView = () => state.experience() === "business";

state.loadMe = async () => { state.me = await CFF.api.get("/api/me"); return state.me; };
state.setMe = me => { state.me = me; };
state.setPortal = p => { state.portal = ["business","employee","visitor"].includes(p) ? p : "business"; store.set("cff:portal", state.portal); };

// Opens a company workspace (loads role and permissions from the server).
state.openCompany = async id => {
  const prev = state.companyId;
  state.companyId = id;
  try{
    const d = await CFF.api.c.get("");
    state.company = d.company; state.role = d.role; state.perms = new Set(d.perms); state.member = d.member;
    store.set("cff:company", id);
    if(prev !== id) CFF.bus.emit("company");
    return d;
  }catch(e){
    state.companyId = null; state.company = null; state.role = null; state.perms = new Set();
    store.del("cff:company");
    throw e;
  }
};
state.clear = () => { Object.assign(state, { me: null, companyId: null, company: null, role: null, perms: new Set(), member: null }); store.del("cff:company"); };

/* ---------- tiny event bus ---------- */
const handlers = {};
CFF.bus = {
  on(ev, fn){ (handlers[ev] = handlers[ev] || []).push(fn); },
  emit(ev, ...a){ (handlers[ev] || []).forEach(fn => { try{ fn(...a); }catch(e){ console.error(e); } }); }
};

/* ---------- auto-save ---------- */
// const s = CFF.saver("answer:s1-0-1", async value => api...); s.queue(value) debounces; s.flush() saves now.
const pending = new Map();
let failed = 0;
function show(text, kind){
  $$("[data-save]").forEach(el => { el.textContent = text; el.dataset.kind = kind || ""; });
}
CFF.saveState = show;
CFF.saver = (key, fn, delay = 800) => {
  let timer = null, latest, running = null, dirty = false;
  const run = async () => {
    timer = null;
    if(running){ await running.catch(() => {}); }
    if(!dirty) return true;
    const value = latest; dirty = false;
    show("Saving…");
    running = (async () => fn(value))();
    try{ await running; pending.delete(key); failed = Math.max(0, failed - 1); show("Saved", "good"); return true; }
    catch(e){
      dirty = true; failed++; show("Save failed", "bad");
      if(e.auth){ toast(e.message, "bad"); }
      else toast("Unable to save. " + e.message, "bad");
      return false;
    } finally { running = null; }
  };
  const s = {
    queue(value){ latest = value; dirty = true; pending.set(key, s); show("Saving…"); clearTimeout(timer); timer = setTimeout(run, delay); },
    async flush(){ clearTimeout(timer); if(dirty) return run(); if(running) await running.catch(() => {}); return true; },
    get dirty(){ return dirty; }
  };
  return s;
};
CFF.flushSaves = async () => { const all = [...pending.values()]; const r = await Promise.all(all.map(s => s.flush())); return r.every(Boolean); };
CFF.hasUnsaved = () => [...pending.values()].some(s => s.dirty);
window.addEventListener("beforeunload", e => { if(CFF.hasUnsaved()){ e.preventDefault(); e.returnValue = ""; } });
})();
