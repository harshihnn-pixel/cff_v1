// Settings: my account (profile, password, appearance), company details and readiness rules,
// members and invitations, and the role permissions matrix.
(function(){
"use strict";
const CFF = window.CFF;
const { $, $$, esc, I, toast, notice, empty, pill, formModal, confirmBox, fmtDate, table, tabs, onTabs, formFields, readForm, store } = CFF.util;
const S = CFF.state;

CFF.route("settings", { title: "Settings", async render(el, p, q){
  // Only the tabs this person may use are shown (the server checks the same permissions).
  const T = [["account", "My profile"], S.can("company.manage") && ["company", "Company settings"], S.can("members.manage", "employees.manage") && ["members", "Members & invitations"],
    S.can("company.manage", "members.manage") && ["permissions", "Roles & permissions"]].filter(Boolean);
  let tab = T.some(t => t[0] === q.tab) ? q.tab : "account";
  el.innerHTML = CFF.pageHead({ label: T.length > 1 ? "Settings" : "My profile", title: T.length > 1 ? "Settings" : "My profile" }) + (T.length > 1 ? tabs(T, tab) : "") + `<div id="setBody" class="stack" style="gap:16px"></div>`;
  const draw = k => ({ account, company, members, permissions })[k]($("#setBody")).catch(e => { $("#setBody").innerHTML = notice(esc(e.message), "bad"); });
  onTabs(el, draw); draw(tab);
}});

async function account(el){
  const me = S.me;
  el.innerHTML = `<section class="card stack"><h2>Profile</h2><form id="profForm" class="stack" novalidate>${formFields([{ k: "full_name", label: "Full name", required: true }, { k: "phone", label: "Phone" }], me.profile)}
      <p class="muted small">Email: <b>${esc(me.user.email)}</b></p><div class="row"><button class="btn" type="submit">Save profile</button></div></form></section>
    <section class="card stack"><h2>Change password</h2><form id="pwForm" class="stack" novalidate>${formFields([{ k: "current_password", label: "Current password", type: "password", required: true }, { k: "new_password", label: "New password", type: "password", required: true, hint: "At least 8 characters, with upper-case, lower-case and a number." }, { k: "confirm", label: "Confirm new password", type: "password", required: true }])}
      <div class="row"><button class="btn" type="submit">Change password</button></div></form></section>
    <section class="card stack"><h2>Appearance</h2><div class="row"><label class="field" style="min-width:200px"><span>Template</span><select class="input" id="tplSel2">${Object.entries(CFF.theme.TEMPLATES).map(([k, v]) => `<option value="${k}" ${k === document.body.dataset.template ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <button class="btn secondary" id="themeBtn2" type="button">${CFF.theme.isDark() ? I.sun + " Light mode" : I.moon + " Dark mode"}</button></div></section>
    <section class="card stack" id="secCard"><h2>Account security</h2>${CFF.util.loading("Loading security settings…")}</section>`;
  const pf = [{ k: "full_name", label: "Full name", required: true }, { k: "phone", label: "Phone" }];
  $("#profForm").addEventListener("submit", async e => { e.preventDefault(); try{ S.setMe(await CFF.api.patch("/api/me", readForm(e.target, pf))); toast("Profile saved."); }catch(x){ toast(x.message, "bad"); } });
  $("#pwForm").addEventListener("submit", async e => { e.preventDefault();
    try{ const v = readForm(e.target, [{ k: "current_password", label: "Current password", required: true }, { k: "new_password", label: "New password", required: true }, { k: "confirm", label: "Confirm", required: true }]);
      const bad = CFF.checkPassword(v.new_password, me.user.email); if(bad) throw new Error(bad); if(v.new_password !== v.confirm) throw new Error("The two new passwords do not match.");
      const r = await CFF.api.post("/api/me/password", { current_password: v.current_password, new_password: v.new_password }); toast(r.message); e.target.reset(); }
    catch(x){ toast(x.message, "bad"); } });
  $("#tplSel2").addEventListener("change", e => { CFF.theme.setTemplate(e.target.value); toast("Template applied."); });
  $("#themeBtn2").addEventListener("click", () => { CFF.theme.toggle(); account(el); });
  await security($("#secCard"));
}

const EVENT_LABEL = { login: "Logged in", login_failed: "Failed login (wrong password)", mfa_verified: "Logged in with two-step code", mfa_failed: "Wrong two-step code",
  mfa_enabled: "Two-step verification turned on", mfa_disabled: "Two-step verification turned off", logout_all: "Logged out on all devices",
  password_changed: "Password changed", password_reset: "Password reset from email" };
const device = ua => { ua = ua || ""; const b = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : ua ? "Other browser" : "—";
  const o = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : ""; return b + (o ? " on " + o : ""); };

// Two-step verification (authenticator app), log out everywhere, and recent login activity.
async function security(el){
  let d;
  try{ d = await CFF.api.get("/api/me/security"); }catch(e){ el.innerHTML = `<h2>Account security</h2>` + notice(esc(e.message), "bad"); return; }
  const leader = (S.me.companies || []).some(c => ["owner", "founder", "hr"].includes(c.role));
  el.innerHTML = `<h2>Account security</h2>
    <div class="stack" style="gap:8px"><h3>Two-step verification</h3>
      ${d.mfa.enabled ? notice("On. Logging in needs your password <b>and</b> a 6-digit code from your authenticator app.", "good")
        : notice("Off. " + (leader ? "Recommended for owners, founders and HR: " : "") + "add a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy) to every login.")}
      <div id="mfaBox" class="stack"></div>
      <div class="row">${d.mfa.enabled ? `<button class="btn secondary" id="mfaOff" type="button">Turn off two-step verification</button>` : `<button class="btn" id="mfaOn" type="button">${I.check} Turn on two-step verification</button>`}</div></div>
    <div class="stack" style="gap:8px"><h3>Sessions</h3><p class="muted">Logged in on a shared or lost device? End every session, including this one.</p>
      <div class="row"><button class="btn secondary" id="outOne" type="button">${I.logout} Log out</button><button class="btn danger" id="outAll" type="button">Log out on all devices</button></div></div>
    <div class="stack" style="gap:8px"><h3>Recent login activity</h3>
      ${d.events.length ? table(["When", "Activity", "Device", "IP address"], d.events.map(e => [esc(CFF.util.fmtDateTime(e.created_at)),
        /failed/.test(e.event) ? pill(EVENT_LABEL[e.event] || e.event, "bad") : esc(EVENT_LABEL[e.event] || e.event), esc(device(e.user_agent)), `<span class="muted small">${esc(e.ip || "")}</span>`]))
        : `<p class="muted">No activity recorded yet.</p>`}
      <p class="muted small">If you see activity you don't recognise, change your password and log out on all devices.</p></div>`;
  $("#outOne").addEventListener("click", CFF.logout);
  $("#outAll").addEventListener("click", async () => {
    if(!await confirmBox("Log out on every device, including this one? You'll need to log in again everywhere.", { ok: "Log out everywhere", danger: true })) return;
    try{ await CFF.api.post("/api/me/logout-all"); CFF.api.setSession(null); S.clear(); CFF.cache = {}; toast("You have been logged out on all devices."); CFF.go("#/login"); }catch(e){ toast(e.message, "bad"); }
  });
  const off = $("#mfaOff"); if(off) off.addEventListener("click", async () => {
    if(!await confirmBox("Turn off two-step verification? Logging in will need only your password.", { ok: "Turn off", danger: true })) return;
    try{ await CFF.api.post("/api/me/mfa/disable", { refresh_token: CFF.api.refreshToken(), factorId: d.mfa.factors[0].id }); toast("Two-step verification is off."); security(el); }catch(e){ toast(e.message, "bad"); }
  });
  const on = $("#mfaOn"); if(on) on.addEventListener("click", async () => {
    on.disabled = true;
    let enr; try{ enr = await CFF.api.post("/api/me/mfa/enroll", { refresh_token: CFF.api.refreshToken() }); }catch(e){ toast(e.message, "bad"); on.disabled = false; return; }
    const qr = /^data:image\/svg\+xml/.test(enr.qr || "") ? enr.qr : "";
    $("#mfaBox").innerHTML = `<ol class="steps-list"><li>Open your authenticator app and add an account.</li><li>Scan this QR code${qr ? "" : " (not available — use the key below)"}, or type the key.</li><li>Enter the 6-digit code the app shows.</li></ol>
      <div class="row" style="align-items:flex-start;gap:20px">${qr ? `<img class="mfa-qr" alt="QR code for your authenticator app" width="180" height="180">` : ""}
        <div class="stack" style="gap:8px;min-width:0"><span class="muted small">Setup key</span><code class="mfa-secret">${esc(enr.secret)}</code>
          <form id="mfaForm" class="stack" novalidate><div class="field"><label for="mfaCode">6-digit code</label><input class="input" id="mfaCode" inputmode="numeric" autocomplete="one-time-code" maxlength="7" required style="max-width:180px;letter-spacing:.3em"></div>
          <div class="row"><button class="btn" type="submit">Verify and turn on</button></div></form></div></div>`;
    if(qr) $(".mfa-qr", el).src = qr;
    on.hidden = true; $("#mfaCode").focus();
    $("#mfaForm").addEventListener("submit", async e => {
      e.preventDefault(); const btn = $("button[type=submit]", e.target); if(btn.disabled) return;
      const code = $("#mfaCode").value.replace(/\s+/g, ""); if(!/^\d{6}$/.test(code)) return toast("Enter the 6-digit code from your authenticator app.", "bad");
      btn.disabled = true;
      try{ const r = await CFF.api.post("/api/me/mfa/verify", { refresh_token: CFF.api.refreshToken(), factorId: enr.factorId, code }); CFF.api.setSession(r.session);
        toast("Two-step verification is on."); await S.loadMe(); security(el); }
      catch(x){ toast(x.message, "bad"); btn.disabled = false; }
    });
  });
}
CFF.accountPage = account;

// "#/account" works without opening a company — e.g. when a company requires two-step verification first.
CFF.route("account", { noCompany: true, title: "My account", async render(el, p, q){
  el.innerHTML = `<main class="home narrow"><div class="row" style="justify-content:space-between"><a class="brand" href="#/start"><span class="logo">CFF</span>My account</a><a class="btn secondary sm" href="#/start">My companies</a></div>
    ${q.setup ? notice("Your company requires two-step verification for your role. Turn it on below, then open the company again.", "bad") : ""}<div id="accBody" class="stack" style="gap:16px"></div></main>`;
  await account($("#accBody"));
  if(q.setup) setTimeout(() => { const c = $("#secCard"); if(c) c.scrollIntoView({ block: "start" }); }, 50);
}});

async function company(el){
  const c = S.company; const can = S.can("company.manage");
  const fields = [{ k: "name", label: "Company name", required: true }, { k: "legal_name", label: "Registered legal name" }, { k: "industry", label: "Industry" }, { k: "city", label: "City" }, { k: "country", label: "Country" },
    { k: "description", label: "Description", type: "textarea", rows: 3, max: 2000 }].map(f => ({ ...f, disabled: !can }));
  el.innerHTML = `<section class="card stack"><h2>Company details</h2><form id="coForm" class="stack" novalidate>${formFields(fields, c)}${can ? `<div class="row"><button class="btn" type="submit">Save</button></div>` : ""}</form></section>
    <section class="card stack"><h2>Readiness rules</h2><p class="muted">CFF shows warnings when stages are done out of order (for example, finalising the brand before values are approved). By default these only guide you.</p>
      <label class="check"><input type="checkbox" id="enf" ${(c.settings || {}).enforce_readiness ? "checked" : ""} ${can ? "" : "disabled"}> Block stage approval while a stage has readiness warnings</label>
      <p class="muted small">Shareholding must always total 100% before Stage 5 is approved.</p></section>
    <section class="card stack"><h2>Security policy</h2><p class="muted">Require two-step verification (an authenticator app code at login) for Owners, Founders / Directors and HR. People in those roles without it are asked to turn it on before they can open this company.</p>
      <label class="check"><input type="checkbox" id="reqMfa" ${(c.settings || {}).require_mfa ? "checked" : ""} ${can ? "" : "disabled"}> Require two-step verification for Owners, Founders and HR</label></section>
    ${S.role === "owner" ? `<section class="card stack danger-zone"><h2>Archive company</h2><p class="muted">Archiving hides this workspace for everyone. Data is kept and can be restored by support.</p><div class="row"><button class="btn danger" id="archCo">Archive this company</button></div></section>` : ""}`;
  if(can){
    $("#coForm").addEventListener("submit", async e => { e.preventDefault(); try{ const r = await CFF.api.c.patch("", readForm(e.target, fields)); S.company = { ...S.company, ...r.company }; await S.loadMe(); toast("Saved."); CFF.render(); }catch(x){ toast(x.message, "bad"); } });
    $("#enf").addEventListener("change", async e => { try{ const r = await CFF.api.c.patch("", { settings: { enforce_readiness: e.target.checked } }); S.company.settings = r.company.settings; toast(e.target.checked ? "Readiness rules are now enforced." : "Readiness rules now only guide."); }catch(x){ toast(x.message, "bad"); e.target.checked = !e.target.checked; } });
  }
  const rm = $("#reqMfa"); if(rm && can) rm.addEventListener("change", async e => {
    try{ const r = await CFF.api.c.patch("", { settings: { require_mfa: e.target.checked } }); S.company.settings = r.company.settings; toast(e.target.checked ? "Two-step verification is now required for Owners, Founders and HR." : "Two-step verification is now optional."); }
    catch(x){ toast(x.message, "bad"); e.target.checked = !e.target.checked; } });
  const ac = $("#archCo"); if(ac) ac.addEventListener("click", async () => {
    if(!await confirmBox(`Archive “${c.name}”? Everyone loses access to this workspace.`, { ok: "Archive company", danger: true })) return;
    try{ const r = await CFF.api.c.post("/archive"); S.setMe(r.me); S.company = null; store.del("cff:company"); S.companyId = null; toast("Company archived."); CFF.go("#/start"); }catch(x){ toast(x.message, "bad"); }
  });
}

async function members(el){
  const d = await CFF.api.c.get("/members");
  const canManage = d.canManage, canInvite = S.can("members.manage", "employees.manage");
  const roleOpts = CATALOGS.ROLES.filter(r => r.key !== "owner" || S.role === "owner").map(r => [r.key, r.label]);
  const editable = m => canManage && m.user_id !== S.me.user.id && (m.role_key !== "owner" || S.role === "owner");
  const now = Date.now();
  const invRow = i => { const exp = i.expires_at && new Date(i.expires_at).getTime() < now;
    return { attrs: `data-inv="${esc(i.id)}"`, cells: [esc(i.email), esc(CATALOGS.ROLE_LABEL[i.role_key] || i.role_key), esc(fmtDate(i.last_sent_at || i.created_at)) + (i.sent_count > 1 ? `<span class="muted small block">sent ${i.sent_count} times</span>` : ""),
      exp ? pill("Expired", "bad") : esc(fmtDate(i.expires_at)),
      (canManage || i.role_key === "employee") ? `<div class="row nowrap"><button class="btn secondary sm" data-resend>${exp ? "Renew & resend" : "Resend"}</button><button class="btn quiet sm" data-revoke>Cancel</button></div>` : ""] }; };
  el.innerHTML = `<section class="card flush"><div class="card-head"><div class="stack" style="gap:2px"><h2>Members</h2><span class="muted small">People with a login in this company workspace.</span></div>${canInvite ? `<button class="btn sm" id="invBtn">${I.plus} Invite</button>` : ""}</div>
      ${table(["Name", "Role", "Designation", "Status", "Joined", ""], d.members.map(m => ({ attrs: `data-id="${esc(m.id)}"`, cells: [`<b>${esc(m.display_name)}</b>${m.email ? `<span class="muted small block">${esc(m.email)}</span>` : ""}`,
        pill(CATALOGS.ROLE_LABEL[m.role_key] || m.role_key, m.role_key === "owner" ? "accent" : ""), esc(m.designation || ""),
        m.status === "disabled" ? pill("Deactivated", "bad") + (m.status_reason ? `<span class="muted small block">${esc(m.status_reason)}</span>` : "") : pill("Active", "good"),
        esc(fmtDate(m.joined_at)),
        editable(m) ? `<div class="row nowrap">${m.status === "disabled" ? `<button class="btn secondary sm" data-react>Reactivate</button>` : `<button class="icon-btn" data-edit aria-label="Change role">${I.edit}</button><button class="btn quiet sm" data-deact>Deactivate</button>`}<button class="icon-btn" data-rm aria-label="Remove">${I.trash}</button></div>` : ""] })))}</section>
    ${d.invitations.length ? `<section class="card flush"><div class="card-head"><div class="stack" style="gap:2px"><h2>Pending invitations</h2><span class="muted small">Invitations expire after 14 days. Resending extends them.</span></div></div>${table(["Email", "Role", "Last sent", "Expires", ""], d.invitations.map(invRow))}</section>` : ""}
    <section class="card stack"><h2>Roles</h2><dl class="kv">${CATALOGS.ROLES.map(r => `<dt>${esc(r.label)}</dt><dd>${esc(r.desc)}</dd>`).join("")}</dl></section>`;
  const sentMsg = r => r.emailSent ? "Invitation emailed to " + r.invitation.email + "." : r.hasAccount ? "Invitation sent. They'll see it when they log in." : "Invitation created. Ask them to create an account with " + r.invitation.email + " — the invitation will be waiting.";
  const ib = $("#invBtn"); if(ib) ib.addEventListener("click", () => formModal({ title: "Invite someone", intro: `<p class="muted">New people get an email to set their password. People who already use CFF see the invitation when they log in. Invitations expire after 14 days.</p>`,
    fields: [{ k: "email", label: "Email", type: "email", required: true }, { k: "role", label: "Role", type: "select", required: true, options: canManage ? roleOpts.filter(r => r[0] !== "owner") : [["employee", "Employee"]], value: "employee" }, { k: "designation", label: "Designation" }],
    save: v => CFF.api.c.post("/members", v) }).then(r => { if(r){ toast(sentMsg(r)); members(el); } }));
  const find = b => d.members.find(x => x.id === b.closest("tr").dataset.id);
  $$("[data-edit]", el).forEach(b => b.addEventListener("click", () => { const m = find(b);
    formModal({ title: "Change role · " + m.display_name, values: m, intro: `<p class="muted">The new role applies immediately — on their next click they see only what the new role allows.</p>`, fields: [{ k: "role_key", label: "Role", type: "select", required: true, options: roleOpts }, { k: "designation", label: "Designation" }],
      save: v => CFF.api.c.patch("/members/" + m.id, v) }).then(r => { if(r){ toast("Saved."); members(el); } }); }));
  $$("[data-deact]", el).forEach(b => b.addEventListener("click", () => { const m = find(b);
    formModal({ title: "Deactivate " + m.display_name + "?", ok: "Deactivate", intro: `<p>They lose access to this company immediately. Their work and history are kept, and you can reactivate them later.</p>`,
      fields: [{ k: "reason", label: "Reason (optional)", placeholder: "For example: left the company" }],
      save: v => CFF.api.c.patch("/members/" + m.id, { status: "disabled", reason: v.reason || null }) }).then(r => { if(r){ toast(m.display_name + " has been deactivated."); members(el); } }); }));
  $$("[data-react]", el).forEach(b => b.addEventListener("click", async () => { const m = find(b);
    if(!await confirmBox(`Reactivate ${m.display_name}? They get access again with the role ${CATALOGS.ROLE_LABEL[m.role_key] || m.role_key}.`, { ok: "Reactivate" })) return;
    try{ await CFF.api.c.patch("/members/" + m.id, { status: "active" }); toast(m.display_name + " can access the company again."); members(el); }catch(e){ toast(e.message, "bad"); } }));
  $$("[data-rm]", el).forEach(b => b.addEventListener("click", async () => { const m = find(b);
    if(!await confirmBox(`Remove ${m.display_name} from this company? They lose access immediately. To keep them in the list, use Deactivate instead.`, { ok: "Remove", danger: true })) return;
    try{ await CFF.api.c.del("/members/" + m.id); toast("Removed."); members(el); }catch(e){ toast(e.message, "bad"); } }));
  $$("[data-resend]", el).forEach(b => b.addEventListener("click", async () => { b.disabled = true;
    try{ const r = await CFF.api.c.post("/invitations/" + b.closest("tr").dataset.inv + "/resend"); toast(r.emailSent ? "Invitation email sent again. It's valid for 14 more days." : "Invitation renewed for 14 days." + (r.hasAccount ? " They'll see it when they log in." : "")); members(el); }catch(e){ toast(e.message, "bad"); b.disabled = false; } }));
  $$("[data-revoke]", el).forEach(b => b.addEventListener("click", async () => {
    if(!await confirmBox("Cancel this invitation? The link in their email will stop working.", { ok: "Cancel invitation", danger: true })) return;
    try{ await CFF.api.c.del("/invitations/" + b.closest("tr").dataset.inv); toast("Invitation cancelled."); }catch(e){ toast(e.message, "bad"); } members(el); }));
}

async function permissions(el){
  const d = await CFF.api.c.get("/permissions");
  const roles = d.roles.filter(r => r.key !== "owner");
  const sections = []; d.catalog.forEach(p => { let s = sections.find(x => x.name === p.section); if(!s){ s = { name: p.section, items: [] }; sections.push(s); } s.items.push(p); });
  el.innerHTML = `<section class="card stack"><h2>Roles & permissions</h2><p class="muted">Choose what each role can do in this company. The Company Owner always has every permission. Permissions are enforced by the server and the database, not only by hiding buttons.</p>
    <div class="tbl-wrap perm-wrap"><table class="perm"><thead><tr><th scope="col">Permission</th>${roles.map(r => `<th scope="col">${esc(r.label)}</th>`).join("")}</tr></thead><tbody>
    ${sections.map(s => `<tr class="perm-sec"><th colspan="${roles.length + 1}" scope="colgroup">${esc(s.name)}</th></tr>` + s.items.map(p => `<tr><th scope="row">${esc(p.label)}</th>${roles.map(r => `<td><input type="checkbox" aria-label="${esc(r.label)}: ${esc(p.label)}" data-r="${r.key}" data-p="${p.key}" ${d.matrix[r.key][p.key] ? "checked" : ""} ${d.canEdit ? "" : "disabled"}></td>`).join("")}</tr>`).join("")).join("")}
    </tbody></table></div>${d.canEdit ? `<div class="row"><button class="btn" id="savePerm">Save permissions</button><span class="muted small">Changes apply immediately for everyone in the company.</span></div>` : ""}</section>`;
  const sp = $("#savePerm"); if(sp) sp.addEventListener("click", async () => {
    const matrix = {}; $$("input[data-r]", el).forEach(i => { (matrix[i.dataset.r] = matrix[i.dataset.r] || {})[i.dataset.p] = i.checked; });
    sp.disabled = true; try{ await CFF.api.c.put("/permissions", { matrix }); toast("Permissions saved."); await S.openCompany(S.companyId); }catch(e){ toast(e.message, "bad"); } finally{ sp.disabled = false; }
  });
}
})();
