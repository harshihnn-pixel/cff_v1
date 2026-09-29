# Upgrading your existing CFF website to CFF 2.0

Your existing accounts, answers, values assessments, "My highest values", AI analyses and AI chats are kept.
The upgrade only **adds** tables; it never deletes or changes the old ones.

## 1. Back up first
In Supabase: **Database → Backups** (paid plans) — or at minimum export the old tables
(`cff_profiles`, `cff_point_answers`, `cff_value_answers`, `cff_top_values`, `cff_ai_messages`, `cff_ai_analysis`) as CSV
from the **Table Editor**. The migration also makes its own copies (`cff_backup_*`) the first time it runs.
See BACKUP.md.

## 2. Replace the website files
1. Stop the old server (Ctrl+C).
2. Keep your old folder as it is (rename it to `cff-website-old`).
3. Unzip CFF 2.0 into `C:\Users\BIMSR\Desktop\cff-website\cff-website` (or any folder).
4. Copy your old `.env` into the new folder, then open it and **add** the new lines from `.env.example`:
   `SUPABASE_ANON_KEY`, `APP_URL`, `STORAGE_BUCKET`, `MAX_UPLOAD_MB`, `TRUST_PROXY`, `FORCE_HTTPS`.
   The anon key is in Supabase → Project Settings → API Keys (the "anon / publishable" one).

## 3. Run the database migration
Supabase → **SQL Editor → New query** → paste all of `supabase/setup.sql` → **Run**.
It runs migrations 001 → 005:

| File | What it does |
|---|---|
| 001_base.sql | The original tables (skipped where they already exist) |
| 002_workspace_tables.sql | Companies, members, roles, permissions, stage status, partners, structure, values, profiles, names, brand, documents, plans, tasks, compliance, employees, content, KPIs, reviews, notifications, activity log, AI outputs |
| 003_security.sql | Row Level Security on every table, permission checks, approval locks, version history, audit log |
| 004_migrate_existing_data.sql | Backs up the old tables, then gives every user who has answers a company workspace (named after the company they typed at sign-up, or "My Company"), with them as Owner, and copies their answers, values, AI analysis and chats into it |
| 005_role_experiences.sql | v2.1 role separation: new default permissions for Manager, HR, Employee and Viewer (only for roles you haven't customised), members can't read each other's details, shared AI analyses only for people allowed to see them |

It is safe to run again: users who are already migrated are skipped.

**Check the result:**
```sql
select * from public.cff_migration_report;
```
It lists each migrated user, their new company and how many answers and values answers were copied.
Compare with `select user_id, count(*) from cff_point_answers group by 1;`.

## 4. Supabase Auth settings (new)
- Authentication → URL Configuration → **Redirect URLs**: add `http://localhost:3000/auth-callback.html`
  (plus your live address later). Site URL = your `APP_URL`.
- Keep **Confirm email** on. For real use add your own SMTP (Authentication → Emails → SMTP Settings).
- Existing users log in exactly as before.

## 5. Start and check
Run `start.bat`. The server prints Supabase / storage / AI status. Log in with an existing account:
you land in your migrated company, Stage statuses start as "In progress" where you had answers,
and the Values Discovery Assessment shows your earlier answers.

## Rolling back
The old tables are untouched, so the old website still works with the same database:
stop the new server and start the old folder again. The new tables can stay; they don't affect the old site.

## Already running v2.0? (role separation update, v2.1)
Replace the website files (keep `.env`), then in the SQL Editor run **only** `supabase/migrations/005_role_experiences.sql`
(or all of `setup.sql` again — it is safe). The message at the end says how many company roles were updated.
Roles you customised in Settings → Roles & permissions are left exactly as they are. See ROLES.md for who sees what.

## Already running v2.1? (production hardening, v2.2)
1. Back up (BACKUP.md).
2. Replace the website files (keep `.env`), run `npm install`.
3. SQL Editor → run **only** `supabase/migrations/006_production.sql` (or all of `setup.sql` again — safe). It adds member deactivation,
   invitation expiry (existing pending invitations get 14 days from when they were created — resend any that are now expired),
   the login-activity table and indexes. No data is changed or deleted.
4. Supabase → Authentication → Multi-Factor → enable **TOTP**, then paste the templates from `email-templates/`. Set up SMTP for real use.
5. Start and check: My profile → Account security shows your login activity. See DEPLOYMENT.md before going live.
