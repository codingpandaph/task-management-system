# Task Management System

This is the authoritative product, engineering, and manual acceptance guide for CPSync Task Management. It answers
Simon's brief: demonstrate a credible system for one department led by one Senior Director, with two Account Directors
and two teams of 15, while giving each employee an individual view, each director a team workspace, and the Senior
Director a top-level delivery view. The richer rules below are CPSync design decisions; they are not additional
requirements attributed to Simon. The 30–45 minute meeting duration does not constrain this implementation.

The full development seed interprets “15 people underneath” literally: Client Services and Marketing each contain one
Account Director plus 15 members. Together with one Senior Director, Simon's core operating shape contains 33 people.
Human Resources is the third department and is additional to that core headcount. The Senior Director sits above the
department structure with organization-wide scope and does not consume a place in any team or HR headcount.

## Product model

CPSync uses the existing HRIS employee, department, position, account-status, leave, notification, and session data.
The shared RBAC model gives Members personal and department-scoped work, Account Directors management of their own
department workspace, HR roles only their applicable people-operation capabilities, and the Senior Director full task
and organization access. UI visibility mirrors the effective capability set, while API resource policies enforce the
department and assignment boundary on every operation.
Restricted task routes use the shared access-denied recovery screen. Cross-department assignment still requires an
authorized milestone window, and management actions remain scoped to the Account Director’s department unless the
actor is the Senior Director.
Shared navigation and action styling guarantees white text on evergreen primary buttons, including buttons rendered as
links. Task and HRIS surfaces use the same contrast rule and responsive action hierarchy.
Consequential workflow dialogs use explicit, outcome-labelled actions rather than hiding decisions in generic selects;
this shared interaction rule applies to both people operations and delivery work.
There is no second user directory. An active employee can be a reporter, an optional single assignee, and a workspace
member. A terminated employee cannot retain active assignments. The relational model supports Simon's fixed
demonstration hierarchy without hard-coding a headcount ceiling.

The three primary experiences are:

- **My tasks:** one employee's assigned work across every accessible workspace.
- **Team boards:** department-scoped Kanban, Scrum, and List boards for shared planning and execution.
- **Delivery reports:** team summaries for Account Directors and cross-team summaries for the Senior Director.

Position-derived access gives Account Directors and the Senior Director task and board creation automatically. A
director can grant or revoke **Create tickets** and **Create boards** independently for a base workspace member.
Members may assign tasks to themselves or another active employee in their department; cross-team assignment is
rejected. The Senior Director can see and manage every workspace and receives
escalated-task notifications. Every API checks current HRIS eligibility and the current membership grant. The Next.js
server route gate omits unauthorized task destinations and redirects direct restricted URLs before their screen
components mount; backend role, permission, and department checks remain authoritative.

## Workspaces and adaptive templates

One department owns at most one task workspace. Provisioning copies tailored boards and columns; later edits do not
mutate the template catalogue.

| Department function        | Provisioned views         |
| -------------------------- | ------------------------- |
| Engineering / Product      | Kanban, Scrum, and List   |
| Marketing / Creative       | Campaign Kanban and Scrum |
| Sales / Account Management | Client-delivery Kanban    |
| HR / Operations            | People-operations List    |
| Finance / Legal            | Request List              |

Boards have ordered, user-defined columns. One column is initial. Columns may represent completion and may require
management sign-off. Moving a card changes its workflow state. The limited E2E seed contains Client Services and
Marketing workspaces with a compact shared four-column board so tests remain fast and deterministic.

## Tasks, estimates, and completion

Every workspace allocates its own monotonic task number while holding the workspace row in a serializable transaction.
The public reference is `<workspace code>-#<number>`, such as `ACC-#24`. Numbers remain unique during concurrent creates
and gaps are harmless.

A task has a title, Markdown-compatible description, Low/Medium/High priority, nonnegative estimated hours, one required
reporter, zero or one active assignee, board column, optional milestone/sprint/due date, links, comments, sign-off,
escalation, and archive state. Eight stored hours equal one work day; `12` renders as `1d 4h` in capacity. The backend
always records the authenticated creator as reporter; neither create nor edit accepts reporter selection.
Descriptions have a live and detail-page preview for headings, lists, bold text, inline code, and secure web links. The
renderer creates React elements, never executes embedded HTML, and accepts only `http` or `https` links.

