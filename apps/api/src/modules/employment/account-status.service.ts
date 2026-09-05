import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { isoDate, today } from '../../common/dates';
import { audit } from '../audit/audit';
import { DatabaseService, lockEmployee, Transaction } from '../database/database.module';

@Injectable()
export class AccountStatusService {
  constructor(private readonly db: DatabaseService) {}
  async eligible(tx: Transaction, id: string, now = new Date()): Promise<boolean> {
    await lockEmployee(tx, id);
    let employee = await tx.employee.findUniqueOrThrow({ where: { id } });
    const employment = await tx.employmentRecord.findFirst({ where: { employeeId: id, effectiveTo: null } });
    const day = today(now);
    const employed =
      !!employment &&
      isoDate(employment.startDate) <= day &&
      (employment.type !== 'CONTRACTUAL' || (!!employment.endDate && isoDate(employment.endDate) >= day));
    if (!employed && employee.status !== 'TERMINATED' && employee.status !== 'INACTIVE') {
      await tx.employee.update({ where: { id }, data: { status: 'INACTIVE', version: { increment: 1 } } });
      await tx.employeeStatusChange.create({
        data: { employeeId: id, previous: employee.status, next: 'INACTIVE', reason: 'Employment eligibility ended' },
      });
      await tx.session.updateMany({
        where: { employeeId: id, revokedAt: null },
        data: { revokedAt: now, revokeReason: 'EMPLOYMENT_INELIGIBLE' },
      });
      await audit(tx, null, 'EMPLOYMENT_ACCESS_ENDED', 'Employee', id);
      return false;
    }
    if (employee.status === 'SUSPENDED') {
      const suspension = await tx.suspension.findFirst({ where: { employeeId: id, resolvedAt: null } });
      if (suspension && suspension.suspendedUntil <= now && suspension.previousAccessState === 'ACTIVE' && employed) {
        const conflict =
          employee.position === 'MEMBER'
            ? null
            : await tx.employee.findFirst({
                where: {
                  id: { not: id },
                  status: 'ACTIVE',
                  position: employee.position,
                  ...(employee.position === 'ACCOUNT_DIRECTOR' ? { departmentId: employee.departmentId } : {}),
                },
              });
        if (!conflict) {
          employee = await tx.employee.update({ where: { id }, data: { status: 'ACTIVE', version: { increment: 1 } } });
          await tx.suspension.update({ where: { id: suspension.id }, data: { resolvedAt: now } });
          await tx.employeeStatusChange.create({
            data: { employeeId: id, previous: 'SUSPENDED', next: 'ACTIVE', reason: 'Suspension expired' },
          });
          await audit(tx, null, 'SUSPENSION_EXPIRED', 'Employee', id);
        }
      }
    }
    return employed && employee.status === 'ACTIVE';
  }
  @Interval(60_000)
  async reconcile() {
    const employees = await this.db.employee.findMany({
      where: { status: { in: ['ACTIVE', 'SUSPENDED'] } },
      select: { id: true },
    });
    for (const employee of employees) await this.db.transaction((tx) => this.eligible(tx, employee.id));
  }
}
