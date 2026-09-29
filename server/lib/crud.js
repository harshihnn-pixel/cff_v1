// Reusable list / add / edit / delete routes for simple company tables.
// Every query runs as the signed-in person, so Row Level Security applies as well as the route permission.
const { HttpError, wrap, check, v, patch } = require("./http");
const { perm } = require("./auth");

/**
 * crud(router, {
 *   path: "/departments", table: "cff_departments", cols: "id,name,...",
 *   view: "structure.view", edit: "structure.edit" (or [..]),
 *   fields: { name: x => v.str(x, "Name", 80), ... },   required: ["name"],
 *   order: [["sort"], ["name"]], filters: req => ({ ... }) (extra equality filters for list),
 *   locked: "Stage 5 is approved (reopen it to make changes).",
 *   defaults: req => ({ created_by: req.user.id }), beforeSave(req, row, isNew), afterSave(req, row, isNew)
 * })
 */
function crud(router, o){
  const base = o.path === "/" ? "" : o.path;       // item routes are base + "/:id"
  const list = base || "/";
  const editPerms = [].concat(o.edit);
  const notFound = () => new HttpError(404, "Not found" + (o.locked ? ", or " + o.locked : "."));

  if(o.view !== false) router.get(list, perm(...[].concat(o.view)), wrap(async (req, res) => {
    let q = req.db.from(o.table).select(o.cols).eq("company_id", req.companyId);
    const extra = o.filters ? o.filters(req) : {};
    Object.entries(extra).forEach(([k, val]) => { if(val !== undefined && val !== null && val !== "") q = q.eq(k, val); });
    (o.order || [["created_at"]]).forEach(([col, desc]) => { q = q.order(col, { ascending: !desc }); });
    const rows = check(await q.limit(o.limit || 1000), "list " + o.table);
    res.json({ items: o.mapOut ? rows.map(x => o.mapOut(req, x)) : rows });
  }));

  router.post(list, perm(...editPerms), wrap(async (req, res) => {
    const b = req.body || {};
    const row = {};
    Object.entries(o.fields).forEach(([k, fn]) => { if(b[k] !== undefined) row[k] = fn(b[k]); });
    (o.required || []).forEach(k => { if(row[k] === undefined || row[k] === null || row[k] === "") throw new HttpError(400, (o.labels && o.labels[k] || k) + " is required."); });
    Object.assign(row, o.defaults ? o.defaults(req) : {}, { company_id: req.companyId });
    if(o.beforeSave) await o.beforeSave(req, row, true);
    const ins = await req.db.from(o.table).insert(row).select(o.cols).single();
    if(ins.error && ins.error.code === "42501" && o.locked) throw new HttpError(409, "Can't add this: " + o.locked.charAt(0).toLowerCase() + o.locked.slice(1));
    const x = check(ins, "add " + o.table);
    if(o.afterSave) await o.afterSave(req, x, true, null);
    res.status(201).json({ item: o.mapOut ? o.mapOut(req, x) : x });
  }));

  router.patch(base + "/:id", perm(...editPerms), wrap(async (req, res) => {
    const id = v.uuid(req.params.id, "Item");
    const up = patch(req.body || {}, o.fields);
    let before = null;
    if(o.beforeSave || o.afterSave) before = check(await req.db.from(o.table).select(o.cols).eq("id", id).eq("company_id", req.companyId).maybeSingle(), "load " + o.table);
    if(o.beforeSave) await o.beforeSave(req, up, false, before);
    const x = check(await req.db.from(o.table).update(up).eq("id", id).eq("company_id", req.companyId).select(o.cols).maybeSingle(), "edit " + o.table);
    if(!x) throw notFound();
    if(o.afterSave) await o.afterSave(req, x, false, before);
    res.json({ item: o.mapOut ? o.mapOut(req, x) : x });
  }));

  if(o.remove !== false) router.delete(base + "/:id", perm(...[].concat(o.removePerm || o.edit)), wrap(async (req, res) => {
    const id = v.uuid(req.params.id, "Item");
    const x = check(await req.db.from(o.table).delete().eq("id", id).eq("company_id", req.companyId).select("id"), "delete " + o.table);
    if(!x.length) throw notFound();
    res.json({ ok: true });
  }));
}

module.exports = { crud };
