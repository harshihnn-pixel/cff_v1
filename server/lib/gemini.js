// Google Gemini connection for the CFF AI assistant (server side only — the key never reaches the browser).
const KEY = (process.env.GEMINI_API_KEY || "").trim();
const MODEL = (process.env.AI_MODEL || "gemini-3.8-flash").trim();
// Backup model used when the main one is busy, out of quota or unavailable. Set AI_FALLBACK_MODEL=none to turn off.
const FALLBACK_RAW = (process.env.AI_FALLBACK_MODEL || "gemini-3.5-flash-lite").trim();
const FALLBACK = FALLBACK_RAW.toLowerCase() === "none" || FALLBACK_RAW === MODEL ? "" : FALLBACK_RAW;
const BASE = (process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta").trim().replace(/\/+$/, "");

const RETRY_DELAYS = [1200, 3000];              // pauses before retrying a busy model
const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  if(signal) signal.addEventListener("abort", () => { clearTimeout(t); const e = new Error("aborted"); e.name = "AbortError"; reject(e); }, { once: true });
});

let startupProblem = "";                          // set by checkSetup() if the key or model is wrong

function aiProblem(){
  if(!KEY || KEY.includes("paste")) return "The AI assistant isn't set up yet. Add your Gemini API key as GEMINI_API_KEY in .env and restart the server.";
  return startupProblem;
}

const googleSaid = body => { const m = body && body.error && body.error.message; return m ? ` (Google said: "${String(m).slice(0, 220)}")` : ""; };

function geminiMessage(status, body, model){
  const msg = (body && body.error && body.error.message) || "";
  if(/API key not valid|API_KEY_INVALID/i.test(msg) || status === 401) return "Google rejected the Gemini API key. Check GEMINI_API_KEY in .env and restart the server.";
  if(status === 403) return "This Gemini API key isn't allowed to use the Gemini API. Create a key at aistudio.google.com/apikey, put it in .env and restart the server." + googleSaid(body);
  if(status === 404) return `The model "${model}" isn't available for your key. Change AI_MODEL in .env (for example gemini-3.5-flash-lite) and restart the server.`;
  if(status === 429) return "Your Gemini usage limit has been reached. Wait a minute and try again, or check your plan and billing at aistudio.google.com." + googleSaid(body);
  if(status === 503 || status === 500 || status === 502 || status === 504) return "Gemini is busy right now, even after retrying. Wait a minute and try again." + googleSaid(body);
  return (msg ? `Gemini error: ${msg}` : `Gemini returned an error (${status}).`) + " Try again in a moment.";
}

// Gemini wants turns that alternate user/model and start with user.
function toContents(messages){
  const out = [];
  for(const m of messages){
    const role = m.role === "assistant" ? "model" : "user";
    const last = out[out.length - 1];
    if(last && last.role === role) last.parts[0].text += "\n\n" + m.content;
    else out.push({ role, parts: [{ text: m.content }] });
  }
  while(out.length && out[0].role !== "user") out.shift();
  return out;
}

// Opens a streaming request, retrying when Gemini is busy and switching to the backup model if needed.
async function openStream(payload, signal){
  const models = FALLBACK ? [MODEL, FALLBACK] : [MODEL];
  let lastErr = null;
  for(const model of models){
    const url = `${BASE}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
    for(let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++){
      let r;
      try{
        r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": KEY }, body: payload, signal });
      }catch(e){
        if(e.name === "AbortError") throw e;
        console.error(`[CFF] Could not reach Gemini (${model}):`, e.message);
        lastErr = Object.assign(new Error("The server could not reach Google Gemini. Check the internet connection and try again."), { status: 502 });
        if(attempt < RETRY_DELAYS.length){ await sleep(RETRY_DELAYS[attempt], signal); continue; }
        break;
      }
      if(r.ok){
        if(model !== MODEL) console.log(`[CFF] Answered with the backup model ${model} because ${MODEL} was unavailable.`);
        return r;
      }
      let body = null; try{ body = await r.json(); }catch(e){}
      console.error(`[CFF] Gemini ${model} returned ${r.status}:`, (body && body.error && body.error.message) || "(no message)");
      lastErr = Object.assign(new Error(geminiMessage(r.status, body, model)), { status: 502, http: r.status });
      const busy = [500, 502, 503, 504].includes(r.status);
      if(busy && attempt < RETRY_DELAYS.length){ await sleep(RETRY_DELAYS[attempt], signal); continue; }
      const tryBackup = busy || r.status === 429 || r.status === 404;
      if(tryBackup) break;          // move on to the backup model
      throw lastErr;                // key or permission problems: the backup won't help
    }
  }
  throw lastErr || Object.assign(new Error("Gemini didn't respond. Try again."), { status: 502 });
}

// Streams the answer as text pieces.
async function* streamChat(systemText, messages, signal){
  const payload = JSON.stringify({ systemInstruction: { parts: [{ text: systemText }] }, contents: toContents(messages) });
  const r = await openStream(payload, signal);
  const decoder = new TextDecoder();
  let buffer = "", produced = false, finish = "", blocked = "";
  for await (const chunk of r.body){
    buffer += decoder.decode(chunk, { stream: true });
    let nl;
    while((nl = buffer.indexOf("\n")) >= 0){
      const line = buffer.slice(0, nl).trim(); buffer = buffer.slice(nl + 1);
      if(!line.startsWith("data:")) continue;
      let j; try{ j = JSON.parse(line.slice(5).trim()); }catch(e){ continue; }
      if(j.error){ const err = new Error(geminiMessage(j.error.code || 500, j, MODEL)); err.status = 502; throw err; }
      if(j.promptFeedback && j.promptFeedback.blockReason) blocked = j.promptFeedback.blockReason;
      const c = j.candidates && j.candidates[0];
      if(!c) continue;
      if(c.finishReason) finish = c.finishReason;
      const parts = (c.content && c.content.parts) || [];
      for(const p of parts){
        if(p.thought || typeof p.text !== "string" || !p.text) continue;
        produced = true; yield p.text;
      }
    }
  }
  if(!produced){
    const err = new Error(blocked || /SAFETY|BLOCK|PROHIBITED/.test(finish)
      ? "Gemini didn't answer that question. Try asking it in a different way."
      : "Gemini didn't return an answer. Try again.");
    err.status = 502; throw err;
  }
}

// Checks the key and model when the server starts (free: it only reads the model's details).
async function checkSetup(){
  if(!KEY || KEY.includes("paste")) return aiProblem();
  const check = async model => {
    try{
      const r = await fetch(`${BASE}/models/${encodeURIComponent(model)}`, { headers: { "x-goog-api-key": KEY } });
      if(r.ok) return "";
      let body = null; try{ body = await r.json(); }catch(e){}
      return geminiMessage(r.status, body, model);
    }catch(e){ return ""; }       // no internet right now: don't block, the chat will report it
  };
  const main = await check(MODEL);
  if(!main) return "";
  if(/API key/i.test(main)){ startupProblem = main; return main; }
  if(FALLBACK && !(await check(FALLBACK))){
    console.log(`  Note: ${main}`);
    console.log(`  The backup model ${FALLBACK} will be used instead.`);
    return "";
  }
  startupProblem = main; return main;
}

module.exports = { aiProblem, streamChat, checkSetup, MODEL, FALLBACK };
