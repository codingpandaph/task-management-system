# CPSync task management

## Product acceptance target

Simon’s test asks for a Task Management System for a department led by one Senior Director, with two teams, an Account
Director for each team, and 15 members under each Account Director. Reviewers must see individual functionality, team
functionality, and top-level overview/reporting. CPSync demonstrates that exact shape in Client Services while also
showing that the same model supports multiple departments and a variable number of teams.

The full fixture contains:

- one Managing Director with organization-wide visibility;
- Client Services and Marketing, each with one Senior Director and two 15-member teams;
- one Account Director per team;
- Human Resources with one Senior Director and one editable team;
- one private task workspace per team.

The phrase “15 members” excludes the Account Director. Client Services therefore has 33 people: one Senior Director,
two Account Directors, and 30 members.

## Access model

| Person            | Workspace access                         | Management and reporting                                                            |
| ----------------- | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| Member            | Their team workspace                     | My Tasks; can comment and move team tickets; creates tasks/boards only when granted |
| Account Director  | Their team workspace                     | Team permissions, sign-off, capacity, archive, and one-team reporting               |
| Senior Director   | Every team workspace in their department | Department portfolio and every team report in that department                       |
| Managing Director | Every workspace                          | Organization portfolio across departments and teams                                 |
| HR employee       | Their HR team workspace                  | HR powers do not grant delivery access outside the HR team                          |

There is no collaborator or invitation concept. Active team membership grants normal board access. A stale workspace
membership cannot widen access beyond the employee’s current team. Assignment, mentions, saved views, bulk changes,
capacity, archives, and reports use the same server-side boundary.

Create Tasks and Create Boards are independent membership permissions. Account Directors, the department Senior
Director, and the Managing Director have both capabilities by role. A permitted member remains the authenticated
reporter; the UI never impersonates a director.

## Core flows

### Individual

My Tasks is a sortable, filterable list of work assigned to the signed-in employee. Search covers task key, title, and
workspace. Status and priority filters can be combined and cleared in one action. Opening a row shows description,
assignee, due date, comments, attachments, dependencies, and an immutable activity timeline.

A member can open any ticket in their own team, comment, mention another team member or relevant leader, and move work
between ordinary workflow stages. Cross-team task URLs return not found. Management-locked completion requires an
explicit director sign-off.

### Team

Team Boards opens the signed-in person’s team; leaders receive a Team selector for each workspace in their permitted
scope. The heading shows department and team. Assignee controls list the selected team only. Every team has its own
Kanban WIP limit.

A team can enable Kanban, Scrum, List, or any combination. The settings use checkboxes and Select all. The WIP field is
shown only when Kanban is selected. Creating Kanban/List asks for Board name and uses Create board. Selecting Scrum
changes those controls to Sprint name and Create sprint board.

Each Scrum board is one sprint and owns one required milestone. The milestone uses a goal plus date-only start and due
dates. Its summary shows goal, range, and risk; View capacity explains working days, approved leave, planned hours, and
remaining capacity. Complete sprint warns that the board becomes read-only. A completed sprint remains searchable in
Past sprints with its tasks and activity intact. A new sprint uses a new board and milestone.

### Department and organization overview

Delivery Reports aggregates the same workspace measures at the caller’s permitted scope. Account Directors get one
team, Senior Directors get all teams in their department, and the Managing Director gets all teams. Each team reports
completion, open work, blockers, escalations, estimates, throughput, cycle time, capacity risk, and member workload.

The Organization screen shows the Managing Director, department Senior Directors, team counts, board counts, and people
counts. Opening a department shows each team separately with its Account Director, exact member count, settings,
creation permissions, and board inventory. A Senior Director can create and edit teams in their own department. HR and
the Managing Director can maintain the wider structure.

## API map

