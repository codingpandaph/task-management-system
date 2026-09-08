import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { dateOnly, isoDate, today } from '../../common/dates';
import type { LeaveRequest, Prisma } from '../../generated/prisma/client';
import { type Principal, requireHr } from '../authorization/authorization';
import { audit, notify } from '../audit/audit';
import { lockEmployee, type Transaction } from '../database/database.module';
import { PageDto } from '../organization/dto';
import { LeaveDto } from './leave.dto';
import { LeaveBaseService } from './leave-base.service';

export class LeaveRequestService extends LeaveBaseService {
  async balance(actor: Principal, year: number) {
    if (!Number.isInteger(year) || year < 2020 || year > 2200) throw new UnprocessableEntityException('Invalid year');
    return this.db.transaction(async (tx) => {
      await lockEmployee(tx, actor.employee.id);
      const accounts = await this.balances.accounts(tx, actor.employee.id, year);
      const result = [];
      for (const account of accounts) result.push(await this.balances.balance(tx, account.id));
      return result;
    });
  }
  async preview(actor: Principal, dto: LeaveDto) {
    return this.db.transaction(async (tx) => ({
      workingDays: (await this.balances.days(tx, dto.startDate, dto.endDate, dto.type)).length,
    }));
  }
  async draft(actor: Principal, dto: LeaveDto, id?: string) {
    const startDate = dateOnly(dto.startDate),
      endDate = dateOnly(dto.endDate);
    if (startDate > endDate) throw new UnprocessableEntityException('Invalid date range');
    return this.db.transaction(async (tx) => {
      await lockEmployee(tx, actor.employee.id);
      let request: LeaveRequest;
      if (id) {
        const old = await tx.leaveRequest.findFirst({ where: { id, employeeId: actor.employee.id, status: 'DRAFT' } });
        if (!old) throw new ConflictException('Only your drafts can be edited');
        request = await tx.leaveRequest.update({
          where: { id },
          data: { type: dto.type, startDate, endDate, reason: dto.reason, version: { increment: 1 } },
        });
      } else
        request = await tx.leaveRequest.create({
          data: { employeeId: actor.employee.id, type: dto.type, startDate, endDate, reason: dto.reason },
        });
      return { id: request.id, status: request.status };
    });
  }
  protected async validate(tx: Transaction, request: LeaveRequest, admin: boolean) {
    const employee = await tx.employee.findUniqueOrThrow({ where: { id: request.employeeId } });
    if (!admin && !(await this.status.eligible(tx, employee.id)))
      throw new ConflictException('Employee is not eligible');
    const start = isoDate(request.startDate),
      end = isoDate(request.endDate);
    if (!admin && start < today()) throw new UnprocessableEntityException('Backdated leave requires HR administration');
    const employment = await tx.employmentRecord.findFirst({ where: { employeeId: employee.id, effectiveTo: null } });
    if (
      !employment ||
      request.startDate < employment.startDate ||
      (employment.type === 'CONTRACTUAL' && employment.endDate && request.endDate > employment.endDate)
    )
      throw new UnprocessableEntityException('Leave must fall within employment dates');
    const overlap = await tx.leaveRequest.findFirst({
      where: {
        employeeId: employee.id,
        id: { not: request.id },
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: request.endDate },
        endDate: { gte: request.startDate },
      },
    });
    if (overlap) throw new ConflictException('Leave overlaps another active request');
    const days = await this.balances.days(tx, start, end, request.type);
    const accounts = await this.balances.accounts(tx, employee.id, Number(start.slice(0, 4)));
    const account = accounts.find((a) => a.type === request.type)!;
    const balance = await this.balances.balance(tx, account.id);
    if (balance.available < days.length) throw new UnprocessableEntityException('Insufficient available entitlement');
    return { employee, days, account };
  }
  async submit(actor: Principal, id: string, operationId: string) {
    return this.db.transaction(async (tx) => {
      await lockEmployee(tx, actor.employee.id);
      const request = await tx.leaveRequest.findFirst({ where: { id, employeeId: actor.employee.id } });
      if (!request) throw new NotFoundException();
      const key = `submit:${actor.employee.id}:${operationId}`;
      if (request.operationKey === key) return { id: request.id, status: request.status };
      if (request.status !== 'DRAFT') throw new ConflictException('Request already submitted');
      const { employee, days, account } = await this.validate(tx, request, false);
      const steps = await this.resolver.resolve(tx, employee);
      await tx.leaveRequestDay.createMany({ data: days.map((date) => ({ requestId: id, date })) });
      await tx.leaveApprovalStep.createMany({ data: steps.map((s) => ({ ...s, requestId: id })) });
      const status = steps.length ? 'PENDING' : 'APPROVED';
      await tx.leaveRequest.update({
        where: { id },
        data: {
          status,
          accountId: account.id,
          submittedById: actor.employee.id,
          submittedAt: new Date(),
          operationKey: key,
          version: { increment: 1 },
        },
      });
      await tx.leaveLedgerEntry.create({
        data: {
          accountId: account.id,
          requestId: id,
          type: steps.length ? 'PENDING_RESERVATION' : 'APPROVED_LEAVE',
          reservedDelta: steps.length ? days.length : 0,
          usedDelta: steps.length ? 0 : days.length,
          actorId: actor.employee.id,
          postingKey: `submission:${id}`,
        },
      });
      await audit(tx, actor.employee.id, 'LEAVE_SUBMITTED', 'LeaveRequest', id, { status, days: days.length });
      if (steps[0]) await notify(tx, steps[0].approverId, 'APPROVAL_ASSIGNED', 'LeaveRequest', id, `assigned:${id}:1`);
      await notify(
        tx,
        employee.id,
        steps.length ? 'LEAVE_SUBMITTED' : 'LEAVE_APPROVED',
        'LeaveRequest',
        id,
        `submitted:${id}`,
      );
      return { id, status };
    });
  }
  async list(actor: Principal, q: PageDto, admin = false) {
    if (admin) requireHr(actor, 'LEAVE_ADMIN');
    const where: Prisma.LeaveRequestWhereInput = admin
      ? { employee: { departmentId: q.departmentId } }
      : { employeeId: actor.employee.id };
    const rows = await this.db.leaveRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, employeeId: true, firstName: true, lastName: true } },
        _count: { select: { leaveRequestDay_request: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    });
    const total = await this.db.leaveRequest.count({ where });
    return {
      items: rows.map((r) => ({
        id: r.id,
        employee: r.employee,
        type: r.type,
        startDate: isoDate(r.startDate),
        endDate: isoDate(r.endDate),
        status: r.status,
        workingDays: r._count.leaveRequestDay_request,
        source: r.source,
      })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }
  async detail(actor: Principal, id: string) {
    return this.db.transaction(async (tx) => {
      const r = await tx.leaveRequest.findUnique({
        where: { id },
        include: {
          employee: { select: { firstName: true, lastName: true, employeeId: true } },
          leaveApprovalStep_request: { orderBy: { sequence: 'asc' } },
          leaveRequestDay_request: true,
          leaveCancellationRequest_request: {
            include: { leaveCancellationApprovalStep_cancellation: { orderBy: { sequence: 'asc' } } },
          },
        },
      });
      if (!r) throw new NotFoundException();
      let assigned = false;
      const assignedSteps = [
        ...r.leaveApprovalStep_request,
        ...r.leaveCancellationRequest_request.flatMap((c) => c.leaveCancellationApprovalStep_cancellation),
      ];
      for (const step of assignedSteps) {
        if (step.approverId === actor.employee.id && (await this.resolver.eligible(tx, step))) assigned = true;
      }
      const hr =
        (actor.employee.department.kind === 'HR' || actor.employee.position === 'SENIOR_DIRECTOR') &&
        actor.permissions.includes('LEAVE_ADMIN');
      if (r.employeeId !== actor.employee.id && !assigned && !hr) throw new NotFoundException();
      const steps = [];
      for (const s of r.leaveApprovalStep_request) {
        steps.push({
          id: s.id,
          sequence: s.sequence,
          type: s.type,
          approverId: s.approverId,
          status: s.status,
          actedAt: s.actedAt,
          reason: s.reason,
          eligible: await this.resolver.eligible(tx, s),
        });
      }
      return {
        id: r.id,
        employeeId: r.employeeId,
        employee: r.employee,
        type: r.type,
        startDate: isoDate(r.startDate),
        endDate: isoDate(r.endDate),
        reason: r.reason,
        status: r.status,
        source: r.source,
        workingDays: r.leaveRequestDay_request.length,
        steps,
        cancellations: r.leaveCancellationRequest_request.map((c) => ({
          id: c.id,
          status: c.status,
          reason: c.reason,
          steps: c.leaveCancellationApprovalStep_cancellation,
        })),
        ...(hr ? { administrativeReason: r.administrativeReason } : {}),
      };
    });
  }
}
