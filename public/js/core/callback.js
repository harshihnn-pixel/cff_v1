// Handles the links in CFF emails (confirm account, reset password). Supabase sends the person here
// with a one-time session in the URL fragment; we move it out of the address bar immediately.
(function(){
  "use strict";
  var box = document.getElementById("cb");
  var raw = (location.hash || "").replace(/^#/, "") || (location.search || "").replace(/^\?/, "");
  var p = new URLSearchParams(raw);
  try{ history.replaceState(null, "", location.pathname); }catch(e){}
  function show(title, text, href, label){
    box.className = "home";
    box.innerHTML = "";
    var card = document.createElement("div"); card.className = "card stack"; card.style.maxWidth = "520px"; card.style.margin = "60px auto";
    var h = document.createElement("h1"); h.textContent = title;
    var t = document.createElement("p"); t.className = "muted"; t.textContent = text;
    var a = document.createElement("a"); a.className = "btn"; a.href = href; a.textContent = label;
    card.appendChild(h); card.appendChild(t); card.appendChild(a); box.appendChild(card);
  }
  if(p.get("error") || p.get("error_code")){
    var expired = /expired|invalid/i.test(p.get("error_description") || p.get("error_code") || "");
    return show(expired ? "This link has expired" : "This link didn't work",
      expired ? "Links in CFF emails can only be used once and expire after a while. Ask for a new one." : "Please try again, or ask for a new link.",
      "/#/login", "Go to log in");
  }
  var access = p.get("access_token"), refresh = p.get("refresh_token"), type = p.get("type") || "";
  if(!access) return show("Nothing to do here", "Open the link from your CFF email, or log in.", "/#/login", "Go to log in");
  // Password reset, and invitation emails (a new person sets their password first, then accepts the invitation).
  if(type === "recovery" || type === "invite"){
    try{ sessionStorage.setItem("cff:recovery", access); }catch(e){}
    location.replace(type === "invite" ? "/#/reset?invite=1" : "/#/reset"); return;
  }
  fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: access, refresh_token: refresh, expires_at: Number(p.get("expires_at")) || null }) })
    .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, d: d }; }); })
    .then(function(x){
      if(x.ok && x.d.mfaRequired) return show("Email confirmed", "Log in with your password and the code from your authenticator app.", "/#/login", "Go to log in");
      if(!x.ok || !x.d.session) return show("This link has expired", x.d.error || "Log in, or ask for a new link.", "/#/login", "Go to log in");
      try{ localStorage.setItem("cff:session", JSON.stringify(x.d.session)); }catch(e){}
      location.replace("/#/start?welcome=1");
    })
    .catch(function(){ show("Can't reach the server", "Check your internet connection and try the link again.", "/#/login", "Go to log in"); });
})();
