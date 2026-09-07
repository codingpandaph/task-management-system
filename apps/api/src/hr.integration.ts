import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { seed } from './seed';
import { AuthService } from './modules/auth/auth.service';
import { DatabaseService } from './modules/database/database.module';
import { OrganizationService } from './modules/organization/organization.service';
import { LeaveService } from './modules/leave/leave.service';
import { LeaveApprovalResolver } from './modules/leave/approval.service';
import { LeaveBalanceService } from './modules/leave/balance.service';
import { AccountStatusService } from './modules/employment/account-status.service';
import { today } from './common/dates';
import type { Principal } from './modules/authorization/authorization';
import { PageDto } from './modules/organization/dto';
import { TaskService } from './modules/tasks/task.service';

test('HR foundation against PostgreSQL', async (suite) => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(url.pathname, '/tms_test', 'Integration tests require the dedicated tms_test database');
  assert.equal(process.env.NODE_ENV, 'test');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const db = app.get(DatabaseService),
      auth = app.get(AuthService),
      org = app.get(OrganizationService),
      leave = app.get(LeaveService),
      resolver = app.get(LeaveApprovalResolver),
      balance = app.get(LeaveBalanceService),
      status = app.get(AccountStatusService);
    const tasks = app.get(TaskService);
    await seed(db);
    const year = Number(today().slice(0, 4));
    const find = async (firstName: string) => db.employee.findFirstOrThrow({ where: { firstName } });
    const actor = async (firstName: string): Promise<Principal> => {
      const e = await find(firstName);
      const session = await auth.login(e.employeeId, 'Demo only password 2026!');
      return auth.principal(session.access);
    };
    const hr = await actor('Taylor'),
      senior = await actor('Avery'),
      member = await actor('Alex'),
      hrMember = await actor('Riley');
    const policy = await db.leavePolicyVersion.findFirstOrThrow(),
      christmas = await db.christmasPolicyVersion.findFirstOrThrow();
    const suffix = randomUUID().replaceAll('-', '').slice(0, 7).toUpperCase();
    const dep = await org.createDepartment(hr, { code: `T${suffix}`, name: `Integration ${suffix}` });
    const create = async (name: string) =>
      org.create(hr, {
        firstName: name,
        lastName: suffix,
        birthDate: '1991-02-03',
        departmentId: dep.id,
        employmentType: 'FULL_TIME',
        startDate: `${year}-01-01`,
        leavePolicyVersionId: policy.id,
        christmasPolicyVersionId: christmas.id,
      });
    const newcomer = await create('Newstarter');
    await suite.test('IDs are unique, immutable, and concurrency-safe', async () => {
      const results = await Promise.all([create('ConcurrentA'), create('ConcurrentB'), create('ConcurrentC')]);
      assert.equal(new Set(results.map((r) => r.employeeId)).size, 3);
      assert.match(newcomer.employeeId, new RegExp(`^${year}-T${suffix}-\\d{6}$`));
      await assert.rejects(db.employee.update({ where: { id: newcomer.id }, data: { employeeId: 'changed' } }));
      await org.transfer(hr, newcomer.id, member.employee.departmentId, 'Integration transfer');
      assert.equal(
        (await db.employee.findUniqueOrThrow({ where: { id: newcomer.id } })).employeeId,
        newcomer.employeeId,
      );
    });
    await suite.test('temporary passwords are hashed, forced change and reset revoke sessions', async () => {
      const stored = await db.employee.findUniqueOrThrow({ where: { id: newcomer.id } });
      assert.notEqual(stored.passwordHash, newcomer.temporaryPassword);
      assert.match(stored.passwordHash, /^\$2[aby]\$/);
      await assert.rejects(auth.login(newcomer.employeeId, 'wrong password'));
      const login = await auth.login(newcomer.employeeId, newcomer.temporaryPassword);
      const p = await auth.principal(login.access);
      assert.equal(p.employee.mustChangePassword, true);
      assert.deepEqual(auth.view(p).permissions, []);
      const changed = await auth.changePassword(p, newcomer.temporaryPassword, 'A different secure password 2026!');
      await assert.rejects(auth.principal(login.access));
      assert.equal((await auth.principal(changed.access)).employee.mustChangePassword, false);
      await org.reset(hr, newcomer.id);
      await assert.rejects(auth.principal(changed.access));
    });
    await suite.test('refresh rotation rejects replay and revokes the session', async () => {
      const e = await find('Riley');
      const login = await auth.login(e.employeeId, 'Demo only password 2026!');
      const rotated = await auth.refresh(login.refresh, login.csrf);
      await assert.rejects(auth.refresh(login.refresh, login.csrf));
      await assert.rejects(auth.principal(rotated.access));
    });
    await suite.test('permissions, self escalation and privacy are enforced', async () => {
      await assert.rejects(org.createDepartment(member, { code: 'NO', name: 'Denied' }));
      await assert.rejects(org.permission(hr, hr.employee.id, { code: 'LEAVE_ADMIN', reason: 'Self grant' }));
      await assert.rejects(
        org.permission(hr, hrMember.employee.id, { code: 'LEAVE_ADMIN', reason: 'Forbidden delegation' }),
      );
      await assert.rejects(org.detail(member, hr.employee.id));
      const result = await org.employees(member, new PageDto());
      const encoded = JSON.stringify(result);
      for (const forbidden of ['passwordHash', 'birthDate', 'email', 'suspension'])
        assert.ok(!encoded.includes(forbidden));
      assert.ok(!JSON.stringify(auth.view(member)).includes('passwordHash'));
    });
    await suite.test('database prevents duplicate leadership', async () => {
      await assert.rejects(db.employee.update({ where: { id: newcomer.id }, data: { position: 'SENIOR_DIRECTOR' } }));
      await assert.rejects(db.employee.update({ where: { id: newcomer.id }, data: { position: 'ACCOUNT_DIRECTOR' } }));
    });
    await suite.test('exact five approval chains are resolved', async () => {
      for (const [name, expected] of [
        ['Alex', ['ACCOUNT_DIRECTOR', 'HR']],
        ['Jordan', ['SENIOR_DIRECTOR', 'HR']],
        ['Avery', []],
        ['Riley', ['ACCOUNT_DIRECTOR']],
        ['Taylor', ['SENIOR_DIRECTOR']],
      ] as const) {
        const employee = await find(name);
        const steps = await db.transaction((tx) => resolver.resolve(tx, employee));
        assert.deepEqual(
          steps.map((s) => s.type),
          [...expected],
        );
      }
    });
    await suite.test('date rules exclude holidays/weekends and restrict Christmas', async () => {
      const days = await db.transaction((tx) => balance.days(tx, `${year}-12-24`, `${year}-12-29`, 'VACATION'));
      assert.ok(days.length < 6);
      assert.ok(!days.some((d) => d.toISOString().slice(5, 10) === '12-25'));
      await assert.rejects(
        db.transaction((tx) => balance.days(tx, `${year}-11-02`, `${year}-11-03`, 'CHRISTMAS_VACATION')),
      );
      await assert.rejects(db.transaction((tx) => balance.days(tx, `${year}-12-31`, `${year + 1}-01-01`, 'VACATION')));
    });
    await suite.test('reservation, ordered approval, duplicate rejection and cancellation reversal', async () => {
      const e = await create('LeaveOwner');
      await org.transfer(hr, e.id, member.employee.departmentId, 'Test manager assignment');
      const login = await auth.login(e.employeeId, e.temporaryPassword);
      const p = await auth.principal(login.access);
      // Service tests use a fully authenticated employee after changing the temporary password.
      const changed = await auth.changePassword(p, e.temporaryPassword, 'Leave owner secure password!');
      const owner = await auth.principal(changed.access);
      const before = await leave.balance(owner, year);
      const d = await leave.draft(owner, { type: 'VACATION', startDate: `${year}-12-01`, endDate: `${year}-12-02` });
      await leave.submit(owner, d.id, randomUUID());
      const reserved = await leave.balance(owner, year);
      assert.equal(reserved.find((b) => b.type === 'VACATION')!.reserved, 2);
      await assert.rejects(leave.decide(hr, d.id, { decision: 'APPROVED' }));
      const director = await actor('Jordan'),
        approver = await actor('Morgan');
      await leave.decide(director, d.id, { decision: 'APPROVED' });
      await assert.rejects(leave.decide(director, d.id, { decision: 'APPROVED' }));
      await leave.decide(approver, d.id, { decision: 'APPROVED' });
      const used = await leave.balance(owner, year);
      assert.equal(used.find((b) => b.type === 'VACATION')!.used, 2);
      assert.equal(used.find((b) => b.type === 'VACATION')!.reserved, 0);
      const c = await leave.cancel(owner, d.id, { reason: 'Plans changed', operationId: randomUUID() });
      assert.equal((await leave.balance(owner, year)).find((b) => b.type === 'VACATION')!.used, 2);
      await leave.decideCancellation(director, c.id, { decision: 'APPROVED' });
      await leave.decideCancellation(approver, c.id, { decision: 'APPROVED' });
      assert.deepEqual(await leave.balance(owner, year), before);
    });
    await suite.test('concurrent overlapping submissions cannot both reserve', async () => {
      const e = await create('RaceOwner');
      await org.transfer(hr, e.id, member.employee.departmentId, 'Test assignment');
      const login = await auth.login(e.employeeId, e.temporaryPassword);
      const changed = await auth.changePassword(
        await auth.principal(login.access),
        e.temporaryPassword,
        'Concurrent leave safe password!',
      );
      const p = await auth.principal(changed.access);
      const a = await leave.draft(p, { type: 'VACATION', startDate: `${year}-12-07`, endDate: `${year}-12-08` }),
        b = await leave.draft(p, { type: 'VACATION', startDate: `${year}-12-07`, endDate: `${year}-12-08` });
      const results = await Promise.allSettled([
        leave.submit(p, a.id, randomUUID()),
        leave.submit(p, b.id, randomUUID()),
      ]);
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    });
    await suite.test('suspension revokes access and expiry respects current eligibility', async () => {
      const e = await create('SuspendOwner');
      const login = await auth.login(e.employeeId, e.temporaryPassword);
      await org.status(hr, e.id, 'SUSPENDED', 'Integration suspension', new Date(Date.now() + 60000).toISOString());
      await assert.rejects(auth.principal(login.access));
      await assert.rejects(auth.login(e.employeeId, e.temporaryPassword));
      assert.equal(await db.transaction((tx) => status.eligible(tx, e.id, new Date(Date.now() + 120000))), true);
      await assert.rejects(auth.principal(login.access));
      await org.status(hr, e.id, 'TERMINATED', 'Integration termination');
      assert.equal(await db.transaction((tx) => status.eligible(tx, e.id)), false);
    });
    await suite.test('contract expiry blocks access; probation expiry does not', async () => {
      const inactive = await find('Robin');
      await assert.rejects(auth.login(inactive.employeeId, 'Demo only password 2026!'));
      const probation = await find('Sam');
      assert.equal(
        await db.transaction((tx) => status.eligible(tx, probation.id, new Date(`${year}-12-01T12:00:00Z`))),
        true,
      );
    });
    await suite.test('audit and ledger reject updates and contain no credentials', async () => {
      const a = await db.auditEvent.findFirstOrThrow();
      await assert.rejects(db.auditEvent.update({ where: { id: a.id }, data: { action: 'tamper' } }));
      const l = await db.leaveLedgerEntry.findFirstOrThrow();
      await assert.rejects(db.leaveLedgerEntry.update({ where: { id: l.id }, data: { usedDelta: 999 } }));
      const text = JSON.stringify(await db.auditEvent.findMany());
      assert.ok(!text.includes('Demo only password'));
      assert.ok(!text.includes('passwordHash'));
    });
    await suite.test('task numbers are workspace-scoped and concurrent creation is safe', async () => {
      const workspace = await db.workspace.findFirstOrThrow({ where: { code: 'ACC' }, include: { boards: true } });
      const dto = (title: string) => ({
        workspaceId: workspace.id,
        boardId: workspace.boards[0].id,
        title,
        description: 'Concurrent task',
        priority: 'MEDIUM' as const,
        estimatedHours: 4,
      });
      const created = await Promise.all([
        tasks.createTask(member, dto('Concurrent one')),
        tasks.createTask(member, dto('Concurrent two')),
      ]);
      assert.equal(new Set(created.map((task) => task.publicKey)).size, 2);
      assert.ok(created.every((task) => task.publicKey.startsWith('ACC-#')));
    });
    await suite.test('Senior Director provisions the correct adaptive workspace templates', async () => {
      const workspace = await tasks.createWorkspace(senior, dep.id, 'ENGINEERING_PRODUCT');
      const created = await db.workspace.findUniqueOrThrow({
        where: { id: workspace.id },
        include: { boards: { include: { columns: true } } },
      });
      assert.deepEqual(created.boards.map((board) => board.name).sort(), ['Backlog', 'Features', 'Scrum milestones']);
      assert.ok(created.boards.every((board) => board.columns.some((column) => column.isInitial)));
    });
    await suite.test('task completion requires DoD and management sign-off', async () => {
      const workspace = await db.workspace.findFirstOrThrow({
        where: { code: 'ACC' },
        include: { boards: { include: { columns: true } } },
      });
      const board = workspace.boards[0],
        done = board.columns.find((column) => column.isDone)!;
      const task = await tasks.createTask(member, {
        workspaceId: workspace.id,
        boardId: board.id,
        title: 'Protected completion',
        description: '',
        priority: 'HIGH',
        estimatedHours: 8,
        definitionOfDone: ['Reviewed'],
      });
      await assert.rejects(tasks.move(member, task.id, done.id));
      await tasks.checkDod(member, task.id, task.definitionOfDone[0].id, true);
      await assert.rejects(tasks.move(member, task.id, done.id));
      const director = await actor('Jordan');
      await assert.rejects(tasks.move(director, task.id, done.id));
      await tasks.approve(director, task.id, true);
      assert.equal((await tasks.move(member, task.id, done.id)).column.isDone, true);
    });
    await suite.test('blockers stop movement and circular dependencies are rejected', async () => {
      const workspace = await db.workspace.findFirstOrThrow({
        where: { code: 'ACC' },
        include: { boards: { include: { columns: true } } },
      });
      const board = workspace.boards[0],
        progress = board.columns.find((column) => column.name === 'In progress')!;
      const make = (title: string) =>
        tasks.createTask(member, {
          workspaceId: workspace.id,
          boardId: board.id,
          title,
          description: '',
          priority: 'LOW',
          estimatedHours: 1,
        });
      const [blocked, blocker] = await Promise.all([make('Blocked work'), make('Blocking work')]);
      await tasks.link(member, blocked.id, blocker.id, 'BLOCKED_BY');
      await assert.rejects(tasks.move(member, blocked.id, progress.id));
      await assert.rejects(tasks.link(member, blocker.id, blocked.id, 'BLOCKED_BY'));
      assert.equal((await tasks.move(senior, blocked.id, progress.id)).columnId, progress.id);
    });
    await suite.test('soft deletion hides tasks and manager restore retains history', async () => {
      const director = await actor('Jordan');
      const workspace = await db.workspace.findFirstOrThrow({ where: { code: 'ACC' }, include: { boards: true } });
      const task = await tasks.createTask(member, {
        workspaceId: workspace.id,
        boardId: workspace.boards[0].id,
        title: 'Recoverable work',
        description: '',
        priority: 'MEDIUM',
        estimatedHours: 2,
      });
      await tasks.remove(member, task.id);
      await assert.rejects(tasks.detail(member, task.id));
      assert.equal((await tasks.restore(director, task.id)).isDeleted, false);
      const actions = await db.taskActivityLog.findMany({ where: { taskId: task.id }, orderBy: { createdAt: 'asc' } });
      assert.deepEqual(
        actions.map((entry) => entry.actionType),
        ['CREATE', 'DELETION', 'RESTORATION'],
      );
    });
    await suite.test('milestone closure rolls unfinished tasks into the next cycle', async () => {
      const director = await actor('Jordan');
      const workspace = await db.workspace.findFirstOrThrow({ where: { code: 'ACC' }, include: { boards: true } });
      const first = await tasks.createMilestone(director, workspace.id, {
        name: 'First cycle',
        goal: 'First',
        startDate: `${year}-09-01`,
        dueDate: `${year}-09-10T17:00:00.000Z`,
      });
      const next = await tasks.createMilestone(director, workspace.id, {
        name: 'Next cycle',
        goal: 'Next',
        startDate: `${year}-09-11`,
        dueDate: `${year}-09-20T17:00:00.000Z`,
      });
      const task = await tasks.createTask(member, {
        workspaceId: workspace.id,
        boardId: workspace.boards[0].id,
        title: 'Rollover work',
        description: '',
        priority: 'MEDIUM',
        estimatedHours: 3,
        milestoneId: first.id,
      });
      await tasks.closeMilestone(director, first.id);
      assert.equal((await db.task.findUniqueOrThrow({ where: { id: task.id } })).milestoneId, next.id);
    });
    await suite.test('capacity deducts approved leave and termination clears active assignments', async () => {
      const director = await actor('Jordan');
      const workspace = await db.workspace.findFirstOrThrow({ where: { code: 'ACC' }, include: { boards: true } });
      const milestone = await tasks.createMilestone(director, workspace.id, {
        name: 'Capacity cycle',
        goal: 'Capacity',
        startDate: `${year}-12-01`,
        dueDate: `${year}-12-18T17:00:00.000Z`,
      });
      const capacity = await tasks.capacity(director, milestone.id);
      assert.ok(capacity.availableHours > 0);
      await leave.administrative(hr, {
        employeeId: member.employee.id,
        type: 'VACATION',
        startDate: `${year}-12-07`,
        endDate: `${year}-12-07`,
        administrativeReason: 'Capacity integration leave',
        operationId: randomUUID(),
      });
      const leaveAdjusted = await tasks.capacity(director, milestone.id);
      assert.equal(leaveAdjusted.availableHours, capacity.availableHours - 8);
      const assigned = await tasks.createTask(director, {
        workspaceId: workspace.id,
        boardId: workspace.boards[0].id,
        title: 'Termination cleanup',
        description: '',
        priority: 'HIGH',
        estimatedHours: 4,
        assigneeId: member.employee.id,
        milestoneId: milestone.id,
      });
      await org.status(hr, member.employee.id, 'TERMINATED', 'Task cleanup integration');
      const cleaned = await db.task.findUniqueOrThrow({ where: { id: assigned.id }, include: { column: true } });
      assert.equal(cleaned.assigneeId, null);
      assert.equal(cleaned.column.isInitial, true);
      assert.equal((await db.milestone.findUniqueOrThrow({ where: { id: milestone.id } })).isOvercapacity, true);
    });
    await suite.test(
      'task scope, active assignment, escalation, comments and immutable activity are enforced',
      async () => {
        const director = await actor('Jordan');
        const workspace = await db.workspace.findFirstOrThrow({
          where: { code: 'ACC' },
          include: { boards: true },
        });
        const task = await tasks.createTask(director, {
          workspaceId: workspace.id,
          boardId: workspace.boards[0].id,
          title: 'Scoped delivery',
          description: '',
          priority: 'HIGH',
          estimatedHours: 5,
        });
        await assert.rejects(tasks.detail(hrMember, task.id));
        const inactive = await find('Robin');
        await assert.rejects(tasks.edit(director, task.id, { assigneeId: inactive.id }));
        await tasks.comment(director, task.id, 'Leadership review requested');
        await tasks.escalate(director, task.id, true);
        assert.ok(await db.notification.findFirst({ where: { type: 'TASK_ESCALATED', resourceId: task.id } }));
        const activity = await db.taskActivityLog.findFirstOrThrow({ where: { taskId: task.id } });
        await assert.rejects(
          db.taskActivityLog.update({ where: { id: activity.id }, data: { fieldChanged: 'tamper' } }),
        );
        assert.deepEqual(
          (await tasks.reporting(director)).map((report) => report.code),
          ['ACC'],
        );
        assert.ok((await tasks.reporting(senior)).length >= 2);
      },
    );
    void senior;
  } finally {
    await app.close();
  }
});
