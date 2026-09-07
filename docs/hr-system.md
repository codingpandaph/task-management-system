# HR & Organization Foundation

This document is the authoritative business specification for the CPPinSync prototype. It implements one
organization, one PostgreSQL database, dynamic departments, employee identity, employment lifecycle, permission-based
administration, annual leave, reporting, notifications, and append-oriented audit history. Task Management is a future
module that may reuse these foundations but has no schema, API, or UI here.

## Identity and access

Employees sign in with an immutable business ID and password. IDs have the form
`<London creation year>-<department code at creation>-<global sequence padded to six digits>`. The PostgreSQL sequence
is global, bounded, concurrency-safe, permits rollback gaps, and never recycles values. Transfers and department edits
cannot change an issued ID.

HR creation returns a cryptographically random temporary password once with `Cache-Control: no-store`. Only its bcrypt
hash is stored (12 rounds by default). First-use accounts may access session information, CSRF, refresh, password
change, and logout only. Passwords are 15 or more characters and at most 72 UTF-8 bytes; spaces and paste are allowed.
Reset revokes all sessions and restores mandatory password change.

Access JWTs last 10 minutes and contain only employee ID, session ID, standard times, issuer, and audience. A session
lasts at most seven days. Its random refresh credential is stored only as a SHA-256 digest and rotates atomically.
Reuse of a consumed credential revokes that session. Credentials use host-only HTTP-only cookies, `SameSite=Lax`, and
`Secure` in production. Authenticated cookie mutations require a session-bound CSRF token, a trusted exact Origin, and
the JSON web-client header. Every protected request verifies the session plus current employee and employment
eligibility. Login errors are generic and unknown IDs still perform a dummy bcrypt comparison.

The prototype has process-local login and refresh throttling. A multi-instance deployment must replace it with shared
rate limiting. Concurrent refreshes are serialized in the browser; an exceptional refresh replay can require sign-in.

## Organization and authorization

Every employee has one primary department and one fixed organizational position: Member, Account Director, or Senior
Director. HR is a typed department and Leadership is a small normal department. There is at most one active Senior
Director and one active Account Director per department. An Account Director belongs to the department they manage.
Departments may be created without a manager, but dependent leave requests cannot be submitted until one is assigned.

Positions and application permissions are independent. The API reads current grants from PostgreSQL, never from JWT
claims. Guards enforce authentication, forced-password restrictions, positions, capabilities, department scope,
request ownership, approval assignment, and state transitions. Ordinary directory output contains employee ID, display
name, department, and position. DOB, employment details, status reasons, and leave reasons require separate access.

The Senior Director governs privileged assignments. HR permission administrators may delegate only employee basic
read/update, department create/update/member assignment, and reporting read; the delegator must hold the permission and
the recipient must be eligible HR staff. HR cannot delegate confidential data, employment/status, password reset,
leave administration/approval, audit, leadership, or permission-management powers. Nobody may grant or revoke their
own permission. Leadership and permission changes are transactional and audited.

Senior Director replacement and Account Director replacement demote the former holder, promote the successor, update
history, and audit one transaction. Removing the final eligible Senior Director requires an atomic successor. Security
eligibility still wins: an expired or suspended director loses access, and a returning director cannot displace a
replacement. Department deactivation is blocked while staff or unresolved workflow responsibilities remain.

## Employment lifecycle

Employment records are effective-dated and preserve full-time, contractual, and probationary history. Full-time has no
required end; contractual has an inclusive end date; probationary has a review date. A contract loses access at the
start of the next London calendar day. An overdue probation review creates reporting work and does not deactivate the
employee. Renewal does not reactivate an explicitly inactive employee.

