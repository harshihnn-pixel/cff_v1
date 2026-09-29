// Execution: plans (Stage 10), tasks, and the registration & compliance center (Stage 11).
const express = require("express");
const { HttpError, wrap, check, v } = require("../lib/http");
const { perm, can } = require("../lib/auth");
const { crud } = require("../lib/crud");
const { notify } = require("../lib/notify");
const { admin } = require("../lib/supabase");
const CAT = require("../../public/js/content/catalogs");

const plans = express.Router({ mergeParams: true });       // /api/c/:companyId/plans
const tasks = express.Router({ mergeParams: true });       // /api/c/:companyId/tasks
const compliance = express.Router({ mergeParams: true });  // /api/c/:companyId/compliance

const keys = list => list.map(x => x[0]);

crud(plans, { path: "/", table: "cff_plan_items", cols: "*", view: "plans.view", edit: "plans.edit", required: ["plan","title"], labels: { plan: "Plan", title: "Title" },
  order: [["plan"],["sort"],["deadline"]], filters: req => ({ plan: keys(CAT.PLAN_TYPES).includes(req.query.plan) ? req.query.plan : undefined }),
  defaults: req => ({ created_by: req.user.id }),
  fields: {
    plan: x => v.oneOf(x, "Plan", keys(CAT.PLAN_TYPES)), title: x => v.str(x, "Title", 200), description: x => v.text(x, "Description", 4000),
    category: x => v.opt(x, "Category", 120), owner_name: x => v.opt(x, "Owner", 120), owner_member_id: x => v.uuid(x, "Owner", { optional: true }),
    priority: x => v.oneOf(x, "Priority", keys(CAT.PRIORITIES)), start_date: x => v.date(x, "Start date"), deadline: x => v.date(x, "Deadline"),
    status: x => v.oneOf(x, "Status", keys(CAT.PLAN_STATUSES)), progress: x => v.int(x, "Progress", 0, 100), dependencies: x => v.text(x, "Dependencies", 1000),
    notes: x => v.text(x, "Notes", 4000), sort: x => v.int(x, "Order", 0, 100000)
  },
  beforeSave: async (req, row, isNew, before) => {
    const s = row.start_date !== undefined ? row.start_date : before && before.start_date, d = row.deadline !== undefined ? row.deadline : before && before.deadline;
    if(s && d && d < s) throw new HttpError(400, "The deadline can't be before the start date.");
    if(row.status === "completed" && row.progress === undefined) row.progress = 100;
  } });

// POST /plans/bulk { items: [{ plan, title, description, priority }] } — add several suggested items at once (after the person picks them).
plans.post("/bulk", perm("plans.edit"), wrap(async (req, res) => {
  const items = Array.isArray((req.body || {}).items) ? req.body.items.slice(0, 50) : [];
  if(!items.length) throw new HttpError(400, "Choose at least one item to add.");
  const rows = items.map(x => ({ company_id: req.companyId, plan: v.oneOf(x.plan, "Plan", keys(CAT.PLAN_TYPES)), title: v.str(x.title, "Title", 200),
    description: v.text(x.description, "Description", 4000), priority: v.oneOf(x.priority, "Priority", keys(CAT.PRIORITIES), { optional: true, default: "medium" }), created_by: req.user.id }));
  const out = check(await req.db.from("cff_plan_items").insert(rows).select("*"), "add plan items");
  res.status(201).json({ items: out });
}));

// GET /tasks/mine — only the tasks assigned to the signed-in person (the "My Tasks" view for everyone).
tasks.get("/mine", wrap(async (req, res) => {
  if(!req.member) return res.json({ items: [] });
  const rows = check(await req.db.from("cff_tasks").select("id,title,stage,priority,start_date,due_date,status,progress,notes,attachment_id,completed_at")
    .eq("company_id", req.companyId).eq("assigned_to", req.member.id).order("due_date", { ascending: true }).limit(500), "my tasks");
  res.json({ items: rows });
}));