Board cards and reports use short one-word pills such as **High**, **Signed**, **Escalated**, and **Progress**. Counts use
adjacent numerals so the tag itself remains one word. The underlying complete value remains available as the pill title.
My tasks can be filtered by text, workflow status, and priority. Team boards add assignee filtering, including an
explicit Unassigned view, while Delivery reports can be searched by department name or code. Board search is named for
the selected board and searches only that board. Actions, board navigation, search, filters, milestones, and columns sit
inside one active workspace surface, so users do not hunt across detached action panels. Every filter group has a
single clear action and a useful no-results state. My Tasks and Delivery Reports follow the same pattern rather than
placing search controls between unrelated panels. Changing workspace, board, or tab clears filters that no longer
describe the visible data. Initial load failures show the safe API message with a Retry action.
Permission failures use role-based business language and never expose internal authorization or request terminology.
Board cards do not repeat drag instructions or show directional arrows. Pointer users drag cards; the task detail’s
labelled status selector provides keyboard and assistive-technology movement through the same protected endpoint.
On phones, My tasks, Team boards, Delivery reports, and Task archive remain available in the complete role-aware menu
rather than a partially visible horizontal navigation strip.
Task surfaces share the global design tokens and are covered by `yarn design-check`, including Kanban columns, task
cards, milestone controls, semantic tags, focus states, and responsive navigation.

The former completion-checklist table remains only for historical compatibility and is absent from active DTOs,
endpoints, forms, and workflow gates. A management-locked column requires Account Director or Senior Director sign-off.
Sign-off does not itself move the task, preserving a visible separation between authorization and workflow.

## Dependencies, escalation, and milestones

Tasks may block, be blocked by, or relate to another task. A blocked task cannot leave its initial lane until every
`BLOCKED_BY` target is complete. The link endpoint traverses the dependency graph and rejects a cycle with HTTP 422.
Database constraints also reject self-links.

An Account Director can escalate a team task; a Senior Director can escalate or clear any task. Escalation creates one
deduplicated notification for the active Senior Director and appears in leadership reporting. Automatic overdue-blocker
escalation is reserved for production hardening because it needs an agreed reminder and acknowledgement policy.

Delivery reports give the Senior Director an immediate portfolio comparison: completion percentage, open and blocked
work, escalations, and capacity risks. Each team card then shows workflow distribution, unassigned work, open estimates,
milestones, and the five highest active workloads by employee. Account Directors receive the same detail for their own
department. Task detail renders the immutable activity ledger as a readable actor/action/change timeline.

Milestones define a goal, start date, due instant, Open/Closed state, and overcapacity flag. Closing a milestone moves
unfinished tasks to the next chronological open milestone in the same workspace, or removes the milestone when no next
cycle exists. Completed tasks retain their historical milestone.

## Capacity and HRIS lifecycle integration

Milestone capacity is calculated from active department employees plus explicit milestone memberships:

`available hours = active collaborators × business days × 8 − approved leave days × 8`

Business days use the HRIS England and Wales calendar. Approved `LeaveRequestDay` records deduct eight hours. Planned
hours are estimates of unfinished, non-deleted milestone tasks. Results include collaborators, business days, leave,
An explicit milestone membership can add an employee from another department for an effective window. During an
overlap, the employee is removed from home-team milestone capacity and added to the borrowing milestone, shifting the
full eight-hour daily contribution without duplicating capacity.

When HR terminates an employee, the same transaction finds incomplete assigned tasks, clears the assignee, returns each
card to its board's initial column, writes task activity, removes future capacity through the inactive HRIS state, and
flags affected milestones for review. No task or history is deleted. Suspension and temporary inactivity block access
and new assignment but deliberately do not rewrite ownership.

## Deletion, restoration, and activity