Allowed account transitions are Active to Suspended, Inactive, or Terminated; Suspended to Inactive or Terminated;
Inactive to Active or Terminated. Terminated is terminal in this prototype. Suspension needs a reason and future end;
expiry restores Active only when the prior state was Active and no later blocking condition or leadership conflict
exists. Suspension, deactivation, termination, contract expiry, and password reset revoke sessions immediately.
Eligibility is reconciled on request and by an idempotent one-minute job. History remains when an approver leaves;
pending workflows are shown as blocked rather than silently reassigned.

## Policies, calendar, and balances

Regular policy supplies 25 vacation and 5 sick days; Christmas policy separately supplies 5 days. Policies are
append-versioned, and annual employee assignments retain an immutable version. New assignments require active policies.
Reassignment after a year starts applies next year; changing current-year entitlement requires a reasoned HR ledger
adjustment. There is no proration, carry-over, overdraft, partial day, or hourly leave.

The annual ledger is authoritative. Available days equal entitlement minus reserved minus used. Submission reserves;
rejection or pending cancellation releases; final approval moves reserved to used; Senior Director auto-approval uses
directly; approved cancellation reverses used. Administrative adjustments change entitlement. Corrections reverse the
original and post the corrected charge atomically. Unique posting keys, employee/account locks, and bounded transaction
retries prevent duplicate or overspent entries.

Dates are `YYYY-MM-DD`, evaluated in Europe/London. Chargeable dates are Monday through Friday excluding the checked-in
England and Wales GOV.UK bank-holiday snapshot. Submission requires calendar coverage and snapshots its chargeable
dates. Requests with no working day, crossing a year, outside eligible employment, overlapping Pending/Approved leave,
or unaffordable balances are rejected. Normal staff cannot submit past-start requests. Christmas Vacation must be
wholly in December. Submitted dates/type are immutable; cancel and resubmit to change them.

## Approval and cancellation

| Requester               | Ordered approval chain                               |
| ----------------------- | ---------------------------------------------------- |
| Non-HR Member           | Department Account Director → designated HR approver |
| Non-HR Account Director | Senior Director → designated HR approver             |
| Senior Director         | Auto-approved                                        |
| HR Member               | HR Account Director                                  |
| HR Account Director     | Senior Director                                      |

The designated final HR approver is one active HR employee with `LEAVE_HR_APPROVE`; a grant alone does not select them.
Submission locks the employee and annual account, validates the request, resolves concrete non-self approvers,
snapshots ordered steps, posts the reservation/use, and creates audit/notifications in one transaction. Snapshots do
not change after manager changes, but an assignee must remain currently eligible to act. Actions enforce assignment,
sequence, state, and optimistic conflicts; rejection requires a reason.

Pending self-cancellation releases reservation immediately. Approved future leave creates a separate cancellation and
copies the original chain; the original remains approved and charged until final cancellation approval. An empty
original chain cancels immediately. Rejection leaves the original intact. Once leave begins, normal completion is
blocked and HR must correct it. `LEAVE_ADMIN` may create immediate approved entries, adjustments, or corrections with
a mandatory reason, but cannot target the acting administrator. No leave or ledger history is deleted.

## Privacy, reporting, and audit

Directory access is organization-wide. An ordinary calendar viewer sees only names, departments, and absence dates for
their department. Senior Director and authorized HR reporting users can view wider scope. Manager DTOs exclude DOB,
employment/status reasons, leave type, and leave reason. Sick reason is optional and the UI discourages diagnosis-level
detail. Notifications carry safe summaries and protected links. Audit metadata is allowlisted and excludes credentials,
cookies, health narratives, and restricted reasons. Business audit and notification writes share the business
transaction.

HR reporting shows active headcount, department/employment groups, pending leave, current absences, suspensions,
contract deadlines, probation reviews, and aggregate usage. Authorized audit reads are paginated. APIs use allowlisted
pagination (20 default, 100 maximum), stable safe errors and request IDs, and explicit response projections rather than
raw employee serialization.

