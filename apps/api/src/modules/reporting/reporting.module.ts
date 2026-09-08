import {
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { dateOnly, today } from '../../common/dates';
import { AuthRequest, requireHr, requirePermission } from '../authorization/authorization';
import { DatabaseService } from '../database/database.module';
import { notify } from '../audit/audit';
import { PageDto } from '../organization/dto';
@Controller()
class ReportingController {
  constructor(private readonly db: DatabaseService) {}
  @Get('reporting/dashboard') async dashboard(@Req() r: AuthRequest) {
    requireHr(r.principal, 'REPORTING_READ');
    const day = dateOnly(today());
    const deadline = new Date(day.getTime() + 90 * 86400_000);
    const active = await this.db.employee.count({ where: { status: 'ACTIVE' } });
    const departments = await this.db.employee.groupBy({
      by: ['departmentId'],
      where: { status: 'ACTIVE' },
      _count: true,
    });
    const employment = await this.db.employmentRecord.groupBy({
      by: ['type'],
      where: { effectiveTo: null, employee: { status: 'ACTIVE' } },
      _count: true,
    });
    const pending = await this.db.leaveRequest.count({ where: { status: 'PENDING' } });
    const onLeave = await this.db.leaveRequest.count({
      where: { status: 'APPROVED', startDate: { lte: day }, endDate: { gte: day } },
    });
    const suspended = await this.db.employee.count({ where: { status: 'SUSPENDED' } });
    const contracts = await this.db.employmentRecord.findMany({
      where: { effectiveTo: null, type: 'CONTRACTUAL', endDate: { gte: day, lte: deadline } },
      select: {
        employeeId: true,
        endDate: true,
        employee: { select: { firstName: true, lastName: true, employeeId: true } },
      },
    });
    const probation = await this.db.employmentRecord.findMany({
      where: {
        effectiveTo: null,
        type: 'PROBATIONARY',
        probationEnd: { lte: deadline },
        employee: { status: 'ACTIVE' },
      },
      select: {
        employeeId: true,
        probationEnd: true,
        employee: { select: { firstName: true, lastName: true, employeeId: true } },
      },
    });
    const usage = await this.db.leaveLedgerEntry.aggregate({
      _sum: { usedDelta: true },
      where: { account: { leaveYear: { year: Number(today().slice(0, 4)) } } },
    });
    return {
      active,
      departments,
      employment,
      pending,
      onLeave,
      suspended,
      contracts: contracts.map((c) => ({
        ...c,
        daysRemaining: Math.round((c.endDate!.getTime() - day.getTime()) / 86400_000),
      })),
      probation,
      usedDays: usage._sum.usedDelta ?? 0,
    };
  }
  @Get('reporting/calendar') async calendar(
    @Req() r: AuthRequest,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('departmentId') departmentId?: string,
  ) {
    const first = dateOnly(start),
      last = dateOnly(end);
    if (first > last || last.getTime() - first.getTime() > 93 * 86400_000)
      throw new UnprocessableEntityException('Choose a date range up to 93 days');
    const broad =
      r.principal.employee.position === 'SENIOR_DIRECTOR' ||
      (r.principal.employee.department?.kind === 'HR' && r.principal.permissions.includes('REPORTING_READ'));
    return this.db.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: last },
        endDate: { gte: first },
        employee: { departmentId: broad ? departmentId : r.principal.employee.departmentId },
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        employee: {
          select: { id: true, firstName: true, lastName: true, department: { select: { id: true, name: true } } },
        },
      },
      orderBy: { startDate: 'asc' },
    });
  }
  @Get('notifications') notifications(@Req() r: AuthRequest, @Query() q: PageDto) {
    return this.db.notification.findMany({
      where: { recipientId: r.principal.employee.id },
      orderBy: { createdAt: 'desc' },
      take: q.pageSize,
      skip: (q.page - 1) * q.pageSize,
    });
  }
  @Get('notifications/unread-count') async unreadCount(@Req() r: AuthRequest) {
    return {
      count: await this.db.notification.count({ where: { recipientId: r.principal.employee.id, readAt: null } }),
    };
  }
  @Post('notifications/read-all') async readAll(@Req() r: AuthRequest) {
    const result = await this.db.notification.updateMany({
      where: { recipientId: r.principal.employee.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
  @Post('notifications/:id/read') async read(@Req() r: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    const result = await this.db.notification.updateMany({
      where: { id, recipientId: r.principal.employee.id },
      data: { readAt: new Date() },
    });
    if (!result.count) throw new NotFoundException();
    return { ok: true };
  }
  @Get('audit') async audit(@Req() r: AuthRequest, @Query() q: PageDto) {
    requirePermission(r.principal, 'AUDIT_READ');
    const items = await this.db.auditEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: q.pageSize,
      skip: (q.page - 1) * q.pageSize,
      select: {
        id: true,
        actorId: true,
        action: true,
        targetType: true,
        targetId: true,
        createdAt: true,
        metadata: true,
      },
    });
    const total = await this.db.auditEvent.count();
    return { items, total, page: q.page, pageSize: q.pageSize };
  }
  @Interval(60_000) async reminders() {
    const day = dateOnly(today()),
      until = new Date(day.getTime() + 90 * 86400_000);
    const records = await this.db.employmentRecord.findMany({
      where: {
        effectiveTo: null,
        employee: { status: 'ACTIVE' },
        OR: [
          { type: 'CONTRACTUAL', endDate: { gte: day, lte: until } },
          { type: 'PROBATIONARY', probationEnd: { lte: until } },
        ],
      },
    });
    const recipients = await this.db.employee.findMany({
      where: {
        status: 'ACTIVE',
        department: { kind: 'HR' },
        employeePermission_employee: { some: { revokedAt: null, permission: { code: 'EMPLOYMENT_MANAGE' } } },
      },
      select: { id: true },
    });
    for (const record of records) {
      const date = record.type === 'CONTRACTUAL' ? record.endDate : record.probationEnd;
      if (!date) continue;
      const days = Math.ceil((date.getTime() - day.getTime()) / 86400_000),
        window = days <= 30 ? 30 : days <= 60 ? 60 : 90;
      for (const recipient of recipients)
        await this.db.transaction((tx) =>
          notify(
            tx,
            recipient.id,
            record.type === 'CONTRACTUAL' ? 'CONTRACT_EXPIRING' : 'PROBATION_REVIEW',
            'Employee',
            record.employeeId,
            `reminder:${record.id}:${window}:${recipient.id}`,
          ),
        );
    }
  }
}
@Module({ controllers: [ReportingController] })
export class ReportingModule {}
