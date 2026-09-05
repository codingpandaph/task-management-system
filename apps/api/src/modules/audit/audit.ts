import type { Prisma } from '../../generated/prisma/client';
import type { Transaction } from '../database/database.module';

// Callers provide identifier/status metadata only; never copy request bodies into audit records.
export async function audit(
  tx: Transaction,
  actorId: string | null,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Prisma.InputJsonObject = {},
) {
  const forbidden = /password|token|secret|reason|birth|email|cookie/i;
  for (const key of Object.keys(metadata)) {
    if (forbidden.test(key)) throw new Error('Sensitive audit metadata is prohibited');
  }
  return tx.auditEvent.create({ data: { actorId, action, targetType, targetId, metadata } });
}

export async function notify(
  tx: Transaction,
  recipientId: string,
  type: string,
  resourceType: string,
  resourceId: string,
  dedupeKey: string,
) {
  return tx.notification.upsert({
    where: { dedupeKey },
    update: {},
    create: { recipientId, type, title: type.toLowerCase().replaceAll('_', ' '), resourceType, resourceId, dedupeKey },
  });
}
