<img src="https://raw.githubusercontent.com/IsaiahAnson/asset-management/main/docs/banner.svg" width="100%" alt="Asset Management, an IT tool by Isaiah Anson. Who holds every asset, and who approved it. Next.js + PostgreSQL, Audit log on every write, Demo data only.">

[![CI](https://github.com/IsaiahAnson/asset-management/actions/workflows/ci.yml/badge.svg)](https://github.com/IsaiahAnson/asset-management/actions/workflows/ci.yml)

A full-stack asset lifecycle and custody management app for public-sector organizations.
It tracks who holds every piece of equipment, how it moved between people and offices, and who
approved each change. Every write is recorded in an audit log.

All organizations, people, asset tags and serial numbers in the seed data are fictional
("Northwind Agency").

![Asset Management dashboard](docs/screenshots/dashboard.png)

## Screenshots

| | |
|---|---|
| ![Asset detail with admin-defined custom fields](docs/screenshots/asset-detail.png) | ![Firearm record with the mandatory verification checklist](docs/screenshots/firearm-detail.png) |
| **Asset detail** with custody history, audit trail and admin-defined custom fields | **Firearm record** with sensitivity flags and the mandatory verification checklist |
| ![Customize Form admin builder](docs/screenshots/custom-fields.png) | ![Audit log](docs/screenshots/audit-log.png) |
| **Customize Form**: admins add fields with a live preview, no code change | **Audit log** with filters and CSV export |
| ![Workflow operations](docs/screenshots/workflows.png) | ![Dashboard in light theme](docs/screenshots/dashboard-light.png) |
| **Workflows** for onboarding, offboarding, transfer and disposition | **Light theme**, switchable from the header |

## Features

- **Computer assets, end to end**: create, edit, check out, check in, transfer custody, dispose.
  Every change writes a custody event and an audit-log row in the same transaction.
- **Firearms and body armor**: a restricted module with access flags, coordinator roles,
  non-person custodians (warehouses, armories), a mandatory verification checklist, and a
  four-stage approval stepper.
- **Custom Field Admin ("Customize Form")**: admins add, reorder and group their own fields
  (text, select, date, checkbox) and they appear on asset forms without a code change.
- **Licenses, accessories, consumables and components**, with seat, checkout and issue tracking.
- **Requests, approvals and workflows** (onboarding, offboarding, transfer, disposition) with SLA tracking.
- **Procurement and suppliers**: purchase orders linked to the assets they bought.
- **Dashboard** with needs-attention items and a recent-activity feed. Also global search,
  sortable and paginated tables, breadcrumbs, toasts, and a light/dark theme.
- **Audit log** with CSV export.
- **HR webhook receiver** (`POST /api/integrations/hr/intake`): HMAC-SHA256 signature
  verification and idempotency-key dedupe, plus a simulated HRIS sync panel.
- **Role-based access**: admin, approver, asset manager, office asset manager, firearms
  coordinators, and read-only, with a demo login picker for switching roles. See
  [Security model](#security-model) for what each check covers.

## Stack

- Next.js (App Router, Server Actions, Route Handlers), React, TypeScript
- PostgreSQL through `node-postgres`, using raw parameterized SQL (no ORM)
- USWDS-based styling
- Vitest unit tests and database integration tests
- Docker Compose for Postgres and the app

## Quickstart

```bash
cp .env.example .env
npm install
npm run db:up        # starts Postgres in Docker and applies db/init/*.sql on first start
npm run dev          # http://localhost:3000
```

Sign in from the `/login` picker as any seeded user. Each one has a different role. The featured
demo asset is `NWA-CMP-10001`.

`npm run dev` signs the login cookie with a built-in dev secret. `next start` and Docker run in
production mode and need `SESSION_SECRET` set (see `.env.example`); without it signing in and every
page behind the login return an error.

To start over with a clean seeded database:

```bash
npm run db:reset
```

`scripts/reset-db.sh` does the same against a locally installed Postgres (no Docker). It drops
and recreates the database and applies `db/init/*.sql` in order.

The database health check is at `/api/health/db`.

## Tests

```bash
npm run lint
npm run typecheck
npm test                  # unit tests
DATABASE_URL=... npm test # also runs the database integration tests
```

GitHub Actions runs lint, type checking, the full test suite against Postgres, and a
production build on every pull request and every push to `main`.

Integration tests skip automatically when `DATABASE_URL` is not set.

## Docker

```bash
cp .env.example .env   # then set POSTGRES_PASSWORD and SESSION_SECRET
docker compose up --build
```

The app container builds its `DATABASE_URL` from the `POSTGRES_*` values and connects to the
`postgres` service. The `DATABASE_URL` line in `.env` is only for `npm run dev` and tests on the
host. Postgres is published on `127.0.0.1` only. The full `docker compose up --build` path has not
been re-run since these changes; `npm run build` with no database was checked.

If Docker runs behind SSL inspection, put the inspecting root CA in `docker/certs/` as a `.crt`
file, or build with `--build-arg NPM_CONFIG_STRICT_SSL=false` for local use only.

## Security model

The login is a demo picker, not real authentication. There is no password. You pick one of the
seeded role accounts and the app remembers that choice in a cookie. Production sign-in (SSO or
PIV/CAC) is not built.

What the code does enforce:

- **Signed session cookie.** The cookie holds a user id plus an HMAC-SHA256 signature made with
  `SESSION_SECRET`. It is `httpOnly`. A missing, edited or malformed cookie counts as signed out.
  The login form only accepts ids from the picker list.
- **No session, no access.** `src/proxy.ts` sends every page request without a valid cookie to
  `/login`. With nobody signed in, writes are refused and nothing is attributed to a default user.
- **Write checks in server actions.** Read-only users cannot change anything. Firearms changes need
  a firearms coordinator or admin role. Approving or denying on the Approvals page needs the
  Approver or Admin role. Custom fields and reference data are admin only.
- **Firearms visibility.** Users without the firearms access flag do not see firearms or body
  armor in search, on asset or person pages, or in the audit log and its CSV export. The generic
  asset actions (check out, check in, transfer, dispose, edit) refuse these items; they go through
  the Firearms module.
- **Route handlers.** The audit CSV export needs a signed-in user. The simulated HRIS sync `POST`
  needs write access. The HR webhook checks its own HMAC signature. The health check returns a
  generic error message.

Not enforced yet:

- Office scoping for the office asset manager role.
- An approver-only check on the Requests page (any user with write access can decide a request
  there).
- Firearms filtering on the manufacturer and maintenance lists and on dashboard counts.
- Firearms filtering on approval summaries (the Approvals page shows the seeded firearm issuance
  requests to every signed-in user) and on asset counts on the People and Reference pages.

## Project layout

```text
db/init/            schema, migrations and seed data (applied in filename order)
src/proxy.ts        redirects requests without a valid session cookie to /login
src/app/(app)/      signed-in pages and server actions
src/app/api/        route handlers (audit export, health check, integrations)
src/components/     shared UI components
src/lib/            data access, authorization and domain logic
src/lib/__tests__/  Vitest suites
```

## License

Copyright (c) 2026 Isaiah Anson. All rights reserved. The source is published for viewing and
evaluation only. See [LICENSE](LICENSE) for details.