Actual production worker-health processing requires an employer-approved UK GDPR lawful basis and applicable
special-category condition. The prototype deliberately sets no invented legal retention period and implements no
automatic deletion, subject-access tooling, or legal certification.

## Complete system flows

The following journeys describe every interactive flow currently exposed by the portal and REST API. Each mutation is
authenticated, origin-checked, CSRF-protected, validated through a DTO, authorized against current database state, and
audited where it changes business state.

### 1. Sign in and session lifecycle

1. The employee opens `/login` and enters an Employee ID and password.
2. The API normalizes only the Employee ID, performs the credential and current eligibility checks, and creates an
   authoritative session with access and refresh cookies.
3. The portal loads `/auth/me` and builds navigation from the employee's current permissions.
4. When access expires, the browser performs one serialized refresh, rotates the opaque refresh credential, and retries
   the request once. A consumed credential replay revokes the session.
5. Sign-out revokes the current session, clears both cookies and private in-memory browser state, and returns to login.
6. Suspension, deactivation, termination, contract expiry, password reset, or password change also revokes affected
   sessions. The next protected request is denied.

### 2. First login and password reset

1. HR creates an employee and receives the generated Employee ID and random temporary password in a transient dialog.
2. The employee signs in with those one-time credentials and is routed to `/change-password`.
3. All directory, HR, leave, approval, reporting, notification, and audit endpoints remain forbidden until completion.
4. The employee supplies the temporary password and a valid new password. The API replaces the hash, clears the forced
   change flag, revokes earlier sessions, and issues a fresh unrestricted session.
5. An authorized HR user can later reset the password with a reason. A new temporary password is shown once and the
   same forced-change flow repeats.

### 3. Employee creation and administration

1. An authorized HR user opens `/employees`, filters or pages through employees, and submits identity, birth date,
   department, employment type/dates, and current leave/Christmas policy versions.
2. In one transaction the API allocates the immutable ID, stores the bcrypt hash, creates the employee, effective
   organization and employment history, annual policy assignments, audit event, and one-time credential response.
3. HR opens `/employees/:id` to update basic information with optimistic version checking. Confidential fields appear
   only when the viewer has their dedicated permission.
4. HR may transfer a Member to an active department with a reason. Membership history closes and reopens without
   changing the Employee ID.
5. HR may append full-time, contractual, or probationary employment records. The previous current record closes and
   historical records remain available through the employee employment endpoint.
6. Authorized users may view current grants, grant allowed capabilities, or revoke them. The API prevents self-change,
   invalid HR delegation, and privilege escalation.

### 4. Account and employment status

1. HR suspends an Active employee with a restricted reason and future end instant. Sessions revoke immediately.
2. Request-time and scheduled reconciliation restore Active only when the prior state and current employment permit it.
3. HR can deactivate an Active or Suspended employee, reactivate an eligible Inactive employee explicitly, or terminate
   an Active, Suspended, or Inactive employee. Termination cannot be reversed in this prototype.
4. Contractual access expires after the inclusive London end date. A later renewal does not override an administrative
   Inactive state. Probation review dates create reminders but do not remove access.
5. Status and employment changes retain their actor, effective time, and reason in restricted history and audit data.

### 5. Department and leadership administration

1. Authorized HR opens `/organization`, creates a normalized unique department code, and edits its name/description.
2. A department may remain without an Account Director and is visibly incomplete; dependent leave submissions fail
   safely until leadership is assigned.
3. Account Director assignment validates active employment and membership, atomically demotes any previous holder,
   promotes the replacement, writes organization history, and audits the change.
4. The Senior Director may atomically appoint a successor and designate the final active HR leave approver.
5. Department activation is explicit. Deactivation is refused while active/suspended employees or unresolved approval
   responsibilities remain; HR transfers staff and resolves workflows first.
6. `/organization` and `/directory/employees` provide the organization-wide minimal hierarchy without confidential data.

### 6. Leave and Christmas policy administration

