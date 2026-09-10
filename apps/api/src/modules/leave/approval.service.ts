import { ConflictException, ForbiddenException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import type { ApprovalType, Employee } from '../../generated/prisma/client';
import { Transaction } from '../database/database.module';
import { AccountStatusService } from '../employment/account-status.service';
export interface ResolvedStep {
  sequence: number;
  type: ApprovalType;
  approverId: string;
  departmentId: string | null;
  teamId: string | null;
}
@Injectable()
export class LeaveApprovalResolver {
  constructor(private readonly status: AccountStatusService) {}
  async resolve(tx: Transaction, employee: Employee): Promise<ResolvedStep[]> {
    if (employee.position === 'MANAGING_DIRECTOR') return [];
    if (!employee.departmentId) throw new UnprocessableEntityException('Requester must belong to a department');
    const department = await tx.department.findUniqueOrThrow({ where: { id: employee.departmentId } });
    const settings = await tx.organizationSettings.findFirstOrThrow();
    const pending: Omit<ResolvedStep, 'sequence'>[] = [];
    const senior = await tx.employee.findFirst({
      where: { departmentId: employee.departmentId, teamId: null, position: 'SENIOR_DIRECTOR', status: 'ACTIVE' },
    });
    if (employee.position === 'MEMBER') {
      if (!employee.teamId) throw new ConflictException('Team assignment required');
      const director = await tx.employee.findFirst({
        where: { teamId: employee.teamId, position: 'ACCOUNT_DIRECTOR', status: 'ACTIVE' },
      });
      if (!director) throw new ConflictException('Team Account Director required');
      pending.push({
        type: 'ACCOUNT_DIRECTOR',
        approverId: director.id,
        departmentId: employee.departmentId,
        teamId: employee.teamId,
      });
    }
    if (employee.position === 'MEMBER' || employee.position === 'ACCOUNT_DIRECTOR') {
      if (!senior) throw new ConflictException('Department Senior Director required');
      pending.push({
        type: 'SENIOR_DIRECTOR',
        approverId: senior.id,
        departmentId: employee.departmentId,
        teamId: null,
      });
    }
    if (department.kind === 'HR' && employee.position === 'SENIOR_DIRECTOR') {
      const managingDirector = await tx.employee.findFirst({
        where: { position: 'MANAGING_DIRECTOR', departmentId: null, teamId: null, status: 'ACTIVE' },
      });
      if (!managingDirector) throw new ConflictException('Managing Director required');
      pending.push({
        type: 'MANAGING_DIRECTOR',
        approverId: managingDirector.id,
        departmentId: null,
        teamId: null,
      });
    } else if (department.kind !== 'HR') {
      if (!settings.hrApproverId) throw new ConflictException('Default HR approver required');
      pending.push({
        type: 'HR',
        approverId: settings.hrApproverId,
        departmentId: null,
        teamId: null,
      });
    }
    const steps = pending.map((step, index) => ({ ...step, sequence: index + 1 }));
    for (const step of steps) {
      if (step.approverId === employee.id) throw new ForbiddenException('Self approval is prohibited');
      if (!(await this.eligible(tx, step))) throw new ConflictException('An assigned approver is unavailable');
    }
    return steps;
  }
  async eligible(tx: Transaction, step: Pick<ResolvedStep, 'type' | 'approverId' | 'departmentId' | 'teamId'>) {
    const employee = await tx.employee.findUnique({ where: { id: step.approverId }, include: { department: true } });
    if (!employee || !(await this.status.eligible(tx, employee.id))) return false;
    if (step.type === 'ACCOUNT_DIRECTOR')
      return employee.position === 'ACCOUNT_DIRECTOR' && employee.teamId === step.teamId;
    if (step.type === 'SENIOR_DIRECTOR')
      return employee.position === 'SENIOR_DIRECTOR' && employee.departmentId === step.departmentId;
    if (step.type === 'MANAGING_DIRECTOR') return employee.position === 'MANAGING_DIRECTOR';
    return (
      employee.department?.kind === 'HR' &&
      !!(await tx.employeePermission.findFirst({
        where: { employeeId: employee.id, revokedAt: null, permission: { code: 'LEAVE_HR_APPROVE' } },
      }))
    );
  }
}
