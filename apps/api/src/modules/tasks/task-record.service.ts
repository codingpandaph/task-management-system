import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Employee } from '../../generated/prisma/client';
import type { Principal } from '../authorization/authorization';
import type { TaskDto, TaskEditDto } from './task.dto';
import { taskInclude } from './task-base.service';
import { TaskWorkspaceService } from './task-workspace.service';

export abstract class TaskRecordService extends TaskWorkspaceService {
  async createTask(actor: Principal, dto: TaskDto) {
    const workspace = await this.canCreate(actor, dto.workspaceId, 'tasks');
    const [board, assignee, reporter, milestone] = await Promise.all([
      this.db.taskBoard.findFirst({
        where: { id: dto.boardId, workspaceId: dto.workspaceId },
        include: { columns: { where: { isInitial: true } } },
      }),
      dto.assigneeId ? this.db.employee.findUnique({ where: { id: dto.assigneeId } }) : null,
      dto.reporterId ? this.db.employee.findUnique({ where: { id: dto.reporterId } }) : null,
      dto.milestoneId
        ? this.db.milestone.findFirst({ where: { id: dto.milestoneId, workspaceId: dto.workspaceId, status: 'OPEN' } })
        : null,
    ]);
    if (!board?.columns[0]) throw new BadRequestException('Board requires an initial column');
    if (dto.assigneeId && (!assignee || assignee.status !== 'ACTIVE'))
      throw new BadRequestException('Assignee must be active');
    if (
      dto.reporterId &&
      (!reporter || reporter.status !== 'ACTIVE' || reporter.departmentId !== workspace.departmentId)
    )
      throw new BadRequestException('Reporter must be an active employee in this department');
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
          reporterId: reporter?.id ?? actor.employee.id,
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
    let reporter: Employee | null = null;
    if (assigneeId) {
      employee = await this.db.employee.findUnique({ where: { id: assigneeId } });
      if (!employee || employee.status !== 'ACTIVE') throw new BadRequestException('Assignee must be active');
      const existingMembership = await this.db.workspaceMembership.findFirst({
        where: { workspaceId: task.workspaceId, employeeId: assigneeId, milestoneId: null },
      });
      if (employee.departmentId !== task.workspace.departmentId && !existingMembership && !milestone)
        throw new BadRequestException('Cross-team assignment requires a milestone window');
    }
    if (dto.reporterId) {
      reporter = await this.db.employee.findUnique({ where: { id: dto.reporterId } });
      if (!reporter || reporter.status !== 'ACTIVE' || reporter.departmentId !== task.workspace.departmentId)
        throw new BadRequestException('Reporter must be an active employee in this department');
    }
    const data = {
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      estimatedHours: dto.estimatedHours,
      ...(dto.clearAssignee || dto.assigneeId ? { assigneeId } : {}),
      ...(dto.clearMilestone ? { milestoneId: null } : dto.milestoneId ? { milestoneId: dto.milestoneId } : {}),
      ...(reporter ? { reporterId: reporter.id } : {}),
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
        {
          title: task.title,
          assigneeId: task.assigneeId,
          reporterId: task.reporterId,
          estimatedHours: task.estimatedHours,
        },
        {
          title: updated.title,
          assigneeId: updated.assigneeId,
          reporterId: updated.reporterId,
          estimatedHours: updated.estimatedHours,
        },
      );
      return updated;
    });
  }
}
