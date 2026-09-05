import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import type { LeaveBalance, LeaveType } from '@tms/contracts';
import { dateOnly, isoDate } from '../../common/dates';
import { Transaction } from '../database/database.module';
@Injectable()
export class LeaveBalanceService {
  async accounts(tx: Transaction, employeeId: string, year: number) {
    const settings = await tx.organizationSettings.findFirstOrThrow();
    const leaveYear = await tx.employeeLeaveYear.upsert({
      where: { employeeId_year: { employeeId, year } },
      update: {},
      create: { employeeId, year, calendarId: settings.calendarId },
    });
    await tx.$queryRaw`SELECT id FROM "EmployeeLeaveYear" WHERE id=${leaveYear.id}::uuid FOR UPDATE`;
    const policy = await tx.employeeLeavePolicyAssignment.findFirst({
      where: { employeeId, year: { lte: year } },
      orderBy: { year: 'desc' },
      include: { policyVersion: true },
    });
    const christmas = await tx.employeeChristmasPolicyAssignment.findFirst({
      where: { employeeId, year: { lte: year } },
      orderBy: { year: 'desc' },
      include: { policyVersion: true },
    });
    if (!policy || !christmas) throw new ConflictException('Policy assignment required');
    for (const type of ['VACATION', 'SICK', 'CHRISTMAS_VACATION'] as const) {
      const account = await tx.leaveAccount.upsert({
        where: { leaveYearId_type: { leaveYearId: leaveYear.id, type } },
        update: {},
        create: { leaveYearId: leaveYear.id, type },
      });
      const postingKey = `entitlement:${account.id}`;
      if (!(await tx.leaveLedgerEntry.findUnique({ where: { postingKey } })))
        await tx.leaveLedgerEntry.create({
          data: {
            accountId: account.id,
            type: 'ANNUAL_ENTITLEMENT',
            entitlementDelta:
              type === 'VACATION'
                ? policy.policyVersion.vacationDays
                : type === 'SICK'
                  ? policy.policyVersion.sickDays
                  : christmas.policyVersion.days,
            postingKey,
          },
        });
    }
    return tx.leaveAccount.findMany({ where: { leaveYearId: leaveYear.id } });
  }
  async balance(tx: Transaction, accountId: string): Promise<LeaveBalance> {
    const account = await tx.leaveAccount.findUniqueOrThrow({ where: { id: accountId } });
    const sums = await tx.leaveLedgerEntry.aggregate({
      where: { accountId },
      _sum: { entitlementDelta: true, reservedDelta: true, usedDelta: true },
    });
    const entitlement = sums._sum.entitlementDelta ?? 0,
      reserved = sums._sum.reservedDelta ?? 0,
      used = sums._sum.usedDelta ?? 0;
    return { type: account.type, entitlement, reserved, used, available: entitlement - reserved - used };
  }
  async days(tx: Transaction, start: string, end: string, type: LeaveType) {
    const first = dateOnly(start),
      last = dateOnly(end);
    if (first > last || start.slice(0, 4) !== end.slice(0, 4))
      throw new UnprocessableEntityException('Dates must be ordered and within one leave year');
    if (type === 'CHRISTMAS_VACATION' && (start.slice(5, 7) !== '12' || end.slice(5, 7) !== '12'))
      throw new UnprocessableEntityException('Christmas Vacation is December-only');
    const settings = await tx.organizationSettings.findFirstOrThrow();
    const calendar = await tx.workingCalendar.findUniqueOrThrow({
      where: { id: settings.calendarId },
      include: {
        calendarWorkingDay_calendar: true,
        holiday_calendar: { where: { active: true, date: { gte: first, lte: last } } },
      },
    });
    if (
      calendar.coverageStart > dateOnly(`${start.slice(0, 4)}-01-01`) ||
      calendar.coverageEnd < dateOnly(`${end.slice(0, 4)}-12-31`)
    )
      throw new UnprocessableEntityException('Calendar does not cover this year');
    const holidays = new Set(calendar.holiday_calendar.map((h) => isoDate(h.date))),
      weekdays = new Set(calendar.calendarWorkingDay_calendar.map((d) => d.weekday));
    const dates: Date[] = [];
    for (let time = first.getTime(); time <= last.getTime(); time += 86400_000) {
      const date = new Date(time);
      if (weekdays.has(date.getUTCDay()) && !holidays.has(isoDate(date))) dates.push(date);
    }
    if (!dates.length) throw new UnprocessableEntityException('No working days in the requested range');
    return dates;
  }
}
