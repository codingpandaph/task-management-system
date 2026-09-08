import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.module';
import { TaskReportingService } from './task-reporting.service';

@Injectable()
export class TaskService extends TaskReportingService {
  constructor(db: DatabaseService) {
    super(db);
  }
}
