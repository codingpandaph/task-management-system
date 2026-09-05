import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import type { ApprovalType, Employee } from '../../generated/prisma/client';
import { Transaction } from '../database/database.module';
import { AccountStatusService } from '../employment/account-status.service';
export interface ResolvedStep {
  sequence: number;
  type: ApprovalType;
  approverId: string;
  departmentId: string | null;
}
@Injectable()
export class LeaveApprovalResolver {
  constructor(private readonly status: AccountStatusService) {}
  async resolve(tx: Transaction, employee: Employee): Promise<ResolvedStep[]> {
    if (employee.position === 'SENIOR_DIRECTOR') return [];
    const department = await tx.department.findUniqueOrThrow({ where: { id: employee.departmentId } });
    const settings = await tx.organizationSettings.findFirstOrThrow();
    const steps: ResolvedStep[] = [];
    if (employee.position === 'MEMBER') {
      const director = await tx.employee.findFirst({
        where: { departmentId: employee.departmentId, position: 'ACCOUNT_DIRECTOR', status: 'ACTIVE' },
      });
      if (!director) throw new ConflictException('Department Account Director required');
      steps.push({
        sequence: 1,
        type: 'ACCOUNT_DIRECTOR',
        approverId: director.id,
        departmentId: employee.departmentId,
      });
    } else {
      const senior = await tx.employee.findFirst({ where: { position: 'SENIOR_DIRECTOR', status: 'ACTIVE' } });
      if (!senior) throw new ConflictException('Senior Director required');
      steps.push({ sequence: 1, type: 'SENIOR_DIRECTOR', approverId: senior.id, departmentId: null });
    }
    if (department.kind !== 'HR') {
      if (!settings.hrApproverId) throw new ConflictException('Designated HR approver required');
      steps.push({ sequence: 2, type: 'HR', approverId: settings.hrApproverId, departmentId: null });
    }
    for (const step of steps) {
      if (step.approverId === employee.id) throw new ForbiddenException('Self approval is prohibited');
      if (!(await this.eligible(tx, step))) throw new ConflictException('An assigned approver is unavailable');
    }
    return steps;
  }
  async eligible(tx: Transaction, step: Pick<ResolvedStep, 'type' | 'approverId' | 'departmentId'>) {
    const employee = await tx.employee.findUnique({ where: { id: step.approverId }, include: { department: true } });
    if (!employee || !(await this.status.eligible(tx, employee.id))) return false;
    if (step.type === 'ACCOUNT_DIRECTOR')
      return employee.position === 'ACCOUNT_DIRECTOR' && employee.departmentId === step.departmentId;
    if (step.type === 'SENIOR_DIRECTOR') return employee.position === 'SENIOR_DIRECTOR';
    return (
      employee.department.kind === 'HR' &&
      !!(await tx.employeePermission.findFirst({
        where: { employeeId: employee.id, revokedAt: null, permission: { code: 'LEAVE_HR_APPROVE' } },
      }))
    );
  }
}
