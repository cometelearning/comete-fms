# COMETE LEARNING - Fee Management Software

A cloud-based fee management system for COMETE LEARNING, built to replace manual
Excel-based fee tracking. Covers the complete cycle: **Students → Fees →
Installments → Payments → Receipts → Outstanding → Reports**, and nothing else
(no attendance, marks, exams, payroll, HR, timetable, or LMS).

It's a genuine cloud web app: any employee opens the deployed URL in a browser
on a desktop, laptop, tablet, or phone, signs in with their own email/password,
and works from the live Supabase database. Nobody's data lives only on their
own computer.

## Status: Phase 1 (core system)

This first build covers the full financial core end-to-end and is safe to run
in production for daily fee collection:

- Authentication (Supabase Auth) with 4 roles (Super Admin, Admin, Accountant,
  Viewer), enforced **server-side** via Postgres Row Level Security, not just
  hidden buttons.
- Academic Years, Courses, Batches, Fee Heads masters.
- Students master with global search.
- Fee Structures with a fee-head breakdown and an auto-generated or
  hand-edited installment schedule.
- Assigning a fee structure to a student.
- The Collect Fee screen: search → outstanding → select installment → amount
  → payment mode → reference → save → receipt, in one atomic database
  transaction with a concurrency-safe, never-reused, never-duplicated receipt
  number (`CL-2026-000001`), and idempotency protection against double-clicks
  and network retries.
- Receipt PDF generation, print, and cancellation (reason required, number
  permanently retired, financial effect reversed).
- Student fee ledger and Outstanding Fees report, both computed live from
  transactions - nothing is a manually-maintained balance.
- Discounts/concessions/waivers (fixed or percentage), with reversal.
- Dashboard with live collection/outstanding figures.
- Collection Report, Receipt Register (cancelled receipts included),
  Discount Register, and a full Audit Trail - filterable and exportable to
  CSV/Excel/PDF.
- Users & Roles management (Super Admin only).
- Google Drive integration is fully coded (OAuth connect flow, automatic
  receipt PDF upload to `Receipts/<Year>/<Month>/`, Test Connection, graceful
  degradation if Drive is unreachable) but ships **disconnected** until you
  add Google Cloud OAuth credentials - see below. Nothing about fee collection
  depends on Drive being connected.
- Data backup/export (zip of CSVs for every core table), downloadable and,
  once Drive is connected, auto-copied to `Backups/`.

Not yet built (natural next phase, none of it blocks daily use): a UI to add
custom fee-structure amendments after installments have started, scheduled
(cron) backups, SMS notifications, multi-organization branding beyond the one
org this deployment is bootstrapped for.

## Technology stack (free-tier first)

| Layer | Choice | Why |
|---|---|---|
| Frontend + app | Next.js 14 (App Router) + TypeScript + Tailwind | One deployable app, works on any device via the browser |
| Hosting | Vercel (free "Hobby" tier) | Zero-config deploys from GitHub |
| Database | Supabase PostgreSQL (free tier) | Real relational DB with Row Level Security, not spreadsheets |
| Auth | Supabase Auth | Per-user email/password logins, no shared credentials |
| File storage | Google Drive (org-owned account) | Receipts/reports/backups, not the transactional DB |
| PDF | `pdf-lib` (in-process) | No paid PDF API |
| Email (optional) | Any SMTP account via `nodemailer` | Free with Gmail/Workspace App Password or a free-tier provider |
| Source control | GitHub | Standard, free for private repos |

**Free-tier limits to know about before you rely on this in production:**

- **Supabase free tier**: 500 MB database storage, 5 GB bandwidth/month,
  and the project can pause after 1 week with no API activity (visiting the
  app resumes it, but a paused project means an offline app until then - if
  that's a problem, Supabase's paid tier removes the pause and starts at a
  low monthly cost, or you can ping the project on a schedule to keep it
  warm).
- **Vercel free tier**: fine for this app's traffic; serverless function
  execution is capped per invocation (currently 10s on Hobby) - the payment
  and PDF routes are lightweight and comfortably within that.
- **Google Drive API**: essentially free at this scale (per-user quota is
  generous; COMETE LEARNING will use a tiny fraction of it).
