// Request helpers: errors, async wrapper and input validation.
class HttpError extends Error {
  constructor(status, message, extra){ super(message); this.status = status; if(extra) Object.assign(this, extra); }
}
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Throws the database error as a friendly HttpError (details stay in the server log).
function check(result, what){
  if(result && result.error){
    const e = result.error;
    const { friendly } = require("./supabase");
    console.error("[CFF db]", what || "", e.code || "", e.message);
    const status = e.code === "42501" ? 403 : (e.code === "23505" ? 409 : (["23514","P0001","22P02","22007","23503"].includes(e.code) ? 400 : 500));
    throw new HttpError(status, friendly(e));
  }
  return result ? result.data : null;
}

// ---------- validation ----------
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const bad = msg => { throw new HttpError(400, msg); };

const v = {
  // Text: trimmed, max length; required unless opt.optional.
  str(val, name, max = 200, opt = {}){
    if(val === undefined || val === null || val === ""){ if(opt.optional) return opt.empty === undefined ? null : opt.empty; bad(name + " is required."); }
    if(typeof val !== "string" && typeof val !== "number") bad(name + " must be text.");
    const s = String(val).replace(/\u0000/g, "").trim();
    if(!s && !opt.optional) bad(name + " is required.");
    if(s.length > max) bad(name + " must be " + max + " characters or fewer.");
    return s || (opt.optional ? (opt.empty === undefined ? null : opt.empty) : s);
  },
  text(val, name, max = 20000){ return v.str(val, name, max, { optional: true, empty: "" }); },
  opt(val, name, max = 200){ return v.str(val, name, max, { optional: true }); },
  oneOf(val, name, allowed, opt = {}){
    if((val === undefined || val === null || val === "") && opt.optional) return opt.default === undefined ? null : opt.default;
    if(!allowed.includes(val)) bad(name + " must be one of: " + allowed.join(", ") + ".");
    return val;
  },
  int(val, name, min, max, opt = {}){
    if((val === undefined || val === null || val === "") && opt.optional) return null;
    const n = Number(val); if(!Number.isInteger(n) || n < min || n > max) bad(name + " must be a whole number from " + min + " to " + max + ".");
    return n;
  },
  num(val, name, opt = {}){
    if((val === undefined || val === null || val === "") && opt.optional) return null;
    const n = Number(val); if(!Number.isFinite(n)) bad(name + " must be a number.");
    if(opt.min !== undefined && n < opt.min) bad(name + " must be at least " + opt.min + ".");
    if(opt.max !== undefined && n > opt.max) bad(name + " must be at most " + opt.max + ".");
    return n;
  },
  date(val, name, opt = { optional: true }){
    if(val === undefined || val === null || val === ""){ if(opt.optional) return null; bad(name + " is required."); }
    if(!DATE.test(val) || isNaN(Date.parse(val))) bad(name + " must be a date (YYYY-MM-DD).");
    return val;
  },
  bool(val){ return val === true || val === "true" || val === 1; },
  uuid(val, name, opt = {}){
    if((val === undefined || val === null || val === "") && opt.optional) return null;
    if(typeof val !== "string" || !UUID.test(val)) bad(name + " is not valid.");
    return val;
  },
  email(val, name = "Email"){
    const s = v.str(val, name, 200).toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) bad("Enter a valid email address, like name@example.com.");
    return s;
  },
  // Phone: digits with optional +, spaces, dashes, dots and brackets; 7–15 digits.
  phone(val, name = "Phone"){
    if(val === undefined || val === null || String(val).trim() === "") return null;
    const s = String(val).trim();
    const digits = s.replace(/\D/g, "");
    if(!/^\+?[\d\s().-]{7,24}$/.test(s) || digits.length < 7 || digits.length > 15) bad(name + " must be a valid phone number, like +91 98765 43210.");
    return s;
  },
  // Strong password: at least 8 characters with upper-case, lower-case and a number.
  password(val, email){
    if(typeof val !== "string" || val.length < 8) bad("Password must be at least 8 characters.");
    if(val.length > 72) bad("Password must be 72 characters or fewer.");
    if(!/[a-z]/.test(val) || !/[A-Z]/.test(val) || !/[0-9]/.test(val)) bad("Password must include an upper-case letter, a lower-case letter and a number.");
    if(email && val.toLowerCase().includes(String(email).split("@")[0].toLowerCase()) && String(email).split("@")[0].length >= 4) bad("Password must not contain your email name.");
    return val;
  },
  // Keeps only the listed keys, each a text value up to max length.
  textMap(obj, keys, max = 5000){
    const out = {};
    if(!obj || typeof obj !== "object") return out;
    keys.forEach(k => { if(obj[k] !== undefined) out[k] = v.text(obj[k], k, max); });
    return out;
  }
};

// Only the fields that were sent (for PATCH requests).
function patch(body, spec){
  const out = {};
  Object.entries(spec).forEach(([k, fn]) => { if(body && Object.prototype.hasOwnProperty.call(body, k)) out[k] = fn(body[k]); });
  if(!Object.keys(out).length) bad("Nothing to update.");
  return out;
}

module.exports = { HttpError, wrap, check, v, patch, UUID };