Delete is reversible. Standard reads filter `isDeleted=true`; deletion stores the last column and timestamp. The
workspace manager may restore the task to that column. `TaskActivityLog` records creation, field changes, column moves,
deletion, and restoration with actor, task, field, old value, new value, and timestamp. PostgreSQL prevents updates or
deletes to this log. Comments and task changes also emit activity entries.

## REST API

| Area          | Endpoints                                                                      |
| ------------- | ------------------------------------------------------------------------------ |
| Workspaces    | `GET/POST /api/task-workspaces`, board, membership, and milestone creation     |
| Boards        | Board read/create, department collaborators, and Scrum sprint actions          |
| Personal work | `GET /api/tasks/mine`                                                          |
| Tasks         | `POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/:id`, restore and move actions |
| Collaboration | Comments and dependency links under `/api/tasks/:id`                           |
| Governance    | Management approval and escalation actions under `/api/tasks/:id`              |
| Milestones    | Close and capacity endpoints under `/api/milestones/:id`                       |
| Reporting     | `GET /api/tasks/reporting` scoped by current HRIS position                     |

Department settings are available through `GET /api/departments/:id` and
`PATCH /api/departments/:id/task-settings`. Board collaborators use
`POST /api/task-boards/:id/collaborators`; Scrum uses board sprint creation plus explicit activate and complete actions.

## Current department workflows

- **Kanban** is continuous flow with To do, In progress, Review, and Done. Board cards move by drag and drop; the task
  detail status selector keeps movement keyboard accessible. The API validates every move.
- **Scrum** adds Backlog and time-boxed sprints. A sprint requires a name, goal, start date, and later end date. A board
  may have only one active sprint, and completed sprints cannot be reopened. Tasks can be created and edited with a
  current sprint and due date; completed sprints reject new task assignments while retaining their history.
- **List** renders a table with title, status, assignee, reporter, priority, and due date. It has no columns or sprint UI.
  The existing Human Resources department has List enabled and is not duplicated.

Each department selects one or more supported workflow types. Board creation offers only those values and the API rejects
an unsupported type. The board creator is recorded automatically. Collaborators are active employees from the board’s
department and do not inherit board or task creation permissions.

## Kanban WIP rule

`kanbanWipLimit` is one department setting named **Maximum in progress tasks per member**. It is never configured per
employee and is not a shared department pool. The API counts each assignee’s active, non-archived Kanban tasks in the
column whose stable meaning is In progress. Display labels may change without disabling the rule. Unassigned work
consumes no person’s capacity. Moving work out, or archiving it, immediately frees a
slot. Moving into In progress, assigning an unassigned In progress task, and reassigning In progress work all check the
new assignee.

The transaction locks the assignee’s employee row before counting and writing. Concurrent requests for the same person
therefore serialize around the same lock, while different people retain independent capacity.

Board collaboration grants board discovery, reading, commenting, status movement, and assigned-work participation. It
does not grant task or board creation. Directors can see their department’s boards; other employees see boards they
created, were explicitly added to, or joined automatically when work was assigned to them. Every board and task detail
request repeats this policy, so a guessed identifier does not reveal another board.

## Task identity, assignment, and archive

Assignee is optional and any selected employee must be active in the task’s department. The backend derives reporter from
the authenticated creator and does not accept reporter selection or editing. The former Completion Checklist relation is
retained only for historical migration safety; active DTOs, endpoints, UI, completion gates, and seed data no longer use
it. Archive remains the existing reversible soft archive, preserves history and ownership, and excludes the task from
active views and WIP counts.

## 10–15 minute interview demo

1. **Senior Director (2 minutes):** Open Organization, review employee/department/board totals, Account Directors,
   workflow tags, and drill into Client Services. Explain organization visibility and department-scoped work.
2. **HR Director (1 minute):** Open Human Resources and its List board. Point out that HR already existed, keeps its
   capability-based administration, and remains blocked from Senior-Director-only governance.
3. **Account Director (2 minutes):** Open Department, set the Kanban limit to 2, enable Create boards and Create tasks for
   one member, and show another member without those permissions.
4. **Board controls (1 minute):** Create a board and show that Client Services offers Kanban and Scrum but not List. Add a
   collaborator and show that only Client Services employees appear.
