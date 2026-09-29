# Backup and recovery

## What to back up
| What | Where | How |
|---|---|---|
| Database (all company data, accounts' profiles, history) | Supabase Postgres | Supabase daily backups (Pro plan and above: Database → Backups; Point-in-Time Recovery as an add-on), plus your own weekly export |
| Documents and logos | Supabase Storage, bucket `cff-documents` | Download the bucket regularly (Storage → bucket → select all → download), or use the Supabase CLI |
| Settings | `.env` on your computer / server | Keep a copy in a password manager — never in email or chat |
| Website code | this folder | Keep the zip, or a private Git repository |

## Your own database export (works on the free plan)
With the Supabase CLI or `pg_dump` (connection string from Project Settings → Database):
```
pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres" --schema=public --no-owner -Fc -f cff-backup-2026-09-29.dump
```
Store the file somewhere safe (encrypted drive). Suggested schedule: weekly, and always before running a migration.

`--schema=public` holds all CFF data but **not** the login accounts (they live in Supabase's `auth` schema). To also keep accounts, use the
Supabase CLI, which exports everything Supabase needs for a restore:
```
supabase db dump --db-url "postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres" -f cff-schema.sql
supabase db dump --db-url "..." --data-only -f cff-data.sql
```
Restore a `pg_dump` file into an empty project with:
```
pg_restore --no-owner --clean --if-exists -d "postgresql://postgres:[PASSWORD]@db.[NEW-PROJECT].supabase.co:5432/postgres" cff-backup-2026-09-29.dump
```

## Built-in safety nets
- **Version history** (`cff_versions`): every change to answers, company values and shareholding, plus a snapshot of every stage when it is approved. Master profile versions are never overwritten.
- **Activity log** (`cff_activity_logs`): who changed what and when, with old and new values; it can't be edited from the app.
- **Deactivate instead of remove** for members (v2.2): the member row, their tasks and history stay; access can be restored in one click.
- **Login activity** (`cff_login_events`) records logins, failed logins and security changes per person.
- **Archive instead of delete** for partners, documents, content and companies. Document versions keep the previous file.
- **Migration backups**: the upgrade copies the old tables to `cff_backup_*` before touching anything.

## Recovering
- *One wrong edit*: open the item's **Versions** / stage **History**, copy the previous text back (or ask the owner to reopen an approved stage).
- *Deleted item*: find it in **Activity** (the "Before" value shows the old record) and re-create it.
- *Whole database*: restore a Supabase backup (Database → Backups → Restore) or `pg_restore` your dump into a new project, then point `.env` at it.
- *Files*: re-upload from your bucket download; file paths are `companyId/uuid/name`.

Test a restore into a separate Supabase project at least once, so you know it works before you need it.
