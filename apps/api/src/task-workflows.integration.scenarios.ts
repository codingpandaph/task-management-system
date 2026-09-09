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
  const { actor, db, find, member, tasks, year } = context;
  await suite.test('board types, collaborators, and sprint lifecycle enforce scope', async () => {
    const director = await actor('Jordan');
    const workspace = await db.workspace.findFirstOrThrow({ where: { code: 'ACC' }, include: { boards: true } });
    await assert.rejects(tasks.createBoard(director, workspace.id, { name: 'Invalid list', kind: 'LIST' }));
    const scrum = await tasks.createBoard(director, workspace.id, { name: `Scrum ${randomUUID()}`, kind: 'SCRUM' });
    const unrelated = await find('Riley');
    await assert.rejects(tasks.addCollaborator(director, scrum.id, { employeeId: unrelated.id }));
    assert.equal(
      (await tasks.addCollaborator(director, scrum.id, { employeeId: member.employee.id })).employeeId,
      member.employee.id,
    );
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
    const another = await tasks.createSprint(director, scrum.id, {
      name: 'Next sprint',
      goal: 'Next workflow',
      startDate: `${year}-10-15`,
      endDate: `${year}-10-28`,
    });
    await assert.rejects(tasks.changeSprintStatus(director, another.id, 'ACTIVE'));
    assert.equal((await tasks.changeSprintStatus(director, sprint.id, 'COMPLETED')).status, 'COMPLETED');
  });
  await suite.test('Kanban WIP is department-configured and independently enforced per assignee', async () => {
    const director = await actor('Jordan');
    const workspace = await db.workspace.findFirstOrThrow({
      where: { code: 'ACC' },
      include: { department: true, boards: { include: { columns: true } } },
    });
    await db.department.update({ where: { id: workspace.departmentId }, data: { kanbanWipLimit: 2 } });
    const board = workspace.boards.find((item) => item.kind === 'KANBAN')!;
    const progress = board.columns.find((column) => column.name === 'In progress')!;
    const review = board.columns.find((column) => column.name === 'Review')!;
    const make = (title: string, assigneeId?: string) =>
      tasks.createTask(director, {
        workspaceId: workspace.id,
        boardId: board.id,
        title,
        priority: 'MEDIUM',
        estimatedHours: 1,
        assigneeId,
      });
    const first = await make('WIP first', member.employee.id);
    await tasks.move(member, first.id, progress.id);
    const blocked = await make('WIP blocked', member.employee.id);
    await assert.rejects(tasks.move(member, blocked.id, progress.id));
    const directorTask = await make('Independent capacity', director.employee.id);
    await tasks.move(director, directorTask.id, progress.id);
    const unassigned = await make('Unassigned capacity');
    await tasks.move(director, unassigned.id, progress.id);
    await assert.rejects(tasks.edit(director, unassigned.id, { assigneeId: member.employee.id }));
    await tasks.move(member, first.id, review.id);
    assert.equal(
      (await tasks.edit(director, unassigned.id, { assigneeId: member.employee.id })).assigneeId,
      member.employee.id,
    );
    await tasks.remove(director, unassigned.id);
    const freed = await make('Freed after archive', member.employee.id);
    assert.equal((await tasks.move(member, freed.id, progress.id)).assigneeId, member.employee.id);
  });
}
