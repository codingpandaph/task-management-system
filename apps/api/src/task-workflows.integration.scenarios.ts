import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { TestContext } from 'node:test';
import type { Principal } from './modules/authorization/authorization';
import type { DatabaseService } from './modules/database/database.module';
import type { TaskService } from './modules/tasks/task.service';

interface Context {
  actor: (firstName: string) => Promise<Principal>;
  db: DatabaseService;
  find: (firstName: string) => Promise<{ id: string }>;
  member: Principal;
  tasks: TaskService;
  year: number;
}

export async function registerTaskWorkflowScenarios(suite: TestContext, context: Context) {
  const { actor, db, find, tasks, year } = context;
  const activeMember = await actor('Cameron');
  await suite.test('saved views, bulk triage, mentions, attachments, and delivery measures remain scoped', async () => {
    const director = await actor('Jordan');
    const workspace = await db.workspace.findFirstOrThrow({
      where: { code: 'ACC' },
      include: { boards: { include: { columns: true } } },
    });
    const board = workspace.boards.find((item) => item.kind === 'KANBAN')!;
    const initial = board.columns.find((column) => column.isInitial)!;
    const task = await tasks.createTask(director, {
      workspaceId: workspace.id,
      boardId: board.id,
      title: 'Prototype evidence task',
      priority: 'LOW',
      estimatedHours: 2,
      assigneeId: activeMember.employee.id,
    });
    const view = await tasks.saveView(activeMember, {
      workspaceId: workspace.id,
      name: 'My urgent work',
      search: 'evidence',
      priority: 'HIGH',
      assigneeId: activeMember.employee.id,
    });
    assert.equal((await tasks.savedViews(activeMember, workspace.id))[0]?.id, view.id);
    assert.equal((await tasks.bulkUpdate(director, { taskIds: [task.id], priority: 'HIGH' })).updated, 1);
    const comment = await tasks.comment(director, task.id, `Please review @${activeMember.employee.employeeId}`);
    assert.equal(await db.taskMention.count({ where: { commentId: comment.id } }), 1);
    assert.equal(
      await db.notification.count({ where: { recipientId: activeMember.employee.id, type: 'TASK_MENTION' } }),
      1,
    );
    await tasks.addAttachment(director, task.id, {
      name: 'Technical brief.pdf',
      url: 'https://example.com/technical-brief.pdf',
      mediaType: 'application/pdf',
      sizeBytes: 2048,
    });
    const detail = await tasks.detail(activeMember, task.id);
    assert.equal(detail.attachments[0]?.name, 'Technical brief.pdf');
    assert.equal(detail.columnId, initial.id);
    const reports = await tasks.reporting(director);
    assert.equal(typeof reports[0]?.throughput30Days, 'number');
    assert.equal(typeof reports[0]?.averageCycleDays, 'number');
    await tasks.deleteView(activeMember, view.id);
  });
  await suite.test('board types, collaborators, and sprint lifecycle enforce scope', async () => {
    const director = await actor('Jordan');
    const workspace = await db.workspace.findFirstOrThrow({ where: { code: 'ACC' }, include: { boards: true } });
    await assert.rejects(tasks.createBoard(director, workspace.id, { name: 'Invalid list', kind: 'LIST' }));
    const scrum = await tasks.createBoard(director, workspace.id, { name: `Scrum ${randomUUID()}`, kind: 'SCRUM' });
    const unrelated = await find('Riley');
    await assert.rejects(tasks.addCollaborator(director, scrum.id, { employeeId: unrelated.id }));
    assert.equal(
      (await tasks.addCollaborator(director, scrum.id, { employeeId: activeMember.employee.id })).employeeId,
      activeMember.employee.id,
    );
    assert.equal((await tasks.board(activeMember, workspace.id, scrum.id)).board.id, scrum.id);
    await assert.rejects(
      tasks.createSprint(director, scrum.id, {
        name: 'Invalid sprint',
        goal: 'Validate dates',
        startDate: `${year}-10-10`,
        endDate: `${year}-10-01`,
      }),
    );
    const sprint = await tasks.createSprint(director, scrum.id, {
      name: 'Validation sprint',
      goal: 'Validate workflow',
      startDate: `${year}-10-01`,
      endDate: `${year}-10-14`,
    });
    assert.equal((await tasks.changeSprintStatus(director, sprint.id, 'ACTIVE')).status, 'ACTIVE');
    const sprintTask = await tasks.createTask(director, {
      workspaceId: workspace.id,
      boardId: scrum.id,
      sprintId: sprint.id,
      dueDate: `${year}-10-10`,
      title: 'Sprint delivery',
      priority: 'HIGH',
      estimatedHours: 4,
      assigneeId: activeMember.employee.id,
    });
    assert.equal(sprintTask.sprintId, sprint.id);
    assert.equal((await tasks.detail(activeMember, sprintTask.id)).id, sprintTask.id);
    const another = await tasks.createSprint(director, scrum.id, {
      name: 'Next sprint',
      goal: 'Next workflow',
      startDate: `${year}-10-15`,
      endDate: `${year}-10-28`,
    });
    await assert.rejects(tasks.changeSprintStatus(director, another.id, 'ACTIVE'));
    assert.equal((await tasks.changeSprintStatus(director, sprint.id, 'COMPLETED')).status, 'COMPLETED');
    await assert.rejects(
      tasks.createTask(director, {
        workspaceId: workspace.id,
        boardId: scrum.id,
        sprintId: sprint.id,
        title: 'Closed sprint task',
        priority: 'LOW',
        estimatedHours: 1,
      }),
    );
  });
  await suite.test('Kanban WIP is department-configured and independently enforced per assignee', async () => {
    const director = await actor('Jordan');
    const workspace = await db.workspace.findFirstOrThrow({
      where: { code: 'ACC' },
      include: { department: true, boards: { include: { columns: true } } },
    });
    await db.department.update({ where: { id: workspace.departmentId }, data: { kanbanWipLimit: 1 } });
    const board = workspace.boards.find((item) => item.kind === 'KANBAN')!;
    const progress = board.columns.find((column) => column.semantic === 'IN_PROGRESS')!;
    const review = board.columns.find((column) => column.semantic === 'REVIEW')!;
    const make = (title: string, assigneeId?: string) =>
      tasks.createTask(director, {
        workspaceId: workspace.id,
        boardId: board.id,
        title,
        priority: 'MEDIUM',
        estimatedHours: 1,
        assigneeId,
      });
    const first = await make('WIP first', activeMember.employee.id);
    await db.taskColumn.update({ where: { id: progress.id }, data: { name: 'Doing' } });
    await tasks.move(activeMember, first.id, progress.id);
    const blocked = await make('WIP blocked', activeMember.employee.id);
    await assert.rejects(tasks.move(activeMember, blocked.id, progress.id));
    const directorTask = await make('Independent capacity', director.employee.id);
    await tasks.move(director, directorTask.id, progress.id);
    const unassigned = await make('Unassigned capacity');
    await tasks.move(director, unassigned.id, progress.id);
    await assert.rejects(tasks.edit(director, unassigned.id, { assigneeId: activeMember.employee.id }));
    await tasks.move(activeMember, first.id, review.id);
    assert.equal(
      (await tasks.edit(director, unassigned.id, { assigneeId: activeMember.employee.id })).assigneeId,
      activeMember.employee.id,
    );
    await tasks.remove(director, unassigned.id);
    const freed = await make('Freed after archive', activeMember.employee.id);
    assert.equal((await tasks.move(activeMember, freed.id, progress.id)).assigneeId, activeMember.employee.id);
  });
}