- **Google OAuth verification**: while the app is in "Testing" mode in Google
  Cloud Console, only the test users you list can connect Drive. Publishing
  the OAuth consent screen (still free) removes that limit - see below.

If a paid service is ever proposed later (e.g. Supabase Pro because the free
project keeps pausing, or a transactional email provider), that will be
called out explicitly with the reason, per COMETE LEARNING's requirement -
nothing paid is silently introduced.

## Project structure

```
supabase/migrations/   All SQL: schema, RLS policies, and the transactional
                        functions that make payments/receipts safe (read
                        these first - they are the heart of the system)
src/app/                Next.js routes (pages under (app)/, API routes under api/)
src/components/         React components, grouped by feature
src/lib/                Supabase clients, auth/permissions, PDF, Google Drive,
                        exports, and shared domain types
```

## One-time setup

### 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project (free tier is fine).
2. Once it's ready, open **SQL Editor** and run every file in
   `supabase/migrations/` **in order** (0001 through 0008). Each file is
   idempotent-safe to re-run individually if something fails partway - fix the
   error and re-run just that file.
3. Open **Project Settings → API** and note down:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**secret - never put
     this in frontend code or commit it**)

### 2. Push the code to GitHub

```bash
git init
git add .
git commit -m "Initial commit: COMETE LEARNING fee management"
git branch -M main
git remote add origin https://github.com/<your-org>/<repo>.git
git push -u origin main
```

### 3. Deploy to Vercel

1. [vercel.com](https://vercel.com) → New Project → import the GitHub repo.
2. Framework preset: Next.js (auto-detected).
3. Add these Environment Variables (copy from `.env.example`, values from
   step 1):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` (your Vercel URL for now, e.g.
     `https://comete-fms.vercel.app`; update this later if you attach a
     custom domain - see below)
   - `NEXT_PUBLIC_ORG_NAME` = `COMETE LEARNING`
   - `GOOGLE_TOKEN_ENCRYPTION_KEY` = output of `openssl rand -hex 32` (needed
     even before you connect Drive, so the column exists cleanly - generate
     it now)
   - Leave `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`,
     and the `SMTP_*` variables blank for now.
4. Deploy.

### 4. Bootstrap your organization and Super Admin account

Visit `https://<your-deployment>/setup` once. This is a one-time page - it
refuses to run again after the first organization exists. Fill in COMETE
LEARNING's details and create your own Super Admin login. Then sign in at
`/login`.

From there, create the rest of your team under **Users** (each person gets
their own login and a temporary password shown once - share it securely and
have them sign in and note it down; a "change my password" self-service
screen is a natural quick addition if you want one next).

### 5. (When ready) Connect Google Drive

