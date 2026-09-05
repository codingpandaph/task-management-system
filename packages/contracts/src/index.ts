export const PERMISSIONS = [
  'EMPLOYEE_CREATE',
  'EMPLOYEE_READ',
  'EMPLOYEE_UPDATE',
  'EMPLOYEE_STATUS_MANAGE',
  'EMPLOYEE_PASSWORD_RESET',
  'EMPLOYEE_PRIVATE_READ',
  'DEPARTMENT_CREATE',
  'DEPARTMENT_UPDATE',
  'DEPARTMENT_ASSIGN_MEMBER',
  'DEPARTMENT_ASSIGN_ACCOUNT_DIRECTOR',
  'ORGANIZATION_MANAGE',
  'EMPLOYMENT_MANAGE',
  'LEAVE_POLICY_MANAGE',
  'CHRISTMAS_POLICY_MANAGE',
  'LEAVE_ADMIN',
  'LEAVE_HR_APPROVE',
  'PERMISSION_ASSIGN',
  'PERMISSION_REVOKE',
  'AUDIT_READ',
  'REPORTING_READ',
] as const;
export type PermissionCode = (typeof PERMISSIONS)[number];
export const HR_DELEGABLE: readonly PermissionCode[] = [
  'EMPLOYEE_READ',
  'EMPLOYEE_UPDATE',
  'DEPARTMENT_CREATE',
  'DEPARTMENT_UPDATE',
  'DEPARTMENT_ASSIGN_MEMBER',
  'REPORTING_READ',
];
export type Position = 'SENIOR_DIRECTOR' | 'ACCOUNT_DIRECTOR' | 'MEMBER';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'TERMINATED';
export type LeaveType = 'VACATION' | 'SICK' | 'CHRISTMAS_VACATION';
export interface DirectoryEmployee {
  id: string;
  employeeId: string;
  displayName: string;
  department: { id: string; name: string; code: string };
  position: Position;
}
export interface CurrentEmployee extends DirectoryEmployee {
  mustChangePassword: boolean;
  permissions: PermissionCode[];
}
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface ApiError {
  code: string;
  message: string;
  requestId: string;
}
export interface LeaveBalance {
  type: LeaveType;
  entitlement: number;
  reserved: number;
  used: number;
  available: number;
}
