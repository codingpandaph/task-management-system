import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { isoDate, today } from '../../common/dates';
import { type Principal } from '../authorization/authorization';
import { audit, notify } from '../audit/audit';
import { lockEmployee } from '../database/database.module';
import { CancellationDto, DecisionDto } from './leave.dto';
import { LeaveRequestService } from './leave-request.service';

export class LeaveWorkflowService extends LeaveRequestService {
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
      include: {
        cancellation: {
          select: {
            id: true,
            requestId: true,
            status: true,
            reason: true,
            request: {
              select: {
                startDate: true,
                endDate: true,
                employee: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
      take: 100,
    });
    return {
      steps,
      cancellations: cancellations.map((step) => ({
        ...step,
        cancellation: {
          ...step.cancellation,
          request: {
            ...step.cancellation.request,
            startDate: isoDate(step.cancellation.request.startDate),
            endDate: isoDate(step.cancellation.request.endDate),
          },
        },
      })),
    };
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
}
