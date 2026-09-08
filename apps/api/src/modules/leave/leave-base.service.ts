import { AccountStatusService } from '../employment/account-status.service';
import { DatabaseService } from '../database/database.module';
import { LeaveApprovalResolver } from './approval.service';
import { LeaveBalanceService } from './balance.service';

export class LeaveBaseService {
  constructor(
    protected readonly db: DatabaseService,
    protected readonly balances: LeaveBalanceService,
    protected readonly resolver: LeaveApprovalResolver,
    protected readonly status: AccountStatusService,
  ) {}
}
