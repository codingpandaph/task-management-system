# CPSync — HRIS & Task Management

A TypeScript monorepo for employee identity, organization administration, employment lifecycle, leave accounting,
team-exclusive task boards, personal work, milestones, capacity, approvals, reporting, notifications, and audit. The
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

The development-only seed is non-destructive and refuses production execution. Use these fictional accounts after
running `yarn dev:fresh` or `ALLOW_DEMO_SEED=true yarn db:seed`. Every account starts with the password
`Demo only password 2026!`.

## Demo credentials

| Employee ID       | Name          | Perspective                     | Useful manual flows                                             |
| ----------------- | ------------- | ------------------------------- | --------------------------------------------------------------- |
| `2026-ORG-000001` | Avery Morgan  | Managing Director               | Organization overview, governance, reports, auto-approved leave |
| `2026-ACC-000002` | Jordan Ellis  | Client Account Director         | Team settings, boards, tasks, leave approval                    |
| `2026-MKT-000003` | Casey Rowan   | Marketing Account Director      | Second-team scope and reporting                                 |
| `2026-HR-000004`  | Taylor Quinn  | HR Director                     | Employees, policies, lifecycle, leave administration            |
| `2026-HR-000005`  | Morgan Reed   | Final HR approver               | Final leave approval and ordinary HR visibility                 |
| `2026-HR-000006`  | Riley Shaw    | HR employee                     | Employee leave flow without HR administration privileges        |
| `2026-ACC-000007` | Alex Finch    | Client Services employee        | Personal tasks, team boards, filing and cancelling leave        |
| `2026-MKT-000008` | Sam River     | Marketing employee              | Probationary employee and second-team member perspective        |
| `2026-ACC-000009` | Jamie Brook   | Suspended employee              | Authentication denial and suspended-account demonstration       |
| `2026-MKT-000010` | Robin Vale    | Inactive employee               | Inactive/expired-contract authentication denial                 |
| `2026-ACC-000011` | Drew Lane     | New starter                     | Mandatory first-login password change                           |
| `2026-ACC-000012` | Sidney Clarke | Client Services Senior Director | Department-wide oversight and leave approval                    |
| `2026-MKT-000013` | Reese Palmer  | Marketing Senior Director       | Department-wide oversight and leave approval                    |
| `2026-HR-000014`  | Hayden Brooks | HR Senior Director              | HR leadership; leave routes to Managing Director                |
| `2026-ACC-000015` | Bailey Grant  | Account Growth Director         | Second Client Services team boundary                            |
| `2026-MKT-000016` | Dakota Flynn  | Growth Marketing Director       | Second Marketing team boundary                                  |

Employee IDs use the current London creation year. Replace `2026` with the current year if the seed is run in a later
year. The limited Playwright seed contains the named accounts `000001` through `000016`; the full development seed also
contains the complete 15-member delivery teams. Drew's listed password is temporary and the application requires a new password immediately after
login.

The full seed creates one Managing Director and three departments, each with one Senior Director. Client Services and
Marketing each have two independent teams; every team has one Account Director and exactly 15 members. Human Resources
starts with one editable People Operations team. Team creation is dynamic, and every team owns one private task
workspace. The limited Playwright seed keeps all 16 named hierarchy and security fixtures; the full demo adds the 57
members needed to make all four delivery teams complete.

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

