import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { TaskColumnSemantic, TaskManagementType, WorkspaceFunction } from '../../generated/prisma/client';
import { dateOnly } from '../../common/dates';
import { audit } from '../audit/audit';
import type { Principal } from '../authorization/authorization';
import type { Transaction } from '../database/database.module';
import type { BoardDto, MembershipDto } from './task.dto';
import { TaskBaseService, person, taskInclude } from './task-base.service';
import { workspaceTemplates } from './task-templates';

type ColumnDefinition = [string, boolean, boolean, TaskColumnSemantic?];

const boardColumns: Record<TaskManagementType, ColumnDefinition[]> = {
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

function semantic(kind: TaskManagementType, name: string, isDone: boolean, position: number): TaskColumnSemantic {
  if (isDone) return 'DONE';
  const normalized = name.trim().toLowerCase();
  if (normalized === 'in progress') return 'IN_PROGRESS';
  if (normalized === 'review') return 'REVIEW';
  if (normalized === 'backlog') return 'BACKLOG';
  if (kind === 'LIST' && position === 0) return 'OPEN';
  return 'TODO';
}

export abstract class TaskWorkspaceService extends TaskBaseService {
  async workspaces(actor: Principal) {
    const where =
      actor.employee.position === 'MANAGING_DIRECTOR'
        ? {}
        : actor.employee.position === 'SENIOR_DIRECTOR'
          ? { departmentId: actor.employee.departmentId! }
          : { teamId: actor.employee.teamId ?? '00000000-0000-0000-0000-000000000000' };
    return this.db.workspace.findMany({
      where,
      include: {
        department: true,
        team: true,
        memberships: { where: { milestoneId: null }, include: { employee: { select: person } } },
        boards: {
          include: {
            columns: { orderBy: { position: 'asc' } },
            creator: { select: person },
            milestone: true,
          },
          orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        },
        milestones: { where: { status: 'OPEN' }, orderBy: { dueDate: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createWorkspace(actor: Principal, departmentId: string, teamId: string, fn: WorkspaceFunction) {
    if (!['MANAGING_DIRECTOR', 'SENIOR_DIRECTOR'].includes(actor.employee.position))
      throw new ForbiddenException('Department leadership required');
    return this.db.transaction(async (tx) => {
      const department = await tx.department.findUnique({ where: { id: departmentId } });
      if (!department || department.status !== 'ACTIVE') throw new NotFoundException('Active department not found');
      if (actor.employee.position === 'SENIOR_DIRECTOR' && actor.employee.departmentId !== departmentId)
        throw new ForbiddenException('Senior Directors can provision workspaces only in their department');
      const team = await tx.team.findFirst({ where: { id: teamId, departmentId, status: 'ACTIVE' } });
      if (!team) throw new NotFoundException('Active team not found');
      const workspace = await tx.workspace.create({
        data: {
          departmentId,
          teamId,
          code: `${department.code}-${team.code}`,
          name: `${team.name} workspace`,
          function: fn,
        },
      });
      for (const template of workspaceTemplates[fn]) {
        const kind = template.kind;
        if (team.taskManagementTypes.includes(kind)) {
          await this.createBoardRecord(tx, workspace.id, actor.employee.id, template.name, kind, template.columns);
        }
      }
      const employees = await tx.employee.findMany({ where: { teamId, status: 'ACTIVE' }, select: { id: true } });
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
    columns: ColumnDefinition[],
  ) {
    return tx.taskBoard.create({
      data: {
        workspaceId,
        creatorId,
        name,
        kind,
        columns: {
          create: columns.map(([columnName, isDone, managementLocked, columnSemantic], position) => ({
            name: columnName,
            semantic: columnSemantic ?? semantic(kind, columnName, isDone, position),
            position,
            isInitial: position === 0,
            isDone,
            managementLocked,
          })),
        },
      },
      include: { columns: true, milestone: true },
    });
  }

  async createBoard(actor: Principal, workspaceId: string, dto: BoardDto) {
    const workspace = await this.canCreate(actor, workspaceId, 'boards');
    const team = await this.db.team.findUniqueOrThrow({ where: { id: workspace.teamId } });
    const kind = dto.kind ?? 'KANBAN';
    if (!team.taskManagementTypes.includes(kind)) {
      throw new BadRequestException(`${kind.toLowerCase()} boards are not enabled for this team`);
    }
    const columns = dto.columns?.length
      ? dto.columns.map(
          (column) => [column.name, !!column.isDone, !!column.managementLocked, column.semantic] as ColumnDefinition,
        )
      : boardColumns[kind];
    if (columns.length < 2 || columns.some(([name]) => !name.trim()))
      throw new BadRequestException('Provide at least two named columns');
    const milestoneFields = [dto.milestoneGoal, dto.milestoneStartDate, dto.milestoneDueDate];
    if (kind === 'SCRUM' && milestoneFields.some((value) => !value))
      throw new BadRequestException('Scrum boards require a sprint goal, start date, and due date');
    if (kind !== 'SCRUM' && milestoneFields.some(Boolean))
      throw new BadRequestException('Milestones are only available on Scrum boards');
    const milestoneStartDate = dto.milestoneStartDate ? dateOnly(dto.milestoneStartDate) : undefined;
    const milestoneDueDate = dto.milestoneDueDate ? dateOnly(dto.milestoneDueDate) : undefined;
    if (milestoneStartDate && milestoneDueDate && milestoneDueDate <= milestoneStartDate)
      throw new BadRequestException('Milestone due date must follow its start date');
    return this.db.transaction(async (tx) => {
      const board = await this.createBoardRecord(tx, workspaceId, actor.employee.id, dto.name, kind, columns);
      if (kind === 'SCRUM') {
        await tx.milestone.create({
          data: {
            workspaceId,
            boardId: board.id,
            name: dto.name,
            goal: dto.milestoneGoal!,
            startDate: milestoneStartDate!,
            dueDate: milestoneDueDate!,
          },
        });
      }
      await audit(tx, actor.employee.id, 'TASK_BOARD_CREATED', 'TaskBoard', board.id, { kind });
      return tx.taskBoard.findUniqueOrThrow({
        where: { id: board.id },
        include: { columns: true, milestone: true },
      });
    });
  }

  async addMembership(actor: Principal, workspaceId: string, dto: MembershipDto) {
    const workspace = await this.workspaceAccess(actor, workspaceId, true);
    const employee = await this.db.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee || employee.status !== 'ACTIVE' || employee.teamId !== workspace.teamId) {
      throw new BadRequestException('Choose an active member of this team');
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

  async board(actor: Principal, workspaceId: string, boardId?: string) {
    const workspace = await this.workspaceAccess(actor, workspaceId);
    const board = await this.db.taskBoard.findFirst({
      where: { workspaceId, ...(boardId ? { id: boardId } : { status: 'ACTIVE' }) },
      include: {
        creator: { select: person },
        milestone: true,
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
    await this.boardAccess(actor, board.id);
    const team = await this.db.team.findUniqueOrThrow({ where: { id: workspace.teamId } });
    const people = await this.db.employee.findMany({
      where: { teamId: workspace.teamId, status: 'ACTIVE' },
      select: {
        ...person,
        _count: {
          select: {
            task_assignee: {
              where: {
                isDeleted: false,
                board: { kind: 'KANBAN' },
                column: { semantic: 'IN_PROGRESS' },
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
        limit: team.kanbanWipLimit,
      })),
    };
  }
}
