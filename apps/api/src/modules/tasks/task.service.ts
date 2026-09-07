import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  Employee,
  Prisma,
  TaskActivityType,
  TaskLinkType,
  WorkspaceFunction,
} from '../../generated/prisma/client';
import { dateOnly } from '../../common/dates';
import { audit, notify } from '../audit/audit';
import type { Principal } from '../authorization/authorization';
import { DatabaseService, type Transaction } from '../database/database.module';
import type { BoardDto, MembershipDto, MilestoneDto, TaskDto, TaskEditDto } from './task.dto';
import { formatEstimation } from './estimation';

const templates: Record<WorkspaceFunction, { name: string; kind: string; columns: [string, boolean, boolean][] }[]> = {
  ENGINEERING_PRODUCT: [
    {
      name: 'Backlog',
      kind: 'BACKLOG',
      columns: [
        ['To do', false, false],
        ['Ready', false, false],
        ['Done', true, true],
      ],
    },
    {
      name: 'Scrum milestones',
      kind: 'SCRUM',
      columns: [
        ['To do', false, false],
        ['In progress', false, false],
        ['Review', false, false],
        ['Done', true, true],
      ],
    },
    {
      name: 'Features',
      kind: 'KANBAN',
      columns: [
        ['To do', false, false],
        ['Building', false, false],
        ['Approved', true, true],
      ],
    },
  ],
  MARKETING_CREATIVE: [
    {
      name: 'Campaign calendar',
      kind: 'CALENDAR',
      columns: [
        ['Planned', false, false],
        ['Scheduled', false, false],
        ['Published', true, true],
      ],
    },
    {
      name: 'Editorial',
      kind: 'KANBAN',
      columns: [
        ['To do', false, false],
        ['Creating', false, false],
        ['Review', false, false],
        ['Done', true, true],
      ],
    },
    {
      name: 'Asset pipeline',
      kind: 'PIPELINE',
      columns: [
        ['Requested', false, false],
        ['Designing', false, false],
        ['Approved', true, true],
      ],
    },
  ],
  SALES_ACCOUNT_MANAGEMENT: [
    {
      name: 'CRM funnel',
      kind: 'FUNNEL',
      columns: [
        ['Lead', false, false],
        ['Qualified', false, false],
        ['Proposal', false, false],
        ['Won', true, true],
      ],
    },
    {
      name: 'Lead tracker',
      kind: 'TRACKER',
      columns: [
        ['New', false, false],
        ['Contacted', false, false],
        ['Converted', true, true],
      ],
    },
  ],
  HR_OPERATIONS: [
    {
      name: 'Recruitment',
      kind: 'FUNNEL',
      columns: [
        ['Applied', false, false],
        ['Interview', false, false],
        ['Offer', false, true],
        ['Hired', true, true],
      ],
    },
    {
      name: 'People journey',
      kind: 'CHECKLIST',
      columns: [
        ['To do', false, false],
        ['In progress', false, false],
        ['Done', true, true],
      ],
    },
  ],
  FINANCE_LEGAL: [
    {
      name: 'Request intake',
      kind: 'QUEUE',
      columns: [
        ['To do', false, false],
        ['Review', false, false],
        ['Approved', true, true],
      ],
    },
    {
      name: 'Audit tracker',
      kind: 'TRACKER',
      columns: [
        ['Open', false, false],
        ['Evidence', false, false],
        ['Closed', true, true],
      ],
    },
  ],
};

const person = { id: true, employeeId: true, firstName: true, lastName: true, position: true } as const;
const taskInclude = {
  column: true,
  board: { select: { id: true, name: true, columns: { orderBy: { position: 'asc' as const } } } },
  workspace: { select: { id: true, code: true, name: true, departmentId: true } },
  milestone: true,
  reporter: { select: person },
  assignee: { select: person },
  definitionOfDone: { orderBy: { createdAt: 'asc' as const } },
  outgoingLinks: { include: { targetTask: { select: { id: true, publicKey: true, title: true, column: true } } } },
  comments: { orderBy: { createdAt: 'desc' as const }, include: { author: { select: person } } },
  activity: { orderBy: { createdAt: 'desc' as const }, include: { actor: { select: person } }, take: 30 },
} satisfies Prisma.TaskInclude;

