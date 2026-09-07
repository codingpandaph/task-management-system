import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { Prisma, PrismaClient } from '../../generated/prisma/client';

export type Transaction = Prisma.TransactionClient;

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService) {
    super({ adapter: new PrismaPg({ connectionString: config.getOrThrow<string>('DATABASE_URL') }) });
  }

  async transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.$transaction(work, { isolationLevel: 'Serializable', timeout: 15_000 });
      } catch (error) {
        const retryable =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2034' || /40001|40P01|serialize|deadlock/i.test(JSON.stringify(error.meta ?? {})));
        if (!retryable || attempt >= 4) throw error;
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

export async function lockEmployee(tx: Transaction, id: string) {
  await tx.$queryRaw`SELECT id FROM "Employee" WHERE id = ${id}::uuid FOR UPDATE`;
}

@Global()
@Module({ providers: [DatabaseService], exports: [DatabaseService] })
export class DatabaseModule {}
