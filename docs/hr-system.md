# CPSync HRIS specification and acceptance guide

## Organization model

CPSync stores a four-level reporting structure:

```text
Organization
└── Managing Director
    └── Department (one Senior Director)
        └── Team (one Account Director)
            └── Members
```

A department has one or more teams. Teams can be created and edited without changing the schema. The full fixture uses
Client Services and Marketing with two teams of 15 members each, plus Human Resources with one editable team. Every
active Account Director and member belongs to exactly one department and team. A Senior Director belongs to one
department and no team. The Managing Director belongs to neither. PostgreSQL partial unique indexes enforce one active
Managing Director, one active Senior Director per department, and one active Account Director per team.

Employee IDs are immutable and use `YEAR-DEPARTMENT-SEQUENCE`; the Managing Director uses `ORG`. Organization changes
append a dated history record and an audit event.

## Roles and visibility

| Position          | People and leave scope                                                     | Task/report scope                            |
| ----------------- | -------------------------------------------------------------------------- | -------------------------------------------- |
| Member            | Own profile, leave, and calendar                                           | Own team; My Tasks                           |
| Account Director  | Approvals for own team; department leave calendar                          | Own team workspace and report                |
| Senior Director   | People and approvals in own department; department calendar/dashboard      | All teams in own department                  |
| Managing Director | Organization people, calendar, dashboard, and governance                   | All departments and teams                    |
| Authorized HR     | Organization people, leave administration, policy, calendar, and dashboard | HR team unless also acting through hierarchy |

The People menu is available to HR, Senior Directors, and the Managing Director. API resource checks enforce the same
scope if someone calls a URL directly. Senior Directors can read their department’s employee records; HR and the
Managing Director can work organization-wide. Members and Account Directors cannot open People.

The overview dashboard is organization-wide for the Managing Director and authorized HR, department-wide for Senior
Directors, team-wide for Account Directors, and absent for members. The leave calendar is organization-wide for the
Managing Director and authorized HR, department-wide for Senior and Account Directors, and personal for members. “Who
is out” means employees with approved leave overlapping the selected date; CPSync presents this as the Leave Calendar
rather than a separate ambiguous container.

## Leave approval matrix

CPSync resolves and snapshots the approval chain on submission. Later hierarchy changes cannot rewrite an in-flight
request. Each step must approve in sequence; rejection requires a reason; self-approval is prohibited.

| Requester               | Ordered approval chain                                                   |
| ----------------------- | ------------------------------------------------------------------------ |
| Non-HR Member           | Team Account Director → Department Senior Director → default HR approver |
| Non-HR Account Director | Department Senior Director → default HR approver                         |
| Non-HR Senior Director  | Default HR approver                                                      |
| Managing Director       | No approver; auto-approved                                               |
| HR Member               | HR Account Director → HR Senior Director                                 |
| HR Account Director     | HR Senior Director                                                       |
| HR Senior Director      | Managing Director                                                        |

The default HR approver must be an active HR employee with `LEAVE_HR_APPROVE`. The Managing Director designates that
person. HR staff cannot become their own effective approver through the default route.

A submitted request reserves its chargeable working days. Final approval transfers reserved days to used days.
Rejection or cancellation releases the reservation. Cancelling future approved leave creates a separate request with a
copy of the original chain; used days remain charged until final cancellation approval. The immutable ledger records
entitlement, reservation, use, release, correction, and administrative adjustment with idempotency keys.

## Employee and employment lifecycle

HR creates an employee only after choosing an active department, an active team within that department, active regular
and Christmas policies, employment type, and date-only start data. Contract end appears only for Contractual;
probation review appears only for Probationary. The API allocates the employee ID under a database sequence, hashes the
temporary password, returns it once, and forces a password change before normal access.

Profiles separate basic information, employment history, leave policies, and access. Transfers choose both department
and team and reject mismatched pairs. Leadership replacements happen atomically: the successor takes the scoped role,
the prior holder returns to the successor’s former team as a member, history is appended, and unique leadership remains
valid throughout the transaction.

Suspension revokes sessions immediately and requires a future end. Deactivation and termination revoke sessions;
termination unassigns incomplete tasks, returns them to the board’s initial state, and flags affected sprint capacity.
Senior and Managing Directors must be replaced before their status can be changed. Employee IDs, audit events, task
activity, policy versions, and leave ledger postings are immutable.

## Policies and calendar rules

Regular leave and Christmas policies use separate tabs. The selected tab exposes one contextual Create button: Create
opens regular policy fields on Regular leave and Christmas fields on Christmas. Versioning preserves past assignments.
Policy status changes do not alter historical requests.

