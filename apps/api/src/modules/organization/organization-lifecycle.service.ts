import { ConflictException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { audit } from '../audit/audit';
import { Principal, requireHr } from '../authorization/authorization';
import { lockEmployee } from '../database/database.module';
import { EmploymentDto } from './dto';
import { directory } from './organization-base.service';
import { OrganizationGovernanceService } from './organization-governance.service';

export abstract class OrganizationLifecycleService extends OrganizationGovernanceService {
  async employment(actor: Principal, id: string) {
    requireHr(actor, 'EMPLOYMENT_MANAGE');
    return this.db.employmentRecord.findMany({ where: { employeeId: id }, orderBy: { effectiveFrom: 'desc' } });
  }
  async updateEmployment(actor: Principal, id: string, dto: EmploymentDto) {
    requireHr(actor, 'EMPLOYMENT_MANAGE');
    if (id === actor.employee.id) throw new ForbiddenException('Self employment changes prohibited');
    const data = this.employmentData(dto);
    return this.db.transaction(async (tx) => {
      await lockEmployee(tx, id);
      const e = await tx.employee.findUniqueOrThrow({ where: { id } });
      if (e.status === 'TERMINATED') throw new ConflictException('Rehire is not supported');
      await tx.employmentRecord.updateMany({
        where: { employeeId: id, effectiveTo: null },
        data: { effectiveTo: new Date() },
      });
      const record = await tx.employmentRecord.create({
        data: { ...data, employeeId: id, actorId: actor.employee.id, reason: dto.reason },
      });
      await this.accounts.eligible(tx, id);
      await audit(tx, actor.employee.id, 'EMPLOYMENT_CHANGED', 'Employee', id, { type: dto.type });
      return record;
    });
  }
  async status(
    actor: Principal,
    id: string,
    next: 'SUSPENDED' | 'INACTIVE' | 'ACTIVE' | 'TERMINATED',
    reason: string,
    suspendedUntil?: string,
  ) {
    requireHr(actor, 'EMPLOYEE_STATUS_MANAGE');
    if (id === actor.employee.id) throw new ForbiddenException('Self status changes prohibited');
    return this.db.transaction(async (tx) => {
      await lockEmployee(tx, id);
      const e = await tx.employee.findUniqueOrThrow({ where: { id } });
      if (
        ['MANAGING_DIRECTOR', 'SENIOR_DIRECTOR'].includes(e.position) ||
        e.status === 'TERMINATED' ||
        e.status === next
      )
        throw new ConflictException('This status change is not allowed');
      if (next === 'SUSPENDED' && e.status !== 'ACTIVE')
        throw new ConflictException('Only active employees may be suspended');
      if (next === 'ACTIVE' && e.status !== 'INACTIVE')
        throw new ConflictException('Only inactive employees may be reactivated');
      if (next === 'SUSPENDED') {
        const until = new Date(suspendedUntil ?? '');
        if (!Number.isFinite(until.getTime()) || until <= new Date())
          throw new UnprocessableEntityException('Future suspension end required');
        await tx.suspension.create({
          data: {
            employeeId: id,
            actorId: actor.employee.id,
            previousAccessState: e.status,
            suspendedUntil: until,
            reason,
          },
        });
      } else
        await tx.suspension.updateMany({
          where: { employeeId: id, resolvedAt: null },
          data: { resolvedAt: new Date() },
        });
      await tx.employee.update({ where: { id }, data: { status: next, version: { increment: 1 } } });
      if (next === 'ACTIVE' && !(await this.accounts.eligible(tx, id)))
        throw new ConflictException('Employment eligibility required');
      await tx.session.updateMany({
        where: { employeeId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'ACCOUNT_STATUS_CHANGED' },
      });
      await tx.employeeStatusChange.create({
        data: { employeeId: id, actorId: actor.employee.id, previous: e.status, next, reason },
      });
      if (next === 'TERMINATED') {
        const tasks = await tx.task.findMany({
          where: { assigneeId: id, isDeleted: false, column: { isDone: false } },
          include: { board: { include: { columns: { where: { isInitial: true } } } } },
        });
        for (const task of tasks) {
          const initial = task.board.columns[0];
          if (!initial) continue;
          await tx.task.update({ where: { id: task.id }, data: { assigneeId: null, columnId: initial.id } });
          await tx.taskActivityLog.create({
            data: {
              taskId: task.id,
              actorEmployeeId: actor.employee.id,
              actionType: 'UPDATE_FIELD',
              fieldChanged: 'terminationCleanup',
              oldValue: { assigneeId: id, columnId: task.columnId },
              newValue: { assigneeId: null, columnId: initial.id },
            },
          });
        }
        const milestoneIds = [
          ...new Set(tasks.map((task) => task.milestoneId).filter((value): value is string => !!value)),
        ];
        if (milestoneIds.length)
          await tx.milestone.updateMany({ where: { id: { in: milestoneIds } }, data: { isOvercapacity: true } });
      }
      await audit(tx, actor.employee.id, 'ACCOUNT_STATUS_CHANGED', 'Employee', id, { previous: e.status, next });
      return { ok: true };
    });
  }
  async reset(actor: Principal, id: string) {
    requireHr(actor, 'EMPLOYEE_PASSWORD_RESET');
    if (id === actor.employee.id) throw new ForbiddenException('Use change password');
    const credentials = await this.auth.temporaryPassword();
    await this.db.transaction(async (tx) => {
      await lockEmployee(tx, id);
      await tx.employee.update({ where: { id }, data: { passwordHash: credentials.hash, mustChangePassword: true } });
      await tx.session.updateMany({
        where: { employeeId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'PASSWORD_RESET' },
      });
      await audit(tx, actor.employee.id, 'PASSWORD_RESET', 'Employee', id);
    });
    return { temporaryPassword: credentials.password };
  }
  async hierarchy(actor: Principal) {
    const organizationWide =
      actor.employee.position === 'MANAGING_DIRECTOR' ||
      (actor.employee.department?.kind === 'HR' && actor.permissions.includes('EMPLOYEE_READ'));
    if (!organizationWide && actor.employee.position !== 'SENIOR_DIRECTOR') {
      throw new ForbiddenException('Organization overview requires organization responsibility');
    }
    const departmentWhere = organizationWide
      ? { status: 'ACTIVE' as const }
      : { status: 'ACTIVE' as const, id: actor.employee.departmentId! };
    const employeeWhere = organizationWide ? {} : { departmentId: actor.employee.departmentId! };
    const departments = await this.db.department.findMany({
      where: departmentWhere,
      include: {
        _count: { select: { employee_department: true } },
        teams: {
          include: {
            _count: { select: { employees: true } },
            workspace: { select: { _count: { select: { boards: true } } } },
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
    const [employees, totalEmployees, suspendedEmployees, boards] = await Promise.all([
      this.db.employee.findMany({
        where: { ...employeeWhere, status: 'ACTIVE' },
        include: { department: true, team: true },
      }),
      this.db.employee.count({ where: employeeWhere }),
      this.db.employee.count({ where: { ...employeeWhere, status: 'SUSPENDED' } }),
      this.db.taskBoard.count({ where: { status: 'ACTIVE', workspace: employeeWhere } }),
    ]);
    return {
      departments,
      employees: employees.map(directory),
      summary: {
        totalEmployees,
        activeEmployees: employees.length,
        suspendedEmployees,
        departments: departments.length,
        boards,
      },
    };
  }
}