1. Authorized HR opens `/policies` and creates a regular leave policy or independent Christmas policy.
2. Editing creates the next immutable version. Existing employee-year assignments continue to reference the old version.
3. HR can mark a policy Active or Inactive. Inactive versions remain readable historically but cannot be newly assigned.
   The policy catalogue exposes **New version** and **Make inactive/Activate** controls on each policy card.
4. From an employee record, HR assigns a concrete regular and Christmas version for a future leave year.
5. Current-year changes use the separate audited balance-adjustment flow; policy reassignment does not rewrite posted
   entitlement.

### 7. Balance creation and viewing

1. The employee opens `/leave`; the API creates the employee-year and Vacation, Sick, and Christmas Vacation accounts
   on demand when missing.
2. Immutable annual entitlement postings are created once from the assigned policy versions.
3. Each balance is derived from ledger totals and displays entitlement, reserved, used, and available days.
4. Repeated account creation or operation IDs return the existing result and cannot duplicate entitlement or postings.

### 8. Drafting and filing leave

1. The employee selects Vacation, Sick, or Christmas Vacation, date range, and an optional reason.
2. Preview calculates advisory working days using the London calendar, weekends, and checked-in holidays.
3. Saving creates a Draft, which may be edited without reserving days.
4. Filing the Draft supplies a unique operation ID. The API locks the employee/account and validates employment dates,
   calendar coverage, working days, past dates, year boundary, December-only Christmas, overlap, and affordability.
5. The API snapshots chargeable dates and the exact approval chain. It then reserves the balance, or records used days
   immediately for Senior Director auto-approval, and creates audit and notification records atomically.
6. Filed dates and leave type cannot be edited. The employee cancels and creates a new request when those must change.

### 9. Reviewing and deciding leave

1. An approver opens `/approvals` to see currently assigned request and cancellation steps.
2. Opening a request shows the employee, dates, optional permitted reason, status, ordered timeline, and whether each
   snapshotted assignee remains eligible.
3. Approve/reject locks the request and account, verifies the actor, eligibility, sequence, and current state, then
   updates the step, workflow, ledger, audit, and notifications in one transaction.
4. Intermediate approval activates the next step. Final approval moves reserved days to used. Rejection requires a
   reason, terminates the workflow, and releases reserved days.
5. Duplicate, stale, wrong-actor, and out-of-order decisions return conflicts. An ineligible snapshot remains visible as
   blocked and is never silently reassigned.

### 10. Cancelling leave

1. Cancelling Draft or Pending leave immediately marks it Cancelled and releases any reservation.
2. Cancelling future Approved leave creates a separate Pending cancellation and copies the original approval chain.
3. The original request remains Approved and charged while cancellation approval is pending.
4. Final cancellation approval marks the original Cancelled and reverses used days. Rejection leaves the request and
   charge unchanged. Auto-approved leave with no chain cancels immediately while still future-dated.
5. When leave has started, normal cancellation completion is refused and HR uses the correction flow.

### 11. HR leave administration and corrections

1. An authorized HR user opens `/hr` to view employee leave records and balances.
2. HR may post an immediate Approved administrative leave entry with employee, type, dates, mandatory reason, and
   operation ID. Normal approval is bypassed and the source remains visibly Administrative.
3. HR may adjust an employee's annual entitlement up or down with a mandatory reason; an adjustment that would produce
   negative availability is rejected. Retrying the same operation ID cannot post twice.
4. To correct existing leave, HR supplies corrected dates/type and a reason. The API reverses the original charge and
   posts the corrected charge atomically, retaining both request and ledger history.
5. HR cannot create administrative leave, corrections, or adjustments for themselves.

### 12. Who's Out calendar

1. The employee opens `/calendar`, navigates months, returns to today, and views accessible calendar and compact list
   presentations.
2. Ordinary employees receive only Approved absences in their own department. Senior Director and authorized HR may
   request a broader or department-filtered view.
