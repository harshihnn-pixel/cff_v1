# Final check against the original Company Formation Framework

The original framework is the core. Its 13 stages, their order, titles, groups, 181 sub-points, explanations and guiding
questions are unchanged (`public/js/content/data.js`), and the 13 values questions with the 372-answer bank are unchanged.
Everything else is a digital **extension** that serves a stage — it never replaces a stage's own questions.

| # | Original stage | CFF CORE (unchanged) | Extensions added |
|---|---|---|---|
| 1 | Business Foundation | 9 points, answers, approval | Readiness "missing information"; Vision / mission / purpose feed the Employee Portal after approval |
| 2 | Complete Business Process | 7 points incl. the full journey sequence | AI stage review |
| 3 | Company Resources Assessment | 23 points; **Values** point opens the CFF Values Discovery Assessment | Partner profiles (resources fields), AI values analysis |
| 4 | Individual Partner Profile Creation | 28 points | Multiple partner profiles (28 fields + financial contribution), archive, compare, AI summary / strengths / contribution comparison (no equity decisions) |
| 5 | Company Structure & Growth Roadmap | 21 points | Shareholding (must total 100% to approve), roles, decision authority (8 areas), RACI, departments, organisation chart |
| 6 | Company Values | 8 points | Partner values comparison (shared / different), AI alignment, Final Company Values with meaning, why, expected / unacceptable behaviour, customer promise, approval |
| 7 | Company Master Profile | 16 points | Master profile generator: build from answers or AI → review → edit → draft → approve → final, all versions kept |
| 8 | Company Name Selection | 10 points | Candidate names with statuses, checks and checklist; "manual verification required" — never claims availability |
| 9 | Logo & Brand Identity Creation | 10 points | Brand identity center: 6 logo files, colours, typography, personality, voice, tagline, guidelines |
| 10 | Company Planning | 13 points | 11 structured plans with owner, priority, dates, status, progress, dependencies; Kanban / Table / Timeline; AI suggestions you pick from |
| 11 | Company Registration & Compliance | 11 points | India compliance checklist (24 items, configurable Required / Not required / Pending verification), statuses, dates, reminders, calendar, linked documents |
| 12 | Execution & Team Building | 10 points | Employees, departments, invitations, SOPs / policies / training / announcements with acknowledgements, Employee Portal, tasks |
| 13 | Growth, Review & Continuous Improvement | 15 points | KPIs with target / actual / variance / status per period (history kept), monthly / quarterly / annual reviews with all 13 review areas |

Cross-cutting: stage approval workflow, readiness guidance, notifications, global search, activity log, version history,
CFF Master Report (22 sections), progress & KPI reports, AI assistant, roles & permissions, company workspaces.

## The founder journey
IDEA (1) → PURPOSE (1) → FOUNDERS (3–4) → RESOURCES (3) → BUSINESS PROCESS (2) → COMPANY STRUCTURE (5) → VALUES (6) →
MASTER COMPANY PROFILE (7) → NAME (8) → BRAND (9) → PLANNING (10) → REGISTRATION (11) → TEAM (12) → EXECUTION (tasks, plans) →
MEASUREMENT (KPIs) → IMPROVEMENT (reviews) → GROWTH (growth plan, Stage 13). Every step has a page, and the dashboard
recommends the next one.

## Requirement status
| Area | Status |
|---|---|
| Company workspaces, multiple companies, switching, invitations | Done, tested |
| Roles, configurable permissions, frontend + API + RLS enforcement | Done, tested (incl. User A cannot access Company B) |
| Founder dashboard with all listed widgets | Done, tested |
| Partners, structure, shareholding = 100%, authority, RACI, org chart | Done, tested |
| Values Discovery Assessment (kept), company values system | Done, tested |
| Master profile generator with versions | Done, tested |
| Names, brand center with logo uploads | Done, tested |
| Plans (11 types, 3 views), milestones, tasks (Today / Upcoming / Overdue / Completed) | Done, tested |
| Compliance center, calendar, documents (folders, access, versions, expiry) | Done, tested |
| Employee Portal, Visitor Portal (demo only, no real data) | Done, tested |
| Approvals, readiness warnings (guide; optional enforce), notifications, search | Done, tested |
| KPIs & reviews, Master / Progress / KPI reports, print & PDF (via Save as PDF), Word | Done, tested |
| Activity / audit log, version history | Done, tested |
| Security: RLS, server authorization, headers / CSP, rate limits, validation, strong passwords, email confirmation, reset | Done, tested |
| Existing-data migration with backups, idempotent | Done, tested on a copy of the old schema with sample data |
| Auto-save states, responsive 1366 / 1024 / 768 / 430 / 375 without horizontal overflow, keyboard & labels | Done, tested |
| Kept from before: 3 portals, 13 stages, values + answer bank + filters, AI values analysis, Gemini chat with Insert draft, light / dark, Clean / Studio / Classic templates, rate limiting | Kept, tested |
| MFA (two-step login) | **Not yet** — planned next step (Supabase TOTP) |
| PDF | Through the browser's "Save as PDF" on the print view (no separate PDF generator) |

## How it was tested
- **Database**: 69 Row Level Security checks (incl. the employee querying the database directly) against real Postgres with the same roles Supabase uses (isolation between companies, each role's rights, stage locks, immutable activity log, document access levels, shareholding privacy, permission changes, profile approval, same-company references).
- **Roles (v2.1)**: 234 API checks of every role against every area (owner, founder, manager, HR, employee, viewer, public visitor, another company), data-privacy of the employee responses, permission-aware search, role-specific notifications and team dashboards; 129 browser checks of each role's sidebar, home page, typed-in restricted URLs and mobile widths.
- **API**: 182 end-to-end checks (sign-up, weak passwords, login, companies, isolation on 13 endpoints, answers, submit / request changes / approve / reopen, invitations, role permissions, partners, financial privacy, shareholding rules, structure, values, master profile versions, names, brand uploads, documents and access levels, plans, tasks, compliance, employees, content acknowledgements, KPIs, dashboard, activity, notifications, search, reports incl. Word, AI chat / tasks / permissions, password change, forgot & reset, owner protections, removed members losing access).
- **Browser**: the full founder journey, employee joining by invitation, visitor portal, company switching, password reset from the email link, and every page at five screen widths for errors and horizontal overflow.
- These tests ran in a sandbox with a local Postgres standing in for Supabase and a mock Gemini. After you install, do one real run-through: sign up (confirm the email), create a company, invite a second email, and ask the AI one question.
