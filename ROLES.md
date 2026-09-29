# Who sees what — CFF role experiences (v2.1)

CFF now feels like three products on one backend:
- **Business Owner:** "Build and manage my company."
- **Employee:** "Understand my company and do my work."
- **Visitor:** "Understand CFF and decide whether to start."

Access is enforced in five places:
1. **Sidebar** — only the items the person may open are drawn.
2. **Dashboard** — each experience has its own dashboard.
3. **Route** — typing a restricted URL shows "You don't have access to this page." or sends the person to their own equivalent page. No data is loaded for a blocked page.
4. **API** — the server returns 403 for unauthorised endpoints, and only authorised data is ever returned.
5. **Database (RLS)** — the same rules apply even to direct database queries.

Owners can still change any role's permissions in **Settings → Roles & permissions**. The defaults below are what a new company gets.

| | Business Owner / Founder | Manager | HR | Employee | Viewer | Public visitor |
|---|---|---|---|---|---|---|
| Home page | Business dashboard | Operations dashboard | HR dashboard | Employee Portal | Company overview | Visitor Portal |
| 13-stage CFF (edit, approve) | ✔ | — | — | — | — | overview only |
| Partners, shareholding, structure, authority, RACI | ✔ | departments only | roles, departments | — | — | — |
| Master profile, names, brand, company values (manage) | ✔ | — | — | — | — | — |
| Approved vision, mission, purpose, story, values (read) | ✔ | ✔ | ✔ | ✔ | ✔ | demo only |
| Plans, milestones | ✔ | view | — | — | — | — |
| Tasks | all | team tasks (assign, edit) | own | own (status, progress, notes) | — | — |
| KPIs & reviews | all | all (edit) | — | own | — | — |
| Employees, departments, invitations | ✔ | view | manage | — | — | — |
| SOPs, policies, training, announcements | manage | read | manage | read (own department + everyone) | — | — |
| Documents | all levels | shared + upload | shared + upload | shared with their level | — | — |
| Compliance, registration | ✔ | — | — | — | — | — |
| Reports | ✔ | KPI report | — | — | — | — |
| Activity / audit log | ✔ | — | — | — | — | — |
| Settings, members, permissions | owner | profile only | profile, invitations | profile only | profile only | — |
| AI assistant | full company context | operational context | people context | employee context only | — | — |
| Search finds | everything | tasks, plans, KPIs, people, SOPs | people, SOPs | own tasks, own KPIs, shared SOPs, documents, approved values | approved values | — |

## Business Owner / Founder
**Sees:** Business dashboard with:
- company overview and overall CFF %
- 13-stage progress and stage approval status
- pending sections and pending decisions
- missing information
- milestones, tasks and KPIs
- compliance status
- recent activity, notifications, AI recommendations and quick actions

The sidebar has Company, the full CFF, Execution (including Reviews), People (including invitations and roles & responsibilities), Compliance, Reports and Admin (company settings, members, roles & permissions, audit log).

**Does:** everything in the company-building system, including approvals, version history, readiness warnings and AI help. The Owner always has every permission. A Founder has the full strategic set; only the Owner manages settings and permissions unless granted.

## Manager
**Sees:** Operations dashboard, which shows only the blocks their permissions allow:
- team tasks (today, upcoming, overdue)
- plans and milestones
- KPIs
- people and departments
- the read-only company overview and approved values

The sidebar has My work, Company (read), Execution, Departments and team members, and Resources.
**Does:** assigns and edits tasks, records KPI results and reviews, reads plans, and uploads shared documents.
**Doesn't get by default:** the CFF stages, partners, shareholding, structure editing, compliance, reports or the audit log.

## HR
**Sees:** HR dashboard with:
- employees and employees without a login
- departments
- pending invitations
- who has confirmed each SOP or policy
- the read-only company overview and approved values

The sidebar has People (employees, departments, invitations, SOPs/policies/training), roles & structure (read), and Resources.
**Does:** adds and invites employees, manages departments, publishes SOPs, policies, training and announcements, and tracks acknowledgements.
**Doesn't get by default:** shareholding, founder contributions, partner profiles, ownership decisions, strategic plans, registration controls or CFF editing.

## Employee
**Sees:** the Employee Portal:
- company name, story, vision, mission, purpose and approved values (read only; drafts are never sent)
- My role: name, designation, department, reporting manager, joining date and responsibilities
- My tasks and My KPIs
- SOPs, policies and training, each with "I have read and understood"
- documents shared with their level, and announcements
- My values assessment (personal only; it never changes company values)
- AI help, notifications, and My profile

**Does:** updates the status, progress and notes of their own tasks, acknowledges content, takes the values assessment, and asks the AI.
**Can't:** open or call any of these:
- the CFF editor or stage approvals
- partners, shareholding or structure
- master profile, names or brand management
- company plans, compliance or registration
- employee administration
- reports, company settings, role permissions or the audit log

These give "no access" or a redirect in the browser, 403 from the API, and nothing from the database.

## Viewer
**Sees:** the read-only company overview and approved company values, plus anything the owner explicitly shares by permission.

## Public visitor (not logged in)
**Sees:**
- What CFF is, and the problem it solves
- Benefits, how the 13 stages work, and the CFF journey
- A demo company with fictional data, clearly labelled "Demo company – no real company information."
- Login, Create Account and Start a Company

There is no app sidebar, no internal search and no company data. Internal pages send the visitor to log in.

## v2.2 additions
- **Owner / Founder dashboard** has a *People & HR overview* card (active employees, people without a login, managers and HR, departments,
  pending invitations, deactivated members, recently joined). Owners see people and operations here — there is no separate
  "Manager dashboard" or "HR dashboard" item in their menu.
- **Employee Portal** has a *My team* card (colleagues in the same department — names and designations only).
- **Account security** (every role): two-step verification, log out on all devices, recent login activity. Also reachable at `#/account`
  without opening a company (used when a company requires two-step verification before entry).
- **Deactivated members** keep their history but can't open the company; their *My companies* page says their access was deactivated.
- **Managing people**: only an Owner can make/change/deactivate/remove Owners; nobody can change their own role; HR can invite, resend
  and cancel **employee** invitations only; marking an employee record *Inactive* switches off that person's login for the company.
- Attendance and leave management are **not** part of CFF (no such modules exist); leave rules can be published as a Policy.
