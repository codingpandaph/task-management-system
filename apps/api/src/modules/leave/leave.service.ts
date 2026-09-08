import { Injectable } from '@nestjs/common';
import { AccountStatusService } from '../employment/account-status.service';
import { DatabaseService } from '../database/database.module';
import { LeaveApprovalResolver } from './approval.service';
import { LeaveAdminService } from './leave-admin.service';
import { LeaveBalanceService } from './balance.service';

@Injectable()
export class LeaveService extends LeaveAdminService {
  constructor(
    db: DatabaseService,
    balances: LeaveBalanceService,
    resolver: LeaveApprovalResolver,
    status: AccountStatusService,
  ) {
    super(db, balances, resolver, status);
  }
}
