import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { DatabaseService } from '../database/database.module';
import { AccountStatusService } from '../employment/account-status.service';
import { OrganizationLifecycleService } from './organization-lifecycle.service';

@Injectable()
export class OrganizationService extends OrganizationLifecycleService {
  constructor(db: DatabaseService, auth: AuthService, accounts: AccountStatusService) {
    super(db, auth, accounts);
  }
}

export { directory } from './organization-base.service';