function display(employee: { firstName: string; lastName: string }) {
  return `${employee.firstName} ${employee.lastName}`;
}

@Injectable()
export class TaskService {
  constructor(private readonly db: DatabaseService) {}

  private manages(actor: Principal, departmentId: string) {
    return (
      actor.employee.position === 'SENIOR_DIRECTOR' ||
      (actor.employee.position === 'ACCOUNT_DIRECTOR' && actor.employee.departmentId === departmentId)
    );
  }

  private async workspaceAccess(actor: Principal, workspaceId: string, management = false) {
    const workspace = await this.db.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new NotFoundException('Workspace not found');
    if (management && !this.manages(actor, workspace.departmentId))
      throw new ForbiddenException('Workspace manager required');
    if (
      !management &&
      !this.manages(actor, workspace.departmentId) &&
      actor.employee.departmentId !== workspace.departmentId
    ) {
      const membership = await this.db.workspaceMembership.findFirst({
        where: { workspaceId, employeeId: actor.employee.id },
      });
      if (!membership) throw new NotFoundException('Workspace not found');
    }
    return workspace;
  }

  private async activity(
    tx: Transaction,
    taskId: string,
    actorId: string,
    actionType: TaskActivityType,
    fieldChanged?: string,
    oldValue?: Prisma.InputJsonValue,
    newValue?: Prisma.InputJsonValue,
  ) {
    return tx.taskActivityLog.create({
      data: { taskId, actorEmployeeId: actorId, actionType, fieldChanged, oldValue, newValue },
    });
  }