5. **Task identity (1 minute):** Create an unassigned task with Markdown-style description and due date. Show the automatic
   reporter, then assign a same-department employee.
6. **WIP (3 minutes):** Drag two tasks for Alex into In progress, show 2/2, and demonstrate the third rejection. Move one
   task to Review and retry successfully. Move an unassigned task into In progress to show it consumes no personal slot.
7. **Scrum and List (2 minutes):** Create and activate a valid Scrum sprint, briefly show date validation, then switch to
   HR’s plain List table.
8. **Security and archive (1 minute):** Show an Account Director denied from another department, mention server-side
   assignee/collaborator/type/reporter checks, archive a task, and restore it from Task archive.
9. **Account and evidence (1 minute):** Open Password from the authenticated header, point out confirmation, then mention
   the PostgreSQL integration tests, Playwright role journeys, breakpoint loop, audit history, and UK GDPR projections.

All routes use the existing cookie session, CSRF protection, origin checking, DTO validation, and safe error envelope.
Inaccessible cross-department resources return Not Found where appropriate to avoid revealing their existence.

## Director-to-employee journey

1. Sign in as the Client Services Account Director and open **Team boards**.
2. Create a High-priority task with a description, estimate, and optional assignee.
3. Assign it to Alex Finch. The creator remains the default reporter, Jordan Ellis.
4. In a separate employee session, sign in as Alex and open **My tasks**.
5. Search for the assigned task, open it, confirm the assignee, reporter, priority, estimate, and description, then add a
   progress comment. Combine the High and To do filters, confirm the task remains visible, then clear all filters.
6. Move the task to **In progress**. The Account Director can reload the team board and see the same state and comment.
7. As Alex, move the task to **Review**.
8. As the Account Director, attempt **Done** and observe the management-sign-off requirement. Sign off, then complete
   the move.
9. Return to Alex’s **My tasks** and confirm the completed task remains visible with **Done** status for personal history.
10. Open **Delivery reports** as the Account Director and confirm Client Services reporting reflects current ownership
    and completion. Search by department, verify the no-results recovery state, then return to Client Services.

This journey uses independent browser contexts so the manager and employee each use their own authenticated permissions
instead of sharing state or impersonating one another.

## Complete manual acceptance checklist

Start with `yarn dev:fresh`, open `http://localhost:3000`, and use the fictional credentials in README. The limited test
seed uses the same key roles and resets `tms_test` before each Playwright layer.

For an automated visible tour, run `yarn demo:e2e:tasks`. Run `yarn demo:e2e` to include the HRIS setup and every leave
requester/approver perspective before the task journeys.

The verified baseline is 25 PostgreSQL integration scenarios, 21 full Chromium journeys shared with HRIS, and one
critical responsive/accessibility journey in each of Chromium, Firefox, and WebKit. Unit and tooling gates add 11
focused checks. Every browser layer begins from a fresh, limited `tms_test` seed.

The repository-wide ESLint configuration caps source and test files at 300 lines. Task-domain modules must use the same
responsibility-based split as HRIS services and browser scenario files.

