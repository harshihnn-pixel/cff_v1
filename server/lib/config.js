// All settings come from .env (see .env.example). Nothing secret is ever sent to the browser.
const env = (k, d = "") => (process.env[k] || d).trim();

const config = {
  port: Number(env("PORT", "3000")) || 3000,
  appUrl: env("APP_URL", "http://localhost:" + (Number(env("PORT", "3000")) || 3000)).replace(/\/+$/, ""),
  supabaseUrl: env("SUPABASE_URL").replace(/\/+$/, ""),
  serviceKey: env("SUPABASE_SERVICE_ROLE_KEY"),
  anonKey: env("SUPABASE_ANON_KEY"),
  bucket: env("STORAGE_BUCKET", "cff-documents"),
  maxUploadMb: Math.min(Number(env("MAX_UPLOAD_MB", "20")) || 20, 50),
  trustProxy: env("TRUST_PROXY") === "true",
  forceHttps: env("FORCE_HTTPS") === "true",
  isProduction: env("NODE_ENV") === "production"
};

// Checks the settings when the server starts. Errors stop a production server; warnings are printed.
config.validate = () => {
  const errors = [], warnings = [];
  const need = (k, label) => { const val = env(k); if(!val || /paste|YOUR-PROJECT/i.test(val)) errors.push(k + " is missing (" + label + ")."); };
  need("SUPABASE_URL", "Supabase → Project Settings → Data API");
  need("SUPABASE_ANON_KEY", "Supabase → Project Settings → API Keys → anon / publishable");
  need("SUPABASE_SERVICE_ROLE_KEY", "Supabase → Project Settings → API Keys → service_role / secret");
  if(!env("GEMINI_API_KEY") || /paste/i.test(env("GEMINI_API_KEY"))) warnings.push("GEMINI_API_KEY is not set: the AI assistant is off; everything else works.");
  if(config.supabaseUrl && !/^https?:\/\//.test(config.supabaseUrl)) errors.push("SUPABASE_URL must start with https://");
  if(!/^https?:\/\/[^\s/]+/.test(config.appUrl)) errors.push("APP_URL must be the website address, like https://cff.example.com");
  if(config.isProduction){
    if(!config.appUrl.startsWith("https://")) errors.push("APP_URL must use https:// in production.");
    if(!config.forceHttps) warnings.push("FORCE_HTTPS is false in production. Set FORCE_HTTPS=true (and TRUST_PROXY=true behind a proxy/host that terminates HTTPS).");
    if(config.supabaseUrl && config.supabaseUrl.startsWith("http://")) errors.push("SUPABASE_URL must use https:// in production.");
  }
  if(env("MAX_UPLOAD_MB") && !(Number(env("MAX_UPLOAD_MB")) > 0)) warnings.push("MAX_UPLOAD_MB is not a number; using " + config.maxUploadMb + " MB.");
  return { errors, warnings };
};
config.origin = (() => { try{ return new URL(config.appUrl).origin; }catch(e){ return ""; } })();

module.exports = config;
