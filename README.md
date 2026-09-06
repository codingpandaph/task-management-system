# CPPinSync — HR & Organization Foundation

A TypeScript monorepo for employee identity, organization administration, employment lifecycle, leave accounting,
approvals, reporting, notifications, and audit. The browser app uses Next.js 16, React 19, MUI, and Tailwind. The REST
API uses NestJS 12, Prisma 7, and PostgreSQL. Public cross-application types live in `@tms/contracts`.

Task Management is intentionally outside this foundation. See [the business and security specification](docs/hr-system.md)
and the architecture decisions in [docs/adr](docs/adr).

## Local setup

Use Node.js 24 and the pinned Yarn 4 release. PostgreSQL 17 is recommended. On macOS with Homebrew:

```bash
brew install postgresql@17
/opt/homebrew/opt/postgresql@17/bin/pg_ctl -D /opt/homebrew/var/postgresql@17 start
/opt/homebrew/opt/postgresql@17/bin/createdb tms_development
/opt/homebrew/opt/postgresql@17/bin/createdb tms_test
```

Create local environment files from the examples. Generate a strong, unique `JWT_ACCESS_SECRET`; do not copy the test
secret into development or production.

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
yarn install --immutable
yarn db:generate
yarn db:migrate:deploy
ALLOW_DEMO_SEED=true yarn db:seed
yarn test:e2e:install
yarn dev
```

The web application runs at <http://localhost:3000>, the API at <http://localhost:3001/api>, and liveness is available
at <http://localhost:3001/health>. Browser API calls pass through the same-origin Next.js `/api` rewrite.

The development-only seed is non-destructive and refuses production execution. Its fictional users all start with
`Demo only password 2026!`. Examples for the current year are `<year>-DIR-000001` (Senior Director),
`<year>-HR-000004` (HR Account Director), `<year>-HR-000005` (final HR approver), and `<year>-ACC-000007`
(member). `<year>-ACC-000011` demonstrates mandatory first-login password change.

## Database and migrations

`DATABASE_URL` in the root `.env` is used by Prisma CLI. The API reads its own `.env`. Migrations contain reviewed
PostgreSQL checks, partial unique indexes, the bounded employee-ID sequence, immutable employee-ID enforcement, and
append-only ledger/audit/policy-version triggers.

```bash
yarn db:validate
yarn db:generate
yarn db:migrate:status
yarn db:migrate:dev --name descriptive_change
yarn db:migrate:deploy
```

Integration and E2E tests require `TEST_DATABASE_URL` to identify a dedicated database whose name ends in `_test` or
is exactly `tms_test`. Tests refuse another database. Apply committed migrations to it before running the suite:

```bash
DATABASE_URL="$TEST_DATABASE_URL" yarn db:migrate:deploy
yarn test
```

## Commands

| Command                        | Purpose                                                |
| ------------------------------ | ------------------------------------------------------ |
| `yarn dev`                     | Build contracts and start web/API watch servers        |
| `yarn build`                   | Build contracts, API, and web application              |
| `yarn lint` / `yarn typecheck` | Static validation                                      |
| `yarn format:check`            | Verify repository formatting                           |
| `yarn test:unit`               | API unit tests                                         |
| `yarn test:integration`        | Real-PostgreSQL domain, privacy, and concurrency tests |
| `yarn test:e2e`                | Playwright browser and API journeys                    |
| `yarn test`                    | Unit, integration, and E2E acceptance suite            |
| `yarn db:seed`                 | Explicit guarded fictional demo seed                   |

Playwright owns ports 3100 and 3101. Stop local dev servers before E2E. Browser artifacts may contain private test
state and remain ignored in `test-results/` and `playwright-report/`.

## Architecture

Nest controllers validate transport DTOs and delegate to domain services. PostgreSQL transactions and row locks guard
leadership changes, employee lifecycle transitions, leave overlap, annual accounts, and ledger postings. Sessions and
employee eligibility are checked on every protected request. Authorization reads current database grants and adds
resource checks for department scope and assigned approval steps.

The leave ledger is authoritative: entitlement, reservation, use, reversal, adjustment, and correction are immutable
postings with unique operation keys. Policy assignments and chargeable leave dates preserve historical calculations.
Business time and contractual expiry use `Europe/London`; bank holidays come from the checked-in attributed GOV.UK
snapshot under `prisma/fixtures`.

Production deployment still requires HTTPS, independently managed secrets, shared rate limiting for multiple API
instances, distributed scheduling, approved retention rules, employer-reviewed UK GDPR lawful bases, monitoring, and
backup/restore procedures. This prototype does not claim legal certification.
