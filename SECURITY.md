# Security in CFF 2.2

## Company isolation (three layers)
Every piece of company data carries a `company_id`. Access is checked three times:
1. **Website** — pages and buttons are shown only for the role's permissions (convenience only).
2. **Server / API** — every `/api/c/:companyId/...` request checks the login token, active membership in that company and the permission for the action, before anything else runs.
3. **Database (Row Level Security)** — the server queries Supabase **as the signed-in person** (anon key + their token), so Postgres RLS policies decide which rows they can read or change. Even a bug in the server can't show Company B's data to a member of Company A.

The service_role key is used only for a few system jobs (accepting invitations, notifications, file storage, the compliance checklist) and never leaves the server.

## Role experiences (v2.1)
Owner / Founder, Manager, HR, Employee and Viewer each get their own dashboard and navigation (see ROLES.md). Restricted pages are blocked before any data loads, the API returns 403, and RLS applies the same rules. Employees only receive approved company information, their own tasks, KPIs and employee record, content for everyone or their own department, and documents shared with their access level. Members can't read other members' details unless their role needs them, and shared AI analyses (partner comparisons, recommendations) are only readable with the underlying permission.

## Roles and permissions
Owner, Founder / Director, Manager, HR, Employee, Viewer (and a platform Super Admin). 35 permissions
(e.g. `cff.approve`, `partners.financial`, `documents.manage`). Owners edit the matrix in Settings; the Owner role always
has everything; only an Owner can make someone an Owner, and the last Owner can't be removed.
Financial information (shareholding, financial contributions) needs `partners.financial`.

## Data protection rules in the database
- Approved stages are locked: answers and stage data can't change until the stage is reopened by an approver.
- Stage 5 can't be approved unless shareholding totals exactly 100%; shareholding can never exceed 100%.
- Employees can only update status, progress and notes of tasks assigned to them.
- Records can only reference records of the same company (e.g. a task can't be assigned to another company's member).
- The activity log is written by database triggers and can't be edited or deleted by anyone through the app.
- Version history is kept for answers, company values, shareholding, the master profile and stage snapshots.

## Accounts
- Supabase Auth with **email confirmation**, forgot / reset password (links go to `auth-callback.html` and are removed from the address bar immediately).
- Strong passwords: 8+ characters with upper-case, lower-case and a number, not containing the email name.
- Sign-up and forgot-password answers never reveal whether an email is registered.
- Sessions refresh automatically; logging out revokes the session.
- **MFA is not implemented yet** (planned next step: Supabase TOTP MFA).

## Files
Documents and logos are in a **private** Supabase Storage bucket. Files are only served through the server after RLS confirms
the person may see that document (access levels: everyone / managers / founders / owner). Allowed types: PDF, images, Word, Excel,
PowerPoint, text, CSV; size limit `MAX_UPLOAD_MB`. Downloads are sent with a sandboxing Content-Security-Policy; only images and PDFs open inline.

## Web protections
- Strict Content-Security-Policy (`script-src 'self'`, no inline scripts, no framing), `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options: DENY`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`.
- HTTPS-ready: set `FORCE_HTTPS=true` and `TRUST_PROXY=true` behind a host with HTTPS → redirects to HTTPS and sends HSTS.
- Rate limits: log-in / sign-up / reset (20 per 15 min per IP), API (300 per minute), AI (40 per 10 min), uploads (60 per 10 min).
- All input is validated on the server (types, lengths, allowed values, dates, UUIDs); all output is escaped in the browser.
- Friendly error messages for people; technical details only in the server log. Security events (failed logins, denied access,
  rate limits, password changes) are logged as `[CFF security]` lines.
- `Cache-Control: no-store` on all API responses.

## AI privacy
The server decides what each AI task receives: only the company data needed for that task, only data the person may see.
Never sent: passwords, keys, tokens, emails, phone numbers, document files, whole tables. Financial contributions are included
only for people with `partners.financial`. The AI output is stored separately from company records and is never applied automatically.

## Your checklist
- Keep `.env` private; never commit it (it's in `.gitignore`).
- Use HTTPS in production (`FORCE_HTTPS=true`), and your own SMTP for auth emails.
- Rotate keys in Supabase / Google AI Studio if they were ever shared.


## Production hardening (v2.2)
**Accounts**
- **Two-step verification (TOTP)** for any account: My profile → Account security (QR code for Google/Microsoft Authenticator, Authy).
  Once on, a password-only session is refused by the server (`401 mfa_required`); login becomes password → 6-digit code.
- **Company policy**: Settings → Company settings → *Require two-step verification for Owners, Founders and HR*. People in those roles
  without it get `403 mfa_setup_required` for that company and are taken to Account security. The owner must turn it on for themselves first,
  and nobody can turn off their own two-step verification while a company requires it for their role.
- **Log out on all devices** (ends every session and refresh token), **login activity** (logins, failed logins, codes, password changes) —
  stored in `cff_login_events`, readable only by the person, written only by the server.
- **Login throttling**: per IP (20 attempts / 15 min on all auth endpoints, including the code step) **and** per email (5 failures lock that
  email for 15 minutes).
- Role, company and permissions always come from the database on every request — never from the browser. A role change, deactivation
  or removal applies on the person's next click.

**Members and invitations**
- Members can be **deactivated** (kept in the list, history kept, access ends immediately) and reactivated; or removed.
- Nobody can change their own role or access; only an Owner can make, change, deactivate or remove an Owner.
- HR (employees.manage without members.manage) can only invite, resend or cancel **employee** invitations.
- Marking an employee record **Inactive** (left the company) deactivates their login for the company; marking it Active restores it
  (unless someone deactivated them manually for another reason).
- **Invitations expire after 14 days** (`410 invitation_expired`), can be resent (extends 14 days, max 10 sends), cancelled, and duplicates
  are refused. New people get a Supabase invitation email and set their password from the link; existing users get an in-app notification.

**Requests**
- Cross-site protection: POST/PUT/PATCH/DELETE to `/api` with an `Origin` from another website are rejected (403). No CORS headers are sent.
- Uploads: the file's **real content** is checked (magic bytes for PDF, PNG, JPEG, GIF, WEBP, Office files; text for TXT/CSV), the
  extension must match the type, size limit (`MAX_UPLOAD_MB`), and SVG logos with scripts, event handlers, links or embedded HTML are
  refused. Files are in a private bucket and are only served through the server after a permission check.
- Input validation on the server for every field (emails, phone numbers 7–15 digits, dates, lengths, allowed values), mirrored in the forms.
- Start-up validation: with `NODE_ENV=production` the server refuses to start without the required keys or without https addresses.
- Security headers: strict Content-Security-Policy (no inline scripts), HSTS when `FORCE_HTTPS=true`, X-Frame-Options DENY, nosniff,
  Referrer-Policy, Permissions-Policy; API responses are `no-store`.

**Known limits** — the login token is kept in the browser's localStorage (protected by the strict CSP, which blocks injected scripts)
rather than an HttpOnly cookie; the per-email lockout is kept in server memory (resets on restart; use one server instance or add a shared
store if you scale out).