  async workspaces(actor: Principal) {
    const elevated = actor.employee.position === 'SENIOR_DIRECTOR';
    return this.db.workspace.findMany({
      where: elevated
        ? {}
        : {
            OR: [
              { departmentId: actor.employee.departmentId },
              { memberships: { some: { employeeId: actor.employee.id } } },
            ],
          },
      include: {
        department: true,
        boards: { include: { columns: { orderBy: { position: 'asc' } } } },
        milestones: { where: { status: 'OPEN' }, orderBy: { dueDate: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createWorkspace(actor: Principal, departmentId: string, fn: WorkspaceFunction) {
    if (actor.employee.position !== 'SENIOR_DIRECTOR') throw new ForbiddenException('Senior Director required');
    return this.db.transaction(async (tx) => {
      const department = await tx.department.findUnique({ where: { id: departmentId } });
      if (!department || department.status !== 'ACTIVE') throw new NotFoundException('Active department not found');
      const workspace = await tx.workspace.create({
        data: { departmentId, code: department.code, name: `${department.name} workspace`, function: fn },
      });
      for (const template of templates[fn]) await this.createBoardRecord(tx, workspace.id, template);
      const employees = await tx.employee.findMany({ where: { departmentId, status: 'ACTIVE' }, select: { id: true } });
      await tx.workspaceMembership.createMany({
        data: employees.map(({ id }) => ({ workspaceId: workspace.id, employeeId: id })),
      });
      await audit(tx, actor.employee.id, 'TASK_WORKSPACE_CREATED', 'Workspace', workspace.id, { function: fn });
      return workspace;
    });
  }

  private async createBoardRecord(
    tx: Transaction,
    workspaceId: string,
    board: { name: string; kind: string; columns: [string, boolean, boolean][] },
  ) {
    return tx.taskBoard.create({
      data: {
        workspaceId,
        name: board.name,
        kind: board.kind,
        columns: {
          create: board.columns.map(([name, isDone, managementLocked], position) => ({
            name,
            position,
            isInitial: position === 0,
            isDone,
            managementLocked,
          })),
        },
      },
      include: { columns: true },
    });
  }

  async createBoard(actor: Principal, workspaceId: string, dto: BoardDto) {
    await this.workspaceAccess(actor, workspaceId, true);
    if (dto.columns.length < 2 || dto.columns.some((c) => !c.name?.trim()))
      throw new BadRequestException('Provide at least two named columns');
    return this.db.transaction(async (tx) => {
      const board = await this.createBoardRecord(tx, workspaceId, {
        name: dto.name,
        kind: dto.kind ?? 'KANBAN',
        columns: dto.columns.map((c) => [c.name, !!c.isDone, !!c.managementLocked]),
      });
      await audit(tx, actor.employee.id, 'TASK_BOARD_CREATED', 'TaskBoard', board.id);
      return board;
    });
  }

  async addMembership(actor: Principal, workspaceId: string, dto: MembershipDto) {
    await this.workspaceAccess(actor, workspaceId, true);
    const employee = await this.db.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee || employee.status !== 'ACTIVE')
      throw new BadRequestException('Only active employees can join a workspace');
    let scopedMilestone: { startDate: Date; dueDate: Date } | null = null;
    if (dto.milestoneId) {
      scopedMilestone = await this.db.milestone.findFirst({
        where: { id: dto.milestoneId, workspaceId, status: 'OPEN' },
        select: { startDate: true, dueDate: true },
      });
      if (!scopedMilestone) throw new BadRequestException('Open milestone not found in this workspace');
    }
    return this.db.transaction(async (tx) => {
      const membership = await tx.workspaceMembership.create({
        data: {
          workspaceId,
          employeeId: dto.employeeId,
          milestoneId: dto.milestoneId,
          effectiveFrom: dto.effectiveFrom ? dateOnly(dto.effectiveFrom) : scopedMilestone?.startDate,
          effectiveTo: dto.effectiveTo ? dateOnly(dto.effectiveTo) : scopedMilestone?.dueDate,
        },
      });
      await audit(tx, actor.employee.id, 'TASK_MEMBERSHIP_CREATED', 'WorkspaceMembership', membership.id);
      return membership;
    });
  }

  async createMilestone(actor: Principal, workspaceId: string, dto: MilestoneDto) {
    await this.workspaceAccess(actor, workspaceId, true);
    const startDate = dateOnly(dto.startDate),
      dueDate = new Date(dto.dueDate);
    if (Number.isNaN(dueDate.valueOf()) || dueDate <= startDate)
      throw new BadRequestException('Due date must follow the start date');
    return this.db.transaction(async (tx) => {
      const milestone = await tx.milestone.create({
        data: { workspaceId, name: dto.name, goal: dto.goal, startDate, dueDate },
      });
      await audit(tx, actor.employee.id, 'TASK_MILESTONE_CREATED', 'Milestone', milestone.id);
      return milestone;
    });
  }

  async board(actor: Principal, workspaceId: string, boardId?: string) {
    const workspace = await this.workspaceAccess(actor, workspaceId);
    const board = await this.db.taskBoard.findFirst({
      where: { workspaceId, ...(boardId ? { id: boardId } : {}) },
      include: {
        columns: {
          orderBy: { position: 'asc' },
          include: {
            tasks: {
              where: { isDeleted: false },
              include: taskInclude,
              orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    });
    if (!board) throw new NotFoundException('Board not found');
    return { workspace, board };
  }

  async createTask(actor: Principal, dto: TaskDto) {
    const workspace = await this.workspaceAccess(actor, dto.workspaceId);
    const [board, assignee, milestone] = await Promise.all([
      this.db.taskBoard.findFirst({
        where: { id: dto.boardId, workspaceId: dto.workspaceId },
        include: { columns: { where: { isInitial: true } } },
      }),
      dto.assigneeId ? this.db.employee.findUnique({ where: { id: dto.assigneeId } }) : null,
      dto.milestoneId
        ? this.db.milestone.findFirst({ where: { id: dto.milestoneId, workspaceId: dto.workspaceId, status: 'OPEN' } })
        : null,
    ]);
    if (!board?.columns[0]) throw new BadRequestException('Board requires an initial column');
    if (dto.assigneeId && (!assignee || assignee.status !== 'ACTIVE'))
      throw new BadRequestException('Assignee must be active');
    if (dto.milestoneId && !milestone) throw new BadRequestException('Open milestone not found');
    const existingMembership = dto.assigneeId
      ? await this.db.workspaceMembership.findFirst({
          where: { workspaceId: workspace.id, employeeId: dto.assigneeId, milestoneId: null },
        })
      : null;
    if (assignee && assignee.departmentId !== workspace.departmentId && !existingMembership && !milestone)
      throw new BadRequestException('Cross-team assignment requires a milestone window');
    return this.db.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${workspace.id}::uuid FOR UPDATE`;
      const current = await tx.workspace.findUniqueOrThrow({ where: { id: workspace.id } });
      const task = await tx.task.create({
        data: {
          workspaceId: workspace.id,
          boardId: board.id,
          columnId: board.columns[0].id,
          number: current.nextTaskNumber,
          publicKey: `${workspace.code}-#${current.nextTaskNumber}`,
          title: dto.title,
          description: dto.description ?? '',
          priority: dto.priority,
          estimatedHours: dto.estimatedHours,
          reporterId: actor.employee.id,
          assigneeId: dto.assigneeId,
          milestoneId: dto.milestoneId,
          definitionOfDone: { create: (dto.definitionOfDone ?? []).filter(Boolean).map((item) => ({ item })) },
        },
        include: taskInclude,
      });
      await tx.workspace.update({ where: { id: workspace.id }, data: { nextTaskNumber: { increment: 1 } } });
      if (assignee && assignee.departmentId !== workspace.departmentId && !existingMembership && milestone) {
        const allocation = await tx.workspaceMembership.findFirst({
          where: { workspaceId: workspace.id, employeeId: assignee.id, milestoneId: milestone.id },
        });
        if (!allocation)
          await tx.workspaceMembership.create({
            data: {
              workspaceId: workspace.id,
              employeeId: assignee.id,
              milestoneId: milestone.id,
              effectiveFrom: milestone.startDate,
              effectiveTo: milestone.dueDate,
            },
          });
      }
      await this.activity(tx, task.id, actor.employee.id, 'CREATE', undefined, undefined, {
        publicKey: task.publicKey,
      });
      return task;
    });
  }

  async detail(actor: Principal, id: string, includeDeleted = false) {
    const task = await this.db.task.findFirst({
      where: { id, ...(includeDeleted ? {} : { isDeleted: false }) },
      include: taskInclude,
    });
    if (!task) throw new NotFoundException('Task not found');
    await this.workspaceAccess(actor, task.workspaceId);
    return task;
  }

  async edit(actor: Principal, id: string, dto: TaskEditDto) {
    const task = await this.detail(actor, id);
    const assigneeId = dto.clearAssignee ? null : dto.assigneeId;
    const targetMilestoneId = dto.clearMilestone ? null : (dto.milestoneId ?? task.milestoneId);
    const milestone = targetMilestoneId
      ? await this.db.milestone.findFirst({
          where: { id: targetMilestoneId, workspaceId: task.workspaceId, status: 'OPEN' },
        })
      : null;
    if (targetMilestoneId && !milestone) throw new BadRequestException('Open milestone not found');
    let employee: Employee | null = null;
    if (assigneeId) {
      employee = await this.db.employee.findUnique({ where: { id: assigneeId } });
      if (!employee || employee.status !== 'ACTIVE') throw new BadRequestException('Assignee must be active');
      const existingMembership = await this.db.workspaceMembership.findFirst({
        where: { workspaceId: task.workspaceId, employeeId: assigneeId, milestoneId: null },
      });
      if (employee.departmentId !== task.workspace.departmentId && !existingMembership && !milestone)
        throw new BadRequestException('Cross-team assignment requires a milestone window');
    }
    const data = {
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      estimatedHours: dto.estimatedHours,
      ...(dto.clearAssignee || dto.assigneeId ? { assigneeId } : {}),
      ...(dto.clearMilestone ? { milestoneId: null } : dto.milestoneId ? { milestoneId: dto.milestoneId } : {}),
    };
    return this.db.transaction(async (tx) => {
      if (employee && employee.departmentId !== task.workspace.departmentId && milestone) {
        const allocation = await tx.workspaceMembership.findFirst({
          where: { workspaceId: task.workspaceId, employeeId: employee.id, milestoneId: milestone.id },
        });
        if (!allocation)
          await tx.workspaceMembership.create({
            data: {
              workspaceId: task.workspaceId,
              employeeId: employee.id,
              milestoneId: milestone.id,
              effectiveFrom: milestone.startDate,
              effectiveTo: milestone.dueDate,
            },
          });
      }
      const updated = await tx.task.update({ where: { id }, data, include: taskInclude });
      await this.activity(
        tx,
        id,
        actor.employee.id,
        'UPDATE_FIELD',
        'task',
        { title: task.title, assigneeId: task.assigneeId, estimatedHours: task.estimatedHours },
        { title: updated.title, assigneeId: updated.assigneeId, estimatedHours: updated.estimatedHours },
      );
      return updated;
    });
  }

  async move(actor: Principal, id: string, columnId: string) {
    const task = await this.detail(actor, id);
    const column = await this.db.taskColumn.findFirst({ where: { id: columnId, boardId: task.boardId } });
    if (!column) throw new BadRequestException('Column is not on this board');
    if (column.managementLocked && !task.isManagementApproved && actor.employee.position !== 'SENIOR_DIRECTOR')
      throw new ForbiddenException('Management sign-off is required');
    if (column.isDone && task.definitionOfDone.some((item) => !item.isChecked))
      throw new BadRequestException('Complete every Definition of Done item first');
    const blockers = task.outgoingLinks.filter((link) => link.type === 'BLOCKED_BY' && !link.targetTask.column.isDone);
    if (!task.column.isInitial && blockers.length && actor.employee.position !== 'SENIOR_DIRECTOR')
      throw new BadRequestException('Resolve blocking tasks before advancing this task');
    if (task.column.isInitial && !column.isInitial && blockers.length && actor.employee.position !== 'SENIOR_DIRECTOR')
      throw new BadRequestException('Resolve blocking tasks before advancing this task');
    return this.db.transaction(async (tx) => {
      const updated = await tx.task.update({ where: { id }, data: { columnId }, include: taskInclude });
      await this.activity(tx, id, actor.employee.id, 'COLUMN_CHANGE', 'columnId', task.columnId, columnId);
      return updated;
    });
  }

  async approve(actor: Principal, id: string, approved: boolean) {
    const task = await this.detail(actor, id);
    if (!this.manages(actor, task.workspace.departmentId))
      throw new ForbiddenException('Account Director or Senior Director required');
    return this.db.transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id },
        data: { isManagementApproved: approved },
        include: taskInclude,
      });
      await this.activity(
        tx,
        id,
        actor.employee.id,
        'UPDATE_FIELD',
        'isManagementApproved',
        task.isManagementApproved,
        approved,
      );
      return updated;
    });
  }

  async escalate(actor: Principal, id: string, escalated: boolean) {
    const task = await this.detail(actor, id);
    if (!this.manages(actor, task.workspace.departmentId) || actor.employee.position === 'MEMBER')
      throw new ForbiddenException('Director required');
    return this.db.transaction(async (tx) => {
      const updated = await tx.task.update({ where: { id }, data: { isEscalated: escalated }, include: taskInclude });
      await this.activity(tx, id, actor.employee.id, 'UPDATE_FIELD', 'isEscalated', task.isEscalated, escalated);
      if (escalated) {
        const directors = await tx.employee.findMany({
          where: { position: 'SENIOR_DIRECTOR', status: 'ACTIVE' },
          select: { id: true },
        });
        for (const director of directors)
          await notify(tx, director.id, 'TASK_ESCALATED', 'Task', id, `task-escalated:${id}`);
      }
      return updated;
    });
  }

  async remove(actor: Principal, id: string) {
    const task = await this.detail(actor, id);
    if (task.reporterId !== actor.employee.id && !this.manages(actor, task.workspace.departmentId))
      throw new ForbiddenException('Reporter or manager required');
    return this.db.transaction(async (tx) => {
      await tx.task.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date(), lastColumnId: task.columnId },
      });
      await this.activity(tx, id, actor.employee.id, 'DELETION', 'isDeleted', false, true);
      return { id, deleted: true };
    });
  }

  async restore(actor: Principal, id: string) {
    const task = await this.detail(actor, id, true);
    if (!task.isDeleted) throw new ConflictException('Task is already active');
    if (!this.manages(actor, task.workspace.departmentId)) throw new ForbiddenException('Workspace manager required');
    return this.db.transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id },
        data: { isDeleted: false, deletedAt: null, columnId: task.lastColumnId ?? task.columnId },
        include: taskInclude,
      });
      await this.activity(tx, id, actor.employee.id, 'RESTORATION', 'isDeleted', true, false);
      return updated;
    });
  }

  async addDod(actor: Principal, id: string, item: string) {
    await this.detail(actor, id);
    return this.db.transaction(async (tx) => {
      const created = await tx.definitionOfDone.create({ data: { taskId: id, item } });
      await this.activity(tx, id, actor.employee.id, 'UPDATE_FIELD', 'definitionOfDone', undefined, {
        id: created.id,
        item,
      });
      return created;
    });
  }

  async checkDod(actor: Principal, taskId: string, itemId: string, isChecked: boolean) {
    await this.detail(actor, taskId);
    const item = await this.db.definitionOfDone.findFirst({ where: { id: itemId, taskId } });
    if (!item) throw new NotFoundException('Definition of Done item not found');
    return this.db.transaction(async (tx) => {
      const updated = await tx.definitionOfDone.update({ where: { id: itemId }, data: { isChecked } });
      await this.activity(tx, taskId, actor.employee.id, 'UPDATE_FIELD', 'definitionOfDone', item.isChecked, isChecked);
      return updated;
    });
  }

  private async dependencyPath(sourceId: string, wantedId: string) {
    const seen = new Set<string>(),
      queue = [sourceId];
    while (queue.length) {
      const id = queue.shift()!;
      if (id === wantedId) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      const links = await this.db.taskLink.findMany({
        where: { sourceTaskId: id, type: 'BLOCKED_BY' },
        select: { targetTaskId: true },
      });
      queue.push(...links.map((link) => link.targetTaskId));
    }
    return false;
  }

  async link(actor: Principal, sourceTaskId: string, targetTaskId: string, type: TaskLinkType) {
    const [source, target] = await Promise.all([this.detail(actor, sourceTaskId), this.detail(actor, targetTaskId)]);
    if (source.id === target.id) throw new UnprocessableEntityException('A task cannot depend on itself');
    if (type === 'BLOCKED_BY' && (await this.dependencyPath(target.id, source.id)))
      throw new UnprocessableEntityException('This dependency would create a cycle');
    return this.db.transaction(async (tx) => {
      const link = await tx.taskLink.create({ data: { sourceTaskId, targetTaskId, type } });
      await this.activity(tx, sourceTaskId, actor.employee.id, 'UPDATE_FIELD', 'links', undefined, {
        targetTaskId,
        type,
      });
      return link;
    });
  }

  async comment(actor: Principal, taskId: string, body: string) {
    await this.detail(actor, taskId);
    return this.db.transaction(async (tx) => {
      const comment = await tx.taskComment.create({
        data: { taskId, authorId: actor.employee.id, body },
        include: { author: { select: person } },
      });
      await this.activity(tx, taskId, actor.employee.id, 'UPDATE_FIELD', 'comment', undefined, {
        commentId: comment.id,
      });
      return comment;
    });
  }

  async closeMilestone(actor: Principal, id: string) {
    const milestone = await this.db.milestone.findUnique({ where: { id }, include: { workspace: true } });
    if (!milestone) throw new NotFoundException('Milestone not found');
    await this.workspaceAccess(actor, milestone.workspaceId, true);
    return this.db.transaction(async (tx) => {
      const next = await tx.milestone.findFirst({
        where: {
          workspaceId: milestone.workspaceId,
          status: 'OPEN',
          id: { not: id },
          dueDate: { gt: milestone.dueDate },
        },
        orderBy: { dueDate: 'asc' },
      });
      const active = await tx.task.findMany({
        where: { milestoneId: id, isDeleted: false, column: { isDone: false } },
        select: { id: true, milestoneId: true },
      });
      for (const task of active) {
        await tx.task.update({ where: { id: task.id }, data: { milestoneId: next?.id ?? null } });
        await this.activity(tx, task.id, actor.employee.id, 'UPDATE_FIELD', 'milestoneId', id, {
          milestoneId: next?.id ?? null,
        });
      }
      const closed = await tx.milestone.update({ where: { id }, data: { status: 'CLOSED' } });
      await audit(tx, actor.employee.id, 'TASK_MILESTONE_CLOSED', 'Milestone', id, {
        rolledTasks: active.length,
      });
      return closed;
    });
  }

  async myTasks(actor: Principal) {
    return this.db.task.findMany({
      where: { assigneeId: actor.employee.id, isDeleted: false },
      include: taskInclude,
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async archived(actor: Principal) {
    if (actor.employee.position === 'MEMBER') throw new ForbiddenException('Workspace manager required');
    return this.db.task.findMany({
      where: {
        isDeleted: true,
        ...(actor.employee.position === 'SENIOR_DIRECTOR'
          ? {}
          : { workspace: { departmentId: actor.employee.departmentId } }),
      },
      include: taskInclude,
      orderBy: { deletedAt: 'desc' },
    });
  }

  async reporting(actor: Principal) {
    const workspaceWhere =
      actor.employee.position === 'SENIOR_DIRECTOR'
        ? {}
        : actor.employee.position === 'ACCOUNT_DIRECTOR'
          ? { departmentId: actor.employee.departmentId }
          : { memberships: { some: { employeeId: actor.employee.id } } };
    const workspaces = await this.db.workspace.findMany({
      where: workspaceWhere,
      include: {
        tasks: { where: { isDeleted: false }, include: { column: true } },
        milestones: { where: { status: 'OPEN' } },
      },
    });
    return workspaces.map((workspace) => ({
      id: workspace.id,
      code: workspace.code,
      name: workspace.name,
      total: workspace.tasks.length,
      completed: workspace.tasks.filter((task) => task.column.isDone).length,
      unassigned: workspace.tasks.filter((task) => !task.assigneeId && !task.column.isDone).length,
      escalated: workspace.tasks.filter((task) => task.isEscalated).length,
      estimatedHours: workspace.tasks
        .filter((task) => !task.column.isDone)
        .reduce((sum, task) => sum + task.estimatedHours, 0),
      openMilestones: workspace.milestones.length,
    }));
  }

  async capacity(actor: Principal, milestoneId: string) {
    const milestone = await this.db.milestone.findUnique({
      where: { id: milestoneId },
      include: { workspace: true, tasks: { where: { isDeleted: false }, include: { column: true } } },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');
    await this.workspaceAccess(actor, milestone.workspaceId);
    const end = new Date(milestone.dueDate),
      start = new Date(milestone.startDate);
    const [base, borrowed, holidays] = await Promise.all([
      this.db.employee.findMany({
        where: { departmentId: milestone.workspace.departmentId, status: 'ACTIVE' },
        select: { id: true, firstName: true, lastName: true },
      }),
      this.db.workspaceMembership.findMany({
        where: { workspaceId: milestone.workspaceId, milestoneId },
        include: { employee: { select: { id: true, firstName: true, lastName: true, status: true } } },
      }),
      this.db.holiday.findMany({ where: { active: true, date: { gte: start, lte: end } }, select: { date: true } }),
    ]);
    const members = new Map(base.map((employee) => [employee.id, employee]));
    const borrowedAway = await this.db.workspaceMembership.findMany({
      where: {
        workspaceId: { not: milestone.workspaceId },
        milestoneId: { not: null },
        employeeId: { in: [...members.keys()] },
        effectiveFrom: { lte: end },
        effectiveTo: { gte: start },
      },
      select: { employeeId: true },
    });
    for (const allocation of borrowedAway) members.delete(allocation.employeeId);
    for (const membership of borrowed)
      if (membership.employee.status === 'ACTIVE') members.set(membership.employee.id, membership.employee);
    const holidaySet = new Set(holidays.map(({ date }) => date.toISOString().slice(0, 10)));
    let businessDays = 0;
    for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1))
      if (cursor.getUTCDay() > 0 && cursor.getUTCDay() < 6 && !holidaySet.has(cursor.toISOString().slice(0, 10)))
        businessDays++;
    const approvedLeave = await this.db.leaveRequestDay.count({
      where: {
        date: { gte: start, lte: end },
        request: { status: 'APPROVED', employeeId: { in: [...members.keys()] } },
      },
    });
    const availableHours = Math.max(0, members.size * businessDays * 8 - approvedLeave * 8);
    const plannedHours = milestone.tasks
      .filter((task) => !task.column.isDone)
      .reduce((sum, task) => sum + task.estimatedHours, 0);
    const isOvercapacity = plannedHours > availableHours;
    if (milestone.isOvercapacity !== isOvercapacity)
      await this.db.milestone.update({ where: { id: milestone.id }, data: { isOvercapacity } });
    return {
      milestoneId,
      collaborators: [...members.values()].map((employee) => ({ id: employee.id, name: display(employee) })),
      businessDays,
      approvedLeaveDays: approvedLeave,
      availableHours,
      available: formatEstimation(availableHours),
      plannedHours,
      planned: formatEstimation(plannedHours),
      remainingHours: availableHours - plannedHours,
      isOvercapacity,
    };
  }
}
