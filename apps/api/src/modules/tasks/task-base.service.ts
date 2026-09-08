import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Prisma, TaskActivityType } from '../../generated/prisma/client';
import type { Principal } from '../authorization/authorization';
import { DatabaseService, type Transaction } from '../database/database.module';

export const person = { id: true, employeeId: true, firstName: true, lastName: true, position: true } as const;
export const taskInclude = {
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

export function display(employee: { firstName: string; lastName: string }) {
  return `${employee.firstName} ${employee.lastName}`;
}

export abstract class TaskBaseService {
  constructor(protected readonly db: DatabaseService) {}
  protected manages(actor: Principal, departmentId: string) {
    return (
      actor.employee.position === 'SENIOR_DIRECTOR' ||
      (actor.employee.position === 'ACCOUNT_DIRECTOR' && actor.employee.departmentId === departmentId)
    );
  }

  protected async workspaceAccess(actor: Principal, workspaceId: string, management = false) {
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

  protected async canCreate(actor: Principal, workspaceId: string, capability: 'tasks' | 'boards') {
    const workspace = await this.workspaceAccess(actor, workspaceId);
    if (this.manages(actor, workspace.departmentId)) return workspace;
    const membership = await this.db.workspaceMembership.findFirst({
      where: { workspaceId, employeeId: actor.employee.id, milestoneId: null },
    });
    const allowed = capability === 'tasks' ? membership?.canCreateTasks : membership?.canCreateBoards;
    if (!allowed) throw new ForbiddenException(`Workspace ${capability} permission required`);
    return workspace;
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
