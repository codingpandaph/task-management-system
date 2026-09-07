'use client';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import AccountTreeOutlined from '@mui/icons-material/AccountTreeOutlined';
import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined';
import BeachAccessOutlined from '@mui/icons-material/BeachAccessOutlined';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import NotificationsNoneOutlined from '@mui/icons-material/NotificationsNoneOutlined';
import PolicyOutlined from '@mui/icons-material/PolicyOutlined';
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined';
import type { CurrentEmployee } from '@tms/contracts';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, clearSession } from '@/lib/api';
import { Form, message } from './ui';
import { OrganizationScreens } from './organization';
import { LeaveScreens } from './leave';
import { OverviewScreens } from './overview';

export default function Portal() {
  const path = usePathname(),
    router = useRouter();
  const [user, setUser] = useState<CurrentEmployee | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  useEffect(() => {
    const showNotice = (event: Event) => setNotice((event as CustomEvent<string>).detail);
    window.addEventListener('hris:notice', showNotice);
    return () => window.removeEventListener('hris:notice', showNotice);
  }, []);
  useEffect(() => {
    let active = true;
    api<CurrentEmployee>('auth/me')
      .then((u) => {
        if (active) {
          setUser(u);
          if (u.mustChangePassword) router.replace('/change-password');
          else if (path === '/login') router.replace('/');
        }
      })
      .catch(() => {
        if (active) {
          setUser(null);
          if (path !== '/login') router.replace('/login');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, router]);
  async function loggedIn() {
    const u = await api<CurrentEmployee>('auth/me');
    setUser(u);
    router.replace(u.mustChangePassword ? '/change-password' : '/');
  }
  if (loading)
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
        <CircularProgress aria-label="Loading application" />
      </Box>
    );
  if (!user && path !== '/login')
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
        <CircularProgress aria-label="Signing out" />
      </Box>
    );
  if (!user || path === '/login')
    return (
      <main className="auth-layout">
        <section className="auth-story">
          <div className="brand-mark">CP</div>
          <Typography component="h1" variant="h2" sx={{ mt: 4, maxWidth: 560 }}>
            A clearer view of your people.
          </Typography>
          <Typography sx={{ mt: 3, maxWidth: 400, opacity: 0.8 }}>
            One place for your organization, time away, and the work of looking after your team.
          </Typography>
          <div className="auth-footer">PEOPLE · ORGANIZATION · TIME AWAY</div>
        </section>
        <section className="auth-form">
          <Paper elevation={0} sx={{ p: { xs: 3, sm: 5 }, width: '100%', maxWidth: 430 }}>
            <Chip label="Employee portal" size="small" sx={{ mb: 3 }} />
            <Typography variant="h4" component="h2">
              Welcome back
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1, mb: 4 }}>
              Sign in with your Employee ID.
            </Typography>
            <Form
              fields={[
                { name: 'employeeId', label: 'Employee ID' },
                { name: 'password', label: 'Password', type: 'password' },
              ]}
              label="Sign in"
              onSubmit={async (values) => {
                await api('auth/login', values);
                await loggedIn();
              }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
              Need access or a password reset? Contact your HR administrator.
            </Typography>
          </Paper>
        </section>
      </main>
    );
  if (user.mustChangePassword)
    return (
      <Box component="main" sx={{ maxWidth: 480, mx: 'auto', p: 3, pt: 8 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 2 }}>
          Choose your password
        </Typography>
        <Alert severity="info" sx={{ mb: 3 }}>
          Change your temporary password before accessing the portal. Use at least 15 characters.
        </Alert>
        <Form
          fields={[
            { name: 'currentPassword', label: 'Temporary password', type: 'password' },
            { name: 'password', label: 'New password', type: 'password' },
          ]}
          label="Change password"
          onSubmit={async (values) => {
            await api('auth/change-password', values);
            await loggedIn();
          }}
        />
      </Box>
    );
  const nav = [
    { href: '/', label: 'Overview', icon: <DashboardOutlined /> },
    { href: '/organization', label: 'Organization', icon: <AccountTreeOutlined /> },
    { href: '/employees', label: 'People', icon: <GroupsOutlined /> },
    { href: '/leave', label: 'My leave', icon: <BeachAccessOutlined /> },
    { href: '/approvals', label: 'Approvals', icon: <TaskAltOutlined /> },
    { href: '/calendar', label: 'Who’s out', icon: <CalendarMonthOutlined /> },
    ...(user.permissions.includes('LEAVE_POLICY_MANAGE') || user.permissions.includes('CHRISTMAS_POLICY_MANAGE')
      ? [{ href: '/policies', label: 'Policies', icon: <PolicyOutlined /> }]
      : []),
    ...(user.permissions.includes('LEAVE_ADMIN')
      ? [{ href: '/hr', label: 'Leave administration', icon: <AdminPanelSettingsOutlined /> }]
      : []),
    ...(user.permissions.includes('AUDIT_READ')
      ? [{ href: '/audit', label: 'Audit log', icon: <FactCheckOutlined /> }]
      : []),
    { href: '/notifications', label: 'Notifications', icon: <NotificationsNoneOutlined /> },
  ];
  const title = nav.find(({ href }) => (href === '/' ? path === '/' : path.startsWith(href)))?.label ?? 'People';
  return (
    <div className="portal">
      <Snackbar
        open={!!notice}
        autoHideDuration={4000}
        onClose={() => setNotice('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setNotice('')}>
          {notice}
        </Alert>
      </Snackbar>
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">CP</span>
          <span>
            CPPinSync<small>PEOPLE & ORGANIZATION</small>
          </span>
        </Link>
        <Typography variant="overline" sx={{ px: 2, mt: 4, color: '#87968f' }}>
          WORKSPACE
        </Typography>
        <nav aria-label="Main navigation">
          {nav.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className={(href === '/' ? path === '/' : path.startsWith(href)) ? 'nav-link selected' : 'nav-link'}
            >
              {icon}
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          A little structure.
          <br />
          More room for people.
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <Typography variant="body2" color="text.secondary">
            Your organization, connected.
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: '#dbe9df', color: '#244f40', fontSize: 13 }}>
              {user.displayName.slice(0, 1)}
            </Avatar>
            <Typography variant="body2">{user.displayName}</Typography>
            <Button
              size="small"
              startIcon={<LogoutOutlined />}
              onClick={async () => {
                try {
                  await api('auth/logout', {});
                  clearSession();
                  setUser(null);
                  router.replace('/login');
                } catch (e) {
                  setError(message(e));
                }
              }}
            >
              Sign out
            </Button>
          </Stack>
        </header>
        <main className="page">
          <div className="page-heading">
            <div>
              <Typography component="h1" variant="h3">
                {title}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                {user.department.name}
              </Typography>
            </div>
            <Chip label="Europe / London" variant="outlined" size="small" />
          </div>
          {error && <Alert severity="error">{error}</Alert>}
          {path.startsWith('/organization') || path.startsWith('/employees') || path === '/policies' ? (
            <OrganizationScreens path={path} user={user} />
          ) : path.startsWith('/leave') || path.startsWith('/approvals') || path.startsWith('/hr') ? (
            <LeaveScreens path={path} user={user} />
          ) : (
            <OverviewScreens path={path} user={user} />
          )}
        </main>
      </div>
    </div>
  );
}
