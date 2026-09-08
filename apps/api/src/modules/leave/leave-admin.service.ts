import { ConflictException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { dateOnly } from '../../common/dates';
import { type Principal, requireHr } from '../authorization/authorization';
import { audit, notify } from '../audit/audit';
import { lockEmployee } from '../database/database.module';
import { AdjustmentDto, AdminLeaveDto } from './leave.dto';
import { LeaveWorkflowService } from './leave-workflow.service';

export class LeaveAdminService extends LeaveWorkflowService {
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
