import { LeaveModule } from './modules/leave/leave.module';
import { LeavePoliciesModule } from './modules/leave/policies.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './modules/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { TaskModule } from './modules/tasks/task.module';

import { validateEnvironment } from './config/environment';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnvironment }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    OrganizationModule,
    LeavePoliciesModule,
    LeaveModule,
    ReportingModule,
    TaskModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
