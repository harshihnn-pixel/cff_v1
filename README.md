# CFF – Company Formation & Growth Operating System

Built on the original **13-stage Company Formation Framework**. A founder goes from idea → purpose → founders →
resources → business process → structure → values → master profile → name → brand → planning → registration →
team → execution → measurement → improvement → growth, together with partners and employees.

| Layer | What it contains |
|---|---|
| **CFF CORE** | The original 13 stages and 181 sub-points, unchanged, with auto-saved answers and stage approvals |
| **CFF INTELLIGENCE** | Guidance questions, the CFF Values Discovery Assessment (13 questions, 372-answer bank), readiness warnings, the Gemini AI assistant, AI analyses and recommendations |
| **CFF EXECUTION** | Plans (Kanban / Table / Timeline), milestones, tasks, approvals, documents, registration & compliance |
| **CFF MANAGEMENT** | Partners, structure & shareholding, departments, employees, SOPs / policies / training, KPIs and reviews |
| **CFF REPORTING** | CFF Master Report (22 sections; print, PDF, Word), progress report, KPI report, activity / audit log |

Other documents in this folder:
- **UPGRADE.md** — how to upgrade your existing website and database (read this first if you already run CFF)
- **SECURITY.md** — how accounts, roles and data are protected
- **BACKUP.md** — backups and recovery
- **ROLES.md** — exactly what the Business Owner, Manager, HR, Employee, Viewer and public Visitor can see and do
- **CFF-COMPARISON.md** — the final check against the original framework, and what was tested

---

## Portals and roles

- **Business Owner Portal** — Owners and Founders / Directors get the complete company-building system. Managers get an operations dashboard and HR a people dashboard, each showing only what their permissions allow (see ROLES.md).
- **Employee Portal** — Employees and Viewers get their own dashboard: company vision, mission, values, story, their role, reporting manager, responsibilities, tasks, KPIs, SOPs, training, policies, announcements ("I have read and understood"), shared documents and AI help. They never get the founder editing screens.
- **Visitor Portal** — public: what CFF is, how the 13 stages work, benefits, and a fictional demo company. No real company data is ever shown there.

One person can belong to several companies with different roles. Owners change what each role may do in **Settings → Roles & permissions**.

## Going live
See **DEPLOYMENT.md** (HTTPS, proxy, Supabase Auth settings, SMTP, two-step verification) and **email-templates/** for branded emails.

## Set up (new installation)

1. Install **Node.js LTS** from https://nodejs.org.
2. In Supabase open **SQL Editor → New query**, paste the whole of `supabase/setup.sql` and click **Run**.
3. Copy `.env.example` to `.env` and fill in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL` and `GEMINI_API_KEY`.
4. In Supabase open **Authentication → URL Configuration**:
   - **Site URL**: your `APP_URL` (for example `http://localhost:3000`)
   - **Redirect URLs**: add `http://localhost:3000/auth-callback.html` (and your live address + `/auth-callback.html` later)
5. **Authentication → Sign In / Providers → Email**: keep **Confirm email** on. For real use, set up your own SMTP under **Authentication → Emails → SMTP Settings** (Supabase's built-in email is only for testing and sends very few emails per hour).
6. Double-click `start.bat` (or run `npm install` then `npm start`) and open http://localhost:3000.

When the server starts it prints a checklist:
```
  Supabase: connected ✓
  Document storage: ready ✓ (private bucket cff-documents)
  AI assistant: ready ✓ (model gemini-3.8-flash, backup gemini-3.5-flash-lite)
```

## Using it

1. Create an account (the confirmation email link signs you in), then **Start a new company workspace**.
2. The **Dashboard** shows overall completion, the 13 stages with status, pending approvals and decisions, readiness warnings, missing information, partners, registration status, milestones, tasks, KPIs, recent activity, AI recommendations and quick actions.
3. Work through **CFF → Stage 1 … 13**. Answers save automatically (Saving… / Saved / Save failed). Each stage goes Not started → Draft → In progress → **Submit for review** → **Approve** (or **Request changes**) → can be **Reopened**. Approved stages are locked and a snapshot is kept.
4. Stages with a digital workspace show a link card:
   Partners (3–4), Structure & ownership (5), Company values (6), Master profile generator (7), Name selection (8), Brand identity center (9), Plans (10), Registration & compliance (11), Team / SOPs (12), KPIs & reviews (13).
5. Invite partners and employees in **Settings → Members** or from **People → Employees**. They create an account with the invited email and accept the invitation.

The AI assistant (the **Ask AI** button) knows the company, the page, the stage and the person's role. It drafts, explains, finds missing information and inconsistencies, and suggests plans. It never saves or approves anything on its own: drafts are inserted only when you click **Insert**, the master-profile draft goes to a review screen first, and plan suggestions are added only after you tick them. It does not make ownership, legal, financial or employment decisions.

## Project layout

```
server/index.js            web server: security headers, rate limits, routes
server/lib/                Supabase clients, login & permissions, validation, reports, Word export, Gemini, AI context
server/routes/             one file per area (auth, companies, cff, values, partners, structure, profile,
                           brand, documents, execution, people, kpis, reports, ai, workspace)
public/index.html          the website
public/js/content/         the original framework content, answer bank, lists, readiness rules (shared with the server)
public/js/core/            API client, state & auto-save, routing & navigation, AI panel, UI helpers
public/js/pages/           one file per page group
public/css/                style.css (templates, themes) and app.css (components)
supabase/migrations/       001–005 database migrations;  supabase/setup.sql = all of them in order
```

## Troubleshooting

| Message | What to do |
|---|---|
| Supabase: NOT READY — …anon / publishable key… | The keys are swapped. `SUPABASE_ANON_KEY` = anon / publishable, `SUPABASE_SERVICE_ROLE_KEY` = service_role / secret. |
| "The database is not up to date" | Run `supabase/setup.sql` in the SQL Editor, then restart. |
| Confirmation / reset link says "expired" | Links work once and expire. Ask for a new one. Check the Redirect URL in step 4. |
| "Gemini is busy right now" | Google's model is overloaded; the server already retries and uses the backup model. Wait a minute. |
| Upload fails | Only PDF, images, Word, Excel, PowerPoint, text and CSV up to `MAX_UPLOAD_MB` are accepted. |
