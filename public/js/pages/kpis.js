// Stage 13 — KPI & Continuous Improvement: KPIs with target / actual / variance per period (history kept),
// and monthly / quarterly / annual reviews covering every Stage 13 area.
(function(){
"use strict";
const CFF = window.CFF;
const { $, $$, esc, I, toast, notice, empty, pill, formModal, confirmBox, opt, fmtDate, fmtDateTime, table, tabs, onTabs, nl, modal } = CFF.util;
const S = CFF.state;
const STT = { on_track: ["On track", "good"], at_risk: ["At risk", "warn"], off_track: ["Off track", "bad"] };
const stPill = s => s ? pill(STT[s][0], STT[s][1]) : pill("No data");
const PERIOD_HINT = { monthly: "2026-09", quarterly: "2026-Q3", annual: "2026" };
function currentPeriod(type){ const d = new Date(); const y = d.getFullYear(), m = d.getMonth() + 1; return type === "annual" ? String(y) : type === "quarterly" ? y + "-Q" + Math.ceil(m / 3) : y + "-" + String(m).padStart(2, "0"); }
const variance = (t, a) => t == null || a == null ? "" : (a - t > 0 ? "+" : "") + (+(a - t).toFixed(2)) + (t ? " (" + (a - t > 0 ? "+" : "") + Math.round((a - t) / t * 100) + "%)" : "");

CFF.route("execution/kpis", { title: "KPIs & reviews", perm: ["kpis.view"], alt: "my/kpis", async render(el, p, q){
  const [k, rs, rv, st] = await Promise.all([CFF.api.c.get("/kpis"), CFF.api.c.get("/kpis/results/all"), CFF.api.c.get("/kpis/reviews/all"), CFF.api.c.get("/structure").catch(() => ({ departments: [], employees: [] }))]);
  const canEdit = S.can("kpis.edit");
  const dName = Object.fromEntries(st.departments.map(x => [x.id, x.name])), eName = Object.fromEntries(st.employees.map(x => [x.id, x.full_name]));
  const res = id => rs.results.filter(r => r.kpi_id === id);
  let tab = q.tab || "kpis";
  el.innerHTML = CFF.pageHead({ label: "Stage 13 · Growth, Review & Continuous Improvement", title: "KPIs & reviews", crumbs: S.can("cff.view") ? [["#/cff/13", "Stage 13"], [null, "KPIs"]] : null,
    lead: "Stage 13 as an ongoing management system: goals, KPIs, targets and actual results, and regular reviews. Every result is kept, so you can see the history.",
    actions: canEdit ? `<button class="btn sm" id="addKpi">${I.plus} Add KPI</button>` : "" }) + tabs([["kpis", "KPIs"], ["reviews", "Reviews"]], tab) + `<div id="kBody" class="stack" style="gap:16px"></div>`;
  const kpiFields = [
    { k: "name", label: "KPI name", required: true }, { k: "department_id", label: "Department", type: "select", options: st.departments.map(x => [x.id, x.name]) },
    { k: "employee_id", label: "Employee (for a personal KPI)", type: "select", options: st.employees.map(x => [x.id, x.full_name]) }, { k: "owner_name", label: "Owner" },
    { k: "unit", label: "Unit", placeholder: "₹, %, customers…" }, { k: "target", label: "Target", type: "number", step: "any" },
    { k: "direction", label: "Better when", type: "select", required: true, options: [["higher", "Higher"], ["lower", "Lower"]], value: "higher" },
    { k: "period_type", label: "Measured", type: "select", required: true, options: [["monthly", "Monthly"], ["quarterly", "Quarterly"], ["annual", "Annually"]], value: "monthly" },
    { k: "active", label: "Active", type: "checkbox", value: true }];
  const draw = () => {
    const b = $("#kBody");
    if(tab === "kpis"){
      b.innerHTML = `<section class="card flush">${table(["KPI", "Department / owner", "Target", "Latest actual", "Variance", "Period", "Status", ""], k.items.map(x => { const r = res(x.id)[0];
        return { attrs: `data-id="${esc(x.id)}"`, cells: [`<b>${esc(x.name)}</b>${x.active ? "" : ' <span class="muted small">(inactive)</span>'}`, esc([dName[x.department_id], eName[x.employee_id], x.owner_name].filter(Boolean).join(" · ")),
          esc((r && r.target != null ? r.target : x.target ?? "—") + (x.unit ? " " + x.unit : "")), r && r.actual != null ? esc(r.actual + (x.unit ? " " + x.unit : "")) : "—", esc(r ? variance(r.target, r.actual) : ""),
          esc(r ? r.period : ""), stPill(r && r.status), `<div class="row nowrap"><button class="btn quiet sm" data-hist>History</button>${canEdit ? `<button class="btn secondary sm" data-rec>Record result</button><button class="icon-btn" data-edit aria-label="Edit KPI">${I.edit}</button><button class="icon-btn" data-del aria-label="Delete KPI">${I.trash}</button>` : ""}</div>`] }; }),
        { empty: `<div class="pad">${empty("No KPIs yet", "Add the numbers that show whether the company is moving towards its vision: revenue, customers, retention, delivery time…")}</div>` })}</section>`;
      const find = e => k.items.find(x => x.id === e.closest("[data-id]").dataset.id);
      $$("[data-edit]", b).forEach(e => e.addEventListener("click", () => { const x = find(e); formModal({ title: "Edit KPI", wide: true, fields: kpiFields, values: x, save: v => CFF.api.c.patch("/kpis/" + x.id, v) }).then(r => { if(r){ toast("Saved."); CFF.render(); } }); }));
      $$("[data-del]", b).forEach(e => e.addEventListener("click", async () => { const x = find(e); if(!await confirmBox("Delete the KPI “" + x.name + "” and its results?", { ok: "Delete", danger: true })) return; await CFF.api.c.del("/kpis/" + x.id).catch(er => toast(er.message, "bad")); CFF.render(); }));
      $$("[data-rec]", b).forEach(e => e.addEventListener("click", () => record(find(e))));
      $$("[data-hist]", b).forEach(e => e.addEventListener("click", () => history(find(e))));
    } else {
      b.innerHTML = `<section class="card stack"><div class="row" style="justify-content:space-between"><h2>Reviews</h2>${canEdit ? `<div class="row"><button class="btn sm" data-new="monthly">Monthly review</button><button class="btn secondary sm" data-new="quarterly">Quarterly</button><button class="btn secondary sm" data-new="annual">Annual</button></div>` : ""}</div>
        ${rv.reviews.length ? `<div class="list">${rv.reviews.map(r => `<button class="li" data-rv="${esc(r.id)}"><span class="stack" style="gap:2px;text-align:left;min-width:0"><b>${esc(r.review_type[0].toUpperCase() + r.review_type.slice(1))} review · ${esc(r.period)}</b><span class="muted small">${esc(CFF.util.cut(r.summary || "", 120))}</span></span><span class="muted small">${esc(fmtDate(r.updated_at || r.created_at))}</span></button>`).join("")}</div>`
          : empty("No reviews yet", "Hold a review each month, quarter and year. Cover goals, targets, performance, customer feedback, challenges, improvements, technology, AI, automation, skills, innovation and strategy.")}</section>`;
      $$("[data-new]", b).forEach(e => e.addEventListener("click", () => review({ review_type: e.dataset.new, period: currentPeriod(e.dataset.new), sections: {} })));
      $$("[data-rv]", b).forEach(e => e.addEventListener("click", () => review(rv.reviews.find(r => r.id === e.dataset.rv))));
    }
  };
  const record = x => { const cur = res(x.id)[0];
    return formModal({ title: "Record result · " + x.name, fields: [
      { k: "period", label: "Period", required: true, value: currentPeriod(x.period_type), hint: "Format: " + PERIOD_HINT[x.period_type] + (cur ? " · last recorded " + cur.period : "") },
      { k: "target", label: "Target", type: "number", step: "any", value: x.target }, { k: "actual", label: "Actual", type: "number", step: "any" },
      { k: "status", label: "Status", type: "select", options: [["on_track", "On track"], ["at_risk", "At risk"], ["off_track", "Off track"]], blank: "Work it out from target and actual" },
      { k: "comments", label: "Comments", type: "textarea", rows: 2 }, { k: "corrective_action", label: "Corrective action", type: "textarea", rows: 2 }],
      save: v => { const per = v.period; delete v.period; return CFF.api.c.put("/kpis/" + x.id + "/results/" + encodeURIComponent(per), v); } }).then(r => { if(r){ toast("Result saved."); CFF.render(); } }); };
  const history = x => modal({ title: "History · " + x.name, wide: true, body: table(["Period", "Target", "Actual", "Variance", "Status", "Comments", "Corrective action"], res(x.id).map(r => [esc(r.period), esc(r.target ?? ""), esc(r.actual ?? ""), esc(variance(r.target, r.actual)), stPill(r.status), esc(r.comments || ""), esc(r.corrective_action || "")]),
    { empty: `<p class="muted">No results recorded yet.</p>` }) });
  const review = r => modal({ title: (r.id ? "" : "New ") + r.review_type + " review", wide: true,
    body: `<div class="form-grid"><div class="field"><label for="rvPer">Period</label><input class="input" id="rvPer" value="${esc(r.period)}" ${r.id || !canEdit ? "readonly" : ""}><span class="hint">Format: ${PERIOD_HINT[r.review_type]}</span></div>
      ${rv.sections.map(([k, l]) => `<div class="field full"><label for="rv-${k}">${esc(l)}</label><textarea class="input" id="rv-${k}" data-k="${k}" rows="2" maxlength="6000" ${canEdit ? "" : "readonly"}>${esc((r.sections || {})[k] || "")}</textarea></div>`).join("")}
      <div class="field full"><label for="rvSum">Summary & decisions</label><textarea class="input" id="rvSum" rows="3" maxlength="6000" ${canEdit ? "" : "readonly"}>${esc(r.summary || "")}</textarea></div></div>`,
    actions: canEdit ? [{ label: "Cancel", value: null, kind: "secondary" }, { label: "Save review", submit: true, run: d => CFF.api.c.put("/kpis/reviews", { review_type: r.review_type, period: $("#rvPer", d).value.trim(),
      sections: Object.fromEntries($$("textarea[data-k]", d).map(t => [t.dataset.k, t.value])), summary: $("#rvSum", d).value }) }] : undefined }).then(x => { if(x){ toast("Review saved."); CFF.render(); } });
  onTabs(el, t => { tab = t; draw(); });
  const ak = $("#addKpi"); if(ak) ak.addEventListener("click", () => formModal({ title: "Add KPI", wide: true, fields: kpiFields, save: v => CFF.api.c.post("/kpis", v) }).then(r => { if(r){ toast("KPI added."); CFF.render(); } }));
  draw();
  CFF.ai.page({ label: "KPIs & reviews (Stage 13)", suggestions: ["Suggest KPIs for a company at our stage", "Why might a KPI be off track, and what can we do?", "Prepare questions for our monthly review"],
    context: () => "CURRENT PAGE: KPIs & reviews (Stage 13).\n" + k.items.map(x => { const r = res(x.id)[0]; return "- " + x.name + ": target " + (x.target ?? "?") + " " + (x.unit || "") + (r ? ", latest " + r.period + " actual " + r.actual + " (" + (r.status || "") + ")" : ", no data"); }).join("\n") });
}});
})();
