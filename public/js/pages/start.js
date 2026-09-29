// "My companies": open a company workspace, accept invitations, or create a new company.
(function(){
"use strict";
const CFF = window.CFF;
const { $, $$, esc, I, toast, notice, empty } = CFF.util;
// Opening a company can require two-step verification first (company security policy).
const openErr = e => { if(e.code === "mfa_setup_required"){ toast(e.message, "bad"); CFF.go("#/account?setup=1"); return true; } toast(e.message, "bad"); return false; };
const S = CFF.state;

CFF.route("start", { noCompany: true, title: "My companies", async render(el, p, q){
  document.body.dataset.portal = S.portal === "visitor" ? "visitor" : "business";
  const me = await S.loadMe();
  const first = (me.profile.full_name || "").split(" ")[0];
  const invites = me.invitations.map(i => `<div class="li inv"><div class="stack" style="gap:2px;min-width:0"><b>${esc(i.company)}</b><span class="muted small">You're invited as ${esc(CATALOGS.ROLE_LABEL[i.role] || i.role)}${i.designation ? " · " + esc(i.designation) : ""}</span>
      ${i.expired ? `<span class="small" style="color:var(--danger)">This invitation has expired. Ask ${esc(i.company)} to resend it.</span>` : i.expires_at ? `<span class="muted small">Valid until ${esc(CFF.util.fmtDate(i.expires_at))}</span>` : ""}</div>
    <div class="row">${i.expired ? "" : `<button class="btn sm" data-accept="${esc(i.id)}">Accept</button>`}<button class="btn secondary sm" data-decline="${esc(i.id)}">${i.expired ? "Dismiss" : "Decline"}</button></div></div>`).join("");
  const off = (me.deactivated || []).length ? notice("Your access to " + me.deactivated.map(esc).join(", ") + " has been deactivated. Contact the company owner if you think this is a mistake.", "bad") : "";
  const companies = me.companies.map(c => `<button class="li co" data-open="${esc(c.id)}"><span class="avatar sq">${esc(CFF.util.initials(c.name))}</span>
    <span class="stack" style="gap:2px;min-width:0;text-align:left"><b>${esc(c.name)}</b><span class="muted small">${esc(CATALOGS.ROLE_LABEL[c.role] || c.role)}${c.designation ? " · " + esc(c.designation) : ""}</span></span><span class="chev">${I.chev}</span></button>`).join("");
  el.innerHTML = `<main class="home narrow">
    <div class="row" style="justify-content:space-between"><a class="brand" href="#/welcome"><span class="logo">CFF</span>Company Formation &amp; Growth OS</a>
      <div class="row"><a class="btn quiet sm" href="#/visitor">Visitor Portal</a><a class="btn quiet sm" href="#/account">My account</a><button class="btn secondary sm" id="outBtn">${I.logout} Log out</button></div></div>
    <header class="home-hero"><h1>${q.welcome ? "Welcome" : "Hello"}, ${esc(first || "there")}</h1>
      <p>${me.user.confirmed ? "" : "Please confirm your email address to accept invitations. "}Choose a company workspace, accept an invitation, or start a new company.</p></header>
    ${off}${invites ? `<section class="card stack"><h2>Invitations</h2><div class="list">${invites}</div></section>` : ""}
    <section class="card stack"><h2>Your companies</h2>${companies ? `<div class="list">${companies}</div>` : empty("No company yet", S.portal === "employee" ? "Ask your company to invite this email address. The invitation will appear here." : "Start your first company workspace below.")}</section>
    <section class="card stack" id="newCo"><h2>Start a new company workspace</h2>
      <p class="muted">Each company has its own CFF journey, partners, team, documents and reports. You'll be its owner.</p>
      <form id="coForm" class="stack" novalidate>${CFF.util.formFields([
        { k: "name", label: "Company or business name", required: true, placeholder: "You can change it later (Stage 8)" },
        { k: "industry", label: "Industry" }, { k: "city", label: "City" },
        { k: "description", label: "Short description", type: "textarea", rows: 2, max: 2000 }])}
        <p class="alert" id="coErr" hidden></p>
        <div class="row"><button class="btn" type="submit">Create company ${I.arrow}</button></div></form></section>
  </main>`;
  $("#outBtn").addEventListener("click", CFF.logout);
  $$("[data-open]", el).forEach(b => b.addEventListener("click", async () => {
    b.disabled = true;
    try{ await S.openCompany(b.dataset.open); CFF.cache = {}; CFF.go(CFF.home()); }catch(e){ if(!openErr(e)) b.disabled = false; }
  }));
  $$("[data-accept]", el).forEach(b => b.addEventListener("click", async () => {
    b.disabled = true;
    try{ const inv = me.invitations.find(i => i.id === b.dataset.accept); S.setMe(await CFF.api.post("/api/me/invitations/" + b.dataset.accept + "/accept"));
      toast("You joined " + inv.company + ".");
      try{ await S.openCompany(inv.company_id); }catch(e){ if(openErr(e)) return; return CFF.render(); }
      CFF.cache = {}; CFF.go(CFF.home()); }
    catch(e){ toast(e.message, "bad"); if(e.code === "invitation_expired"){ S.setMe(await S.loadMe()); return CFF.render(); } b.disabled = false; }
  }));
  $$("[data-decline]", el).forEach(b => b.addEventListener("click", async () => {
    const expired = (me.invitations.find(i => i.id === b.dataset.decline) || {}).expired;
    if(!expired && !await CFF.util.confirmBox("Decline this invitation?", { ok: "Decline", danger: true })) return;
    try{ S.setMe(await CFF.api.post("/api/me/invitations/" + b.dataset.decline + "/decline")); CFF.render(); }catch(e){ toast(e.message, "bad"); }
  }));
  $("#coForm").addEventListener("submit", async e => {
    e.preventDefault(); const err = $("#coErr"); err.hidden = true;
    const f = { name: $("[name=name]", el).value.trim(), industry: $("[name=industry]", el).value.trim(), city: $("[name=city]", el).value.trim(), description: $("[name=description]", el).value.trim() };
    if(!f.name){ err.textContent = "Enter the company name."; err.hidden = false; return; }
    const btn = $("button[type=submit]", e.target); btn.disabled = true;
    try{ const d = await CFF.api.post("/api/companies", f); S.setMe(d.me); await S.openCompany(d.company.id); CFF.cache = {}; toast("Company workspace created."); CFF.go("#/dashboard"); }
    catch(x){ err.textContent = x.message; err.hidden = false; btn.disabled = false; }
  });
  if(q.new) setTimeout(() => { $("#newCo").scrollIntoView({ block: "start" }); $("[name=name]", el).focus(); }, 50);
}});
})();
