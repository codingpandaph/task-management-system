import type { CurrentEmployee } from '@tms/contracts';

export const subtitles: Record<string, string> = {
  Overview: 'Your work and organization',
  Organization: 'Departments and reporting lines',
  Department: 'Your team, boards, and task access',
  People: 'Employee directory',
  'My tasks': 'Assigned work',
  'Team boards': 'Department delivery',
  'Delivery reports': 'Portfolio overview',
  'Task archive': 'Deleted work',
  'My leave': 'Balances and requests',
  Approvals: 'Decisions awaiting review',
  'Who’s out': 'Team availability',
  Policies: 'Leave entitlements',
  'Leave administration': 'Corrections and adjustments',
  'Audit log': 'Recorded business changes',
  Notifications: 'Updates requiring attention',
};

export function subtitle(title: string, user: CurrentEmployee) {
  return subtitles[title] ?? user.department?.name ?? 'Organization-wide';
}

export function canOpen(path: string, user: CurrentEmployee) {
  const departmentRouteId = path.match(/^\/departments\/([^/]+)/)?.[1];
  return (
    (!path.startsWith('/organization') ||
      user.position === 'SENIOR_DIRECTOR' ||
      user.permissions.includes('EMPLOYEE_READ')) &&
    (!path.startsWith('/departments/') ||
      user.position === 'SENIOR_DIRECTOR' ||
      (user.position === 'ACCOUNT_DIRECTOR' && departmentRouteId === user.department?.id) ||
      user.permissions.includes('EMPLOYEE_READ')) &&
    ((!path.startsWith('/task-reports') && !path.startsWith('/task-archive')) || user.position !== 'MEMBER') &&
    (!path.startsWith('/approvals') || user.position !== 'MEMBER' || user.permissions.includes('LEAVE_HR_APPROVE')) &&
    (!path.startsWith('/policies') ||
      user.permissions.includes('LEAVE_POLICY_MANAGE') ||
      user.permissions.includes('CHRISTMAS_POLICY_MANAGE')) &&
    (!path.startsWith('/hr') || user.permissions.includes('LEAVE_ADMIN')) &&
    (!path.startsWith('/audit') || user.permissions.includes('AUDIT_READ')) &&
    (!/^\/employees\/.+/.test(path) || user.permissions.includes('EMPLOYEE_READ'))
  );
}
