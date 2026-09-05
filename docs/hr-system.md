# HR & Organization Foundation

This document is the authoritative business specification for the Northstar People prototype. It implements one
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

## Future improvements / production hardening

Future work includes MFA/SSO and recovery links, user-facing session management, rehire, multiple directors or
memberships, delegation/reassignment, partial-day leave, proration/carry-over, more leave types and calendars, medical
documents, retention/anonymisation and data-subject workflows, exports, email/SMS, distributed jobs and throttling,
advanced observability, calendar integrations, and backup/restore drills.