3. Entries disclose name, department, and absence dates only. Leave type and reason never appear.
4. The layout switches between month grid and list presentation across mobile, tablet, and desktop breakpoints without
   horizontal page overflow.

### 13. HR dashboard and reminders

1. Authorized HR users land on dashboard aggregates for active staff, departments, employment types, Pending leave,
   current absences, suspensions, and used days.
2. Contract expiry and probation review lists show upcoming operational work without exposing restricted status reasons.
3. The scheduled reminder pass finds relevant employment records and creates deduplicated notifications for active HR
   users with employment-management permission.

### 14. Notifications

1. Each employee opens `/notifications` to receive their own paginated, newest-first items.
2. Workflow events create safe titles/messages and protected resource references rather than copying confidential text.
3. Mark-read updates only a notification owned by the current recipient. Accessing another recipient's ID behaves as an
   inaccessible resource.

### 15. Audit review

1. A user with `AUDIT_READ` opens `/audit` and pages through immutable business events.
2. Entries show actor identifier, action, target type/identifier, time, request ID when present, and allowlisted metadata.
3. Audit rows cannot be updated or deleted. Passwords, refresh/access credentials, cookies, DOB, health narratives, and
   restricted employment/status reasons are excluded.

### 16. Error, retry, and privacy behavior

1. APIs return `401` for missing/invalid sessions, `403` for capability denial, `404` for inaccessible resources,
   `409` for stale or conflicting transitions, and `422` for business-rule rejection.
2. Responses carry a stable safe message and request ID. Lists use server pagination with 20 default and 100 maximum.
3. Editable resources use optimistic versions. Ledger-style mutations use actor-scoped operation IDs.
4. The frontend displays safe form errors, performs at most one authentication refresh/retry, and does not automatically
   replay an unsafe mutation that lacks an operation ID.
5. Successful form mutations close their focused dialog and display a global, screen-reader-visible success message.
6. No password hash, token, credential, confidential reason, or raw Prisma Employee object is returned through public
   projections, notifications, audit metadata, or structured logs.

## Manual acceptance checklist

Start with `yarn dev:fresh`, open `http://localhost:3000`, and use the fictional credentials in README. Check each row
in order; created names should include a unique suffix so repeated retained-data runs remain clear.

