// Talks to the CFF server. Keeps the login session, refreshes it when it expires, and turns every
// failure into a short, friendly message. No keys or secrets live in the browser.
(function(){
"use strict";
const CFF = window.CFF;
const { store } = CFF.util;
const KEY = "cff:session";

let session = store.get(KEY);
let refreshing = null;

class ApiError extends Error {
  constructor(message, status, code){ super(message); this.status = status; this.code = code; this.auth = status === 401; }
}

function setSession(s){ session = s ? { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || null } : null; if(session) store.set(KEY, session); else store.del(KEY); }
const loggedIn = () => !!(session && session.access_token);

async function refresh(){
  if(!session || !session.refresh_token) throw new ApiError("Please log in.", 401);
  if(!refreshing) refreshing = (async () => {
    try{
      const r = await fetch("/api/auth/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: session.refresh_token }) });
      const d = await r.json().catch(() => ({}));
      if(!r.ok || !d.session){ setSession(null); throw new ApiError(d.error || "Your session has ended. Please log in again.", 401); }
      setSession(d.session);
    } finally { refreshing = null; }
  })();
  return refreshing;
}
// Refresh a little before the token expires.
async function fresh(){
  if(session && session.expires_at && session.expires_at * 1000 - Date.now() < 60000) { try{ await refresh(); }catch(e){ /* the request will report it */ } }
}

async function raw(method, path, { body, headers = {}, signal, auth = true, retry = true } = {}){
  if(auth) await fresh();
  const h = { ...headers };
  if(auth && session) h.Authorization = "Bearer " + session.access_token;
  let payload = body;
  if(body !== undefined && !(body instanceof Blob) && !(body instanceof ArrayBuffer) && !(body instanceof Uint8Array)){ h["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  let r;
  try{ r = await fetch(path, { method, headers: h, body: payload, signal, cache: "no-store" }); }
  catch(e){
    if(e.name === "AbortError") throw e;
    throw new ApiError("Can't reach the server. Check your internet connection and try again.", 0, "network");
  }
  // A refresh can't help when the server wants the two-step code (the refreshed session has the same level).
  const code401 = r.status === 401 ? ((await r.clone().json().catch(() => ({}))).code || "") : "";
  if(r.status === 401 && auth && retry && session && session.refresh_token && code401 !== "mfa_required"){
    try{ await refresh(); }catch(e){ throw new ApiError("Your session has ended. Please log in again.", 401); }
    return raw(method, path, { body, headers, signal, auth, retry: false });
  }
  return r;
}
async function fail(r){
  const d = await r.json().catch(() => ({}));
  const msg = d.error || (r.status === 413 ? "That file is too large." : r.status === 429 ? "Too many requests. Wait a moment and try again." : r.status >= 500 ? "Something went wrong on the server. Please try again." : "That didn't work. Please try again.");
  const err = new ApiError(msg, r.status, d.code);
  if(r.status === 401){ setSession(null); }
  throw err;
}

async function request(method, path, body, o = {}){
  const r = await raw(method, path, { ...o, body });
  if(!r.ok) await fail(r);
  const type = r.headers.get("content-type") || "";
  return type.includes("json") ? r.json() : r.text();
}

const companyPath = p => "/api/c/" + encodeURIComponent(CFF.state.companyId) + p;
const c = {
  get: (p, o) => request("GET", companyPath(p), undefined, o),
  post: (p, b, o) => request("POST", companyPath(p), b || {}, o),
  put: (p, b, o) => request("PUT", companyPath(p), b || {}, o),
  patch: (p, b, o) => request("PATCH", companyPath(p), b || {}, o),
  del: (p, o) => request("DELETE", companyPath(p), undefined, o)
};

// Streams a text answer (AI). onText(fullTextSoFar) is called as it arrives.
async function stream(path, body, onText, signal){
  const r = await raw("POST", companyPath(path), { body, signal });
  if(!r.ok) await fail(r);
  const reader = r.body.getReader(), dec = new TextDecoder(); let text = "";
  for(;;){ const { done, value } = await reader.read(); if(done) break; text += dec.decode(value, { stream: true }); onText && onText(text); }
  text += dec.decode(); onText && onText(text);
  return text;
}

// Uploads a file as the raw request body.
async function upload(path, file, params){
  const qs = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v !== null && v !== undefined && v !== "")).toString();
  const r = await raw("POST", companyPath(path) + (qs ? "?" + qs : ""), { body: file, headers: { "Content-Type": "application/octet-stream", "X-File-Type": file.type || "application/octet-stream" } });
  if(!r.ok) await fail(r);
  return r.json();
}

// Downloads a protected file (documents, Word export) and returns a Blob.
async function blob(path){
  const r = await raw("GET", companyPath(path));
  if(!r.ok) await fail(r);
  return r.blob();
}
function saveBlob(b, name){
  const url = URL.createObjectURL(b); const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const auth = {
  // With two-step verification on, login returns { mfaRequired, factorId, pending } instead of a session.
  async login(email, password){ const d = await request("POST", "/api/auth/login", { email, password }, { auth: false }); setSession(d.mfaRequired ? null : d.session); return d; },
  async mfa(pending, factorId, code){ const d = await request("POST", "/api/auth/mfa", { ...pending, factorId, code }, { auth: false }); setSession(d.session); return d; },
  async signup(f){ const d = await request("POST", "/api/auth/signup", f, { auth: false }); if(d.session) setSession(d.session); return d; },
  forgot: email => request("POST", "/api/auth/forgot", { email }, { auth: false }),
  resend: email => request("POST", "/api/auth/resend", { email }, { auth: false }),
  reset: (access_token, password, name) => request("POST", "/api/auth/reset", { access_token, password, name: name || undefined }, { auth: false }),
  async fromLink(tokens){ const d = await request("POST", "/api/auth/session", tokens, { auth: false }); setSession(d.mfaRequired ? null : d.session); return d; },
  async logout(){ try{ await raw("POST", "/api/auth/logout", { body: {}, retry: false }); }catch(e){} setSession(null); }
};

CFF.api = { request, get: p => request("GET", p), post: (p, b) => request("POST", p, b || {}), patch: (p, b) => request("PATCH", p, b || {}),
  c, stream, upload, blob, saveBlob, auth, loggedIn, setSession, ApiError, refreshToken: () => session && session.refresh_token };
})();
