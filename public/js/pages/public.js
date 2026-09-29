// Public pages: welcome (choose a portal), log in, create account, forgot / reset password.
(function(){
"use strict";
const CFF = window.CFF;
const { $, $$, esc, I, toast, notice, store, pad } = CFF.util;
const S = CFF.state;
const PORTAL_KEYS = ["business", "employee", "visitor"];

const ARCH = [
  ["CFF CORE", "The original 13-stage Company Formation Framework."],
  ["CFF INTELLIGENCE", "Questions, guidance, the Values Discovery Assessment, AI analysis and recommendations."],
  ["CFF EXECUTION", "Tasks, plans, milestones, responsibilities, approvals, documents and compliance."],
  ["CFF MANAGEMENT", "Employees, departments, KPIs, reviews and continuous improvement."],
  ["CFF REPORTING", "Master Report, progress, audit history and KPI reports."]
];
CFF.ARCH = ARCH;

CFF.route("welcome", { public: true, title: "Welcome", render(el){
  document.body.dataset.portal = "business";
  const signed = CFF.api.loggedIn();
  const cards = PORTAL_KEYS.map(k => { const P = PORTALS[k];
    const href = k === "visitor" ? "#/visitor" : signed ? "#/" : `#/login?portal=${k}`;
    return `<a class="card portal-card" data-p="${k}" href="${href}">
      <span class="ic">${I[k]}</span><h2>${esc(P.label)}</h2><p>${esc(P.tagline)}</p>
      <span class="go">${k === "visitor" ? "Explore CFF and the demo" : signed ? "Continue" : "Log in or create account"} ${I.arrow}</span></a>`; }).join("");
  el.innerHTML = `<main class="home">
    <div class="row" style="justify-content:space-between"><a class="brand" href="#/welcome"><span class="logo">CFF</span>Company Formation &amp; Growth OS</a>
      <div class="row">${signed ? `<a class="btn secondary sm" href="#/">Open my workspace</a>` : `<a class="btn secondary sm" href="#/login">Log in</a><a class="btn sm" href="#/signup?portal=business">Create account</a>`}</div></div>
    <header class="home-hero"><span class="label">CFF – Company Formation &amp; Growth Operating System</span><h1>From business idea to a successful, growing company</h1>
      <p>${esc(INTRO.paragraphs[0])}</p></header>
    <section class="portal-grid" aria-label="Choose a portal">${cards}</section>
    <section class="card" aria-labelledby="flowh"><span class="label" id="flowh">The original 13 stages (CFF core)</span>
      <ol class="flow">${STAGES.map(s => `<li><span class="n">${pad(s.n)}</span><span>${esc(s.flow || s.title)}</span></li>`).join("")}</ol></section>
    <section class="arch" aria-label="How CFF is organised">${ARCH.map(([t, d]) => `<div class="card arch-card"><b>${esc(t)}</b><span>${esc(d)}</span></div>`).join("")}</section>
  </main>`;
}});

/* ---------- auth layout ---------- */
function authPage(el, portal, title, sub, form){
  const P = PORTALS[portal] || PORTALS.business;
  document.body.dataset.portal = portal;
  el.innerHTML = `<div class="auth">
    <aside class="auth-side">
      <a class="back" href="#/welcome">${I.back} All portals</a>
      <div class="stack"><h1>${esc(P.label)}</h1><p class="tag">${esc(P.tagline)}</p></div>
      <div class="auth-journey">${INTRO.journey.map(([k, v]) => `<div><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join("")}</div>
    </aside>
    <main class="auth-main"><div class="auth-card">
      <div class="stack" style="gap:6px"><h2>${esc(title)}</h2><p class="muted">${sub}</p></div>
      ${form}
    </div></main></div>`;
}
const pwHint = "At least 8 characters, with an upper-case letter, a lower-case letter and a number.";
function checkPassword(pw, email){
  if(pw.length < 8) return "Password must be at least 8 characters.";
  if(!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw)) return "Password must include an upper-case letter, a lower-case letter and a number.";
  const nm = (email || "").split("@")[0].toLowerCase(); if(nm.length >= 4 && pw.toLowerCase().includes(nm)) return "Password must not contain your email name.";
  return "";
}
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
function bindForm(onSubmit){
  const form = $("#authForm"), btn = $("button[type=submit]", form), label = btn.innerHTML;
  const msg = (text, good) => { const m = $("#authMsg"); m.innerHTML = text; m.className = "alert" + (good ? " good" : ""); m.hidden = !text; };
  form.addEventListener("submit", async e => {
    e.preventDefault(); if(btn.disabled) return; msg("");
    btn.disabled = true; btn.textContent = "Please wait…";
    try{ await onSubmit(msg); }catch(err){ msg(esc(err.message)); }
    finally{ btn.disabled = false; btn.innerHTML = label; }
  });
  return msg;
}
async function afterLogin(me){
  S.setMe(me); CFF.cache = {};
  const back = store.get("cff:after-login"); store.del("cff:after-login");
  if(S.portal === "visitor" && !me.companies.length) return CFF.go("#/visitor");
  if(!me.companies.length) return CFF.go("#/start");
  if(!S.companyId || !me.companies.some(c => c.id === S.companyId)) S.companyId = me.companies[0].id;
  try{ await S.openCompany(S.companyId); }catch(e){ return CFF.go(e.code === "mfa_setup_required" ? "#/account?setup=1" : "#/start"); }
  CFF.go(back && back !== "#/login" ? back : CFF.home());
}

CFF.route("login", { public: true, title: "Log in", render(el, p, q){
  if(q.portal) S.setPortal(q.portal);
  const portal = S.portal;
  authPage(el, portal, "Welcome back", "Log in to your " + esc(PORTALS[portal].label) + ".", `
    <nav class="seg" aria-label="Account"><a href="#/login?portal=${portal}" aria-current="page">Log in</a><a href="#/signup?portal=${portal}">Create account</a></nav>
    <form id="authForm" novalidate class="stack">
      <div class="field"><label for="email">Email</label><input class="input" id="email" type="email" autocomplete="email" required placeholder="you@example.com"></div>
      <div class="field"><label for="pw">Password</label><input class="input" id="pw" type="password" autocomplete="current-password" required></div>
      <div class="row" style="justify-content:space-between"><a class="link" href="#/forgot">Forgot password?</a></div>
      <div id="authMsg" class="alert" role="alert" hidden></div>
      <button class="btn" type="submit">Log in ${I.arrow}</button>
    </form>
    ${portal === "visitor" ? `<p class="demo-note">No account needed to look around: <a class="link" href="#/visitor">open the Visitor Portal</a>.</p>` : ""}`);
  const msg = bindForm(async msg => {
    const email = $("#email").value.trim().toLowerCase(), pw = $("#pw").value;
    if(!emailOk(email)) return msg("Enter a valid email address, like name@example.com.");
    if(!pw) return msg("Enter your password.");
    try{ const d = await CFF.api.auth.login(email, pw); if(d.mfaRequired) return mfaStep(d); await afterLogin(d.me); }
    catch(e){
      if(e.code === "email_not_confirmed"){ msg(esc(e.message) + ` <button class="link" type="button" id="resendBtn">Send the link again</button>`);
        $("#resendBtn").addEventListener("click", async () => { const r = await CFF.api.auth.resend(email).catch(x => ({ message: x.message })); msg(esc(r.message), true); }); return; }
      throw e;
    }
  });
  void msg;
}});

// Second step of logging in when two-step verification is on.
function mfaStep(d){
  $(".auth-card").innerHTML = `<div class="stack"><h2>Enter your code</h2><p class="muted">${esc(d.message || "Enter the 6-digit code from your authenticator app.")}</p>
    <form id="authForm" novalidate class="stack">
      <div class="field"><label for="code">6-digit code</label><input class="input" id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" pattern="[0-9 ]*" required placeholder="123456" style="letter-spacing:.3em;font-size:1.2rem"></div>
      <div id="authMsg" class="alert" role="alert" hidden></div>
      <button class="btn" type="submit">Verify and continue ${I.arrow}</button>
      <a class="link" href="#/login">Use a different account</a>
    </form></div>`;
  $("#code").focus();
  bindForm(async msg => {
    const code = $("#code").value.replace(/\s+/g, "");
    if(!/^\d{6}$/.test(code)) return msg("Enter the 6-digit code from your authenticator app.");
    try{ const r = await CFF.api.auth.mfa(d.pending, d.factorId, code); await afterLogin(r.me); }
    catch(e){ if(e.status === 401 && e.code !== "mfa_invalid"){ msg(esc(e.message) + ' <a class="link" href="#/login">Log in again</a>'); return; } $("#code").value = ""; throw e; }
  });
}

CFF.route("signup", { public: true, title: "Create account", render(el, p, q){
  if(q.portal) S.setPortal(q.portal);
  const portal = S.portal;
  const note = portal === "employee" ? "Create your login, then accept your company's invitation. Use the same email your company invited."
    : portal === "visitor" ? "Create an account to try CFF and start your own company workspace."
    : "Create your account, then set up your company workspace.";
  authPage(el, portal, "Create your account", esc(note), `
    <nav class="seg" aria-label="Account"><a href="#/login?portal=${portal}">Log in</a><a href="#/signup?portal=${portal}" aria-current="page">Create account</a></nav>
    <form id="authForm" novalidate class="stack">
      <div class="field"><label for="name">Full name</label><input class="input" id="name" autocomplete="name" required maxlength="120"></div>
      <div class="two">
        <div class="field"><label for="email">Email</label><input class="input" id="email" type="email" autocomplete="email" required placeholder="you@example.com"></div>
        <div class="field"><label for="phone">Phone <span class="muted" style="font-weight:400">(optional)</span></label><input class="input" id="phone" type="tel" autocomplete="tel" placeholder="+91" maxlength="40"></div>
      </div>
      <div class="two">
        <div class="field"><label for="pw">Password</label><input class="input" id="pw" type="password" autocomplete="new-password" required aria-describedby="pwHint"><span class="hint" id="pwHint">${esc(pwHint)}</span></div>
        <div class="field"><label for="pw2">Confirm password</label><input class="input" id="pw2" type="password" autocomplete="new-password" required></div>
      </div>
      <div id="authMsg" class="alert" role="alert" hidden></div>
      <button class="btn" type="submit">Create account ${I.arrow}</button>
    </form>`);
  bindForm(async msg => {
    const f = { name: $("#name").value.trim(), email: $("#email").value.trim().toLowerCase(), phone: $("#phone").value.trim(), password: $("#pw").value, portal };
    if(f.name.length < 2) return msg("Enter your full name.");
    if(!emailOk(f.email)) return msg("Enter a valid email address, like name@example.com.");
    if(f.phone && !CFF.util.phoneOk(f.phone)) return msg("Enter a valid phone number, like +91 98765 43210, or leave it empty.");
    const bad = checkPassword(f.password, f.email); if(bad) return msg(esc(bad));
    if(f.password !== $("#pw2").value) return msg("The two passwords do not match.");
    const d = await CFF.api.auth.signup(f);
    if(d.session && d.me){ toast("Account created. Welcome, " + f.name.split(" ")[0] + "."); return afterLogin(d.me); }
    $(".auth-card").innerHTML = `<div class="stack"><h2>Check your email</h2>${notice(esc(d.message), "good")}
      <p class="muted">The link opens CFF and signs you in. If you can't find it, check your spam folder.</p>
      <div class="row"><button class="btn secondary" id="resendBtn" type="button">Send the link again</button><a class="btn" href="#/login?portal=${portal}">Go to log in</a></div><p id="authMsg" class="alert" hidden></p></div>`;
    $("#resendBtn").addEventListener("click", async () => { const r = await CFF.api.auth.resend(f.email).catch(x => ({ message: x.message })); toast(r.message); });
  });
}});

CFF.route("forgot", { public: true, title: "Forgot password", render(el){
  authPage(el, S.portal, "Reset your password", "Enter your email and we'll send you a link to choose a new password.", `
    <form id="authForm" novalidate class="stack">
      <div class="field"><label for="email">Email</label><input class="input" id="email" type="email" autocomplete="email" required></div>
      <div id="authMsg" class="alert" role="alert" hidden></div>
      <button class="btn" type="submit">Send reset link</button>
      <a class="link" href="#/login">Back to log in</a>
    </form>`);
  bindForm(async msg => {
    const email = $("#email").value.trim().toLowerCase();
    if(!emailOk(email)) return msg("Enter a valid email address, like name@example.com.");
    const d = await CFF.api.auth.forgot(email);
    msg(esc(d.message), true);
  });
}});

// Opened from auth-callback.html after the person clicks the link in the reset email.
// Also opened from an invitation email: a new person chooses their password, then logs in and accepts.
CFF.route("reset", { public: true, title: "Choose a new password", render(el, p, q){
  let token = ""; try{ token = sessionStorage.getItem("cff:recovery") || ""; }catch(e){}
  const invite = q && q.invite === "1";
  if(!token){ authPage(el, S.portal, "Link expired", invite ? "This invitation link has expired or was already used. Ask the company to resend your invitation, or reset your password if you already set one." : "This password reset link has expired or was already used.", `<a class="btn" href="#/forgot">Ask for a new link</a>`); return; }
  if(invite) S.setPortal("employee");
  authPage(el, S.portal, invite ? "Welcome to CFF" : "Choose a new password", invite ? "You've been invited to join a company on CFF. Choose a password for your account. " + esc(pwHint) : esc(pwHint), `
    <form id="authForm" novalidate class="stack">
      ${invite ? `<div class="field"><label for="name">Full name</label><input class="input" id="name" autocomplete="name" required maxlength="120"></div>` : ""}
      <div class="field"><label for="pw">New password</label><input class="input" id="pw" type="password" autocomplete="new-password" required></div>
      <div class="field"><label for="pw2">Confirm new password</label><input class="input" id="pw2" type="password" autocomplete="new-password" required></div>
      <div id="authMsg" class="alert" role="alert" hidden></div>
      <button class="btn" type="submit">Save new password</button>
    </form>`);
  bindForm(async msg => {
    const pw = $("#pw").value; const bad = checkPassword(pw, ""); if(bad) return msg(esc(bad));
    if(pw !== $("#pw2").value) return msg("The two passwords do not match.");
    const name = invite ? $("#name").value.trim() : "";
    if(invite && name.length < 2) return msg("Enter your full name.");
    const d = await CFF.api.auth.reset(token, pw, name);
    try{ sessionStorage.removeItem("cff:recovery"); }catch(e){}
    $(".auth-card").innerHTML = invite
      ? `<div class="stack"><h2>Your account is ready</h2>${notice("Password saved. Log in, then accept your invitation on the next screen.", "good")}<a class="btn" href="#/login?portal=employee">Log in</a></div>`
      : `<div class="stack"><h2>Password changed</h2>${notice(esc(d.message), "good")}<a class="btn" href="#/login">Log in</a></div>`;
  });
}});

CFF.checkPassword = checkPassword;
CFF.afterLogin = afterLogin;
})();
