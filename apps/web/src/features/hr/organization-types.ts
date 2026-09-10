import type { DirectoryEmployee, TaskManagementType } from '@tms/contracts';

export interface Department {
  id: string;
  name: string;
  code: string;
  status: string;
  version: number;
  kind: string;
  taskManagementTypes: TaskManagementType[];
  kanbanWipLimit: number;
  _count?: { employee_department: number };
  teams?: Team[];
}
export interface Team {
  id: string;
  code: string;
  name: string;
  status: string;
  version: number;
  taskManagementTypes: TaskManagementType[];
  kanbanWipLimit: number;
  _count?: { employees: number };
  employees?: DirectoryEmployee[];
  workspace?: {
    id: string;
    memberships: { employeeId: string; canCreateTasks: boolean; canCreateBoards: boolean }[];
    boards: {
      id: string;
      name: string;
      kind: TaskManagementType;
      creator: { firstName: string; lastName: string };
    }[];
    _count?: { boards: number };
  } | null;
}
export interface DepartmentDetail extends Department {
  employee_department: DirectoryEmployee[];
  teams: Team[];
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

export interface OrganizationHierarchy {
  departments: Department[];
  employees: DirectoryEmployee[];
  summary?: {
    totalEmployees: number;
    activeEmployees: number;
    suspendedEmployees: number;
    departments: number;
    boards: number;
  };
}
