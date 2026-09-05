import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { dateOnly, isoDate, today } from '../../common/dates';
import type { LeaveRequest, Prisma } from '../../generated/prisma/client';
import { Principal, requireHr } from '../authorization/authorization';
import { audit, notify } from '../audit/audit';
import { DatabaseService, lockEmployee, Transaction } from '../database/database.module';
import { AccountStatusService } from '../employment/account-status.service';
import { PageDto } from '../organization/dto';
import { LeaveApprovalResolver } from './approval.service';
import { LeaveBalanceService } from './balance.service';
import { AdjustmentDto, AdminLeaveDto, CancellationDto, DecisionDto, LeaveDto } from './leave.dto';
@Injectable()
export class LeaveService {
  constructor(
    private readonly db: DatabaseService,
    private readonly balances: LeaveBalanceService,
    private readonly resolver: LeaveApprovalResolver,
    private readonly status: AccountStatusService,
  ) {}
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
  private async validate(tx: Transaction, request: LeaveRequest, admin: boolean) {
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
    const [rows, total] = await Promise.all([
      this.db.leaveRequest.findMany({
        where,
        include: {
          employee: { select: { employeeId: true, firstName: true, lastName: true } },
          _count: { select: { leaveRequestDay_request: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.db.leaveRequest.count({ where }),
    ]);
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
  async inbox(actor: Principal) {
    const steps = await this.db.leaveApprovalStep.findMany({
      where: { approverId: actor.employee.id },
      include: {
        request: {
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const cancellations = await this.db.leaveCancellationApprovalStep.findMany({
      where: { approverId: actor.employee.id },
      include: { cancellation: { select: { id: true, requestId: true, status: true } } },
      take: 100,
    });
    return { steps, cancellations };
  }
  async decide(actor: Principal, id: string, dto: DecisionDto) {
    if (dto.decision === 'REJECTED' && (!dto.reason || dto.reason.trim().length < 3))
      throw new UnprocessableEntityException('Rejection reason required');
    const lookup = await this.db.leaveRequest.findUniqueOrThrow({ where: { id } });
    return this.db.transaction(async (tx) => {
      await lockEmployee(tx, lookup.employeeId);
      const request = await tx.leaveRequest.findUniqueOrThrow({
        where: { id },
        include: {
          leaveApprovalStep_request: { orderBy: { sequence: 'asc' } },
          _count: { select: { leaveRequestDay_request: true } },
        },
      });
      if (request.status !== 'PENDING' || !request.accountId) throw new ConflictException('Request is not pending');
      const step = request.leaveApprovalStep_request.find((s) => s.status === 'PENDING');
      if (!step || step.approverId !== actor.employee.id || request.employeeId === actor.employee.id)
        throw new ForbiddenException('Not your current approval step');
      if (!(await this.resolver.eligible(tx, step))) throw new ForbiddenException('Approval eligibility lost');
      await tx.leaveApprovalStep.update({
        where: { id: step.id },
        data: { status: dto.decision, actedAt: new Date(), reason: dto.reason },
      });
      const next = request.leaveApprovalStep_request.find((s) => s.sequence > step.sequence && s.status === 'PENDING');
      const complete = dto.decision === 'REJECTED' || !next;
      if (complete) {
        const days = request._count.leaveRequestDay_request;
        await tx.leaveRequest.update({ where: { id }, data: { status: dto.decision, version: { increment: 1 } } });
        await tx.leaveApprovalStep.updateMany({
          where: { requestId: id, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
        await tx.leaveLedgerEntry.create({
          data: {
            accountId: request.accountId,
            requestId: id,
            type: dto.decision === 'REJECTED' ? 'RESERVATION_RELEASE' : 'APPROVED_LEAVE',
            reservedDelta: -days,
            usedDelta: dto.decision === 'APPROVED' ? days : 0,
            actorId: actor.employee.id,
            postingKey: `decision:${id}`,
          },
        });
        await notify(tx, request.employeeId, `LEAVE_${dto.decision}`, 'LeaveRequest', id, `decision:${id}`);
      } else if (next)
        await notify(tx, next.approverId, 'APPROVAL_ASSIGNED', 'LeaveRequest', id, `assigned:${id}:${next.sequence}`);
      await audit(tx, actor.employee.id, `LEAVE_STEP_${dto.decision}`, 'LeaveRequest', id, { sequence: step.sequence });
      return { ok: true };
    });
  }
  async cancel(actor: Principal, id: string, dto: CancellationDto) {
    return this.db.transaction(async (tx) => {
      await lockEmployee(tx, actor.employee.id);
      const r = await tx.leaveRequest.findFirst({
        where: { id, employeeId: actor.employee.id },
        include: {
          leaveApprovalStep_request: { orderBy: { sequence: 'asc' } },
          _count: { select: { leaveRequestDay_request: true } },
        },
      });
      if (!r) throw new NotFoundException();
      const key = `cancel:${actor.employee.id}:${dto.operationId}`;
      const existing = await tx.leaveCancellationRequest.findUnique({ where: { operationKey: key } });
      if (existing) return { id: existing.id, status: existing.status };
      if (!['DRAFT', 'PENDING', 'APPROVED'].includes(r.status))
        throw new ConflictException('Leave cannot be cancelled');
      if (r.status === 'APPROVED' && isoDate(r.startDate) <= today())
        throw new ConflictException('Started leave requires HR correction');
      const chain = r.status === 'APPROVED' ? r.leaveApprovalStep_request : [];
      const c = await tx.leaveCancellationRequest.create({
        data: {
          requestId: id,
          requesterId: actor.employee.id,
          reason: dto.reason,
          operationKey: key,
          status: chain.length ? 'PENDING' : 'APPROVED',
        },
      });
      if (chain.length) {
        await tx.leaveCancellationApprovalStep.createMany({
          data: chain.map((s) => ({
            cancellationId: c.id,
            sequence: s.sequence,
            type: s.type,
            approverId: s.approverId,
            departmentId: s.departmentId,
          })),
        });
        await notify(tx, chain[0].approverId, 'CANCELLATION_ASSIGNED', 'LeaveRequest', id, `cancel-assigned:${c.id}:1`);
      } else {
        await tx.leaveRequest.update({ where: { id }, data: { status: 'CANCELLED', version: { increment: 1 } } });
        await tx.leaveApprovalStep.updateMany({
          where: { requestId: id, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
        if (r.accountId)
          await tx.leaveLedgerEntry.create({
            data: {
              accountId: r.accountId,
              requestId: id,
              cancellationId: c.id,
              type: r.status === 'PENDING' ? 'RESERVATION_RELEASE' : 'CANCELLATION_REVERSAL',
              reservedDelta: r.status === 'PENDING' ? -r._count.leaveRequestDay_request : 0,
              usedDelta: r.status === 'APPROVED' ? -r._count.leaveRequestDay_request : 0,
              actorId: actor.employee.id,
              postingKey: `cancel:${id}`,
            },
          });
      }
      await audit(tx, actor.employee.id, 'LEAVE_CANCELLATION_REQUESTED', 'LeaveRequest', id);
      return { id: c.id, status: c.status };
    });
  }
  async decideCancellation(actor: Principal, id: string, dto: DecisionDto) {
    if (dto.decision === 'REJECTED' && (!dto.reason || dto.reason.trim().length < 3))
      throw new UnprocessableEntityException('Rejection reason required');
    const lookup = await this.db.leaveCancellationRequest.findUniqueOrThrow({
      where: { id },
      include: { request: true },
    });
    return this.db.transaction(async (tx) => {
      await lockEmployee(tx, lookup.request.employeeId);
      const c = await tx.leaveCancellationRequest.findUniqueOrThrow({
        where: { id },
        include: {
          request: { include: { _count: { select: { leaveRequestDay_request: true } } } },
          leaveCancellationApprovalStep_cancellation: { orderBy: { sequence: 'asc' } },
        },
      });
      if (c.status !== 'PENDING' || c.request.status !== 'APPROVED' || isoDate(c.request.startDate) <= today())
        throw new ConflictException('Cancellation cannot proceed');
      const step = c.leaveCancellationApprovalStep_cancellation.find((s) => s.status === 'PENDING');
      if (!step || step.approverId !== actor.employee.id || c.request.employeeId === actor.employee.id)
        throw new ForbiddenException();
      if (!(await this.resolver.eligible(tx, step))) throw new ForbiddenException('Approval eligibility lost');
      await tx.leaveCancellationApprovalStep.update({
        where: { id: step.id },
        data: { status: dto.decision, actedAt: new Date(), reason: dto.reason },
      });
      const next = c.leaveCancellationApprovalStep_cancellation.find(
        (s) => s.sequence > step.sequence && s.status === 'PENDING',
      );
      if (dto.decision === 'REJECTED' || !next) {
        await tx.leaveCancellationRequest.update({ where: { id }, data: { status: dto.decision } });
        await tx.leaveCancellationApprovalStep.updateMany({
          where: { cancellationId: id, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
        if (dto.decision === 'APPROVED') {
          await tx.leaveRequest.update({
            where: { id: c.requestId },
            data: { status: 'CANCELLED', version: { increment: 1 } },
          });
          await tx.leaveLedgerEntry.create({
            data: {
              accountId: c.request.accountId!,
              requestId: c.requestId,
              cancellationId: id,
              type: 'CANCELLATION_REVERSAL',
              usedDelta: -c.request._count.leaveRequestDay_request,
              actorId: actor.employee.id,
              postingKey: `cancel:${c.requestId}`,
            },
          });
        }
        await notify(
          tx,
          c.request.employeeId,
          `CANCELLATION_${dto.decision}`,
          'LeaveRequest',
          c.requestId,
          `cancel-decision:${id}`,
        );
      } else if (next)
        await notify(
          tx,
          next.approverId,
          'CANCELLATION_ASSIGNED',
          'LeaveRequest',
          c.requestId,
          `cancel-assigned:${id}:${next.sequence}`,
        );
      await audit(tx, actor.employee.id, `CANCELLATION_STEP_${dto.decision}`, 'LeaveRequest', c.requestId);
      return { ok: true };
    });
  }
  async adjustment(actor: Principal, dto: AdjustmentDto) {
    requireHr(actor, 'LEAVE_ADMIN');
    if (actor.employee.id === dto.employeeId) throw new ForbiddenException('Self adjustment prohibited');
    return this.db.transaction(async (tx) => {
      await lockEmployee(tx, dto.employeeId);
      const key = `adjust:${actor.employee.id}:${dto.operationId}`;
      if (await tx.leaveLedgerEntry.findUnique({ where: { postingKey: key } })) return { ok: true };
      const accounts = await this.balances.accounts(tx, dto.employeeId, dto.year),
        account = accounts.find((a) => a.type === dto.type)!;
      const balance = await this.balances.balance(tx, account.id);
      if (balance.available + dto.days < 0) throw new UnprocessableEntityException('Adjustment would overdraw balance');
      await tx.leaveLedgerEntry.create({
        data: {
          accountId: account.id,
          type: 'MANUAL_ADJUSTMENT',
          entitlementDelta: dto.days,
          reason: dto.reason,
          actorId: actor.employee.id,
          postingKey: key,
        },
      });
      await audit(tx, actor.employee.id, 'LEAVE_ADJUSTED', 'Employee', dto.employeeId, {
        days: dto.days,
        type: dto.type,
      });
      return { ok: true };
    });
  }
  async administrative(actor: Principal, dto: AdminLeaveDto, correctionId?: string) {
    requireHr(actor, 'LEAVE_ADMIN');
    if (actor.employee.id === dto.employeeId) throw new ForbiddenException('Self administrative leave prohibited');
    return this.db.transaction(async (tx) => {
      await lockEmployee(tx, dto.employeeId);
      const key = `admin:${actor.employee.id}:${dto.operationId}`;
      const exists = await tx.leaveRequest.findUnique({ where: { operationKey: key } });
      if (exists) return { id: exists.id, status: exists.status };
      if (correctionId) {
        const old = await tx.leaveRequest.findFirst({
          where: { id: correctionId, employeeId: dto.employeeId, status: { in: ['PENDING', 'APPROVED'] } },
          include: { _count: { select: { leaveRequestDay_request: true } } },
        });
        if (!old || !old.accountId) throw new ConflictException('Active original leave required');
        await tx.leaveRequest.update({
          where: { id: old.id },
          data: { status: 'CANCELLED', version: { increment: 1 } },
        });
        await tx.leaveApprovalStep.updateMany({
          where: { requestId: old.id, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
        await tx.leaveCancellationRequest.updateMany({
          where: { requestId: old.id, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
        await tx.leaveLedgerEntry.create({
          data: {
            accountId: old.accountId,
            requestId: old.id,
            type: old.status === 'PENDING' ? 'RESERVATION_RELEASE' : 'CANCELLATION_REVERSAL',
            reservedDelta: old.status === 'PENDING' ? -old._count.leaveRequestDay_request : 0,
            usedDelta: old.status === 'APPROVED' ? -old._count.leaveRequestDay_request : 0,
            reason: dto.administrativeReason,
            actorId: actor.employee.id,
            postingKey: `correction:${old.id}`,
          },
        });
      }
      const r = await tx.leaveRequest.create({
        data: {
          employeeId: dto.employeeId,
          type: dto.type,
          startDate: dateOnly(dto.startDate),
          endDate: dateOnly(dto.endDate),
          reason: dto.reason,
          source: 'ADMINISTRATIVE',
          administrativeReason: dto.administrativeReason,
          operationKey: key,
        },
      });
      const { days, account } = await this.validate(tx, r, true);
      await tx.leaveRequestDay.createMany({ data: days.map((date) => ({ requestId: r.id, date })) });
      await tx.leaveRequest.update({
        where: { id: r.id },
        data: { status: 'APPROVED', accountId: account.id, submittedById: actor.employee.id, submittedAt: new Date() },
      });
      await tx.leaveLedgerEntry.create({
        data: {
          accountId: account.id,
          requestId: r.id,
          type: 'APPROVED_LEAVE',
          usedDelta: days.length,
          actorId: actor.employee.id,
          postingKey: `submission:${r.id}`,
        },
      });
      await audit(
        tx,
        actor.employee.id,
        correctionId ? 'LEAVE_CORRECTED' : 'ADMINISTRATIVE_LEAVE_CREATED',
        'LeaveRequest',
        r.id,
        { ...(correctionId ? { originalId: correctionId } : {}), days: days.length },
      );
      await notify(tx, dto.employeeId, 'LEAVE_APPROVED', 'LeaveRequest', r.id, `admin:${r.id}`);
      return { id: r.id, status: 'APPROVED' };
    });
  }
}