Integration tests require a dedicated test database. Every Playwright command requires exactly `tms_test` and applies
committed migrations before starting the app. Automated acceptance runs use a limited deterministic 16-person seed;
the headed product demo uses the full fictional organization:

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
| `yarn demo:e2e`                 | One slow headed browser for the complete product tour  |
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
regular and Christmas policy creation/versioning/status/assignment, balances, all seven approval chains, cancellation,
editable leave drafts, HR corrections and adjustments, notification read state, searchable audit history, reporting,
responsive UI, direct authorization denial, and browser-driven filing plus approval for every role in the seven-path
matrix. It also covers personal tasks, team boards, task creation, comments, management sign-off,
and drag-and-drop movement, contextual per-board search, delegated board/ticket creation, self/department
assignment, authenticated creator reporting, delivery reporting, and
every defined breakpoint. `yarn demo:e2e` resets once, opens one Chromium browser with one page, and first shows the
Managing Director, department Senior Directors, and Account Directors with 15 active members per delivery team. It then runs the HR setup, seven leave
perspectives, cancellation, director-to-employee task handoff, and reporting in sequence. A visible guide
names each role and explains the expected result while the journey pauses between meaningful actions. Manual
checklists are in [docs/hr-system.md](docs/hr-system.md#manual-acceptance-checklist) and
[docs/task-management.md](docs/task-management.md#complete-manual-acceptance-checklist).

The complete command runs the workflow suite in Chromium, then resets again and runs the critical login, navigation,
responsive, and automated accessibility path in Chromium, Firefox, and WebKit. Use `yarn test:e2e:chromium` or
`yarn test:e2e:browsers` when isolating one layer. Browser-specific login, People, desktop task-board, and mobile
task-board baselines provide visual regression coverage for the shared shell and highest-use workspaces.

The current acceptance baseline is 9 unit tests, 6 tooling tests, 29 real-PostgreSQL integration tests, 23 full
Chromium journeys, and 3 critical cross-browser journeys. The cross-browser layer runs in Chromium, Firefox, and
WebKit; task screens are also exercised below, at, and above every shared breakpoint.

`yarn test:integration` also resets `tms_test`, using the fuller lifecycle fixture set required for contractual,
probationary, concurrency, ledger, and privacy assertions. Both commands refuse any database other than `tms_test`.

The portal keeps each screen's actions, tabs, contextual search, and filters inside the content surface they control.
It uses employee tabs with visible employment history and access grants, searchable approval queues,
role-scoped leave calendars, sortable personal task lists, horizontal team Kanban boards with uncluttered drag-and-drop and
keyboard movement controls, semantic tags, policy actions, scoped delivery summaries, and plain-language permission
and recovery messages. Internal authorization and session terminology is translated before it reaches employee-facing
alerts. Business mutations remain enforced by the API regardless of which controls are visible.
Status and permission pills use one-word labels, while their hover titles preserve the full internal value. Primary
green actions explicitly use white text across default, hover, and keyboard-focus states.
On phones, a labelled menu opens the complete role-aware navigation drawer, keeping leave, approval, reporting, and
administration destinations discoverable without relying on a long horizontal strip.
Run `yarn design-check` to detect design-system drift against `apps/web/DESIGN.md` and `apps/web/PRODUCT.md`.

RBAC assigns bounded defaults to Member, Account Director, HR Member, and HR Director roles. The Managing Director has organization-wide capabilities. Senior Directors have bounded people and delivery oversight for their own department. Backend permission and resource checks remain authoritative; the UI uses the same effective
permissions to hide unavailable navigation and actions.
Employee access details show the effective role, and permission forms only offer grants inside that role’s ceiling.
Restricted direct URLs redirect to the employee's Overview before the protected screen mounts. The Nest API still
returns `403` for unauthorized direct requests. MFA and SSO remain documented future work.
The leave flow uses explicit Preview, Save draft, and Submit actions, preserves preview results inside the dialog, and
keeps primary evergreen buttons readable with white text in every link, hover, and focus state.
Approval dialogs use direct Approve and Reject actions. Cancellation queues show the employee, leave dates, request
reason, workflow step, and status so reviewers can decide without interpreting an opaque reference.
Organization lists searchable departments, directors, and counts from the complete active hierarchy; secondary
settings appear under Department actions. Employee and employment dialogs reveal contract-end or probation-review fields only when the chosen employment
type requires them. The navigation badge reads live unread state, task notifications open the referenced task directly,
and authorized users can load older audit pages without losing their current review context.

## Remaining work

The prototype scope and Simon's required individual, team, and leadership journeys are implemented and covered by the
acceptance suite. The following work remains before a production launch:

Prototype operational evidence is now included: reproducible Docker images, database-backed readiness, structured
request IDs and redacted logs, a threat model, an incident runbook, guarded backup/restore verification, dependency and
secret checks, and CI static verification. See [deployment](docs/deployment.md), [backup recovery](docs/backup-recovery.md),
[security review](docs/security-threat-model.md), and [incident response](docs/incident-runbook.md).

The prototype proof was exercised locally: both Docker images built, PostgreSQL and API reached healthy state, the web
login route responded, a custom-format `tms_test` backup restored with 10 employees into an isolated verification
database, and that disposable database was removed. The high-severity dependency audit returned no suggestions.

- Deploy behind HTTPS with independently managed and rotated secrets.
- Add shared rate limiting and distributed scheduling for a multi-instance API deployment.
- Add structured production telemetry, alerting, request tracing, and tested incident runbooks.
- Rehearse PostgreSQL backup restoration and document recovery-time and recovery-point targets.
- Agree and implement retention, anonymisation, data-subject, and worker-health procedures with the organization.
- Complete an independent security review, dependency scanning, penetration testing, and deployment rollback rehearsal.
- Add email or SMS delivery only after notification content, consent, retry, and failure-handling rules are approved.
- Expand Task Management with file storage, richer trend history, live repository automation, and exports. Persisted
  saved views, bulk triage, secure attachment links, mentions, 30-day throughput, and cycle-time reporting are included.
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

Task workspaces reuse the HRIS hierarchy. Every team owns its own workspace, and all active team members can view,
comment on, and move its tickets. Creating tickets and boards remains independently permissioned. Account Directors
manage their team only; Senior Directors can view and manage every team in their department; the Managing Director can
view every department. Assignment, mentions, WIP limits, capacity, archives, and reporting all enforce the same team
boundary. Scrum uses one board and one milestone per sprint, with date-only start and due dates. Completion makes that
sprint board read-only and preserves it in Past sprints.

Leave routing snapshots the hierarchy when a request is submitted. Non-HR members route through team Account Director,
department Senior Director, and the default HR approver. Non-HR Account Directors route through Senior Director and HR;
non-HR Senior Directors route to HR. HR members route through HR Account Director and HR Senior Director; the HR Account
Director routes to HR Senior Director; the HR Senior Director routes to the Managing Director. Managing Director leave
auto-approves without an approver.
Next.js protects page requests in its server proxy before a restricted screen renders; NestJS repeats authorization for
every API request. Task descriptions render a deliberately limited Markdown subset as React elements without raw HTML.

Production deployment still requires HTTPS, independently managed secrets, shared rate limiting for multiple API
instances, distributed scheduling, approved retention rules, employer-reviewed UK GDPR lawful bases, monitoring, and
backup/restore procedures. This prototype does not claim legal certification.

### UI access and workflow acceptance

- Overview and Leave calendar use API-enforced scope: organization-wide for the Managing Director and authorized HR
  reporting users, own department for Senior and Account Directors, and own approved leave only for members. People navigation
  and `/employees` pages are limited to HR and the Senior Director; employee detail still requires its capability.
- Create team uses Kanban, Scrum, and List checkboxes plus Select all. Team settings show the Kanban WIP field only
  while Kanban is selected. At least one type is required.
- Policies has one **Create** button for the selected Regular leave or Christmas tab and its permission.
- Team boards omits the duplicate introduction panel. Board creation uses **Board name** and **Create board** for
  Kanban/List, then changes to **Sprint name** and **Create sprint board** for Scrum. Each Scrum board represents one
  sprint and creates its single required milestone with date-only start and due dates; the next sprint uses a new
  board. Its milestone card summarizes the goal, dates, and capacity. **View capacity** opens the team breakdown, and
  **Complete sprint** explains that the board becomes read-only before confirmation. Completed Scrum boards move into
  searchable **Past sprints**. Scrum tasks use the board milestone automatically.
- Navigation groups Company, Work, Time off, Administration, and Updates so each role can scan its permitted
  destinations without a flat menu. Team boards uses employee-facing department language, keeps Past sprints beside
  board selection, separates Kanban WIP status from filters, and shows a horizontal-board cue on touch layouts.
- My tasks is a sortable table with search, status, and priority filters. Task and employment tables sort by clicking
  headers; People sorting applies on the API before pagination. Empty task due dates sort last in both directions.
- Targeted browser regression: `yarn playwright test tests/e2e/ui-feedback.spec.ts --project=chromium` after preparing
  the dedicated `tms_test` fixtures with `yarn e2e:db:reset`. This reset deletes only that test database's data and must
  not target application or production data. The test covers permissions, department board interaction, conditional
  controls, sorting, console errors, accessibility, and 375, 599/600/601, 768, 899/900/901, 1199/1200/1201, 1440, and
  1535/1536/1537-pixel viewports. See the manual acceptance flows in both feature documents.