1. In [Google Cloud Console](https://console.cloud.google.com), create a
   project (or reuse one), enable the **Google Drive API**.
2. **OAuth consent screen**: External, fill in the app name (COMETE
   LEARNING), add the Google account you want Drive files stored under as a
   test user (or publish the screen once you're happy with it - still free).
3. **Credentials → Create Credentials → OAuth client ID**, type **Web
   application**. Authorized redirect URI:
   `https://<your-deployment>/api/google-drive/callback`.
4. Copy the Client ID and Client Secret into Vercel's environment variables
   as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and set
   `GOOGLE_REDIRECT_URI` to the exact redirect URI from step 3. Redeploy (or
   just trigger a redeploy from Vercel) so the new env vars take effect.
5. In the app, go to **Settings → Google Drive → Connect Google Drive** and
   sign in with the account that should own the storage. You'll see
   "Connected as ..." and can use **Test Connection** at any time.

Until this is connected, every receipt still generates and can be printed,
downloaded, and emailed (if SMTP is set up) - `pdf_status` just stays
`PENDING` instead of `STORED`, and nothing about the payment or receipt is
ever lost or blocked by Drive being unavailable.

### 6. (Optional) Enable "Email Receipt"

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` in
Vercel's environment variables. Any SMTP account works - a Gmail/Workspace
account with an [App Password](https://myaccount.google.com/apppasswords) is
free up to ~500 emails/day; providers like Brevo have a free tier around
300/day if you outgrow that. Leave these blank to keep the button disabled -
the app tells the user plainly that email isn't configured rather than
pretending to send anything.

### 7. Custom domain

Nothing in the app hard-codes the Vercel URL except the `NEXT_PUBLIC_APP_URL`
env var and the Google OAuth redirect URI. To move to
`app.cometelearning.com`: add the domain in Vercel → Project → Domains,
follow its DNS instructions, then update `NEXT_PUBLIC_APP_URL` and (if Drive
is connected) `GOOGLE_REDIRECT_URI` + the redirect URI registered in Google
Cloud Console to match, and redeploy.

## Roles & permissions

Permissions are enforced in two independent places, so a restricted user can
never reach data or actions through a direct API call even if they bypass the
UI entirely:

1. **Application layer** (`src/lib/auth/session.ts`): every page and API
   route calls `requirePermission(...)` before doing anything.
2. **Database layer** (`supabase/migrations/0003_rls_policies.sql`): Postgres
   Row Level Security policies re-check the same permissions on every query,
   using the database's own understanding of who is asking
   (`auth.uid()`) - this holds even if application code has a bug.

| Role | Can |
|---|---|
| **Super Admin** | Everything: users, settings, all financial actions, cancel receipts, view audit trail |
| **Admin** | Manage students, courses, batches, fee structures, student fees, discounts; view reports |
| **Accountant** | Search students, collect payments, generate receipts, view outstanding/collection reports |
| **Management / Viewer** | View dashboard, students, fees, receipts, reports - cannot touch any financial transaction |

New roles can be added later (the `roles`/`permissions`/`role_permissions`
tables support it) - ask for it as a feature and it's a small addition, not a
rebuild.

## How financial integrity is guaranteed

- **Unique receipt numbers under concurrency**: `record_payment()` (in
  `0005_transactional_rpc.sql`) increments a per-organization, per-year
  counter with a single atomic `UPDATE ... RETURNING`, inside the same
  Postgres transaction as the payment and receipt insert. Two accountants
  collecting fees at the same instant get two different, sequential numbers -
  guaranteed by the database, not by application-level locking.
- **No duplicate payments**: every Collect Fee submission carries a
  client-generated `idempotency_key` (a UUID made once when the form opens).
  If the same request arrives twice (double-click, retried network request),
  `record_payment()` recognizes the existing payment and returns its receipt
  instead of creating a second one.
- **Nothing is silently deleted**: receipts are never deleted, only marked
  `CANCELLED` with a required reason, timestamp, and the cancelling user -
  the number is retired forever. Payments are marked `CANCELLED` rather than
  removed, which is exactly what reverses their effect on every balance
  (every SUM() in the system only counts `status = 'COMPLETED'`).
- **No manually-maintained balances**: Total Fee, Discount, Paid, Outstanding,
  Overdue, and the student ledger are all SQL views
  (`0002_functions_and_views.sql`) computed live from `payments`,
  `discounts`, and `installments`. There is no `balance` column anywhere that
  could drift from reality.

## Testing checklist

Before putting this in front of office staff, walk through the acceptance
test in the project's own spec end-to-end at least once on the deployed
instance: create a user → log in → create an academic year/course/batch →
create a student → create a fee structure → assign it → collect a partial
payment → view the receipt → download the PDF → cancel a receipt → confirm
the outstanding balance reverses → confirm the cancelled number is never
reused → check the receipt appears (as cancelled) in the register → check the
audit trail recorded every step. Also test with two people (or two browser
tabs on two different accounts) collecting payments for different students
at the same moment, to see the receipt numbers come out sequential and
distinct.

## Keeping types in sync

The Supabase client here is intentionally untyped against the exact schema
(a hand-written "any table" type fights the client's generics more than it
helps - see the comment in `src/lib/supabase/server.ts`). Once your project
is deployed, you can generate exact types and wire them in for full
compile-time safety:

```bash
npx supabase login
npx supabase gen types typescript --project-id <your-project-ref> > src/lib/types/database.ts
```

Then pass `<Database>` back into `createServerClient`, `createBrowserClient`,
and `createClient` in the three files under `src/lib/supabase/`.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project's values
npm run dev
```

`npm run build` runs the same production build Vercel runs; `npm run
typecheck` and `npm run lint` are both clean on this codebase as delivered.
