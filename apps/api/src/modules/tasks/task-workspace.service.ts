import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { TaskManagementType, WorkspaceFunction } from '../../generated/prisma/client';
import { dateOnly } from '../../common/dates';
import { audit } from '../audit/audit';
import type { Principal } from '../authorization/authorization';
import type { Transaction } from '../database/database.module';
import type { BoardDto, CollaboratorDto, MembershipDto, MilestoneDto, SprintDto } from './task.dto';
import { TaskBaseService, person, taskInclude } from './task-base.service';
import { workspaceTemplates } from './task-templates';

const boardColumns: Record<TaskManagementType, [string, boolean, boolean][]> = {
  KANBAN: [
    ['To do', false, false],
    ['In progress', false, false],
    ['Review', false, false],
    ['Done', true, true],
  ],
  SCRUM: [
    ['Backlog', false, false],
    ['To do', false, false],
    ['In progress', false, false],
    ['Review', false, false],
    ['Done', true, true],
  ],
  LIST: [
    ['Open', false, false],
    ['Done', true, false],
  ],
};

export abstract class TaskWorkspaceService extends TaskBaseService {
  async workspaces(actor: Principal) {
    const elevated = actor.employee.position === 'SENIOR_DIRECTOR';
    return this.db.workspace.findMany({
      where: elevated
        ? {}
        : {
            OR: [
              { departmentId: actor.employee.departmentId! },
              { memberships: { some: { employeeId: actor.employee.id } } },
            ],
          },
      include: {
        department: true,
        memberships: { where: { milestoneId: null }, include: { employee: { select: person } } },
        boards: {
          where: { status: 'ACTIVE' },
          include: {
            columns: { orderBy: { position: 'asc' } },
            creator: { select: person },
            collaborators: { include: { employee: { select: person } } },
            sprints: { orderBy: { startDate: 'desc' } },
          },
        },
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
      for (const template of workspaceTemplates[fn]) {
        const kind = template.kind;
        if (department.taskManagementTypes.includes(kind)) {
          await this.createBoardRecord(tx, workspace.id, actor.employee.id, template.name, kind, template.columns);
        }
      }
      const employees = await tx.employee.findMany({ where: { departmentId, status: 'ACTIVE' }, select: { id: true } });
      await tx.workspaceMembership.createMany({
        data: employees.map(({ id }) => ({ workspaceId: workspace.id, employeeId: id })),
      });
      await audit(tx, actor.employee.id, 'TASK_WORKSPACE_CREATED', 'Workspace', workspace.id, { function: fn });
      return workspace;
    });
  }

  private createBoardRecord(
    tx: Transaction,
    workspaceId: string,
    creatorId: string,
    name: string,
    kind: TaskManagementType,
    columns: [string, boolean, boolean][],
  ) {
    return tx.taskBoard.create({
      data: {
        workspaceId,
        creatorId,
        name,
        kind,
        columns: {
          create: columns.map(([columnName, isDone, managementLocked], position) => ({
            name: columnName,
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
    const workspace = await this.canCreate(actor, workspaceId, 'boards');
    const department = await this.db.department.findUniqueOrThrow({ where: { id: workspace.departmentId } });
    const kind = dto.kind ?? 'KANBAN';
    if (!department.taskManagementTypes.includes(kind)) {
      throw new BadRequestException(`${kind.toLowerCase()} boards are not enabled for this department`);
    }
    const columns = dto.columns?.length
      ? dto.columns.map(
          (column) => [column.name, !!column.isDone, !!column.managementLocked] as [string, boolean, boolean],
        )
      : boardColumns[kind];
    if (columns.length < 2 || columns.some(([name]) => !name.trim()))
      throw new BadRequestException('Provide at least two named columns');
    return this.db.transaction(async (tx) => {
      const board = await this.createBoardRecord(tx, workspaceId, actor.employee.id, dto.name, kind, columns);
      await tx.boardCollaborator.create({ data: { boardId: board.id, employeeId: actor.employee.id } });
      await audit(tx, actor.employee.id, 'TASK_BOARD_CREATED', 'TaskBoard', board.id, { kind });
      return board;
    });
  }

  async addMembership(actor: Principal, workspaceId: string, dto: MembershipDto) {
    const workspace = await this.workspaceAccess(actor, workspaceId, true);
    const employee = await this.db.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee || employee.status !== 'ACTIVE' || employee.departmentId !== workspace.departmentId) {
      throw new BadRequestException('Choose an active member of this department');
    }
    return this.db.transaction(async (tx) => {
      const existing = await tx.workspaceMembership.findFirst({
        where: { workspaceId, employeeId: dto.employeeId, milestoneId: null },
      });
      const data = {
        canCreateTasks: dto.canCreateTasks ?? existing?.canCreateTasks ?? false,
        canCreateBoards: dto.canCreateBoards ?? existing?.canCreateBoards ?? false,
      };
      const membership = existing
        ? await tx.workspaceMembership.update({ where: { id: existing.id }, data })
        : await tx.workspaceMembership.create({ data: { workspaceId, employeeId: dto.employeeId, ...data } });
      await audit(tx, actor.employee.id, 'TASK_PERMISSIONS_CHANGED', 'WorkspaceMembership', membership.id, data);
      return membership;
    });
  }

  async addCollaborator(actor: Principal, boardId: string, dto: CollaboratorDto) {
    const board = await this.db.taskBoard.findUnique({ where: { id: boardId }, include: { workspace: true } });
    if (!board) throw new NotFoundException('Board not found');
    if (board.creatorId !== actor.employee.id) await this.workspaceAccess(actor, board.workspaceId, true);
    const employee = await this.db.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee || employee.status !== 'ACTIVE' || employee.departmentId !== board.workspace.departmentId) {
      throw new BadRequestException('Collaborators must be active members of this department');
    }
    return this.db.boardCollaborator.upsert({
      where: { boardId_employeeId: { boardId, employeeId: employee.id } },
      create: { boardId, employeeId: employee.id },
      update: {},
    });
  }

  async createMilestone(actor: Principal, workspaceId: string, dto: MilestoneDto) {
    await this.workspaceAccess(actor, workspaceId, true);
    const startDate = dateOnly(dto.startDate),
      dueDate = new Date(dto.dueDate);
    if (Number.isNaN(dueDate.valueOf()) || dueDate <= startDate)
      throw new BadRequestException('Due date must follow start date');
    return this.db.milestone.create({ data: { workspaceId, name: dto.name, goal: dto.goal, startDate, dueDate } });
  }

  async createSprint(actor: Principal, boardId: string, dto: SprintDto) {
    const board = await this.db.taskBoard.findUnique({ where: { id: boardId } });
    if (!board) throw new NotFoundException('Board not found');
    if (board.creatorId !== actor.employee.id) await this.workspaceAccess(actor, board.workspaceId, true);
    if (board.kind !== 'SCRUM') throw new BadRequestException('Sprints are only available on Scrum boards');
    const startDate = dateOnly(dto.startDate),
      endDate = dateOnly(dto.endDate);
    if (endDate <= startDate) throw new BadRequestException('End date must follow start date');
    return this.db.sprint.create({ data: { boardId, name: dto.name, goal: dto.goal, startDate, endDate } });
  }

  async changeSprintStatus(actor: Principal, sprintId: string, status: 'ACTIVE' | 'COMPLETED') {
    const sprint = await this.db.sprint.findUnique({ where: { id: sprintId }, include: { board: true } });
    if (!sprint) throw new NotFoundException('Sprint not found');
    if (sprint.board.creatorId !== actor.employee.id) await this.workspaceAccess(actor, sprint.board.workspaceId, true);
    if (sprint.status === 'COMPLETED') throw new ConflictException('Completed sprints cannot be reopened');
    return this.db.transaction(async (tx) => {
      if (status === 'ACTIVE') {
        const active = await tx.sprint.findFirst({ where: { boardId: sprint.boardId, status: 'ACTIVE' } });
        if (active && active.id !== sprint.id) throw new ConflictException('This board already has an active sprint');
      }
      return tx.sprint.update({ where: { id: sprintId }, data: { status } });
    });
  }

  async board(actor: Principal, workspaceId: string, boardId?: string) {
    const workspace = await this.workspaceAccess(actor, workspaceId);
    const board = await this.db.taskBoard.findFirst({
      where: { workspaceId, status: 'ACTIVE', ...(boardId ? { id: boardId } : {}) },
      include: {
        creator: { select: person },
        collaborators: { include: { employee: { select: person } } },
        sprints: { orderBy: { startDate: 'desc' } },
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
    const department = await this.db.department.findUniqueOrThrow({ where: { id: workspace.departmentId } });
    const people = await this.db.employee.findMany({
      where: { departmentId: workspace.departmentId, status: 'ACTIVE' },
      select: {
        ...person,
        _count: {
          select: {
            task_assignee: {
              where: {
                isDeleted: false,
                board: { kind: 'KANBAN' },
                column: { name: { equals: 'In progress', mode: 'insensitive' } },
              },
            },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return {
      workspace,
      board,
      wip: people.map(({ _count, ...employee }) => ({
        ...employee,
        used: _count.task_assignee,
        limit: department.kanbanWipLimit,
      })),
    };
  }
}
