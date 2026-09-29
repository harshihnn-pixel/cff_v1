// Reusable list with add / edit / delete dialogs, used by structure, names, employees, KPIs and more.
(function(){
"use strict";
const CFF = window.CFF;
const { $, $$, esc, I, toast, table, formModal, confirmBox, empty } = CFF.util;

/**
 * CFF.crudList(el, { title, intro, items, cols:[[heading, item => html]], fields | fieldsFor(item),
 *   path: "/structure/raci", canEdit, canDelete, addLabel, emptyTitle, emptyText, onChange(), toBody(values, item), actions(item) => html, bindActions(el, items) })
 */
CFF.crudList = (el, o) => {
  const canDel = o.canDelete === undefined ? o.canEdit : o.canDelete;
  const fields = item => (o.fieldsFor ? o.fieldsFor(item) : o.fields);
  const rows = o.items.map(it => ({ attrs: `data-id="${esc(it.id)}"`, cells: [...o.cols.map(([, fn]) => fn(it)),
    (o.canEdit || canDel || o.actions) ? `<div class="row nowrap">${o.actions ? o.actions(it) : ""}${o.canEdit ? `<button class="icon-btn" data-edit aria-label="Edit">${I.edit}</button>` : ""}${canDel ? `<button class="icon-btn" data-del aria-label="Delete">${I.trash}</button>` : ""}</div>` : null].filter(x => x !== null) }));
  const head = [...o.cols.map(c => c[0]), ...((o.canEdit || canDel || o.actions) ? [""] : [])];
  el.innerHTML = `<section class="card flush"><div class="card-head"><div class="stack" style="gap:2px;min-width:0"><h2>${esc(o.title)}</h2>${o.intro ? `<span class="muted small">${o.intro}</span>` : ""}</div>
      <div class="row">${o.headActions || ""}${o.canEdit ? `<button class="btn sm" data-add>${I.plus} ${esc(o.addLabel || "Add")}</button>` : ""}</div></div>
    ${o.items.length ? table(head, rows) : `<div class="pad">${empty(o.emptyTitle || "Nothing here yet", o.emptyText || "")}</div>`}</section>`;
  const done = msg => r => { if(r){ toast(msg); o.onChange ? o.onChange() : CFF.render(); } };
  const add = $("[data-add]", el);
  if(add) add.addEventListener("click", () => formModal({ title: o.addLabel || "Add", fields: fields(null), values: o.defaults || {},
    save: v => CFF.api.c.post(o.path, o.toBody ? o.toBody(v, null) : v) }).then(done("Added.")));
  $$("[data-edit]", el).forEach(b => b.addEventListener("click", () => { const it = o.items.find(x => x.id === b.closest("tr").dataset.id);
    formModal({ title: "Edit", fields: fields(it), values: it, save: v => CFF.api.c.patch(o.path + "/" + it.id, o.toBody ? o.toBody(v, it) : v) }).then(done("Saved.")); }));
  $$("[data-del]", el).forEach(b => b.addEventListener("click", async () => { const it = o.items.find(x => x.id === b.closest("tr").dataset.id);
    if(!await confirmBox("Delete this item? This can't be undone (the activity log keeps a record).", { ok: "Delete", danger: true })) return;
    try{ await CFF.api.c.del(o.path + "/" + it.id); done("Deleted.")(true); }catch(e){ toast(e.message, "bad"); } }));
  if(o.bindActions) o.bindActions(el, o.items);
};
})();
