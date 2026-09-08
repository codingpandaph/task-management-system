import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { WorkspaceFunction } from '../../generated/prisma/client';
import { dateOnly } from '../../common/dates';
import { audit } from '../audit/audit';
import type { Principal } from '../authorization/authorization';
import type { Transaction } from '../database/database.module';
import type { BoardDto, MembershipDto, MilestoneDto } from './task.dto';
import { TaskBaseService, taskInclude } from './task-base.service';
import { workspaceTemplates } from './task-templates';

export abstract class TaskWorkspaceService extends TaskBaseService {
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
        memberships: { where: { employeeId: actor.employee.id, milestoneId: null } },
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
      for (const template of workspaceTemplates[fn]) await this.createBoardRecord(tx, workspace.id, template);
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
    await this.canCreate(actor, workspaceId, 'boards');
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
      const existing = await tx.workspaceMembership.findFirst({
        where: { workspaceId, employeeId: dto.employeeId, milestoneId: dto.milestoneId ?? null },
      });
      const data = {
        effectiveFrom: dto.effectiveFrom ? dateOnly(dto.effectiveFrom) : scopedMilestone?.startDate,
        effectiveTo: dto.effectiveTo ? dateOnly(dto.effectiveTo) : scopedMilestone?.dueDate,
        canCreateTasks: dto.canCreateTasks ?? existing?.canCreateTasks ?? false,
        canCreateBoards: dto.canCreateBoards ?? existing?.canCreateBoards ?? false,
      };
      const membership = existing
        ? await tx.workspaceMembership.update({ where: { id: existing.id }, data })
        : await tx.workspaceMembership.create({
            data: { workspaceId, employeeId: dto.employeeId, milestoneId: dto.milestoneId, ...data },
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
}
