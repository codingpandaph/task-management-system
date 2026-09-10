import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Principal } from '../authorization/authorization';
import { display, taskInclude } from './task-base.service';
import { formatEstimation } from './estimation';
import { TaskWorkflowService } from './task-workflow.service';

export abstract class TaskReportingService extends TaskWorkflowService {
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
        ...(actor.employee.position === 'MANAGING_DIRECTOR'
          ? {}
          : actor.employee.position === 'SENIOR_DIRECTOR'
            ? { workspace: { departmentId: actor.employee.departmentId! } }
            : { workspace: { teamId: actor.employee.teamId! } }),
      },
      include: taskInclude,
      orderBy: { deletedAt: 'desc' },
    });
  }

  async reporting(actor: Principal) {
    if (actor.employee.position === 'MEMBER') throw new ForbiddenException('Director access required');
    const workspaceWhere =
      actor.employee.position === 'MANAGING_DIRECTOR'
        ? {}
        : actor.employee.position === 'SENIOR_DIRECTOR'
          ? { departmentId: actor.employee.departmentId! }
          : { teamId: actor.employee.teamId! };
    const workspaces = await this.db.workspace.findMany({
      where: workspaceWhere,
      include: {
        tasks: {
          where: { isDeleted: false },
          include: {
            column: true,
            assignee: { select: { id: true, firstName: true, lastName: true } },
            outgoingLinks: { include: { targetTask: { include: { column: true } } } },
          },
        },
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
      blocked: workspace.tasks.filter((task) =>
        task.outgoingLinks.some((link) => link.type === 'BLOCKED_BY' && !link.targetTask.column.isDone),
      ).length,
      inProgress: workspace.tasks.filter((task) => task.column.semantic === 'IN_PROGRESS').length,
      inReview: workspace.tasks.filter((task) => task.column.semantic === 'REVIEW').length,
      estimatedHours: workspace.tasks
        .filter((task) => !task.column.isDone)
        .reduce((sum, task) => sum + task.estimatedHours, 0),
      openMilestones: workspace.milestones.length,
      capacityRisks: workspace.milestones.filter((milestone) => milestone.isOvercapacity).length,
      throughput30Days: workspace.tasks.filter(
        (task) => task.completedAt && task.completedAt >= new Date(Date.now() - 30 * 86_400_000),
      ).length,
      averageCycleDays: (() => {
        const completed = workspace.tasks.filter((task) => task.column.isDone);
        if (!completed.length) return 0;
        const total = completed.reduce(
          (sum, task) =>
            sum + ((task.completedAt?.getTime() ?? task.updatedAt.getTime()) - task.createdAt.getTime()) / 86_400_000,
          0,
        );
        return Math.round((total / completed.length) * 10) / 10;
      })(),
      memberLoad: Object.values(
        workspace.tasks
          .filter((task) => !task.column.isDone && task.assignee)
          .reduce<Record<string, { id: string; name: string; tasks: number; hours: number }>>((members, task) => {
            const assignee = task.assignee!;
            const current = members[assignee.id] ?? { id: assignee.id, name: display(assignee), tasks: 0, hours: 0 };
            current.tasks += 1;
            current.hours += task.estimatedHours;
            members[assignee.id] = current;
            return members;
          }, {}),
      ).sort((a, b) => b.hours - a.hours),
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
        where: { teamId: milestone.workspace.teamId, status: 'ACTIVE' },
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
      teamMembers: [...members.values()].map((employee) => ({ id: employee.id, name: display(employee) })),
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