Dates are date-only wherever the business concept is a day: employment start/end, leave start/end, task due date, and
sprint start/due date. Working days come from the configured calendar and exclude weekends and checked-in England and
Wales bank holidays. Christmas leave is restricted to its configured window. Requests cannot cross leave years or
overlap active requests.

## Security and audit

Passwords are bcrypt hashes. Access tokens are short-lived; refresh credentials rotate and replay revokes the session.
State-changing browser requests require same-origin checks, the web client marker, and CSRF. Eligibility is checked on
every protected request. Temporary-password sessions can change password and log out only.

Roles provide bounded defaults. HR permission delegation is allow-listed and cannot grant leadership, policy,
organization, leave-administration, audit, or permission-management powers beyond the target role ceiling. Nobody can
change their own permissions, employment, or status. API responses omit password hashes and private fields unless the
caller has the precise capability and resource scope.

Audit records cover employee creation/editing, transfers, leadership, status, employment, permissions, policies, leave,
tasks, and team configuration. Search, sorting, pagination, and append-only database triggers support manual review.

## Complete manual acceptance flows

Prerequisites: run the full seed and use the current-year credentials in README.

- [ ] **Hierarchy.** As Avery, open Organization and verify one Managing Director, three departments, one Senior
      Director per department, two Client Services teams and two Marketing teams with 15 members each, and one HR team.
- [ ] **People access.** As Avery, Sidney, Hayden, Taylor, Jordan, and Alex, compare navigation. Avery and HR see all
      people; Sidney sees Client Services only; Hayden sees HR only; Jordan and Alex have no People menu and a direct
      `/employees` request is denied or redirected.
- [ ] **Create employee — HR.** Open People → Add employee. Select department and matching team, employment type,
      date-only employment fields, and both policies. Confirm one-time credentials, forced password change, team
      membership, history, leave accounts, and audit. Try a team from another department and expect validation.
- [ ] **Transfer — HR.** Open a member profile → Transfer team. Select department, matching team, and reason. Confirm the
      old task workspace disappears, the new one becomes accessible, employee ID stays unchanged, and history is added.
- [ ] **Department leadership — Managing Director/HR.** Assign an eligible team member as department Senior Director.
      Confirm the prior Senior Director returns to that team as a member and the department remains with exactly one
      active Senior Director.
- [ ] **Team leadership — Senior Director.** In Department, assign an eligible member as Account Director. Confirm the
      prior Account Director becomes a member and the team retains exactly one active leader.
- [ ] **Member leave.** Alex files leave. Confirm Jordan acts first, Sidney second, and Morgan last. Try later approvers
      early and expect denial. Verify reserved then used balances and the timeline.
- [ ] **Non-HR leaders.** Jordan files leave and routes Sidney → Morgan. Sidney files leave and routes to Morgan only.
- [ ] **HR chain.** Riley files leave and routes Taylor → Hayden. Taylor routes to Hayden. Hayden routes to Avery.
- [ ] **Managing Director leave.** Avery files leave and receives immediate approval with no approval step.
- [ ] **Cancellation.** Cancel Pending leave and confirm immediate release. Cancel future Approved member leave and
      complete the copied Account Director → Senior Director → HR chain; confirm used days reverse only at the end.
- [ ] **Overview and calendar.** Compare Avery/authorized HR organization data, Sidney department data, Jordan team
      dashboard plus department calendar, and Alex personal calendar. Verify only Approved leave is shown.
- [ ] **Policies.** On Regular leave, Create opens regular fields. On Christmas, the same Create control opens Christmas
      fields. Create versions, assign next-year policies, and confirm old requests retain their original calculation.
- [ ] **Tables and My Tasks.** Activate each sort header, reverse direction, search, filter, page, and clear filters. Check
      focus states and empty/error/loading states.
- [ ] **Responsive/browser.** Verify Overview, Organization, Department, People, Approvals, Calendar, My Tasks, and Team
      Boards at 375, 599/600/601, 768, 899/900/901, 1199/1200/1201, 1440, and 1535/1536/1537 pixels. Confirm no document
      overflow, contained wide surfaces, complete mobile navigation, keyboard access, and no console errors.

## Automated evidence

`yarn test:integration` resets only the dedicated `tms_test` database and covers hierarchy constraints, every approval
chain, ordered decisions, cancellation, ledger accounting, lifecycle, authorization, privacy, task scope, and reporting.
`yarn test:e2e:chromium` covers affected browser flows and breakpoint boundaries. `yarn test:e2e:browsers` repeats the
critical journey in Chromium, Firefox, and WebKit. `yarn demo:e2e` runs the full organization and leave/task story in one
headed Chromium page.

This prototype still requires production secrets, HTTPS, SSO/MFA decisions, approved retention and privacy procedures,
monitoring, shared rate limiting, backup rehearsal, and independent security review before production deployment.
