import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { TaskLinkType } from '../../generated/prisma/client';
import { audit, notify } from '../audit/audit';
import type { Principal } from '../authorization/authorization';
import { person, taskInclude } from './task-base.service';
import { TaskRecordService } from './task-record.service';

export abstract class TaskWorkflowService extends TaskRecordService {
  async move(actor: Principal, id: string, columnId: string) {
    const task = await this.detail(actor, id);
    const column = await this.db.taskColumn.findFirst({ where: { id: columnId, boardId: task.boardId } });
    if (!column) throw new BadRequestException('Column is not on this board');
    if (column.managementLocked && !task.isManagementApproved && actor.employee.position !== 'SENIOR_DIRECTOR')
      throw new ForbiddenException('Management sign-off is required');
    const blockers = task.outgoingLinks.filter((link) => link.type === 'BLOCKED_BY' && !link.targetTask.column.isDone);
    if (!task.column.isInitial && blockers.length && actor.employee.position !== 'SENIOR_DIRECTOR')
      throw new BadRequestException('Resolve blocking tasks before advancing this task');
    if (task.column.isInitial && !column.isInitial && blockers.length && actor.employee.position !== 'SENIOR_DIRECTOR')
      throw new BadRequestException('Resolve blocking tasks before advancing this task');
    return this.db.transaction(async (tx) => {
      if (task.board.kind === 'KANBAN' && column.semantic === 'IN_PROGRESS') {
        await this.enforceWip(tx, task.workspace.departmentId, task.assigneeId, task.id);
      }
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
      const destination = await tx.taskColumn.findUniqueOrThrow({ where: { id: task.lastColumnId ?? task.columnId } });
      if (task.board.kind === 'KANBAN' && destination.semantic === 'IN_PROGRESS') {
        await this.enforceWip(tx, task.workspace.departmentId, task.assigneeId, task.id);
      }
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

  protected async dependencyPath(sourceId: string, wantedId: string) {
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
}
