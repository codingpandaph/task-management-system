import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { TestContext } from 'node:test';
import type { Principal } from './modules/authorization/authorization';
import type { DatabaseService } from './modules/database/database.module';
import type { Department, Employee } from './generated/prisma/client';
import type { LeaveService } from './modules/leave/leave.service';
import type { OrganizationService } from './modules/organization/organization.service';
import type { TaskService } from './modules/tasks/task.service';

interface TaskIntegrationContext {
  actor: (firstName: string) => Promise<Principal>;
  db: DatabaseService;
  dep: Department;
  find: (firstName: string) => Promise<Employee>;
  hr: Principal;
  hrMember: Principal;
  leave: LeaveService;
  member: Principal;
  org: OrganizationService;
  senior: Principal;
  tasks: TaskService;
  year: number;
}

export async function registerTaskIntegrationScenarios(suite: TestContext, context: TaskIntegrationContext) {
  const { actor, db, dep, find, hr, hrMember, leave, member, org, senior, tasks, year } = context;
  await suite.test('delivery reporting is restricted to directors', async () => {
    await assert.rejects(tasks.reporting(member));
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
  await suite.test('directors delegate task and board creation while reporters remain authenticated', async () => {
    const director = await actor('Jordan');
    const workspace = await db.workspace.findFirstOrThrow({ where: { code: 'ACC' }, include: { boards: true } });
    await tasks.addMembership(director, workspace.id, {
      employeeId: member.employee.id,
      canCreateTasks: false,
      canCreateBoards: false,
    });
    await assert.rejects(
      tasks.createTask(member, {
        workspaceId: workspace.id,
        boardId: workspace.boards[0].id,
        title: 'Permission denied',
        priority: 'LOW',
        estimatedHours: 1,
      }),
    );
    await assert.rejects(
      tasks.createBoard(member, workspace.id, {
        name: 'Permission denied board',
        columns: [{ name: 'Open' }, { name: 'Done', isDone: true }],
      }),
    );
    await tasks.addMembership(director, workspace.id, {
      employeeId: member.employee.id,
      canCreateTasks: true,
      canCreateBoards: true,
    });
    assert.equal(
      (
        await tasks.createBoard(member, workspace.id, {
          name: 'Delegated board',
          columns: [{ name: 'Open' }, { name: 'Done', isDone: true }],
        })
      ).name,
      'Delegated board',
    );
    const created = await tasks.createTask(member, {
      workspaceId: workspace.id,
      boardId: workspace.boards[0].id,
      title: 'Self-assigned work',
      priority: 'MEDIUM',
      estimatedHours: 2,
      assigneeId: member.employee.id,
    });
    assert.equal(created.reporterId, member.employee.id);
    assert.equal(created.assigneeId, member.employee.id);
    const edited = await tasks.edit(member, created.id, {
      assigneeId: director.employee.id,
    });
    assert.equal(edited.assigneeId, director.employee.id);
    assert.equal(edited.reporterId, member.employee.id);
  });
  await suite.test('Senior Director provisions the correct adaptive workspace templates', async () => {
    const workspace = await tasks.createWorkspace(senior, dep.id, 'ENGINEERING_PRODUCT');
    const created = await db.workspace.findUniqueOrThrow({
      where: { id: workspace.id },
      include: { boards: { include: { columns: true } } },
    });
    assert.deepEqual(created.boards.map((board) => board.name).sort(), ['Engineering delivery']);
    assert.ok(created.boards.every((board) => board.columns.some((column) => column.isInitial)));
  });
  await suite.test('task completion requires management sign-off', async () => {
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
    });
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
      progress = board.columns.find((column) => column.semantic === 'IN_PROGRESS')!;
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
  await suite.test('closing a Scrum milestone unbinds unfinished tasks', async () => {
    const director = await actor('Jordan');
    const workspace = await db.workspace.findFirstOrThrow({ where: { code: 'ACC' }, include: { boards: true } });
    const board = await tasks.createBoard(director, workspace.id, {
      name: `Closure ${randomUUID()}`,
      kind: 'SCRUM',
      milestoneName: 'Closure cycle',
      milestoneGoal: 'Close this delivery cycle',
      milestoneStartDate: `${year}-09-01`,
      milestoneDueDate: `${year}-09-10`,
    });
    const task = await tasks.createTask(member, {
      workspaceId: workspace.id,
      boardId: board.id,
      title: 'Rollover work',
      description: '',
      priority: 'MEDIUM',
      estimatedHours: 3,
    });
    await tasks.closeMilestone(director, board.milestone!.id);
    assert.equal((await db.task.findUniqueOrThrow({ where: { id: task.id } })).milestoneId, null);
  });
  await suite.test('capacity deducts approved leave and termination clears active assignments', async () => {
    const director = await actor('Jordan');
    const workspace = await db.workspace.findFirstOrThrow({ where: { code: 'ACC' }, include: { boards: true } });
    const board = await tasks.createBoard(director, workspace.id, {
      name: `Capacity ${randomUUID()}`,
      kind: 'SCRUM',
      milestoneName: 'Capacity cycle',
      milestoneGoal: 'Validate capacity',
      milestoneStartDate: `${year}-12-01`,
      milestoneDueDate: `${year}-12-18`,
    });
    const milestone = board.milestone!;
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
      boardId: board.id,
      title: 'Termination cleanup',
      description: '',
      priority: 'HIGH',
      estimatedHours: 4,
      assigneeId: member.employee.id,
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
      await assert.rejects(db.taskActivityLog.update({ where: { id: activity.id }, data: { fieldChanged: 'tamper' } }));
      assert.deepEqual(
        (await tasks.reporting(director)).map((report) => report.code),
        ['ACC'],
      );
      assert.ok((await tasks.reporting(senior)).length >= 2);
    },
  );
}
