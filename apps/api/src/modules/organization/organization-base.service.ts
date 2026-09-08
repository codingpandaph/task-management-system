import { UnprocessableEntityException } from '@nestjs/common';
import type { DirectoryEmployee } from '@tms/contracts';
import { dateOnly } from '../../common/dates';
import type { Department, Employee } from '../../generated/prisma/client';
import { AuthService } from '../auth/auth.service';
import { DatabaseService } from '../database/database.module';
import { AccountStatusService } from '../employment/account-status.service';
import { EmploymentDto } from './dto';

export function directory(e: Employee & { department: Department }): DirectoryEmployee {
  return {
    id: e.id,
    employeeId: e.employeeId,
    displayName: [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' '),
    position: e.position,
    department: {
      id: e.departmentId,
      code: e.department.code,
      name: e.department.name,
      kind: e.department.kind,
    },
  };
}

export abstract class OrganizationBaseService {
  constructor(
    protected readonly db: DatabaseService,
    protected readonly auth: AuthService,
    protected readonly accounts: AccountStatusService,
  ) {}

  protected employmentData(dto: EmploymentDto) {
    const startDate = dateOnly(dto.startDate);
    const endDate = dto.endDate ? dateOnly(dto.endDate) : null;
    const probationEnd = dto.probationEnd ? dateOnly(dto.probationEnd) : null;
    if (
      (dto.type === 'CONTRACTUAL' && !endDate) ||
      (dto.type === 'PROBATIONARY' && !probationEnd) ||
      (endDate && endDate < startDate) ||
      (probationEnd && probationEnd < startDate)
    ) {
      throw new UnprocessableEntityException('Invalid employment dates');
    }
    return { type: dto.type, startDate, endDate, probationEnd };
  }
}
