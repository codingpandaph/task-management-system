# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

CPPinSync serves employees, Account Directors, HR staff, and one Senior Director in a department-scale organization.
Employees manage their own leave and assigned work. Account Directors coordinate department delivery and approvals. HR
staff manage people operations and leave administration according to explicit capabilities. The Senior Director
governs organization-wide access and reviews delivery across teams.

## Product Purpose

CPPinSync combines employee administration, leave management, individual tasks, team boards, and leadership reporting
in one operational workspace. Success means employees can complete routine work independently, directors can
coordinate their teams without losing governance, and leadership can rely on organization-wide status.

## Positioning

HR availability, employment eligibility, permissions, leave, task capacity, and delivery reporting share one
authoritative identity and policy system. Task decisions therefore reflect current people and leave data instead of a
separate, drifting directory.

## Operating Context

The product is a responsive browser application used for everyday employee self-service, HR administration, leave
filing and approval, Kanban delivery planning, milestone capacity review, audit review, and technical demonstrations.
The full demonstration organization has three departments: two 15-member delivery teams led by Account Directors and
an additional HR department, while the Senior Director sits at organization level above all departments. Automated
demos begin from a guarded, limited fictional
database seed.

## Capabilities and Constraints

- Employee identity, departments, employment lifecycle, permission grants, sessions, notifications, and audit.
- Versioned leave and Christmas policies, annual balances, filing, five exact approval paths, cancellation, correction,
  and department-scoped absence calendars.
- Personal tasks, department workspaces, boards, milestones, capacity, dependencies, Definition of Done, sign-off,
  escalation, delegated creation, editable reporters, soft deletion, and leadership reporting.
- PostgreSQL is authoritative. Sensitive mutations use scoped authorization and append-oriented business history.
- Responsive behavior is tested below, at, and above every shared breakpoint in Chromium, Firefox, and WebKit.
- The prototype must not claim production compliance certification or fabricate legal, customer, or performance proof.

## Brand Commitments

The product name is CPPinSync. Its established voice is concise, calm, operational, and human. It uses plain language,
short labels, accessible controls, and a restrained green identity. Existing CPPinSync wording and identity should be
preserved unless the user explicitly requests a rebrand.

## Evidence on Hand

- Authoritative HRIS behavior and manual flows: `../../docs/hr-system.md`.
- Authoritative task-management behavior and manual flows: `../../docs/task-management.md`.
- Architecture decisions: `../../docs/adr/`.
- Executable Playwright journeys and visual baselines: `../../tests/e2e/`.
- Fictional development and test data only. No customer testimonials, adoption metrics, or production certification
  evidence exists and none should be invented.

## Product Principles

1. Make the next valid action easy to find and understand.
2. Keep access, people status, leave, and delivery data consistent through one authority.
3. Show each role only the detail and power needed for its work.
4. Preserve consequential history and make recovery explicit.
5. Prove important flows in the browser from clean, deterministic data.

## Accessibility & Inclusion

The web application targets WCAG 2.2 AA behavior: keyboard operation, visible focus, meaningful semantics, readable
contrast, 44-pixel interaction targets, responsive layouts, and automated axe checks on critical flows.
