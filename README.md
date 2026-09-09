# CPSync — HRIS & Task Management

A TypeScript monorepo for employee identity, organization administration, employment lifecycle, leave accounting,
department task boards, personal work, milestones, capacity, approvals, reporting, notifications, and audit. The
browser app uses Next.js 16, React 19, MUI, and Tailwind. The REST API uses NestJS 12, Prisma 7, and PostgreSQL. Public
cross-application types live in `@tms/contracts`.

See the [HRIS business and security specification](docs/hr-system.md), the
[Task Management product and acceptance guide](docs/task-management.md), and the architecture decisions in
[docs/adr](docs/adr).

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

`yarn dev` and `yarn dev:retain` preserve existing development data. Use `yarn dev:fresh` when you explicitly want
to reset the local development database, apply migrations, load the full fictional demo seed, and then start the apps.
Fresh mode refuses remote hosts and the dedicated E2E database.

The web application runs at <http://localhost:3000>, the API at <http://localhost:3001/api>, and liveness is available
at <http://localhost:3001/health>. Browser API calls pass through the same-origin Next.js `/api` rewrite.

The development-only seed is non-destructive and refuses production execution. Its fictional users all start with
`Demo only password 2026!`. Examples for the current year are `<year>-ORG-000001` (Senior Director),
`<year>-HR-000004` (HR Account Director), `<year>-HR-000005` (final HR approver), and `<year>-ACC-000007`
(member). `<year>-ACC-000011` demonstrates mandatory first-login password change.

The full seed creates three departments. Client Services and Marketing each contain one Account Director and 15
members; Human Resources contains the additional HR roles and the Senior Director. Simon's core hierarchy therefore
contains 33 people when “15 people underneath” excludes each team leader. E2E keeps a seven-user subset.

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

Integration tests require a dedicated test database. Every Playwright command requires exactly `tms_test`, resets it,
applies committed migrations, and loads a limited deterministic seven-person seed before starting the app:

```bash
yarn test
```

## Commands

| Command                         | Purpose                                                |
| ------------------------------- | ------------------------------------------------------ |
| `yarn dev` / `yarn dev:retain`  | Start development while preserving database data       |
| `yarn dev:fresh`                | Reset, seed, and start the local development database  |
| `yarn build`                    | Build contracts, API, and web application              |
| `yarn lint` / `yarn typecheck`  | Static validation                                      |
| `yarn lint:common`              | Shared correctness and maintainability rules           |
| `yarn lint:js` / `yarn lint:ts` | JavaScript and TypeScript recommended rule sets        |
| `yarn lint:react`               | React, Hooks, accessibility, and Next.js rules         |
| `yarn format:check`             | Verify repository formatting                           |
| `yarn test:unit`                | API unit tests                                         |
| `yarn test:integration`         | Real-PostgreSQL domain, privacy, and concurrency tests |
| `yarn test:e2e`                 | Playwright browser and API journeys                    |
| `yarn demo:e2e`                 | Slow headed HRIS, five-role leave, and task tour       |
| `yarn demo:e2e:leave`           | Slow headed five-role filing and approval matrix       |
| `yarn demo:e2e:tasks`           | Slow headed task perspectives and delegated creation   |
| `yarn test`                     | Unit, integration, and E2E acceptance suite            |
| `yarn db:seed`                  | Explicit guarded fictional demo seed                   |

ESLint applies explicit shared, JavaScript, TypeScript, React, React Hooks, accessibility, and Next.js checks. It also
enforces a 300-line maximum for every linted source and test file. Large domains are split by responsibility: entry
points compose focused services and screens, while shared test helpers keep browser scenarios readable.

Playwright owns ports 3100 and 3101. Stop local dev servers before E2E. Browser artifacts may contain private test
state and remain ignored in `test-results/` and `playwright-report/`.

### Acceptance testing

