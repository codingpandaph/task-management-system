import { Public } from './modules/authorization/authorization';
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  getHealth(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