| Flow                 | Role                         | Manual steps                                                                  | Expected result                                                         | Automated coverage                           |
| -------------------- | ---------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------- |
| Individual focus     | Member                       | Open **My tasks**, search by task key/title, open a card                      | Only assigned active work appears across accessible workspaces          | Playwright individual/team/reporting flow    |
| Create task          | Member                       | Open **Team boards**, choose **Create task**, fill the task details           | Card receives next workspace key and starts in initial lane             | Playwright creation; concurrency integration |
| Edit task            | Member                       | Open a card, choose **Edit task**, change core fields or active assignee      | Facts update immediately and activity records old/new values            | Playwright task journey; service integration |
| Manager handoff      | Account Director then Member | Create and assign work; employee opens it under My tasks and advances it      | Both sessions see one authoritative task, comment, workflow, and owner  | Playwright two-session assignment journey    |
| Discuss work         | Member                       | Open task, enter comment, press Enter                                         | Comment appears with author; activity appends                           | Playwright task journey                      |
| Director sign-off    | Member then Account Director | Member attempts locked Done; director signs off; member retries               | First move is rejected; signed-off move succeeds                        | Playwright two-session journey               |
| Dependencies         | Member                       | Make A blocked by B, advance A, then link B back to A                         | Blocker prevents movement; cycle returns 422                            | PostgreSQL integration                       |
| Escalation           | Account Director             | Open task and choose **Escalate**; Senior Director opens its notification     | Flag appears; unread count updates and the notification opens that task | Playwright deep-link and service integration |
| Team view            | Account Director             | Open **Team boards**, switch boards, search and drag a card                   | Search follows the selected board; the move persists                    | Playwright and authorization logic           |
| Workspace management | Senior/Account Director      | Provision workspace; create board/milestone; add a collaborator               | Correct templates and scoped management changes persist                 | Playwright director; template integration    |
| Delegate creation    | Account Director             | Grant a member ticket and board creation, then sign in as that member         | Member gains only the selected creation controls and API capabilities   | Playwright and PostgreSQL integration        |
| Reporter/assignment  | Member                       | Create a ticket, assign self/department colleague, and confirm the reporter   | Creator is the immutable reporter; selected colleague persists          | Playwright and PostgreSQL integration        |
| Leadership report    | Senior Director              | Open **Delivery reports** and compare portfolio and team workload cards       | Both teams show completion, blockers, risks, workflow, hours and load   | Playwright reporting/breakpoints             |
| Activity timeline    | Any task participant         | Open a task after creating, editing, moving, or assigning it                  | Actor, action, changed field, prior/new value and time remain readable  | Playwright journey and immutable ledger      |
| Capacity             | Director                     | Request capacity for milestone containing approved leave                      | Leave reduces available hours; planned work drives overcapacity         | PostgreSQL integration                       |
| Milestone rollover   | Account Director             | Create two milestones, assign work to first, close it                         | Incomplete work moves to next or becomes unbound                        | PostgreSQL integration                       |
| Soft delete/restore  | Reporter then manager        | Archive, verify hidden, restore                                               | Card returns to prior column; logs remain                               | PostgreSQL integration                       |
| Termination cleanup  | HR                           | Terminate employee with active assigned work                                  | Assignment clears, lane resets, milestone flags, logs remain            | PostgreSQL integration                       |
| Responsive board     | Any                          | Repeat task screens at 375, 599/600/601, 899/900/901, 1199/1200/1201, 1440 px | No page overflow; board scrolls by column; dialog remains usable        | Playwright breakpoint loop                   |

Task modules and browser scenarios follow the repository-wide 300-line limit. `yarn lint:common`, `yarn lint:js`,
`yarn lint:ts`, and `yarn lint:react` expose the shared correctness, language-specific, and React/Next.js checks used
by the strict `yarn lint` gate.

## Future improvements / production hardening

The concise cross-system launch checklist is maintained in the README under **Remaining work**. The items below retain
the Task Management detail needed for product and technical review.

- GitHub and GitLab integrations for Engineering/Product workspaces. Signed, idempotent webhooks would map issue,
  branch, pull-request, review, merge, and deployment events to explicit board transitions. Repository rules must never
  bypass DoD, blocker, or management gates; every automated move records the installation identity and delivery ID.
  Support repository-to-workspace mapping, task-key recognition, replay protection, rate limits, dead-letter review,
  and manual unlinking.
- Automatically escalate overdue blockers after product owners agree timing, notification, acknowledgement, and
  de-escalation rules.
- Add partial cross-team allocation percentages and a conflict visualization; the prototype shifts one employee's full
  daily capacity for overlapping milestone windows.
- Add board/column editing UI, saved filters, bulk triage, swimlanes, timeline and calendar rendering, recurring work,
  attachments, mentions, and richer CommonMark features when product demand justifies them.
- Add task activity and deleted-item browser screens, portfolio trends, throughput/cycle-time charts, forecast accuracy,
  exports, and configurable reporting periods.
- Add webhook/outbox delivery, shared rate limiting, distributed scheduling, tracing, backup/restore rehearsal, and
  organization-approved retention policies before production deployment.