`yarn test:e2e` resets `tms_test` and covers authentication/session rotation, employee onboarding, password confirmation,
plain-language password guidance, and forced password
change, directory scope, departments, employee edits/transfers/employment records, permissions, lifecycle transitions,
regular and Christmas policy creation/versioning/status/assignment, balances, all five approval chains, cancellation,
editable leave drafts, HR corrections and adjustments, notification read state, searchable audit history, reporting,
responsive UI, direct authorization denial, and browser-driven filing plus approval for every role in the five-path
matrix. It also covers personal tasks, team boards, task creation, comments, management sign-off,
and drag-and-drop movement, contextual per-board search, delegated board/ticket creation, self/department
assignment, authenticated creator reporting, delivery reporting, and
every defined breakpoint. `yarn demo:e2e` runs the complete paced headed tour; its `:hr`, `:leave`, and `:tasks`
subcommands run one section. Manual
checklists are in [docs/hr-system.md](docs/hr-system.md#manual-acceptance-checklist) and
[docs/task-management.md](docs/task-management.md#complete-manual-acceptance-checklist).

The complete command runs the workflow suite in Chromium, then resets again and runs the critical login, navigation,
responsive, and automated accessibility path in Chromium, Firefox, and WebKit. Use `yarn test:e2e:chromium` or
`yarn test:e2e:browsers` when isolating one layer. Browser-specific login, People, desktop task-board, and mobile
task-board baselines provide visual regression coverage for the shared shell and highest-use workspaces.

The current acceptance baseline is 7 unit tests, 4 tooling tests, 25 real-PostgreSQL integration tests, 21 full
Chromium journeys, and 3 critical cross-browser journeys. The cross-browser layer runs in Chromium, Firefox, and
WebKit; task screens are also exercised below, at, and above every shared breakpoint.

`yarn test:integration` also resets `tms_test`, using the fuller lifecycle fixture set required for contractual,
probationary, concurrency, ledger, and privacy assertions. Both commands refuse any database other than `tms_test`.

The portal keeps each screen's actions, tabs, contextual search, and filters inside the content surface they control.
It uses employee tabs with visible employment history and access grants, searchable approval queues,
department-filtered calendars, personal task search, horizontal team Kanban boards with uncluttered drag-and-drop and
keyboard movement controls, semantic tags, policy actions, scoped delivery summaries, and plain-language permission
and recovery messages. Internal authorization and session terminology is translated before it reaches employee-facing
alerts. Business mutations remain enforced by the API regardless of which controls are visible.
Status and permission pills use one-word labels, while their hover titles preserve the full internal value. Primary
green actions explicitly use white text across default, hover, and keyboard-focus states.
On phones, a labelled menu opens the complete role-aware navigation drawer, keeping leave, approval, reporting, and
administration destinations discoverable without relying on a long horizontal strip.
Run `yarn design-check` to detect design-system drift against `apps/web/DESIGN.md` and `apps/web/PRODUCT.md`.

RBAC assigns bounded defaults to Member, Account Director, HR Member, and HR Director roles. The Senior Director has
every system capability. Backend permission and resource checks remain authoritative; the UI uses the same effective
permissions to hide unavailable navigation and actions.
Employee access details show the effective role, and permission forms only offer grants inside that role’s ceiling.
Restricted direct URLs redirect to the employee's Overview before the protected screen mounts. The Nest API still
returns `403` for unauthorized direct requests. MFA and SSO remain documented future work.
The leave flow uses explicit Preview, Save draft, and Submit actions, preserves preview results inside the dialog, and
keeps primary evergreen buttons readable with white text in every link, hover, and focus state.
Approval dialogs use direct Approve and Reject actions. Cancellation queues show the employee, leave dates, request
reason, workflow step, and status so reviewers can decide without interpreting an opaque reference.
Organization cards use the complete active hierarchy for their people counts and expose edit plus lifecycle actions in
place. Employee and employment dialogs reveal contract-end or probation-review fields only when the chosen employment
type requires them. The navigation badge reads live unread state, task notifications open the referenced task directly,
and authorized users can load older audit pages without losing their current review context.

## Remaining work

The prototype scope and Simon's required individual, team, and leadership journeys are implemented and covered by the
acceptance suite. The following work remains before a production launch:

- Deploy behind HTTPS with independently managed and rotated secrets.
- Add shared rate limiting and distributed scheduling for a multi-instance API deployment.
- Add structured production telemetry, alerting, request tracing, and tested incident runbooks.
- Rehearse PostgreSQL backup restoration and document recovery-time and recovery-point targets.
- Agree and implement retention, anonymisation, data-subject, and worker-health procedures with the organization.
- Complete an independent security review, dependency scanning, penetration testing, and deployment rollback rehearsal.
- Add email or SMS delivery only after notification content, consent, retry, and failure-handling rules are approved.
- Expand Task Management with saved views, bulk triage, attachments, mentions, repository automation, trend reporting,
  and exports. Department-configured Kanban, Scrum, and List boards are implemented in the prototype.
- Expand HRIS where required with partial-day leave, proration, carry-over, regional calendars, rehire, and delegated
  approval reassignment.

MFA and SSO remain explicitly deferred. Their absence is documented and does not weaken the prototype's current
password, session rotation, revocation, CSRF, RBAC, or resource-scope controls.

## Architecture

Nest controllers validate transport DTOs and delegate to domain services. PostgreSQL transactions and row locks guard
leadership changes, employee lifecycle transitions, leave overlap, annual accounts, and ledger postings. Sessions and
employee eligibility are checked on every protected request. Authorization reads current database grants and adds
resource checks for department scope and assigned approval steps.

The leave ledger is authoritative: entitlement, reservation, use, reversal, adjustment, and correction are immutable
postings with unique operation keys. Policy assignments and chargeable leave dates preserve historical calculations.
Business time and contractual expiry use `Europe/London`; bank holidays come from the checked-in attributed GOV.UK
snapshot under `prisma/fixtures`.

Task workspaces reuse HRIS positions and membership. Serializable workspace counters produce human task keys. Task
completion enforces blockers and management-locked columns. Departments select Kanban, Scrum, and List workflows and
set one Kanban limit that is enforced separately for each assignee under a row lock. Board collaborators remain
separate from member create permissions. Reporters are always derived from the authenticated creator. Capacity uses active employees,
business days, and approved HRIS leave; termination transactionally unassigns incomplete tasks and returns them to the
initial lane. Task deletion is reversible and its activity ledger is append-only.
The Senior Director is an organization-level employee with no department assignment; a PostgreSQL constraint requires
every Member and Account Director to remain attached to exactly one department. Delivery reports compare portfolio
completion, open and blocked work, escalations, capacity risks, workflow distribution, and named workload concentration
across both teams. Task detail exposes the immutable activity timeline in plain language.
The multi-user task journey proves the handoff itself: an Account Director creates and assigns work, the named employee
finds it in My tasks, comments and advances it, and the director verifies progress, signs it off, and reviews reporting.
Personal work and team boards include searchable status, priority, and assignee filters with one-action reset. Delivery
reports can be narrowed by department, notifications support individual or bulk read actions, and failed task loading
shows a recoverable retry state instead of leaving the workspace indefinitely busy.

Production deployment still requires HTTPS, independently managed secrets, shared rate limiting for multiple API
instances, distributed scheduling, approved retention rules, employer-reviewed UK GDPR lawful bases, monitoring, and
backup/restore procedures. This prototype does not claim legal certification.