| Flow                     | Role and prerequisites                    | Manual steps                                                                                                                  | Expected result                                                                                                   | Playwright coverage                                            |
| ------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Authentication           | Any seeded employee                       | Sign in, refresh the page, then sign out                                                                                      | Session survives refresh; sign-out returns to login and protected URLs reject access                              | `smoke.spec.ts`, session flow                                  |
| First login              | HR creates an employee                    | Copy the one-time credentials, sign out, sign in as the employee, change password                                             | Only password change is available until success; temporary password disappears after dismissal                    | onboarding flow                                                |
| Directory                | Any employee; HR for private view         | Open People, search a full name, combine department/role/status filters                                                       | Results match all filters; ordinary users never see confidential fields or HR actions                             | HRIS navigation flow                                           |
| Employee profile         | HR with employee permissions              | Open a person and visit Overview, Employment, Leave Policies, Access & Security                                               | Each tab shows relevant facts and permitted actions; employment history and current permission grants are visible | HRIS navigation and management flows                           |
| Departments              | HR with department permissions            | Create, edit, deactivate, reactivate, and assign a director; try deactivating a staffed team                                  | Valid changes persist; staffed-team deactivation is rejected with a safe conflict                                 | demo and management flows                                      |
| Employment               | HR with employment permission             | Review the visible timeline, then add a contractual record with an inclusive end date                                         | Previous record closes; the current record appears first and history remains visible                              | browser, management and lifecycle flows                        |
| Permissions              | Senior Director or permitted HR delegator | Grant then revoke an allowed permission; attempt self-grant                                                                   | Grant state changes and audits; self-escalation is denied                                                         | management and authorization flows                             |
| Lifecycle                | HR with status permission                 | Suspend, deactivate, reactivate, reset password, then terminate a fixture                                                     | Sessions revoke immediately; reactivation requires Inactive; termination is final                                 | lifecycle and authentication flows                             |
| Policies                 | HR policy manager                         | Create/version/disable/enable regular and Christmas policies; assign next year                                                | Versions remain immutable; inactive policy cannot be assigned; current year is unchanged                          | demo and management flows                                      |
| Balances                 | Any employee                              | Open My Leave and inspect entitlement, used, reserved, available, and utilization bar                                         | Ledger-derived numbers reconcile and repeated loads do not duplicate entitlement                                  | leave and ledger flows                                         |
| File leave               | Any eligible employee                     | Preview dates, save a draft, open and edit it, then submit; try weekend-only, overlap, cross-year, and non-December Christmas | Valid request snapshots working days and approvers; invalid requests show safe validation errors                  | browser draft flow, demo, matrix, date integration flows       |
| Approvals                | Assigned approver                         | Search the inbox, open a request, approve or reject with a reason                                                             | Only current assigned step can act; final decision updates balance and timeline                                   | five-chain matrix and inbox flows                              |
| Cancellation             | Request owner and original approvers      | Cancel Pending leave; request cancellation of future Approved leave; approve/reject cancellation                              | Reservation releases immediately for Pending; Approved charge changes only after final cancellation approval      | five-chain matrix and demo flows                               |
| HR leave                 | HR with leave administration              | Add administrative leave, use **Correct** on its row, and post the same adjustment operation twice                            | Entry approves immediately; correction reverses atomically; retry posts once                                      | browser correction, administration and idempotency flows       |
| Calendar/dashboard       | Employee and authorized HR                | Change month, filter department, return to Today, inspect metrics and alerts                                                  | Calendar exposes only names/departments/dates within scope; metrics and reminders load                            | responsive calendar and reporting flows                        |
| Notifications/audit      | Recipient; user with audit permission     | Filter All/Unread notifications, follow and mark an item read; search audit by action or target                               | Only owned notifications change; audit stays immutable and contains no credentials or restricted narratives       | browser review, management reads and privacy integration flows |
| Responsive/accessibility | Any role                                  | Repeat login, leave modal, directory, and calendar at 375, 599/600/601, 899/900/901, 1199/1200/1201, and 1440 px              | No page overflow; navigation, dialogs, forms, tags, and keyboard actions remain usable                            | breakpoint Playwright flows                                    |

The cross-browser acceptance layer also runs automated axe checks on login and authenticated People views in Chromium,
Firefox, and WebKit. It verifies the critical navigation path at 375, 900, and 1440 pixels in each engine and compares
the login and People surfaces with browser-specific visual regression baselines.

Automated browser scenarios live in `tests/e2e`. PostgreSQL integration tests provide the deeper concurrency, immutable
ledger/audit, date-boundary, replay, and privacy assertions that are impractical to demonstrate visually. Both suites
reset only the guarded `tms_test` database: Playwright uses seven limited users, while integration tests request the full
lifecycle fixture set needed for contractual and probationary assertions.

## Future improvements / production hardening

Future work includes MFA/SSO and recovery links, user-facing session management, rehire, multiple directors or
memberships, delegation/reassignment, partial-day leave, proration/carry-over, more leave types and calendars, medical
documents, retention/anonymisation and data-subject workflows, exports, email/SMS, distributed jobs and throttling,
advanced observability, calendar integrations, and backup/restore drills.

Prisma 7.10’s PostgreSQL adapter currently emits a `client.query()` deprecation warning from its internal query call on
some transactional writes. The verified operations complete correctly; reassess the upstream adapter fix before moving
to `pg` 9 rather than hiding the warning or weakening transaction coverage.
