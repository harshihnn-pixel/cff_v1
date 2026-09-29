// CFF – Company Formation & Growth Operating System — web server.
// Serves the website from /public and the API under /api. Every company request is checked here
// (login, membership, permission) and again by the database's Row Level Security.
require("dotenv").config();
const path = require("path");
const express = require("express");
const rateLimit = require("express-rate-limit");
const config = require("./lib/config");
const db = require("./lib/supabase");
const gemini = require("./lib/gemini");
const { HttpError } = require("./lib/http");
const { requireUser, requireCompany } = require("./lib/auth");
const { securityLog } = require("./lib/log");

const auth = require("./routes/auth");
const companies = require("./routes/companies");
const brandRoutes = require("./routes/brand");
const execution = require("./routes/execution");
const people = require("./routes/people");

const app = express();
app.disable("x-powered-by");
if(config.trustProxy) app.set("trust proxy", 1);

// ---------- security headers ----------
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "frame-src 'self' blob:",
  "connect-src 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'"
].join("; ");

app.use((req, res, next) => {
  if(config.forceHttps && !req.secure){
    if(req.method === "GET" || req.method === "HEAD") return res.redirect(301, "https://" + req.get("host") + req.originalUrl);
    return res.status(400).json({ error: "Please use https." });
  }
  res.set({
    "Content-Security-Policy": CSP,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  });
  if(config.forceHttps) res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  if(req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
  next();
});

// ---------- rate limits ----------
const limiter = (windowMin, limit, message, extra = {}) => rateLimit({
  windowMs: windowMin * 60 * 1000, limit, standardHeaders: true, legacyHeaders: false, ...extra,
  handler: (req, res, next, opts) => { securityLog("rate_limited", req, { path: req.originalUrl }); res.status(opts.statusCode).json({ error: message }); }
});
const authLimit = limiter(15, 20, "Too many attempts. Wait 15 minutes and try again.", { skip: req => req.path === "/refresh" || req.path === "/session" });
const refreshLimit = limiter(15, 120, "Too many requests. Wait a few minutes and try again.");
const apiLimit = limiter(1, 300, "Too many requests. Slow down a little and try again.");
const aiLimit = limiter(10, 40, "You have asked the AI a lot in a short time. Wait a few minutes and try again.");
const uploadLimit = limiter(10, 60, "Too many uploads in a short time. Wait a few minutes and try again.");

// Cross-site request protection. The API uses a login token in the Authorization header (not cookies),
// so other websites can't act as a signed-in person; as an extra layer, changes coming from a
// browser on another site are refused. CORS headers are never sent, so other origins can't read responses.
app.use("/api", (req, res, next) => {
  if(["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  if(!origin) return next();
  const host = req.get("host");
  let ok = origin === config.origin;
  try{ ok = ok || new URL(origin).host === host; }catch(e){ ok = false; }
  if(!ok){ securityLog("cross_site_blocked", req, { origin: origin.slice(0, 100) }); return res.status(403).json({ error: "This request came from another website and was blocked." }); }
  next();
});

// JSON bodies (uploads use their own raw parser in the documents/brand routes).
app.use("/api", express.json({ limit: "400kb" }));

// ---------- API ----------
app.get("/api/health", async (req, res) => {
  const problem = gemini.aiProblem();
  const h = await db.health();
  res.json({ ready: h.ready, message: h.ready ? "" : "The database is not ready.", ai: { ready: !problem, model: gemini.MODEL } });
});

app.use("/api/auth", refreshLimit, authLimit, auth.pub);
app.use("/api", apiLimit);
app.use("/api/me", auth.me);
app.use("/api/companies", requireUser, companies.top);

const c = express.Router({ mergeParams: true });
c.use(requireUser, requireCompany);
c.use("/ai/chat", aiLimit);
c.use("/ai/generate", aiLimit);
const uploads = (req, res, next) => (req.method === "POST" ? uploadLimit(req, res, next) : next());
c.use("/documents", uploads);
c.use("/brand/assets", uploads);
c.use("/cff", require("./routes/cff"));
c.use("/values", require("./routes/values"));
c.use("/partners", require("./routes/partners"));
c.use("/structure", require("./routes/structure"));
c.use("/profile", require("./routes/profile"));
c.use("/names", brandRoutes.names);
c.use("/brand", brandRoutes.brand);
c.use("/documents", require("./routes/documents"));
c.use("/plans", execution.plans);
c.use("/tasks", execution.tasks);
c.use("/compliance", execution.compliance);
c.use("/employees", people.employees);
c.use("/content", people.content);
c.use("/kpis", require("./routes/kpis"));
c.use("/reports", require("./routes/reports"));
c.use("/ai", require("./routes/ai"));
c.use("/", require("./routes/workspace"));
c.use("/", companies.co);
app.use("/api/c/:companyId", c);

app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

// ---------- website ----------
app.use(express.static(path.join(__dirname, "..", "public"), { extensions: ["html"], maxAge: config.isProduction ? "1h" : 0 }));
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, "..", "public", "index.html")));

// ---------- errors ----------
// Friendly messages for people; details only in the server log.
app.use((err, req, res, next) => {
  if(res.headersSent){ console.error("[CFF]", err.message); return res.end(); }
  let status = err.status || err.statusCode || 500, message = err.message;
  if(err.type === "entity.parse.failed"){ status = 400; message = "The request was not valid."; }
  else if(err.type === "entity.too.large"){ status = 413; message = req.originalUrl.includes("/documents") || req.originalUrl.includes("/brand") ? "That file is too large. The limit is " + config.maxUploadMb + " MB." : "That is too much text to save at once."; }
  else if(!(err instanceof HttpError) || status >= 500){
    console.error("[CFF error]", req.method, req.originalUrl, err.stack || err.message);
    if(!(err instanceof HttpError)){ status = 500; message = "Something went wrong on our side. Please try again."; }
  }
  const body = { error: message };
  if(err.code && err instanceof HttpError) body.code = err.code;
  res.status(status).json(body);
});

// ---------- start ----------
if(require.main === module){
  const check = config.validate();
  check.warnings.forEach(w => console.warn("  Warning: " + w));
  if(check.errors.length){
    check.errors.forEach(e => console.error("  Setting problem: " + e));
    if(config.isProduction){ console.error("  The server did not start. Fix the settings in .env / your host's environment variables."); process.exit(1); }
  }
  app.listen(config.port, async () => {
    console.log("");
    console.log("  CFF – Company Formation & Growth Operating System is running");
    console.log("  Open " + config.appUrl + " in your browser");
    const h = await db.health();
    console.log(h.ready ? "  Supabase: connected ✓" : "  Supabase: NOT READY — " + h.message);
    if(h.ready){
      const b = await db.ensureBucket();
      console.log(b ? "  Document storage: NOT READY — " + b : "  Document storage: ready ✓ (private bucket " + config.bucket + ")");
    }
    const aiIssue = await gemini.checkSetup();
    console.log(aiIssue ? "  AI assistant: NOT READY — " + aiIssue : "  AI assistant: ready ✓ (model " + gemini.MODEL + (gemini.FALLBACK ? ", backup " + gemini.FALLBACK : "") + ")");
    console.log("  Press Ctrl+C to stop.");
    console.log("");
  });
}

module.exports = app;