- `GET /api/task-workspaces` — workspaces scoped to team, department, or organization role.
- `POST /api/task-workspaces` — provision a workspace for an active team.
- `GET /api/task-workspaces/:id/board` — selected board, team members, and WIP.
- `POST /api/task-workspaces/:id/boards` — create Kanban/List or one Scrum sprint board.
- `POST /api/task-workspaces/:id/memberships` — change Create Tasks/Create Boards for a team member.
- `GET /api/tasks/mine` — signed-in employee’s assigned work.
- `POST /api/tasks` and `PATCH /api/tasks/:id` — team-scoped creation and editing.
- `POST /api/tasks/:id/move`, `/approve`, `/comments`, `/links`, `/attachments` — workflow actions.
- `GET /api/tasks/reporting` — role-scoped team reports.
- `GET /api/tasks/archived` and `POST /api/tasks/:id/restore` — manager archive.
- `POST /api/milestones/:id/close` and `GET /api/milestones/:id/capacity` — sprint lifecycle.
- `POST /api/departments/:id/teams`, `PATCH /api/teams/:id`, and `POST /api/teams/:id/director` — dynamic teams.

## Validation and failure behavior

The API rejects cross-team reads, assignment, mentions, membership grants, and board creation. It rejects inactive
employees, mismatched board/workspace IDs, circular dependencies, unfinished blockers, exceeded WIP, Scrum without all
milestone fields, milestone fields on non-Scrum boards, and a due date that does not follow the start date. Workspace
numbers are allocated under a serializable transaction. Task activity is append-only.

## Manual acceptance checklist

Prerequisites: run the full seed; use the current-year IDs in README; keep two sessions available for handoff checks.

- [ ] **Simon hierarchy — Managing Director.** Open Organization. Confirm Avery Morgan is Managing Director. Open Client
      Services and verify Sidney Clarke is Senior Director, Client Success and Account Growth each have one Account
      Director and exactly 15 members. Repeat the structural check for Marketing; confirm HR currently has one team.
- [ ] **Dynamic team — Senior Director.** Sign in as Sidney, open Department, choose Create team, select task types with
      checkboxes/Select all, and create it. Confirm the new team gets its own workspace. Edit its settings and verify WIP
      appears only with Kanban.
- [ ] **Team boundary — two Account Directors.** As Jordan, confirm Team Boards and Delivery Reports contain Client
      Success only. Attempt the Account Growth workspace URL and expect denial. As Bailey, see Account Growth only. As
      Sidney, see both; as Avery, see every department.
- [ ] **Default access — Member.** Disable Alex’s Create Tasks and Create Boards switches. Sign in as Alex and confirm the
      buttons disappear while existing team tickets remain readable, commentable, and movable. Confirm no collaborator
      control exists.
- [ ] **Permission delegation — Account Director.** Re-enable one creation switch at a time and verify only that action
      appears and succeeds for Alex.
- [ ] **Individual handoff — two sessions.** Jordan creates and assigns a task to Alex. Alex finds it in My Tasks, sorts
      and filters the list, comments, and moves it. Jordan reloads and sees the same reporter, assignee, comment, state,
      and activity.
- [ ] **Completion sign-off.** Alex attempts a management-locked Done move and receives the sign-off message. Jordan
      signs off; Alex completes the task.
- [ ] **Kanban WIP.** Set Client Success limit to one. Put one task for Alex In progress; a second move is rejected. Move
      the first to Review and retry successfully. Bailey’s team remains independent.
- [ ] **Scrum.** Choose Scrum and confirm Sprint name/Create sprint board. Enter goal, start date, and due date with no
      time controls. Verify one milestone is created, capacity uses Client Success members and approved leave, and
      completing the sprint explains/readies the read-only state before moving it to Past sprints.
- [ ] **Reports.** Compare Jordan’s one-team report, Sidney’s two-team Client Services report, and Avery’s organization
      report. Verify totals reflect the task changed above.
- [ ] **Responsive and keyboard.** Repeat My Tasks, Team Boards, Department, and Delivery Reports at 375, 599/600/601,
      768, 899/900/901, 1199/1200/1201, 1440, and 1535/1536/1537 pixels. Check no document overflow, contained board
      scrolling, reachable controls, visible focus, keyboard task movement, and no browser console errors.

## Automated evidence

`yarn test:integration` resets only `tms_test` and verifies the four 15-member teams, hierarchy uniqueness, team isolation,
manager scope, reporting, permissions, WIP, Scrum lifecycle, capacity, concurrency, sign-off, archive, and append-only
history. `yarn test:e2e:chromium` covers browser flows and all project breakpoints. `yarn test:e2e:browsers` repeats the
critical journey in Chromium, Firefox, and WebKit. `yarn demo:e2e` runs the full organization in one headed Chromium
page for interview review.