// The full company task list is for people who manage tasks.
crud(tasks, { path: "/", table: "cff_tasks", cols: "*", view: ["tasks.view_all", "tasks.edit"], edit: "tasks.edit",
  required: ["title"], labels: { title: "Task" }, order: [["due_date"],["created_at"]], defaults: req => ({ created_by: req.user.id }),
  fields: {
    title: x => v.str(x, "Task", 200), stage: x => v.int(x, "CFF stage", 1, 13, { optional: true }), department_id: x => v.uuid(x, "Department", { optional: true }),
    assigned_to: x => v.uuid(x, "Assigned to", { optional: true }), priority: x => v.oneOf(x, "Priority", keys(CAT.PRIORITIES)),
    start_date: x => v.date(x, "Start date"), due_date: x => v.date(x, "Due date"), status: x => v.oneOf(x, "Status", keys(CAT.TASK_STATUSES)),
    progress: x => v.int(x, "Progress", 0, 100), notes: x => v.text(x, "Notes", 4000), attachment_id: x => v.uuid(x, "Attachment", { optional: true })
  },
  beforeSave: async (req, row, isNew, before) => {
    const s = row.start_date !== undefined ? row.start_date : before && before.start_date, d = row.due_date !== undefined ? row.due_date : before && before.due_date;
    if(s && d && d < s) throw new HttpError(400, "The due date can't be before the start date.");
    if(row.status === "completed" && row.progress === undefined) row.progress = 100;
  },
  afterSave: async (req, row, isNew, before) => {
    if(row.assigned_to && (isNew || !before || before.assigned_to !== row.assigned_to)){
      const m = check(await req.db.from("cff_company_members").select("user_id").eq("id", row.assigned_to).maybeSingle(), "assignee");
      if(m && m.user_id !== req.user.id) await notify(req.companyId, [m.user_id], { kind: "task", title: "New task for you: " + row.title,
        body: row.due_date ? "Due " + row.due_date : "", link: "#/my/tasks", dedupe: "assigned-" + row.id + "-" + row.assigned_to });
    }
  } });

// PATCH /tasks/:id/progress { status, progress, notes } — for the person the task is assigned to.
tasks.patch("/:id/progress", wrap(async (req, res) => {
  const id = v.uuid(req.params.id, "Task");
  const b = req.body || {};
  const up = {};
  if(b.status !== undefined) up.status = v.oneOf(b.status, "Status", keys(CAT.TASK_STATUSES));
  if(b.progress !== undefined) up.progress = v.int(b.progress, "Progress", 0, 100);
  if(b.notes !== undefined) up.notes = v.text(b.notes, "Notes", 4000);
  if(up.status === "completed" && up.progress === undefined) up.progress = 100;
  if(!Object.keys(up).length) throw new HttpError(400, "Nothing to update.");
  const t = check(await req.db.from("cff_tasks").update(up).eq("id", id).eq("company_id", req.companyId).select("*").maybeSingle(), "update task");
  if(!t) throw new HttpError(404, "Task not found, or it isn't assigned to you.");
  res.json({ item: t });
}));

// ---------- Compliance ----------
const COMP_COLS = "*";
// Adds the standard India checklist once. Written by the server (one activity entry instead of 24).
async function seed(req){
  if(!can(req, "compliance.edit")) return;
  const have = check(await req.db.from("cff_compliance_items").select("item_key").eq("company_id", req.companyId), "compliance").map(x => x.item_key);
  if(have.length) return;
  const add = CAT.COMPLIANCE_CATALOG.map((c, i) => ({ company_id: req.companyId, item_key: c[0], name: c[1], category: c[2], notes: null, sort: (i + 1) * 10 }));
  const r = await admin.from("cff_compliance_items").upsert(add, { onConflict: "company_id,item_key", ignoreDuplicates: true });
  if(r.error){ console.error("[CFF] seed compliance:", r.error.message); return; }
  await admin.from("cff_activity_logs").insert({ company_id: req.companyId, user_id: req.user.id, actor_name: (req.member && req.member.display_name) || req.user.email,
    action: "created", entity: "Compliance item", summary: "Standard India compliance checklist (" + add.length + " items)" });
}

compliance.get("/", perm("compliance.view"), wrap(async (req, res) => {
  await seed(req);
  const rows = check(await req.db.from("cff_compliance_items").select(COMP_COLS).eq("company_id", req.companyId).order("sort").order("name"), "compliance");
  const hints = Object.fromEntries(CAT.COMPLIANCE_CATALOG.map(c => [c[0], c[3]]));
  res.json({ items: rows.map(x => ({ ...x, hint: hints[x.item_key] || null })), canEdit: can(req, "compliance.edit") });
}));

const compFields = {
  name: x => v.str(x, "Name", 200), category: x => v.oneOf(x, "Category", keys(CAT.COMPLIANCE_CATEGORIES)),
  applicability: x => v.oneOf(x, "Applies?", keys(CAT.APPLICABILITY)), status: x => v.oneOf(x, "Status", keys(CAT.COMPLIANCE_STATUSES)),
  responsible_member_id: x => v.uuid(x, "Responsible person", { optional: true }), responsible_name: x => v.opt(x, "Responsible person", 120),
  due_date: x => v.date(x, "Due date"), completion_date: x => v.date(x, "Completion date"), registration_number: x => v.opt(x, "Registration number", 120),
  renewal_date: x => v.date(x, "Renewal date"), document_id: x => v.uuid(x, "Document", { optional: true }), notes: x => v.text(x, "Notes", 4000)
};
crud(compliance, { path: "/items", table: "cff_compliance_items", cols: COMP_COLS, view: false, edit: "compliance.edit", required: ["name"], labels: { name: "Name" },
  fields: compFields, defaults: () => ({ sort: 1000 }),
  beforeSave: async (req, row) => { if(row.applicability === "not_required" && row.status === undefined) row.status = "not_applicable"; } });

module.exports = { plans, tasks, compliance };
