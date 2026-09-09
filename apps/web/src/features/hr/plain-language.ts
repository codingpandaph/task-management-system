import type { PermissionCode } from '@tms/contracts';

const names: Record<string, string> = {
  SENIOR_DIRECTOR: 'Senior Director',
  ACCOUNT_DIRECTOR: 'Account Director',
  MEMBER: 'Employee',
  FULL_TIME: 'Permanent',
  CONTRACTUAL: 'Contract',
  PROBATIONARY: 'Probation',
  VACATION: 'Vacation leave',
  SICK: 'Sick leave',
  CHRISTMAS_VACATION: 'Christmas leave',
};

const permissionNames: Record<PermissionCode, string> = {
  EMPLOYEE_CREATE: 'Add employees',
  EMPLOYEE_READ: 'View employee records',
  EMPLOYEE_UPDATE: 'Edit employee records',
  EMPLOYEE_STATUS_MANAGE: 'Manage employee status',
  EMPLOYEE_PASSWORD_RESET: 'Reset employee passwords',
  EMPLOYEE_PRIVATE_READ: 'View private employee details',
  DEPARTMENT_CREATE: 'Create departments',
  DEPARTMENT_UPDATE: 'Edit departments',
  DEPARTMENT_ASSIGN_MEMBER: 'Transfer employees',
  DEPARTMENT_ASSIGN_ACCOUNT_DIRECTOR: 'Assign department directors',
  ORGANIZATION_MANAGE: 'Manage organization leadership',
  EMPLOYMENT_MANAGE: 'Manage employment records',
  LEAVE_POLICY_MANAGE: 'Manage leave policies',
  CHRISTMAS_POLICY_MANAGE: 'Manage Christmas policies',
  LEAVE_ADMIN: 'Manage employee leave',
  LEAVE_HR_APPROVE: 'Approve leave for HR',
  PERMISSION_ASSIGN: 'Give access',
  PERMISSION_REVOKE: 'Remove access',
  AUDIT_READ: 'View change history',
  REPORTING_READ: 'View reports',
};

export function plainName(value: string) {
  return (
    names[value] ??
    value
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/^./, (letter) => letter.toUpperCase())
  );
}

export function permissionName(value: PermissionCode) {
  return permissionNames[value];
}
