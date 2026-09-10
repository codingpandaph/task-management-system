import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Employee } from '../../generated/prisma/client';
import type { Principal } from '../authorization/authorization';
import type { TaskDto, TaskEditDto } from './task.dto';
import { taskInclude } from './task-base.service';
import { TaskWorkspaceService } from './task-workspace.service';

export abstract class TaskRecordService extends TaskWorkspaceService {
  async createTask(actor: Principal, dto: TaskDto) {
    const workspace = await this.canCreate(actor, dto.workspaceId, 'tasks');
    await this.boardAccess(actor, dto.boardId);
    const [board, assignee] = await Promise.all([
      this.db.taskBoard.findFirst({
        where: { id: dto.boardId, workspaceId: dto.workspaceId },
        include: { columns: { where: { isInitial: true } }, milestone: true },
      }),
      dto.assigneeId ? this.db.employee.findUnique({ where: { id: dto.assigneeId } }) : null,
    ]);
    if (!board?.columns[0]) throw new BadRequestException('Board requires an initial column');
    if (board.status !== 'ACTIVE') throw new BadRequestException('Completed sprint boards are read-only');
    if (dto.assigneeId && (!assignee || assignee.status !== 'ACTIVE'))
      throw new BadRequestException('Assignee must be active');
    if (assignee && assignee.teamId !== workspace.teamId)
      throw new BadRequestException('Assignee must belong to this team');
    if (board.kind === 'SCRUM' && (!board.milestone || board.milestone.status !== 'OPEN'))
      throw new BadRequestException('This Scrum board requires an open milestone');
    if (dto.milestoneId && dto.milestoneId !== board.milestone?.id)
      throw new BadRequestException('Tasks can only use their Scrum board milestone');
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
          milestoneId: board.kind === 'SCRUM' ? board.milestone?.id : undefined,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        },
        include: taskInclude,
      });
      await tx.workspace.update({ where: { id: workspace.id }, data: { nextTaskNumber: { increment: 1 } } });
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
    await this.boardAccess(actor, task.boardId);
    return task;
  }

  async edit(actor: Principal, id: string, dto: TaskEditDto) {
    const task = await this.detail(actor, id);
    this.requireParticipant(actor, task.workspace);
    if (task.board.status !== 'ACTIVE') throw new BadRequestException('Completed sprint boards are read-only');
    const assigneeId = dto.clearAssignee ? null : dto.assigneeId;
    const targetMilestoneId = dto.clearMilestone ? null : (dto.milestoneId ?? task.milestoneId);
    const milestone = targetMilestoneId
      ? await this.db.milestone.findFirst({
          where: { id: targetMilestoneId, workspaceId: task.workspaceId, boardId: task.boardId, status: 'OPEN' },
        })
      : null;
    if (targetMilestoneId && !milestone) throw new BadRequestException('Open milestone not found');
    let employee: Employee | null = null;
    if (assigneeId) {
      employee = await this.db.employee.findUnique({ where: { id: assigneeId } });
      if (!employee || employee.status !== 'ACTIVE') throw new BadRequestException('Assignee must be active');
      if (employee.teamId !== task.workspace.teamId) throw new BadRequestException('Assignee must belong to this team');
    }
    const data = {
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      estimatedHours: dto.estimatedHours,
      ...(dto.clearAssignee || dto.assigneeId ? { assigneeId } : {}),
      ...(dto.clearMilestone ? { milestoneId: null } : dto.milestoneId ? { milestoneId: dto.milestoneId } : {}),
      ...(dto.clearDueDate ? { dueDate: null } : dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
    };
    return this.db.transaction(async (tx) => {
      if (employee && task.board.kind === 'KANBAN' && task.column.semantic === 'IN_PROGRESS')
        await this.enforceWip(tx, task.workspace.teamId, employee.id, task.id);
      const updated = await tx.task.update({ where: { id }, data, include: taskInclude });
      await this.activity(
        tx,
        id,
        actor.employee.id,
        'UPDATE_FIELD',
        'task',
        {
          title: task.title,
          assigneeId: task.assigneeId,
          estimatedHours: task.estimatedHours,
        },
        {
          title: updated.title,
          assigneeId: updated.assigneeId,
          estimatedHours: updated.estimatedHours,
        },
      );
      return updated;
    });
  }
}
