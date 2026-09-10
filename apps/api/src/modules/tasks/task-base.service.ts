import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Prisma, TaskActivityType } from '../../generated/prisma/client';
import type { Principal } from '../authorization/authorization';
import { DatabaseService, type Transaction } from '../database/database.module';

export const person = { id: true, employeeId: true, firstName: true, lastName: true, position: true } as const;
export const taskInclude = {
  column: true,
  board: {
    select: {
      id: true,
      name: true,
      kind: true,
      status: true,
      columns: { orderBy: { position: 'asc' as const } },
    },
  },
  workspace: { select: { id: true, code: true, name: true, departmentId: true, teamId: true } },
  milestone: true,
  reporter: { select: person },
  assignee: { select: person },
  outgoingLinks: { include: { targetTask: { select: { id: true, publicKey: true, title: true, column: true } } } },
  comments: { orderBy: { createdAt: 'desc' as const }, include: { author: { select: person } } },
  attachments: { orderBy: { createdAt: 'desc' as const } },
  mentions: { include: { employee: { select: person } }, orderBy: { createdAt: 'desc' as const } },
  activity: { orderBy: { createdAt: 'desc' as const }, include: { actor: { select: person } }, take: 30 },
} satisfies Prisma.TaskInclude;

export function display(employee: { firstName: string; lastName: string }) {
  return `${employee.firstName} ${employee.lastName}`;
}

export abstract class TaskBaseService {
  constructor(protected readonly db: DatabaseService) {}
  protected manages(actor: Principal, workspace: { departmentId: string; teamId: string }) {
    return actor.employee.position === 'ACCOUNT_DIRECTOR' && actor.employee.teamId === workspace.teamId;
  }

  protected oversees(actor: Principal, workspace: { departmentId: string }) {
    return (
      actor.employee.position === 'MANAGING_DIRECTOR' ||
      (actor.employee.position === 'SENIOR_DIRECTOR' && actor.employee.departmentId === workspace.departmentId)
    );
  }

  protected requireParticipant(actor: Principal, workspace: { teamId: string }) {
    if (actor.employee.teamId !== workspace.teamId) throw new ForbiddenException('Team participation required');
  }

  protected async workspaceAccess(actor: Principal, workspaceId: string, management = false) {
    const workspace = await this.db.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new NotFoundException('Workspace not found');
    if (management && !this.manages(actor, workspace)) throw new ForbiddenException('Workspace manager required');
    if (!management && !this.oversees(actor, workspace) && actor.employee.teamId !== workspace.teamId) {
      throw new NotFoundException('Workspace not found');
    }
    return workspace;
  }

  protected async canCreate(actor: Principal, workspaceId: string, capability: 'tasks' | 'boards') {
    const workspace = await this.workspaceAccess(actor, workspaceId);
    if (this.manages(actor, workspace)) return workspace;
    const membership = await this.db.workspaceMembership.findFirst({
      where: { workspaceId, employeeId: actor.employee.id, milestoneId: null },
    });
    const allowed = capability === 'tasks' ? membership?.canCreateTasks : membership?.canCreateBoards;
    if (!allowed) throw new ForbiddenException(`Workspace ${capability} permission required`);
    return workspace;
  }

  protected async boardAccess(actor: Principal, boardId: string) {
    const board = await this.db.taskBoard.findUnique({
      where: { id: boardId },
      include: { workspace: true },
    });
    if (!board) throw new NotFoundException('Board not found');
    await this.workspaceAccess(actor, board.workspaceId);
    return board;
  }

  protected async enforceWip(tx: Transaction, teamId: string, assigneeId: string | null | undefined, taskId?: string) {
    if (!assigneeId) return;
    await tx.$queryRaw`SELECT id FROM "Employee" WHERE id = ${assigneeId}::uuid FOR UPDATE`;
    const team = await tx.team.findUniqueOrThrow({ where: { id: teamId } });
    const used = await tx.task.count({
      where: {
        id: taskId ? { not: taskId } : undefined,
        assigneeId,
        isDeleted: false,
        workspace: { teamId },
        board: { kind: 'KANBAN' },
        column: { semantic: 'IN_PROGRESS' },
      },
    });
    if (used >= team.kanbanWipLimit) {
      throw new ConflictException(`This person already has ${used} of ${team.kanbanWipLimit} tasks in progress`);
    }
  }

  protected async activity(
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
}
