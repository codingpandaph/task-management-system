'use client';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import MenuOutlined from '@mui/icons-material/MenuOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import type { CurrentEmployee } from '@tms/contracts';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Fragment, useEffect, useState } from 'react';
import { api, clearSession } from '@/lib/api';
import { message } from './ui';
import { ChangePasswordScreen, LoginScreen } from './auth-screens';
import { canOpen, subtitle } from './portal-access';
import { OrganizationScreens } from './organization';
import { LeaveScreens } from './leave';
import { OverviewScreens } from './overview';
import { TaskScreens } from '../tasks/tasks';
import { useUnreadNotifications } from './use-unread-notifications';
import { DepartmentView } from './department-view';
import { portalNavigation } from './portal-nav';

export default function Portal() {
  const path = usePathname(),
    router = useRouter();
  const [user, setUser] = useState<CurrentEmployee | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  useEffect(() => {
    const showNotice = (event: Event) => setNotice((event as CustomEvent<string>).detail);
    window.addEventListener('hris:notice', showNotice);
    return () => window.removeEventListener('hris:notice', showNotice);
  }, []);
  const unread = useUnreadNotifications(user?.id);
  const routeAllowed = !user || canOpen(path, user);
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
  useEffect(() => {
    if (user && !user.mustChangePassword && path !== '/login' && !routeAllowed) router.replace('/');
  }, [path, routeAllowed, router, user]);
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
  if (!user || path === '/login') return <LoginScreen loggedIn={loggedIn} />;
  if (user.mustChangePassword) return <ChangePasswordScreen loggedIn={loggedIn} />;
  if (!routeAllowed)
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
        <CircularProgress aria-label="Opening your workspace" />
      </Box>
    );
  const nav = portalNavigation(user, unread);
  const title = path.startsWith('/departments/')
    ? 'Department'
    : (nav.find(({ href }) => (href === '/' ? path === '/' : path.startsWith(href)))?.label ?? 'People');
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
            CPSync<small>PEOPLE & ORGANIZATION</small>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          {nav.map(({ href, label, group, icon }, index) => (
            <Fragment key={href}>
              {nav[index - 1]?.group !== group && <span className="nav-section">{group}</span>}
              <Link
                href={href}
                className={(href === '/' ? path === '/' : path.startsWith(href)) ? 'nav-link selected' : 'nav-link'}
              >
                {icon}
                <span>{label}</span>
              </Link>
            </Fragment>
          ))}
        </nav>
      </aside>
      <Drawer
        open={mobileNavigationOpen}
        onClose={() => setMobileNavigationOpen(false)}
        className="mobile-navigation"
        slotProps={{
          paper: {
            sx: { width: 'min(88vw, 340px)', bgcolor: 'var(--color-forest)', color: 'var(--color-paper)' },
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Link href="/" className="brand" onClick={() => setMobileNavigationOpen(false)}>
            <span className="brand-mark">CP</span>
            <span>
              CPSync<small>PEOPLE & ORGANIZATION</small>
            </span>
          </Link>
          <nav aria-label="Mobile navigation">
            {nav.map(({ href, label, group, icon }, index) => (
              <Fragment key={href}>
                {nav[index - 1]?.group !== group && <span className="nav-section">{group}</span>}
                <Link
                  href={href}
                  onClick={() => setMobileNavigationOpen(false)}
                  className={(href === '/' ? path === '/' : path.startsWith(href)) ? 'nav-link selected' : 'nav-link'}
                >
                  {icon}
                  <span>{label}</span>
                </Link>
              </Fragment>
            ))}
          </nav>
        </Box>
      </Drawer>
      <div className="workspace">
        <header className="topbar">
          <Stack direction="row" spacing={1.25} className="mobile-brand" sx={{ alignItems: 'center' }}>
            <IconButton
              aria-label="Open navigation"
              onClick={() => setMobileNavigationOpen(true)}
              sx={{ color: 'primary.main' }}
            >
              <MenuOutlined />
            </IconButton>
            <Typography sx={{ fontWeight: 800 }}>CPSync</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Your organization, connected.
          </Typography>
          <Stack direction="row" spacing={1} className="user-actions" sx={{ alignItems: 'center' }}>
            <Avatar
              title={user.displayName}
              aria-label={`Signed in as ${user.displayName}`}
              sx={{
                width: 32,
                height: 32,
                bgcolor: 'var(--color-success-soft)',
                color: 'var(--color-evergreen-deep)',
                fontSize: 'var(--text-label)',
              }}
            >
              {user.displayName.slice(0, 1)}
            </Avatar>
            <Typography variant="body2">{user.displayName}</Typography>
            <Button size="small" component={Link} href="/change-password" startIcon={<LockOutlined />}>
              Password
            </Button>
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
                {subtitle(title, user)}
              </Typography>
            </div>
            <Chip label="London" title="Europe / London" variant="outlined" size="small" />
          </div>
          {error && <Alert severity="error">{error}</Alert>}
          {path === '/change-password' ? (
            <ChangePasswordScreen loggedIn={loggedIn} />
          ) : path.startsWith('/tasks') ||
            path.startsWith('/workspaces') ||
            path.startsWith('/task-reports') ||
            path.startsWith('/task-archive') ? (
            <TaskScreens path={path} user={user} />
          ) : path === '/department' ? (
            <DepartmentView user={user} />
          ) : path.startsWith('/departments/') ? (
            <DepartmentView user={user} departmentId={path.split('/')[2]} />
          ) : path.startsWith('/organization') || path.startsWith('/employees') || path === '/policies' ? (
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
