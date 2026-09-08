import type { DirectoryEmployee } from '@tms/contracts';

export interface Department {
  id: string;
  name: string;
  code: string;
  status: string;
  version: number;
}
export interface Policy {
  id: string;
  name: string;
  status: string;
  leavePolicyVersion_policy?: { id: string; vacationDays: number; sickDays: number }[];
  christmasPolicyVersion_policy?: { id: string; days: number }[];
}
export interface EmployeeDetail extends DirectoryEmployee {
  firstName: string;
  middleName?: string;
  lastName: string;
  status: string;
  version: number;
  birthDate?: string;
  email?: string;
}
export interface EmploymentRecord {
  id: string;
  type: string;
  startDate: string;
  endDate?: string;
  probationEnd?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  reason: string;
}
export interface PermissionGrant {
  id: string;
  permission: { code: string };
}
