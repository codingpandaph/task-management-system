import { Public } from './modules/authorization/authorization';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from './modules/database/database.module';

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}
  @Get()
  @Public()
  getHealth(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @Public()
  async getReadiness(): Promise<{ status: 'ready'; database: 'reachable' }> {
    try {
      await this.database.$queryRaw`SELECT 1`;
      return { status: 'ready', database: 'reachable' };
    } catch {
      throw new ServiceUnavailableException('Database is unavailable');
    }
  }
}
