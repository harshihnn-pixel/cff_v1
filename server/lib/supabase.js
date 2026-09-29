// Supabase connections.
//  - admin:  the service_role key. Only for server-only jobs (creating accounts, accepting invitations,
//            notifications, reading files). It bypasses Row Level Security, so it is used sparingly.
//  - forUser(token): the anon key + the signed-in person's token. Every company read and write goes through
//            this, so the database's Row Level Security rules decide what each person can see and change.
const { createClient } = require("@supabase/supabase-js");
const config = require("./config");

const OPTIONS = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

function jwtRole(key){
  try{ return JSON.parse(Buffer.from(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")).role || ""; }
  catch(e){ return ""; }
}

// Plain-English description of what is wrong with the .env settings, or "".
function setupProblem(){
  const { supabaseUrl: url, serviceKey: svc, anonKey: anon } = config;
  if(!url || url.includes("YOUR-PROJECT") || !svc || svc.includes("paste"))
    return "Supabase is not set up yet. Copy .env.example to .env, fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY, then restart the server.";
  if(!/^https?:\/\/.+/.test(url)) return "SUPABASE_URL in .env should look like https://your-project.supabase.co";
  if(svc.startsWith("sb_publishable_") || jwtRole(svc) === "anon")
    return "SUPABASE_SERVICE_ROLE_KEY in .env is the anon / publishable key. Use the service_role / secret key there (Supabase → Project Settings → API Keys) and restart.";
  if(!anon || anon.includes("paste"))
    return "SUPABASE_ANON_KEY is missing in .env. Copy the anon / publishable key from Supabase → Project Settings → API Keys and restart the server.";
  if(anon.startsWith("sb_secret_") || jwtRole(anon) === "service_role")
    return "SUPABASE_ANON_KEY in .env is the secret key. Put the anon / publishable key there instead, and restart.";
  return "";
}

const problem = setupProblem();
const admin = problem ? null : createClient(config.supabaseUrl, config.serviceKey, OPTIONS);

// A fresh client for sign-in and sign-up, so one person's session never leaks into another request.
const authClient = () => createClient(config.supabaseUrl, config.anonKey, OPTIONS);

// A client that acts as the signed-in person (Row Level Security applies).
const forUser = token => createClient(config.supabaseUrl, config.anonKey, {
  ...OPTIONS, global: { headers: { Authorization: "Bearer " + token } }
});

// Turns database errors into messages a person can act on. Technical details go to the server log only.
function friendly(error){
  const code = (error && error.code) || "";
  const msg = (error && error.message) || "";
  if(code === "42P01" || code === "PGRST205" || code === "42883" || /does not exist|Could not find the (table|function)/i.test(msg))
    return "The database is not up to date. Run supabase/setup.sql in the Supabase SQL Editor, then restart the server.";
  if(code === "42501" || /row-level security|permission denied/i.test(msg)) return "You don't have permission to do that.";
  if(code === "23505") return "That already exists.";
  if(code === "23514" || code === "P0001") return msg.replace(/^.*?:\s*/, "") || "That change isn't allowed.";
  if(code === "23503") return "Something this refers to no longer exists. Refresh the page and try again.";
  if(code === "22P02" || code === "22007" || code === "22008") return "One of the values isn't in the right format.";
  if(/Invalid API key|JWT/i.test(msg)) return "The server's Supabase keys are not valid. Check .env and restart.";
  if(/fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(msg)) return "The server could not reach Supabase. Check the internet connection and try again.";
  return "Something went wrong on the server. Please try again.";
}

async function health(){
  if(problem) return { server: true, ready: false, message: problem };
  try{
    const { error } = await admin.from("cff_companies").select("id", { head: true, count: "exact" }).limit(1);
    if(error){ console.error("[CFF] Health check:", error.message); return { server: true, ready: false, message: friendly(error) }; }
    return { server: true, ready: true };
  }catch(e){ return { server: true, ready: false, message: friendly(e) }; }
}

// Makes sure the private file bucket exists (documents, logos).
async function ensureBucket(){
  if(!admin) return "";
  try{
    const got = await admin.storage.getBucket(config.bucket);
    if(got && got.data) return "";
    const made = await admin.storage.createBucket(config.bucket, { public: false, fileSizeLimit: config.maxUploadMb * 1024 * 1024 });
    if(made.error) return "Could not create the storage bucket \"" + config.bucket + "\": " + made.error.message;
    return "";
  }catch(e){ return "Could not check file storage: " + e.message; }
}

module.exports = { admin, authClient, forUser, problem, friendly, health, ensureBucket };
