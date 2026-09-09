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
  icon: ReactNode;
}

export function portalNavigation(user: CurrentEmployee, unread: number): NavigationItem[] {
  const organization = user.position === 'SENIOR_DIRECTOR' || user.permissions.includes('EMPLOYEE_READ');
  const manager = user.position !== 'MEMBER';
  return [
    { href: '/', label: 'Overview', icon: <DashboardOutlined /> },
    ...(organization ? [{ href: '/organization', label: 'Organization', icon: <AccountTreeOutlined /> }] : []),
    ...(user.department ? [{ href: '/department', label: 'Department', icon: <BusinessOutlined /> }] : []),
    ...(canViewPeople(user) ? [{ href: '/employees', label: 'People', icon: <GroupsOutlined /> }] : []),
    { href: '/tasks', label: 'My tasks', icon: <WorkOutlineOutlined /> },
    { href: '/workspaces', label: 'Team boards', icon: <ViewKanbanOutlined /> },
    ...(manager ? [{ href: '/task-reports', label: 'Delivery reports', icon: <InsightsOutlined /> }] : []),
    ...(manager ? [{ href: '/task-archive', label: 'Task archive', icon: <DeleteSweepOutlined /> }] : []),
    { href: '/leave', label: 'My leave', icon: <BeachAccessOutlined /> },
    ...(manager || user.permissions.includes('LEAVE_HR_APPROVE')
      ? [{ href: '/approvals', label: 'Approvals', icon: <TaskAltOutlined /> }]
      : []),
    { href: '/calendar', label: 'Leave calendar', icon: <CalendarMonthOutlined /> },
    ...(user.permissions.includes('LEAVE_POLICY_MANAGE') || user.permissions.includes('CHRISTMAS_POLICY_MANAGE')
      ? [{ href: '/policies', label: 'Policies', icon: <PolicyOutlined /> }]
      : []),
    ...(user.permissions.includes('LEAVE_ADMIN')
      ? [{ href: '/hr', label: 'Leave administration', icon: <AdminPanelSettingsOutlined /> }]
      : []),
    ...(user.permissions.includes('AUDIT_READ')
      ? [{ href: '/audit', label: 'Audit log', icon: <FactCheckOutlined /> }]
      : []),
    { href: '/notifications', label: 'Notifications', icon: <NotificationIcon unread={unread} /> },
  ];
}
