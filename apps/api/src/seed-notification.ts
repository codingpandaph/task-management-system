import type { Transaction } from './modules/database/database.module';

export async function seedApprovalNotification(
  tx: Transaction,
  status: string,
  recipientId: string,
  requestId: string,
) {
  if (status !== 'PENDING') return;
  await tx.notification.create({
    data: {
      recipientId,
      type: 'APPROVAL_ASSIGNED',
      title: 'Approval assigned',
      resourceType: 'LeaveRequest',
      resourceId: requestId,
      dedupeKey: `assigned:${requestId}:1`,
    },
  });
}
