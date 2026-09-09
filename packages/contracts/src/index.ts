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
export type AccessRole = 'MEMBER' | 'ACCOUNT_DIRECTOR' | 'HR_MEMBER' | 'HR_DIRECTOR' | 'SENIOR_DIRECTOR';
export const ROLE_PERMISSIONS: Record<AccessRole, readonly PermissionCode[]> = {
  MEMBER: [],
  ACCOUNT_DIRECTOR: ['REPORTING_READ'],
  HR_MEMBER: ['EMPLOYEE_READ', 'EMPLOYEE_UPDATE', 'DEPARTMENT_ASSIGN_MEMBER', 'REPORTING_READ'],
  HR_DIRECTOR: [
    'EMPLOYEE_CREATE',
    'EMPLOYEE_READ',
    'EMPLOYEE_UPDATE',
    'EMPLOYEE_STATUS_MANAGE',
    'EMPLOYEE_PASSWORD_RESET',
    'EMPLOYEE_PRIVATE_READ',
    'DEPARTMENT_CREATE',
    'DEPARTMENT_UPDATE',
    'DEPARTMENT_ASSIGN_MEMBER',
    'EMPLOYMENT_MANAGE',
    'LEAVE_POLICY_MANAGE',
    'CHRISTMAS_POLICY_MANAGE',
    'LEAVE_ADMIN',
    'LEAVE_HR_APPROVE',
    'AUDIT_READ',
    'REPORTING_READ',
  ],
  SENIOR_DIRECTOR: PERMISSIONS,
};
const ROLE_PERMISSION_CEILINGS: Record<AccessRole, readonly PermissionCode[]> = {
  MEMBER: ROLE_PERMISSIONS.MEMBER,
  ACCOUNT_DIRECTOR: ROLE_PERMISSIONS.ACCOUNT_DIRECTOR,
  HR_MEMBER: [...ROLE_PERMISSIONS.HR_MEMBER, 'LEAVE_HR_APPROVE'],
  HR_DIRECTOR: ROLE_PERMISSIONS.HR_DIRECTOR,
  SENIOR_DIRECTOR: PERMISSIONS,
};
export function resolveAccessRole(position: Position, isHr: boolean): AccessRole {
  if (position === 'SENIOR_DIRECTOR') return 'SENIOR_DIRECTOR';
  if (isHr) return position === 'ACCOUNT_DIRECTOR' ? 'HR_DIRECTOR' : 'HR_MEMBER';
  return position === 'ACCOUNT_DIRECTOR' ? 'ACCOUNT_DIRECTOR' : 'MEMBER';
}
export function canRoleHoldPermission(position: Position, isHr: boolean, permission: PermissionCode): boolean {
  return ROLE_PERMISSION_CEILINGS[resolveAccessRole(position, isHr)].includes(permission);
}
export function effectivePermissions(
  position: Position,
  isHr: boolean,
  grants: readonly PermissionCode[] = [],
): PermissionCode[] {
  const role = resolveAccessRole(position, isHr);
  return [
    ...new Set([
      ...ROLE_PERMISSIONS[role],
      ...grants.filter((permission) => canRoleHoldPermission(position, isHr, permission)),
    ]),
  ];
}
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
export type DepartmentKind = 'OPERATIONAL' | 'HR';
export type LeaveType = 'VACATION' | 'SICK' | 'CHRISTMAS_VACATION';
export interface DirectoryEmployee {
  id: string;
  employeeId: string;
  displayName: string;
  department: { id: string; name: string; code: string; kind: DepartmentKind } | null;
  position: Position;
}
export interface CurrentEmployee extends DirectoryEmployee {
  role: AccessRole;
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

export type WorkspaceFunction =
  'ENGINEERING_PRODUCT' | 'MARKETING_CREATIVE' | 'SALES_ACCOUNT_MANAGEMENT' | 'HR_OPERATIONS' | 'FINANCE_LEGAL';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type TaskManagementType = 'KANBAN' | 'SCRUM' | 'LIST';
export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED';
export interface TaskPerson {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  position: Position;
}
export interface TaskColumnContract {
  id: string;
  name: string;
  position: number;
  isInitial: boolean;
  isDone: boolean;
  managementLocked: boolean;
  tasks: TaskContract[];
}
export interface TaskContract {
  id: string;
  publicKey: string;
  title: string;
  description: string;
  priority: TaskPriority;
  estimatedHours: number;
  isManagementApproved: boolean;
  isEscalated: boolean;
  columnId: string;
  column: { id: string; name: string; isInitial: boolean; isDone: boolean; managementLocked: boolean };
  boardId: string;
  dueDate: string | null;
  sprint: { id: string; name: string; status: SprintStatus } | null;
  workspaceId: string;
  workspace: { id: string; code: string; name: string; departmentId: string };
  reporter: TaskPerson;
  assignee: TaskPerson | null;
  milestone: { id: string; name: string; dueDate: string; isOvercapacity: boolean } | null;
}
