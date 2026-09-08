import { ConflictException, ForbiddenException } from '@nestjs/common';
import { canRoleHoldPermission, HR_DELEGABLE } from '@tms/contracts';
import type { Employee } from '../../generated/prisma/client';
import { audit } from '../audit/audit';
import { Principal, requireHr } from '../authorization/authorization';
import { lockEmployee, type Transaction } from '../database/database.module';
import { DepartmentDto, EditDepartmentDto, PermissionDto } from './dto';
import { OrganizationEmployeeService } from './organization-employee.service';

export abstract class OrganizationGovernanceService extends OrganizationEmployeeService {
  async departments() {
    return this.db.department.findMany({ orderBy: { name: 'asc' } });
  }
  async createDepartment(actor: Principal, dto: DepartmentDto) {
    requireHr(actor, 'DEPARTMENT_CREATE');
    return this.db.transaction(async (tx) => {
      const d = await tx.department.create({ data: dto });
      await audit(tx, actor.employee.id, 'DEPARTMENT_CREATED', 'Department', d.id);
      return d;
    });
  }
  async editDepartment(actor: Principal, id: string, dto: EditDepartmentDto) {
    requireHr(actor, 'DEPARTMENT_UPDATE');
    return this.db.transaction(async (tx) => {
      const r = await tx.department.updateMany({
        where: { id, version: dto.version },
        data: { name: dto.name, description: dto.description, version: { increment: 1 } },
      });
      if (!r.count) throw new ConflictException('Department changed');
      await audit(tx, actor.employee.id, 'DEPARTMENT_UPDATED', 'Department', id);
      return { ok: true };
    });
  }
  async departmentStatus(actor: Principal, id: string, active: boolean) {
    requireHr(actor, 'DEPARTMENT_UPDATE');
    return this.db.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Department" WHERE id=${id}::uuid FOR UPDATE`;
      const count = await tx.employee.count({ where: { departmentId: id, status: { in: ['ACTIVE', 'SUSPENDED'] } } });
      const steps = await tx.leaveApprovalStep.count({
        where: { departmentId: id, status: 'PENDING', request: { status: 'PENDING' } },
      });
      const cancellations = await tx.leaveCancellationApprovalStep.count({
        where: { departmentId: id, status: 'PENDING', cancellation: { status: 'PENDING' } },
      });
      if (!active && (count || steps || cancellations))
        throw new ConflictException('Transfer employees and resolve approvals first');
      const result = await tx.department.update({
        where: { id },
        data: { status: active ? 'ACTIVE' : 'INACTIVE', version: { increment: 1 } },
      });
      await audit(tx, actor.employee.id, 'DEPARTMENT_STATUS_CHANGED', 'Department', id, { status: result.status });
      return result;
    });
  }
  protected async history(tx: Transaction, employee: Employee, actor: Principal, reason: string) {
    await tx.employeeOrganizationHistory.updateMany({
      where: { employeeId: employee.id, effectiveTo: null },
      data: { effectiveTo: new Date() },
    });
    await tx.employeeOrganizationHistory.create({
      data: {
        employeeId: employee.id,
        departmentId: employee.departmentId,
        position: employee.position,
        actorId: actor.employee.id,
        reason,
      },
    });
  }
  async transfer(actor: Principal, id: string, departmentId: string, reason: string) {
    requireHr(actor, 'DEPARTMENT_ASSIGN_MEMBER');
    if (id === actor.employee.id) throw new ForbiddenException('Self transfer is prohibited');
    return this.db.transaction(async (tx) => {
      await lockEmployee(tx, id);
      const e = await tx.employee.findUniqueOrThrow({ where: { id } });
      if (e.position !== 'MEMBER') throw new ConflictException('Replace leadership assignment before transfer');
      const department = await tx.department.findUniqueOrThrow({ where: { id: departmentId } });
      if (department.status !== 'ACTIVE') throw new ConflictException('Active department required');
      const updated = await tx.employee.update({ where: { id }, data: { departmentId, version: { increment: 1 } } });
      await this.history(tx, updated, actor, reason);
      await audit(tx, actor.employee.id, 'EMPLOYEE_TRANSFERRED', 'Employee', id, {
        from: e.departmentId,
        to: departmentId,
      });
      return { ok: true };
    });
  }
  async director(actor: Principal, departmentId: string | null, employeeId: string, reason: string) {
    if (departmentId) requireHr(actor, 'DEPARTMENT_ASSIGN_ACCOUNT_DIRECTOR');
    else if (actor.employee.position !== 'SENIOR_DIRECTOR') throw new ForbiddenException();
    if (employeeId === actor.employee.id) throw new ForbiddenException('Self assignment is prohibited');
    return this.db.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "OrganizationSettings" FOR UPDATE`;
      const e = await tx.employee.findUniqueOrThrow({ where: { id: employeeId } });
      if (
        !(await this.accounts.eligible(tx, e.id)) ||
        (departmentId && e.departmentId !== departmentId) ||
        e.position === 'SENIOR_DIRECTOR'
      )
        throw new ConflictException('Eligible employee in target department required');
      const position = departmentId ? 'ACCOUNT_DIRECTOR' : 'SENIOR_DIRECTOR';
      const previous = await tx.employee.findMany({
        where: { position, ...(departmentId ? { departmentId } : {}), id: { not: employeeId } },
      });
      for (const old of previous) {
        const demoted = await tx.employee.update({
          where: { id: old.id },
          data: { position: 'MEMBER', version: { increment: 1 } },
        });
        await this.history(tx, demoted, actor, reason);
      }
      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: { position, version: { increment: 1 } },
      });
      await this.history(tx, updated, actor, reason);
      await audit(tx, actor.employee.id, 'LEADERSHIP_ASSIGNED', 'Employee', employeeId, { position });
      return { ok: true };
    });
  }
  async hrApprover(actor: Principal, employeeId: string) {
    if (actor.employee.position !== 'SENIOR_DIRECTOR') throw new ForbiddenException();
    return this.db.transaction(async (tx) => {
      const e = await tx.employee.findUniqueOrThrow({ where: { id: employeeId }, include: { department: true } });
      const grant = await tx.employeePermission.findFirst({
        where: { employeeId, revokedAt: null, permission: { code: 'LEAVE_HR_APPROVE' } },
      });
      if (e.department.kind !== 'HR' || !grant || !(await this.accounts.eligible(tx, employeeId)))
        throw new ConflictException('Eligible HR approver required');
      const settings = await tx.organizationSettings.findFirstOrThrow();
      await tx.organizationSettings.update({ where: { id: settings.id }, data: { hrApproverId: employeeId } });
      await audit(tx, actor.employee.id, 'HR_APPROVER_ASSIGNED', 'Employee', employeeId);
      return { ok: true };
    });
  }
  async permissions(actor: Principal, id: string) {
    requireHr(actor, 'EMPLOYEE_READ');
    return this.db.employeePermission.findMany({
      where: { employeeId: id, revokedAt: null },
      select: { id: true, permission: { select: { code: true } } },
    });
  }
  async permission(actor: Principal, id: string, dto: PermissionDto, revoke = false) {
    if (id === actor.employee.id) throw new ForbiddenException('Self permission changes prohibited');
    if (actor.employee.position !== 'SENIOR_DIRECTOR') {
      requireHr(actor, revoke ? 'PERMISSION_REVOKE' : 'PERMISSION_ASSIGN');
      if (!HR_DELEGABLE.includes(dto.code) || !actor.permissions.includes(dto.code))
        throw new ForbiddenException('Permission is not delegable');
    }
    return this.db.transaction(async (tx) => {
      await lockEmployee(tx, id);
      const target = await tx.employee.findUniqueOrThrow({ where: { id }, include: { department: true } });
      if (target.department.kind !== 'HR' && target.position !== 'SENIOR_DIRECTOR')
        throw new ForbiddenException('Administrative grants require HR scope');
      if (!revoke && !canRoleHoldPermission(target.position, target.department.kind === 'HR', dto.code))
        throw new ForbiddenException('Permission exceeds the target role');
      const permission = await tx.permission.findUniqueOrThrow({ where: { code: dto.code } });
      if (revoke)
        await tx.employeePermission.updateMany({
          where: { employeeId: id, permissionId: permission.id, revokedAt: null },
          data: { revokedAt: new Date(), revokedById: actor.employee.id },
        });
      else if (
        !(await tx.employeePermission.findFirst({
          where: { employeeId: id, permissionId: permission.id, revokedAt: null },
        }))
      )
        await tx.employeePermission.create({
          data: { employeeId: id, permissionId: permission.id, grantedById: actor.employee.id },
        });
      await audit(tx, actor.employee.id, revoke ? 'PERMISSION_REVOKED' : 'PERMISSION_GRANTED', 'Employee', id, {
        permission: dto.code,
      });
      return { ok: true };
    });
  }
}
