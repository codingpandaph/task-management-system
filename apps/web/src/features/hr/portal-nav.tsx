import AccountTreeOutlined from '@mui/icons-material/AccountTreeOutlined';
import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined';
import BeachAccessOutlined from '@mui/icons-material/BeachAccessOutlined';
import BusinessOutlined from '@mui/icons-material/BusinessOutlined';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import DeleteSweepOutlined from '@mui/icons-material/DeleteSweepOutlined';
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import InsightsOutlined from '@mui/icons-material/InsightsOutlined';
import PolicyOutlined from '@mui/icons-material/PolicyOutlined';
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined';
import ViewKanbanOutlined from '@mui/icons-material/ViewKanbanOutlined';
import WorkOutlineOutlined from '@mui/icons-material/WorkOutlineOutlined';
import type { CurrentEmployee } from '@tms/contracts';
import type { ReactNode } from 'react';
import { canViewPeople } from './portal-access';
import { NotificationIcon } from './notification-icon';

export interface NavigationItem {
  href: string;
  label: string;
  group: 'Company' | 'Work' | 'Time off' | 'Administration' | 'Updates';
  icon: ReactNode;
}

export function portalNavigation(user: CurrentEmployee, unread: number): NavigationItem[] {
  const organization = user.position === 'SENIOR_DIRECTOR' || user.permissions.includes('EMPLOYEE_READ');
  const manager = user.position !== 'MEMBER';
  return [
    { href: '/', label: 'Overview', group: 'Company', icon: <DashboardOutlined /> },
    ...(organization
      ? [{ href: '/organization', label: 'Organization', group: 'Company' as const, icon: <AccountTreeOutlined /> }]
      : []),
    ...(user.department
      ? [{ href: '/department', label: 'Department', group: 'Company' as const, icon: <BusinessOutlined /> }]
      : []),
    ...(canViewPeople(user)
      ? [{ href: '/employees', label: 'People', group: 'Company' as const, icon: <GroupsOutlined /> }]
      : []),
    { href: '/tasks', label: 'My tasks', group: 'Work', icon: <WorkOutlineOutlined /> },
    { href: '/workspaces', label: 'Team boards', group: 'Work', icon: <ViewKanbanOutlined /> },
    ...(manager
      ? [{ href: '/task-reports', label: 'Delivery reports', group: 'Work' as const, icon: <InsightsOutlined /> }]
      : []),
    ...(manager
      ? [{ href: '/task-archive', label: 'Task archive', group: 'Work' as const, icon: <DeleteSweepOutlined /> }]
      : []),
    { href: '/leave', label: 'My leave', group: 'Time off', icon: <BeachAccessOutlined /> },
    ...(manager || user.permissions.includes('LEAVE_HR_APPROVE')
      ? [{ href: '/approvals', label: 'Approvals', group: 'Time off' as const, icon: <TaskAltOutlined /> }]
      : []),
    { href: '/calendar', label: 'Leave calendar', group: 'Time off', icon: <CalendarMonthOutlined /> },
    ...(user.permissions.includes('LEAVE_POLICY_MANAGE') || user.permissions.includes('CHRISTMAS_POLICY_MANAGE')
      ? [{ href: '/policies', label: 'Policies', group: 'Administration' as const, icon: <PolicyOutlined /> }]
      : []),
    ...(user.permissions.includes('LEAVE_ADMIN')
      ? [
          {
            href: '/hr',
            label: 'Leave administration',
            group: 'Administration' as const,
            icon: <AdminPanelSettingsOutlined />,
          },
        ]
      : []),
    ...(user.permissions.includes('AUDIT_READ')
      ? [{ href: '/audit', label: 'Audit log', group: 'Administration' as const, icon: <FactCheckOutlined /> }]
      : []),
    {
      href: '/notifications',
      label: 'Notifications',
      group: 'Updates',
      icon: <NotificationIcon unread={unread} />,
    },
  ];
}
