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
    const [board, assignee, milestone, sprint] = await Promise.all([
      this.db.taskBoard.findFirst({
        where: { id: dto.boardId, workspaceId: dto.workspaceId },
        include: { columns: { where: { isInitial: true } } },
      }),
      dto.assigneeId ? this.db.employee.findUnique({ where: { id: dto.assigneeId } }) : null,
      dto.milestoneId
        ? this.db.milestone.findFirst({ where: { id: dto.milestoneId, workspaceId: dto.workspaceId, status: 'OPEN' } })
        : null,
      dto.sprintId ? this.db.sprint.findFirst({ where: { id: dto.sprintId, boardId: dto.boardId } }) : null,
    ]);
    if (!board?.columns[0]) throw new BadRequestException('Board requires an initial column');
    if (dto.assigneeId && (!assignee || assignee.status !== 'ACTIVE'))
      throw new BadRequestException('Assignee must be active');
    if (assignee && assignee.departmentId !== workspace.departmentId)
      throw new BadRequestException('Assignee must belong to this department');
    if (dto.milestoneId && !milestone) throw new BadRequestException('Open milestone not found');
    if (dto.sprintId && (!sprint || sprint.status === 'COMPLETED'))
      throw new BadRequestException('Choose a current sprint on this board');
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
          sprintId: dto.sprintId,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        },
        include: taskInclude,
      });
      await tx.boardCollaborator.upsert({
        where: { boardId_employeeId: { boardId: board.id, employeeId: actor.employee.id } },
        create: { boardId: board.id, employeeId: actor.employee.id },
        update: {},
      });
      if (dto.assigneeId) {
        await tx.boardCollaborator.upsert({
          where: { boardId_employeeId: { boardId: board.id, employeeId: dto.assigneeId } },
          create: { boardId: board.id, employeeId: dto.assigneeId },
          update: {},
        });
      }
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
      if (employee.departmentId !== task.workspace.departmentId)
        throw new BadRequestException('Assignee must belong to this department');
    }
    const targetSprintId = dto.clearSprint ? null : (dto.sprintId ?? task.sprintId);
    if (targetSprintId) {
      const sprint = await this.db.sprint.findFirst({ where: { id: targetSprintId, boardId: task.boardId } });
      if (!sprint || sprint.status === 'COMPLETED')
        throw new BadRequestException('Choose a current sprint on this board');
    }
    const data = {
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      estimatedHours: dto.estimatedHours,
      ...(dto.clearAssignee || dto.assigneeId ? { assigneeId } : {}),
      ...(dto.clearMilestone ? { milestoneId: null } : dto.milestoneId ? { milestoneId: dto.milestoneId } : {}),
      ...(dto.clearSprint ? { sprintId: null } : dto.sprintId ? { sprintId: dto.sprintId } : {}),
      ...(dto.clearDueDate ? { dueDate: null } : dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
    };
    return this.db.transaction(async (tx) => {
      if (employee && task.board.kind === 'KANBAN' && task.column.semantic === 'IN_PROGRESS')
        await this.enforceWip(tx, task.workspace.departmentId, employee.id, task.id);
      const updated = await tx.task.update({ where: { id }, data, include: taskInclude });
      if (employee) {
        await tx.boardCollaborator.upsert({
          where: { boardId_employeeId: { boardId: task.boardId, employeeId: employee.id } },
          create: { boardId: task.boardId, employeeId: employee.id },
          update: {},
        });
      }
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
